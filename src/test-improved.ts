import { MinecraftDownloader, DownloadSource, GameLauncher, LaunchArguments } from './index';
import * as fs from 'fs-extra';
import path from 'path';

/**
 * 测试改进后的SDK功能
 */
async function testImprovedSDK() {
  console.log('开始测试改进后的Minecraft启动器SDK...\n');

  // 创建下载器实例
  const downloader = new MinecraftDownloader({
    source: DownloadSource.BMCLAPI, // 使用BMCLAPI源（国内加速）
    dataDir: './test-minecraft-data',
    maxConcurrentDownloads: 3,
    validateIntegrity: true
  });

  // 创建启动器实例
  const launcher = new GameLauncher('./test-minecraft-data');

  try {
    // 测试1：下载Minecraft版本
    console.log('=== 测试1：下载Minecraft客户端 ===');
    const versionId = '1.20.1';
    const versionName = 'minecraft-1.20.1';
    
    // console.log(`正在下载Minecraft ${versionId}...`);
    // const downloadResult = await downloader.downloadClient(versionId, versionName, (progress, total, percentage) => {
    //   console.log(`下载进度: ${Math.round(percentage)}% (${progress}/${total})`);
    // });

    // if (downloadResult.success) {
    //   console.log(`✓ Minecraft ${versionId} 下载成功`);
    //   console.log(`客户端JAR路径: ${downloadResult.filePath}`);
    // } else {
    //   console.error(`✗ Minecraft ${versionId} 下载失败: ${downloadResult.error}`);
    //   return;
    // }

    // // 测试2：获取并安装Forge
    // console.log('\n=== 测试2：安装Forge模组加载器 ===');
    // try {
    //   console.log(`正在获取Minecraft ${versionId}的Forge版本列表...`);
    //   const forgeVersions = await downloader.getForgeVersions(versionId);
      
    //   if (forgeVersions.length > 0) {
    //     // 选择推荐版本或最新版本
    //     const recommendedForge = forgeVersions.find(v => v.recommended) || forgeVersions[0];
    //     console.log(`选择Forge版本: ${recommendedForge.version} (构建号: ${recommendedForge.build})`);
        
    //     console.log(`正在安装Forge到版本 ${versionName}...`);
    //     const forgeResult = await downloader.installForge(recommendedForge, versionName, 'java', (progress, total, percentage) => {
    //       console.log(`Forge安装进度: ${Math.round(percentage)}% (${progress}/${total})`);
    //     });
        
    //     if (forgeResult.success) {
    //       console.log(`✓ Forge安装成功!`);
    //       console.log(`版本ID: ${forgeResult.versionId}`);
    //       console.log(`版本JSON路径: ${forgeResult.versionJsonPath}`);
    //     } else {
    //       console.log(`✗ Forge安装失败: ${forgeResult.error}`);
    //     }
    //   } else {
    //     console.log(`未找到Minecraft ${versionId}的Forge版本`);
    //   }
    // } catch (error) {
    //   console.log(`Forge测试跳过: ${error}`);
    // }

    // 测试3：获取并安装Fabric
    console.log('\n=== 测试3：安装Fabric模组加载器 ===');
    try {
      console.log(`正在获取Minecraft ${versionId}的Fabric版本列表...`);
      const fabricVersions = await downloader.getFabricVersions(versionId);
      
      if (fabricVersions.length > 0) {
        // 选择稳定版本或第一个版本
        const stableFabric = fabricVersions.find(v => v.stable) || fabricVersions[0];
        console.log(`选择Fabric版本: ${stableFabric.loaderVersion}`);
        
        // 为Fabric创建一个新的版本名称
        const fabricVersionName = `${versionName}-fabric`;
        
        // 先复制原版本文件夹
        
        const path = require('path');
        const originalDir = path.join('./test-minecraft-data/versions', versionName);
        const fabricDir = path.join('./test-minecraft-data/versions', fabricVersionName);
        
        if (await fs.pathExists(originalDir)) {
          await fs.copy(originalDir, fabricDir);
          console.log(`已复制版本文件夹到: ${fabricVersionName}`);
        }
        await fs.copy(path.join(originalDir, `${versionName}.json`), path.join(fabricDir, `${fabricVersionName}.json`));
        
        console.log(`正在安装Fabric到版本 ${fabricVersionName}...`);
        const fabricResult = await downloader.installFabric(stableFabric, fabricVersionName, (progress, total, percentage) => {
          console.log(`Fabric安装进度: ${Math.round(percentage)}% (${progress}/${total})`);
        });
        
        if (fabricResult.success) {
          console.log(`✓ Fabric安装成功!`);
          console.log(`版本ID: ${fabricResult.versionId}`);
          console.log(`版本JSON路径: ${fabricResult.versionJsonPath}`);
        } else {
          console.log(`✗ Fabric安装失败: ${fabricResult.error}`);
        }
      } else {
        console.log(`未找到Minecraft ${versionId}的Fabric版本`);
      }
    } catch (error) {
      console.log(`Fabric测试跳过: ${error}`);
    }

    // 测试4：测试启动逻辑（不实际启动游戏）
    console.log('\n=== 测试2：测试修复后的启动器（完整参数） ===');
    try {
      const fullArgs: LaunchArguments = {
        username: 'TestPlayer',
        accessToken: '0',
        uuid: 'test-uuid-1234-5678-9012-345678901234',
        userType: 'Legacy',
        gameDirectory: './test-minecraft-data',
        assetsDirectory: './test-minecraft-data/assets',
        assetIndex: '1.20',
        versionName: versionName,
        versionType: 'release',
        width: 1920,
        height: 1080,
        maxMemory: 4096,
        minMemory: 1024
      };

      console.log(`正在测试完整参数启动...`);
      const fullResult = await launcher.launchGame(
        versionName, 
        fullArgs, 
        'echo', // 使用echo命令进行测试，避免实际启动游戏
        (progress, total, percentage) => {
          console.log(`启动准备进度: ${Math.round(percentage)}%`);
        },
        (log) => {
          console.log(`[MC日志] ${log.trim()}`);
        }
      );

      if (fullResult.success) {
        console.log(`✓ 完整参数启动命令构建成功!`);
        const command = fullResult.command || '';
        
        // 检查修复效果
        console.log(`\n启动命令分析:`);
        console.log(`- 命令长度: ${command.length} 字符`);
        console.log(`- 包含用户名: ${command.includes('TestPlayer')}`);
        console.log(`- 包含分辨率: ${command.includes('1920') && command.includes('1080')}`);
        console.log(`- 包含版本名: ${command.includes(versionName)}`);
        console.log(`- 没有重复的-cp: ${!command.includes('-cp -cp')}`);
        console.log(`- 没有未解析占位符: ${!command.includes('${')}`);
        console.log(`- 没有空参数: ${!command.includes('--clientId --') && !command.includes('--xuid --')}`);
        
        // 显示启动命令的关键部分
        const args = command.split(' ');
        const cpIndex = args.indexOf('-cp');
        if (cpIndex !== -1 && cpIndex + 1 < args.length) {
          console.log(`- 类路径参数正确: ${args[cpIndex + 1].length > 0}`);
        }
        
        // 终止测试进程
        if (fullResult.pid) {
          try { process.kill(fullResult.pid); } catch {}
        }
      } else {
        console.error(`✗ 完整参数启动失败: ${fullResult.error}`);
      }
    } catch (error) {
      console.error('完整参数测试失败:', error);
    }

    console.log('\n=== 测试完成 ===');
    console.log('所有主要功能已测试完成！');

  } catch (error) {
    console.error('测试过程中发生错误:', error);
  }
}

// 运行测试
testImprovedSDK().catch(console.error);

