import mongoose from 'mongoose';
import { config } from './config.js';

export async function connectDb() {
  if (!config.mongodbUri) {
    throw new Error('MONGODB_URI is not set. Set it in .env locally or in your host\'s environment variables (e.g. Render → Environment).');
  }
  await mongoose.connect(config.mongodbUri);
  console.log('MongoDB connected');
}
