import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

// 复用单例,避免每次冷启动都重建 client(Node runtime 下沿用 globalThis 缓存)
const globalForR2 = globalThis as unknown as {
  r2Client?: S3Client;
};

function getClient(): S3Client {
  if (globalForR2.r2Client) return globalForR2.r2Client;

  const client = new S3Client({
    region: 'auto',
    endpoint: requireEnv('R2_ENDPOINT'),
    credentials: {
      accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    },
  });

  if (process.env.NODE_ENV !== 'production') {
    globalForR2.r2Client = client;
  }
  return client;
}

// 标准化 key,去掉开头的斜杠和多余空白
function normalizeKey(key: string): string {
  return key.replace(/^\/+/, '').trim();
}

/**
 * 上传文件到 Cloudflare R2,返回永久公开链接。
 * 注意:公开链接需要在 R2 bucket 设置中绑定 Public Development URL 或自定义域名,
 * 并把对应地址配置到 R2_PUBLIC_URL。
 */
export async function uploadToR2(
  fileBuffer: Buffer | Uint8Array,
  fileName: string,
  contentType: string,
): Promise<string> {
  const key = normalizeKey(fileName);

  await getClient().send(
    new PutObjectCommand({
      Bucket: requireEnv('R2_BUCKET_NAME'),
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    }),
  );

  const publicBase = requireEnv('R2_PUBLIC_URL').replace(/\/+$/, '');
  return `${publicBase}/${key}`;
}
