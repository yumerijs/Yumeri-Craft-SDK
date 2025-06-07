import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import { 
  DownloadSource, 
  AssetIndex, 
  VersionInfo, 
  ProgressCallback 
} from '../types';
import { FileDownloader } from '../utils/downloader';
import { SourceConfig } from '../utils/source-config';

/**
 * 资源下载器
 */
export class AssetsDownloader {
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
   * 下载资源索引
   * @param versionInfo 版本信息
   * @param onProgress 进度回调
   * @returns 资源索引
   */
  public async downloadAssetIndex(
    versionInfo: VersionInfo,
    onProgress?: ProgressCallback
  ): Promise<AssetIndex> {
    const assetIndexInfo = versionInfo.assetIndex;
    const indexUrl = SourceConfig.convertUrl(assetIndexInfo.url, this.source);
    const indexPath = path.join(this.dataDir, 'assets', 'indexes', `${assetIndexInfo.id}.json`);
    
    // 确保目录存在
    await fs.ensureDir(path.dirname(indexPath));
    
    // 检查文件是否已存在且SHA1匹配
    if (await FileDownloader.validateFileSha1(indexPath, assetIndexInfo.sha1)) {
      try {
        return await fs.readJson(indexPath);
      } catch (error) {
        console.warn('读取资源索引失败，将重新下载', error);
      }
    }
    
    // 下载资源索引
    const success = await FileDownloader.downloadFile(
      indexUrl,
      indexPath,
      assetIndexInfo.sha1,
      onProgress
    );
    
    if (!success) {
      throw new Error('下载资源索引失败');
    }
    
    try {
      return await fs.readJson(indexPath);
    } catch (error) {
      throw new Error('解析资源索引失败');
    }
  }

  /**
   * 下载资源文件
   * @param assetIndex 资源索引
   * @param onProgress 进度回调
   * @returns 下载结果
   */
  public async downloadAssets(
    assetIndex: AssetIndex,
    onProgress?: ProgressCallback
  ): Promise<{
    total: number;
    success: number;
    failed: number;
  }> {
    const assets = Object.entries(assetIndex.objects);
    const total = assets.length;
    let completed = 0;
    let success = 0;
    let failed = 0;
    
    // 创建下载任务
    const downloads = assets.map(([assetPath, asset]) => {
      const hash = asset.hash;
      const prefix = hash.substring(0, 2);
      const assetUrl = `${SourceConfig.getAssetsBaseUrl(this.source)}/${prefix}/${hash}`;
      const assetFilePath = path.join(this.dataDir, 'assets', 'objects', prefix, hash);
      
      return {
        url: assetUrl,
        filePath: assetFilePath,
        sha1: hash,
        onProgress: (downloaded: number, total: number) => {
          // 单个文件进度回调
          if (onProgress) {
            const assetProgress = downloaded / total;
            const overallProgress = (completed + assetProgress) / assets.length;
            onProgress(completed + assetProgress, assets.length, overallProgress * 100);
          }
        }
      };
    });
    
    // 分批下载
    const batchSize = 50; // 每批次下载的文件数
    const batches = Math.ceil(downloads.length / batchSize);
    
    for (let i = 0; i < batches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, downloads.length);
      const batch = downloads.slice(start, end);
      
      const results = await FileDownloader.downloadFiles(batch, this.maxConcurrentDownloads, false);
      
      completed += batch.length;
      success += results.success;
      failed += results.failed;
      
      if (onProgress) {
        onProgress(completed, total, (completed / total) * 100);
      }
    }
    
    return {
      total,
      success,
      failed
    };
  }

  /**
   * 下载所有资源
   * @param versionInfo 版本信息
   * @param onProgress 进度回调
   * @returns 下载结果
   */
  public async downloadAllAssets(
    versionInfo: VersionInfo,
    onProgress?: ProgressCallback
  ): Promise<{
    total: number;
    success: number;
    failed: number;
  }> {
    // 下载资源索引
    const assetIndex = await this.downloadAssetIndex(versionInfo, (progress, total) => {
      if (onProgress) {
        // 资源索引下载占总进度的5%
        onProgress(progress, total, (progress / total) * 5);
      }
    });
    
    // 下载资源文件
    const result = await this.downloadAssets(assetIndex, (progress, total) => {
      if (onProgress) {
        // 资源文件下载占总进度的95%
        const percentage = 5 + (progress / total) * 95;
        onProgress(progress, total, percentage);
      }
    });
    
    return result;
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

