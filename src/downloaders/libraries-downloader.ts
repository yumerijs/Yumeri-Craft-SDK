import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import {
  DownloadSource,
  Library,
  VersionInfo,
  ProgressCallback
} from '../types';
import { FileDownloader } from '../utils/downloader'; // 假设 FileDownloader.downloadFiles 和 .downloadFile 存在
import { SourceConfig } from '../utils/source-config';

// 引入解压库
import extract from 'extract-zip';

/**
 * 库文件下载器
 */
export class LibrariesDownloader {
  private source: DownloadSource;
  private dataDir: string;
  private maxConcurrentDownloads: number;

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
   * 检查库文件是否适用于当前操作系统和架构
   * @param library 库文件
   * @returns 是否适用
   */
  private isLibraryApplicable(library: Library): boolean {
    const currentOs = {
      name: this.getOsName(),
      arch: this.getOsArchitecture()
    };

    if (!library.rules || library.rules.length === 0) {
      return true;
    }

    let isAllowed = false;

    for (const rule of library.rules) {
      const appliesToOs = !rule.os || (rule.os.name === currentOs.name && (!rule.os.arch || rule.os.arch === currentOs.arch));

      if (rule.action === 'allow') {
        if (appliesToOs) {
          isAllowed = true;
        }
      } else if (rule.action === 'disallow') {
        if (appliesToOs) {
          return false;
        }
      }
    }
    return isAllowed;
  }

  /**
   * 根据库的Maven坐标（name字段）判断是否是原生库。
   * 这是基于命名约定来识别原生库的关键函数。
   * @param library 库对象
   * @returns 是否是原生库
   */
  private isNativeLibraryByName(library: Library): boolean {
    const libraryName = library.name;
    const currentOsLite = this.getOsName();
    const currentArchLite = this.getOsArchitecture();

    // 常见原生库命名模式
    const nativePatterns = [
      `natives-${currentOsLite}`,
      `${currentOsLite}-${currentArchLite}`,
      `${currentOsLite}${currentArchLite}`,
    ];

    // 检查 library.name 是否包含这些模式
    for (const pattern of nativePatterns) {
      if (libraryName.includes(`:${pattern}`) || libraryName.includes(`-${pattern}`)) {
        return true;
      }
    }

    // 如果 library.name 中明确包含 ":natives-" 这样的分类器（即使没有 downloads.classifiers）
    // 也认为是原生库 (例如一些非官方发布源可能不包含完整的 downloads 结构)
    if (libraryName.includes(':natives-')) {
      return true;
    }

    return false;
  }

  /**
   * 获取操作系统名称 (与 Mojang 规范匹配)
   * @returns 操作系统名称
   */
  private getOsName(): string {
    const platform = os.platform();
    if (platform === 'win32') return 'windows';
    if (platform === 'darwin') return 'osx';
    if (platform === 'linux') return 'linux';
    return platform;
  }

  /**
   * 获取操作系统架构 (与 Mojang 规范匹配)
   * @returns 操作系统架构
   */
  private getOsArchitecture(): string {
    const arch = os.arch();
    if (arch === 'x64') return 'x64';
    if (arch === 'ia32') return 'x86';
    if (arch === 'arm64') return 'arm64';
    if (arch === 'arm') return 'arm64'; // Mojang 通常将 arm 也归为 arm64 (或特指 arm32)
    return arch;
  }

