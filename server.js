const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static('public'));

const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

let config = {
    population: 20,
    autoMode: true
};

let people = [];
function initPeople() {
    people = Array.from({length: config.population}, () => ({ 
        state: 'idle', 
        timer: Math.random() * 20 
    }));
}
initPeople();

let manualSinks = 0;
let manualShowers = 0;

// Server-side continuous simulation
setInterval(() => {
    let activeSinks = manualSinks;
    let activeShowers = manualShowers;

    if (config.autoMode) {
        people.forEach(p => {
            if (p.state === 'idle') {
                p.timer--;
                if (p.timer <= 0) {
                    let rand = Math.random();
                    if (rand < 0.05) { // 5% chance for shower (less often)
                        p.state = 'shower';
                        p.timer = 60 + Math.random() * 120; // 1-3 minutes (far longer times)
                    } else if (rand < 0.25) { // 20% chance for sink
                        p.state = 'sink';
                        p.timer = 5 + Math.random() * 15; // 5-20 seconds
                    } else {
                        p.timer = 10 + Math.random() * 30; // Stay idle
                    }
                }
            } else if (p.state === 'sink') {
                activeSinks++;
                p.timer--;
                if (p.timer <= 0) { p.state = 'idle'; p.timer = 15 + Math.random() * 30; }
            } else if (p.state === 'shower') {
                activeShowers++;
                p.timer--;
                if (p.timer <= 0) { p.state = 'idle'; p.timer = 120 + Math.random() * 300; }
            }
        });
    }

    io.emit('faucet_state', { 
        activeSinks, 
        activeShowers, 
        population: config.population,
        autoMode: config.autoMode
    });
}, 1000); // 1 tick = 1 second

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Sync UI with current config
    socket.emit('config_sync', config);

    socket.on('set_config', (data) => {
        if (data.population !== undefined) {
            config.population = data.population;
            initPeople();
            io.emit('config_sync', config); // Broadcast to all clients
        }
        if (data.autoMode !== undefined) {
            config.autoMode = data.autoMode;
            io.emit('config_sync', config);
        }
    });

    socket.on('update_manual', (data) => {
        if (data.sinks !== undefined) manualSinks = data.sinks;
        if (data.showers !== undefined) manualShowers = data.showers;
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        // We DON'T reset the simulation. It keeps running!
        manualSinks = 0;
        manualShowers = 0;
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
