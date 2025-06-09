import fs from 'fs-extra';
import path from 'path';
import http from 'http';
import https from 'https';
import { URL } from 'url';
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
   * @param expectedSha1 预期的SHA1值（可选 ）
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
      
      // 选择协议
      const protocol = url.startsWith('https:') ? https : http;
      
      return new Promise<boolean>((resolve, reject ) => {
        const request = protocol.get(url, (response) => {
          // 处理重定向
          if ([301, 302, 303, 307, 308].includes(response.statusCode || 0)) {
            const location = response.headers.location;
            if (!location) {
              return reject(new Error('找不到重定向地址'));
            }
            const redirectUrl = new URL(location, url).toString();
            response.resume(); // 消耗响应体
            
            // 递归调用处理重定向
            this.downloadFile(redirectUrl, filePath, expectedSha1, onProgress)
              .then(resolve)
              .catch(reject);
            return;
          }
          
          // 检查状态码
          if (response.statusCode !== 200) {
            response.resume(); // 消耗响应体
            return reject(new Error(`下载失败，状态码：${response.statusCode}`));
          }
          
          // 获取文件大小
          const totalSize = parseInt(response.headers['content-length'] || '0', 10);
          let downloadedSize = 0;
          
          // 创建写入流
          const writer = fs.createWriteStream(filePath, { flags: 'w' });
          
          // 创建SHA1哈希对象（如果需要验证）
          const hash = expectedSha1 ? crypto.createHash('sha1') : null;
          
          // 处理数据块
          response.on('data', (chunk: Buffer) => {
            downloadedSize += chunk.length;
            
            // 更新SHA1
            if (hash) {
              hash.update(chunk);
            }
            
            // 更新进度
            if (onProgress && totalSize > 0) {
              const percentage = Math.floor((downloadedSize / totalSize) * 100);
              onProgress(downloadedSize, totalSize, percentage);
            }
          });
          
          // 将响应流导入文件
          response.pipe(writer);
          
          // 处理写入完成
          writer.on('finish', async () => {
            // 验证SHA1（如果提供）
            if (expectedSha1 && hash) {
              const actualSha1 = hash.digest('hex');
              if (actualSha1.toLowerCase() !== expectedSha1.toLowerCase()) {
                try {
                  await fs.unlink(filePath);
                } catch (error) {
                  console.error(`删除校验失败的文件失败: ${filePath}`, error);
                }
                return reject(new Error(`文件SHA1校验失败: ${filePath}`));
              }
            }
            
            // 确保调用者能看到最后进度100%
            if (onProgress && totalSize > 0) {
              onProgress(totalSize, totalSize, 100);
            }
            
            resolve(true);
          });
          
          // 处理写入错误
          writer.on('error', (error) => {
            response.destroy();
            reject(error);
          });
          
          // 处理响应错误
          response.on('error', (error) => {
            writer.destroy();
            reject(error);
          });
        });
        
        // 处理请求错误
        request.on('error', (error) => {
          reject(error);
        });
        
        // 设置超时
        request.setTimeout(60000, () => { // 将超时时间增加到60秒
          request.destroy();
          reject(new Error('下载超时'));
        });
      });
      
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
   * @param verifySha1 是否验证SHA1
   * @returns 下载结果
   */
  public static async downloadFiles(
    downloads: Array<{
      url: string;
      filePath: string;
      sha1?: string;
      onProgress?: ProgressCallback;
    }>,
    maxConcurrent: number = 3,
    verifySha1: boolean = true
  ): Promise<{
    success: number;
    failed: number;
    results: Array<{ url: string; filePath: string; success: boolean }>;
  }> {
    const results: Array<{ url: string; filePath: string; success: boolean }> = [];
    let successCount = 0;
    let failedCount = 0;
    
    const downloadPromises: Promise<void>[] = [];
    let activeDownloads = 0;
    let currentIndex = 0;

    const processNext = async () => {
      if (currentIndex < downloads.length) {
        const download = downloads[currentIndex];
        currentIndex++;
        activeDownloads++;

        try {
          const success = await this.downloadFile(download.url, download.filePath, verifySha1 ? download.sha1 : undefined, download.onProgress);
          results.push({
            url: download.url,
            filePath: download.filePath,
            success
          });
          if (success) {
            successCount++;
          } else {
            failedCount++;
          }
        } catch (error) {
          results.push({
            url: download.url,
            filePath: download.filePath,
            success: false
          });
          failedCount++;
        } finally {
          activeDownloads--;
          processNext(); // 递归调用以处理下一个任务
        }
      }
    };

    // 启动初始的并发下载
    for (let i = 0; i < maxConcurrent && i < downloads.length; i++) {
      downloadPromises.push(processNext());
    }

    // 等待所有下载完成
    await new Promise<void>(resolve => {
      const checkCompletion = () => {
        if (activeDownloads === 0 && currentIndex === downloads.length) {
          resolve();
        } else {
          setTimeout(checkCompletion, 100); // 持续检查
        }
      };
      checkCompletion();
    });
    
    return {
      success: successCount,
      failed: failedCount,
      results
    };
  }
}


