const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const statusPill = document.getElementById('status-pill');
const statusText = document.getElementById('status-text');

const popSlider = document.getElementById('pop-slider');
const popVal = document.getElementById('pop-val');
const autoBtn = document.getElementById('auto-btn');

// Connect to Socket.IO Server
const socket = io();

let serverState = {
    activeSinks: 0,
    activeShowers: 0,
    population: 20,
    autoMode: true
};

socket.on('connect', () => {
    statusPill.classList.add('status-connected');
    statusText.textContent = 'Connected to Node Server';
});

socket.on('disconnect', () => {
    statusPill.classList.remove('status-connected');
    statusText.textContent = 'Disconnected';
});

socket.on('config_sync', (config) => {
    popSlider.value = config.population;
    popVal.innerText = config.population;
    if (config.autoMode) {
        autoBtn.innerText = "Automatic AI is Running Backend";
        autoBtn.style.background = "rgba(0, 230, 118, 0.2)";
        autoBtn.style.color = "#00E676";
        autoBtn.style.borderColor = "#00E676";
    }
});

socket.on('faucet_state', (data) => {
    serverState = data;
    syncVisualRooms();
});

popSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    popVal.innerText = val;
    socket.emit('set_config', { population: parseInt(val) });
});

autoBtn.addEventListener('click', () => {
    socket.emit('set_config', { autoMode: true });
});

// Grid setup: 3x3 rooms (9 total)
const cols = 3;
const rows = 3;
const roomWidth = canvas.width / cols;
const roomHeight = canvas.height / rows;

