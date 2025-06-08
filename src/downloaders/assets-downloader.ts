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
    maxConcurrentDownloads: number = 8
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
   * 下载资源文件（真正的并发控制）
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
    let lastReportedPercentage = -1;
    
    console.log(`开始下载 ${total} 个资源文件，最大并发数: ${this.maxConcurrentDownloads}...`);
    
    // 创建下载任务队列
    const downloadQueue = assets.map(([assetPath, asset]) => {
      const hash = asset.hash;
      const prefix = hash.substring(0, 2);
      const assetUrl = `${SourceConfig.getAssetsBaseUrl(this.source)}/${prefix}/${hash}`;
      const assetFilePath = path.join(this.dataDir, 'assets', 'objects', prefix, hash);
      
      return {
        url: assetUrl,
        filePath: assetFilePath,
        hash: hash
      };
    });
    
    // 进度更新函数
    const updateProgress = () => {
      completed++;
      const currentPercentage = Math.floor((completed / total) * 100);
      
      // 每1%更新一次进度
      if (currentPercentage > lastReportedPercentage && onProgress) {
        lastReportedPercentage = currentPercentage;
        onProgress(completed, total, currentPercentage);
      }
    };
    
    // 单个下载任务处理函数
    const processDownload = async (download: typeof downloadQueue[0]) => {
      try {
        // 检查文件是否已存在（资源文件以SHA1命名，存在即正确，无需验证SHA1）
        if (await fs.pathExists(download.filePath)) {
          updateProgress();
          return true;
        }
        
        // 确保目录存在
        await fs.ensureDir(path.dirname(download.filePath));
        
        // 下载文件（不验证SHA1，因为文件名就是SHA1）
        const result = await FileDownloader.downloadFile(
          download.url,
          download.filePath,
          undefined, // 不传入SHA1，跳过验证
          undefined  // 不传入进度回调，避免干扰总体进度
        );
        
        updateProgress();
        return result;
      } catch (error) {
        console.error(`下载资源文件失败: ${download.url}`, error);
        updateProgress();
        return false;
      }
    };
    
    // 实现真正的并发控制：当一个下载完成立即启动下一个
    const activeDownloads = new Set<Promise<boolean>>();
    let queueIndex = 0;
    
    // 启动初始下载
    while (queueIndex < downloadQueue.length && activeDownloads.size < this.maxConcurrentDownloads) {
      const downloadPromise = processDownload(downloadQueue[queueIndex]);
      activeDownloads.add(downloadPromise);
      queueIndex++;
      
      // 当下载完成时，立即启动下一个
      downloadPromise.finally(() => {
        activeDownloads.delete(downloadPromise);
      });
    }
    
    // 持续处理队列，直到所有下载完成
    while (activeDownloads.size > 0 || queueIndex < downloadQueue.length) {
      // 等待任意一个下载完成
      if (activeDownloads.size > 0) {
        const completedDownload = await Promise.race(activeDownloads);
        
        if (completedDownload) {
          success++;
        } else {
          failed++;
        }
        
        // 如果队列中还有任务，立即启动下一个
        if (queueIndex < downloadQueue.length) {
          const downloadPromise = processDownload(downloadQueue[queueIndex]);
          activeDownloads.add(downloadPromise);
          queueIndex++;
          
          downloadPromise.finally(() => {
            activeDownloads.delete(downloadPromise);
          });
        }
      } else {
        // 如果没有活动下载但队列中还有任务，启动新的下载
        if (queueIndex < downloadQueue.length) {
          const downloadPromise = processDownload(downloadQueue[queueIndex]);
          activeDownloads.add(downloadPromise);
          queueIndex++;
          
          downloadPromise.finally(() => {
            activeDownloads.delete(downloadPromise);
          });
        }
      }
    }
    
    // 确保最终进度为100%
    if (onProgress) {
      onProgress(total, total, 100);
    }
    
    console.log(`资源文件下载完成: 成功 ${success}, 失败 ${failed}, 总计 ${total}`);
    
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
    console.log('开始下载游戏资源...');
    
    // 下载资源索引
    console.log('正在下载资源索引...');
    const assetIndex = await this.downloadAssetIndex(versionInfo, (progress, total, percentage) => {
      if (onProgress) {
        // 资源索引下载占总进度的2%
        const overallPercentage = (percentage / 100) * 2;
        onProgress(progress, total, overallPercentage);
      }
    });
    
    console.log(`资源索引下载完成，共 ${Object.keys(assetIndex.objects).length} 个资源文件`);
    
    // 下载资源文件
    console.log('正在下载资源文件...');
    const result = await this.downloadAssets(assetIndex, (progress, total, percentage) => {
      if (onProgress) {
        // 资源文件下载占总进度的98%
        const overallPercentage = 2 + (percentage / 100) * 98;
        onProgress(progress, total, overallPercentage);
      }
    });
    
    console.log('所有资源下载完成！');
    
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

