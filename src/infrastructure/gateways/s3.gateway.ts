import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import { injectable } from 'tsyringe';
import {
  IS3Gateway,
  S3DownloadOptions,
  S3UploadOptions,
  S3UploadFromBufferOptions,
} from './s3.gateway.interface';
import { logS3Operation, logError } from '../monitoring';

@injectable()
export class S3Gateway implements IS3Gateway {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const region = process.env.AWS_REGION || 'us-east-1';
    this.bucket = process.env.AWS_S3_BUCKET || '';

    if (!this.bucket) {
      throw new Error('AWS_S3_BUCKET environment variable is required');
    }

    this.client = new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    logS3Operation('init', `Initialized with bucket: ${this.bucket}, region: ${region}`, {
      bucket: this.bucket,
      region,
    });
  }

  async downloadFromUrl(options: S3DownloadOptions): Promise<void> {
    const { url, destinationPath } = options;

    logS3Operation('download.url', `Downloading from URL to: ${destinationPath}`, {
      destinationPath,
    });

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to download from S3: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const dir = path.dirname(destinationPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(destinationPath, buffer);
      logS3Operation('download.completed', `Download completed: ${destinationPath}`, {
        destinationPath,
      });
    } catch (error) {
      logError(error, 'S3Gateway.downloadFromUrl', { url, destinationPath });
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`S3 download failed: ${errorMsg}`);
    }
  }

  async listFiles(prefix: string): Promise<string[]> {
    try {
      logS3Operation('list.files', `Listing files with prefix: ${prefix}`, { prefix });

      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
      });

      const response = await this.client.send(command);
      const keys = response.Contents?.map((obj) => obj.Key || '') || [];

      logS3Operation('list.completed', `Found ${keys.length} files`, {
        prefix,
        count: keys.length,
      });
      return keys;
    } catch (error) {
      logError(error, 'S3Gateway.listFiles', { prefix });
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`S3 list failed: ${errorMsg}`);
    }
  }

  async downloadByKey(s3Key: string, destinationPath: string): Promise<void> {
    logS3Operation('download.key', `Downloading ${s3Key} to ${destinationPath}`, {
      s3Key,
      destinationPath,
    });

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        throw new Error('Empty response body from S3');
      }

      const dir = path.dirname(destinationPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const stream = response.Body as Readable;
      const writeStream = fs.createWriteStream(destinationPath);

      await new Promise<void>((resolve, reject) => {
        stream.pipe(writeStream);
        stream.on('error', reject);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      logS3Operation('download.key.completed', `Download completed: ${destinationPath}`, {
        s3Key,
        destinationPath,
      });
    } catch (error) {
      logError(error, 'S3Gateway.downloadByKey', { s3Key, destinationPath });
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`S3 download failed: ${errorMsg}`);
    }
  }

  async uploadFile(options: S3UploadOptions): Promise<string> {
    const { filePath, s3Key, contentType } = options;

    logS3Operation('upload.file', `Uploading ${filePath} to s3://${this.bucket}/${s3Key}`, {
      filePath,
      s3Key,
      bucket: this.bucket,
    });

    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const fileBuffer = fs.readFileSync(filePath);
      const fileStats = fs.statSync(filePath);

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: contentType || this.getContentType(filePath),
      });

      await this.client.send(command);

      logS3Operation('upload.file.completed', `Upload completed: ${s3Key}`, {
        s3Key,
        sizeMB: (fileStats.size / 1e6).toFixed(2),
      });

      return s3Key;
    } catch (error) {
      logError(error, 'S3Gateway.uploadFile', { filePath, s3Key });
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`S3 upload failed: ${errorMsg}`);
    }
  }

  async uploadFromBuffer(options: S3UploadFromBufferOptions): Promise<string> {
    const { buffer, s3Key, contentType } = options;

    logS3Operation('upload.buffer', `Uploading buffer to s3://${this.bucket}/${s3Key}`, {
      s3Key,
      bucket: this.bucket,
    });

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        Body: buffer,
        ContentType: contentType || 'application/octet-stream',
      });

      await this.client.send(command);

      logS3Operation('upload.buffer.completed', `Upload from buffer completed: ${s3Key}`, {
        s3Key,
        sizeMB: (buffer.length / 1e6).toFixed(2),
      });

      return s3Key;
    } catch (error) {
      logError(error, 'S3Gateway.uploadFromBuffer', { s3Key });
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`S3 upload failed: ${errorMsg}`);
    }
  }

  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.zip': 'application/zip',
      '.json': 'application/json',
      '.txt': 'text/plain',
    };

    return contentTypes[ext] || 'application/octet-stream';
  }

  static extractKeyFromUrl(presignedUrl: string): string | null {
    try {
      const url = new URL(presignedUrl);
      const pathname = url.pathname;
      const key = pathname.startsWith('/') ? pathname.substring(1) : pathname;
      return key || null;
    } catch {
      return null;
    }
  }

  static parseS3Uri(s3Uri: string): { bucket: string; key: string } | null {
    try {
      if (!s3Uri.startsWith('s3://')) {
        throw new Error('Invalid S3 URI format. Must start with s3://');
      }

      const withoutProtocol = s3Uri.substring(5);
      const firstSlashIndex = withoutProtocol.indexOf('/');

      if (firstSlashIndex === -1) {
        return { bucket: withoutProtocol, key: '' };
      }

      const bucket = withoutProtocol.substring(0, firstSlashIndex);
      const key = withoutProtocol.substring(firstSlashIndex + 1);

      return { bucket, key };
    } catch {
      return null;
    }
  }

  async listFilesByUri(s3Uri: string): Promise<string[]> {
    const parsed = S3Gateway.parseS3Uri(s3Uri);

    if (!parsed) {
      throw new Error(`Invalid S3 URI: ${s3Uri}`);
    }

    logS3Operation('list.uri', `Listing files in s3://${parsed.bucket}/${parsed.key}`, {
      bucket: parsed.bucket,
      key: parsed.key,
    });

    try {
      const command = new ListObjectsV2Command({
        Bucket: parsed.bucket,
        Prefix: parsed.key,
      });

      const response = await this.client.send(command);
      const keys = response.Contents?.map((obj) => obj.Key || '') || [];

      logS3Operation('list.uri.completed', `Found ${keys.length} files`, {
        bucket: parsed.bucket,
        key: parsed.key,
        count: keys.length,
      });
      return keys;
    } catch (error) {
      logError(error, 'S3Gateway.listFilesByUri', { s3Uri });
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`S3 list failed: ${errorMsg}`);
    }
  }

  async downloadFolder(s3Uri: string, destinationDir: string): Promise<string[]> {
    const parsed = S3Gateway.parseS3Uri(s3Uri);

    if (!parsed) {
      throw new Error(`Invalid S3 URI: ${s3Uri}`);
    }

    logS3Operation(
      'download.folder',
      `Downloading folder s3://${parsed.bucket}/${parsed.key} to ${destinationDir}`,
      { bucket: parsed.bucket, key: parsed.key, destinationDir }
    );

    const keys = await this.listFilesByUri(s3Uri);
    const fileKeys = keys.filter((key) => !key.endsWith('/'));

    if (fileKeys.length === 0) {
      logS3Operation('download.folder.empty', `No files found in ${s3Uri}`, { s3Uri });
      return [];
    }

    const downloadedFiles: string[] = [];

    for (const key of fileKeys) {
      const fileName = path.basename(key);
      const localPath = path.join(destinationDir, fileName);

      await this.downloadByKey(key, localPath);
      downloadedFiles.push(localPath);
    }

    logS3Operation('download.folder.completed', `Downloaded ${downloadedFiles.length} files`, {
      count: downloadedFiles.length,
    });
    return downloadedFiles;
  }

  async uploadFileToUri(filePath: string, s3Uri: string, contentType?: string): Promise<string> {
    const parsed = S3Gateway.parseS3Uri(s3Uri);

    if (!parsed) {
      throw new Error(`Invalid S3 URI: ${s3Uri}`);
    }

    const fileName = path.basename(filePath);
    const s3Key = parsed.key + fileName;

    logS3Operation('upload.uri', `Uploading ${fileName} to s3://${parsed.bucket}/${s3Key}`, {
      fileName,
      s3Key,
      bucket: parsed.bucket,
    });

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileBuffer = fs.readFileSync(filePath);

    const command = new PutObjectCommand({
      Bucket: parsed.bucket,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: contentType || this.getContentType(filePath),
    });

    await this.client.send(command);

    logS3Operation('upload.uri.completed', `Upload completed: ${s3Key}`, { s3Key });
    return s3Key;
  }
}
