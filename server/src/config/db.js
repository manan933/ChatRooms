import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

// Ensure DNS servers resolve SRV records reliably on Windows & Node.js
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // If not supported in environment, continue with default
}

export const connectDB = async (retries = 5, delay = 2000) => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error('MONGO_URI is not defined in environment variables.');
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
      });

      console.log(`[MongoDB Atlas] Connected successfully to host: ${conn.connection.host}`);
      console.log(`[MongoDB Atlas] Database Name: ${conn.connection.name}`);
      return conn;
    } catch (error) {
      console.warn(`[MongoDB Atlas] Connection attempt ${attempt} of ${retries} failed: ${error.message}`);
      if (attempt < retries) {
        console.log(`[MongoDB Atlas] Retrying in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(`[MongoDB Atlas] All ${retries} connection attempts failed.`);
        throw error;
      }
    }
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB Atlas] Disconnected from MongoDB Atlas.');
});

mongoose.connection.on('error', (err) => {
  console.error('[MongoDB Atlas] Connection event error:', err.message);
});

export default connectDB;
