const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const socket = io();

const popSlider = document.getElementById('pop-slider');
const popVal = document.getElementById('pop-val');
const autoBtn = document.getElementById('auto-btn');

let serverState = {
    activeSinks: 0,
    activeShowers: 0,
    population: 20
};

socket.on('faucet_state', (data) => {
    serverState = data;
});

socket.on('config_sync', (config) => {
    popSlider.value = config.population;
    popVal.innerText = config.population;
    if (config.autoMode) {
        autoBtn.innerText = "Automatic AI is Running Backend";
        autoBtn.style.background = "#00E676";
        autoBtn.style.color = "black";
        autoBtn.style.borderColor = "#00E676";
    }
});

popSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    popVal.innerText = val;
    socket.emit('set_config', { population: parseInt(val) });
});

autoBtn.addEventListener('click', () => {
    socket.emit('set_config', { autoMode: true });
});

// Reservoir visuals
let totalFilteredWater = 0;
const reservoirCapacity = 5000;
function updateReservoirs() {
    // Fill speed based on server faucets
    let count = serverState.activeSinks + (serverState.activeShowers * 3); // Showers use 3x water
    totalFilteredWater += count * 0.15;

    let activeReservoirIndex = Math.floor(totalFilteredWater / reservoirCapacity);
    let fillAmount = totalFilteredWater % reservoirCapacity;
    let fillPercentage = (fillAmount / reservoirCapacity) * 100;

    for (let i = 1; i <= 6; i++) {
        const fillDiv = document.getElementById(`res-fill-${i}`);
        if (i - 1 < activeReservoirIndex) {
            fillDiv.style.height = '100%';
        } else if (i - 1 === activeReservoirIndex) {
            fillDiv.style.height = `${fillPercentage}%`;
        } else {
            fillDiv.style.height = '0%';
        }
    }
}

// Background worker
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
    updateReservoirs();
    if (!document.hidden) {
        draw();
    }
};

worker.postMessage('start');

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "24px Inter";
    ctx.fillText("Hotel Oasis-Grid Viewport", 20, 40);
    ctx.font = "16px Inter";
    ctx.fillText("Server is processing: " + serverState.population + " total guests in background.", 20, 70);
    
    ctx.fillStyle = "#00B0FF";
    ctx.fillText("Active Sinks: " + serverState.activeSinks, 20, 100);
    ctx.fillStyle = "#00E676";
    ctx.fillText("Active Showers (High Flow): " + serverState.activeShowers, 20, 130);

    // Draw some visual fluff to represent water flowing
    if (serverState.activeSinks > 0 || serverState.activeShowers > 0) {
        for (let i=0; i < (serverState.activeSinks + serverState.activeShowers*3); i++) {
            ctx.fillStyle = "rgba(0, 176, 255, 0.5)";
            ctx.beginPath();
            ctx.arc(100 + Math.random()*600, 200 + Math.random()*200, Math.random()*10, 0, Math.PI*2);
            ctx.fill();
        }
    }
}
