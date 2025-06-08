import { MinecraftDownloader, DownloadSource } from './index';

/**
 * 简单的下载测试，使用官方源
 */
async function testDownloadWithOfficialSource() {
  console.log('开始测试下载功能（使用官方源）...\n');

  // 使用官方源避免BMCLAPI的304问题
  const downloader = new MinecraftDownloader({
    source: DownloadSource.MOJANG, // 使用官方源
    dataDir: './test-download-data',
    maxConcurrentDownloads: 3,
    validateIntegrity: true
  });

  try {
    // 测试下载一个较小的版本
    console.log('=== 测试：下载Minecraft客户端（官方源） ===');
    const versionId = '1.20.1';
    const versionName = 'test-minecraft-1.20.1';
    
    console.log(`正在下载Minecraft ${versionId}（使用官方源）...`);
    const downloadResult = await downloader.downloadClient(versionId, versionName, (progress, total, percentage) => {
      // 每1%输出一次，展示细腻的进度
      if (percentage % 1 === 0) {
        console.log(`下载进度: ${Math.round(percentage)}% (${Math.round(progress/1024/1024*100)/100}MB/${Math.round(total/1024/1024*100)/100}MB)`);
      }
    });

    if (downloadResult.success) {
      console.log(`✓ Minecraft ${versionId} 下载成功！`);
      console.log(`客户端JAR路径: ${downloadResult.filePath}`);
      
      // 检查文件是否真的存在
      const fs = require('fs-extra');
      const exists = await fs.pathExists(downloadResult.filePath || '');
      console.log(`文件确实存在: ${exists}`);
      
      if (exists) {
        const stats = await fs.stat(downloadResult.filePath);
        console.log(`文件大小: ${Math.round(stats.size/1024/1024*100)/100}MB`);
      }
    } else {
      console.error(`✗ Minecraft ${versionId} 下载失败: ${downloadResult.error}`);
    }

  } catch (error) {
    console.error('下载测试失败:', error);
  }
}

/**
 * 测试BMCLAPI源
 */
async function testDownloadWithBMCLAPI() {
  console.log('\n开始测试BMCLAPI源...\n');

  const downloader = new MinecraftDownloader({
    source: DownloadSource.BMCLAPI,
    dataDir: './test-bmclapi-data',
    maxConcurrentDownloads: 3,
    validateIntegrity: true
  });

  try {
    console.log('=== 测试：获取版本清单（BMCLAPI源） ===');
    const versionManager = downloader.getVersionManager();
    const versions = await versionManager.getAllVersions();
    console.log(`✓ 成功获取 ${versions.length} 个版本`);
    
    // 只测试获取版本信息，不下载
    const versionInfo = await versionManager.getVersionInfo('1.20.1');
    console.log(`✓ 成功获取版本信息: ${versionInfo.id}`);
    
  } catch (error) {
    console.error('BMCLAPI测试失败:', error);
  }
}

// 运行测试
async function runDownloadTests() {
  // 先测试官方源
  await testDownloadWithOfficialSource();
  
  // 再测试BMCLAPI源
  await testDownloadWithBMCLAPI();
  
  console.log('\n下载测试完成！');
}

runDownloadTests().catch(console.error);

