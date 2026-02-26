import dotenv from 'dotenv';

dotenv.config();

const corsOriginRaw = process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:4200';
const corsOrigin = corsOriginRaw.includes(',')
  ? corsOriginRaw.split(',').map((s) => s.trim()).filter(Boolean)
  : corsOriginRaw;

export const config = {
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  corsOrigin,
  mongodbUri: process.env.MONGODB_URI || '',
};
