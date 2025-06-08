import fs from 'fs-extra';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { LaunchArguments, LaunchResult, ProgressCallback } from '../types';

interface LauncherConfigure {
  launcherVersion?: string;
  launcherName?: string;
}
/**
 * Minecraft游戏启动器（修复版）
 */
export class GameLauncher {
  private dataDir: string;
  private configure: LauncherConfigure = {};
  /**
   * 构造函数
   * @param dataDir 数据目录
   */
  constructor(dataDir: string = './minecraft-data', configure: LauncherConfigure = {}) {
    this.dataDir = dataDir;
    this.configure = configure;
  }

  /**
   * 启动Minecraft游戏
   * @param versionName 版本名称
   * @param launchArgs 启动参数
   * @param javaPath Java路径
   * @param onProgress 进度回调
   * @param onLog 日志回调
   * @returns 启动结果
   */
  public async launchGame(
    versionName: string,
    launchArgs: LaunchArguments,
    javaPath: string = 'java',
    onProgress?: ProgressCallback,
    onLog?: (log: string) => void
  ): Promise<LaunchResult> {
    try {
      if (onProgress) {
        onProgress(0, 100, 0);
      }

      // 读取版本JSON文件
      const versionJsonPath = path.join(this.dataDir, 'versions', versionName, `${versionName}.json`);
      if (!await fs.pathExists(versionJsonPath)) {
        throw new Error(`版本JSON文件不存在: ${versionJsonPath}`);
      }

      const versionJson = await fs.readJson(versionJsonPath);

      if (onProgress) {
        onProgress(10, 100, 10);
      }

      // 构建类路径
      const classpath = await this.buildClasspath(versionJson, versionName);

      if (onProgress) {
        onProgress(30, 100, 30);
      }

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

      // 启动游戏进程
      const gameProcess = spawn(javaPath, args, {
        // cwd: launchArgs.gameDirectory,
        cwd: process.cwd(), // 使用当前工作目录
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

      if (onProgress) {
        onProgress(100, 100, 100);
      }

      return {
        success: true,
        pid: gameProcess.pid,
        process: gameProcess,
        command: `${javaPath} ${args.join(' ')}`
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
  private async buildClasspath(versionJson: any, versionName: string): Promise<string> {
    const classpathEntries: string[] = [];

    // 添加主JAR文件
    const mainJarPath = path.join(this.dataDir, 'versions', versionName, `${versionName}.jar`);
    classpathEntries.push(mainJarPath);

    // 添加库文件
    if (versionJson.libraries) {
      for (const library of versionJson.libraries) {
        // 检查规则
        if (library.rules && !this.evaluateRules(library.rules)) {
          continue;
        }

        // 跳过原生库
        if (library.name.includes('natives')) {
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

    return classpathEntries.join(path.delimiter);
  }

  /**
   * 构建JVM参数（修复重复-cp问题）
   * @param versionJson 版本JSON
   * @param launchArgs 启动参数
   * @param classpath 类路径
   * @returns JVM参数数组
   */
  private buildJvmArguments(versionJson: any, launchArgs: LaunchArguments, classpath: string): string[] {
    const jvmArgs: string[] = [];

    // 添加内存参数
    if (launchArgs.minMemory) {
      jvmArgs.push(`-Xms${launchArgs.minMemory}m`);
    }
    if (launchArgs.maxMemory) {
      jvmArgs.push(`-Xmx${launchArgs.maxMemory}m`);
    }

    // 处理版本JSON中的JVM参数（跳过单独的-cp）
    if (versionJson.arguments && versionJson.arguments.jvm) {
      const processedArgs = this.processArgumentArray(versionJson.arguments.jvm, launchArgs, true);
      jvmArgs.push(...processedArgs);
    }

    // 添加类路径（确保只添加一次）
    jvmArgs.push('-cp', classpath);

    // 添加自定义JVM参数
    if (launchArgs.customJvmArgs) {
      jvmArgs.push(...launchArgs.customJvmArgs);
    }

    return jvmArgs;
  }

  /**
   * 构建游戏参数
   * @param versionJson 版本JSON
   * @param launchArgs 启动参数
   * @returns 游戏参数数组
   */
  private buildGameArguments(versionJson: any, launchArgs: LaunchArguments): string[] {
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
   * 处理参数数组（修复版，正确处理rules和占位符）
   * @param argumentArray 参数数组
   * @param launchArgs 启动参数
   * @param isJvmArgs 是否为JVM参数
   * @returns 处理后的参数数组
   */
  private processArgumentArray(argumentArray: any[], launchArgs: LaunchArguments, isJvmArgs: boolean): string[] {
    const result: string[] = [];

    for (const arg of argumentArray) {
      if (typeof arg === 'string') {
        // 处理字符串参数
        if (isJvmArgs && arg === '-cp') {
          // 跳过JVM参数中单独的-cp，我们会在后面统一添加
          continue;
        }

        const processedArg = this.replaceArguments(arg, launchArgs);
        if (processedArg !== null) {
          result.push(processedArg);
        }
      } else if (typeof arg === 'object' && arg.rules) {
        // 处理带rules的复杂参数
        if (this.evaluateRules(arg.rules)) {
          if (Array.isArray(arg.value)) {
            // 处理数组值（如 ['--width', '${resolution_width}', '--height', '${resolution_height}']）
            const processedValues = this.processComplexArgumentValue(arg.value, launchArgs);
            result.push(...processedValues);
          } else if (typeof arg.value === 'string') {
            // 处理字符串值
            const processedArg = this.replaceArguments(arg.value, launchArgs);
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
   * @returns 处理后的参数数组
   */
  private processComplexArgumentValue(valueArray: any[], launchArgs: LaunchArguments): string[] {
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
            const processedNext = this.replaceArguments(next, launchArgs);
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
          const processedArg = this.replaceArguments(current, launchArgs);
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
   * 替换参数中的占位符（动态匹配，不预定义）
   * @param arg 原始参数
   * @param launchArgs 启动参数
   * @returns 替换后的参数，如果无法替换则返回null
   */
  private replaceArguments(arg: string, launchArgs: LaunchArguments): string | null {
    let result = arg;
    let hasUnresolvedPlaceholder = false;

    // 查找所有占位符 ${xxx}
    const placeholderRegex = /\$\{([^}]+)\}/g;
    let match: any[];

    while ((match = placeholderRegex.exec(arg)) !== null) {
      const fullPlaceholder = match[0]; // ${xxx}
      const placeholderKey = match[1];  // xxx

      // 动态从launchArgs中查找对应的属性值
      let replacementValue: string | undefined;

      // 特殊处理一些固定的系统占位符
      if (placeholderKey === 'natives_directory') {
        // replacementValue = launchArgs.natives_directory as string;
        replacementValue = launchArgs.natives_directory as string || path.join(launchArgs.gameDirectory || this.dataDir, 'versions', launchArgs.versionName, `${launchArgs.versionName}-natives`);
      } else if (placeholderKey === 'launcher_name') {
        replacementValue = this.configure.launcherName || 'minecraft-launcher-sdk';
      } else if (placeholderKey === 'launcher_version') {
        replacementValue = this.configure.launcherVersion || '1.0.0';
      } else if (placeholderKey === 'classpath') {
        // classpath在JVM参数中单独处理，这里跳过
        return null;
      } else if (placeholderKey === 'assets_root') {
        replacementValue = path.join(launchArgs.assetsDirectory || this.dataDir, 'assets');
      } else if (placeholderKey === 'game_directory') {
        replacementValue = launchArgs.gameDirectory || this.dataDir;
      } else {
        // 动态查找launchArgs中的属性
        // 支持多种命名格式的映射
        const propertyMappings: Record<string, keyof LaunchArguments> = {
          'auth_player_name': 'username',
          'version_name': 'versionName',
          // 'game_directory': 'gameDirectory',
          // 'assets_root': 'assetsDirectory',
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
          'quickPlayRealms': 'quickPlayRealms',
          'natives_directory': 'nativesdirectory'
        };

        // 首先尝试直接匹配
        const directKey = placeholderKey as keyof LaunchArguments;
        if (directKey in launchArgs) {
          const value = launchArgs[directKey];
          replacementValue = value?.toString();
        }
        // 然后尝试映射匹配
        else if (placeholderKey in propertyMappings) {
          const mappedKey = propertyMappings[placeholderKey];
          const value = launchArgs[mappedKey];
          replacementValue = value?.toString();
        }
      }

      // 检查是否找到了有效的替换值
      if (replacementValue !== undefined && replacementValue !== '') {
        // 有值，进行替换
        result = result.replace(new RegExp(fullPlaceholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacementValue);
      } else {
        // 没有值，标记为无法解析
        hasUnresolvedPlaceholder = true;
      }
    }

    // 如果有无法解析的占位符，返回null（表示删除这个参数）
    if (hasUnresolvedPlaceholder) {
      return null;
    }

    return result;
  }

  /**
   * 评估规则（支持features）
   * @param rules 规则数组
   * @returns 是否满足规则
   */
  private evaluateRules(rules: any[]): boolean {
    let allowed = false;

    for (const rule of rules) {
      if (rule.action === 'allow') {
        let matches = true;

        // 检查操作系统规则
        if (rule.os && !this.matchesOs(rule.os)) {
          matches = false;
        }

        // 检查features规则
        if (rule.features && !this.matchesFeatures(rule.features)) {
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
        if (rule.features && !this.matchesFeatures(rule.features)) {
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
    const platform = process.platform;

    if (osRule.name) {
      switch (osRule.name) {
        case 'windows':
          return platform === 'win32';
        case 'osx':
          return platform === 'darwin';
        case 'linux':
          return platform === 'linux';
        default:
          return false;
      }
    }

    return true;
  }

  /**
   * 检查features是否匹配
   * @param featuresRule features规则
   * @returns 是否匹配
   */
  private matchesFeatures(featuresRule: any): boolean {
    // 这里可以根据实际需求实现features检查
    // 目前简单返回false，表示不启用这些特殊功能
    // 如果需要启用某些功能，可以在这里添加逻辑

    // 例如：如果有分辨率参数，启用自定义分辨率功能
    if (featuresRule.has_custom_resolution) {
      return false; // 暂时禁用，避免空参数
    }

    // 其他features默认不启用
    return false;
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
}

