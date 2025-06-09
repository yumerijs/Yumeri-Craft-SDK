import fs from 'fs-extra';
import path from 'path';
import { 
  DownloadSource, 
  DownloadOptions, 
  DownloadResult, 
  ProgressCallback,
  VersionInfo
} from '../types';
import { FileDownloader } from '../utils/downloader';
import { SourceConfig } from '../utils/source-config';
import { VersionManager } from './version-manager';
import { AssetsDownloader } from './assets-downloader';
import { LibrariesDownloader } from './libraries-downloader';
import { ForgeInstaller, ForgeVersion, ForgeInstallResult } from './forge-installer';
import { FabricInstaller, FabricVersion, FabricInstallResult } from './fabric-installer';

/**
 * Minecraft下载器
 */
export class MinecraftDownloader {
  private source: DownloadSource;
  private dataDir: string;
  private maxConcurrentDownloads: number;
  private validateIntegrity: boolean;
  private versionManager: VersionManager;
  private assetsDownloader: AssetsDownloader;
  private librariesDownloader: LibrariesDownloader;
  private forgeInstaller: ForgeInstaller;
  private fabricInstaller: FabricInstaller;

  /**
   * 构造函数
   * @param options 下载选项
   */
  constructor(options?: DownloadOptions) {
    this.source = options?.source || DownloadSource.MOJANG;
    this.dataDir = options?.dataDir || './minecraft-data';
    this.maxConcurrentDownloads = options?.maxConcurrentDownloads || 5;
    this.validateIntegrity = options?.validateIntegrity !== false;
    
    // 初始化子下载器
    this.versionManager = new VersionManager(this.source, this.dataDir);
    this.assetsDownloader = new AssetsDownloader(this.source, this.dataDir, this.maxConcurrentDownloads);
    this.librariesDownloader = new LibrariesDownloader(this.source, this.dataDir, this.maxConcurrentDownloads);
    
    // 初始化模组加载器安装器
    this.forgeInstaller = new ForgeInstaller(this.source, this.dataDir, this.maxConcurrentDownloads);
    this.fabricInstaller = new FabricInstaller(this.dataDir, this.maxConcurrentDownloads);
  }

  /**
   * 下载Minecraft客户端
   * @param versionId 版本ID
   * @param versionName 版本名称
   * @param onProgress 进度回调
   * @returns 下载结果
   */
  public async downloadClient(
    versionId: string,
    versionName: string,
    onProgress?: ProgressCallback
  ): Promise<DownloadResult> {
    try {
      // 获取版本信息
      const versionInfo = await this.versionManager.getVersionInfo(versionId);
      
      // 下载客户端JAR
      const clientResult = await this.downloadClientJar(versionInfo, versionName, (progress, total, percentage) => {
        if (onProgress) {
          // 客户端JAR下载占总进度的20%
          onProgress(progress, total, percentage * 0.2);
        }
      });
      
      if (!clientResult.success) {
        return clientResult;
      }
      
      // 保存版本JSON文件
      await this.saveVersionJson(versionInfo, versionName);
      
      // 下载库文件
      const librariesResult = await this.librariesDownloader.downloadLibraries(versionInfo, versionName, (progress, total, percentage) => {
        if (onProgress) {
          // 库文件下载占总进度的30%
          onProgress(progress, total, 20 + percentage * 0.3);
        }
      });
      
      // 下载资源文件
      const assetsResult = await this.assetsDownloader.downloadAllAssets(versionInfo, (progress, total, percentage) => {
        if (onProgress) {
          // 资源文件下载占总进度的50%
          onProgress(progress, total, 50 + percentage * 0.5);
        }
      });
      
      return {
        success: true,
        filePath: clientResult.filePath,
      };
    } catch (error) {
      console.error('下载Minecraft客户端失败', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '下载失败'
      };
    }
  }

  /**
   * 保存版本JSON文件
   * @param versionInfo 版本信息
   * @param versionName 版本名称
   */
  private async saveVersionJson(versionInfo: VersionInfo, versionName: string): Promise<void> {
    const versionDir = path.join(this.dataDir, 'versions', versionName);
    const versionJsonPath = path.join(versionDir, `${versionName}.json`);
    
    // 确保目录存在
    await fs.ensureDir(versionDir);
    
    // 保存版本JSON
    await fs.writeJson(versionJsonPath, versionInfo, { spaces: 2 });
  }

  /**
   * 下载客户端JAR文件
   * @param versionInfo 版本信息
   * @param versionName 版本名称
   * @param onProgress 进度回调
   * @returns 下载结果
   */
  private async downloadClientJar(
    versionInfo: VersionInfo,
    versionName: string,
    onProgress?: ProgressCallback
  ): Promise<DownloadResult> {
    try {
      const clientInfo = versionInfo.downloads.client;
      const clientUrl = SourceConfig.convertUrl(clientInfo.url, this.source);
      const clientPath = path.join(this.dataDir, 'versions', versionName, `${versionName}.jar`);
      
      // 确保目录存在
      await fs.ensureDir(path.dirname(clientPath));
      
      // 下载客户端JAR
      const success = await FileDownloader.downloadFile(
        clientUrl,
        clientPath,
        this.validateIntegrity ? clientInfo.sha1 : undefined,
        onProgress
      );
      
      if (!success) {
        return {
          success: false,
          error: '下载客户端JAR失败'
        };
      }
      
      return {
        success: true,
        filePath: clientPath
      };
    } catch (error) {
      console.error('下载客户端JAR失败', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '下载失败'
      };
    }
  }

