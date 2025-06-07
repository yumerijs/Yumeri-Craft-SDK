import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { 
  DownloadSource, 
  MinecraftVersion, 
  VersionManifest, 
  VersionInfo 
} from '../types';
import { SourceConfig } from '../utils/source-config';

/**
 * Minecraft版本管理器
 */
export class VersionManager {
  private source: DownloadSource;
  private dataDir: string;
  private versionManifest: VersionManifest | null = null;
  private versionCache: Map<string, VersionInfo> = new Map();

  /**
   * 构造函数
   * @param source 下载源
   * @param dataDir 数据目录
   */
  constructor(source: DownloadSource = DownloadSource.MOJANG, dataDir: string = './minecraft-data') {
    this.source = source;
    this.dataDir = dataDir;
  }

  /**
   * 获取版本清单
   * @param forceRefresh 是否强制刷新
   * @returns 版本清单
   */
  public async getVersionManifest(forceRefresh: boolean = false): Promise<VersionManifest> {
    // 如果已有缓存且不强制刷新，直接返回
    if (this.versionManifest && !forceRefresh) {
      return this.versionManifest;
    }

    // 检查本地缓存
    const cacheFile = path.join(this.dataDir, 'version_manifest.json');
    
    if (!forceRefresh && await fs.pathExists(cacheFile)) {
      try {
        const cacheData = await fs.readJson(cacheFile);
        const cacheTime = cacheData.cacheTime || 0;
        
        // 缓存未过期（24小时内）
        if (Date.now() - cacheTime < 24 * 60 * 60 * 1000) {
          this.versionManifest = cacheData.manifest;
          if (this.versionManifest) {
            return this.versionManifest;
          }
        }
      } catch (error) {
        console.warn('读取版本清单缓存失败，将重新获取', error);
      }
    }

    // 获取版本清单
    try {
      const manifestUrl = SourceConfig.getVersionManifestUrl(this.source);
      const response = await axios.get<VersionManifest>(manifestUrl);
      this.versionManifest = response.data;

      // 缓存版本清单
      await fs.ensureDir(this.dataDir);
      await fs.writeJson(cacheFile, {
        cacheTime: Date.now(),
        manifest: this.versionManifest
      });

      return this.versionManifest;
    } catch (error) {
      console.error('获取版本清单失败', error);
      throw new Error('获取版本清单失败');
    }
  }

  /**
   * 获取所有版本
   * @param forceRefresh 是否强制刷新
   * @returns 版本列表
   */
  public async getAllVersions(forceRefresh: boolean = false): Promise<MinecraftVersion[]> {
    const manifest = await this.getVersionManifest(forceRefresh);
    return manifest.versions;
  }

  /**
   * 获取最新版本
   * @param forceRefresh 是否强制刷新
   * @returns 最新版本信息
   */
  public async getLatestVersions(forceRefresh: boolean = false): Promise<{
    release: MinecraftVersion | null;
    snapshot: MinecraftVersion | null;
  }> {
    const manifest = await this.getVersionManifest(forceRefresh);
    
    const latestRelease = manifest.versions.find(v => v.id === manifest.latest.release) || null;
    const latestSnapshot = manifest.versions.find(v => v.id === manifest.latest.snapshot) || null;
    
    return {
      release: latestRelease,
      snapshot: latestSnapshot
    };
  }

  /**
   * 获取版本详情
   * @param versionId 版本ID
   * @param forceRefresh 是否强制刷新
   * @returns 版本详情
   */
  public async getVersionInfo(versionId: string, forceRefresh: boolean = false): Promise<VersionInfo> {
    // 如果已有缓存且不强制刷新，直接返回
    if (!forceRefresh && this.versionCache.has(versionId)) {
      return this.versionCache.get(versionId)!;
    }

    // 检查本地缓存
    const versionDir = path.join(this.dataDir, 'verioninfo/versions', versionId);
    const versionFile = path.join(versionDir, `${versionId}.json`);
    
    if (!forceRefresh && await fs.pathExists(versionFile)) {
      try {
        const versionInfo = await fs.readJson(versionFile);
        this.versionCache.set(versionId, versionInfo);
        return versionInfo;
      } catch (error) {
        console.warn(`读取版本${versionId}缓存失败，将重新获取`, error);
      }
    }

    // 获取版本清单
    const manifest = await this.getVersionManifest();
    const version = manifest.versions.find(v => v.id === versionId);
    
    if (!version) {
      throw new Error(`找不到版本: ${versionId}`);
    }

    // 获取版本详情
    try {
      // 转换URL到指定下载源
      const versionUrl = SourceConfig.convertUrl(version.url, this.source);
      const response = await axios.get<VersionInfo>(versionUrl);
      const versionInfo = response.data;

      // 缓存版本详情
      await fs.ensureDir(versionDir);
      await fs.writeJson(versionFile, versionInfo);
      
      this.versionCache.set(versionId, versionInfo);
      return versionInfo;
    } catch (error) {
      console.error(`获取版本${versionId}详情失败`, error);
      throw new Error(`获取版本${versionId}详情失败`);
    }
  }

  /**
   * 获取版本下载URL
   * @param versionId 版本ID
   * @returns 下载URL
   */
  public async getVersionDownloadUrl(versionId: string): Promise<{
    client: string;
    server?: string;
  }> {
    const versionInfo = await this.getVersionInfo(versionId);
    
    const result: {
      client: string;
      server?: string;
    } = {
      client: SourceConfig.convertUrl(versionInfo.downloads.client.url, this.source)
    };
    
    if (versionInfo.downloads.server) {
      result.server = SourceConfig.convertUrl(versionInfo.downloads.server.url, this.source);
    }
    
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
}

