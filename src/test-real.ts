import { MinecraftDownloader, GameLauncher, DownloadSource } from './index';

async function testRealDownloadAndLaunch() {
  console.log('🚀 开始实际测试下载和启动功能...');
  
  try {
    // 创建下载器，使用Mojang官方源
    const downloader = new MinecraftDownloader({
      dataDir: './test-minecraft-data',
      source: DownloadSource.MOJANG,
      maxConcurrentDownloads: 8
    });
    
    console.log('📦 开始下载Minecraft 1.20.1...');
    
    // 下载Minecraft 1.20.1
    const downloadResult = await downloader.downloadClient(
      '1.20.1',
      'test-1.20.1',
      (progress, total, percentage) => {
        if (percentage % 5 === 0) { // 每5%输出一次
          console.log(`下载进度: ${percentage}% (${(progress / 1024 / 1024).toFixed(1)}MB/${(total / 1024 / 1024).toFixed(1)}MB)`);
        }
      }
    );
    
    if (!downloadResult.success) {
      throw new Error(`下载失败: ${downloadResult.error}`);
    }
    
    console.log('✅ 下载完成！');
    console.log(`文件路径: ${downloadResult.filePath}`);
    
    // 创建启动器
    const launcher = new GameLauncher('./test-minecraft-data', {
      launcherName: 'TestLauncher',
      launcherVersion: '1.0.0'
    });
    
    console.log('🎮 准备启动游戏...');
    
    // 准备启动参数
    const launchArgs = {
      username: 'TestPlayer',
      versionName: 'test-1.20.1',
      gameDirectory: './test-minecraft-data/versions/test-1.20.1',
      assetsDirectory: './test-minecraft-data/assets',
      assetIndex: '13',
      uuid: '00000000-0000-0000-0000-000000000000',
      accessToken: 'test_token',
      userType: 'legacy',
      versionType: 'release',
      maxMemory: 2048,
      minMemory: 512
    };
    
    // 构建启动命令（不实际启动）
    const launchResult = await launcher.launchGame(
      'test-1.20.1',
      launchArgs,
      'java',
      (progress, total, percentage) => {
        console.log(`启动准备: ${percentage}%`);
      },
      (log) => {
        console.log(`[游戏日志] ${log}`);
      }
    );
    
    if (launchResult.success) {
      console.log('✅ 启动命令构建成功！');
      console.log('📋 启动命令分析:');
      
      const command = launchResult.command || '';
      console.log(`- 命令长度: ${command.length} 字符`);
      console.log(`- 包含用户名: ${command.includes('TestPlayer')}`);
      console.log(`- 包含版本名: ${command.includes('test-1.20.1')}`);
      console.log(`- 包含主类: ${command.includes('net.minecraft.client.main.Main')}`);
      console.log(`- 没有重复的-cp: ${!command.includes('-cp -cp')}`);
      console.log(`- 没有未解析占位符: ${!command.includes('${')}`);
      console.log(`- 没有空参数: ${!command.includes('--  ')}`);
      console.log(`- 类路径参数正确: ${command.includes('-cp ') && !command.includes('-cp -cp')}`);
      
      // 显示启动命令的关键部分
      console.log('\n📝 启动命令关键部分:');
      const parts = command.split(' ');
      const cpIndex = parts.indexOf('-cp');
      if (cpIndex !== -1 && cpIndex + 1 < parts.length) {
        console.log(`- JVM参数数量: ${cpIndex}`);
        console.log(`- 主类: ${parts[cpIndex + 2] || '未找到'}`);
        console.log(`- 游戏参数数量: ${parts.length - cpIndex - 3}`);
      }
      
      // 终止进程（因为我们只是测试命令构建）
      if (launchResult.process) {
        launchResult.process.kill();
        console.log('🛑 已终止测试进程');
      }
      
    } else {
      console.error('❌ 启动失败:', launchResult.error);
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
testRealDownloadAndLaunch().catch(console.error);

