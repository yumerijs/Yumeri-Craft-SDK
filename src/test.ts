import { MinecraftDownloader, DownloadSource } from './index';

// 创建下载器实例
const downloader = new MinecraftDownloader({
  source: DownloadSource.BMCLAPI, // 使用BMCLAPI源（国内加速）
  dataDir: './test-data',
  maxConcurrentDownloads: 3
});

// 测试获取版本列表
async function testGetVersions() {
  try {
    console.log('正在获取Minecraft版本列表...');

    const versionManager = downloader.getVersionManager();
    const versions = await versionManager.getAllVersions();

    console.log(`获取到 ${versions.length} 个版本`);
    console.log('最新的5个版本:');

    // 按发布时间排序
    const sortedVersions = [...versions].sort((a, b) =>
      new Date(b.releaseTime).getTime() - new Date(a.releaseTime).getTime()
    );

    // 显示最新的5个版本
    for (let i = 0; i < Math.min(5, sortedVersions.length); i++) {
      const version = sortedVersions[i];
      console.log(`- ${version.id} (${version.type}, ${new Date(version.releaseTime).toLocaleDateString()})`);
    }

    // 获取最新版本
    const latestVersions = await versionManager.getLatestVersions();
    console.log(`\n最新正式版: ${latestVersions.release?.id || '未知'}`);
    console.log(`最新快照版: ${latestVersions.snapshot?.id || '未知'}`);

    return true;
  } catch (error) {
    console.error('测试获取版本列表失败:', error);
    return false;
  }
}

async function testDownloadClient() {
  try {
    console.log('正在下载Minecraft客户端...');
    const versionId = '1.20.2'; // 示例版本
    const versionName = 'Minecraft 1.20.2';
    const result = await downloader.downloadClient(versionId, versionName, (progress, total, percentage) => {
      console.log(`下载进度: ${Math.round(percentage)}% (${progress}/${total})`);
    });
    if (result.success) {
      console.log(`客户端下载成功: ${result.filePath}`);
    } else {
      console.error('客户端下载失败:', result.error);
    }
  } catch (error) {
    console.error('测试下载客户端失败:', error);
  }
}

// 运行测试
async function runTests() {
  console.log('开始测试 Minecraft Downloader TS...\n');

  // 测试获取版本列表
  const versionsResult = await testGetVersions();
  console.log(`\n版本列表测试: ${versionsResult ? '通过' : '失败'}`);
  // 测试下载客户端
  const downloadResult = await testDownloadClient();

  console.log('\n测试完成!');
}

runTests().catch(console.error);