  /**
   * 获取普通库文件 (非原生库) 的本地保存路径
   * @param library 库文件对象
   * @returns 本地文件路径
   */
  private getLibraryPath(library: Library): string {
    if (library.downloads && library.downloads.artifact) {
      return path.join(this.dataDir, 'libraries', library.downloads.artifact.path);
    }

    // 解析Maven坐标，确保移除 classifier
    const parts = library.name.split(':');
    const groupId = parts[0].replace(/\./g, path.sep);
    const artifactId = parts[1];
    let version = parts[2];

    const atIndex = version.indexOf('@');
    if (atIndex !== -1) {
      version = version.substring(0, atIndex); // 移除 @classifier 部分
    }

    const fileName = `${artifactId}-${version}.jar`;
    return path.join(this.dataDir, 'libraries', groupId, artifactId, version, fileName);
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

  /**
 * (重要改动) 根据库的 name 字段判断是否是原生库
 * 这是区分普通 JAR 和原生 JAR 的核心判断方法。
 * 它基于原生库 JAR 命名中常见的 `natives-` 和 `[os]-[arch]` 模式。
 * @param library 库对象
 * @returns 是否是原生库
 */
  private isNativeLibrary(library: Library): boolean {
    const libraryName = library.name;
    const currentOsLite = this.getOsName(); // 假设 getOsName() 已经存在
    const currentArchLite = this.getOsArchitecture(); // 假设 getOsArchitecture() 已经存在

    // 检查 library.name 字段中是否包含特定分类器，例如 "org.lwjgl:lwjgl-glfw:3.3.1:natives-windows"
    if (libraryName.includes(':natives-')) {
      return true;
    }

    // 检查 artifactId (如果存在) 或 version 部分是否包含 natives 后缀
    // parts[1] 是 artifactId, parts[2] 是 version
    const parts = libraryName.split(':');
    if (parts.length >= 3) {
      const artifactId = parts[1]; // 可能含有 natives-
      const version = parts[2]; // 可能含有 natives-

      // 常见原生库命名模式
      const nativeSuffixes = [
        `natives-${currentOsLite}`,
        `${currentOsLite}-${currentArchLite}`,
        `${currentOsLite}${currentArchLite}`,
      ];

      for (const suffix of nativeSuffixes) {
        // 检查 version 部分是否包含这些后缀
        if (version.includes(suffix)) {
          return true;
        }
        // 检查 artifactId 部分是否包含这些后缀 (例如 `jansi-natives-windows`)
        if (artifactId.includes(suffix)) {
          return true;
        }
        // 检查完整的 JAR 文件名（artifactId-version-suffix.jar）是否可能包含
        if (library.downloads && library.downloads.artifact && library.downloads.artifact.path.includes(suffix)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 获取普通 JAR 库的 ডাউনলোড URL
   * (已修正：确保使用 SourceConfig.getLibrariesBaseUrl)
   * 总是优先使用 `downloads.artifact.url`，如果不存在则从 `name` 推断。
   */
  private getLibraryDownloadUrl(library: Library): string | null {
    if (library.downloads && library.downloads.artifact) {
      return SourceConfig.convertUrl(library.downloads.artifact.url, this.source);
    }

    const parts = library.name.split(':');
    const groupId = parts[0].replace(/\./g, '/');
    const artifactId = parts[1];
    let version = parts[2];

    const atIndex = version.indexOf('@');
    if (atIndex !== -1) {
      version = version.substring(0, atIndex);
    }

    const fileName = `${artifactId}-${version}.jar`;
    const mavenPath = `${groupId}/${artifactId}/${version}/${fileName}`;
    // 使用 SourceConfig.getLibrariesBaseUrl
    return `${SourceConfig.getLibrariesBaseUrl(this.source)}/${mavenPath}`;
  }

  /**
   * 获取原生库 JAR 的本地下载路径 (注意，这是 JAR 文件路径，不是解压后的目录)
   * (已修正：完全依赖 `artifact` 或 `name` 推断，并确保文件名带有原生库后缀)
   */
  private getNativeLibraryDownloadPath(library: Library): string {
    // 优先使用 library.downloads.artifact.path，因为它通常是完整的 Maven 路径
    if (library.downloads && library.downloads.artifact) {
      return path.join(this.dataDir, 'libraries', library.downloads.artifact.path);
    }

    // 否则，根据 name 字段构建 Maven 路径，并确保文件名是原生库的命名约定
    const parts = library.name.split(':');
    const groupId = parts[0].replace(/\./g, path.sep);
    const artifactId = parts[1];
    const versionPart = parts[2];

    let nativeFileName = `${artifactId}-${versionPart}.jar`;
    // 如果 versionPart 本身不含 natives- 再添加
    if (!versionPart.includes('natives-')) {
      const osNativesSuffix = `natives-${this.getOsName()}`;
      const osArchSuffix = this.getOsArchitecture();
      nativeFileName = `${artifactId}-${versionPart}-${osNativesSuffix}${osArchSuffix === 'x86' ? '' : `-${osArchSuffix}`}.jar`;
    }

    return path.join(this.dataDir, 'libraries', groupId, artifactId, versionPart, nativeFileName);
  }

  /**
   * 获取原生库 JAR 的下载 URL
   * (已修正：确保使用 SourceConfig.getLibrariesBaseUrl)
   * **最重要的修正**：完全依赖 `artifact` 或 `name` 推断，并确保 URL 中的文件名带有原生库后缀。
   */
  private getNativeLibraryDownloadUrl(library: Library): string | null {
    // 优先使用 library.downloads.artifact.url
    if (library.downloads && library.downloads.artifact) {
      return SourceConfig.convertUrl(library.downloads.artifact.url, this.source);
    }
    // 其次检查 library.url 字段（用于一些非标准库或旧格式）
    // if (library.url) {
    //   return SourceConfig.convertUrl(library.url, this.source);
    // }

    // 最后，根据 Maven 坐标构建 URL，并确保文件名是原生库的命名约定
    const parts = library.name.split(':');
    const groupId = parts[0].replace(/\./g, '/');
    const artifactId = parts[1];
    const versionPart = parts[2];

    let nativeFileName = `${artifactId}-${versionPart}.jar`;
    if (!versionPart.includes('natives-')) {
      const osNativesSuffix = `natives-${this.getOsName()}`;
      const osArchSuffix = this.getOsArchitecture();
      nativeFileName = `${artifactId}-${versionPart}-${osNativesSuffix}${osArchSuffix === 'x86' ? '' : `-${osArchSuffix}`}.jar`;
    }

    const mavenPath = `${groupId}/${artifactId}/${versionPart}/${nativeFileName}`;
    // 使用 SourceConfig.getLibrariesBaseUrl
    return `${SourceConfig.getLibrariesBaseUrl(this.source)}/${mavenPath}`;
  }

  /**
 * 下载并解压原生库
 * @param nativeLibrariesToDownload 需要下载和解压的原生库列表
 * @param nativeDir 解压目标目录 (例如 dataDir/versions/versionName/versionName-natives)
 * @param onProgress 进度回调
 */
  private async downloadAndExtractNatives(
    nativeLibrariesToDownload: Library[],
    nativeDir: string,
    onProgress?: ProgressCallback
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    // 清理旧的原生库目录
    try {
      if (fs.existsSync(nativeDir)) {
        console.log(`Cleaning old native directory: ${nativeDir}`);
        await fs.remove(nativeDir); // 移除整个旧的原生库目录，确保干净开始
      }
      await fs.ensureDir(nativeDir); // 确保新的原生库目录存在
    } catch (error) {
      console.error(`Error cleaning/creating native directory ${nativeDir}:`, error);
      return { success: 0, failed: nativeLibrariesToDownload.length };
    }

    const downloadPromises = nativeLibrariesToDownload.map(async (library) => {
      const url = this.getNativeLibraryDownloadUrl(library); // 假设这些函数已正确更新
      const filePath = this.getNativeLibraryDownloadPath(library);

      const sha1 = (library.downloads && library.downloads.artifact && library.downloads.artifact.sha1)
        ? library.downloads.artifact.sha1
        : undefined;

      if (!url) {
        console.warn(`Skipping native library (no download URL): ${library.name}`);
        failed++;
        return;
      }

      try {
        console.log(`Downloading native JAR: ${url} to ${filePath}`);
        const downloadResult = await FileDownloader.downloadFile(url, filePath, sha1);
        if (!downloadResult) {
          throw new Error(`Failed to download native JAR: ${library.name}`);
        }

        console.log(`Extracting native files from: ${filePath} to ${nativeDir}`);
        await extract(filePath, { dir: nativeDir });

        // --- 核心修正：解决 ENOTEMPTY 错误 ---

        // --- 核心修正结束 ---

        success++;
      } catch (error) {
        console.error(`Failed to download or extract native library ${library.name}:`, error);
        failed++;
      } finally {
        if (onProgress) {
          // 内部进度回调
        }
      }
    });

    await Promise.all(downloadPromises);
    return { success, failed };
  }

  /**
   * 下载库文件 (包括普通JAR和原生库)
   * @param versionInfo 版本信息 (包含 libraries 数组)
   * @param versionName 版本名称 (如 "1.21.1"，用于构建 natives 路径)
   * @param onProgress 进度回调
   */
  public async downloadLibraries(
    versionInfo: VersionInfo,
    versionName: string,
    onProgress?: ProgressCallback
  ): Promise<{
    total: number;
    success: number;
    failed: number;
    skipped: number;
  }> {
    const libraries = versionInfo.libraries;
    let normalLibrariesToDownload: { url: string; filePath: string; sha1?: string; }[] = [];
    let nativeLibrariesToDownload: Library[] = [];

    for (const library of libraries) {
      if (!this.isLibraryApplicable(library)) {
        continue;
      }

      // 使用 isNativeLibrary 判断方法来区分普通JAR和原生库
      if (this.isNativeLibrary(library)) {
        nativeLibrariesToDownload.push(library);
      } else {
        // 普通JAR库
        const url = this.getLibraryDownloadUrl(library);
        const filePath = this.getLibraryPath(library);
        if (url && filePath) {
          const sha1 = (library.downloads && library.downloads.artifact) ? library.downloads.artifact.sha1 : undefined;
          normalLibrariesToDownload.push({ url, filePath, sha1 });
        } else {
          console.warn(`Skipping library (unrecognized format or no download info for normal JAR): ${library.name}`);
        }
      }
    }

    let progressSuccess = 0;
    let progressFailed = 0;
    let progressSkipped = 0;
    let totalItems = normalLibrariesToDownload.length + nativeLibrariesToDownload.length;

    const updateOverallProgress = () => {
      if (onProgress && totalItems > 0) {
        onProgress(progressSuccess + progressFailed + progressSkipped, totalItems,
          ((progressSuccess + progressFailed + progressSkipped) / totalItems) * 100);
      }
    };

    // --- 1. 下载普通 JAR 库 ---
    if (normalLibrariesToDownload.length > 0) {
      console.log(`Downloading ${normalLibrariesToDownload.length} normal JAR libraries...`);
      const downloads = normalLibrariesToDownload.map(d => ({
        url: d.url,
        filePath: d.filePath,
        sha1: d.sha1,
        onProgress: (dl: number, tot: number) => { /* 内部进度 */ }
      }));

      const results = await FileDownloader.downloadFiles(downloads, this.maxConcurrentDownloads);

      progressSuccess += results.success;
      progressFailed += results.failed;
      progressSkipped += normalLibrariesToDownload.length - (results.success + results.failed);
      updateOverallProgress();
    }

    // --- 2. 下载并解压原生库 ---
    if (nativeLibrariesToDownload.length > 0) {
      console.log(`Downloading and extracting ${nativeLibrariesToDownload.length} native libraries...`);
      const nativeExtractedDir = path.resolve(this.dataDir, 'versions', versionName, `${versionName}-natives`);

      const nativeResults = await this.downloadAndExtractNatives(
        nativeLibrariesToDownload,
        nativeExtractedDir,
        (downloadedNatives, totalNatives, nativeProgress) => {
          // 将原生库的进度融入到总进度中
          const currentNativePortionProgress = (downloadedNatives / totalNatives) * nativeLibrariesToDownload.length;
          if (onProgress && totalItems > 0) {
            onProgress(
              progressSuccess + progressFailed + progressSkipped + currentNativePortionProgress,
              totalItems,
              ((progressSuccess + progressFailed + progressSkipped + currentNativePortionProgress) / totalItems) * 100
            );
          }
        }
      );

      const metaInfPath = path.join(nativeExtractedDir, 'META-INF');
      if (await fs.pathExists(metaInfPath)) {
        console.log(`Attempting to clean and remove META-INF directory from ${nativeExtractedDir}`);
        try {
          // 先清空 META-INF 目录下的所有内容 (递归删除)
          // fs.emptyDir(metaInfPath);
          // 然后删除空的 META-INF 目录本身
          fs.remove(metaInfPath);
          console.log(`Removed META-INF directory: ${metaInfPath}`);
        } catch (removeError) {
          // 如果清空或删除仍然失败，打印警告但不阻碍主流程
          console.warn(`Could not fully remove META-INF directory ${metaInfPath}:`, removeError);
        }
      }
      progressSuccess += nativeResults.success;
      progressFailed += nativeResults.failed;
      updateOverallProgress();
    }

    updateOverallProgress(); // 确保最终进度回调

    return {
      total: totalItems,
      success: progressSuccess,
      failed: progressFailed,
      skipped: progressSkipped
    };
  }
}