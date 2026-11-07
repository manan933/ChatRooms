import { io } from 'socket.io-client';

const SOCKET_URL = '';

class SocketService {
  constructor() {
    this.socket = null;
    this.currentRoom = null;
  }

  connect() {
    if (this.socket && this.socket.connected) return this.socket;

    const token = localStorage.getItem('chatrooms_token') || localStorage.getItem('zyntra_token');

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      auth: { token },
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected with ID:', this.socket.id);
      if (this.currentRoom) {
        this.socket.emit('join_room', this.currentRoom);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentRoom = null;
  }

  joinRoom(roomId) {
    if (!roomId) return;
    if (this.currentRoom && this.currentRoom !== roomId) {
      this.leaveRoom(this.currentRoom);
    }
    this.currentRoom = roomId;
    if (this.socket && this.socket.connected) {
      this.socket.emit('join_room', roomId);
    }
  }

  leaveRoom(roomId) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('leave_room', roomId);
    }
    if (this.currentRoom === roomId) {
      this.currentRoom = null;
    }
  }

  sendMessage(data) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('send_message', data);
    }
  }

  sendReaction(data) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('send_reaction', data);
    }
  }

  startTyping(roomId, userName, userId) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('typing_start', { roomId, userName, userId });
    }
  }

  stopTyping(roomId, userId) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('typing_stop', { roomId, userId });
    }
  }

  on(event, handler) {
    if (!this.socket) this.connect();
    this.socket.on(event, handler);
  }

  off(event, handler) {
    if (this.socket) {
      this.socket.off(event, handler);
    }
  }
}

export const socketService = new SocketService();
export default socketService;
