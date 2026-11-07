import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import http from 'http';
import { Server } from 'socket.io';

import app from './app.js';
import { connectDB } from './config/db.js';
import { setupChatSocket } from './sockets/chatSocket.js';

const server = http.createServer(app);

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  process.env.CLIENT_URL,
].filter(Boolean);

// Configure Socket.io with locked down CORS (Item 12)
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS policy: Origin not allowed'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

// Socket.io initialization
setupChatSocket(io);

const PORT = process.env.PORT || 5000;

// Connect to MongoDB Atlas and start server
const startServer = async () => {
  try {
    await connectDB();
    console.log(`🍃 MongoDB Atlas connection established successfully`);
  } catch (err) {
    console.error(`❌ MongoDB Atlas connection error: ${err.message}`);
    console.warn(`⚠️ Starting server in standby mode; operations requiring database will retry.`);
  }

  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 ChatRooms Backend Server running on port ${PORT}`);
    console.log(`📡 Socket.io ready for realtime communication`);
    console.log(`🌐 Health check available at: http://localhost:${PORT}/api/health`);
    console.log(`=======================================================`);
  });
};

startServer();

export { app, server, io };
