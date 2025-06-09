import fs from 'fs-extra';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { LaunchArguments, LaunchResult, ProgressCallback, LaunchOptions, VersionInfo } from '../types';
import os from 'os';

interface LauncherConfigure {
  launcherVersion?: string;
  launcherName?: string;
}

/**
 * Minecraft游戏启动器
 */
export class GameLauncher {
  private dataDir: string;
  private configure: LauncherConfigure = {};
  
  /**
   * 构造函数
   * @param dataDir SDK数据目录，用于存放版本、库、资源等文件
   * @param configure 启动器配置
   */
  constructor(dataDir: string = './minecraft-data', configure: LauncherConfigure = {}) {
    this.dataDir = dataDir;
    this.configure = configure;
  }

  /**
   * 生成Minecraft启动命令
   * @param options 启动选项
   * @param onProgress 进度回调
   * @returns 启动命令字符串
   */
  public async generateLaunchCommand(
    options: LaunchOptions,
    onProgress?: ProgressCallback
  ): Promise<string> {
    try {
      if (onProgress) {
        onProgress(0, 100, 0);
      }

      // 读取版本JSON文件
      const versionJsonPath = path.join(this.dataDir, 'versions', options.version, `${options.version}.json`);
      if (!await fs.pathExists(versionJsonPath)) {
        throw new Error(`版本JSON文件不存在: ${versionJsonPath}`);
      }

      const versionJson: VersionInfo = await fs.readJson(versionJsonPath);

      if (onProgress) {
        onProgress(10, 100, 10);
      }

      // 构建类路径
      const classpath = await this.buildClasspath(versionJson, options.version);

      if (onProgress) {
        onProgress(30, 100, 30);
      }

      // 准备 LaunchArguments
      const launchArgs: LaunchArguments = {
        username: options.username,
        accessToken: options.accessToken,
        uuid: options.uuid,
        gameDirectory: options.gameDirectory,
        assetsDirectory: path.join(this.dataDir, 'assets'), // 资源目录通常在数据目录下的assets
        assetIndex: versionJson.assetIndex.id,
        versionName: options.version,
        versionType: versionJson.type,
        width: options.width,
        height: options.height,
        minMemory: options.minMemory,
        maxMemory: options.maxMemory,
        customJvmArgs: options.vmOptions,
        customGameArgs: options.gameOptions,
        // 更多参数可以根据需要从 options 映射过来
      };

      // 构建JVM参数
      const jvmArgs = this.buildJvmArguments(versionJson, launchArgs, classpath);

      if (onProgress) {
        onProgress(50, 100, 50);
      }

      // 构建游戏参数
      const gameArgs = this.buildGameArguments(versionJson, launchArgs);

      if (onProgress) {
        onProgress(70, 100, 70);
      }

      // 构建完整的启动命令
      const args = [
        ...jvmArgs,
        versionJson.mainClass,
        ...gameArgs
      ];

      if (onProgress) {
        onProgress(90, 100, 90);
      }

      const fullCommand = `${options.javaPath} ${args.join(' ')}`;

      if (onProgress) {
        onProgress(100, 100, 100);
      }

      return fullCommand;

    } catch (error) {
      throw new Error(`生成启动命令失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 启动Minecraft游戏进程
   * @param options 启动选项
   * @param onLog 日志回调
   * @returns 启动结果
   */
  public async launchGame(
    options: LaunchOptions,
    onLog?: (log: string) => void
  ): Promise<LaunchResult> {
    try {
      const command = await this.generateLaunchCommand(options);
      const args = command.split(' ').slice(1); // 移除java路径，只保留参数
      const javaPath = command.split(' ')[0]; // 获取java路径

      // 启动游戏进程
      const gameProcess = spawn(javaPath, args, {
        cwd: options.gameDirectory || process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // 处理日志输出
      if (onLog) {
        gameProcess.stdout?.on('data', (data) => {
          onLog(`[STDOUT] ${data.toString()}`);
        });

        gameProcess.stderr?.on('data', (data) => {
          onLog(`[STDERR] ${data.toString()}`);
        });

        gameProcess.on('close', (code) => {
          onLog(`[PROCESS] 游戏进程退出，退出码: ${code}`);
        });

        gameProcess.on('error', (error) => {
          onLog(`[ERROR] 进程错误: ${error.message}`);
        });
      }

      return {
        success: true,
        pid: gameProcess.pid,
        process: gameProcess,
        command: command
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 构建类路径
   * @param versionJson 版本JSON
   * @param versionName 版本名称
   * @returns 类路径字符串
   */
  private async buildClasspath(versionJson: VersionInfo, versionName: string): Promise<string> {
    const classpathEntries: string[] = [];

    // 添加库文件
    if (versionJson.libraries) {
      for (const library of versionJson.libraries) {
        // 检查规则
        if (library.rules && !this.evaluateRules(library.rules, {} as LaunchArguments)) { 
          continue;
        }

        // 对于原生库，不添加到classpath
        if (library.natives) {
          continue;
        }

        // 构建库文件路径
        const artifact = library.downloads?.artifact;
        if (artifact) {
          const libraryPath = path.join(this.dataDir, 'libraries', artifact.path);
          classpathEntries.push(libraryPath);
        }
      }
    }

    // 添加主JAR文件（最后添加，按PCL2格式）
    const mainJarPath = path.join(this.dataDir, 'versions', versionName, `${versionName}.jar`);
    classpathEntries.push(mainJarPath);

    return classpathEntries.join(path.delimiter);
  }

  /**
   * 构建JVM参数
   * @param versionJson 版本JSON
   * @param launchArgs 启动参数
   * @param classpath 类路径
   * @returns JVM参数数组
   */
  private buildJvmArguments(versionJson: VersionInfo, launchArgs: LaunchArguments, classpath: string): string[] {
    const jvmArgs: string[] = [];

    // 添加自定义JVM参数（在最前面）
    if (launchArgs.customJvmArgs) {
      jvmArgs.push(...launchArgs.customJvmArgs);
    }

    // 处理版本JSON中的JVM参数
    if (versionJson.arguments && versionJson.arguments.jvm) {
      const processedArgs = this.processArgumentArray(versionJson.arguments.jvm, launchArgs, true, classpath);
      jvmArgs.push(...processedArgs);
    }

    // 添加内存参数
    if (launchArgs.minMemory) {
      jvmArgs.push(`-Xmn${launchArgs.minMemory}m`);
    }
    if (launchArgs.maxMemory) {
      jvmArgs.push(`-Xmx${launchArgs.maxMemory}m`);
    }

    return jvmArgs;
  }

  /**
   * 构建游戏参数
   * @param versionJson 版本JSON
   * @param launchArgs 启动参数
   * @returns 游戏参数数组
   */
  private buildGameArguments(versionJson: VersionInfo, launchArgs: LaunchArguments): string[] {
    const gameArgs: string[] = [];

    // 处理新版本的arguments格式
    if (versionJson.arguments && versionJson.arguments.game) {
      const processedArgs = this.processArgumentArray(versionJson.arguments.game, launchArgs, false);
      gameArgs.push(...processedArgs);
    }
    // 处理旧版本的minecraftArguments格式
    else if (versionJson.minecraftArguments) {
      const args = versionJson.minecraftArguments.split(' ');
      const processedArgs = this.processArgumentArray(args, launchArgs, false);
      gameArgs.push(...processedArgs);
    }

    // 添加自定义游戏参数
    if (launchArgs.customGameArgs) {
      gameArgs.push(...launchArgs.customGameArgs);
    }

    return gameArgs;
  }

  /**
   * 处理参数数组（完全修复版，正确处理rules和占位符）
   * @param argumentArray 参数数组
   * @param launchArgs 启动参数
   * @param isJvmArgs 是否为JVM参数
   * @param classpath 类路径 (仅对JVM参数有效)
   * @returns 处理后的参数数组
   */
  private processArgumentArray(argumentArray: any[], launchArgs: LaunchArguments, isJvmArgs: boolean, classpath?: string): string[] {
    const result: string[] = [];

    for (const arg of argumentArray) {
      if (typeof arg === 'string') {
        // 处理字符串参数
        const processedArg = this.replaceArguments(arg, launchArgs, isJvmArgs ? classpath : undefined); // 传递 classpath
        if (processedArg !== null) {
          result.push(processedArg);
        }
      } else if (typeof arg === 'object' && arg.rules) {
        // 处理带rules的复杂参数
        if (this.evaluateRules(arg.rules, launchArgs)) { // 传递 launchArgs 给 evaluateRules
          if (Array.isArray(arg.value)) {
            // 处理数组值（如 ['--width', '${resolution_width}', '${resolution_height}']）
            const processedValues = this.processComplexArgumentValue(arg.value, launchArgs, isJvmArgs ? classpath : undefined); // 传递 classpath
            result.push(...processedValues);
          } else if (typeof arg.value === 'string') {
            // 处理字符串值
            const processedArg = this.replaceArguments(arg.value, launchArgs, isJvmArgs ? classpath : undefined); // 传递 classpath
            if (processedArg !== null) {
              result.push(processedArg);
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * 处理复杂参数值（数组形式）
   * @param valueArray 参数值数组
   * @param launchArgs 启动参数
   * @param classpath 类路径 (仅对JVM参数有效)
   * @returns 处理后的参数数组
   */
  private processComplexArgumentValue(valueArray: any[], launchArgs: LaunchArguments, classpath?: string): string[] {
    const result: string[] = [];
    let i = 0;

    while (i < valueArray.length) {
      const current = valueArray[i];

      if (typeof current === 'string') {
        if (current.startsWith('--') && i + 1 < valueArray.length) {
          // 这是一个参数名，检查下一个是否为占位符
          const next = valueArray[i + 1];
          if (typeof next === 'string' && next.includes('${')) {
            // 下一个是占位符，尝试替换
            const processedNext = this.replaceArguments(next, launchArgs, classpath); // 传递 classpath
            if (processedNext !== null) {
              // 替换成功，添加参数名和值
              result.push(current, processedNext);
            }
            // 无论是否成功，都跳过下一个参数
            i += 2;
          } else {
            // 下一个不是占位符，正常处理
            result.push(current);
            i++;
          }
        } else {
          // 不是参数名，直接处理
          const processedArg = this.replaceArguments(current, launchArgs, classpath); // 传递 classpath
          if (processedArg !== null) {
            result.push(processedArg);
          }
          i++;
        }
      } else {
        // 非字符串，跳过
        i++;
      }
    }

    return result;
  }

  /**
   * 替换参数中的占位符（动态匹配，完全按PCL2标准）
   * @param arg 原始参数
   * @param launchArgs 启动参数
   * @param classpath 类路径 (仅对classpath占位符有效)
   * @returns 替换后的参数，如果无法替换则返回null
   */
  private replaceArguments(arg: string, launchArgs: LaunchArguments, classpath?: string): string | null {
    let result = arg;
    let hasUnresolvedPlaceholder = false;

    // 查找所有占位符 ${xxx}
    const placeholderRegex = /\$\{(.+?)\}/g; 
    let match;

    while ((match = placeholderRegex.exec(arg)) !== null) {
      const fullPlaceholder = match[0]; 
      const placeholderKey = match[1];  

      let replacementValue: string | undefined;

      // 特殊处理一些固定的系统占位符
      if (placeholderKey === 'natives_directory') {
        replacementValue = path.join(this.dataDir, 'versions', launchArgs.versionName || 'unknown', `${launchArgs.versionName || 'unknown'}-natives`);
      } else if (placeholderKey === 'launcher_name') {
        replacementValue = this.configure.launcherName || 'minecraft-launcher-sdk';
      } else if (placeholderKey === 'launcher_version') {
        replacementValue = this.configure.launcherVersion || '1.0.0';
      } else if (placeholderKey === 'classpath') {
        replacementValue = classpath; 
      } else {
        const propertyMappings: Record<string, keyof LaunchArguments> = {
          'auth_player_name': 'username',
          'version_name': 'versionName',
          'game_directory': 'gameDirectory',
          'assets_root': 'assetsDirectory',
          'assets_index_name': 'assetIndex',
          'auth_uuid': 'uuid',
          'auth_access_token': 'accessToken',
          'clientid': 'clientId',
          'auth_xuid': 'xuid',
          'user_type': 'userType',
          'version_type': 'versionType',
          'resolution_width': 'width',
          'resolution_height': 'height',
          'quickPlayPath': 'quickPlayPath',
          'quickPlaySingleplayer': 'quickPlaySingleplayer',
          'quickPlayMultiplayer': 'quickPlayMultiplayer',
          'quickPlayRealms': 'quickPlayRealms'
        };

        const directKey = placeholderKey as keyof LaunchArguments;
        if (directKey in launchArgs) {
          const value = launchArgs[directKey];
          replacementValue = value?.toString();
        }
        else if (placeholderKey in propertyMappings) {
          const mappedKey = propertyMappings[placeholderKey];
          const value = launchArgs[mappedKey];
          replacementValue = value?.toString();
        }
      }

      if (replacementValue !== undefined && replacementValue !== '') {
        result = result.replace(new RegExp(fullPlaceholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacementValue);
      } else {
        hasUnresolvedPlaceholder = true;
      }
    }

    if (hasUnresolvedPlaceholder) {
      return null;
    }

    return result;
  }

  /**
   * 评估规则（支持features和OS）
   * @param rules 规则数组
   * @param launchArgs 启动参数 (用于评估features)
   * @returns 是否满足规则
   */
  private evaluateRules(rules: any[], launchArgs: LaunchArguments): boolean {
    let allowed = false;

    for (const rule of rules) {
      if (rule.action === 'allow') {
        let matches = true;

        // 检查操作系统规则
        if (rule.os && !this.matchesOs(rule.os)) {
          matches = false;
        }

        // 检查features规则
        if (rule.features && !this.matchesFeatures(rule.features, launchArgs)) { 
          matches = false;
        }

        if (matches) {
          allowed = true;
        }
      } else if (rule.action === 'disallow') {
        let matches = true;

        // 检查操作系统规则
        if (rule.os && !this.matchesOs(rule.os)) {
          matches = false;
        }

        // 检查features规则
        if (rule.features && !this.matchesFeatures(rule.features, launchArgs)) { 
          matches = false;
        }

        if (matches) {
          allowed = false;
        }
      }
    }

    return allowed;
  }

  /**
   * 检查操作系统是否匹配
   * @param osRule 操作系统规则
   * @returns 是否匹配
   */
  private matchesOs(osRule: any): boolean {
    const platform = os.platform(); 
    const arch = os.arch(); 

    if (osRule.name) {
      switch (osRule.name) {
        case 'windows':
          if (platform !== 'win32') return false;
          break;
        case 'osx':
          if (platform !== 'darwin') return false;
          break;
        case 'linux':
          if (platform !== 'linux') return false;
          break;
        default:
          return false;
      }
    }

    if (osRule.arch) {
      switch (osRule.arch) {
        case 'x86':
          if (arch !== 'ia32') return false;
          break;
        case 'x64':
          if (arch !== 'x64') return false;
          break;
        default:
          return false;
      }
    }

    return true;
  }

  /**
   * 检查features是否匹配
   * @param featuresRule features规则
   * @param launchArgs 启动参数
   * @returns 是否匹配
   */
  private matchesFeatures(featuresRule: any, launchArgs: LaunchArguments): boolean {
    let allFeaturesMatch = true;

    if (featuresRule.has_custom_resolution !== undefined) {
      if (featuresRule.has_custom_resolution && (!launchArgs.width || !launchArgs.height)) {
        allFeaturesMatch = false;
      }
    }

    if (featuresRule.is_demo_user !== undefined) {
      if (featuresRule.is_demo_user && !launchArgs.isDemoUser) {
        allFeaturesMatch = false;
      }
    }

    if (featuresRule.has_quick_plays_support !== undefined) {
      if (featuresRule.has_quick_plays_support && !launchArgs.quickPlayPath) {
        allFeaturesMatch = false;
      }
    }

    if (featuresRule.is_quick_play_singleplayer !== undefined) {
      if (featuresRule.is_quick_play_singleplayer && !launchArgs.quickPlaySingleplayer) {
        allFeaturesMatch = false;
      }
    }

    if (featuresRule.is_quick_play_multiplayer !== undefined) {
      if (featuresRule.is_quick_play_multiplayer && !launchArgs.quickPlayMultiplayer) {
        allFeaturesMatch = false;
      }
    }

    if (featuresRule.is_quick_play_realms !== undefined) {
      if (featuresRule.is_quick_play_realms && !launchArgs.quickPlayRealms) {
        allFeaturesMatch = false;
      }
    }

    return allFeaturesMatch;
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
   * 设置启动器配置
   * @param configure 启动器配置
   */
  public setConfigure(configure: LauncherConfigure): void {
    this.configure = configure;
  }
}


