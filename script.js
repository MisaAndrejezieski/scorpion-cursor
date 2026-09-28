// ══════════════════════════════════════════════════════════════
//   NEON FISH — v3.3
//   Jogo de peixe predador + cenário vivo + NPCs do fundo do mar
//   + zoom dinâmico + feedback visual forte
// ══════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────
//   1. SETUP DO CANVAS
//   Pega o canvas do HTML e o contexto 2D. W e H são as dimensões
//   atuais. Sempre que a janela redimensionar, atualizamos.
// ──────────────────────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let W, H;                      // largura e altura da tela
function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// ──────────────────────────────────────────────────────────────
//   2. CONFIGURAÇÕES DO JOGO
//   Todos os "números mágicos" ficam aqui. Mude à vontade para
//   ajustar dificuldade, velocidade, tamanhos, etc.
// ──────────────────────────────────────────────────────────────
const CONFIG = {
    // --- NPCs peixes (os que perseguem/fogem de você) ---
    npcCount: 12,             // quantos peixes NPC existem ao mesmo tempo
    playerStartSize: 24,      // tamanho inicial do seu peixe
    npcMinSize: 12,           // tamanho mínimo que um NPC pode nascer
    npcMaxSize: 45,           // tamanho máximo que um NPC pode nascer
    eatRatio: 0.85,           // você come se for 15%+ maior que o outro

    // --- Movimento ---
    speedBase: 2.4,           // velocidade base de todos os peixes

    // --- Fome ---
    hungerMax: 100,           // fome máxima (barra cheia)
    hungerDrain: 0.25,        // quanto de fome perdemos por segundo
    hungerPerEat: 35,         // quanto de fome recuperamos ao comer
    growthPerEat: 0.18,       // quanto crescemos ao comer

    // --- Dash (clique do mouse) ---
    dashMultiplier: 3.5,      // velocidade extra durante o dash
    dashDuration: 0.25,       // duração do dash em segundos
    dashCooldown: 0.8,        // tempo para poder dar outro dash

    // --- Regras gerais ---
    respawnDelay: 1.5,        // segundos para um NPC morto reaparecer
    playerInvuln: 3.0,        // segundos de invulnerabilidade ao nascer
    safeSpawnDist: 250,       // distância mínima de spawn longe de você

    // --- Câmera (zoom out quando você cresce) ---
    zoomBase: 1.0,            // zoom quando você é pequeno (1.0 = normal)
    zoomMin: 0.55,            // zoom mínimo (0.55 = vê quase o dobro da área)
    zoomReference: 60         // tamanho necessário para atingir o zoomMin
};

// ──────────────────────────────────────────────────────────────
//   3. MOUSE E TECLADO
//   O mouse controla a direção do seu peixe. O clique dá dash.
//   R ou Enter reinicia quando você morre.
// ──────────────────────────────────────────────────────────────
const mouse = { x: W / 2, y: H / 2 };
window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});
// Suporte a toque (celular/tablet)
window.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    mouse.x = t.clientX;
    mouse.y = t.clientY;
}, { passive: true });

// Dash no clique
window.addEventListener('mousedown', () => {
    if (player && player.alive) player.tryDash();
});

// Reinicia com R ou Enter
window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R' || e.key === 'Enter') {
        if (gameState === 'gameover') restartGame();
    }
});

// ──────────────────────────────────────────────────────────────
//   4. PALETAS DE CORES (neon pastel)
//   Cada peixe NPC recebe uma paleta aleatória daqui.
//   Estrutura: body (corpo), fin (nadadeiras), glow (brilho RGB)
// ──────────────────────────────────────────────────────────────
const PALETTES = [
    { body: '#c8b6ff', fin: '#ffc8dd', glow: '200, 182, 255' }, // lavanda/rosa
    { body: '#a2d2ff', fin: '#b8e0d2', glow: '162, 210, 255' }, // ciano/menta
    { body: '#ffd6a5', fin: '#ffafcc', glow: '255, 214, 165' }, // amarelo/pêssego
    { body: '#b8e0d2', fin: '#c8b6ff', glow: '184, 224, 210' }, // menta/lavanda
    { body: '#ffafcc', fin: '#a2d2ff', glow: '255, 175, 204' }, // rosa/ciano
    { body: '#e0b0ff', fin: '#a2d2ff', glow: '224, 176, 255' }, // lilás/ciano
];
function randPalette() {
    return PALETTES[Math.floor(Math.random() * PALETTES.length)];
}

