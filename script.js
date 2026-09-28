// ============================================================
//   NEON FISH — v2.0
//   Cenário de fundo do mar + peixes que seguem o mouse
//   (NPCs entram nas próximas versões)
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
    { body: '#c8b6ff', fin: '#ffc8dd', glow: '200, 182, 255' },  // lavanda/rosa
    { body: '#a2d2ff', fin: '#b8e0d2', glow: '162, 210, 255' },  // ciano/menta
    { body: '#ffd6a5', fin: '#ffafcc', glow: '255, 214, 165' },  // amarelo/pêssego
    { body: '#b8e0d2', fin: '#c8b6ff', glow: '184, 224, 210' },  // menta/lavanda
    { body: '#ffafcc', fin: '#a2d2ff', glow: '255, 175, 204' },  // rosa/ciano
];

// ============================================================
//   CENÁRIO 1: Raios de luz (god rays)
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
//   CENÁRIO 2: Plâncton (partículas flutuando)
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

        // Envolve nas bordas
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
//   CENÁRIO 3: Vinheta (borda escura)
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
//   CENÁRIO 4: Fundo com gradiente vertical
// ============================================================
function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0f1a2e');     // azul mais claro em cima (luz do sol)
    grad.addColorStop(0.5, '#0a1220');   // meio
    grad.addColorStop(1, '#050810');     // quase preto embaixo (abissal)
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
}

// ============================================================
//   Bolhas de fundo (já existiam, mantidas)
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

        // Highlight pequeno (efeito de vidro)
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha * 0.8})`;
        ctx.arc(this.x - this.r * 0.3, this.y - this.r * 0.3, this.r * 0.25, 0, Math.PI * 2);
        ctx.fill();
    }
}

const bubbles = [];
for (let i = 0; i < 40; i++) bubbles.push(new Bubble());

// ============================================================
//   Partículas de rastro (nos peixes)
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

// ============================================================
//   Peixe (mantido, com "aquário fechado" — quica nas bordas)
// ============================================================
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
        this.perception = 200;

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

        // ========================================
        // AQUÁRIO FECHADO: quica nas bordas
        // (substitui o antigo wraparound)
        // ========================================
        const margin = 25;
        if (this.x < margin) {
            this.x = margin;
            this.vx = Math.abs(this.vx) * 0.6;
        }
        if (this.x > W - margin) {
            this.x = W - margin;
            this.vx = -Math.abs(this.vx) * 0.6;
        }
        if (this.y < margin) {
            this.y = margin;
            this.vy = Math.abs(this.vy) * 0.6;
        }
        if (this.y > H - margin) {
            this.y = H - margin;
            this.vy = -Math.abs(this.vy) * 0.6;
        }
    }

    draw() {
        const s = this.size;
        const wag = Math.sin(this.tailPhase) * 0.4;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        ctx.shadowColor = `rgba(${this.palette.glow}, 0.9)`;
        ctx.shadowBlur = 18;

        // Cauda
        ctx.beginPath();
        ctx.fillStyle = this.palette.fin;
        ctx.moveTo(-s * 0.9, 0);
        ctx.quadraticCurveTo(
            -s * 1.4, -s * 0.5 + wag * s * 0.6,
            -s * 1.7, wag * s * 0.8
        );
        ctx.quadraticCurveTo(
            -s * 1.4, s * 0.5 + wag * s * 0.6,
            -s * 0.9, 0
        );
        ctx.fill();

        // Corpo
        ctx.beginPath();
        ctx.fillStyle = this.palette.body;
        ctx.ellipse(0, 0, s, s * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();

        // Nadadeira superior
        ctx.beginPath();
        ctx.fillStyle = this.palette.fin;
        ctx.moveTo(-s * 0.1, -s * 0.5);
        ctx.quadraticCurveTo(0, -s * 1.1, s * 0.4, -s * 0.4);
        ctx.fill();

        // Nadadeira inferior
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
}

// ============================================================
//   Cursor personalizado (cruz neon)
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
//   Cria o cardume
// ============================================================
const school = [];
const fishCount = 5;
for (let i = 0; i < fishCount; i++) {
    const angle = (i / fishCount) * Math.PI * 2;
    school.push(new Fish(PALETTES[i % PALETTES.length], angle));
}

// ============================================================
//   Init do cenário
// ============================================================
initGodRays();
initPlankton();
window.addEventListener('resize', () => {
    initGodRays();
    initPlankton();
});

// ============================================================
//   Loop principal
// ============================================================
let startTime = performance.now();

function loop() {
    const t = (performance.now() - startTime) * 0.001; // tempo em segundos

    // 1. Fundo (gradiente vertical)
    drawBackground();

    // 2. Raios de luz (god rays)
    drawGodRays(t);

    // 3. Plâncton (partículas de fundo)
    updatePlankton(t);
    drawPlankton();

    // 4. Bolhas subindo
    for (const b of bubbles) { b.update(t); b.draw(); }

    // 5. Partículas de rastro dos peixes
    updateParticles();
    drawParticles();

    // 6. Peixes
    for (const f of school) { f.update(); f.draw(); }

    // 7. Vinheta (borda escura, por cima de tudo)
    drawVignette();

    // 8. Cursor personalizado (por cima de TUDO)
    drawCursor();

    requestAnimationFrame(loop);
}
loop();