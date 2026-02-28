import dotenv from 'dotenv';

dotenv.config();

const corsOriginRaw = process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:4200,https://wineo.vercel.app/';
const corsOrigin = corsOriginRaw.includes(',')
  ? corsOriginRaw.split(',').map((s) => s.trim()).filter(Boolean)
  : corsOriginRaw;

export const config = {
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  corsOrigin,
  mongodbUri: process.env.MONGODB_URI || '',
  // Cloudflare R2 (S3-compatible)
  r2: {
    accountId: process.env.R2_ACCOUNT_ID || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucket: process.env.R2_BUCKET || '',
    endpoint: process.env.R2_ENDPOINT || null,
    publicUrl: process.env.R2_PUBLIC_URL || '',
  },
};
