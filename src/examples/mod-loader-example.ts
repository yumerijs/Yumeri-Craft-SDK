import { MinecraftDownloader, DownloadSource } from '../index';

/**
 * 示例：使用Forge和Fabric安装器
 */
async function main() {
  // 创建Minecraft下载器实例
  const downloader = new MinecraftDownloader({
    source: DownloadSource.BMCLAPI, // 使用BMCLAPI源加速下载
    dataDir: './minecraft-data',
    maxConcurrentDownloads: 10,
    validateIntegrity: true
  });
  
  // 指定Minecraft版本
  const mcVersion = '1.20.1';
  
  try {
    // 示例1：安装Forge
    console.log(`获取Minecraft ${mcVersion}的Forge版本列表...`);
    const forgeVersions = await downloader.getForgeVersions(mcVersion);
    
    if (forgeVersions.length > 0) {
      // 选择最新的Forge版本
      const latestForge = forgeVersions[0];
      console.log(`选择Forge版本: ${latestForge.version} (构建号: ${latestForge.build})`);
      
      // 安装Forge
      console.log(`开始安装Forge ${latestForge.version}...`);
      const forgeResult = await downloader.installForge(latestForge, 'java', (progress, total, percentage) => {
        console.log(`Forge安装进度: ${percentage}%`);
      });
      
      if (forgeResult.success) {
        console.log(`Forge安装成功! 版本ID: ${forgeResult.versionId}`);
        console.log(`版本JSON路径: ${forgeResult.versionJsonPath}`);
        console.log(`版本JAR路径: ${forgeResult.versionJarPath}`);
      } else {
        console.error(`Forge安装失败: ${forgeResult.error}`);
      }
    } else {
      console.log(`没有找到Minecraft ${mcVersion}的Forge版本`);
    }
    
    // 示例2：安装Fabric
    console.log(`\n获取Minecraft ${mcVersion}的Fabric版本列表...`);
    const fabricVersions = await downloader.getFabricVersions(mcVersion);
    
    if (fabricVersions.length > 0) {
      // 选择稳定的Fabric版本
      const stableFabric = fabricVersions.find(v => v.stable) || fabricVersions[0];
      console.log(`选择Fabric版本: ${stableFabric.loaderVersion}`);
      
      // 安装Fabric
      console.log(`开始安装Fabric ${stableFabric.loaderVersion}...`);
      const fabricResult = await downloader.installFabric(stableFabric, '1.21.5', (progress, total, percentage) => {
        console.log(`Fabric安装进度: ${percentage}%`);
      });
      
      if (fabricResult.success) {
        console.log(`Fabric安装成功! 版本ID: ${fabricResult.versionId}`);
        console.log(`版本JSON路径: ${fabricResult.versionJsonPath}`);
      } else {
        console.error(`Fabric安装失败: ${fabricResult.error}`);
      }
    } else {
      console.log(`没有找到Minecraft ${mcVersion}的Fabric版本`);
    }
    
  } catch (error) {
    console.error('发生错误:', error);
  }
}

// 运行示例
main().catch(console.error);

