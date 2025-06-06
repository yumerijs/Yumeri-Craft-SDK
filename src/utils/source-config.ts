import { DownloadSource } from '../types';

/**
 * 下载源配置
 */
export class SourceConfig {
  /**
   * 获取版本清单URL
   * @param source 下载源
   * @returns 版本清单URL
   */
  public static getVersionManifestUrl(source: DownloadSource): string {
    switch (source) {
      case DownloadSource.MOJANG:
        return 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json';
      case DownloadSource.BMCLAPI:
        return 'https://bmclapi2.bangbang93.com/mc/game/version_manifest_v2.json';
      default:
        return 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json';
    }
  }

  /**
   * 获取资源基础URL
   * @param source 下载源
   * @returns 资源基础URL
   */
  public static getAssetsBaseUrl(source: DownloadSource): string {
    switch (source) {
      case DownloadSource.MOJANG:
        return 'https://resources.download.minecraft.net';
      case DownloadSource.BMCLAPI:
        return 'https://bmclapi2.bangbang93.com/assets';
      default:
        return 'https://resources.download.minecraft.net';
    }
  }

  /**
   * 获取库文件基础URL
   * @param source 下载源
   * @returns 库文件基础URL
   */
  public static getLibrariesBaseUrl(source: DownloadSource): string {
    switch (source) {
      case DownloadSource.MOJANG:
        return 'https://libraries.minecraft.net';
      case DownloadSource.BMCLAPI:
        return 'https://bmclapi2.bangbang93.com/maven';
      default:
        return 'https://libraries.minecraft.net';
    }
  }

  /**
   * 转换URL到指定下载源
   * @param originalUrl 原始URL
   * @param source 下载源
   * @returns 转换后的URL
   */
  public static convertUrl(originalUrl: string, source: DownloadSource): string {
    if (source === DownloadSource.MOJANG) {
      return originalUrl;
    }

    // 转换为BMCLAPI
    if (source === DownloadSource.BMCLAPI) {
      // 转换资源URL
      if (originalUrl.includes('resources.download.minecraft.net')) {
        return originalUrl.replace(
          'resources.download.minecraft.net',
          'bmclapi2.bangbang93.com/assets'
        );
      }

      // 转换库文件URL
      if (originalUrl.includes('libraries.minecraft.net')) {
        return originalUrl.replace(
          'libraries.minecraft.net',
          'bmclapi2.bangbang93.com/maven'
        );
      }

      // 转换版本元数据URL
      if (originalUrl.includes('launchermeta.mojang.com')) {
        return originalUrl.replace(
          'launchermeta.mojang.com',
          'bmclapi2.bangbang93.com'
        );
      }

      // 转换启动器元数据URL
      if (originalUrl.includes('launcher.mojang.com')) {
        return originalUrl.replace(
          'launcher.mojang.com',
          'bmclapi2.bangbang93.com'
        );
      }
    }

    return originalUrl;
  }
}

