import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { Readable } from 'stream';

interface MinioConfig {
  endpoint: string;
  port: number;
  accessKey: string;
  secretKey: string;
  useSSL: boolean;
  bucket: string;
  publicUrl: string;
}

const DEFAULT_MINIO_CONFIG: MinioConfig = {
  endpoint: 'localhost',
  port: 9000,
  accessKey: '',
  secretKey: '',
  useSSL: false,
  bucket: 'nova-space',
  publicUrl: '',
};

@Injectable()
export class UploadService implements OnModuleInit {
  private minioClient: Minio.Client;
  private bucketName: string;
  private endpoint: string;
  private port: number;
  private useSSL: boolean;
  private publicUrl: string;

  constructor(private configService: ConfigService) {
    const minioConfig =
      this.configService.get<MinioConfig>('app.minio') ?? DEFAULT_MINIO_CONFIG;
    this.bucketName = minioConfig.bucket;
    this.endpoint = minioConfig.endpoint;
    this.port = minioConfig.port;
    this.useSSL = minioConfig.useSSL;
    this.publicUrl = minioConfig.publicUrl;

    this.minioClient = new Minio.Client({
      endPoint: this.endpoint,
      port: this.port,
      useSSL: this.useSSL,
      accessKey: minioConfig.accessKey,
      secretKey: minioConfig.secretKey,
    });
  }

  async onModuleInit() {
    try {
      const bucketExists = await this.minioClient.bucketExists(this.bucketName);
      if (!bucketExists) {
        await this.minioClient.makeBucket(this.bucketName, 'cn-north-1');
        console.log(
          `[Upload] MinIO bucket "${this.bucketName}" created successfully`,
        );

        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucketName}/*`],
            },
          ],
        };
        await this.minioClient.setBucketPolicy(
          this.bucketName,
          JSON.stringify(policy),
        );
        console.log('[Upload] MinIO bucket policy set to public read');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error('[Upload] Error initializing MinIO bucket:', errorMessage);
    }
  }

  async uploadImage(
    file: Express.Multer.File,
    prefix = 'images',
  ): Promise<{
    url: string;
    filename: string;
    originalname: string;
    size: number;
    mimetype: string;
  }> {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const ext = file.originalname.split('.').pop();
    const filename = `${prefix}/${timestamp}-${randomStr}.${ext}`;

    await this.minioClient.putObject(
      this.bucketName,
      filename,
      Readable.from(file.buffer),
      file.size,
      {
        'Content-Type': file.mimetype,
      },
    );

    // 存储相对路径，前端各自拼接完整 URL
    // 格式: /minio/images/xxx.jpg
    const url = `/minio/${filename}`;

    return {
      url,
      filename,
      originalname: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    };
  }
}
