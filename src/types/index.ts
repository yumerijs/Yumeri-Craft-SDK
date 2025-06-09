/**
 * 下载源类型
 */
export enum DownloadSource {
  /**
   * Mojang官方源
   */
  MOJANG = 'mojang',
  
  /**
   * BMCLAPI源（国内加速）
   */
  BMCLAPI = 'bmclapi'
}

/**
 * Minecraft版本信息
 */
export interface MinecraftVersion {
  /**
   * 版本ID，如"1.20.1"
   */
  id: string;
  
  /**
   * 版本类型，如"release"或"snapshot"
   */
  type: string;
  
  /**
   * 版本详情URL
   */
  url: string;
  
  /**
   * 版本发布时间
   */
  time: string;
  
  /**
   * 版本正式发布时间
   */
  releaseTime: string;
  
  /**
   * SHA1校验和
   */
  sha1?: string;
  
  /**
   * 合规级别
   */
  complianceLevel?: number;
}

/**
 * 版本清单
 */
export interface VersionManifest {
  /**
   * 最新版本信息
   */
  latest: {
    /**
     * 最新正式版
     */
    release: string;
    
    /**
     * 最新快照版
     */
    snapshot: string;
  };
  
  /**
   * 所有版本列表
   */
  versions: MinecraftVersion[];
}

/**
 * 下载文件信息
 */
export interface DownloadFile {
  /**
   * 文件SHA1校验和
   */
  sha1: string;
  
  /**
   * 文件大小（字节）
   */
  size: number;
  
  /**
   * 下载URL
   */
  url: string;
}

/**
 * 版本详细信息
 */
export interface VersionInfo {
  /**
   * 版本ID
   */
  id: string;
  
  /**
   * 版本类型
   */
  type: string;
  
  /**
   * 下载信息
   */
  downloads: {
    /**
     * 客户端JAR
     */
    client: DownloadFile;
    
    /**
     * 服务端JAR
     */
    server?: DownloadFile;
    
    /**
     * Windows服务端
     */
    windows_server?: DownloadFile;
  };
  
  /**
   * 资源索引信息
   */
  assetIndex: {
    /**
     * 资源索引ID
     */
    id: string;
    
    /**
     * 资源索引SHA1
     */
    sha1: string;
    
    /**
     * 资源索引大小
     */
    size: number;
    
    /**
     * 资源索引URL
     */
    url: string;
    
    /**
     * 资源索引总大小
     */
    totalSize: number;
  };
  
  /**
   * 资源信息
   */
  assets: string;
  
  /**
   * 库文件列表
   */
  libraries: Library[];
  
  /**
   * 主类
   */
  mainClass: string;
  
  /**
   * 启动参数 (新版本格式)
   */
  arguments?: {
    jvm: (string | { rules: any[]; value: string | string[]; })[];
    game: (string | { rules: any[]; value: string | string[]; })[];
  };
  /**
   * 启动参数 (旧版本格式)
   */
  minecraftArguments?: string;
}

/**
 * 库文件信息
 */
export interface Library {
  /**
   * 库名称
   */
  name: string;
  
  /**
   * 下载信息
   */
  downloads?: {
    /**
     * 工件信息
     */
    artifact?: {
      /**
       * 文件路径
       */
      path: string;
      
      /**
       * 文件SHA1
       */
      sha1: string;
      
      /**
       * 文件大小
       */
      size: number;
      
      /**
       * 下载URL
       */
      url: string;
    };
    
    /**
     * 分类信息
     */
    classifiers?: Record<string, {
      path: string;
      sha1: string;
      size: number;
      url: string;
    }>;
  };
  
  /**
   * 规则
   */
  rules?: {
    /**
     * 动作
     */
    action: 'allow' | 'disallow';
    
    /**
     * 操作系统
     */
    os?: {
      /**
       * 操作系统名称
       */
      name?: string;
      
      /**
       * 操作系统版本
       */
      version?: string;
      
      /**
       * 操作系统架构
       */
      arch?: string;
    };
    /**
     * 特性
     */
    features?: {
      is_demo_user?: boolean;
      has_custom_resolution?: boolean;
      has_quick_plays_support?: boolean;
      is_quick_play_singleplayer?: boolean;
      is_quick_play_multiplayer?: boolean;
      is_quick_play_realms?: boolean;
    };
  }[];
  
  /**
   * 是否为原生库
   */
  natives?: Record<string, string>;
  
  /**
   * 提取规则
   */
  extract?: {
    /**
     * 排除文件
     */
    exclude: string[];
  };
}

/**
 * 资源索引
 */
