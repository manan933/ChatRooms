import { io } from 'socket.io-client';

const SOCKET_URL = typeof window !== 'undefined' ? window.location.origin : '';

class SocketService {
  constructor() {
    this.socket = null;
    this.joinedRooms = new Set();
  }

  connect() {
    const token = localStorage.getItem('chatrooms_token') || localStorage.getItem('zyntra_token');

    if (this.socket) {
      this.socket.auth = { token };
      if (!this.socket.connected) {
        this.socket.connect();
      }
      return this.socket;
    }

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2000,
      timeout: 10000,
      auth: { token },
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected with ID:', this.socket.id);
      // Re-join all active rooms on reconnect
      this.joinedRooms.forEach((roomId) => {
        this.socket.emit('join_room', roomId);
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      if (reason === 'io server disconnect') {
        // the disconnection was initiated by the server, reconnect manually
        this.socket.connect();
      }
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection warning:', err.message);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.joinedRooms.clear();
  }

  joinRoom(roomId) {
    if (!roomId) return;
    this.joinedRooms.add(roomId);
    if (this.socket && this.socket.connected) {
      this.socket.emit('join_room', roomId);
    } else {
      this.connect();
    }
  }

  leaveRoom(roomId) {
    if (!roomId) return;
    this.joinedRooms.delete(roomId);
    if (this.socket && this.socket.connected) {
      this.socket.emit('leave_room', roomId);
    }
  }

  sendMessage(data) {
    if (!this.socket || !this.socket.connected) {
      this.connect();
    }
    if (this.socket) {
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

  // WebRTC Calling Signaling Helpers
  callUser(data) {
    if (!this.socket || !this.socket.connected) this.connect();
    if (this.socket) {
      this.socket.emit('call_user', data);
    }
  }

  answerCall(data) {
    if (!this.socket || !this.socket.connected) this.connect();
    if (this.socket) {
      this.socket.emit('answer_call', data);
    }
  }

  sendIceCandidate(data) {
    if (!this.socket || !this.socket.connected) this.connect();
    if (this.socket) {
      this.socket.emit('ice_candidate', data);
    }
  }

  endCall(data) {
    if (this.socket) {
      this.socket.emit('end_call', data);
    }
  }

  rejectCall(data) {
    if (this.socket) {
      this.socket.emit('reject_call', data);
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
