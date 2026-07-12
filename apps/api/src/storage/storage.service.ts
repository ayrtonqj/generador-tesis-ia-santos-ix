import { Injectable, Logger } from '@nestjs/common';
import * as Minio from 'minio';
import { Readable } from 'stream';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client: Minio.Client;
  private bucket: string;

  constructor() {
    this.client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
      // ⚠ En producción, MINIO_ACCESS_KEY y MINIO_SECRET_KEY deben configurarse vía .env
    });
    this.bucket = process.env.MINIO_BUCKET || 'thesis-documents';
    this.ensureBucket();
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
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': contentType,
    });
    this.logger.log(`Uploaded: ${key} (${buffer.length} bytes)`);
    return key;
  }

  async download(key: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, key);
    return this.streamToBuffer(stream);
  }

  async getPresignedUrl(key: string, expirySeconds = 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucket, key, expirySeconds);
  }

  async delete(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
    this.logger.log(`Deleted: ${key}`);
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
