import mongoose from 'mongoose';
import { config } from './config.js';

export async function connectDb() {
  if (!config.mongodbUri) {
    throw new Error('MONGODB_URI is not set in .env');
  }
  await mongoose.connect(config.mongodbUri);
  console.log('MongoDB connected');
}
