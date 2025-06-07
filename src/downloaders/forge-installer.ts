import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import { spawn } from 'child_process';
import { DownloadSource, ProgressCallback } from '../types';
import { FileDownloader } from '../utils/downloader';
import { SourceConfig } from '../utils/source-config';

/**
 * Forge版本信息
 */
export interface ForgeVersion {
  /**
   * Forge版本ID
   */
  id: string;
  
  /**
   * Minecraft版本
   */
  mcVersion: string;
  
  /**
   * Forge版本
   */
  version: string;
  
  /**
   * 构建号
   */
  build: number;
  
  /**
   * 下载URL
   */
  downloadUrl: string;
  
  /**
   * 是否为推荐版本
   */
  recommended?: boolean;
  
  /**
   * 是否为最新版本
   */
  latest?: boolean;
}

/**
 * Forge安装结果
 */
export interface ForgeInstallResult {
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
  
  /**
   * 版本JAR路径
   */
  versionJarPath?: string;
}

/**
 * Forge安装器
 */
export class ForgeInstaller {
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
   * 获取Forge版本列表
   * @param mcVersion Minecraft版本
   * @returns Forge版本列表
   */
  public async getForgeVersions(mcVersion: string): Promise<ForgeVersion[]> {
    try {
      // 构建API URL
      const apiUrl = this.source === DownloadSource.BMCLAPI
        ? `https://bmclapi2.bangbang93.com/forge/minecraft/${mcVersion}`
        : `https://files.minecraftforge.net/net/minecraftforge/forge/index_${mcVersion}.html`;
      
      // 从BMCLAPI获取版本列表
      if (this.source === DownloadSource.BMCLAPI) {
        const response = await axios.get(apiUrl);
        const forgeData = response.data;
        
        return forgeData.map((forge: any) => ({
          id: `forge-${forge.mcversion}-${forge.version}`,
          mcVersion: forge.mcversion,
          version: forge.version,
          build: forge.build,
          downloadUrl: `https://bmclapi2.bangbang93.com/forge/download/${forge.build}`,
          recommended: forge.type === 'recommended',
          latest: forge.type === 'latest'
        }));
      } 
      // 从官方网站解析版本列表（需要HTML解析，这里简化处理）
      else {
        // 由于官方网站需要解析HTML，这里简化为使用BMCLAPI
        const bmclapiUrl = `https://bmclapi2.bangbang93.com/forge/minecraft/${mcVersion}`;
        const response = await axios.get(bmclapiUrl);
        const forgeData = response.data;
        
        return forgeData.map((forge: any) => ({
          id: `forge-${forge.mcversion}-${forge.version}`,
          mcVersion: forge.mcversion,
          version: forge.version,
          build: forge.build,
          downloadUrl: `https://files.minecraftforge.net/maven/net/minecraftforge/forge/${forge.mcversion}-${forge.version}/forge-${forge.mcversion}-${forge.version}-installer.jar`,
          recommended: forge.type === 'recommended',
          latest: forge.type === 'latest'
        }));
      }
    } catch (error) {
      console.error('获取Forge版本列表失败', error);
      throw new Error('获取Forge版本列表失败');
    }
  }
  
  /**
   * 下载Forge安装器
   * @param forgeVersion Forge版本
   * @param onProgress 进度回调
   * @returns 下载路径
   */
  public async downloadForgeInstaller(
    forgeVersion: ForgeVersion,
    onProgress?: ProgressCallback
  ): Promise<string> {
    try {
      // 构建下载URL
      const downloadUrl = this.source === DownloadSource.BMCLAPI
        ? `https://bmclapi2.bangbang93.com/forge/download/${forgeVersion.build}`
        : `https://files.minecraftforge.net/maven/net/minecraftforge/forge/${forgeVersion.mcVersion}-${forgeVersion.version}/forge-${forgeVersion.mcVersion}-${forgeVersion.version}-installer.jar`;
      
      // 构建保存路径
      const installerPath = path.join(
        this.dataDir,
        'downloads',
        'forge',
        `forge-${forgeVersion.mcVersion}-${forgeVersion.version}-installer.jar`
      );
      
      // 确保目录存在
      await fs.ensureDir(path.dirname(installerPath));
      
      // 下载安装器
      const success = await FileDownloader.downloadFile(
        downloadUrl,
        installerPath,
        undefined, // Forge安装器通常没有SHA1校验
        onProgress
      );
      
      if (!success) {
        throw new Error('下载Forge安装器失败');
      }
      
      return installerPath;
    } catch (error) {
      console.error('下载Forge安装器失败', error);
      throw new Error('下载Forge安装器失败');
    }
  }
  
