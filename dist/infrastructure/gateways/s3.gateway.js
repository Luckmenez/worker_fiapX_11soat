"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var S3Gateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3Gateway = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const tsyringe_1 = require("tsyringe");
const monitoring_1 = require("../monitoring");
let S3Gateway = S3Gateway_1 = class S3Gateway {
    client;
    bucket;
    constructor() {
        const region = process.env.AWS_REGION || 'us-east-1';
        this.bucket = process.env.AWS_S3_BUCKET || '';
        if (!this.bucket) {
            throw new Error('AWS_S3_BUCKET environment variable is required');
        }
        this.client = new client_s3_1.S3Client({
            region,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
            },
        });
        (0, monitoring_1.logS3Operation)('init', `Initialized with bucket: ${this.bucket}, region: ${region}`, {
            bucket: this.bucket,
            region,
        });
    }
    async downloadFromUrl(options) {
        const { url, destinationPath } = options;
        (0, monitoring_1.logS3Operation)('download.url', `Downloading from URL to: ${destinationPath}`, {
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
            (0, monitoring_1.logS3Operation)('download.completed', `Download completed: ${destinationPath}`, {
                destinationPath,
            });
        }
        catch (error) {
            (0, monitoring_1.logError)(error, 'S3Gateway.downloadFromUrl', { url, destinationPath });
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`S3 download failed: ${errorMsg}`);
        }
    }
    async listFiles(prefix) {
        try {
            (0, monitoring_1.logS3Operation)('list.files', `Listing files with prefix: ${prefix}`, { prefix });
            const command = new client_s3_1.ListObjectsV2Command({
                Bucket: this.bucket,
                Prefix: prefix,
            });
            const response = await this.client.send(command);
            const keys = response.Contents?.map((obj) => obj.Key || '') || [];
            (0, monitoring_1.logS3Operation)('list.completed', `Found ${keys.length} files`, {
                prefix,
                count: keys.length,
            });
            return keys;
        }
        catch (error) {
            (0, monitoring_1.logError)(error, 'S3Gateway.listFiles', { prefix });
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`S3 list failed: ${errorMsg}`);
        }
    }
    async downloadByKey(s3Key, destinationPath) {
        (0, monitoring_1.logS3Operation)('download.key', `Downloading ${s3Key} to ${destinationPath}`, {
            s3Key,
            destinationPath,
        });
        try {
            const command = new client_s3_1.GetObjectCommand({
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
            const stream = response.Body;
            const writeStream = fs.createWriteStream(destinationPath);
            await new Promise((resolve, reject) => {
                stream.pipe(writeStream);
                stream.on('error', reject);
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });
            (0, monitoring_1.logS3Operation)('download.key.completed', `Download completed: ${destinationPath}`, {
                s3Key,
                destinationPath,
            });
        }
        catch (error) {
            (0, monitoring_1.logError)(error, 'S3Gateway.downloadByKey', { s3Key, destinationPath });
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`S3 download failed: ${errorMsg}`);
        }
    }
    async uploadFile(options) {
        const { filePath, s3Key, contentType } = options;
        (0, monitoring_1.logS3Operation)('upload.file', `Uploading ${filePath} to s3://${this.bucket}/${s3Key}`, {
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
            const command = new client_s3_1.PutObjectCommand({
                Bucket: this.bucket,
                Key: s3Key,
                Body: fileBuffer,
                ContentType: contentType || this.getContentType(filePath),
            });
            await this.client.send(command);
            (0, monitoring_1.logS3Operation)('upload.file.completed', `Upload completed: ${s3Key}`, {
                s3Key,
                sizeMB: (fileStats.size / 1e6).toFixed(2),
            });
            return s3Key;
        }
        catch (error) {
            (0, monitoring_1.logError)(error, 'S3Gateway.uploadFile', { filePath, s3Key });
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`S3 upload failed: ${errorMsg}`);
        }
    }
    async uploadFromBuffer(options) {
        const { buffer, s3Key, contentType } = options;
        (0, monitoring_1.logS3Operation)('upload.buffer', `Uploading buffer to s3://${this.bucket}/${s3Key}`, {
            s3Key,
            bucket: this.bucket,
        });
        try {
            const command = new client_s3_1.PutObjectCommand({
                Bucket: this.bucket,
                Key: s3Key,
                Body: buffer,
                ContentType: contentType || 'application/octet-stream',
            });
            await this.client.send(command);
            (0, monitoring_1.logS3Operation)('upload.buffer.completed', `Upload from buffer completed: ${s3Key}`, {
                s3Key,
                sizeMB: (buffer.length / 1e6).toFixed(2),
            });
            return s3Key;
        }
        catch (error) {
            (0, monitoring_1.logError)(error, 'S3Gateway.uploadFromBuffer', { s3Key });
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`S3 upload failed: ${errorMsg}`);
        }
    }
    getContentType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const contentTypes = {
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
    static extractKeyFromUrl(presignedUrl) {
        try {
            const url = new URL(presignedUrl);
            const pathname = url.pathname;
            const key = pathname.startsWith('/') ? pathname.substring(1) : pathname;
            return key || null;
        }
        catch (error) {
            return null;
        }
    }
    static parseS3Uri(s3Uri) {
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
        }
        catch (error) {
            return null;
        }
    }
    async listFilesByUri(s3Uri) {
        const parsed = S3Gateway_1.parseS3Uri(s3Uri);
        if (!parsed) {
            throw new Error(`Invalid S3 URI: ${s3Uri}`);
        }
        (0, monitoring_1.logS3Operation)('list.uri', `Listing files in s3://${parsed.bucket}/${parsed.key}`, {
            bucket: parsed.bucket,
            key: parsed.key,
        });
        try {
            const command = new client_s3_1.ListObjectsV2Command({
                Bucket: parsed.bucket,
                Prefix: parsed.key,
            });
            const response = await this.client.send(command);
            const keys = response.Contents?.map((obj) => obj.Key || '') || [];
            (0, monitoring_1.logS3Operation)('list.uri.completed', `Found ${keys.length} files`, {
                bucket: parsed.bucket,
                key: parsed.key,
                count: keys.length,
            });
            return keys;
        }
        catch (error) {
            (0, monitoring_1.logError)(error, 'S3Gateway.listFilesByUri', { s3Uri });
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`S3 list failed: ${errorMsg}`);
        }
    }
    async downloadFolder(s3Uri, destinationDir) {
        const parsed = S3Gateway_1.parseS3Uri(s3Uri);
        if (!parsed) {
            throw new Error(`Invalid S3 URI: ${s3Uri}`);
        }
        (0, monitoring_1.logS3Operation)('download.folder', `Downloading folder s3://${parsed.bucket}/${parsed.key} to ${destinationDir}`, { bucket: parsed.bucket, key: parsed.key, destinationDir });
        const keys = await this.listFilesByUri(s3Uri);
        const fileKeys = keys.filter((key) => !key.endsWith('/'));
        if (fileKeys.length === 0) {
            (0, monitoring_1.logS3Operation)('download.folder.empty', `No files found in ${s3Uri}`, { s3Uri });
            return [];
        }
        const downloadedFiles = [];
        for (const key of fileKeys) {
            const fileName = path.basename(key);
            const localPath = path.join(destinationDir, fileName);
            await this.downloadByKey(key, localPath);
            downloadedFiles.push(localPath);
        }
        (0, monitoring_1.logS3Operation)('download.folder.completed', `Downloaded ${downloadedFiles.length} files`, {
            count: downloadedFiles.length,
        });
        return downloadedFiles;
    }
    async uploadFileToUri(filePath, s3Uri, contentType) {
        const parsed = S3Gateway_1.parseS3Uri(s3Uri);
        if (!parsed) {
            throw new Error(`Invalid S3 URI: ${s3Uri}`);
        }
        const fileName = path.basename(filePath);
        const s3Key = parsed.key + fileName;
        (0, monitoring_1.logS3Operation)('upload.uri', `Uploading ${fileName} to s3://${parsed.bucket}/${s3Key}`, {
            fileName,
            s3Key,
            bucket: parsed.bucket,
        });
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        const fileBuffer = fs.readFileSync(filePath);
        const command = new client_s3_1.PutObjectCommand({
            Bucket: parsed.bucket,
            Key: s3Key,
            Body: fileBuffer,
            ContentType: contentType || this.getContentType(filePath),
        });
        await this.client.send(command);
        (0, monitoring_1.logS3Operation)('upload.uri.completed', `Upload completed: ${s3Key}`, { s3Key });
        return s3Key;
    }
};
exports.S3Gateway = S3Gateway;
exports.S3Gateway = S3Gateway = S3Gateway_1 = __decorate([
    (0, tsyringe_1.injectable)(),
    __metadata("design:paramtypes", [])
], S3Gateway);
//# sourceMappingURL=s3.gateway.js.map