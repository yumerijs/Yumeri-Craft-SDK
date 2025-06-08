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
   * 安装Forge到指定版本文件夹
   * @param forgeVersion Forge版本
   * @param targetVersionName 目标版本名称（现有版本文件夹名）
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
      
      // 创建临时目录用于Forge安装
      const tempDir = path.join(this.dataDir, 'temp', `forge-install-${Date.now()}`);
      await fs.ensureDir(tempDir);
      
      try {
        // 运行Forge安装器到临时目录
        const forgeInstallResult = await this.runForgeInstaller(
          installerPath,
          tempDir,
          javaPath,
          onProgress
        );
        
        if (!forgeInstallResult.success) {
          throw new Error(forgeInstallResult.error || 'Forge安装失败');
        }
        
        // 查找生成的Forge版本JSON
        const forgeJsonFiles = await fs.readdir(path.join(tempDir, 'versions'));
        const forgeVersionDir = forgeJsonFiles.find(dir => dir.includes('forge'));
        
        if (!forgeVersionDir) {
          throw new Error('未找到Forge安装结果');
        }
        
        const forgeJsonPath = path.join(tempDir, 'versions', forgeVersionDir, `${forgeVersionDir}.json`);
        const forgeVersionJson = await fs.readJson(forgeJsonPath);
        
        // 合并Forge配置到原版本JSON
        const mergedJson = this.mergeForgeConfig(originalVersionJson, forgeVersionJson);
        
        // 保存合并后的JSON到目标版本文件夹
        const targetJsonPath = path.join(targetVersionDir, `${targetVersionName}.json`);
        await fs.writeJson(targetJsonPath, mergedJson, { spaces: 2 });
        
        // 复制Forge相关的JAR文件（如果有）
        const forgeJarPath = path.join(tempDir, 'versions', forgeVersionDir, `${forgeVersionDir}.jar`);
        if (await fs.pathExists(forgeJarPath)) {
          const targetJarPath = path.join(targetVersionDir, `${targetVersionName}.jar`);
          await fs.copy(forgeJarPath, targetJarPath);
        }
        
        // 下载Forge相关的库文件
        await this.downloadForgeLibraries(mergedJson, onProgress);
        
        if (onProgress) {
          onProgress(100, 100, 100);
        }
        
        return {
          success: true,
          versionId: targetVersionName,
          versionJsonPath: targetJsonPath,
          versionJarPath: path.join(targetVersionDir, `${targetVersionName}.jar`)
        };
        
      } finally {
        // 清理临时目录
        try {
          await fs.remove(tempDir);
        } catch (error) {
          console.warn('清理临时目录失败:', error);
        }
      }
      
    } catch (error) {
      console.error('安装Forge失败', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '安装Forge失败'
      };
    }
  }
  
  /**
   * 运行Forge安装器
   * @param installerPath 安装器路径
   * @param targetDir 目标目录
   * @param javaPath Java路径
   * @param onProgress 进度回调
   * @returns 安装结果
   */
  private async runForgeInstaller(
    installerPath: string,
    targetDir: string,
    javaPath: string,
    onProgress?: ProgressCallback
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise<{ success: boolean; error?: string }>((resolve, reject) => {
      // 构建安装命令
      const installer = spawn(javaPath, [
        '-jar',
        installerPath,
        '--installClient',
        targetDir
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
      installer.on('close', (code) => {
        if (code === 0) {
          console.log('Forge安装器成功完成');
          resolve({ success: true });
        } else {
          console.error(`Forge安装器退出，代码: ${code}`);
          console.error(`安装器输出: ${output}`);
          resolve({ success: false, error: `Forge安装失败，退出代码: ${code}` });
        }
      });
      
      // 处理安装错误
      installer.on('error', (error) => {
        console.error('Forge安装器错误:', error);
        resolve({ success: false, error: `Forge安装失败: ${error.message}` });
      });
    });
  }
  
  /**
   * 合并Forge配置到原版本JSON
   * @param originalJson 原版本JSON
   * @param forgeJson Forge版本JSON
   * @returns 合并后的JSON
   */
  private mergeForgeConfig(originalJson: any, forgeJson: any): any {
    const merged = { ...originalJson };
    
    // 合并库文件列表
    if (forgeJson.libraries) {
      merged.libraries = [...(merged.libraries || []), ...forgeJson.libraries];
    }
    
    // 更新主类
    if (forgeJson.mainClass) {
      merged.mainClass = forgeJson.mainClass;
    }
    
    // 合并启动参数
    if (forgeJson.arguments) {
      merged.arguments = merged.arguments || {};
      
      // 合并JVM参数
      if (forgeJson.arguments.jvm) {
        merged.arguments.jvm = [...(merged.arguments.jvm || []), ...forgeJson.arguments.jvm];
      }
      
      // 合并游戏参数
      if (forgeJson.arguments.game) {
        merged.arguments.game = [...(merged.arguments.game || []), ...forgeJson.arguments.game];
      }
    }
    
    // 处理旧版本的minecraftArguments
    if (forgeJson.minecraftArguments && !merged.arguments) {
      merged.minecraftArguments = forgeJson.minecraftArguments;
    }
    
    // 合并其他Forge特定配置
    if (forgeJson.inheritsFrom) {
      merged.inheritsFrom = forgeJson.inheritsFrom;
    }
    
    if (forgeJson.jar) {
      merged.jar = forgeJson.jar;
    }
    
    // 保留Forge版本信息
    merged.forgeVersion = forgeJson.id;
    
    return merged;
  }
  
  /**
   * 下载Forge相关的库文件
   * @param versionJson 版本JSON
   * @param onProgress 进度回调
   */
  private async downloadForgeLibraries(versionJson: any, onProgress?: ProgressCallback): Promise<void> {
    if (!versionJson.libraries) {
      return;
    }
    
    const libraries = versionJson.libraries;
    const librariesDir = path.join(this.dataDir, 'libraries');
    
    // 创建下载任务
    const downloadTasks = libraries
      .filter((lib: any) => lib.downloads && lib.downloads.artifact)
      .map((lib: any) => {
        const artifact = lib.downloads.artifact;
        return {
          url: SourceConfig.convertUrl(artifact.url, this.source),
          filePath: path.join(librariesDir, artifact.path),
          sha1: artifact.sha1
        };
      });
    
    // 并行下载库文件
    await FileDownloader.downloadFiles(
      downloadTasks,
      this.maxConcurrentDownloads,
      true
    );
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

