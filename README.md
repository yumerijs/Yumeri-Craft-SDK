# Yumeri-Craft-SDK

## 特性

- 支持多种下载源（Mojang官方源和BMCLAPI国内加速源）
- 支持下载Minecraft客户端和服务端
- 支持下载游戏资源文件和库文件
- 支持进度回调和并发下载
- 支持文件完整性验证
- 完全使用TypeScript编写，提供类型定义

## 安装

```bash
npm install minecraft-downloader-ts
```

或者

```bash
yarn add minecraft-downloader-ts
```

## 基本用法

### 下载最新版本的Minecraft客户端

```typescript
import { MinecraftDownloader, DownloadSource } from 'minecraft-downloader-ts';

// 创建下载器实例
const downloader = new MinecraftDownloader({
  source: DownloadSource.MOJANG, // 或 DownloadSource.BMCLAPI 使用国内加速源
  dataDir: './minecraft-data',
  maxConcurrentDownloads: 5,
  validateIntegrity: true
});

async function downloadLatestMinecraft() {
  try {
    // 获取版本管理器
    const versionManager = downloader.getVersionManager();
    
    // 获取最新版本
    const latestVersions = await versionManager.getLatestVersions();
    const latestVersion = latestVersions.release?.id;
    
    if (!latestVersion) {
      console.error('无法获取最新版本信息');
      return;
    }
    
    console.log(`最新版本: ${latestVersion}`);
    
    // 下载客户端
    const result = await downloader.downloadClient(latestVersion, (progress, total, percentage) => {
      console.log(`下载进度: ${percentage.toFixed(2)}%`);
    });
    
    if (result.success) {
      console.log(`下载完成! 文件保存在: ${result.filePath}`);
    } else {
      console.error(`下载失败: ${result.error}`);
    }
  } catch (error) {
    console.error('下载过程中出错:', error);
  }
}

downloadLatestMinecraft();
```

### 下载指定版本的Minecraft服务端

```typescript
import { MinecraftDownloader, DownloadSource } from 'minecraft-downloader-ts';

const downloader = new MinecraftDownloader({
  source: DownloadSource.BMCLAPI // 使用BMCLAPI源（国内加速）
});

async function downloadMinecraftServer(versionId: string) {
  try {
    const result = await downloader.downloadServer(versionId, (progress, total, percentage) => {
      console.log(`下载进度: ${percentage.toFixed(2)}%`);
    });
    
    if (result.success) {
      console.log(`服务端下载完成! 文件保存在: ${result.filePath}`);
    } else {
      console.error(`服务端下载失败: ${result.error}`);
    }
  } catch (error) {
    console.error('下载过程中出错:', error);
  }
}

downloadMinecraftServer('1.20.1');
```

### 列出所有可用版本

```typescript
import { MinecraftDownloader } from 'minecraft-downloader-ts';

const downloader = new MinecraftDownloader();

async function listAllVersions() {
  try {
    const versionManager = downloader.getVersionManager();
    const versions = await versionManager.getAllVersions();
    
    console.log('可用的Minecraft版本:');
    versions.forEach(version => {
      console.log(`- ${version.id} (${version.type}, ${new Date(version.releaseTime).toLocaleDateString()})`);
    });
  } catch (error) {
    console.error('获取版本列表失败:', error);
  }
}

listAllVersions();
```

## API文档

### MinecraftDownloader

主下载器类，整合所有下载功能。

#### 构造函数

```typescript
constructor(options?: DownloadOptions)
```

参数:
- `options`: 下载选项
  - `source`: 下载源，默认为 `DownloadSource.MOJANG`
  - `dataDir`: 数据目录，默认为 `'./minecraft-data'`
  - `maxConcurrentDownloads`: 最大并发下载数，默认为 `5`
  - `validateIntegrity`: 是否验证文件完整性，默认为 `true`
  - `onProgress`: 全局进度回调函数

#### 方法

- `downloadClient(versionId: string, onProgress?: ProgressCallback): Promise<DownloadResult>` - 下载Minecraft客户端
- `downloadServer(versionId: string, onProgress?: ProgressCallback): Promise<DownloadResult>` - 下载Minecraft服务端
- `getVersionManager(): VersionManager` - 获取版本管理器
- `getAssetsDownloader(): AssetsDownloader` - 获取资源下载器
- `getLibrariesDownloader(): LibrariesDownloader` - 获取库文件下载器
- `setSource(source: DownloadSource): void` - 设置下载源
- `getSource(): DownloadSource` - 获取当前下载源
- `setDataDir(dataDir: string): void` - 设置数据目录
- `getDataDir(): string` - 获取数据目录
- `setMaxConcurrentDownloads(maxConcurrentDownloads: number): void` - 设置最大并发下载数
- `getMaxConcurrentDownloads(): number` - 获取最大并发下载数
- `setValidateIntegrity(validateIntegrity: boolean): void` - 设置是否验证文件完整性
- `getValidateIntegrity(): boolean` - 获取是否验证文件完整性

### VersionManager

版本管理器类，负责获取和管理版本信息。

#### 方法

- `getVersionManifest(forceRefresh?: boolean): Promise<VersionManifest>` - 获取版本清单
- `getAllVersions(forceRefresh?: boolean): Promise<MinecraftVersion[]>` - 获取所有版本
- `getLatestVersions(forceRefresh?: boolean): Promise<{ release: MinecraftVersion | null; snapshot: MinecraftVersion | null; }>` - 获取最新版本
- `getVersionInfo(versionId: string, forceRefresh?: boolean): Promise<VersionInfo>` - 获取版本详情
- `getVersionDownloadUrl(versionId: string): Promise<{ client: string; server?: string; }>` - 获取版本下载URL

### AssetsDownloader

资源下载器类，负责下载游戏资源文件。

#### 方法

- `downloadAssetIndex(versionInfo: VersionInfo, onProgress?: ProgressCallback): Promise<AssetIndex>` - 下载资源索引
- `downloadAssets(assetIndex: AssetIndex, onProgress?: ProgressCallback): Promise<{ total: number; success: number; failed: number; }>` - 下载资源文件
- `downloadAllAssets(versionInfo: VersionInfo, onProgress?: ProgressCallback): Promise<{ total: number; success: number; failed: number; }>` - 下载所有资源

### LibrariesDownloader

库文件下载器类，负责下载游戏所需的库文件。

#### 方法

- `downloadLibraries(versionInfo: VersionInfo, onProgress?: ProgressCallback): Promise<{ total: number; success: number; failed: number; skipped: number; }>` - 下载库文件

### 类型定义

- `DownloadSource` - 下载源枚举
  - `MOJANG` - Mojang官方源
  - `BMCLAPI` - BMCLAPI源（国内加速）
- `DownloadOptions` - 下载选项接口
- `DownloadResult` - 下载结果接口
- `ProgressCallback` - 进度回调函数类型
- `MinecraftVersion` - Minecraft版本信息接口
- `VersionManifest` - 版本清单接口
- `VersionInfo` - 版本详细信息接口
- `AssetIndex` - 资源索引接口
- `Library` - 库文件信息接口

## 许可证

本包使用 MIT 许可证发布，在保留版权和作者信息的前提下，您可以自由地使用、修改和分发本包。

## 开发者

- [FireGuo](https://github.com/FireGuo1145)
- [(团队)WindyPear-Team](https://github.com/WindyPear-Team)
- [(团队)Yumerijs Team](https://github.com/yumerijs)