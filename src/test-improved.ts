import { MinecraftDownloader, GameLauncher } from "./index";
import { LaunchOptions } from "./types";
import path from "path";
import fs from "fs-extra";

const dataPath = "test-minecraft-data";

async function runTests() {
    console.log("开始测试改进后的Minecraft启动器SDK...");

    // === 测试1：下载Minecraft客户端 (原版) ===
    console.log("\n=== 测试1：下载Minecraft客户端 (原版) ===");
    try {
        const downloader = new MinecraftDownloader({ dataDir: dataPath });
        console.log("正在下载Minecraft 1.21.5...");
        const downloadResult = await downloader.downloadClient("1.21.5", "1.21.5", (progress, total, percentage) => {
            console.log(`下载进度: ${percentage}% (${progress}/${total})`);
        });

        if (downloadResult.success) {
            console.log("✓ Minecraft 1.21.5 下载成功");
            console.log("客户端JAR路径:", downloadResult.filePath);
        } else {
            console.error("✗ Minecraft 1.21.5 下载失败:", downloadResult.error);
        }
    } catch (error) {
        console.error("✗ Minecraft 1.21.5 下载过程中发生错误:", error);
    }

    // === 测试2：测试原版启动命令生成 ===
    console.log("\n=== 测试2：测试原版启动命令生成 ===");
    try {
        const vanillaVersion = "1.21.5";
        const vanillaVersionJsonPath = path.join(dataPath, "versions", vanillaVersion, `${vanillaVersion}.json`);
        const vanillaClientJarPath = path.join(dataPath, "versions", vanillaVersion, `${vanillaVersion}.jar`);

        if (!fs.existsSync(vanillaVersionJsonPath) || !fs.existsSync(vanillaClientJarPath)) {
            console.log(`原版版本文件或客户端JAR不存在，请先下载: ${vanillaVersionJsonPath}, ${vanillaClientJarPath}`);
            return;
        }

        const vanillaLaunchOptions: LaunchOptions = {
            version: vanillaVersion,
            gameDirectory: dataPath,
            javaPath: "java",
            accessToken: "test_token",
            uuid: "test_uuid",
            username: "test_player",
            width: 854,
            height: 480,
            vmOptions: [],
            gameOptions: [],
            minMemory: 1024,
            maxMemory: 2048,
        };

        const vanillaLauncher = new GameLauncher(dataPath);
        console.log("原版启动准备进度: 0%");
        const vanillaCommand = await vanillaLauncher.generateLaunchCommand(vanillaLaunchOptions, (progress, total, percentage) => {
            console.log(`原版启动准备进度: ${Math.round(percentage)}%`);
        });
        console.log("✓ 原版启动命令构建成功!");
        console.log("原版启动命令:", vanillaCommand);
    } catch (error) {
        console.error("✗ 原版启动命令构建失败:", error);
    }

    // === 测试3：测试Fabric启动命令生成 ===
    console.log("\n=== 测试3：测试Fabric启动命令生成 ===");
    try {
        const fabricVersion = "1.21.5-Fabric0.16.14";
        const fabricVersionJsonPath = path.join(dataPath, "versions", fabricVersion, `${fabricVersion}.json`);
        const fabricClientJarPath = path.join(dataPath, "versions", fabricVersion, `${fabricVersion}.jar`);

        if (!fs.existsSync(fabricVersionJsonPath) || !fs.existsSync(fabricClientJarPath)) {
            console.log(`Fabric 版本文件或客户端JAR不存在，请先下载: ${fabricVersionJsonPath}, ${fabricClientJarPath}`);
            return;
        }

        const fabricLaunchOptions: LaunchOptions = {
            version: fabricVersion,
            gameDirectory: dataPath,
            javaPath: "java",
            accessToken: "test_token",
            uuid: "test_uuid",
            username: "test_player",
            width: 854,
            height: 480,
            vmOptions: [],
            gameOptions: [],
            minMemory: 1024,
            maxMemory: 2048,
        };

        const fabricLauncher = new GameLauncher(dataPath);
        console.log("Fabric 启动准备进度: 0%");
        const fabricCommand = await fabricLauncher.generateLaunchCommand(fabricLaunchOptions, (progress, total, percentage) => {
            console.log(`Fabric 启动准备进度: ${Math.round(percentage)}%`);
        });
        console.log("✓ Fabric 启动命令构建成功!");
        console.log("Fabric 启动命令:", fabricCommand);
    } catch (error) {
        console.error("✗ Fabric 启动命令构建失败:", error);
    }

    // === 测试4：测试Forge启动命令生成 ===
    console.log("\n=== 测试4：测试Forge启动命令生成 ===");
    try {
        const forgeVersion = "1.21.5-Forge_55.0.22";
        const forgeVersionJsonPath = path.join(dataPath, "versions", forgeVersion, `${forgeVersion}.json`);
        const forgeClientJarPath = path.join(dataPath, "versions", forgeVersion, `${forgeVersion}.jar`);

        if (!fs.existsSync(forgeVersionJsonPath) || !fs.existsSync(forgeClientJarPath)) {
            console.log(`Forge 版本文件或客户端JAR不存在，请先下载: ${forgeVersionJsonPath}, ${forgeClientJarPath}`);
            return;
        }

        const forgeLaunchOptions: LaunchOptions = {
            version: forgeVersion,
            gameDirectory: dataPath,
            javaPath: "java",
            accessToken: "0",
            uuid: "test_uuid",
            username: "test_player",
            width: 854,
            height: 480,
            vmOptions: [],
            gameOptions: [],
            minMemory: 1024,
            maxMemory: 2048,
        };

        const forgeLauncher = new GameLauncher(dataPath);
        console.log("Forge 启动准备进度: 0%");
        const forgeCommand = await forgeLauncher.generateLaunchCommand(forgeLaunchOptions, (progress, total, percentage) => {
            console.log(`Forge 启动准备进度: ${Math.round(percentage)}%`);
        });
        console.log("✓ Forge 启动命令构建成功!");
        console.log("Forge 启动命令:", forgeCommand);
    } catch (error) {
        console.error("✗ Forge 启动命令构建失败:", error);
    }
}

runTests();


