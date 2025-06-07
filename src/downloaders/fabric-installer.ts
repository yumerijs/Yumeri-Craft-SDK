import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import { DownloadSource, ProgressCallback } from '../types';
import { FileDownloader } from '../utils/downloader';

/**
 * Fabric版本信息
 */
export interface FabricVersion {
  /**
   * Fabric版本ID
   */
  id: string;
  
  /**
   * Minecraft版本
   */
  mcVersion: string;
  
  /**
   * Loader版本
   */
  loaderVersion: string;
  
  /**
   * 下载URL
   */
  downloadUrl: string;
  
  /**
   * 是否为稳定版本
   */
  stable?: boolean;
}

/**
 * Fabric安装结果
 */
export interface FabricInstallResult {
  /**
   * 是否成功
   */
  success: boolean;
  
  /**
   * 错误信息
   */
  error?: string;
  
  /**
   * 安装的版本ID
   */
  versionId?: string;
  
  /**
   * 版本JSON路径
   */
  versionJsonPath?: string;
}

/**
 * Fabric安装器
 */
export class FabricInstaller {
  private dataDir: string;
  private maxConcurrentDownloads: number;
  
  /**
   * 构造函数
   * @param dataDir 数据目录
   * @param maxConcurrentDownloads 最大并发下载数
   */
  constructor(
    dataDir: string = './minecraft-data',
    maxConcurrentDownloads: number = 5
  ) {
    this.dataDir = dataDir;
    this.maxConcurrentDownloads = maxConcurrentDownloads;
  }
  
  /**
   * 获取Fabric Loader版本列表
   * @returns Loader版本列表
   */
  public async getLoaderVersions(): Promise<{
    id: string;
    version: string;
    stable: boolean;
  }[]> {
    try {
      const response = await axios.get('https://meta.fabricmc.net/v2/versions/loader');
      return response.data;
    } catch (error) {
      console.error('获取Fabric Loader版本列表失败', error);
      throw new Error('获取Fabric Loader版本列表失败');
    }
  }
  
  /**
   * 获取Fabric版本列表
   * @param mcVersion Minecraft版本
   * @returns Fabric版本列表
   */
  public async getFabricVersions(mcVersion: string): Promise<FabricVersion[]> {
    try {
      // 获取Fabric Meta API中的Loader版本
      const loaderMetaUrl = `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`;
      const response = await axios.get(loaderMetaUrl);
      const loaderMeta = response.data;
      
      return loaderMeta.map((item: any) => {
        const loaderVersion = item.loader.version;
        
        return {
          id: `fabric-${mcVersion}-${loaderVersion}`,
          mcVersion: mcVersion,
          loaderVersion: loaderVersion,
          downloadUrl: `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${loaderVersion}/profile/json`,
          stable: item.loader.stable || false
        };
      });
    } catch (error) {
      console.error('获取Fabric版本列表失败', error);
      throw new Error('获取Fabric版本列表失败');
    }
  }
  
  /**
   * 下载Fabric Profile JSON
   * @param fabricVersion Fabric版本
   * @param onProgress 进度回调
   * @returns 下载路径
   */
  public async downloadFabricProfile(
    fabricVersion: FabricVersion,
    onProgress?: ProgressCallback
  ): Promise<string> {
    try {
      // 构建保存路径
      const profilePath = path.join(
        this.dataDir,
        'downloads',
        'fabric',
        `${fabricVersion.id}-profile.json`
      );
      
      // 确保目录存在
      await fs.ensureDir(path.dirname(profilePath));
      
      // 下载Profile JSON
      const response = await axios.get(fabricVersion.downloadUrl);
      const profileJson = response.data;
      
      // 写入文件
      await fs.writeJson(profilePath, profileJson, { spaces: 2 });
      
      return profilePath;
    } catch (error) {
      console.error('下载Fabric Profile JSON失败', error);
      throw new Error('下载Fabric Profile JSON失败');
    }
  }
  
  /**
   * 安装Fabric
   * @param fabricVersion Fabric版本
   * @param onProgress 进度回调
   * @returns 安装结果
   */
  public async installFabric(
    fabricVersion: FabricVersion,
    mcVersion: string,
    onProgress?: ProgressCallback
  ): Promise<FabricInstallResult> {
    try {
      // 下载Profile JSON
      if (onProgress) {
        onProgress(0, 100, 0);
      }
      
      const profilePath = await this.downloadFabricProfile(fabricVersion);
      const profileJson = await fs.readJson(profilePath);
      
      if (onProgress) {
        onProgress(20, 100, 20);
      }
      
      // 构建Fabric版本ID和目录
      const fabricVersionId = `${fabricVersion.mcVersion}-fabric-${fabricVersion.loaderVersion}`;
      const fabricVersionDir = path.join(this.dataDir, 'versions', mcVersion);
      
      // 确保目录存在
      await fs.ensureDir(fabricVersionDir);
      
      // 创建版本JSON文件
      const versionJsonPath = path.join(fabricVersionDir, `${fabricVersionId}.json`);
      await fs.writeJson(versionJsonPath, profileJson, { spaces: 2 });
      
      if (onProgress) {
        onProgress(30, 100, 30);
      }
      
      // 下载所有必要的库文件
      const libraries = profileJson.libraries || [];
      const totalLibraries = libraries.length;
      let downloadedLibraries = 0;
      
      // 创建libraries目录
      const librariesDir = path.join(this.dataDir, 'libraries');
      await fs.ensureDir(librariesDir);
      
      // 下载每个库文件
      for (const library of libraries) {
        try {
          if (library.downloads && library.downloads.artifact) {
            const artifact = library.downloads.artifact;
            const localPath = path.join(librariesDir, artifact.path);
            
            // 确保目录存在
            await fs.ensureDir(path.dirname(localPath));
            
            // 下载库文件
            await FileDownloader.downloadFile(
              artifact.url,
              localPath,
              artifact.sha1
            );
          }
          
          downloadedLibraries++;
          if (onProgress) {
            // 库文件下载占总进度的60%
            const percentage = 30 + Math.round((downloadedLibraries / totalLibraries) * 60);
            onProgress(downloadedLibraries, totalLibraries, percentage);
          }
        } catch (libError) {
          console.error(`下载库文件失败: ${library.name}`, libError);
          // 继续下载其他库文件
        }
      }
      
      if (onProgress) {
        onProgress(100, 100, 100);
      }
      
      return {
        success: true,
        versionId: fabricVersionId,
        versionJsonPath
      };
    } catch (error) {
      console.error('安装Fabric失败', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '安装Fabric失败'
      };
    }
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

