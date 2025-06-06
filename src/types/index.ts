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

