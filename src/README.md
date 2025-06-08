# Minecraft启动器SDK

一个功能完整的Minecraft启动器SDK，支持游戏下载、模组加载器安装和游戏启动。

## 主要功能

### ✅ 已实现的改进功能

1. **改进的模组加载器安装**
   - Forge和Fabric安装器现在安装到现有版本文件夹，而不是创建新文件夹
   - 正确合并模组加载器的启动参数到原版本JSON中
   - 支持参数追加和覆盖，不会完全删除原有配置

2. **完整的启动逻辑**
   - 读取版本文件夹下的`版本名称.json`文件
   - 启动`版本名称.jar`文件
   - 支持自定义启动参数，只传入JSON中定义的参数
   - 兼容新旧版本的参数格式（arguments和minecraftArguments）

3. **灵活的目录结构**
   - 支持自定义数据目录
   - 版本文件存储在`数据目录/versions/版本名称/`下
   - JSON和JAR文件名与版本名称保持一致

4. **完善的启动参数处理**
   - 支持JVM参数和游戏参数的智能合并
   - 支持条件参数（基于操作系统、架构等）
   - 支持自定义内存设置、窗口大小等

## 使用示例

### 基本使用

```typescript 
import { MinecraftDownloader, DownloadSource, GameLauncher } from './index';

// 创建下载器
const downloader = new MinecraftDownloader({
  source: DownloadSource.BMCLAPI,
  dataDir: './minecraft-data',
  maxConcurrentDownloads: 5
});

// 下载Minecraft版本
await downloader.downloadClient('1.20.1', 'my-minecraft-1.20.1');

// 安装Forge到现有版本
const forgeVersions = await downloader.getForgeVersions('1.20.1');
await downloader.installForge(forgeVersions[0], 'my-minecraft-1.20.1');

// 启动游戏
const launcher = new GameLauncher('./minecraft-data');
const launchResult = await launcher.launchGame('my-minecraft-1.20.1', {
  username: 'Player',
  accessToken: 'token',
  uuid: 'uuid',
  gameDirectory: './minecraft-data',
  assetsDirectory: './minecraft-data/assets',
  assetIndex: '1.20',
  versionName: 'my-minecraft-1.20.1',
  versionType: 'release'
});
```

### 模组加载器安装

```typescript
// 安装Forge（使用现有版本文件夹）
const forgeVersions = await downloader.getForgeVersions('1.20.1');
const forgeResult = await downloader.installForge(
  forgeVersions[0], 
  'existing-version-name',  // 现有版本文件夹名
  'java'
);

// 安装Fabric（使用现有版本文件夹）
const fabricVersions = await downloader.getFabricVersions('1.20.1');
const fabricResult = await downloader.installFabric(
  fabricVersions[0],
  'existing-version-name'   // 现有版本文件夹名
);
```

## 目录结构

```
数据目录/
├── versions/
│   └── 版本名称/
│       ├── 版本名称.json    # 版本配置文件
│       └── 版本名称.jar     # 游戏JAR文件
├── libraries/              # 库文件
├── assets/                 # 游戏资源
└── downloads/              # 临时下载文件
```

## API文档

### MinecraftDownloader

主要的下载器类，负责游戏和模组加载器的下载安装。

#### 方法

- `downloadClient(versionId, versionName, onProgress?)` - 下载Minecraft客户端
- `installForge(forgeVersion, targetVersionName, javaPath?, onProgress?)` - 安装Forge到指定版本
- `installFabric(fabricVersion, targetVersionName, onProgress?)` - 安装Fabric到指定版本
- `getForgeVersions(mcVersion)` - 获取Forge版本列表
- `getFabricVersions(mcVersion)` - 获取Fabric版本列表

### GameLauncher

游戏启动器类，负责构建启动命令和启动游戏。

#### 方法

- `launchGame(versionName, launchArgs, javaPath?, onProgress?)` - 启动游戏

### LaunchArguments

启动参数接口，包含所有可配置的启动选项。

#### 必需参数

- `username` - 用户名
- `accessToken` - 访问令牌
- `uuid` - 用户UUID
- `gameDirectory` - 游戏目录
- `assetsDirectory` - 资源目录
- `assetIndex` - 资源索引名称
- `versionName` - 版本名称
- `versionType` - 版本类型

#### 可选参数

- `width`, `height` - 窗口大小
- `maxMemory`, `minMemory` - 内存设置
- `customJvmArgs`, `customGameArgs` - 自定义参数
- `serverHost`, `serverPort` - 服务器连接
- 等等...

## 技术特性

1. **智能参数合并** - 模组加载器参数与原版参数正确合并
2. **条件参数支持** - 根据操作系统和架构应用不同参数
3. **完整性验证** - 支持SHA1文件校验
4. **并发下载** - 支持多文件并行下载
5. **进度回调** - 实时下载和安装进度
6. **错误处理** - 完善的错误处理和恢复机制

## 依赖

- `axios` - HTTP请求
- `fs-extra` - 文件系统操作
- `extract-zip` - ZIP文件解压

## 许可证

ISC

