import fs from 'fs-extra';
import path from 'path';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import crypto from 'crypto';
import { ProgressCallback } from '../types';

/**
 * 文件下载工具类
 */
export class FileDownloader {
  /**
   * 下载文件
   * @param url 下载URL
   * @param filePath 保存路径
   * @param expectedSha1 预期的SHA1值（可选）
   * @param onProgress 进度回调（可选）
   * @returns 下载结果
   */
  public static async downloadFile(
    url: string,
    filePath: string,
    expectedSha1?: string,
    onProgress?: ProgressCallback
  ): Promise<boolean> {
    try {
      // 确保目录存在
      await fs.ensureDir(path.dirname(filePath));
      
      // 检查文件是否已存在且SHA1匹配
      if (expectedSha1 && await this.validateFileSha1(filePath, expectedSha1)) {
        console.log(`文件已存在且SHA1匹配: ${filePath}`);
        return true;
      }
      
      // 设置请求配置
      const config: AxiosRequestConfig = {
        responseType: 'stream',
        timeout: 30000, // 30秒超时
        headers: {
          'User-Agent': 'minecraft-downloader-ts/1.0.0'
        }
      };
      
      // 发起请求
      const response: AxiosResponse = await axios.get(url, config);
      
      // 获取文件大小
      const totalSize = parseInt(response.headers['content-length'] || '0', 10);
      
      // 创建写入流
      const writer = fs.createWriteStream(filePath);
      
      // 下载进度变量
      let downloadedSize = 0;
      
      // 处理下载进度
      response.data.on('data', (chunk: Buffer) => {
        downloadedSize += chunk.length;
        
        if (onProgress && totalSize > 0) {
          const percentage = Math.floor((downloadedSize / totalSize) * 100);
          onProgress(downloadedSize, totalSize, percentage);
        }
      });
      
      // 将响应流写入文件
      response.data.pipe(writer);
      
      // 等待下载完成
      await new Promise<void>((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
        response.data.on('error', reject);
      });
      
      // 验证SHA1（如果提供）
      if (expectedSha1) {
        const isValid = await this.validateFileSha1(filePath, expectedSha1);
        if (!isValid) {
          console.error(`文件SHA1验证失败: ${filePath}`);
          await fs.unlink(filePath);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error(`下载文件失败: ${url}`, error);
      
      // 删除可能不完整的文件
      try {
        if (await fs.pathExists(filePath)) {
          await fs.unlink(filePath);
        }
      } catch (unlinkError) {
        console.error(`删除不完整文件失败: ${filePath}`, unlinkError);
      }
      
      return false;
    }
  }
  
  /**
   * 验证文件SHA1
   * @param filePath 文件路径
   * @param expectedSha1 预期的SHA1值
   * @returns 是否匹配
   */
  public static async validateFileSha1(filePath: string, expectedSha1: string): Promise<boolean> {
    try {
      // 检查文件是否存在
      if (!await fs.pathExists(filePath)) {
        return false;
      }
      
      // 计算文件SHA1
      const fileBuffer = await fs.readFile(filePath);
      const actualSha1 = crypto.createHash('sha1').update(fileBuffer).digest('hex');
      
      // 比较SHA1
      return actualSha1.toLowerCase() === expectedSha1.toLowerCase();
    } catch (error) {
      console.error(`验证文件SHA1失败: ${filePath}`, error);
      return false;
    }
  }
  
  /**
   * 并行下载多个文件
   * @param downloads 下载任务列表
   * @param maxConcurrent 最大并发数
   * @returns 下载结果
   */
  public static async downloadFiles(
    downloads: Array<{
      url: string;
      filePath: string;
      sha1?: string;
      onProgress?: ProgressCallback;
    }>,
    maxConcurrent: number = 3
  ): Promise<{
    success: number;
    failed: number;
    results: Array<{ url: string; filePath: string; success: boolean }>;
  }> {
    const results: Array<{ url: string; filePath: string; success: boolean }> = [];
    let successCount = 0;
    let failedCount = 0;
    
    // 创建下载队列
    const queue = [...downloads];
    const activeDownloads = new Set<string>();
    
    // 处理队列
    while (queue.length > 0 || activeDownloads.size > 0) {
      // 填充活动下载，直到达到最大并发数
      while (queue.length > 0 && activeDownloads.size < maxConcurrent) {
        const download = queue.shift()!;
        activeDownloads.add(download.url);
        
        // 执行下载
        this.downloadFile(download.url, download.filePath, download.sha1, download.onProgress)
          .then((success) => {
            results.push({
              url: download.url,
              filePath: download.filePath,
              success
            });
            
            if (success) {
              successCount += 1;
            } else {
              failedCount += 1;
            }
          })
          .catch(() => {
            results.push({
              url: download.url,
              filePath: download.filePath,
              success: false
            });
            failedCount += 1;
          })
          .finally(() => {
            activeDownloads.delete(download.url);
          });
      }
      
      // 等待一小段时间
      if (activeDownloads.size >= maxConcurrent || (queue.length === 0 && activeDownloads.size > 0)) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return {
      success: successCount,
      failed: failedCount,
      results
    };
  }
}

