import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { 
  DownloadSource, 
  Library, 
  VersionInfo, 
  ProgressCallback 
} from '../types';
import { FileDownloader } from '../utils/downloader';
import { SourceConfig } from '../utils/source-config';

/**
 * 库文件下载器
 */
export class LibrariesDownloader {
  private source: DownloadSource;
  private dataDir: string;
  private maxConcurrentDownloads: number;

  /**
   * 构造函数
   * @param source 下载源
   * @param dataDir 数据目录
   * @param maxConcurrentDownloads 最大并发下载数
   */
  constructor(
    source: DownloadSource = DownloadSource.MOJANG, 
    dataDir: string = './minecraft-data',
    maxConcurrentDownloads: number = 5
  ) {
    this.source = source;
    this.dataDir = dataDir;
    this.maxConcurrentDownloads = maxConcurrentDownloads;
  }

  /**
   * 检查库文件是否适用于当前操作系统
   * @param library 库文件
   * @returns 是否适用
   */
  private isLibraryApplicable(library: Library): boolean {
    // 如果没有规则，默认适用
    if (!library.rules || library.rules.length === 0) {
      return true;
    }

    // 获取当前操作系统信息
    const currentOs = {
      name: this.getOsName(),
      version: os.release(),
      arch: os.arch()
    };

    // 检查规则
    let applicable = false;
    
    for (const rule of library.rules) {
      let action = rule.action === 'allow';
      
      // 如果规则指定了操作系统
      if (rule.os) {
        // 如果操作系统名称不匹配，跳过此规则
        if (rule.os.name && rule.os.name !== currentOs.name) {
          continue;
        }
        
        // 如果操作系统版本不匹配，跳过此规则
        if (rule.os.version && !new RegExp(rule.os.version).test(currentOs.version)) {
          continue;
        }
        
        // 如果操作系统架构不匹配，跳过此规则
        if (rule.os.arch && rule.os.arch !== currentOs.arch) {
          continue;
        }
      }
      
      // 应用规则
      applicable = action;
    }
    
    return applicable;
  }

  /**
   * 获取操作系统名称
   * @returns 操作系统名称
   */
  private getOsName(): string {
    const platform = os.platform();
    
    if (platform === 'win32') return 'windows';
    if (platform === 'darwin') return 'osx';
    if (platform === 'linux') return 'linux';
    
    return platform;
  }

  /**
   * 获取库文件路径
   * @param library 库文件
   * @returns 库文件路径
   */
  private getLibraryPath(library: Library): string {
    if (library.downloads && library.downloads.artifact) {
      return path.join(this.dataDir, 'libraries', library.downloads.artifact.path);
    }
    
    // 解析Maven坐标
    const parts = library.name.split(':');
    const groupId = parts[0];
    const artifactId = parts[1];
    const version = parts[2];
    
    const groupPath = groupId.replace(/\\./g, '/');
    const fileName = `${artifactId}-${version}.jar`;
    
    return path.join(this.dataDir, 'libraries', groupPath, artifactId, version, fileName);
  }

  /**
   * 获取库文件下载URL
   * @param library 库文件
   * @returns 下载URL
   */
  private getLibraryDownloadUrl(library: Library): string | null {
    // 如果有下载信息，使用下载信息中的URL
    if (library.downloads && library.downloads.artifact) {
      return SourceConfig.convertUrl(library.downloads.artifact.url, this.source);
    }
    
    // 解析Maven坐标
    const parts = library.name.split(':');
    const groupId = parts[0];
    const artifactId = parts[1];
    const version = parts[2];
    
    const groupPath = groupId.replace(/\\./g, '/');
    const fileName = `${artifactId}-${version}.jar`;
    const mavenPath = `${groupPath}/${artifactId}/${version}/${fileName}`;
    
    // 构建URL
    return `${SourceConfig.getLibrariesBaseUrl(this.source)}/${mavenPath}`;
  }

  /**
   * 下载库文件
   * @param versionInfo 版本信息
   * @param onProgress 进度回调
   * @returns 下载结果
   */
  public async downloadLibraries(
    versionInfo: VersionInfo,
    onProgress?: ProgressCallback
  ): Promise<{
    total: number;
    success: number;
    failed: number;
    skipped: number;
  }> {
    const libraries = versionInfo.libraries;
    let total = 0;
    let success = 0;
    let failed = 0;
    let skipped = 0;
    
    // 过滤适用的库文件
    const applicableLibraries = libraries.filter(lib => this.isLibraryApplicable(lib));
    total = applicableLibraries.length;
    
    // 创建下载任务
    const downloads = [];
    
    for (const library of applicableLibraries) {
      // 获取库文件下载URL
      const url = this.getLibraryDownloadUrl(library);
      if (!url) {
        skipped++;
        continue;
      }
      
      // 获取库文件保存路径
      const filePath = this.getLibraryPath(library);
      
      // 获取SHA1
      let sha1: string | undefined;
      if (library.downloads && library.downloads.artifact) {
        sha1 = library.downloads.artifact.sha1;
      }
      
      downloads.push({
        url,
        filePath,
        sha1,
        onProgress: (downloaded: number, total: number) => {
          // 单个文件进度回调
          if (onProgress) {
            const libraryProgress = downloaded / total;
            const overallProgress = (success + failed + skipped + libraryProgress) / applicableLibraries.length;
            onProgress(success + failed + skipped + libraryProgress, applicableLibraries.length, overallProgress * 100);
          }
        }
      });
    }
    
    // 分批下载
    const batchSize = 20; // 每批次下载的文件数
    const batches = Math.ceil(downloads.length / batchSize);
    
    for (let i = 0; i < batches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, downloads.length);
      const batch = downloads.slice(start, end);
      
      const results = await FileDownloader.downloadFiles(batch, this.maxConcurrentDownloads);
      
      success += results.success;
      failed += results.failed;
      
      if (onProgress) {
        onProgress(success + failed + skipped, total, ((success + failed + skipped) / total) * 100);
      }
    }
    
    return {
      total,
      success,
      failed,
      skipped
    };
  }

  /**
   * 设置下载源
   * @param source 下载源
   */
  public setSource(source: DownloadSource): void {
    this.source = source;
  }

  /**
   * 获取当前下载源
   * @returns 下载源
   */
  public getSource(): DownloadSource {
    return this.source;
  }

  /**
   * 设置数据目录
   * @param dataDir 数据目录
   */
  public setDataDir(dataDir: string): void {
    this.dataDir = dataDir;
  }

  /**
   * 获取数据目录
   * @returns 数据目录
   */
  public getDataDir(): string {
    return this.dataDir;
  }

  /**
   * 设置最大并发下载数
   * @param maxConcurrentDownloads 最大并发下载数
   */
  public setMaxConcurrentDownloads(maxConcurrentDownloads: number): void {
    this.maxConcurrentDownloads = maxConcurrentDownloads;
  }

  /**
   * 获取最大并发下载数
   * @returns 最大并发下载数
   */
  public getMaxConcurrentDownloads(): number {
    return this.maxConcurrentDownloads;
  }
}

