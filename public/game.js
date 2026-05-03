const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const statusPill = document.getElementById('status-pill');
const statusText = document.getElementById('status-text');

// Connect to Socket.IO Server
const socket = io();

socket.on('connect', () => {
    statusPill.classList.add('status-connected');
    statusText.textContent = 'Connected to Node';
});

socket.on('disconnect', () => {
    statusPill.classList.remove('status-connected');
    statusText.textContent = 'Disconnected';
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
        // Sink area relative to room
        this.sink = {
            x: x + width / 2 - 40, // Centered
            y: y + 15,
            width: 80,
            height: 35,
            counterColor: '#d4d4d8',
            sinkBowlColor: '#ffffff',
            faucetColor: '#94a3b8'
        };
        this.isFaucetOn = false;
        this.particles = [];
    }

    draw() {
        // Floor
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Walls
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);

        // Top wall trim
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(this.x, this.y, this.width, 15);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(this.x, this.y + 15, this.width, 2);

        // Draw Sink
        const s = this.sink;
        
        ctx.fillStyle = s.counterColor;
        ctx.beginPath();
        ctx.roundRect(s.x, s.y, s.width, s.height, 4);
        ctx.fill();
        
        // Bowl
        ctx.fillStyle = s.sinkBowlColor;
        ctx.beginPath();
        ctx.ellipse(s.x + s.width/2, s.y + 18, 20, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Drain
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(s.x + s.width/2, s.y + 20, 2, 0, Math.PI * 2);
        ctx.fill();

        // Faucet
        ctx.fillStyle = s.faucetColor;
        ctx.beginPath();
        ctx.arc(s.x + s.width/2, s.y + 4, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.roundRect(s.x + s.width/2 - 2.5, s.y + 4, 5, 10, 2);
        ctx.fill();

        // Filter status light
        ctx.fillStyle = this.isFaucetOn ? '#38bdf8' : '#10b981';
        ctx.beginPath();
        ctx.arc(s.x + 8, s.y + 8, 2, 0, Math.PI * 2);
        ctx.fill();
        if(this.isFaucetOn) {
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 4;
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Particles
        this.particles.forEach(p => {
            const opacity = p.life / p.maxLife;
            ctx.fillStyle = `rgba(56, 189, 248, ${opacity})`;
            ctx.beginPath();
            if(p.type === 'drop') {
                ctx.ellipse(p.x, p.y, 1, 2.5, 0, 0, Math.PI * 2);
            } else {
                ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
            }
            ctx.fill();
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
                    life: 1.0,
                    maxLife: 1.0,
                    type: 'drop'
                });
            }
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            
            if (p.type === 'drop' && p.y > this.sink.y + 20) {
                p.type = 'splash';
                p.vy = (Math.random() * -1.5) - 0.5;
                p.vx = (Math.random() - 0.5) * 2;
                p.life = 0.5;
                p.maxLife = 0.5;
            }

            p.life -= 0.05;
            if (p.life <= 0) this.particles.splice(i, 1);
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
        this.state = 'idle'; // idle, moving, moving_to_sink, washing
        this.targetX = this.x;
        this.targetY = this.y;
        this.timer = Math.random() * 100;
        this.isPlayer = false;
    }

    pickRandomTarget() {
        this.targetX = this.room.x + this.radius + Math.random() * (this.room.width - this.radius*2);
        this.targetY = this.room.y + 25 + this.radius + Math.random() * (this.room.height - 25 - this.radius*2);
    }

    update() {
        if(this.isPlayer) return;

        if(!isAutoMode) {
            if(this.state === 'washing') {
                this.room.isFaucetOn = false;
                reportActiveFaucets();
            }
            this.state = 'idle';
            return;
        }

        if(this.state === 'idle') {
            this.timer--;
            if(this.timer <= 0) {
                // LESS often to wash hands: 10% chance
                if(Math.random() < 0.1) {
                    this.state = 'moving_to_sink';
                    this.targetX = this.room.sink.x + this.room.sink.width / 2;
                    this.targetY = this.room.sink.y + this.room.sink.height + this.radius + 3;
                } else {
                    this.state = 'moving';
                    this.pickRandomTarget();
                }
            }
        } 
        else if (this.state === 'washing') {
            this.timer--;
            if(this.timer <= 0) {
                this.room.isFaucetOn = false;
                reportActiveFaucets();
                this.state = 'idle';
                // Idle longer after washing (5 to 15 seconds) -> 60 fps * 10 = 600
                this.timer = 300 + Math.random() * 600; 
            }
        }
        else {
            // Moving or moving_to_sink
            let dx = this.targetX - this.x;
            let dy = this.targetY - this.y;
            let dist = Math.hypot(dx, dy);

            if(dist < 5) {
                if(this.state === 'moving_to_sink') {
                    this.state = 'washing';
                    // Wash for a longer time: 4 to 10 seconds -> 60 fps * 7 = 420
                    this.timer = 240 + Math.random() * 360; 
                    this.room.isFaucetOn = true;
                    this.facingX = 0;
                    this.facingY = -1; // face sink
                    reportActiveFaucets();
                } else {
                    this.state = 'idle';
                    // Idle for 2-5 seconds
                    this.timer = 120 + Math.random() * 180; 
                }
            } else {
                let vx = (dx / dist) * this.speed;
                let vy = (dy / dist) * this.speed;
                this.x += vx;
                this.y += vy;
                this.facingX = vx;
                this.facingY = vy;
            }
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        let angle = Math.atan2(this.facingY, this.facingX) + Math.PI/2;
        ctx.rotate(angle);

        // Shoulders
        ctx.fillStyle = this.colorBody;
        ctx.beginPath();
        ctx.roundRect(-14, -6, 28, 12, 6);
        ctx.fill();

        // Head
        ctx.fillStyle = this.colorHead;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Hair
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(0, -this.radius + 3, 4, 0, Math.PI * 2);
        ctx.fill();

        if (this.isPlayer) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 3, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    }
}

const rooms = [];
const people = [];

// Initialize 3x3 grid (9 rooms)
for(let r=0; r<rows; r++) {
    for(let c=0; c<cols; c++) {
        let room = new Room(c * roomWidth, r * roomHeight, roomWidth, roomHeight);
        rooms.push(room);
        let person = new Person(room);
        if(r === 0 && c === 0) {
            person.isPlayer = true;
            person.colorBody = '#ec4899'; 
        }
        people.push(person);
    }
}

const player = people.find(p => p.isPlayer);

let isAutoMode = false;
document.getElementById('auto-btn').addEventListener('click', (e) => {
    isAutoMode = !isAutoMode;
    e.target.textContent = isAutoMode ? "Stop Automatic AI" : "Start Automatic AI";
    e.target.style.background = isAutoMode ? "#ef4444" : "#10b981";
});

function reportActiveFaucets() {
    let count = rooms.filter(r => r.isFaucetOn).length;
    socket.emit('update_faucets', { activeCount: count });
}

const keys = {
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
    w: false, s: false, a: false, d: false
};

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
    if (keys.hasOwnProperty(key)) keys[key] = true;
    
    // Interaction for player
    if (e.key === ' ' || e.key === 'Spacebar') {
        const r = player.room;
        const dist = Math.hypot((player.x) - (r.sink.x + r.sink.width/2), 
                                (player.y) - (r.sink.y + r.sink.height));
        if (dist < 40) {
            r.isFaucetOn = !r.isFaucetOn;
            reportActiveFaucets();
        }
    }
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
    if (keys.hasOwnProperty(key)) keys[key] = false;
});

