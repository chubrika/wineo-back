import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';

const THUMBNAIL_SIZE = 400;
const IMAGE_SIZE = 800;
const JPEG_QUALITY = 85;
const MAX_IMAGES = 20;

let s3Client = null;

function getS3Client() {
  if (!s3Client) {
    const { accessKeyId, secretAccessKey, bucket, endpoint } = config.r2;
    if (!accessKeyId || !secretAccessKey || !bucket) {
      throw new Error('R2 credentials not configured (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)');
    }
    const region = 'auto';
    s3Client = new S3Client({
      region,
      endpoint: endpoint || `https://${config.r2.accountId || 'account'}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
  }
  return s3Client;
}

function getBucket() {
  const bucket = config.r2.bucket;
  if (!bucket) throw new Error('R2_BUCKET is required');
  return bucket;
}

/**
 * Generate presigned PUT URLs for temporary uploads.
 * Keys: temp/products/{userId}/{uuid}.jpg
 * @param {string} userId - Authenticated user id
 * @param {number} count - Number of URLs to generate (1..MAX_IMAGES)
 * @returns {Promise<{ key: string, uploadUrl: string }[]>}
 */
export async function getPresignedUploadUrls(userId, count) {
  const client = getS3Client();
  const bucket = getBucket();
  const safeCount = Math.min(Math.max(1, Number(count) || 1), MAX_IMAGES);
  const keys = [];
  for (let i = 0; i < safeCount; i++) {
    keys.push(`temp/products/${userId}/${uuidv4()}.jpg`);
  }
  const expiresIn = 15 * 60;
  const result = await Promise.all(
    keys.map(async (key) => {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: 'image/jpeg',
      });
      const uploadUrl = await getSignedUrl(client, command, { expiresIn });
      return { key, uploadUrl };
    })
  );
  return result;
}

/**
 * Resize image buffer with sharp. No disk I/O.
 * @param {Buffer} input - Raw image buffer
 * @param {{ width: number, height: number }} size
 * @returns {Promise<Buffer>}
 */
async function resizeTo(input, size) {
  return sharp(input)
    .resize(size.width, size.height, { fit: 'cover', position: 'center' })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}

/**
 * Get object body from R2 as buffer (no disk).
 */
async function getObjectBuffer(key) {
  const client = getS3Client();
  const bucket = getBucket();
  const response = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Upload buffer to R2 (no disk).
 */
async function putObjectBuffer(key, buffer, contentType = 'image/jpeg') {
  const client = getS3Client();
  const bucket = getBucket();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
}

/**
 * Delete object from R2.
 */
async function deleteObject(key) {
  const client = getS3Client();
  const bucket = getBucket();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/**
 * Build public URL for a product image key.
 */
function publicUrlForKey(key) {
  const base = (config.r2.publicUrl || '').replace(/\/$/, '');
  if (!base) throw new Error('R2_PUBLIC_URL is required for product image URLs');
  return `${base}/${key}`;
}

/**
 * Process temp images into product folder: resize, upload to final paths, delete temp.
 * - First image → thumbnail.jpg (400x400) and image-1.jpg (800x800)
 * - Other images → image-2.jpg, image-3.jpg, ... (800x800)
 * All work in memory (no server disk). Returns { thumbnailUrl, imageUrls }.
 * @param {string} productId - Mongo ObjectId string
 * @param {string[]} tempKeys - Ordered list of R2 keys (temp/products/...)
 */
export async function processProductImages(productId, tempKeys) {
  if (!Array.isArray(tempKeys) || tempKeys.length === 0) {
    return { thumbnailUrl: null, imageUrls: [] };
  }
  const publicUrl = config.r2.publicUrl?.replace(/\/$/, '');
  if (!publicUrl) throw new Error('R2_PUBLIC_URL is required');

  const prefix = `products/${productId}`;
  const thumbnailKey = `${prefix}/thumbnail.jpg`;
  const imageKeys = tempKeys.map((_, i) => `${prefix}/image-${i + 1}.jpg`);
  const thumbnailUrl = `${publicUrl}/${thumbnailKey}`;
  const imageUrls = imageKeys.map((k) => `${publicUrl}/${k}`);

  for (let i = 0; i < tempKeys.length; i++) {
    const tempKey = tempKeys[i];
    const rawBuffer = await getObjectBuffer(tempKey);

    if (i === 0) {
      const thumbBuffer = await resizeTo(rawBuffer, { width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE });
      await putObjectBuffer(thumbnailKey, thumbBuffer);
      const img1Buffer = await resizeTo(rawBuffer, { width: IMAGE_SIZE, height: IMAGE_SIZE });
      await putObjectBuffer(imageKeys[0], img1Buffer);
    } else {
      const imgBuffer = await resizeTo(rawBuffer, { width: IMAGE_SIZE, height: IMAGE_SIZE });
      await putObjectBuffer(imageKeys[i], imgBuffer);
    }

    await deleteObject(tempKey);
  }

  return { thumbnailUrl, imageUrls };
}

/**
 * Append temp images to an existing product (for PUT /products/:id).
 * Writes image-{startIndex+1}.jpg, ... (800x800). No thumbnail update.
 */
export async function processProductImagesAppend(productId, tempKeys, startIndex = 0) {
  if (!Array.isArray(tempKeys) || tempKeys.length === 0) return [];
  const publicUrl = config.r2.publicUrl?.replace(/\/$/, '');
  if (!publicUrl) throw new Error('R2_PUBLIC_URL is required');
  const prefix = `products/${productId}`;
  const imageUrls = [];
  for (let i = 0; i < tempKeys.length; i++) {
    const tempKey = tempKeys[i];
    const rawBuffer = await getObjectBuffer(tempKey);
    const idx = startIndex + i + 1;
    const imageKey = `${prefix}/image-${idx}.jpg`;
    const imgBuffer = await resizeTo(rawBuffer, { width: IMAGE_SIZE, height: IMAGE_SIZE });
    await putObjectBuffer(imageKey, imgBuffer);
    await deleteObject(tempKey);
    imageUrls.push(`${publicUrl}/${imageKey}`);
  }
  return imageUrls;
}
