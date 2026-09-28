// ══════════════════════════════════════════════════════════════
//   NEON FISH — v4.0
//   Jogo de peixe predador + cenário infinito com parallax
// ══════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────
//   1. SETUP DO CANVAS
// ──────────────────────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let W, H;
function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// ──────────────────────────────────────────────────────────────
//   2. CONFIGURAÇÕES DO JOGO
// ──────────────────────────────────────────────────────────────
const CONFIG = {
    // --- NPCs peixes (os que participam da cadeia alimentar) ---
    npcCount: 12,
    playerStartSize: 24,
    npcMinSize: 12,
    npcMaxSize: 45,
    eatRatio: 0.85,

    // --- Movimento ---
    speedBase: 2.4,

    // --- Fome ---
    hungerMax: 100,
    hungerDrain: 0.25,
    hungerPerEat: 35,
    growthPerEat: 0.18,

    // --- Dash ---
    dashMultiplier: 3.5,
    dashDuration: 0.25,
    dashCooldown: 0.8,

    // --- Regras ---
    respawnDelay: 1.5,
    safeSpawnDist: 250,

    // --- Invulnerabilidade inicial (AJUSTE AQUI) ---
    playerInvuln: 10.0,      // segundos

    // --- Câmera (zoom out conforme cresce) ---
    zoomBase: 1.0,
    zoomMin: 0.55,
    zoomReference: 60,

    // --- Parallax (velocidade de cada camada) ---
    parallaxLayers: {
        rays: 0.10,
        plankton: 0.20,
        rocks: 0.35,
        corals: 0.45,
        algae: 0.60,
        creatures: 1.0
    }
};

// ──────────────────────────────────────────────────────────────
//   3. MOUSE E TECLADO
// ──────────────────────────────────────────────────────────────
const mouse = { x: W / 2, y: H / 2 };
window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});
window.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    mouse.x = t.clientX;
    mouse.y = t.clientY;
}, { passive: true });

window.addEventListener('mousedown', () => {
    if (player && player.alive) player.tryDash();
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R' || e.key === 'Enter') {
        if (gameState === 'gameover') restartGame();
    }
});

// ──────────────────────────────────────────────────────────────
//   4. PALETAS DE CORES (neon pastel)
// ──────────────────────────────────────────────────────────────
const PALETTES = [
    { body: '#c8b6ff', fin: '#ffc8dd', glow: '200, 182, 255' },
    { body: '#a2d2ff', fin: '#b8e0d2', glow: '162, 210, 255' },
    { body: '#ffd6a5', fin: '#ffafcc', glow: '255, 214, 165' },
    { body: '#b8e0d2', fin: '#c8b6ff', glow: '184, 224, 210' },
    { body: '#ffafcc', fin: '#a2d2ff', glow: '255, 175, 204' },
    { body: '#e0b0ff', fin: '#a2d2ff', glow: '224, 176, 255' },
];
function randPalette() {
    return PALETTES[Math.floor(Math.random() * PALETTES.length)];
}

// ──────────────────────────────────────────────────────────────
//   5. ESTADO GLOBAL
// ──────────────────────────────────────────────────────────────
let gameState = 'playing';
let player = null;
let npcs = [];
let particles = [];
let score = 0;
let bestScore = 0;
let startTime = performance.now();
let lastTime = startTime;
let gameOverTime = 0;
let respawnQueue = [];
let dangerLevel = 0;

// Câmera (zoom) e offset do mundo
let camera = { zoom: 1 };
let worldOffset = { x: 0, y: 0 };

// Função pseudoaleatória determinística (para gerar
// o mesmo elemento sempre que voltamos à mesma posição do mundo)
function hashRand(x, y, seed) {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return n - Math.floor(n);
}

// ══════════════════════════════════════════════════════════════
//   6. SISTEMA DE COORDENADAS (mundo ↔ tela)
// ══════════════════════════════════════════════════════════════
function updateWorldOffset() {
    if (!player) return;
    worldOffset.x = player.x;
    worldOffset.y = player.y;
}

// Aplica zoom + centralização no jogador
function applyCamera() {
    if (!player || !player.alive) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        return;
    }
    const cx = W / 2;
    const cy = H / 2;
    ctx.setTransform(
        camera.zoom, 0,
        0, camera.zoom,
        cx - player.x * camera.zoom,
        cy - player.y * camera.zoom
    );
}

// Converte coords de TELA para MUNDO (usado pelo mouse)
function screenToWorld(sx, sy) {
    const cx = W / 2;
    const cy = H / 2;
    return {
        x: worldOffset.x + (sx - cx) / camera.zoom,
        y: worldOffset.y + (sy - cy) / camera.zoom
    };
}

// ══════════════════════════════════════════════════════════════
//   7. CENÁRIO INFINITO COM PARALLAX
// ══════════════════════════════════════════════════════════════

// ── 7.1 FUNDO FIXO ───────────────────────────────────────────
function drawBackground() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0f1a2e');
    grad.addColorStop(0.5, '#0a1220');
    grad.addColorStop(1, '#050810');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
}

// ── 7.2 RAIOS DE LUZ (parallax 0.10) ─────────────────────────
const RAY_TILE = 1200;
function drawGodRays(t) {
    const layer = CONFIG.parallaxLayers.rays;
    const offsetX = worldOffset.x * layer;

    const startTile = Math.floor((offsetX - W) / RAY_TILE) - 1;
    const endTile = Math.ceil((offsetX + W) / RAY_TILE) + 1;

    for (let tile = startTile; tile <= endTile; tile++) {
        for (let i = 0; i < 3; i++) {
            const rx = hashRand(tile * 3 + i, 0, 1);
            const rw = hashRand(tile * 3 + i, 1, 2);
            const ra = hashRand(tile * 3 + i, 2, 3);
            const rp = hashRand(tile * 3 + i, 3, 4);

            const worldX = tile * RAY_TILE + rx * RAY_TILE;
            const screenX = worldX - offsetX;
            if (screenX < -200 || screenX > W + 200) continue;

            const width = 60 + rw * 130;
            const alpha = 0.05 + ra * 0.07;
            const sway = Math.sin(t * 0.03 + rp * Math.PI * 2) * 30;
            const x = screenX + sway;

            const grad = ctx.createLinearGradient(x, 0, x + width * 0.5, H * 0.9);
            grad.addColorStop(0, `rgba(180, 220, 255, ${alpha * 1.4})`);
            grad.addColorStop(0.5, `rgba(140, 200, 255, ${alpha * 0.6})`);
            grad.addColorStop(1, 'rgba(140, 200, 255, 0)');
            ctx.fillStyle = grad;

            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + width, 0);
            ctx.lineTo(x + width + width * 0.4, H * 0.9);
            ctx.lineTo(x - width * 0.2, H * 0.9);
            ctx.closePath();
            ctx.fill();
        }
    }
}

