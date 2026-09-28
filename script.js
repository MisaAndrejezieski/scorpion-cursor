// ============================================================
//   NEON FISH — v3.2
//   Predador + cenário de fundo do mar + câmera dinâmica
// ============================================================

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let W, H;
function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// ============================================================
//   Configurações
// ============================================================
const CONFIG = {
    npcCount: 12,
    playerStartSize: 24,
    npcMinSize: 12,
    npcMaxSize: 45,
    eatRatio: 0.85,
    speedBase: 2.4,
    hungerMax: 100,
    hungerDrain: 0.25,
    hungerPerEat: 35,
    growthPerEat: 0.18,
    dashMultiplier: 3.5,
    dashDuration: 0.25,
    dashCooldown: 0.8,
    respawnDelay: 1.5,
    playerInvuln: 3.0,
    safeSpawnDist: 250,
    // Câmera:
    zoomBase: 1.0,       // zoom quando você é pequeno
    zoomMin: 0.55,       // zoom mínimo (máximo de afastamento)
    zoomReference: 60    // tamanho de referência para atingir o zoomMin
};

// ============================================================
//   Mouse / teclado
// ============================================================
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

// ============================================================
//   Paletas
// ============================================================
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

// ============================================================
//   Estado
// ============================================================
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

// Câmera
let camera = { x: 0, y: 0, zoom: 1 };

// ============================================================
//   Cenário — Corais e algas decorativas
// ============================================================
const corais = [];
function initCorais() {
    corais.length = 0;
    for (let i = 0; i < 10; i++) {
        corais.push({
            x: Math.random() * W,
            baseY: H - 20 - Math.random() * 30,
            height: 40 + Math.random() * 90,
            width: 20 + Math.random() * 25,
            hue: ['120, 200, 160', '255, 175, 204', '200, 182, 255', '255, 214, 165'][Math.floor(Math.random() * 4)],
            phase: Math.random() * Math.PI * 2
        });
    }
}
function drawCorais(t) {
    for (const c of corais) {
        ctx.save();
        // Talo
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${c.hue}, 0.35)`;
        ctx.lineWidth = 4;
        ctx.moveTo(c.x, c.baseY);
        const sway = Math.sin(t * 0.5 + c.phase) * 4;
        ctx.quadraticCurveTo(c.x + sway * 0.5, c.baseY - c.height * 0.5,
                              c.x + sway, c.baseY - c.height);
        ctx.stroke();

        // Ramos (3 pares)
        for (let i = 1; i <= 3; i++) {
            const p = i / 4;
            const bx = c.x + sway * p;
            const by = c.baseY - c.height * p;
            const side = i % 2 === 0 ? 1 : -1;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(${c.hue}, 0.28)`;
            ctx.lineWidth = 3;
            ctx.moveTo(bx, by);
            ctx.quadraticCurveTo(
                bx + side * c.width * 0.5,
                by - 10,
                bx + side * c.width,
                by - 20
            );
            ctx.stroke();
        }
        ctx.restore();
    }
}