  /**
   * 安装Forge
   * @param forgeVersion Forge版本
   * @param javaPath Java路径
   * @param onProgress 进度回调
   * @returns 安装结果
   */
  public async installForge(
    forgeVersion: ForgeVersion,
    javaPath: string = 'java',
    onProgress?: ProgressCallback
  ): Promise<ForgeInstallResult> {
    try {
      // 下载安装器
      if (onProgress) {
        onProgress(0, 100, 0);
      }
      
      const installerPath = await this.downloadForgeInstaller(forgeVersion, (progress, total, percentage) => {
        if (onProgress) {
          // 下载占总进度的30%
          onProgress(progress, total, percentage * 0.3);
        }
      });
      
      if (onProgress) {
        onProgress(30, 100, 30);
      }
      
      // 构建Forge版本ID和目录
      const forgeVersionId = `${forgeVersion.mcVersion}-forge-${forgeVersion.version}`;
      const forgeVersionDir = path.join(this.dataDir, 'versions', forgeVersionId);
      
      // 确保目录存在
      await fs.ensureDir(forgeVersionDir);
      
      // 运行Forge安装器
      return new Promise<ForgeInstallResult>((resolve, reject) => {
        // 构建安装命令
        const installer = spawn(javaPath, [
          '-jar',
          installerPath,
          '--installClient',
          forgeVersionDir
        ], {
          stdio: 'pipe'
        });
        
        let output = '';
        
        // 处理标准输出
        installer.stdout.on('data', (data) => {
          const text = data.toString();
          output += text;
          console.log(`Forge安装器输出: ${text}`);
          
          // 根据输出更新进度
          if (text.includes('Installing')) {
            if (onProgress) onProgress(50, 100, 50);
          } else if (text.includes('Extracting')) {
            if (onProgress) onProgress(70, 100, 70);
          } else if (text.includes('Downloading')) {
            if (onProgress) onProgress(80, 100, 80);
          }
        });
        
        // 处理错误输出
        installer.stderr.on('data', (data) => {
          const text = data.toString();
          output += text;
          console.error(`Forge安装器错误: ${text}`);
        });
        
        // 处理安装完成
        installer.on('close', async (code) => {
          if (code === 0) {
            console.log('Forge安装器成功完成');
            
            // 检查安装结果
            const forgeJsonPath = path.join(forgeVersionDir, `${forgeVersionId}.json`);
            const forgeJarPath = path.join(forgeVersionDir, `${forgeVersionId}.jar`);
            
            if (!await fs.pathExists(forgeJsonPath)) {
              return reject(new Error('Forge安装失败: 未找到版本JSON文件'));
            }
            
            if (onProgress) {
              onProgress(100, 100, 100);
            }
            
            resolve({
              success: true,
              versionId: forgeVersionId,
              versionJsonPath: forgeJsonPath,
              versionJarPath: forgeJarPath
            });
          } else {
            console.error(`Forge安装器退出，代码: ${code}`);
            console.error(`安装器输出: ${output}`);
            reject(new Error(`Forge安装失败，退出代码: ${code}`));
          }
        });
        
        // 处理安装错误
        installer.on('error', (error) => {
          console.error('Forge安装器错误:', error);
          reject(new Error(`Forge安装失败: ${error.message}`));
        });
      });
    } catch (error) {
      console.error('安装Forge失败', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '安装Forge失败'
      };
    }
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