// ── 7.3 PLÂNCTON (parallax 0.20) ─────────────────────────────
const PLANKTON_TILE = 700;
function drawPlankton(t) {
    const layer = CONFIG.parallaxLayers.plankton;
    const offsetX = worldOffset.x * layer;
    const offsetY = worldOffset.y * layer;

    const startX = Math.floor((offsetX - W) / PLANKTON_TILE) - 1;
    const endX = Math.ceil((offsetX + W) / PLANKTON_TILE) + 1;
    const startY = Math.floor((offsetY - H) / PLANKTON_TILE) - 1;
    const endY = Math.ceil((offsetY + H) / PLANKTON_TILE) + 1;

    for (let tx = startX; tx <= endX; tx++) {
        for (let ty = startY; ty <= endY; ty++) {
            for (let i = 0; i < 4; i++) {
                const rx = hashRand(tx * 4 + i, ty, 5);
                const ry = hashRand(tx * 4 + i, ty, 6);
                const rr = hashRand(tx * 4 + i, ty, 7);
                const ra = hashRand(tx * 4 + i, ty, 8);

                const worldX = tx * PLANKTON_TILE + rx * PLANKTON_TILE;
                const worldY = ty * PLANKTON_TILE + ry * PLANKTON_TILE;
                const sx = worldX - offsetX;
                const sy = worldY - offsetY;

                if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue;

                const wobX = Math.sin(t * 0.5 + i) * 1.5;
                const wobY = Math.cos(t * 0.4 + i) * 1.5;

                ctx.beginPath();
                ctx.fillStyle = `rgba(200, 230, 255, ${0.15 + ra * 0.35})`;
                ctx.arc(sx + wobX, sy + wobY, 0.5 + rr * 1.6, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}

// ── 7.4 ROCHAS (parallax 0.35) ───────────────────────────────
const ROCK_TILE = 600;
function drawRochas() {
    const layer = CONFIG.parallaxLayers.rocks;
    const offsetX = worldOffset.x * layer;
    const offsetY = worldOffset.y * layer;
    const floorY = H * 0.92 - offsetY;

    const startTile = Math.floor((offsetX - W) / ROCK_TILE) - 1;
    const endTile = Math.ceil((offsetX + W) / ROCK_TILE) + 1;

    for (let tile = startTile; tile <= endTile; tile++) {
        for (let i = 0; i < 2; i++) {
            const rx = hashRand(tile * 2 + i, 0, 10);
            const rr = hashRand(tile * 2 + i, 0, 11);

            const worldX = tile * ROCK_TILE + rx * ROCK_TILE;
            const sx = worldX - offsetX;
            if (sx < -100 || sx > W + 100) continue;

            const radius = 15 + rr * 35;
            const sy = floorY + radius * 0.3;

            ctx.save();
            const grad = ctx.createRadialGradient(sx, sy - radius * 0.4, 0, sx, sy, radius);
            grad.addColorStop(0, 'rgba(60, 70, 90, 0.9)');
            grad.addColorStop(1, 'rgba(20, 25, 40, 0.9)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(sx, sy, radius, radius * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
}

// ── 7.5 CORAIS (parallax 0.45) ───────────────────────────────
const CORAL_TILE = 500;
function drawCorais(t) {
    const layer = CONFIG.parallaxLayers.corals;
    const offsetX = worldOffset.x * layer;
    const offsetY = worldOffset.y * layer;
    const floorY = H * 0.95 - offsetY;

    const startTile = Math.floor((offsetX - W) / CORAL_TILE) - 1;
    const endTile = Math.ceil((offsetX + W) / CORAL_TILE) + 1;

    const hues = ['120, 200, 160', '255, 175, 204', '200, 182, 255', '255, 214, 165'];

    for (let tile = startTile; tile <= endTile; tile++) {
        for (let i = 0; i < 2; i++) {
            const rx = hashRand(tile * 2 + i, 1, 20);
            const rh = hashRand(tile * 2 + i, 2, 21);
            const rw = hashRand(tile * 2 + i, 3, 22);
            const rp = hashRand(tile * 2 + i, 4, 23);
            const rhue = Math.floor(hashRand(tile * 2 + i, 5, 24) * 4);

            const worldX = tile * CORAL_TILE + rx * CORAL_TILE;
            const sx = worldX - offsetX;
            if (sx < -100 || sx > W + 100) continue;

            const hue = hues[rhue];
            const height = 40 + rh * 90;
            const width = 20 + rw * 25;
            const sway = Math.sin(t * 0.5 + rp * Math.PI * 2) * 4;

            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = `rgba(${hue}, 0.35)`;
            ctx.lineWidth = 4;
            ctx.moveTo(sx, floorY);
            ctx.quadraticCurveTo(sx + sway * 0.5, floorY - height * 0.5,
                                  sx + sway, floorY - height);
            ctx.stroke();

            for (let g = 1; g <= 3; g++) {
                const p = g / 4;
                const bx = sx + sway * p;
                const by = floorY - height * p;
                const side = g % 2 === 0 ? 1 : -1;
                ctx.beginPath();
                ctx.strokeStyle = `rgba(${hue}, 0.28)`;
                ctx.lineWidth = 3;
                ctx.moveTo(bx, by);
                ctx.quadraticCurveTo(
                    bx + side * width * 0.5, by - 10,
                    bx + side * width, by - 20
                );
                ctx.stroke();
            }
            ctx.restore();
        }
    }
}

// ── 7.6 ALGAS (parallax 0.60) ────────────────────────────────
const ALGA_TILE = 400;
function drawAlgas(t) {
    const layer = CONFIG.parallaxLayers.algae;
    const offsetX = worldOffset.x * layer;
    const offsetY = worldOffset.y * layer;
    const floorY = H * 0.97 - offsetY;

    const startTile = Math.floor((offsetX - W) / ALGA_TILE) - 1;
    const endTile = Math.ceil((offsetX + W) / ALGA_TILE) + 1;

    for (let tile = startTile; tile <= endTile; tile++) {
        for (let i = 0; i < 3; i++) {
            const rx = hashRand(tile * 3 + i, 0, 30);
            const rh = hashRand(tile * 3 + i, 1, 31);
            const rp = hashRand(tile * 3 + i, 2, 32);
            const rblades = 2 + Math.floor(hashRand(tile * 3 + i, 3, 33) * 3);

            const worldX = tile * ALGA_TILE + rx * ALGA_TILE;
            const sx = worldX - offsetX;
            if (sx < -80 || sx > W + 80) continue;

            const hue = hashRand(tile * 3 + i, 4, 34) < 0.5 ? '140, 200, 160' : '100, 170, 150';

            for (let b = 0; b < rblades; b++) {
                const bOffset = (b - (rblades - 1) / 2) * 8;
                const bHeight = 60 + rh * 100;
                const bPhase = rp * Math.PI * 2 + b * 0.8;

                const x0 = sx + bOffset;
                ctx.beginPath();
                ctx.strokeStyle = `rgba(${hue}, 0.5)`;
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.moveTo(x0, floorY);

                const segments = 6;
                for (let s = 1; s <= segments; s++) {
                    const p = s / segments;
                    const sway = Math.sin(t * 1.2 + bPhase + p * 2) * p * 18;
                    ctx.lineTo(x0 + sway, floorY - bHeight * p);
                }
                ctx.stroke();
            }
        }
    }
}

// ── 7.7 CHÃO (parallax 0.60) ─────────────────────────────────
function drawSeafloor() {
    const layer = CONFIG.parallaxLayers.algae;
    const offsetY = worldOffset.y * layer;
    const floorY = H * 0.97 - offsetY;

    const grad = ctx.createLinearGradient(0, floorY - 80, 0, floorY + 40);
    grad.addColorStop(0, 'rgba(30, 40, 60, 0)');
    grad.addColorStop(0.4, 'rgba(25, 32, 50, 0.5)');
    grad.addColorStop(1, 'rgba(15, 20, 35, 0.9)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, floorY - 80, W, 120);
}

// ── 7.8 VINHETA ──────────────────────────────────────────────
function drawVignette() {
    const grad = ctx.createRadialGradient(
        W / 2, H / 2, Math.min(W, H) * 0.3,
        W / 2, H / 2, Math.max(W, H) * 0.75
    );
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
}

// ── 7.9 BORDA DE PERIGO ──────────────────────────────────────
function drawDangerBorder() {
    if (dangerLevel <= 0.01) return;
    const alpha = dangerLevel * 0.5;
    const grad = ctx.createRadialGradient(
        W / 2, H / 2, Math.min(W, H) * 0.35,
        W / 2, H / 2, Math.max(W, H) * 0.75
    );
    grad.addColorStop(0, 'rgba(255, 80, 80, 0)');
    grad.addColorStop(1, `rgba(255, 40, 40, ${alpha})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
}

// ══════════════════════════════════════════════════════════════
//   8. CRIATURAS DECORATIVAS (NPCs "tocando a vida")
// ══════════════════════════════════════════════════════════════

// ── 8.1 CARANGUEJO ───────────────────────────────────────────
class Crab {
    constructor(x) {
        this.x = x;
        this.y = H - 25;
        this.dir = Math.random() < 0.5 ? -1 : 1;
        this.speed = 0.3 + Math.random() * 0.2;
        this.state = 'walking';
        this.stateTimer = 3 + Math.random() * 5;
        this.legPhase = 0;
        this.color = '255, 175, 204';
    }
    update(dt) {
        this.stateTimer -= dt;
        if (this.state === 'walking') {
            this.x += this.dir * this.speed;
            this.legPhase += dt * 8;
            if (this.x < 60) { this.x = 60; this.dir = 1; }
            if (this.x > W - 60) { this.x = W - 60; this.dir = -1; }
            if (this.stateTimer <= 0) {
                this.state = 'paused';
                this.stateTimer = 1 + Math.random() * 3;
            }
        } else {
            if (this.stateTimer <= 0) {
                this.state = 'walking';
                this.stateTimer = 3 + Math.random() * 5;
                if (Math.random() < 0.3) this.dir *= -1;
            }
        }
    }
    draw() {
        const s = 12;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.dir, 1);
        ctx.shadowColor = `rgba(${this.color}, 0.8)`;
        ctx.shadowBlur = 12;

        // Patas
        ctx.strokeStyle = `rgba(${this.color}, 0.7)`;
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
            const lx = -s * 0.3 + i * 4;
            const swing = Math.sin(this.legPhase + i * 1.5) * 2;
            ctx.beginPath();
            ctx.moveTo(lx, 2); ctx.lineTo(lx - 2, 8 + swing); ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(lx, -2); ctx.lineTo(lx - 2, -8 - swing); ctx.stroke();
        }

        // Corpo
        ctx.fillStyle = `rgba(${this.color}, 0.9)`;
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.8, s * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pinças
        ctx.beginPath(); ctx.arc(s * 0.9, -4, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(s * 0.9, 4, 3, 0, Math.PI * 2); ctx.fill();

        // Olhos
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#0a0a14';
        ctx.beginPath(); ctx.arc(s * 0.3, -2, 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(s * 0.3, 2, 1.2, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
    }
}

// ── 8.2 MEDUSA ───────────────────────────────────────────────
class Jellyfish {
    constructor(x) {
        this.x = x;
        this.y = 100 + Math.random() * (H - 300);
        this.size = 18 + Math.random() * 12;
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.floatPhase = Math.random() * Math.PI * 2;
        this.driftSpeed = (Math.random() - 0.5) * 0.3;
        this.color = '162, 210, 255';
        this.tentacles = 6 + Math.floor(Math.random() * 3);
    }
    update(t) {
        this.y += Math.sin(t * 0.3 + this.floatPhase) * 0.3;
        this.x += this.driftSpeed + Math.sin(t * 0.2 + this.floatPhase) * 0.2;
        if (this.x < 40) this.x = 40;
        if (this.x > W - 40) this.x = W - 40;
        if (this.y < 60) this.y = 60;
        if (this.y > H - 80) this.y = H - 80;
    }
    draw(t) {
        const pulse = 1 + Math.sin(t * 2 + this.pulsePhase) * 0.15;
        const s = this.size * pulse;

        // Tentáculos
        ctx.strokeStyle = `rgba(${this.color}, 0.5)`;
        ctx.lineWidth = 1.5;
        for (let i = 0; i < this.tentacles; i++) {
            const angle = (i / this.tentacles) * Math.PI * 2;
            const tx = Math.cos(angle) * s * 0.5;
            ctx.beginPath();
            ctx.moveTo(this.x + tx, this.y + s * 0.3);
            const wX = Math.sin(t * 2 + i) * 4;
            const wY = Math.cos(t * 2 + i) * 3;
            ctx.quadraticCurveTo(
                this.x + tx + wX, this.y + s * 1.2 + wY,
                this.x + tx + wX * 2, this.y + s * 2 + wY
            );
            ctx.stroke();
        }

        // Cúpula
        ctx.shadowColor = `rgba(${this.color}, 0.9)`;
        ctx.shadowBlur = 18;
        ctx.fillStyle = `rgba(${this.color}, 0.25)`;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, s, s * 0.7, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(${this.color}, 0.7)`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Brilho
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(255, 255, 255, 0.3)`;
        ctx.beginPath();
        ctx.ellipse(this.x - s * 0.3, this.y - s * 0.25, s * 0.2, s * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ── 8.3 CAMARÃO ──────────────────────────────────────────────
class Shrimp {
    constructor(x) {
        this.x = x;
        this.y = H - 15 - Math.random() * 20;
        this.dir = Math.random() < 0.5 ? -1 : 1;
        this.state = 'idle';
        this.stateTimer = 1 + Math.random() * 3;
        this.color = '255, 214, 165';
        this.phase = Math.random() * Math.PI * 2;
    }
    update(dt) {
        this.stateTimer -= dt;
        if (this.state === 'idle') {
            if (this.stateTimer <= 0) {
                this.state = 'dart';
                this.stateTimer = 0.3;
                this.dir = Math.random() < 0.5 ? -1 : 1;
            }
        } else {
            this.x += this.dir * 3;
            if (this.stateTimer <= 0) {
                this.state = 'idle';
                this.stateTimer = 1.5 + Math.random() * 3;
            }
        }
        if (this.x < 40) this.dir = 1;
        if (this.x > W - 40) this.dir = -1;
    }
    draw(t) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.dir, 1);
        ctx.shadowColor = `rgba(${this.color}, 0.8)`;
        ctx.shadowBlur = 10;

        ctx.strokeStyle = `rgba(${this.color}, 0.9)`;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.quadraticCurveTo(0, -6, 8, -2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.lineTo(-12, -3);
        ctx.lineTo(-12, 3);
        ctx.closePath();
        ctx.fillStyle = `rgba(${this.color}, 0.9)`;
        ctx.fill();

        ctx.strokeStyle = `rgba(${this.color}, 0.5)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(8, -2);
        ctx.lineTo(14 + Math.sin(t * 4 + this.phase) * 2, -6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8, -2);
        ctx.lineTo(14 + Math.cos(t * 4 + this.phase) * 2, -8);
        ctx.stroke();

        ctx.restore();
    }
}

// ── 8.4 ESTRELA-DO-MAR ───────────────────────────────────────
class Starfish {
    constructor(x) {
        this.x = x;
        this.y = H - 20 - Math.random() * 20;
        this.size = 10 + Math.random() * 6;
        this.rotation = Math.random() * Math.PI * 2;
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.color = Math.random() < 0.5 ? '255, 214, 165' : '255, 175, 204';
    }
    update() {}
    draw(t) {
        const pulse = 1 + Math.sin(t * 2 + this.pulsePhase) * 0.08;
        const s = this.size * pulse;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.shadowColor = `rgba(${this.color}, 0.7)`;
        ctx.shadowBlur = 12;
        ctx.fillStyle = `rgba(${this.color}, 0.85)`;

        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
            const r = i % 2 === 0 ? s : s * 0.45;
            const px = Math.cos(angle) * r;
            const py = Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}

// ── 8.5 TARTARUGA ────────────────────────────────────────────
class Turtle {
    constructor() { this.reset(); this.active = false; }
    reset() {
        const fromLeft = Math.random() < 0.5;
        this.x = fromLeft ? -80 : W + 80;
        this.y = 120 + Math.random() * (H - 300);
        this.dir = fromLeft ? 1 : -1;
        this.speed = 0.4 + Math.random() * 0.2;
        this.size = 25 + Math.random() * 10;
        this.flipperPhase = 0;
        this.color = '184, 224, 210';
        this.active = true;
    }
    update(dt) {
        if (!this.active) return;
        this.x += this.dir * this.speed;
        this.flipperPhase += dt * 2.5;
        if (this.dir > 0 && this.x > W + 80) this.active = false;
        if (this.dir < 0 && this.x < -80) this.active = false;
    }
    draw() {
        if (!this.active) return;
        const s = this.size;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.dir, 1);
        ctx.shadowColor = `rgba(${this.color}, 0.8)`;
        ctx.shadowBlur = 15;

        const flap = Math.sin(this.flipperPhase) * 4;
        ctx.fillStyle = `rgba(${this.color}, 0.6)`;
        ctx.beginPath(); ctx.ellipse(s * 0.6, -s * 0.5 + flap, s * 0.3, s * 0.15, -0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(s * 0.6, s * 0.5 - flap, s * 0.3, s * 0.15, 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-s * 0.7, -s * 0.4 + flap * 0.5, s * 0.2, s * 0.12, -0.7, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-s * 0.7, s * 0.4 - flap * 0.5, s * 0.2, s * 0.12, 0.7, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = `rgba(${this.color}, 0.85)`;
        ctx.beginPath();
        ctx.ellipse(0, 0, s, s * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(${this.color}, 0.5)`;
        ctx.lineWidth = 1;
        for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.arc(i * s * 0.3, 0, s * 0.15, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.fillStyle = `rgba(${this.color}, 0.9)`;
        ctx.beginPath();
        ctx.ellipse(s * 0.95, 0, s * 0.2, s * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#0a0a14';
        ctx.beginPath();
        ctx.arc(s * 1.0, -s * 0.05, s * 0.04, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// ── 8.6 BOLHA ────────────────────────────────────────────────
class Bubble {
    constructor() {
        this.reset();
        this.y = Math.random() * H;
    }
    reset() {
        this.x = Math.random() * W;
        this.y = H + 20;
        this.r = 2 + Math.random() * 4;
        this.speed = 0.2 + Math.random() * 0.5;
        this.alpha = 0.15 + Math.random() * 0.25;
        this.phase = Math.random() * Math.PI * 2;
    }
    update(t) {
        this.y -= this.speed;
        this.x += Math.sin(t * 0.02 + this.phase) * 0.3;
        if (this.y < -20) this.reset();
    }
    draw() {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(180, 220, 255, ${this.alpha})`;
        ctx.lineWidth = 1;
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha * 0.8})`;
        ctx.arc(this.x - this.r * 0.3, this.y - this.r * 0.3, this.r * 0.25, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ══════════════════════════════════════════════════════════════
//   9. PEIXES (jogador + NPCs)
// ══════════════════════════════════════════════════════════════

// ── 9.1 PARTÍCULAS ───────────────────────────────────────────
function spawnBurst(x, y, colorRgb, count = 10) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            r: 1 + Math.random() * 3,
            color: colorRgb
        });
    }
}
function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.life -= 0.025;
        if (p.life <= 0) particles.splice(i, 1);
    }
}
function drawParticles() {
    for (const p of particles) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(${p.color}, ${p.life * 0.9})`;
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ── 9.2 CLASSE BASE — FISH ───────────────────────────────────
class Fish {
    constructor(x, y, size, palette) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.angle = 0;
        this.size = size;
        this.palette = palette;
        this.tailPhase = Math.random() * Math.PI * 2;
        this.alive = true;
    }

    steerTo(tx, ty, maxSpeed, maxForce) {
        let dx = tx - this.x;
        let dy = ty - this.y;
        const d = Math.hypot(dx, dy) || 1;
        const speed = Math.min(maxSpeed, d * 0.05);
        const desiredX = (dx / d) * speed;
        const desiredY = (dy / d) * speed;
        let steerX = desiredX - this.vx;
        let steerY = desiredY - this.vy;
        const sMag = Math.hypot(steerX, steerY);
        if (sMag > maxForce) {
            steerX = (steerX / sMag) * maxForce;
            steerY = (steerY / sMag) * maxForce;
        }
        this.vx += steerX;
        this.vy += steerY;
        const vMag = Math.hypot(this.vx, this.vy);
        if (vMag > maxSpeed) {
            this.vx = (this.vx / vMag) * maxSpeed;
            this.vy = (this.vy / vMag) * maxSpeed;
        }
    }

    integrate(dt) {
        this.x += this.vx * dt * 60;
        this.y += this.vy * dt * 60;

        const targetAngle = Math.atan2(this.vy, this.vx);
        let diff = targetAngle - this.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.angle += diff * 0.12;

        const speed = Math.hypot(this.vx, this.vy);
        this.tailPhase += 0.15 + speed * 0.08;
    }

    // Amortece na borda em vez de inverter — evita travar
    clampToBounds(margin = 20) {
        if (this.x < margin) { this.x = margin; if (this.vx < 0) this.vx *= 0.3; }
        if (this.x > W - margin) { this.x = W - margin; if (this.vx > 0) this.vx *= 0.3; }
        if (this.y < margin) { this.y = margin; if (this.vy < 0) this.vy *= 0.3; }
        if (this.y > H - margin) { this.y = H - margin; if (this.vy > 0) this.vy *= 0.3; }
    }

    drawBody() {
        const s = this.size;
        const wag = Math.sin(this.tailPhase) * 0.4;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.shadowColor = `rgba(${this.palette.glow}, 0.9)`;
        ctx.shadowBlur = 12 + this.size * 0.3;

        // Cauda
        ctx.beginPath();
        ctx.fillStyle = this.palette.fin;
        ctx.moveTo(-s * 0.9, 0);
        ctx.quadraticCurveTo(-s * 1.4, -s * 0.5 + wag * s * 0.6, -s * 1.7, wag * s * 0.8);
        ctx.quadraticCurveTo(-s * 1.4, s * 0.5 + wag * s * 0.6, -s * 0.9, 0);
        ctx.fill();

        // Corpo
        ctx.beginPath();
        ctx.fillStyle = this.palette.body;
        ctx.ellipse(0, 0, s, s * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();

        // Nadadeiras
        ctx.beginPath();
        ctx.fillStyle = this.palette.fin;
        ctx.moveTo(-s * 0.1, -s * 0.5);
        ctx.quadraticCurveTo(0, -s * 1.1, s * 0.4, -s * 0.4);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = this.palette.fin;
        ctx.moveTo(-s * 0.1, s * 0.5);
        ctx.quadraticCurveTo(0, s * 1.1, s * 0.4, s * 0.4);
        ctx.fill();

        // Olho
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.fillStyle = '#0a0a14';
        ctx.arc(s * 0.55, -s * 0.1, s * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.arc(s * 0.58, -s * 0.14, s * 0.04, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    draw() { this.drawBody(); }
}

// ── 9.3 JOGADOR ──────────────────────────────────────────────
class Player extends Fish {
    constructor() {
        super(W / 2, H / 2, CONFIG.playerStartSize, {
            body: '#fff0c8', fin: '#ffc8dd', glow: '255, 240, 200'
        });
        this.hunger = CONFIG.hungerMax;
        this.dashTimer = 0;
        this.dashCooldownTimer = 0;
        this.eatCount = 0;
        this.invulnTimer = CONFIG.playerInvuln;
    }

    tryDash() {
        if (this.dashCooldownTimer <= 0) {
            this.dashTimer = CONFIG.dashDuration;
            this.dashCooldownTimer = CONFIG.dashCooldown;
            for (let i = 0; i < 10; i++) spawnBurst(this.x, this.y, '255, 240, 200', 1);
        }
    }

    update(dt) {
        if (!this.alive) return;
        if (this.invulnTimer > 0) this.invulnTimer -= dt;

        this.hunger -= CONFIG.hungerDrain * dt;
        if (this.hunger <= 0) { this.hunger = 0; this.die('fome'); return; }

        if (this.dashTimer > 0) this.dashTimer -= dt;
        if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= dt;

        const sizePenalty = 1 - Math.min(0.5, (this.size - 15) / 100);
        let maxSpeed = CONFIG.speedBase * sizePenalty;
        if (this.dashTimer > 0) maxSpeed *= CONFIG.dashMultiplier;

        // Mouse é convertido de tela pra mundo
        const target = screenToWorld(mouse.x, mouse.y);
        this.steerTo(target.x, target.y, maxSpeed, 0.15);
        this.integrate(dt);
        this.clampToBounds(this.size * 0.6);
    }

    eat(npc) {
        this.size += npc.size * CONFIG.growthPerEat;
        this.hunger = Math.min(CONFIG.hungerMax, this.hunger + CONFIG.hungerPerEat);
        this.eatCount++;
        score += Math.round(npc.size);
        if (score > bestScore) bestScore = score;
        spawnBurst(npc.x, npc.y, npc.palette.glow, 15);
    }

    die(reason) {
        this.alive = false;
        gameState = 'gameover';
        gameOverTime = performance.now();
        spawnBurst(this.x, this.y, this.palette.glow, 40);
    }

    draw() {
        if (this.invulnTimer > 0) {
            const blink = Math.sin(performance.now() * 0.02) > 0;
            if (!blink) { this.drawBody(); this.drawPlayerMarker(); return; }
        }

        const hungerWarn = this.hunger < 25 && this.hunger > 0;
        if (hungerWarn && Math.sin(performance.now() * 0.01) > 0.5) {
            ctx.save();
            ctx.shadowColor = 'rgba(255, 80, 80, 1)';
            ctx.shadowBlur = 30;
        }
        this.drawBody();
        if (hungerWarn && Math.sin(performance.now() * 0.01) > 0.5) ctx.restore();
        this.drawPlayerMarker();
    }

    drawPlayerMarker() {
        const t = performance.now() * 0.003;
        const pulse = 1 + Math.sin(t * 2) * 0.08;
        const r = this.size * 1.7 * pulse;

        // Escudo visual quando invulnerável
        if (this.invulnTimer > 0) {
            ctx.save();
            const shieldPulse = 1 + Math.sin(performance.now() * 0.01) * 0.05;
            const shieldR = this.size * 2.2 * shieldPulse;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(162, 210, 255, ${0.4 + Math.sin(performance.now() * 0.015) * 0.2})`;
            ctx.lineWidth = 2;
            ctx.shadowColor = 'rgba(162, 210, 255, 0.9)';
            ctx.shadowBlur = 20;
            ctx.arc(this.x, this.y, shieldR, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = 'rgba(162, 210, 255, 0.08)';
            ctx.fill();
            ctx.restore();
        }

        // Anel externo
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = `rgba(255, 240, 200, ${0.5 + Math.sin(t * 3) * 0.3})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(255, 240, 200, 0.9)';
        ctx.shadowBlur = 15;
        ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Seta "VOCÊ"
        const arrowY = this.y - this.size * 1.8 - 20;
        const bounce = Math.sin(performance.now() * 0.005) * 4;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = 'bold 12px "Segoe UI", sans-serif';
        ctx.shadowColor = 'rgba(255, 240, 200, 0.9)';
        ctx.shadowBlur = 12;
        ctx.fillStyle = 'rgba(255, 240, 200, 1)';
        ctx.fillText('VOCÊ', this.x, arrowY + bounce);
        ctx.beginPath();
        ctx.moveTo(this.x - 6, arrowY + bounce + 6);
        ctx.lineTo(this.x + 6, arrowY + bounce + 6);
        ctx.lineTo(this.x, arrowY + bounce + 14);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

// ── 9.4 NPC PEIXE ────────────────────────────────────────────
class NPC extends Fish {
    constructor(x, y, size, palette) {
        super(x, y, size, palette);
        this.wanderTimer = 0;
        this.wanderTarget = { x: Math.random() * W, y: Math.random() * H };
        this.fleeing = false;
        this.chasing = false;
        this.threatLevel = 0;
    }

    update(dt, allFish) {
        if (!this.alive) return;
        const playerRef = player && player.alive ? player : null;
        this.fleeing = false;
        this.chasing = false;
        this.threatLevel = 0;

        const sizePenalty = 1 - Math.min(0.5, (this.size - 15) / 100);
        let maxSpeed = CONFIG.speedBase * sizePenalty * 0.85;
        const maxForce = 0.12;

        if (playerRef && player.invulnTimer <= 0) {
            const dx = playerRef.x - this.x;
            const dy = playerRef.y - this.y;
            const dist = Math.hypot(dx, dy);
            const perception = 220;

            const playerCanEatMe = playerRef.size > this.size / CONFIG.eatRatio;
            const iCanEatPlayer = this.size > playerRef.size / CONFIG.eatRatio;

            if (dist < perception) {
                if (playerCanEatMe && !iCanEatPlayer) {
                    this.wanderTarget = { x: this.x - dx * 2, y: this.y - dy * 2 };
                    this.fleeing = true;
                    maxSpeed *= 1.3;
                } else if (iCanEatPlayer) {
                    this.wanderTarget = { x: playerRef.x, y: playerRef.y };
                    this.chasing = true;
                    const adv = this.size / playerRef.size;
                    this.threatLevel = Math.min(1, (1 - dist / perception) * adv * 0.7);
                }
            }
        }

        if (!this.fleeing && !this.chasing) {
            for (const other of allFish) {
                if (other === this || !other.alive || other === player) continue;
                const dx = other.x - this.x;
                const dy = other.y - this.y;
                const dist = Math.hypot(dx, dy);
                if (dist < 130) {
                    const oCanEatMe = other.size > this.size / CONFIG.eatRatio;
                    const iCanEatO = this.size > other.size / CONFIG.eatRatio;
                    if (oCanEatMe && !iCanEatO) {
                        this.wanderTarget = { x: this.x - dx * 1.5, y: this.y - dy * 1.5 };
                        this.fleeing = true;
                        maxSpeed *= 1.15;
                        break;
                    } else if (iCanEatO && !this.fleeing) {
                        this.wanderTarget = { x: other.x, y: other.y };
                        this.chasing = true;
                        break;
                    }
                }
            }
        }

        if (!this.fleeing && !this.chasing) {
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                this.wanderTarget = {
                    x: 50 + Math.random() * (W - 100),
                    y: 50 + Math.random() * (H - 100)
                };
                this.wanderTimer = 3 + Math.random() * 4;
            }
        }

        this.steerTo(this.wanderTarget.x, this.wanderTarget.y, maxSpeed, maxForce);
        this.integrate(dt);
        this.clampToBounds(this.size * 0.6);
    }

    draw() {
        const p = player;
        if (p && p.alive) {
            // Verde: você pode comer
            if (p.size > this.size / CONFIG.eatRatio) {
                ctx.save();
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(120, 255, 150, 0.55)';
                ctx.lineWidth = 1.5;
                ctx.arc(this.x, this.y, this.size * 1.4, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
            // Vermelho: pode te comer
            if (this.size > p.size / CONFIG.eatRatio) {
                ctx.save();
                const pulse = 0.5 + Math.sin(performance.now() * 0.008) * 0.3;
                ctx.beginPath();
                ctx.strokeStyle = `rgba(255, 80, 80, ${pulse})`;
                ctx.lineWidth = 2;
                ctx.shadowColor = 'rgba(255, 80, 80, 0.9)';
                ctx.shadowBlur = 12;
                ctx.arc(this.x, this.y, this.size * 1.4, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        }

        if (this.chasing) {
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 80, 80, 0.7)';
            ctx.lineWidth = 2.5;
            ctx.arc(this.x, this.y, this.size * 1.9, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        this.drawBody();
    }
}

// ══════════════════════════════════════════════════════════════
//   10. MECÂNICAS DO JOGO
// ══════════════════════════════════════════════════════════════

// ── 10.1 SPAWN ───────────────────────────────────────────────
function spawnNPC() {
    const size = CONFIG.npcMinSize + Math.random() * (CONFIG.npcMaxSize - CONFIG.npcMinSize);
    let x, y, ok = false;
    for (let attempt = 0; attempt < 20; attempt++) {
        const margin = 60;
        x = margin + Math.random() * (W - margin * 2);
        y = margin + Math.random() * (H - margin * 2);
        if (!player || !player.alive) { ok = true; break; }
        const d = Math.hypot(x - player.x, y - player.y);
        if (d > CONFIG.safeSpawnDist) { ok = true; break; }
    }
    if (!ok) return;
    npcs.push(new NPC(x, y, size, randPalette()));
}

// ── 10.2 COMER ───────────────────────────────────────────────
function canEat(a, b) {
    return a.size > b.size / CONFIG.eatRatio;
}

function checkEat(allFish) {
    for (let i = allFish.length - 1; i >= 0; i--) {
        const a = allFish[i];
        if (!a.alive) continue;
        for (let j = allFish.length - 1; j >= 0; j--) {
            if (i === j) continue;
            const b = allFish[j];
            if (!b.alive) continue;
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d > a.size * 0.9 + b.size * 0.4) continue;

            const aEatsB = canEat(a, b) && !canEat(b, a);
            const bEatsA = canEat(b, a) && !canEat(a, b);

            if (aEatsB) {
                if (b === player && player.invulnTimer > 0) continue;
                if (a === player) player.eat(b);
                else a.size += b.size * 0.08;
                b.alive = false;
                if (b === player) player.die('comido');
            } else if (bEatsA) {
                if (a === player && player.invulnTimer > 0) continue;
                if (b === player) player.eat(a);
                else b.size += a.size * 0.08;
                a.alive = false;
                if (a === player) player.die('comido');
            }
        }
    }

    for (let i = npcs.length - 1; i >= 0; i--) {
        if (!npcs[i].alive) {
            npcs.splice(i, 1);
            respawnQueue.push(performance.now() + CONFIG.respawnDelay * 1000);
        }
    }
}

// ── 10.3 PERIGO ──────────────────────────────────────────────
function updateDangerLevel() {
    if (!player || !player.alive) { dangerLevel = 0; return; }
    let maxThreat = 0;
    for (const npc of npcs) if (npc.threatLevel > maxThreat) maxThreat = npc.threatLevel;
    dangerLevel += (maxThreat - dangerLevel) * 0.15;
}

// ── 10.4 CÂMERA ──────────────────────────────────────────────
function updateCamera() {
    if (!player) return;
    const growth = Math.min(1, (player.size - CONFIG.playerStartSize) /
                              (CONFIG.zoomReference - CONFIG.playerStartSize));
    const targetZoom = CONFIG.zoomBase - (CONFIG.zoomBase - CONFIG.zoomMin) * growth;
    camera.zoom += (targetZoom - camera.zoom) * 0.05;
}

// ══════════════════════════════════════════════════════════════
//   11. HUD, GAME OVER E CURSOR
// ══════════════════════════════════════════════════════════════

function drawHUD() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.shadowBlur = 0;
    ctx.font = 'bold 16px "Segoe UI", sans-serif';
    ctx.textBaseline = 'top';

    ctx.fillStyle = 'rgba(200, 182, 255, 0.9)';
    ctx.fillText(`PONTOS: ${score}`, 24, 24);

    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255, 200, 220, 0.6)';
    ctx.fillText(`MELHOR: ${bestScore}`, 24, 48);

    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(162, 210, 255, 0.9)';
    ctx.fillText(`TAMANHO: ${Math.round(player.size)}`, 24, 72);

    // Barra de fome
    const barW = 220, barH = 16;
    const barX = W - barW - 24, barY = 24;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(barX, barY, barW, barH);

    const hungerPct = player.hunger / CONFIG.hungerMax;
    const hungerColor = hungerPct > 0.5 ? '184, 224, 210'
                       : hungerPct > 0.25 ? '255, 214, 165'
                       : '255, 130, 130';
    ctx.shadowColor = `rgba(${hungerColor}, 0.9)`;
    ctx.shadowBlur = 10;
    ctx.fillStyle = `rgba(${hungerColor}, 0.85)`;
    ctx.fillRect(barX, barY, barW * hungerPct, barH);

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText('FOME', barX + 8, barY + 2);

    // Dash
    const dashReady = player.dashCooldownTimer <= 0;
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillStyle = dashReady ? 'rgba(184, 224, 210, 0.85)' : 'rgba(120, 120, 140, 0.5)';
    ctx.fillText(dashReady ? '🖱️ CLIQUE = DASH (pronto)' : '🖱️ CLIQUE = DASH (recarregando)', 24, 96);

    // Invulnerabilidade
    if (player.invulnTimer > 0) {
        ctx.save();
        ctx.shadowColor = 'rgba(162, 210, 255, 0.9)';
        ctx.shadowBlur = 12;
        ctx.fillStyle = 'rgba(162, 210, 255, 1)';
        ctx.font = 'bold 13px "Segoe UI", sans-serif';
        ctx.fillText(`🛡️ INVULNERÁVEL: ${player.invulnTimer.toFixed(1)}s`, 24, 120);
        ctx.restore();
    }

    // Legenda
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(120, 255, 150, 0.7)';
    ctx.fillText('● verde = você pode comer', 24, H - 40);
    ctx.fillStyle = 'rgba(255, 80, 80, 0.7)';
    ctx.fillText('● vermelho = pode te comer', 24, H - 22);

    ctx.restore();
}

function drawGameOver() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const elapsed = (performance.now() - gameOverTime) / 1000;
    const alpha = Math.min(1, elapsed * 2);

    ctx.fillStyle = `rgba(5, 8, 16, ${alpha * 0.8})`;
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = 'rgba(255, 130, 130, 0.9)';
    ctx.shadowBlur = 30;
    ctx.fillStyle = `rgba(255, 200, 220, ${alpha})`;
    ctx.font = 'bold 56px "Segoe UI", sans-serif';
    ctx.fillText('DEVORADO', W / 2, H / 2 - 80);

    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(200, 182, 255, 0.8)';
    ctx.fillStyle = `rgba(200, 182, 255, ${alpha})`;
    ctx.font = 'bold 28px "Segoe UI", sans-serif';
    ctx.fillText(`Pontos: ${score}`, W / 2, H / 2);

    ctx.shadowColor = 'rgba(255, 200, 220, 0.7)';
    ctx.fillStyle = `rgba(255, 200, 220, ${alpha * 0.85})`;
    ctx.font = '20px "Segoe UI", sans-serif';
    ctx.fillText(`Melhor: ${bestScore}`, W / 2, H / 2 + 40);

    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha * (0.6 + Math.sin(performance.now() * 0.005) * 0.4)})`;
    ctx.font = '16px "Segoe UI", sans-serif';
    ctx.fillText('Aperte R ou Enter para jogar de novo', W / 2, H / 2 + 100);

    ctx.restore();
}

function drawCursor() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.shadowColor = 'rgba(200, 182, 255, 0.9)';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = 'rgba(200, 182, 255, 0.95)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(mouse.x - 9, mouse.y);
    ctx.lineTo(mouse.x + 9, mouse.y);
    ctx.moveTo(mouse.x, mouse.y - 9);
    ctx.lineTo(mouse.x, mouse.y + 9);
    ctx.stroke();
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 200, 220, 0.55)';
    ctx.lineWidth = 1;
    ctx.arc(mouse.x, mouse.y, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = 'rgba(255, 200, 220, 0.95)';
    ctx.arc(mouse.x, mouse.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// ══════════════════════════════════════════════════════════════
//   12. INICIALIZAÇÃO E LOOP
// ══════════════════════════════════════════════════════════════

// Listas das criaturas decorativas
const crabs = [];
const jellyfishes = [];
const shrimps = [];
const starfishes = [];
const turtles = [];
const bubbles = [];

function initDecorativeCreatures() {
    crabs.length = 0;
    for (let i = 0; i < 2; i++) crabs.push(new Crab(150 + i * (W - 300) / 2 + Math.random() * 100));

    jellyfishes.length = 0;
    for (let i = 0; i < 3; i++) jellyfishes.push(new Jellyfish(200 + i * (W - 400) / 2 + Math.random() * 100));

    shrimps.length = 0;
    for (let i = 0; i < 4; i++) shrimps.push(new Shrimp(100 + Math.random() * (W - 200)));

    starfishes.length = 0;
    for (let i = 0; i < 3; i++) starfishes.push(new Starfish(100 + Math.random() * (W - 200)));

    turtles.length = 0;
    for (let i = 0; i < 2; i++) {
        const t = new Turtle();
        t.active = false;
        t.x = -200;
        turtles.push(t);
    }

    bubbles.length = 0;
    for (let i = 0; i < 40; i++) bubbles.push(new Bubble());
}

function initGame() {
    npcs = [];
    particles = [];
    respawnQueue = [];
    score = 0;
    dangerLevel = 0;
    gameState = 'playing';

    player = new Player();
    camera.zoom = CONFIG.zoomBase;
    worldOffset.x = 0;
    worldOffset.y = 0;

    for (let i = 0; i < CONFIG.npcCount; i++) spawnNPC();

    let smallCount = npcs.filter(n => n.size < player.size * 0.9).length;
    let attempts = 0;
    while (smallCount < 4 && attempts < 50) {
        spawnNPC();
        smallCount = npcs.filter(n => n.size < player.size * 0.9).length;
        attempts++;
    }

    initDecorativeCreatures();
}

function restartGame() { initGame(); }

// Inicialização
initGame();

// ── LOOP PRINCIPAL ───────────────────────────────────────────
function loop() {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    const t = (now - startTime) * 0.001;

    // ═══ ATUALIZAÇÕES ═══
    if (gameState === 'playing') {
        player.update(dt);
        const allFish = [player, ...npcs];
        for (const npc of npcs) npc.update(dt, allFish);
        checkEat([player, ...npcs]);
        updateDangerLevel();
        updateCamera();
    } else {
        const allFish = [...npcs];
        for (const npc of npcs) npc.update(dt, allFish);
        checkEat(npcs);
        dangerLevel = 0;
    }

    // Respawns
    for (let i = respawnQueue.length - 1; i >= 0; i--) {
        if (now >= respawnQueue[i]) {
            respawnQueue.splice(i, 1);
            spawnNPC();
        }
    }

    // Criaturas decorativas
    for (const c of crabs) c.update(dt);
    for (const j of jellyfishes) j.update(t);
    for (const s of shrimps) s.update(dt);
    for (const s of starfishes) s.update();
    for (const tu of turtles) {
        tu.update(dt);
        if (!tu.active && Math.random() < 0.002) tu.reset();
    }
    for (const b of bubbles) b.update(t);

    updateParticles();

    // ═══ DESENHO ═══
    updateWorldOffset();

    // 1. Fundo fixo
    drawBackground();

    // 2. Aplica câmera (zoom + centralização no jogador)
    applyCamera();

    // 3. Camadas de parallax
    drawGodRays(t);
    drawPlankton(t);
    drawRochas();
    drawCorais(t);
    drawAlgas(t);
    drawSeafloor();

    // 4. Criaturas decorativas
    for (const s of shrimps) s.draw(t);
    for (const s of starfishes) s.draw(t);
    for (const c of crabs) c.draw();
    for (const j of jellyfishes) j.draw(t);
    for (const tu of turtles) tu.draw();
    for (const b of bubbles) b.draw();

    // 5. Peixes
    for (const npc of npcs) npc.draw();
    if (player && player.alive) player.draw();

    // 6. Partículas
    drawParticles();

    // 7. Efeitos de tela (volta a coords de tela)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawVignette();
    drawDangerBorder();

    if (gameState === 'playing') {
        drawHUD();
        drawCursor();
    } else {
        drawGameOver();
    }

    requestAnimationFrame(loop);
}

loop();