export interface AssetIndex {
  /**
   * 对象列表
   */
  objects: Record<string, {
    /**
     * 文件哈希
     */
    hash: string;
    
    /**
     * 文件大小
     */
    size: number;
  }>;
}

/**
 * 下载进度回调
 */
export type ProgressCallback = (progress: number, total: number, percentage: number) => void;

/**
 * 下载选项
 */
export interface DownloadOptions {
  /**
   * 下载源
   */
  source?: DownloadSource;
  
  /**
   * 数据目录
   */
  dataDir?: string;
  
  /**
   * 进度回调
   */
  onProgress?: ProgressCallback;
  
  /**
   * 最大并发下载数
   */
  maxConcurrentDownloads?: number;
  
  /**
   * 是否验证文件完整性
   */
  validateIntegrity?: boolean;
}

/**
 * 下载结果
 */
export interface DownloadResult {
  /**
   * 是否成功
   */
  success: boolean;
  
  /**
   * 错误信息
   */
  error?: string;
  
  /**
   * 下载的文件路径
   */
  filePath?: string;
}

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
 * 启动参数配置（支持动态参数）
 */
export interface LaunchArguments {
  /**
   * 用户名
   */
  username?: string;
  
  /**
   * 访问令牌
   */
  accessToken?: string;
  
  /**
   * 用户UUID
   */
  uuid?: string;
  
  /**
   * 用户类型（默认为mojang）
   */
  userType?: string;
  
  /**
   * 游戏目录
   */
  gameDirectory?: string;
  
  /**
   * 资源目录
   */
  assetsDirectory?: string;
  
  /**
   * 资源索引名称
   */
  assetIndex?: string;
  
  /**
   * 版本名称
   */
  versionName?: string;
  
  /**
   * 版本类型
   */
  versionType?: string;
  
  /**
   * 窗口宽度
   */
  width?: number;
  
  /**
   * 窗口高度
   */
  height?: number;
  
  /**
   * 是否全屏
   */
  fullscreen?: boolean;
  
  /**
   * 服务器地址
   */
  serverHost?: string;
  
  /**
   * 服务器端口
   */
  serverPort?: number;
  
  /**
   * 代理主机
   */
  proxyHost?: string;
  
  /**
   * 代理端口
   */
  proxyPort?: number;
  
  /**
   * 代理用户
   */
  proxyUser?: string;
  
  /**
   * 代理密码
   */
  proxyPass?: string;
  
  /**
   * 自定义JVM参数
   */
  customJvmArgs?: string[];
  
  /**
   * 自定义游戏参数
   */
  customGameArgs?: string[];
  
  /**
   * 最大内存（MB）
   */
  maxMemory?: number;
  
  /**
   * 最小内存（MB）
   */
  minMemory?: number;

  /**
   * 是否为演示用户
   */
  isDemoUser?: boolean;

  /**
   * 快速游戏路径
   */
  quickPlayPath?: string;

  /**
   * 快速游戏单人模式
   */
  quickPlaySingleplayer?: string;

  /**
   * 快速游戏多人模式
   */
  quickPlayMultiplayer?: string;

  /**
   * 快速游戏Realms
   */
  quickPlayRealms?: string;
  
  /**
   * 动态参数支持：允许任意字符串键值对
   * 这样可以支持未来新增的占位符，无需修改类型定义
   */
  [key: string]: string | number | boolean | string[] | undefined;
}

/**
 * 启动结果
 */
export interface LaunchResult {
  /**
   * 是否成功
   */
  success: boolean;
  
  /**
   * 错误信息
   */
  error?: string;
  
  /**
   * 进程ID
   */
  pid?: number;
  
  /**
   * 启动命令
   */
  command?: string;
  
  /**
   * 子进程对象
   */
  process?: any;
}





/**
 * 启动选项
 */
export interface LaunchOptions {
  /**
   * 版本ID
   */
  version: string;
  
  /**
   * 游戏目录
   */
  gameDirectory: string;
  
  /**
   * Java可执行文件路径
   */
  javaPath: string;
  
  /**
   * 访问令牌
   */
  accessToken: string;
  
  /**
   * 用户UUID
   */
  uuid: string;
  
  /**
   * 用户名
   */
  username: string;
  
  /**
   * 窗口宽度
   */
  width: number;
  
  /**
   * 窗口高度
   */
  height: number;
  
  /**
   * JVM参数
   */
  vmOptions: string[];
  
  /**
   * 游戏参数
   */
  gameOptions: string[];
  
  /**
   * 最小内存
   */
  minMemory: number;
  
  /**
   * 最大内存
   */
  maxMemory: number;
}