// ──────────────────────────────────────────────────────────────
//   5. ESTADO GLOBAL DO JOGO
//   Variáveis que mudam durante a partida.
// ──────────────────────────────────────────────────────────────
let gameState = 'playing';   // 'playing' ou 'gameover'
let player = null;           // referência ao peixe do jogador
let npcs = [];               // lista de peixes NPC
let particles = [];          // partículas visuais (rastro, explosões)
let score = 0;               // pontos da partida atual
let bestScore = 0;           // recorde da sessão
let startTime = performance.now();
let lastTime = startTime;
let gameOverTime = 0;
let respawnQueue = [];       // timestamps para NPCs renascerem
let dangerLevel = 0;         // 0..1 — quanto perigo você está correndo

// Câmera — controla o zoom e a posição
let camera = { x: 0, y: 0, zoom: 1 };

// ══════════════════════════════════════════════════════════════
//   6. CENÁRIO — ELEMENTOS DE FUNDO
//   Cada elemento tem init (cria) e draw (desenha).
//   Nada disso afeta a jogabilidade — é só decoração viva.
// ══════════════════════════════════════════════════════════════

// ── 6.1 CORAIS ────────────────────────────────────────────────
// Talo central + galhos ramificados, balançando levemente.
const corais = [];
function initCorais() {
    corais.length = 0;
    for (let i = 0; i < 10; i++) {
        corais.push({
            x: Math.random() * W,
            baseY: H - 20 - Math.random() * 30,
            height: 40 + Math.random() * 90,
            width: 20 + Math.random() * 25,
            // Cores pastel para combinar com o resto
            hue: ['120, 200, 160', '255, 175, 204', '200, 182, 255', '255, 214, 165'][Math.floor(Math.random() * 4)],
            phase: Math.random() * Math.PI * 2
        });
    }
}
function drawCorais(t) {
    for (const c of corais) {
        ctx.save();
        // Talo principal (curva quadrática)
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${c.hue}, 0.35)`;
        ctx.lineWidth = 4;
        ctx.moveTo(c.x, c.baseY);
        const sway = Math.sin(t * 0.5 + c.phase) * 4;
        ctx.quadraticCurveTo(c.x + sway * 0.5, c.baseY - c.height * 0.5,
                              c.x + sway, c.baseY - c.height);
        ctx.stroke();

        // 3 pares de galhos, alternando lados
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
                bx + side * c.width * 0.5, by - 10,
                bx + side * c.width, by - 20
            );
            ctx.stroke();
        }
        ctx.restore();
    }
}

// ── 6.2 ROCHAS ────────────────────────────────────────────────
// Elipses achatadas no chão, com gradiente para dar volume.
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
        // Gradiente radial (luz vindo de cima)
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

// ── 6.3 ALGAS ALTAS ───────────────────────────────────────────
// Tufos de folhas compridas, ondulando com "correnteza" imaginária.
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

            // Desenha a folha em segmentos (curva que balança)
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

// ── 6.4 CHÃO DO MAR ───────────────────────────────────────────
// Faixa inferior com gradiente + brilho de textura.
function drawSeafloor() {
    // Gradiente vertical (escurece para baixo)
    const grad = ctx.createLinearGradient(0, H - 80, 0, H);
    grad.addColorStop(0, 'rgba(30, 40, 60, 0)');
    grad.addColorStop(0.4, 'rgba(25, 32, 50, 0.5)');
    grad.addColorStop(1, 'rgba(15, 20, 35, 0.9)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, H - 80, W, 80);

    // Brilho de "areia molhada"
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

// ── 6.5 RAIOS DE LUZ (god rays) ───────────────────────────────
// Feixes de luz descendo do topo, ondulando suavemente.
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

// ── 6.6 REFLEXOS DA SUPERFÍCIE ────────────────────────────────
// Faixa clara no topo, como se fosse a luz do sol na água.
function drawSurface(t) {
    ctx.save();
    const grad = ctx.createLinearGradient(0, 0, 0, 60);
    grad.addColorStop(0, 'rgba(120, 180, 255, 0.25)');
    grad.addColorStop(1, 'rgba(120, 180, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, 60);
    ctx.restore();
}

// ── 6.7 PLÂNCTON ──────────────────────────────────────────────
// Partículas minúsculas flutuando na água.
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

// ── 6.8 VINHETA ───────────────────────────────────────────────
// Escurece as bordas da tela (foca no centro).
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

// ── 6.9 BORDA DE PERIGO ───────────────────────────────────────
// Fica vermelha na periferia quando um predador está perto.
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
//   7. CRIATURAS DECORATIVAS (NPCs "tocando a vida")
//   Não interagem com o jogo — só enriquecem o cenário.
// ══════════════════════════════════════════════════════════════

// ── 7.1 CARANGUEJO ────────────────────────────────────────────
// Anda de lado pelo chão, para, muda de direção.
class Crab {
    constructor(x) {
        this.x = x;
        this.y = H - 25;
        this.dir = Math.random() < 0.5 ? -1 : 1;   // -1 = esquerda, 1 = direita
        this.speed = 0.3 + Math.random() * 0.2;
        this.state = 'walking';                     // 'walking' ou 'paused'
        this.stateTimer = 3 + Math.random() * 5;
        this.legPhase = 0;                          // animação das patas
        this.color = '255, 175, 204';               // rosa pastel
    }
    update(dt) {
        this.stateTimer -= dt;
        if (this.state === 'walking') {
            this.x += this.dir * this.speed;
            this.legPhase += dt * 8;                // patas animam mais rápido

            // Se bateu na borda, vira
            if (this.x < 60 || this.x > W - 60) this.dir *= -1;

            // Se o timer acabou, pausa
            if (this.stateTimer <= 0) {
                this.state = 'paused';
                this.stateTimer = 1 + Math.random() * 3;
            }
        } else {
            // Pausado: espera o timer zerar e volta a andar
            if (this.stateTimer <= 0) {
                this.state = 'walking';
                this.stateTimer = 3 + Math.random() * 5;
                // Às vezes muda de direção
                if (Math.random() < 0.3) this.dir *= -1;
            }
        }
    }
    draw() {
        const s = 12;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.dir, 1); // espelha se estiver indo pra esquerda

        ctx.shadowColor = `rgba(${this.color}, 0.8)`;
        ctx.shadowBlur = 12;

        // Patas (3 de cada lado) — balançam com legPhase
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

        // Corpo (elipse achatada)
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

        // Olhinhos
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

// ── 7.2 MEDUSA ────────────────────────────────────────────────
// Flutua lentamente, cúpula pulsa, tentáculos ondulam.
class Jellyfish {
    constructor(x) {
        this.x = x;
        this.y = 100 + Math.random() * (H - 300);
        this.size = 18 + Math.random() * 12;
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.floatPhase = Math.random() * Math.PI * 2;
        this.driftSpeed = (Math.random() - 0.5) * 0.3;
        this.color = '162, 210, 255';               // ciano pastel
        this.tentacles = 6 + Math.floor(Math.random() * 3);
    }
    update(t) {
        // Flutuação vertical (seno) + deslocamento horizontal suave
        this.y += Math.sin(t * 0.3 + this.floatPhase) * 0.3;
        this.x += this.driftSpeed + Math.sin(t * 0.2 + this.floatPhase) * 0.2;

        // Prende dentro da tela
        if (this.x < 40) this.x = 40;
        if (this.x > W - 40) this.x = W - 40;
        if (this.y < 60) this.y = 60;
        if (this.y > H - 80) this.y = H - 80;
    }
    draw(t) {
        // Pulsa (o sino abre e fecha)
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

        // Cúpula (meia elipse invertida)
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

// ── 7.3 CAMARÃO ───────────────────────────────────────────────
// Anda em surtos rápidos, com pausas longas.
class Shrimp {
    constructor(x) {
        this.x = x;
        this.y = H - 15 - Math.random() * 20;
        this.dir = Math.random() < 0.5 ? -1 : 1;
        this.state = 'idle';
        this.stateTimer = 1 + Math.random() * 3;
        this.color = '255, 214, 165';              // amarelo pastel
        this.phase = Math.random() * Math.PI * 2;
    }
    update(dt) {
        this.stateTimer -= dt;
        if (this.state === 'idle') {
            if (this.stateTimer <= 0) {
                this.state = 'dart';               // "pinote" rápido
                this.stateTimer = 0.3;
                this.dir = Math.random() < 0.5 ? -1 : 1;
            }
        } else if (this.state === 'dart') {
            this.x += this.dir * 3;
            if (this.stateTimer <= 0) {
                this.state = 'idle';
                this.stateTimer = 1.5 + Math.random() * 3;
            }
        }
        // Bate na borda e volta
        if (this.x < 40 || this.x > W - 40) this.dir *= -1;
    }
    draw(t) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.dir, 1);

        ctx.shadowColor = `rgba(${this.color}, 0.8)`;
        ctx.shadowBlur = 10;

        // Corpo curvado (como um camarão)
        ctx.strokeStyle = `rgba(${this.color}, 0.9)`;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.quadraticCurveTo(0, -6, 8, -2);
        ctx.stroke();

        // Cauda pequena
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.lineTo(-12, -3);
        ctx.lineTo(-12, 3);
        ctx.closePath();
        ctx.fillStyle = `rgba(${this.color}, 0.9)`;
        ctx.fill();

        // Antenas
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

// ── 7.4 ESTRELA-DO-MAR ────────────────────────────────────────
// Parada no chão, pulsa levemente (como se respirasse).
class Starfish {
    constructor(x) {
        this.x = x;
        this.y = H - 20 - Math.random() * 20;
        this.size = 10 + Math.random() * 6;
        this.rotation = Math.random() * Math.PI * 2;
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.color = Math.random() < 0.5
            ? '255, 214, 165'   // amarelo pastel
            : '255, 175, 204';  // rosa pastel
    }
    update() { /* parada */ }
    draw(t) {
        // Pulsa de leve
        const pulse = 1 + Math.sin(t * 2 + this.pulsePhase) * 0.08;
        const s = this.size * pulse;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        ctx.shadowColor = `rgba(${this.color}, 0.7)`;
        ctx.shadowBlur = 12;
        ctx.fillStyle = `rgba(${this.color}, 0.85)`;

        // Estrela de 5 pontas (10 vértices alternando raio grande/pequeno)
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

// ── 7.5 TARTARUGA ─────────────────────────────────────────────
// Atravessa a tela devagar. Só aparece de vez em quando.
class Turtle {
    constructor() {
        this.reset();
    }
    reset() {
        // Entra por uma borda aleatória
        const fromLeft = Math.random() < 0.5;
        this.x = fromLeft ? -80 : W + 80;
        this.y = 120 + Math.random() * (H - 300);
        this.dir = fromLeft ? 1 : -1;
        this.speed = 0.4 + Math.random() * 0.2;
        this.size = 25 + Math.random() * 10;
        this.flipperPhase = 0;
        this.color = '184, 224, 210';              // verde menta
        this.active = true;
    }
    update(dt) {
        if (!this.active) return;
        this.x += this.dir * this.speed;
        this.flipperPhase += dt * 2.5;

        // Saiu da tela pelo lado oposto?
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

        // Nadadeiras (4)
        const flap = Math.sin(this.flipperPhase) * 4;
        ctx.fillStyle = `rgba(${this.color}, 0.6)`;
        ctx.beginPath();
        ctx.ellipse(s * 0.6, -s * 0.5 + flap, s * 0.3, s * 0.15, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(s * 0.6, s * 0.5 - flap, s * 0.3, s * 0.15, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(-s * 0.7, -s * 0.4 + flap * 0.5, s * 0.2, s * 0.12, -0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(-s * 0.7, s * 0.4 - flap * 0.5, s * 0.2, s * 0.12, 0.7, 0, Math.PI * 2);
        ctx.fill();

        // Casco (elipse)
        ctx.fillStyle = `rgba(${this.color}, 0.85)`;
        ctx.beginPath();
        ctx.ellipse(0, 0, s, s * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Padrão do casco (círculos)
        ctx.strokeStyle = `rgba(${this.color}, 0.5)`;
        ctx.lineWidth = 1;
        for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.arc(i * s * 0.3, 0, s * 0.15, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Cabeça
        ctx.fillStyle = `rgba(${this.color}, 0.9)`;
        ctx.beginPath();
        ctx.ellipse(s * 0.95, 0, s * 0.2, s * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();

        // Olho
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#0a0a14';
        ctx.beginPath();
        ctx.arc(s * 1.0, -s * 0.05, s * 0.04, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// ── 7.6 BOLHA ─────────────────────────────────────────────────
// Sobe do fundo ao topo, oscilando.
class Bubble {
    constructor() {
        this.reset();
        this.y = Math.random() * H;    // algumas já nascem no meio
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
        // Contorno
        ctx.beginPath();
        ctx.strokeStyle = `rgba(180, 220, 255, ${this.alpha})`;
        ctx.lineWidth = 1;
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.stroke();
        // Highlight de vidro
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha * 0.8})`;
        ctx.arc(this.x - this.r * 0.3, this.y - this.r * 0.3, this.r * 0.25, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ══════════════════════════════════════════════════════════════
//   8. PEIXES (jogador e NPCs do jogo)
//   Esses participam da cadeia alimentar: quem é maior come.
// ══════════════════════════════════════════════════════════════

// ── 8.1 PARTÍCULAS ────────────────────────────────────────────
// Explosões visuais ao comer, morrer, dar dash.
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

// ── 8.2 CLASSE BASE — FISH ────────────────────────────────────
// Todo peixe (jogador ou NPC) herda disso.
// Contém: posição, velocidade, ângulo, steering, desenho do corpo.
class Fish {
    constructor(x, y, size, palette) {
        this.x = x;
        this.y = y;
        this.vx = 0;              // velocidade horizontal
        this.vy = 0;              // velocidade vertical
        this.angle = 0;           // direção que está "olhando"
        this.size = size;
        this.palette = palette;
        this.tailPhase = Math.random() * Math.PI * 2;
        this.alive = true;
    }

    // Steering behavior (Craig Reynolds) — dá direção suave rumo a (tx, ty)
    steerTo(tx, ty, maxSpeed, maxForce) {
        let dx = tx - this.x;
        let dy = ty - this.y;
        const d = Math.hypot(dx, dy) || 1;

        // Velocidade desejada (proporcional à distância, limitada)
        const speed = Math.min(maxSpeed, d * 0.05);
        const desiredX = (dx / d) * speed;
        const desiredY = (dy / d) * speed;

        // "Força de direção" = diferença entre velocidade desejada e atual
        let steerX = desiredX - this.vx;
        let steerY = desiredY - this.vy;

        // Limita a força
        const sMag = Math.hypot(steerX, steerY);
        if (sMag > maxForce) {
            steerX = (steerX / sMag) * maxForce;
            steerY = (steerY / sMag) * maxForce;
        }

        // Aplica
        this.vx += steerX;
        this.vy += steerY;

        // Limita a velocidade máxima
        const vMag = Math.hypot(this.vx, this.vy);
        if (vMag > maxSpeed) {
            this.vx = (this.vx / vMag) * maxSpeed;
            this.vy = (this.vy / vMag) * maxSpeed;
        }
    }

    // Aplica velocidade à posição, atualiza ângulo e cauda
    integrate(dt) {
        this.x += this.vx * dt * 60;
        this.y += this.vy * dt * 60;

        const targetAngle = Math.atan2(this.vy, this.vx);
        // Rotação suave (interpolação angular)
        let diff = targetAngle - this.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.angle += diff * 0.12;

        const speed = Math.hypot(this.vx, this.vy);
        this.tailPhase += 0.15 + speed * 0.08;
    }

    // Não deixa sair da tela. Se bater, quica suave.
    clampToBounds(margin = 20) {
        if (this.x < margin) { this.x = margin; this.vx = Math.abs(this.vx) * 0.6; }
        if (this.x > W - margin) { this.x = W - margin; this.vx = -Math.abs(this.vx) * 0.6; }
        if (this.y < margin) { this.y = margin; this.vy = Math.abs(this.vy) * 0.6; }
        if (this.y > H - margin) { this.y = H - margin; this.vy = -Math.abs(this.vy) * 0.6; }
    }

    // Desenha o corpo do peixe (usado pelo jogador e pelos NPCs)
    drawBody() {
        const s = this.size;
        const wag = Math.sin(this.tailPhase) * 0.4;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        ctx.shadowColor = `rgba(${this.palette.glow}, 0.9)`;
        ctx.shadowBlur = 12 + this.size * 0.3;

        // Cauda (triângulo curvo)
        ctx.beginPath();
        ctx.fillStyle = this.palette.fin;
        ctx.moveTo(-s * 0.9, 0);
        ctx.quadraticCurveTo(-s * 1.4, -s * 0.5 + wag * s * 0.6, -s * 1.7, wag * s * 0.8);
        ctx.quadraticCurveTo(-s * 1.4, s * 0.5 + wag * s * 0.6, -s * 0.9, 0);
        ctx.fill();

        // Corpo (elipse)
        ctx.beginPath();
        ctx.fillStyle = this.palette.body;
        ctx.ellipse(0, 0, s, s * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();

        // Nadadeira de cima
        ctx.beginPath();
        ctx.fillStyle = this.palette.fin;
        ctx.moveTo(-s * 0.1, -s * 0.5);
        ctx.quadraticCurveTo(0, -s * 1.1, s * 0.4, -s * 0.4);
        ctx.fill();

        // Nadadeira de baixo
        ctx.beginPath();
        ctx.fillStyle = this.palette.fin;
        ctx.moveTo(-s * 0.1, s * 0.5);
        ctx.quadraticCurveTo(0, s * 1.1, s * 0.4, s * 0.4);
        ctx.fill();

        // Olho (preto + brilho branco)
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

// ── 8.3 JOGADOR ───────────────────────────────────────────────
// Você! Cresce ao comer, morre de fome ou ao ser comido.
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

    // Tenta dar um dash (só se o cooldown zerou)
    tryDash() {
        if (this.dashCooldownTimer <= 0) {
            this.dashTimer = CONFIG.dashDuration;
            this.dashCooldownTimer = CONFIG.dashCooldown;
            // Rastro de dash
            for (let i = 0; i < 10; i++) {
                spawnBurst(this.x, this.y, '255, 240, 200', 1);
            }
        }
    }

    update(dt) {
        if (!this.alive) return;

        // Invulnerabilidade temporária
        if (this.invulnTimer > 0) this.invulnTimer -= dt;

        // Fome
        this.hunger -= CONFIG.hungerDrain * dt;
        if (this.hunger <= 0) {
            this.hunger = 0;
            this.die('fome');
            return;
        }

        // Cooldowns
        if (this.dashTimer > 0) this.dashTimer -= dt;
        if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= dt;

        // Velocidade (peixes maiores são mais lentos)
        const sizePenalty = 1 - Math.min(0.5, (this.size - 15) / 100);
        let maxSpeed = CONFIG.speedBase * sizePenalty;
        if (this.dashTimer > 0) maxSpeed *= CONFIG.dashMultiplier;

        // Move na direção do mouse
        this.steerTo(mouse.x, mouse.y, maxSpeed, 0.15);
        this.integrate(dt);
        this.clampToBounds(this.size * 0.6);
    }

    // Come um NPC (chamado pelo checkEat)
    eat(npc) {
        this.size += npc.size * CONFIG.growthPerEat;
        this.hunger = Math.min(CONFIG.hungerMax, this.hunger + CONFIG.hungerPerEat);
        this.eatCount++;
        score += Math.round(npc.size);
        if (score > bestScore) bestScore = score;
        spawnBurst(npc.x, npc.y, npc.palette.glow, 15);
    }

    // Morre (comido ou de fome)
    die(reason) {
        this.alive = false;
        gameState = 'gameover';
        gameOverTime = performance.now();
        spawnBurst(this.x, this.y, this.palette.glow, 40);
    }

    draw() {
        // Pisca quando invulnerável
        if (this.invulnTimer > 0) {
            const blink = Math.sin(performance.now() * 0.02) > 0;
            if (!blink) {
                this.drawBody();
                this.drawPlayerMarker();
                return;
            }
        }

        // Pisca vermelho quando fome crítica
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

    // Anel pulsante + seta "VOCÊ"
    drawPlayerMarker() {
        const t = performance.now() * 0.003;
        const pulse = 1 + Math.sin(t * 2) * 0.08;
        const r = this.size * 1.7 * pulse;

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

        // Seta "VOCÊ" acima
        const arrowY = this.y - this.size * 1.8 - 20;
        const bounce = Math.sin(performance.now() * 0.005) * 4;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = 'bold 12px "Segoe UI", sans-serif';
        ctx.shadowColor = 'rgba(255, 240, 200, 0.9)';
        ctx.shadowBlur = 12;
        ctx.fillStyle = 'rgba(255, 240, 200, 1)';
        ctx.fillText('VOCÊ', this.x, arrowY + bounce);

        // Triângulo apontando pra baixo
        ctx.beginPath();
        ctx.moveTo(this.x - 6, arrowY + bounce + 6);
        ctx.lineTo(this.x + 6, arrowY + bounce + 6);
        ctx.lineTo(this.x, arrowY + bounce + 14);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

// ── 8.4 NPC PEIXE ─────────────────────────────────────────────
// Peixes que participam da cadeia alimentar:
//   - Menores que você → fogem
//   - Maiores que você → te perseguem
//   - Também interagem entre si
class NPC extends Fish {
    constructor(x, y, size, palette) {
        super(x, y, size, palette);
        this.wanderTimer = 0;
        this.wanderTarget = { x: Math.random() * W, y: Math.random() * H };
        this.fleeing = false;
        this.chasing = false;
        this.threatLevel = 0;   // 0..1 (usado pela borda vermelha)
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

        // ── Comportamento em relação ao jogador ──
        if (playerRef && player.invulnTimer <= 0) {
            const dx = playerRef.x - this.x;
            const dy = playerRef.y - this.y;
            const dist = Math.hypot(dx, dy);
            const perception = 220;

            const playerCanEatMe = playerRef.size > this.size / CONFIG.eatRatio;
            const iCanEatPlayer = this.size > playerRef.size / CONFIG.eatRatio;

            if (dist < perception) {
                if (playerCanEatMe && !iCanEatPlayer) {
                    // Foge
                    this.wanderTarget = { x: this.x - dx * 2, y: this.y - dy * 2 };
                    this.fleeing = true;
                    maxSpeed *= 1.3;
                } else if (iCanEatPlayer) {
                    // Persegue
                    this.wanderTarget = { x: playerRef.x, y: playerRef.y };
                    this.chasing = true;
                    const sizeAdvantage = this.size / playerRef.size;
                    this.threatLevel = Math.min(1, (1 - dist / perception) * sizeAdvantage * 0.7);
                }
            }
        }

        // ── Comportamento entre NPCs ──
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

        // ── Vagueia se nada está acontecendo ──
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
            // Contorno verde: você pode comer este NPC
            if (p.size > this.size / CONFIG.eatRatio) {
                ctx.save();
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(120, 255, 150, 0.55)';
                ctx.lineWidth = 1.5;
                ctx.arc(this.x, this.y, this.size * 1.4, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
            // Contorno vermelho pulsante: este NPC pode te comer
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

        // Aura maior quando está te perseguindo
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
//   9. MECÂNICAS DO JOGO (spawn, comer, perigo, câmera)
// ══════════════════════════════════════════════════════════════

// ── 9.1 SPAWN DE NPC PEIXE ────────────────────────────────────
// Cria um NPC longe do jogador (pra não nascer em cima dele).
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
    if (!ok) return; // desiste (tenta de novo no próximo frame)

    npcs.push(new NPC(x, y, size, randPalette()));
}

// ── 9.2 REGRA DE COMER ────────────────────────────────────────
// Retorna true se "a" pode comer "b" (a é pelo menos 15% maior).
function canEat(a, b) {
    return a.size > b.size / CONFIG.eatRatio;
}

// Verifica todas as colisões de comer a cada frame
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
            if (d > threshold) continue; // longe demais

            const aEatsB = canEat(a, b) && !canEat(b, a);
            const bEatsA = canEat(b, a) && !canEat(a, b);

            if (aEatsB) {
                // Jogador invulnerável não pode ser comido
                if (b === player && player.invulnTimer > 0) continue;
                if (a === player) player.eat(b);
                else a.size += b.size * 0.08;   // NPCs também crescem
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

    // Remove NPCs mortos e agenda respawn
    for (let i = npcs.length - 1; i >= 0; i--) {
        if (!npcs[i].alive) {
            npcs.splice(i, 1);
            respawnQueue.push(performance.now() + CONFIG.respawnDelay * 1000);
        }
    }
}

// ── 9.3 NÍVEL DE PERIGO ───────────────────────────────────────
// Quanto mais predadores perto, maior o perigo (para a borda vermelha).
function updateDangerLevel() {
    if (!player || !player.alive) { dangerLevel = 0; return; }
    let maxThreat = 0;
    for (const npc of npcs) {
        if (npc.threatLevel > maxThreat) maxThreat = npc.threatLevel;
    }
    // Suaviza a transição
    dangerLevel += (maxThreat - dangerLevel) * 0.15;
}

// ── 9.4 CÂMERA ────────────────────────────────────────────────
// A câmera se afasta (zoom out) conforme você cresce.
function updateCamera() {
    if (!player) return;
    const growth = Math.min(1, (player.size - CONFIG.playerStartSize) /
                              (CONFIG.zoomReference - CONFIG.playerStartSize));
    const targetZoom = CONFIG.zoomBase - (CONFIG.zoomBase - CONFIG.zoomMin) * growth;
    camera.zoom += (targetZoom - camera.zoom) * 0.05;
}

// Aplica zoom + centraliza no jogador
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

// ══════════════════════════════════════════════════════════════
//   10. HUD, GAME OVER E CURSOR
// ══════════════════════════════════════════════════════════════

// ── 10.1 HUD ──────────────────────────────────────────────────
// Sempre em coordenadas de TELA (não afetado pela câmera).
function drawHUD() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    ctx.shadowBlur = 0;
    ctx.font = 'bold 16px "Segoe UI", sans-serif';
    ctx.textBaseline = 'top';

    // Pontuação
    ctx.fillStyle = 'rgba(200, 182, 255, 0.9)';
    ctx.fillText(`PONTOS: ${score}`, 24, 24);

    // Recorde
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255, 200, 220, 0.6)';
    ctx.fillText(`MELHOR: ${bestScore}`, 24, 48);

    // Tamanho
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

    // Legenda
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(120, 255, 150, 0.7)';
    ctx.fillText('● verde = você pode comer', 24, H - 40);
    ctx.fillStyle = 'rgba(255, 80, 80, 0.7)';
    ctx.fillText('● vermelho = pode te comer', 24, H - 22);

    ctx.restore();
}

// ── 10.2 GAME OVER ────────────────────────────────────────────
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

// ── 10.3 CURSOR PERSONALIZADO ─────────────────────────────────
// Cruz neon que segue o mouse (sempre em coords de tela).
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
//   11. INICIALIZAÇÃO E LOOP PRINCIPAL
// ══════════════════════════════════════════════════════════════

// ── 11.1 CRIATURAS DECORATIVAS ────────────────────────────────
// Listas de todos os NPCs "tocando a vida".
const crabs = [];
const jellyfishes = [];
const shrimps = [];
const starfishes = [];
const turtles = [];
const bubbles = [];

function initDecorativeCreatures() {
    // Caranguejos: 2 espalhados pelo chão
    crabs.length = 0;
    for (let i = 0; i < 2; i++) crabs.push(new Crab(150 + i * (W - 300) / 2 + Math.random() * 100));

    // Medusas: 3 flutuando no meio
    jellyfishes.length = 0;
    for (let i = 0; i < 3; i++) jellyfishes.push(new Jellyfish(200 + i * (W - 400) / 2 + Math.random() * 100));

    // Camarões: 4 no chão
    shrimps.length = 0;
    for (let i = 0; i < 4; i++) shrimps.push(new Shrimp(100 + Math.random() * (W - 200)));

    // Estrelas-do-mar: 3 espalhadas
    starfishes.length = 0;
    for (let i = 0; i < 3; i++) starfishes.push(new Starfish(100 + Math.random() * (W - 200)));

    // Tartarugas: 2 (aparecem devagar, uma por vez)
    turtles.length = 0;
    for (let i = 0; i < 2; i++) {
        const t = new Turtle();
        t.active = false;   // começam inativas
        t.x = -200;
        turtles.push(t);
    }

    // Bolhas: 40
    bubbles.length = 0;
    for (let i = 0; i < 40; i++) bubbles.push(new Bubble());
}

// ── 11.2 RESET/INIT DO JOGO ───────────────────────────────────
function initGame() {
    npcs = [];
    particles = [];
    respawnQueue = [];
    score = 0;
    dangerLevel = 0;
    gameState = 'playing';

    player = new Player();
    camera.zoom = CONFIG.zoomBase;

    // Spawn dos NPCs peixes
    for (let i = 0; i < CONFIG.npcCount; i++) spawnNPC();

    // Garante pelo menos 4 peixes menores que você no começo
    let smallCount = npcs.filter(n => n.size < player.size * 0.9).length;
    let attempts = 0;
    while (smallCount < 4 && attempts < 50) {
        spawnNPC();
        smallCount = npcs.filter(n => n.size < player.size * 0.9).length;
        attempts++;
    }

    // Cria o cenário decorativo
    initDecorativeCreatures();
}

function restartGame() { initGame(); }

// ── 11.3 INICIALIZAÇÃO ────────────────────────────────────────
initGodRays();
initPlankton();
initCorais();
initRochas();
initAlgas();
initGame();

// ── 11.4 LOOP ─────────────────────────────────────────────────
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
        // Game over: NPCs peixes continuam interagindo entre si
        const allFish = [...npcs];
        for (const npc of npcs) npc.update(dt, allFish);
        checkEat(npcs);
        dangerLevel = 0;
    }

    // Respawns agendados
    for (let i = respawnQueue.length - 1; i >= 0; i--) {
        if (now >= respawnQueue[i]) {
            respawnQueue.splice(i, 1);
            spawnNPC();
        }
    }

    // Atualiza criaturas decorativas
    for (const c of crabs) c.update(dt);
    for (const j of jellyfishes) j.update(t);
    for (const s of shrimps) s.update(dt);
    for (const s of starfishes) s.update();
    for (const tu of turtles) {
        tu.update(dt);
        // Reativa tartarugas inativas de vez em quando
        if (!tu.active && Math.random() < 0.002) tu.reset();
    }
    for (const b of bubbles) b.update(t);

    updateParticles();

    // ═══ DESENHO ═══

    // 1. Fundo (sempre em coords de tela — não é afetado pelo zoom)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0f1a2e');
    grad.addColorStop(0.5, '#0a1220');
    grad.addColorStop(1, '#050810');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // 2. Aplica câmera (zoom + centralização) para o mundo
    applyCamera();

    // 3. Camadas do mundo (de trás pra frente)
    drawSurface(t);
    drawGodRays(t);
    updatePlankton(t);
    drawPlankton();
    drawCorais(t);
    drawRochas();
    drawAlgas(t);
    drawSeafloor();

    // 4. Criaturas decorativas do fundo
    for (const s of shrimps) s.draw(t);
    for (const s of starfishes) s.draw(t);
    for (const c of crabs) c.draw();
    for (const j of jellyfishes) j.draw(t);
    for (const tu of turtles) tu.draw();
    for (const b of bubbles) b.draw();

    // 5. NPCs peixes (jogo) + jogador
    for (const npc of npcs) npc.draw();
    if (player && player.alive) player.draw();

    // 6. Partículas
    drawParticles();

    // 7. Efeitos de tela (sempre em coords de tela)
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