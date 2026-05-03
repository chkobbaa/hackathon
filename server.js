const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static('public'));

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

let totalActiveFaucets = 0;

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  // Send current state to new clients
  socket.emit('faucet_state', { activeCount: totalActiveFaucets });

  socket.on('update_faucets', (data) => {
    totalActiveFaucets = data.activeCount;
    // Broadcast the new state to all connected clients
    io.emit('faucet_state', { activeCount: totalActiveFaucets });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