class Room {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        // Sink area
        this.sink = {
            x: x + width / 2 - 40,
            y: y + 15,
            width: 80,
            height: 35
        };
        // Shower area (Left wall)
        this.shower = {
            x: x + 5,
            y: y + 15,
            width: 45,
            height: 55
        };
        this.isFaucetOn = false;
        this.isShowerOn = false;
        this.particles = [];
        this.showerParticles = [];
    }

    draw() {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(this.x, this.y, this.width, 15);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(this.x, this.y + 15, this.width, 2);

        // Draw Sink
        const s = this.sink;
        ctx.fillStyle = '#d4d4d8';
        ctx.beginPath();
        ctx.roundRect(s.x, s.y, s.width, s.height, 4);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(s.x + s.width/2, s.y + 18, 20, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.arc(s.x + s.width/2, s.y + 4, 5, 0, Math.PI * 2);
        ctx.fill();

        // Draw Shower Cabin
        const sh = this.shower;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.roundRect(sh.x, sh.y, sh.width, sh.height, 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.strokeRect(sh.x, sh.y, sh.width, sh.height);
        // Shower head
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.arc(sh.x + sh.width/2, sh.y + 10, 6, 0, Math.PI);
        ctx.fill();

        // Status lights
        ctx.fillStyle = this.isFaucetOn ? '#38bdf8' : '#10b981';
        ctx.beginPath();
        ctx.arc(s.x + 8, s.y + 8, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = this.isShowerOn ? '#38bdf8' : '#10b981';
        ctx.beginPath();
        ctx.arc(sh.x + 8, sh.y + 8, 2, 0, Math.PI * 2);
        ctx.fill();

        // Particles
        this.particles.forEach(p => {
            const opacity = p.life;
            ctx.fillStyle = `rgba(56, 189, 248, ${opacity})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
            ctx.fill();
        });

        this.showerParticles.forEach(p => {
            ctx.fillStyle = `rgba(56, 189, 248, ${p.life})`;
            ctx.fillRect(p.x, p.y, 2, 6);
        });
    }

    updateParticles() {
        if (this.isFaucetOn) {
            for(let i=0; i<2; i++) {
                this.particles.push({
                    x: this.sink.x + this.sink.width / 2 + (Math.random() * 3 - 1.5),
                    y: this.sink.y + 14,
                    vx: (Math.random() - 0.5) * 0.8,
                    vy: Math.random() * 1.5 + 1.5,
                    life: 1.0
                });
            }
        }
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.05;
            if (p.life <= 0) this.particles.splice(i, 1);
        }

        if (this.isShowerOn) {
            for(let i=0; i<6; i++) { // Heavy flow
                this.showerParticles.push({
                    x: this.shower.x + 5 + Math.random() * (this.shower.width - 10),
                    y: this.shower.y + 12,
                    vy: Math.random() * 2 + 4,
                    life: 1.0
                });
            }
        }
        for (let i = this.showerParticles.length - 1; i >= 0; i--) {
            let p = this.showerParticles[i];
            p.y += p.vy;
            p.life -= 0.05;
            if (p.life <= 0) this.showerParticles.splice(i, 1);
        }
    }
}

class Person {
    constructor(room) {
        this.room = room;
        this.radius = 10;
        this.x = room.x + room.width / 2;
        this.y = room.y + room.height / 2;
        this.colorHead = ['#fcd34d', '#fca5a5', '#d8b4fe'][Math.floor(Math.random()*3)];
        this.colorBody = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'][Math.floor(Math.random()*5)];
        this.speed = 1.0 + Math.random();
        this.facingX = 0;
        this.facingY = -1;
    }

    update() {
        let targetX = this.x;
        let targetY = this.y;

        if (this.room.isShowerOn) {
            targetX = this.room.shower.x + this.room.shower.width / 2;
            targetY = this.room.shower.y + this.room.shower.height + 15;
        } else if (this.room.isFaucetOn) {
            targetX = this.room.sink.x + this.room.sink.width / 2;
            targetY = this.room.sink.y + this.room.sink.height + 15;
        } else {
            // Idle wander
            if (Math.random() < 0.01) {
                targetX = this.room.x + 20 + Math.random() * (this.room.width - 40);
                targetY = this.room.y + 40 + Math.random() * (this.room.height - 60);
            }
        }

        let dx = targetX - this.x;
        let dy = targetY - this.y;
        let dist = Math.hypot(dx, dy);

        if(dist > 5) {
            let vx = (dx / dist) * this.speed;
            let vy = (dy / dist) * this.speed;
            this.x += vx;
            this.y += vy;
            this.facingX = vx;
            this.facingY = vy;
        } else if (this.room.isShowerOn || this.room.isFaucetOn) {
            this.facingX = 0;
            this.facingY = -1; // face the wall
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        let angle = Math.atan2(this.facingY, this.facingX) + Math.PI/2;
        ctx.rotate(angle);

        ctx.fillStyle = this.colorBody;
        ctx.beginPath();
        ctx.roundRect(-14, -6, 28, 12, 6);
        ctx.fill();

        ctx.fillStyle = this.colorHead;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

const rooms = [];
const people = [];

for(let r=0; r<rows; r++) {
    for(let c=0; c<cols; c++) {
        let room = new Room(c * roomWidth, r * roomHeight, roomWidth, roomHeight);
        rooms.push(room);
        let person = new Person(room);
        people.push(person);
    }
}

// Sync visual rooms to match server math
function syncVisualRooms() {
    let activeSinksNeeded = Math.min(serverState.activeSinks, 9);
    let activeShowersNeeded = Math.min(serverState.activeShowers, 9);

    rooms.forEach(r => { r.isFaucetOn = false; r.isShowerOn = false; });

    let shuffled = rooms.slice().sort(() => 0.5 - Math.random());
    for(let i=0; i<activeShowersNeeded; i++) {
        shuffled[i].isShowerOn = true;
    }
    
    // Assign sinks to remaining rooms if possible
    let remaining = shuffled.filter(r => !r.isShowerOn);
    for(let i=0; i<Math.min(activeSinksNeeded, remaining.length); i++) {
        remaining[i].isFaucetOn = true;
    }
}

let totalFilteredWater = 0;
const reservoirCapacity = 300; 
function updateReservoirs() {
    let count = serverState.activeSinks + (serverState.activeShowers * 3);
    totalFilteredWater += count * 0.15;

    let activeReservoirIndex = Math.floor(totalFilteredWater / reservoirCapacity);
    
    for(let i=0; i<6; i++) {
        const res = document.getElementById(`reservoir-${i}`);
        if (!res) continue;
        res.classList.add('visible');
        
        let fillPercentage = 0;
        if (i < activeReservoirIndex) {
            fillPercentage = 100;
        } else if (i === activeReservoirIndex) {
            fillPercentage = ((totalFilteredWater % reservoirCapacity) / reservoirCapacity) * 100;
        }
        
        const waterLvl = document.getElementById(`water-level-${i}`);
        if (waterLvl) {
            waterLvl.style.height = `${fillPercentage}%`;
        }
    }
}

function update() {
    rooms.forEach(r => r.updateParticles());
    people.forEach(p => p.update());
    updateReservoirs();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    rooms.forEach(r => r.draw());
    people.forEach(p => p.draw());
    
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "16px Inter";
    ctx.fillText(`Simulating ${serverState.population} guests across the hotel network`, 10, canvas.height - 10);
}

function loop() {
    update();
    if (!document.hidden) {
        draw();
    }
}

const workerCode = `
  let interval;
  self.onmessage = function(e) {
    if (e.data === 'start') {
      interval = setInterval(() => self.postMessage('tick'), 16); 
    }
  };
`;
const blob = new Blob([workerCode], {type: 'application/javascript'});
const worker = new Worker(URL.createObjectURL(blob));

worker.onmessage = () => {
    loop();
};

worker.postMessage('start');
