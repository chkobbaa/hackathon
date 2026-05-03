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

let filters = Array.from({length: 9}, (_, i) => ({ id: i + 1, status: 'OK' }));

// Server-side continuous simulation
setInterval(() => {
    let activeSinks = manualSinks;
    let activeShowers = manualShowers;

    // Simulate filter failures (for demo purposes)
    if (Math.random() < 0.05) { // 5% chance every second
        const okFilters = filters.filter(f => f.status === 'OK');
        if (okFilters.length > 0) {
            // Keep at least 6 filters healthy so it doesn't instantly break everything
            if (okFilters.length > 6) {
                const randomFilter = okFilters[Math.floor(Math.random() * okFilters.length)];
                randomFilter.status = 'NEEDS_SERVICE';
            }
        }
    }

    if (config.autoMode) {
        people.forEach(p => {
            if (p.state === 'idle') {
                p.timer--;
                if (p.timer <= 0) {
                    let rand = Math.random();
                    if (rand < 0.05) { 
                        p.state = 'shower';
                        p.timer = 60 + Math.random() * 120; 
                    } else if (rand < 0.25) { 
                        p.state = 'sink';
                        p.timer = 5 + Math.random() * 15; 
                    } else {
                        p.timer = 10 + Math.random() * 30; 
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
        autoMode: config.autoMode,
        filters
    });
}, 1000); // 1 tick = 1 second

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.emit('config_sync', config);

    socket.on('set_config', (data) => {
        if (data.population !== undefined) {
            config.population = data.population;
            initPeople();
            io.emit('config_sync', config); 
        }
        if (data.autoMode !== undefined) {
            config.autoMode = data.autoMode;
            io.emit('config_sync', config);
        }
    });

    socket.on('fix_filter', (data) => {
        const f = filters.find(f => f.id === data.id);
        if (f) {
            f.status = 'OK';
            io.emit('faucet_state', { activeSinks: manualSinks, activeShowers: manualShowers, population: config.population, autoMode: config.autoMode, filters });
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
