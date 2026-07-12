import { Injectable, Logger } from '@nestjs/common';
import * as Minio from 'minio';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client!: Minio.Client;
  private bucket!: string;
  private isLocal = false;
  private localDir = path.resolve(process.cwd(), 'uploads');

  constructor() {
    const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
    if (endpoint === 'local' || endpoint.startsWith('temp-') || endpoint === 'none' || !endpoint) {
      this.isLocal = true;
      if (!fs.existsSync(this.localDir)) {
        fs.mkdirSync(this.localDir, { recursive: true });
      }
      this.logger.log(`Using local filesystem storage at: ${this.localDir}`);
    } else {
      this.client = new Minio.Client({
        endPoint: endpoint,
        port: parseInt(process.env.MINIO_PORT || '9000'),
        useSSL: process.env.MINIO_USE_SSL === 'true',
        accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
        secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
      });
      this.bucket = process.env.MINIO_BUCKET || 'thesis-documents';
      this.ensureBucket();
    }
  }

  getIsLocal(): boolean {
    return this.isLocal;
  }

  getLocalDir(): string {
    return this.localDir;
  }

  private async ensureBucket() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Bucket '${this.bucket}' created`);
      }
    } catch (error) {
      this.logger.warn(`Could not check/create bucket: ${error}`);
    }
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
    if (this.isLocal) {
      const filePath = path.join(this.localDir, key);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      await fs.promises.writeFile(filePath, buffer);
      this.logger.log(`Uploaded locally: ${key} (${buffer.length} bytes)`);
      return key;
    }

    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': contentType,
    });
    this.logger.log(`Uploaded to S3: ${key} (${buffer.length} bytes)`);
    return key;
  }

  async download(key: string): Promise<Buffer> {
    if (this.isLocal) {
      const filePath = path.join(this.localDir, key);
      return fs.promises.readFile(filePath);
    }

    const stream = await this.client.getObject(this.bucket, key);
    return this.streamToBuffer(stream);
  }

  async getPresignedUrl(key: string, expirySeconds = 3600): Promise<string> {
    if (this.isLocal) {
      const apiBase = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      return `${apiBase}/api/storage/file/${key}`;
    }

    return this.client.presignedGetObject(this.bucket, key, expirySeconds);
  }

  async delete(key: string): Promise<void> {
    if (this.isLocal) {
      const filePath = path.join(this.localDir, key);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        this.logger.log(`Deleted locally: ${key}`);
      }
      return;
    }

    await this.client.removeObject(this.bucket, key);
    this.logger.log(`Deleted from S3: ${key}`);
  }

  private streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }
}
