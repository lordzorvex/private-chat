import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: true,
    methods: ["GET", "POST"]
  }
});

// In-memory storage (good enough for demo/small scale)
const users = new Map();         // socket.id → userId
const publicKeys = new Map();    // userId → publicKey

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  // 1. Client registers and sends its public key
  socket.on('register', ({ publicKey }) => {
    const userId = uuidv4();
    users.set(socket.id, userId);
    publicKeys.set(userId, publicKey);

    socket.emit('registered', {
      userId,
      publicKey
    });

    // Broadcast updated user list (optional - for UI improvement)
    io.emit('users', Array.from(publicKeys.entries()));
  });

  // 2. Request public key of another user
  socket.on('get-public-key', ({ targetUserId }) => {
    const pubKey = publicKeys.get(targetUserId);
    if (pubKey) {
      socket.emit('public-key-response', {
        userId: targetUserId,
        publicKey: pubKey
      });
    } else {
      socket.emit('error', { message: 'User not found' });
    }
  });

  // 3. Forward encrypted message
  socket.on('private-message', ({ to, encrypted }) => {
    const targetSocketId = [...users.entries()]
      .find(([_, id]) => id === to)?.[0];

    if (targetSocketId) {
      io.to(targetSocketId).emit('private-message', {
        from: users.get(socket.id),
        encrypted
      });
    }
  });

  socket.on('disconnect', () => {
    const userId = users.get(socket.id);
    if (userId) {
      users.delete(socket.id);
      publicKeys.delete(userId);
      io.emit('users', Array.from(publicKeys.entries()));
      console.log('User disconnected:', userId);
    }
  });
});

// Serve static files
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
