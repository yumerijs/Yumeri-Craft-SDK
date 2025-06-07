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
import extract from 'extract-zip';

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
   * 检查库文件是否适用于当前操作系统和架构
   * @param library 库文件
   * @returns 是否适用
   */
  private isLibraryApplicable(library: Library): boolean {
    const currentOs = {
      name: this.getOsName(),
      arch: this.getOsArchitecture() // 使用 getOsArchitecture()
    };

    // 如果没有规则，默认适用
    if (!library.rules || library.rules.length === 0) {
      return true;
    }

    let isAllowed = false; // 默认不允许

    for (const rule of library.rules) {
      const appliesToOs = !rule.os || (rule.os.name === currentOs.name && (!rule.os.arch || rule.os.arch === currentOs.arch));

      if (rule.action === 'allow') {
        if (appliesToOs) {
          isAllowed = true; // 如果有允许规则且匹配，则允许
        }
      } else if (rule.action === 'disallow') {
        if (appliesToOs) {
          return false; // 如果有禁止规则且匹配，则立即返回 false
        }
      }
    }

    return isAllowed; // 返回最终的允许状态
  }

  /**
   * 获取操作系统名称 (与 Mojang 规范匹配)
   * @returns 操作系统名称
   */
  private getOsName(): string {
    const platform = os.platform();
    if (platform === 'win32') return 'windows';
    if (platform === 'darwin') return 'osx'; // macOS 对应 osx
    if (platform === 'linux') return 'linux';
    return platform; // Fallback
  }

  /**
   * 获取操作系统架构 (与 Mojang 规范匹配)
   * @returns 操作系统架构
   */
  private getOsArchitecture(): string {
    const arch = os.arch();
    if (arch === 'x64') return 'x64';
    if (arch === 'ia32') return 'x86'; // 32-bit Intel/AMD
    if (arch === 'arm64') return 'arm64';
    if (arch === 'arm') return 'arm';
    return arch; // Fallback
  }

  /**
   * 获取普通库文件 (非原生库) 的本地保存路径
   * @param library 库文件对象
   * @returns 本地文件路径
   */
  private getLibraryPath(library: Library): string {
    // 优先使用 downloads.artifact.path (更准确)
    if (library.downloads && library.downloads.artifact) {
      return path.join(this.dataDir, 'libraries', library.downloads.artifact.path);
    }

    // 如果没有 downloads.artifact，根据 Maven 坐标构建路径
    const parts = library.name.split(':');
    const groupId = parts[0].replace(/\./g, path.sep); // org.lwjgl -> org/lwjgl
    const artifactId = parts[1];
    const version = parts[2];

    const fileName = `${artifactId}-${version}.jar`;
    return path.join(this.dataDir, 'libraries', groupId, artifactId, version, fileName);
  }

  /**
   * 获取普通库文件 (非原生库) 的下载URL
   * @param library 库文件对象
   * @returns 下载URL
   */
  private getLibraryDownloadUrl(library: Library): string | null {
    // 优先使用 downloads.artifact.url
    if (library.downloads && library.downloads.artifact) {
      return SourceConfig.convertUrl(library.downloads.artifact.url, this.source);
    }

    // Fallback 到根据 Maven 坐标构建 URL (官方库的默认形式)
    const parts = library.name.split(':');
    const groupId = parts[0].replace(/\./g, '/'); // org.lwjgl -> org/lwjgl
    const artifactId = parts[1];
    const version = parts[2];

    const fileName = `${artifactId}-${version}.jar`;
    const mavenPath = `${groupId}/${artifactId}/${version}/${fileName}`;

    return `${SourceConfig.getLibrariesBaseUrl(this.source)}/${mavenPath}`;
  }

  /**
   * 获取原生库的本地下载路径 (ZIP 文件)
   * @param library 原生库对象
   * @returns 本地文件路径
   */
  private getNativeLibraryDownloadPath(library: Library): string {
    const osNativesKey = `natives-${this.getOsName()}`;
    if (library.downloads && library.downloads.classifiers && library.downloads.classifiers[osNativesKey]) {
      const nativeInfo = library.downloads.classifiers[osNativesKey];
      // 原生库通常是 jar 格式的，但需要解压
      return path.join(this.dataDir, 'libraries', nativeInfo.path);
    }
    // Fallback (通常不应该发生，因为我们会先检查 classifiers)
    const parts = library.name.split(':');
    const groupId = parts[0].replace(/\./g, path.sep);
    const artifactId = parts[1];
    const version = parts[2];
    const osArch = this.getOsArchitecture();
    const fileName = `${artifactId}-${version}-natives-${this.getOsName()}${osArch === 'x86' ? '' : `-${osArch}`}.jar`; // 根据Mojang命名规则
    return path.join(this.dataDir, 'libraries', groupId, artifactId, version, fileName);
  }

  /**
   * 获取原生库的下载URL
   * @param library 原生库对象
   * @returns 下载URL
   */
  private getNativeLibraryDownloadUrl(library: Library): string | null {
    const osNativesKey = `natives-${this.getOsName()}`;
    // 如果有classifiers，并且包含当前操作系统的原生库
    if (library.downloads && library.downloads.classifiers && library.downloads.classifiers[osNativesKey]) {
      const nativeInfo = library.downloads.classifiers[osNativesKey];
      return SourceConfig.convertUrl(nativeInfo.url, this.source);
    }
    return null; // 不是一个原生库或者不适用于当前系统
  }

  /**
   * 下载并解压原生库
   * @param nativeLibraries 需要下载和解压的原生库列表
   * @param nativeDir 解压目标目录
   * @param onProgress 进度回调
   */
  private async downloadAndExtractNatives(
    nativeLibraries: Library[], 
    nativeDir: string, 
    onProgress?: ProgressCallback
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    // 清理旧的原生库目录
    try {
        if (fs.existsSync(nativeDir)) {
          console.log(`Cleaning old native directory: ${nativeDir}`);
          await fs.remove(nativeDir);
        }
        await fs.ensureDir(nativeDir); // 确保目录存在
    } catch (error) {
        console.error(`Error cleaning/creating native directory ${nativeDir}:`, error);
        return { success: 0, failed: nativeLibraries.length };
    }

    const downloadPromises = nativeLibraries.map(async (library, index) => {
      const url = this.getNativeLibraryDownloadUrl(library);
      const filePath = this.getNativeLibraryDownloadPath(library);
      const sha1 = (library.downloads && library.downloads.classifiers && library.downloads.classifiers[`natives-${this.getOsName()}`])
                   ? library.downloads.classifiers[`natives-${this.getOsName()}`].sha1
                   : undefined;

      if (!url) {
        console.warn(`Skipping native library (no download URL): ${library.name}`);
        failed++;
        return;
      }

      try {
        const downloadResult = await FileDownloader.downloadFile(url, filePath, sha1);
        if (!downloadResult) {
            throw new Error(`Failed to download native library: ${library.name}`);
        }

        // 解压整个原生库 JAR 文件到目标目录
        console.log(`Extracting native library: ${filePath} to ${nativeDir}`);
        await extract(filePath, { dir: nativeDir });
        
        const metaInfPath = path.join(nativeDir, 'META-INF');
        if (await fs.pathExists(metaInfPath)) {
            console.log(`Removing META-INF directory from ${nativeDir}`);
            await fs.remove(metaInfPath);
        }        
        success++;
      } catch (error) {
        console.error(`Failed to download or extract native library ${library.name}:`, error);
        failed++;
      } finally {
        if (onProgress) {
          onProgress(success + failed, nativeLibraries.length, ((success + failed) / nativeLibraries.length) * 100);
        }
      }
    });

    await Promise.all(downloadPromises);
    return { success, failed };
  }

  /**
   * 下载库文件 (包括普通JAR和原生库)
   * @param versionInfo 版本信息 (包含 libraries 数组)
   * @param versionName 版本名称 (如 "1.21.1")
   * @param onProgress 进度回调
   * @returns 下载结果
   */
  public async downloadLibraries(
    versionInfo: VersionInfo,
    versionName: string, // 用于构建 natives 路径
    onProgress?: ProgressCallback
  ): Promise<{
    total: number;
    success: number;
    failed: number;
    skipped: number;
  }> {
    const libraries = versionInfo.libraries;
    let normalLibrariesToDownload: { url: string; filePath: string; sha1?: string; }[] = [];
    let nativeLibrariesToDownload: Library[] = []; // 只存储需要下载的原生库对象

    for (const library of libraries) {
      if (!this.isLibraryApplicable(library)) {
        continue; // 跳过不适用于当前系统的库
      }

      const osNativesKey = `natives-${this.getOsName()}`;
      if (library.downloads && library.downloads.classifiers && library.downloads.classifiers[osNativesKey]) {
        // 这是一个原生库，添加到原生库列表
        nativeLibrariesToDownload.push(library);
      } else if (library.downloads && library.downloads.artifact) {
        // 普通JAR库，添加到普通库下载列表
        const url = this.getLibraryDownloadUrl(library);
        const filePath = this.getLibraryPath(library);
        if (url && filePath) {
          normalLibrariesToDownload.push({
            url,
            filePath,
            sha1: library.downloads.artifact.sha1
          });
        }
      } else {
        console.warn(`Skipping library (unrecognized format or no download info): ${library.name}`);
      }
    }

    let total = normalLibrariesToDownload.length + nativeLibrariesToDownload.length;
    let success = 0;
    let failed = 0;
    let skipped = 0;

    // --- 1. 下载普通 JAR 库 ---
    if (normalLibrariesToDownload.length > 0) {
      console.log(`Downloading ${normalLibrariesToDownload.length} normal JAR libraries...`);
      const results = await FileDownloader.downloadFiles(normalLibrariesToDownload.map(d => ({
        url: d.url,
        filePath: d.filePath,
        sha1: d.sha1,
        onProgress: (downloaded: number, total: number) => {
          // 为下载器内部更新进度，这里不直接回调外部进度
          // 外部进度由下面的总进度更新来处理
        }
      })), this.maxConcurrentDownloads);

      success += results.success;
      failed += results.failed;
      skipped += normalLibrariesToDownload.length - (results.success + results.failed); // 计算实际跳过的

      if (onProgress) {
        onProgress(success + failed + skipped, total, ((success + failed + skipped) / total) * 100);
      }
    }

    // --- 2. 下载并解压原生库 ---
    if (nativeLibrariesToDownload.length > 0) {
      console.log(`Downloading and extracting ${nativeLibrariesToDownload.length} native libraries...`);
      // 构建原生库的专属目录
      const nativeExtractedDir = path.join(this.dataDir, 'versions', versionName, `${versionName}-natives`);

      const nativeResults = await this.downloadAndExtractNatives(
        nativeLibrariesToDownload,
        nativeExtractedDir,
        (downloaded, totalNatives, progress) => {
          // 将原生库的进度融入到总进度中
          const currentProgress = (success + failed + skipped) + (downloaded / totalNatives) * nativeLibrariesToDownload.length;
          if (onProgress) {
            onProgress(currentProgress, total, (currentProgress / total) * 100);
          }
        }
      );
      success += nativeResults.success;
      failed += nativeResults.failed;
    }

    // 最终进度回调
    if (onProgress) {
      onProgress(success + failed + skipped, total, ((success + failed + skipped) / total) * 100);
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