// Reservoir Tracking
let totalFilteredWater = 0;
const maxReservoirs = 6;
const reservoirCapacity = 300; // units

function updateReservoirs() {
    // Fill speed based on active faucets
    let count = rooms.filter(r => r.isFaucetOn).length;
    totalFilteredWater += count * 0.15;

    let activeReservoirIndex = Math.floor(totalFilteredWater / reservoirCapacity);
    
    for(let i=0; i<maxReservoirs; i++) {
        const res = document.getElementById(`reservoir-${i}`);
        if (!res) continue;
        
        if (i <= activeReservoirIndex) {
            res.classList.add('visible');
        }
        
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
    let dx = 0, dy = 0;
    if (keys.ArrowUp || keys.w) dy -= player.speed * 2;
    if (keys.ArrowDown || keys.s) dy += player.speed * 2;
    if (keys.ArrowLeft || keys.a) dx -= player.speed * 2;
    if (keys.ArrowRight || keys.d) dx += player.speed * 2;

    if (dx !== 0 && dy !== 0) {
        const length = Math.sqrt(dx * dx + dy * dy);
        dx = (dx / length) * player.speed * 2;
        dy = (dy / length) * player.speed * 2;
    }

    if (dx !== 0 || dy !== 0) {
        player.facingX = dx;
        player.facingY = dy;
    }

    player.x += dx;
    player.y += dy;

    const pr = player.room;
    player.x = Math.max(pr.x + player.radius, Math.min(pr.x + pr.width - player.radius, player.x));
    player.y = Math.max(pr.y + 15 + player.radius, Math.min(pr.y + pr.height - player.radius, player.y));
    
    if (player.y - player.radius < pr.sink.y + pr.sink.height &&
        player.x > pr.sink.x && player.x < pr.sink.x + pr.sink.width) {
        player.y = pr.sink.y + pr.sink.height + player.radius;
    }

    rooms.forEach(r => r.updateParticles());
    people.forEach(p => p.update());
    
    updateReservoirs();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    rooms.forEach(r => r.draw());
    people.forEach(p => p.draw());

    // Prompt
    const r = player.room;
    const dist = Math.hypot((player.x) - (r.sink.x + r.sink.width/2), 
                            (player.y) - (r.sink.y + r.sink.height));
    if (dist < 40) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.beginPath();
        ctx.roundRect(r.sink.x + r.sink.width/2 - 30, r.sink.y + r.sink.height + 2, 60, 16, 4);
        ctx.fill();

        ctx.fillStyle = '#f8fafc';
        ctx.font = '600 9px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('SPACE', r.sink.x + r.sink.width/2, r.sink.y + r.sink.height + 12);
    }
}

function loop() {
    update();
    draw();
}

// Use a Web Worker to bypass Chrome's background tab throttling
// requestAnimationFrame pauses when the tab is hidden, but Web Workers do not.
const workerCode = `
  let interval;
  self.onmessage = function(e) {
    if (e.data === 'start') {
      interval = setInterval(() => self.postMessage('tick'), 16); // ~60fps
    }
  };
`;
const blob = new Blob([workerCode], {type: 'application/javascript'});
const worker = new Worker(URL.createObjectURL(blob));

worker.onmessage = () => {
    loop();
};

worker.postMessage('start');
