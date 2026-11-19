const WebSocket = require('ws');

class DuelSocketServer {
  constructor({ port = 8090 } = {}) {
    this.port = port;
    this.rooms = new Map();
    this.wss = null;
  }

  start() {
    if (this.wss) return;
    this.wss = new WebSocket.Server({ port: this.port });

    this.wss.on('connection', (ws) => {
      ws.on('message', (raw) => this._onMessage(ws, raw));
      ws.on('close', () => this._removeSocket(ws));
    });
  }

  _onMessage(ws, raw) {
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }

    if (payload.type === 'join-room' && payload.roomId) {
      this._joinRoom(ws, payload.roomId, payload.userId || 'anonymous');
      return;
    }

    if (payload.type === 'focus-status' && payload.roomId) {
      this._broadcast(payload.roomId, {
        type: 'duel-status',
        userId: payload.userId,
        focused: Boolean(payload.focused),
        ts: Date.now()
      });
    }
  }

  _joinRoom(ws, roomId, userId) {
    const room = this.rooms.get(roomId) || new Set();
    ws.__roomId = roomId;
    ws.__userId = userId;
    room.add(ws);
    this.rooms.set(roomId, room);

    this._broadcast(roomId, {
      type: 'duel-join',
      userId,
      ts: Date.now()
    });
  }

  _broadcast(roomId, message) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const encoded = JSON.stringify(message);

    for (const socket of room) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(encoded);
      }
    }
  }

  _removeSocket(ws) {
    const roomId = ws.__roomId;
    if (!roomId || !this.rooms.has(roomId)) return;

    const room = this.rooms.get(roomId);
    room.delete(ws);
    if (!room.size) {
      this.rooms.delete(roomId);
      return;
    }

    this._broadcast(roomId, {
      type: 'duel-leave',
      userId: ws.__userId || 'anonymous',
      ts: Date.now()
    });
  }
}

module.exports = { DuelSocketServer };