  /**
   * 下载服务端JAR文件
   * @param versionId 版本ID
   * @param versionName 版本名称
   * @param onProgress 进度回调
   * @returns 下载结果
   */
  public async downloadServer(
    versionId: string,
    versionName: string,
    onProgress?: ProgressCallback
  ): Promise<DownloadResult> {
    try {
      // 获取版本信息
      const versionInfo = await this.versionManager.getVersionInfo(versionId);
      
      // 检查是否有服务端
      if (!versionInfo.downloads.server) {
        return {
          success: false,
          error: `版本 ${versionId} 没有服务端`
        };
      }
      
      const serverInfo = versionInfo.downloads.server;
      const serverUrl = SourceConfig.convertUrl(serverInfo.url, this.source);
      const serverPath = path.join(this.dataDir, 'versions', versionName, `${versionName}-server.jar`);
      
      // 确保目录存在
      await fs.ensureDir(path.dirname(serverPath));
      
      // 下载服务端JAR
      const success = await FileDownloader.downloadFile(
        serverUrl,
        serverPath,
        this.validateIntegrity ? serverInfo.sha1 : undefined,
        onProgress
      );
      
      if (!success) {
        return {
          success: false,
          error: '下载服务端JAR失败'
        };
      }
      
      return {
        success: true,
        filePath: serverPath
      };
    } catch (error) {
      console.error('下载服务端JAR失败', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '下载失败'
      };
    }
  }

  /**
   * 获取Forge版本列表
   * @param mcVersion Minecraft版本
   * @returns Forge版本列表
   */
  public async getForgeVersions(mcVersion: string): Promise<ForgeVersion[]> {
    return this.forgeInstaller.getForgeVersions(mcVersion);
  }

  /**
   * 安装Forge到指定版本
   * @param forgeVersion Forge版本
   * @param targetVersionName 目标版本名称
   * @param javaPath Java路径
   * @param onProgress 进度回调
   * @returns 安装结果
   */
  public async installForge(
    forgeVersion: ForgeVersion,
    targetVersionName: string,
    javaPath: string = 'java',
    onProgress?: ProgressCallback
  ): Promise<ForgeInstallResult> {
    return this.forgeInstaller.installForge(forgeVersion, targetVersionName, javaPath, onProgress);
  }

  /**
   * 获取Fabric版本列表
   * @param mcVersion Minecraft版本
   * @returns Fabric版本列表
   */
  public async getFabricVersions(mcVersion: string): Promise<FabricVersion[]> {
    return this.fabricInstaller.getFabricVersions(mcVersion);
  }

  /**
   * 安装Fabric到指定版本
   * @param fabricVersion Fabric版本
   * @param targetVersionName 目标版本名称
   * @param onProgress 进度回调
   * @returns 安装结果
   */
  public async installFabric(
    fabricVersion: FabricVersion,
    targetVersionName: string,
    onProgress?: ProgressCallback
  ): Promise<FabricInstallResult> {
    return this.fabricInstaller.installFabric(fabricVersion, targetVersionName, true, onProgress);
  }

  /**
   * 获取版本管理器
   * @returns 版本管理器
   */
  public getVersionManager(): VersionManager {
    return this.versionManager;
  }

  /**
   * 获取资源下载器
   * @returns 资源下载器
   */
  public getAssetsDownloader(): AssetsDownloader {
    return this.assetsDownloader;
  }

  /**
   * 获取库文件下载器
   * @returns 库文件下载器
   */
  public getLibrariesDownloader(): LibrariesDownloader {
    return this.librariesDownloader;
  }

  /**
   * 获取Forge安装器
   * @returns Forge安装器
   */
  public getForgeInstaller(): ForgeInstaller {
    return this.forgeInstaller;
  }

  /**
   * 获取Fabric安装器
   * @returns Fabric安装器
   */
  public getFabricInstaller(): FabricInstaller {
    return this.fabricInstaller;
  }

  /**
   * 设置下载源
   * @param source 下载源
   */
  public setSource(source: DownloadSource): void {
    this.source = source;
    this.versionManager.setSource(source);
    this.assetsDownloader.setSource(source);
    this.librariesDownloader.setSource(source);
    this.forgeInstaller.setSource(source);
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
    this.versionManager.setDataDir(dataDir);
    this.assetsDownloader.setDataDir(dataDir);
    this.librariesDownloader.setDataDir(dataDir);
    this.forgeInstaller.setDataDir(dataDir);
    this.fabricInstaller.setDataDir(dataDir);
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
    this.assetsDownloader.setMaxConcurrentDownloads(maxConcurrentDownloads);
    this.librariesDownloader.setMaxConcurrentDownloads(maxConcurrentDownloads);
    this.forgeInstaller.setMaxConcurrentDownloads(maxConcurrentDownloads);
    this.fabricInstaller.setMaxConcurrentDownloads(maxConcurrentDownloads);
  }

  /**
   * 获取最大并发下载数
   * @returns 最大并发下载数
   */
  public getMaxConcurrentDownloads(): number {
    return this.maxConcurrentDownloads;
  }

  /**
   * 设置是否验证文件完整性
   * @param validateIntegrity 是否验证文件完整性
   */
  public setValidateIntegrity(validateIntegrity: boolean): void {
    this.validateIntegrity = validateIntegrity;
  }

  /**
   * 获取是否验证文件完整性
   * @returns 是否验证文件完整性
   */
  public getValidateIntegrity(): boolean {
    return this.validateIntegrity;
  }
}

