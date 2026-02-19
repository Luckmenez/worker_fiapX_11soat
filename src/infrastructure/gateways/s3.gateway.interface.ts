export interface S3DownloadOptions {
  url: string;
  destinationPath: string;
}

export interface S3UploadOptions {
  filePath: string;
  s3Key: string;
  contentType?: string;
}

export interface S3UploadFromBufferOptions {
  buffer: Buffer;
  s3Key: string;
  contentType?: string;
}

export interface IS3Gateway {
  downloadFromUrl(options: S3DownloadOptions): Promise<void>;
  downloadByKey(s3Key: string, destinationPath: string): Promise<void>;
  listFiles(prefix: string): Promise<string[]>;
  uploadFile(options: S3UploadOptions): Promise<string>;
  uploadFromBuffer(options: S3UploadFromBufferOptions): Promise<string>;
  listFilesByUri(s3Uri: string): Promise<string[]>;
  downloadFolder(s3Uri: string, destinationDir: string): Promise<string[]>;
  uploadFileToUri(filePath: string, s3Uri: string, contentType?: string): Promise<string>;
}
