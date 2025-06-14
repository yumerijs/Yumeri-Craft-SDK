import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import { DownloadSource, ProgressCallback } from '../types';
import { FileDownloader } from '../utils/downloader';
import { SourceConfig } from '../utils/source-config';

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
   * JAR下载URL
   */
  jarUrl?: string;
  
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
 * Fabric安装器（修复版）
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
          jarUrl: `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${loaderVersion}/profile/jar`,
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
   * 下载Fabric API
   * @param mcVersion Minecraft版本
   * @param onProgress 进度回调
   * @returns 下载的Fabric API文件路径
   */
  public async downloadFabricAPI(
    mcVersion: string,
    onProgress?: ProgressCallback
  ): Promise<string[]> {
    try {
      // 获取Fabric API版本信息
      const apiUrl = `https://api.modrinth.com/v2/project/fabric-api/version?game_versions=["${mcVersion}"]&loaders=["fabric"]`;
      const response = await axios.get(apiUrl);
      const versions = response.data;
      
      if (!versions || versions.length === 0) {
        throw new Error(`未找到Minecraft ${mcVersion}的Fabric API版本`);
      }
      
      // 选择最新版本
      const latestVersion = versions[0];
      const downloadedFiles: string[] = [];
      
      // 创建mods目录
      const modsDir = path.join(this.dataDir, 'mods');
      await fs.ensureDir(modsDir);
      
      // 下载所有文件
      for (let i = 0; i < latestVersion.files.length; i++) {
        const file = latestVersion.files[i];
        if (file.primary || latestVersion.files.length === 1) {
          const filePath = path.join(modsDir, file.filename);
          
          const success = await FileDownloader.downloadFile(
            file.url,
            filePath,
            file.hashes?.sha1,
            onProgress ? (progress, total, percentage) => {
              onProgress(progress, total, percentage);
            } : undefined
          );
          
          if (success) {
            downloadedFiles.push(filePath);
          }
        }
      }
      
      return downloadedFiles;
    } catch (error) {
      console.error('下载Fabric API失败', error);
      throw new Error('下载Fabric API失败');
    }
  }
  
  /**
   * 安装Fabric到指定版本文件夹
   * @param fabricVersion Fabric版本
   * @param targetVersionName 目标版本名称（现有版本文件夹名）
   * @param downloadFabricAPI 是否下载Fabric API
   * @param onProgress 进度回调
   * @returns 安装结果
   */
  public async installFabric(
    fabricVersion: FabricVersion,
    targetVersionName: string,
    downloadFabricAPI: boolean = true,
    onProgress?: ProgressCallback
  ): Promise<FabricInstallResult> {
    try {
      // 下载Profile JSON
      if (onProgress) {
        onProgress(0, 100, 0);
      }
      
      const profilePath = await this.downloadFabricProfile(fabricVersion);
      const fabricProfileJson = await fs.readJson(profilePath);
      
      if (onProgress) {
        onProgress(10, 100, 10);
      }
      
      // 使用现有版本文件夹
      const targetVersionDir = path.join(this.dataDir, 'versions', targetVersionName);
      
      // 确保目标版本目录存在
      if (!await fs.pathExists(targetVersionDir)) {
        throw new Error(`目标版本文件夹不存在: ${targetVersionDir}`);
      }
      
      // 检查原版本JSON是否存在
      const originalJsonPath = path.join(targetVersionDir, `${targetVersionName}.json`);
      if (!await fs.pathExists(originalJsonPath)) {
        throw new Error(`原版本JSON文件不存在: ${originalJsonPath}`);
      }
      
      // 读取原版本JSON
      const originalVersionJson = await fs.readJson(originalJsonPath);
      
      // 合并Fabric配置到原版本JSON（修复版）
      const mergedJson = this.mergeFabricConfig(originalVersionJson, fabricProfileJson);
      
      // 保存合并后的JSON到目标版本文件夹
      const targetJsonPath = path.join(targetVersionDir, `${targetVersionName}.json`);
      await fs.writeJson(targetJsonPath, mergedJson, { spaces: 2 });
      
      if (onProgress) {
        onProgress(20, 100, 20);
      }
      
      // 下载所有必要的库文件
      const libraries = mergedJson.libraries || [];
      const fabricLibraries = libraries.filter((lib: any) => 
        lib.name && (lib.name.includes('fabric') || lib.name.includes('net.fabricmc'))
      );
      
      const totalLibraries = fabricLibraries.length;
      let downloadedLibraries = 0;
      
      // 创建libraries目录
      const librariesDir = path.join(this.dataDir, 'libraries');
      await fs.ensureDir(librariesDir);
      
      // 下载每个Fabric库文件
      for (const library of fabricLibraries) {
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
            // 库文件下载占总进度的50%
            const percentage = 20 + Math.round((downloadedLibraries / totalLibraries) * 50);
            onProgress(downloadedLibraries, totalLibraries, percentage);
          }
        } catch (libError) {
          console.error(`下载库文件失败: ${library.name}`, libError);
          // 继续下载其他库文件
        }
      }
      
      if (onProgress) {
        onProgress(70, 100, 70);
      }
      
      // 下载Fabric API（如果需要）
      if (downloadFabricAPI) {
        try {
          await this.downloadFabricAPI(fabricVersion.mcVersion, (progress, total, percentage) => {
            if (onProgress) {
              // Fabric API下载占总进度的20%
              const adjustedPercentage = 70 + Math.round(percentage * 0.2);
              onProgress(progress, total, adjustedPercentage);
            }
          });
        } catch (apiError) {
          console.warn('下载Fabric API失败，但Fabric安装继续进行', apiError);
        }
      }
      
      if (onProgress) {
        onProgress(100, 100, 100);
      }
      
      return {
        success: true,
        versionId: targetVersionName,
        versionJsonPath: targetJsonPath
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
   * 合并Fabric配置到原版本JSON（修复版，确保正确合并）
   * @param originalJson 原版本JSON
   * @param fabricJson Fabric版本JSON
   * @returns 合并后的JSON
   */
  private mergeFabricConfig(originalJson: any, fabricJson: any): any {
    const merged = { ...originalJson };
    
    // 更新主类（Fabric的关键）
    if (fabricJson.mainClass) {
      merged.mainClass = fabricJson.mainClass;
    }
    
    // 合并库文件列表
    if (fabricJson.libraries) {
      merged.libraries = [...(merged.libraries || []), ...fabricJson.libraries];
    }
    
    // 合并启动参数
    if (fabricJson.arguments) {
      merged.arguments = merged.arguments || {};
      
      // 合并JVM参数
      if (fabricJson.arguments.jvm) {
        merged.arguments.jvm = [...(merged.arguments.jvm || []), ...fabricJson.arguments.jvm];
      }
      
      // 合并游戏参数
      if (fabricJson.arguments.game) {
        merged.arguments.game = [...(merged.arguments.game || []), ...fabricJson.arguments.game];
      }
    }
    
    // 处理旧版本的minecraftArguments
    if (fabricJson.minecraftArguments && !merged.arguments) {
      merged.minecraftArguments = fabricJson.minecraftArguments;
    }
    
    // 合并其他Fabric特定配置
    if (fabricJson.inheritsFrom) {
      merged.inheritsFrom = fabricJson.inheritsFrom;
    }
    
    if (fabricJson.jar) {
      merged.jar = fabricJson.jar;
    }
    
    // 保留Fabric版本信息
    merged.fabricVersion = fabricJson.id;
    
    // 确保ID正确
    if (fabricJson.id) {
      merged.id = fabricJson.id;
    }
    
    return merged;
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