// Rochas no fundo
const rochas = [];
function initRochas() {
    rochas.length = 0;
    for (let i = 0; i < 12; i++) {
        const r = 15 + Math.random() * 35;
        rochas.push({
            x: Math.random() * W,
            y: H - r * 0.3 - Math.random() * 15,
            r
        });
    }
}
function drawRochas() {
    for (const r of rochas) {
        ctx.save();
        const grad = ctx.createRadialGradient(r.x, r.y - r.r * 0.4, 0, r.x, r.y, r.r);
        grad.addColorStop(0, 'rgba(60, 70, 90, 0.9)');
        grad.addColorStop(1, 'rgba(20, 25, 40, 0.9)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, r.r, r.r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Algas altas no fundo
const algas = [];
function initAlgas() {
    algas.length = 0;
    for (let i = 0; i < 8; i++) {
        const blades = 2 + Math.floor(Math.random() * 3);
        const bladesArr = [];
        for (let b = 0; b < blades; b++) {
            bladesArr.push({
                offset: (b - (blades - 1) / 2) * 8,
                height: 60 + Math.random() * 100,
                phase: Math.random() * Math.PI * 2,
                width: 3 + Math.random() * 2
            });
        }
        algas.push({
            x: 40 + Math.random() * (W - 80),
            baseY: H - 5,
            blades: bladesArr,
            hue: Math.random() < 0.5 ? '140, 200, 160' : '100, 170, 150'
        });
    }
}
function drawAlgas(t) {
    for (const a of algas) {
        for (const b of a.blades) {
            const x0 = a.x + b.offset;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(${a.hue}, 0.5)`;
            ctx.lineWidth = b.width;
            ctx.lineCap = 'round';
            ctx.moveTo(x0, a.baseY);

            const segments = 6;
            for (let s = 1; s <= segments; s++) {
                const p = s / segments;
                const sway = Math.sin(t * 1.2 + b.phase + p * 2) * p * 18;
                const y = a.baseY - b.height * p;
                const x = x0 + sway;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
    }
}

// Textura do chão (areia/limo)
function drawSeafloor() {
    const grad = ctx.createLinearGradient(0, H - 80, 0, H);
    grad.addColorStop(0, 'rgba(30, 40, 60, 0)');
    grad.addColorStop(0.4, 'rgba(25, 32, 50, 0.5)');
    grad.addColorStop(1, 'rgba(15, 20, 35, 0.9)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, H - 80, W, 80);

    // Brilho no fundo
    ctx.save();
    ctx.shadowColor = 'rgba(120, 180, 220, 0.15)';
    ctx.shadowBlur = 20;
    ctx.fillStyle = 'rgba(80, 130, 180, 0.15)';
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 40) {
        const y = H - 30 - Math.sin(x * 0.01) * 15 - Math.random() * 8;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

// Raios de luz do topo (mais visíveis agora)
const godRays = [];
function initGodRays() {
    godRays.length = 0;
    for (let i = 0; i < 8; i++) {
        godRays.push({
            x: (i / 7) * W + (Math.random() - 0.5) * 100,
            width: 60 + Math.random() * 130,
            alpha: 0.05 + Math.random() * 0.07,
            speed: 0.02 + Math.random() * 0.04,
            phase: Math.random() * Math.PI * 2,
            length: H * (0.7 + Math.random() * 0.3)
        });
    }
}
function drawGodRays(t) {
    for (const ray of godRays) {
        const offset = Math.sin(t * ray.speed + ray.phase) * 30;
        const x = ray.x + offset;
        const grad = ctx.createLinearGradient(x, 0, x + ray.width * 0.5, ray.length);
        grad.addColorStop(0, `rgba(180, 220, 255, ${ray.alpha * 1.4})`);
        grad.addColorStop(0.5, `rgba(140, 200, 255, ${ray.alpha * 0.6})`);
        grad.addColorStop(1, 'rgba(140, 200, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + ray.width, 0);
        ctx.lineTo(x + ray.width + ray.width * 0.4, ray.length);
        ctx.lineTo(x - ray.width * 0.2, ray.length);
        ctx.closePath();
        ctx.fill();
    }
}

// Reflexos de onda no topo
function drawSurface(t) {
    ctx.save();
    const grad = ctx.createLinearGradient(0, 0, 0, 60);
    grad.addColorStop(0, 'rgba(120, 180, 255, 0.25)');
    grad.addColorStop(1, 'rgba(120, 180, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, 60);
    ctx.restore();
}

// Plâncton
const plankton = [];
function initPlankton() {
    plankton.length = 0;
    for (let i = 0; i < 130; i++) {
        plankton.push({
            x: Math.random() * W,
            y: Math.random() * H,
            vx: (Math.random() - 0.5) * 0.15,
            vy: (Math.random() - 0.5) * 0.15,
            r: 0.5 + Math.random() * 1.6,
            alpha: 0.15 + Math.random() * 0.35,
            phase: Math.random() * Math.PI * 2
        });
    }
}
function updatePlankton(t) {
    for (const p of plankton) {
        p.x += p.vx + Math.sin(t * 0.5 + p.phase) * 0.05;
        p.y += p.vy + Math.cos(t * 0.4 + p.phase) * 0.05;
        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;
    }
}
function drawPlankton() {
    for (const p of plankton) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(200, 230, 255, ${p.alpha})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
    }
}

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

// ============================================================
//   Partículas
// ============================================================
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

// ============================================================
//   Classe base — Fish
// ============================================================
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

    clampToBounds(margin = 20) {
        if (this.x < margin) { this.x = margin; this.vx = Math.abs(this.vx) * 0.6; }
        if (this.x > W - margin) { this.x = W - margin; this.vx = -Math.abs(this.vx) * 0.6; }
        if (this.y < margin) { this.y = margin; this.vy = Math.abs(this.vy) * 0.6; }
        if (this.y > H - margin) { this.y = H - margin; this.vy = -Math.abs(this.vy) * 0.6; }
    }

    drawBody() {
        const s = this.size;
        const wag = Math.sin(this.tailPhase) * 0.4;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        ctx.shadowColor = `rgba(${this.palette.glow}, 0.9)`;
        ctx.shadowBlur = 12 + this.size * 0.3;

        ctx.beginPath();
        ctx.fillStyle = this.palette.fin;
        ctx.moveTo(-s * 0.9, 0);
        ctx.quadraticCurveTo(-s * 1.4, -s * 0.5 + wag * s * 0.6, -s * 1.7, wag * s * 0.8);
        ctx.quadraticCurveTo(-s * 1.4, s * 0.5 + wag * s * 0.6, -s * 0.9, 0);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = this.palette.body;
        ctx.ellipse(0, 0, s, s * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();

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

// ============================================================
//   Jogador
// ============================================================
class Player extends Fish {
    constructor() {
        super(W / 2, H / 2, CONFIG.playerStartSize, {
            body: '#fff0c8',
            fin: '#ffc8dd',
            glow: '255, 240, 200'
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
            for (let i = 0; i < 10; i++) {
                spawnBurst(this.x, this.y, '255, 240, 200', 1);
            }
        }
    }

    update(dt) {
        if (!this.alive) return;
        if (this.invulnTimer > 0) this.invulnTimer -= dt;

        this.hunger -= CONFIG.hungerDrain * dt;
        if (this.hunger <= 0) {
            this.hunger = 0;
            this.die('fome');
            return;
        }

        if (this.dashTimer > 0) this.dashTimer -= dt;
        if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= dt;

        const sizePenalty = 1 - Math.min(0.5, (this.size - 15) / 100);
        let maxSpeed = CONFIG.speedBase * sizePenalty;
        if (this.dashTimer > 0) maxSpeed *= CONFIG.dashMultiplier;

        this.steerTo(mouse.x, mouse.y, maxSpeed, 0.15);
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

        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = `rgba(255, 240, 200, ${0.5 + Math.sin(t * 3) * 0.3})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(255, 240, 200, 0.9)';
        ctx.shadowBlur = 15;
        ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

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

// ============================================================
//   NPC
// ============================================================
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
                    const sizeAdvantage = this.size / playerRef.size;
                    this.threatLevel = Math.min(1, (1 - dist / perception) * sizeAdvantage * 0.7);
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
                    const otherCanEatMe = other.size > this.size / CONFIG.eatRatio;
                    const iCanEatOther = this.size > other.size / CONFIG.eatRatio;

                    if (otherCanEatMe && !iCanEatOther) {
                        this.wanderTarget = { x: this.x - dx * 1.5, y: this.y - dy * 1.5 };
                        this.fleeing = true;
                        maxSpeed *= 1.15;
                        break;
                    } else if (iCanEatOther && !this.fleeing) {
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
            if (p.size > this.size / CONFIG.eatRatio) {
                ctx.save();
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(120, 255, 150, 0.55)';
                ctx.lineWidth = 1.5;
                ctx.arc(this.x, this.y, this.size * 1.4, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
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

// ============================================================
//   Spawn
// ============================================================
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

// ============================================================
//   Comer
// ============================================================
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
            const threshold = a.size * 0.9 + b.size * 0.4;
            if (d > threshold) continue;

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

// ============================================================
//   Perigo
// ============================================================
function updateDangerLevel() {
    if (!player || !player.alive) { dangerLevel = 0; return; }
    let maxThreat = 0;
    for (const npc of npcs) {
        if (npc.threatLevel > maxThreat) maxThreat = npc.threatLevel;
    }
    dangerLevel += (maxThreat - dangerLevel) * 0.15;
}

// ============================================================
//   Zoom dinâmico (conforme o jogador cresce, a câmera se afasta)
// ============================================================
function updateCamera() {
    if (!player) return;
    // Zoom diminui conforme o tamanho aumenta
    const growth = Math.min(1, (player.size - CONFIG.playerStartSize) /
                              (CONFIG.zoomReference - CONFIG.playerStartSize));
    const targetZoom = CONFIG.zoomBase - (CONFIG.zoomBase - CONFIG.zoomMin) * growth;
    camera.zoom += (targetZoom - camera.zoom) * 0.05;
}

// Aplica a câmera: zoom + centralização no jogador
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

// Como o mundo visual agora é maior que a tela em zoom out,
// vamos "esticar" o fundo/raios/etc para preencher a tela virtual.
function getVirtualBounds() {
    const z = camera.zoom;
    const halfW = W / (2 * z);
    const halfH = H / (2 * z);
    if (!player) return { left: 0, top: 0, right: W, bottom: H, width: W, height: H };
    return {
        left: player.x - halfW,
        top: player.y - halfH,
        right: player.x + halfW,
        bottom: player.y + halfH,
        width: halfW * 2,
        height: halfH * 2
    };
}

// ============================================================
//   HUD
// ============================================================
function drawHUD() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // HUD sempre em coords de tela

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

    const barW = 220;
    const barH = 16;
    const barX = W - barW - 24;
    const barY = 24;

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

    const dashReady = player.dashCooldownTimer <= 0;
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillStyle = dashReady ? 'rgba(184, 224, 210, 0.85)' : 'rgba(120, 120, 140, 0.5)';
    ctx.fillText(dashReady ? '🖱️ CLIQUE = DASH (pronto)' : '🖱️ CLIQUE = DASH (recarregando)', 24, 96);

    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(120, 255, 150, 0.7)';
    ctx.fillText('● verde = você pode comer', 24, H - 40);
    ctx.fillStyle = 'rgba(255, 80, 80, 0.7)';
    ctx.fillText('● vermelho = pode te comer', 24, H - 22);

    ctx.restore();
}

// ============================================================
//   Game Over
// ============================================================
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

// ============================================================
//   Cursor
// ============================================================
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

// ============================================================
//   Init / Restart
// ============================================================
function initGame() {
    npcs = [];
    particles = [];
    respawnQueue = [];
    score = 0;
    dangerLevel = 0;
    gameState = 'playing';

    player = new Player();
    camera.zoom = CONFIG.zoomBase;

    for (let i = 0; i < CONFIG.npcCount; i++) spawnNPC();

    let smallCount = npcs.filter(n => n.size < player.size * 0.9).length;
    let attempts = 0;
    while (smallCount < 4 && attempts < 50) {
        spawnNPC();
        smallCount = npcs.filter(n => n.size < player.size * 0.9).length;
        attempts++;
    }
}

function restartGame() { initGame(); }

// ============================================================
//   Loop
// ============================================================
initGodRays();
initPlankton();
initCorais();
initRochas();
initAlgas();
initGame();

function loop() {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    const t = (now - startTime) * 0.001;

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

    for (let i = respawnQueue.length - 1; i >= 0; i--) {
        if (now >= respawnQueue[i]) {
            respawnQueue.splice(i, 1);
            spawnNPC();
        }
    }

    updateParticles();

    // Reset de transform e limpa
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Aplica câmera
    applyCamera();
    const bounds = getVirtualBounds();

    // Desenha o cenário no espaço virtual
    // O fundo precisa cobrir a tela toda, então desenhamos em coords de tela
    // mas vamos aproveitar a câmera para escalar todos os objetos do mundo

    // Fundo (preenche sempre a tela toda, sem zoom)
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0f1a2e');
    grad.addColorStop(0.5, '#0a1220');
    grad.addColorStop(1, '#050810');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // Aplica zoom pro mundo
    applyCamera();

    // Agora desenhamos TUDO do mundo no espaço virtual escalado
    drawSurface(t);
    drawGodRays(t);
    updatePlankton(t);
    drawPlankton();

    // Cenário de fundo
    drawCorais(t);
    drawRochas();
    drawAlgas(t);
    drawSeafloor();

    for (const npc of npcs) npc.draw();
    if (player && player.alive) player.draw();

    drawParticles();

    // Volta pra coords de tela para efeitos de tela cheia
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