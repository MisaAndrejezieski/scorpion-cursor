// ============================================================
//   NEON FISH — v2.0
//   Cenário de fundo do mar + peixes + NPCs vivos
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

// --- Mouse ---
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

// ============================================================
//   Paleta de cores (neon pastel)
// ============================================================
const PALETTES = [
    { body: '#c8b6ff', fin: '#ffc8dd', glow: '200, 182, 255' },
    { body: '#a2d2ff', fin: '#b8e0d2', glow: '162, 210, 255' },
    { body: '#ffd6a5', fin: '#ffafcc', glow: '255, 214, 165' },
    { body: '#b8e0d2', fin: '#c8b6ff', glow: '184, 224, 210' },
    { body: '#ffafcc', fin: '#a2d2ff', glow: '255, 175, 204' },
];

// ============================================================
//   CENÁRIO — Fundo com gradiente vertical (abissal)
// ============================================================
function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0f1a2e');
    grad.addColorStop(0.5, '#0a1220');
    grad.addColorStop(1, '#050810');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
}

// ============================================================
//   CENÁRIO — Raios de luz (god rays)
// ============================================================
const godRays = [];
function initGodRays() {
    godRays.length = 0;
    const count = 7;
    for (let i = 0; i < count; i++) {
        godRays.push({
            x: (i / (count - 1)) * W + (Math.random() - 0.5) * 100,
            width: 60 + Math.random() * 120,
            alpha: 0.03 + Math.random() * 0.05,
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
        grad.addColorStop(0, `rgba(180, 220, 255, ${ray.alpha})`);
        grad.addColorStop(0.5, `rgba(140, 200, 255, ${ray.alpha * 0.5})`);
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

// ============================================================
//   CENÁRIO — Plâncton (partículas de fundo)
// ============================================================
const plankton = [];
function initPlankton() {
    plankton.length = 0;
    for (let i = 0; i < 120; i++) {
        plankton.push({
            x: Math.random() * W,
            y: Math.random() * H,
            vx: (Math.random() - 0.5) * 0.15,
            vy: (Math.random() - 0.5) * 0.15,
            r: 0.6 + Math.random() * 1.4,
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

// ============================================================
//   CENÁRIO — Vinheta (borda escura)
// ============================================================
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

// ============================================================
//   NPC 1 — Alga balançando
// ============================================================
class Seaweed {
    constructor(x) {
        this.x = x;
        this.baseY = H - 10;
        this.height = 80 + Math.random() * 100;
        this.blades = 3 + Math.floor(Math.random() * 3);
        this.phase = Math.random() * Math.PI * 2;
        this.hue = Math.random() < 0.5 ? '140, 200, 160' : '120, 180, 140';
    }
    update(t) {}
    draw(t) {
        for (let i = 0; i < this.blades; i++) {
            const offset = (i - (this.blades - 1) / 2) * 6;
            const phase = this.phase + i * 0.6;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(${this.hue}, 0.5)`;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';

            const x0 = this.x + offset;
            const y0 = this.baseY;
            ctx.moveTo(x0, y0);

            const segments = 6;
            for (let s = 1; s <= segments; s++) {
                const p = s / segments;
                const sway = Math.sin(t * 1.2 + phase + p * 2) * p * 20;
                const y = y0 - this.height * p;
                const x = x0 + sway;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
    }
}

// ============================================================
//   NPC 2 — Estrela-do-mar
// ============================================================
class Starfish {
    constructor(x) {
        this.x = x;
        this.y = H - 30 - Math.random() * 20;
        this.size = 12 + Math.random() * 8;
        this.rotation = Math.random() * Math.PI * 2;
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.color = Math.random() < 0.5
            ? '255, 214, 165'   // amarelo pastel
            : '255, 175, 204';  // rosa pastel
    }
    update(t) {}
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
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}

// ============================================================
//   NPC 3 — Caranguejo
// ============================================================
class Crab {
    constructor(x) {
        this.x = x;
        this.y = H - 25;
        this.dir = Math.random() < 0.5 ? -1 : 1;
        this.speed = 0.4 + Math.random() * 0.3;
        this.state = 'walking'; // walking | paused
        this.stateTimer = 3 + Math.random() * 5;
        this.legPhase = 0;
        this.color = '255, 175, 204';
    }
    update(dt) {
        this.stateTimer -= dt;

        if (this.state === 'walking') {
            this.x += this.dir * this.speed;
            this.legPhase += dt * 8;

            if (this.x < 60 || this.x > W - 60) {
                this.dir *= -1;
            }
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

        // Patas (3 de cada lado, animadas)
        ctx.strokeStyle = `rgba(${this.color}, 0.7)`;
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
            const lx = -s * 0.3 + i * 4;
            const legSwing = Math.sin(this.legPhase + i * 1.5) * 2;

            ctx.beginPath();
            ctx.moveTo(lx, 2);
            ctx.lineTo(lx - 2, 8 + legSwing);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(lx, -2);
            ctx.lineTo(lx - 2, -8 - legSwing);
            ctx.stroke();
        }

        // Corpo
        ctx.fillStyle = `rgba(${this.color}, 0.9)`;
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.8, s * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pinças
        ctx.fillStyle = `rgba(${this.color}, 0.85)`;
        ctx.beginPath();
        ctx.arc(s * 0.9, -4, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(s * 0.9, 4, 3, 0, Math.PI * 2);
        ctx.fill();

        // Olhos
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#0a0a14';
        ctx.beginPath();
        ctx.arc(s * 0.3, -2, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(s * 0.3, 2, 1.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// ============================================================
//   NPC 4 — Medusa
// ============================================================
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
            const ty = Math.sin(angle) * s * 0.15 + s * 0.6;

            ctx.beginPath();
            ctx.moveTo(this.x + tx, this.y + s * 0.3);
            const waveX = Math.sin(t * 2 + i) * 4;
            const waveY = Math.cos(t * 2 + i) * 3;
            ctx.quadraticCurveTo(
                this.x + tx + waveX,
                this.y + s * 1.2 + waveY,
                this.x + tx + waveX * 2,
                this.y + s * 2 + waveY
            );
            ctx.stroke();
        }

        // Cúpula (sino)
        ctx.shadowColor = `rgba(${this.color}, 0.9)`;
        ctx.shadowBlur = 18;
        ctx.fillStyle = `rgba(${this.color}, 0.25)`;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, s, s * 0.7, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(${this.color}, 0.7)`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Brilho interno
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(255, 255, 255, 0.3)`;
        ctx.beginPath();
        ctx.ellipse(this.x - s * 0.3, this.y - s * 0.25, s * 0.2, s * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ============================================================
//   NPC 5 — Bolhas
// ============================================================
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

// ============================================================
//   Peixe (jogador)
// ============================================================
const particles = [];
function spawnTrail(x, y, colorRgb) {
    particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        life: 1,
        r: 1 + Math.random() * 2,
        color: colorRgb
    });
}
function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        if (p.life <= 0) particles.splice(i, 1);
    }
}
function drawParticles() {
    for (const p of particles) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(${p.color}, ${p.life * 0.6})`;
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Fish {
    constructor(palette, offset) {
        this.palette = palette;
        this.offset = offset;
        this.x = Math.random() * W;
        this.y = Math.random() * H;
        this.vx = 0;
        this.vy = 0;
        this.angle = 0;
        this.maxSpeed = 2.2;
        this.maxForce = 0.05;
        this.size = 22 + Math.random() * 8;
        this.tailPhase = Math.random() * Math.PI * 2;
    }
    seek(target) {
        let dx = target.x - this.x;
        let dy = target.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        const speed = Math.min(this.maxSpeed, d * 0.02);
        let desiredX = (dx / d) * speed;
        let desiredY = (dy / d) * speed;
        let steerX = desiredX - this.vx;
        let steerY = desiredY - this.vy;
        const sMag = Math.hypot(steerX, steerY);
        if (sMag > this.maxForce) {
            steerX = (steerX / sMag) * this.maxForce;
            steerY = (steerY / sMag) * this.maxForce;
        }
        this.vx += steerX;
        this.vy += steerY;
        const vMag = Math.hypot(this.vx, this.vy);
        if (vMag > this.maxSpeed) {
            this.vx = (this.vx / vMag) * this.maxSpeed;
            this.vy = (this.vy / vMag) * this.maxSpeed;
        }
    }
    update() {
        const target = {
            x: mouse.x + Math.cos(this.offset) * 60,
            y: mouse.y + Math.sin(this.offset) * 60
        };
        this.seek(target);
        this.x += this.vx;
        this.y += this.vy;
        const targetAngle = Math.atan2(this.vy, this.vx);
        let diff = targetAngle - this.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.angle += diff * 0.08;
        const speed = Math.hypot(this.vx, this.vy);
        this.tailPhase += 0.15 + speed * 0.1;
        if (speed > 0.5 && Math.random() < 0.3) {
            spawnTrail(
                this.x - Math.cos(this.angle) * this.size * 0.8,
                this.y - Math.sin(this.angle) * this.size * 0.8,
                this.palette.glow
            );
        }
        const margin = 25;
        if (this.x < margin) { this.x = margin; this.vx = Math.abs(this.vx) * 0.6; }
        if (this.x > W - margin) { this.x = W - margin; this.vx = -Math.abs(this.vx) * 0.6; }
        if (this.y < margin) { this.y = margin; this.vy = Math.abs(this.vy) * 0.6; }
        if (this.y > H - margin) { this.y = H - margin; this.vy = -Math.abs(this.vy) * 0.6; }
    }
    draw() {
        const s = this.size;
        const wag = Math.sin(this.tailPhase) * 0.4;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.shadowColor = `rgba(${this.palette.glow}, 0.9)`;
        ctx.shadowBlur = 18;
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
}

// ============================================================
//   Cursor personalizado
// ============================================================
function drawCursor() {
    ctx.save();
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
//   Inicialização de tudo
// ============================================================
const school = [];
for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    school.push(new Fish(PALETTES[i % PALETTES.length], angle));
}

const bubbles = [];
for (let i = 0; i < 40; i++) bubbles.push(new Bubble());

const seaweeds = [];
for (let i = 0; i < 6; i++) {
    seaweeds.push(new Seaweed(80 + (i / 5) * (W - 160) + (Math.random() - 0.5) * 80));
}

const starfishes = [];
for (let i = 0; i < 3; i++) {
    starfishes.push(new Starfish(100 + Math.random() * (W - 200)));
}

const crabs = [];
for (let i = 0; i < 2; i++) {
    crabs.push(new Crab(150 + i * (W - 300) / 2 + Math.random() * 100));
}

const jellyfishes = [];
for (let i = 0; i < 3; i++) {
    jellyfishes.push(new Jellyfish(200 + i * (W - 400) / 2 + Math.random() * 100));
}

initGodRays();
initPlankton();

// ============================================================
//   Loop principal
// ============================================================
let startTime = performance.now();
let lastTime = startTime;

function loop() {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    const t = (now - startTime) * 0.001;

    // 1. Fundo
    drawBackground();

    // 2. Raios de luz
    drawGodRays(t);

    // 3. Plâncton
    updatePlankton(t);
    drawPlankton();

    // 4. Algas (atrás de tudo)
    for (const s of seaweeds) s.draw(t);

    // 5. Estrelas-do-mar (no chão)
    for (const s of starfishes) s.draw(t);

    // 6. Caranguejos (no chão, na frente das estrelas)
    for (const c of crabs) { c.update(dt); c.draw(); }

    // 7. Bolhas (meio do aquário)
    for (const b of bubbles) { b.update(t); b.draw(); }

    // 8. Medusas (meio do aquário)
    for (const j of jellyfishes) { j.update(t); j.draw(t); }

    // 9. Rastro dos peixes
    updateParticles();
    drawParticles();

    // 10. Peixes (jogador)
    for (const f of school) { f.update(); f.draw(); }

    // 11. Vinheta
    drawVignette();

    // 12. Cursor
    drawCursor();

    requestAnimationFrame(loop);
}
loop();