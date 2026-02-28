import dotenv from 'dotenv';

// Load base .env, then .env.development or .env.production if NODE_ENV is set
dotenv.config();
const nodeEnv = process.env.NODE_ENV;
if (nodeEnv === 'development' || nodeEnv === 'production') {
  dotenv.config({ path: `.env.${nodeEnv}` });
}

const corsOriginRaw = process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:4200,https://wineo.vercel.app,https://wineo.ge';
const corsOrigin = corsOriginRaw.includes(',')
  ? corsOriginRaw.split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean)
  : [corsOriginRaw.replace(/\/$/, '')].filter(Boolean);

export const config = {
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  corsOrigin,
  mongodbUri: process.env.MONGODB_URI || 'mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/wineo?retryWrites=true&w=majority',
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
