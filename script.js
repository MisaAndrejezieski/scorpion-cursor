// ============================================================
//   SCORPION CURSOR
//   Uma criatura que persegue o mouse usando Matter.js
// ============================================================

const { Engine, World, Bodies, Body, Composite, Constraint } = Matter;

// --- Canvas ---
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// --- Engine de física ---
const engine = Engine.create();
const world = engine.world;
engine.gravity.y = 0; // top-down: sem gravidade

// --- Mouse ---
const mouse = {
    x: canvas.width / 2,
    y: canvas.height / 2
};
window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

// ============================================================
//   Criatura (corrente de nós + patas)
// ============================================================
class Scorpion {
    constructor(segmentCount = 20) {
        this.nodes = [];
        this.constraints = [];
        this.legs = [];

        const startX = canvas.width / 2;
        const startY = canvas.height / 2;

        // Cria a corrente (rabo → cabeça)
        let prev = null;
        for (let i = 0; i < segmentCount; i++) {
            const radius = 4 + i * 0.6; // engrossa em direção à cabeça
            const node = Bodies.circle(startX, startY, radius, {
                frictionAir: 0.4,
                collisionFilter: { group: -1 } // não colide consigo mesma
            });
            this.nodes.push(node);
            World.add(world, node);

            if (prev) {
                const constraint = Constraint.create({
                    bodyA: prev,
                    bodyB: node,
                    length: radius + 6,
                    stiffness: 0.5,
                    damping: 0.1
                });
                this.constraints.push(constraint);
                World.add(world, constraint);
            }
            prev = node;
        }

        this.head = this.nodes[this.nodes.length - 1];

        // Cria as patas (2 pares, presas ao meio do corpo)
        const legAnchors = [
            Math.floor(segmentCount * 0.3),
            Math.floor(segmentCount * 0.5),
            Math.floor(segmentCount * 0.7)
        ];
        for (const idx of legAnchors) {
            this.legs.push(this.createLeg(this.nodes[idx], -1));
            this.legs.push(this.createLeg(this.nodes[idx], +1));
        }
    }

    createLeg(anchor, side) {
        const legLength = 30;
        const foot = Bodies.circle(
            anchor.position.x + side * legLength,
            anchor.position.y,
            3,
            { frictionAir: 0.3, collisionFilter: { group: -1 } }
        );
        World.add(world, foot);

        const constraint = Constraint.create({
            bodyA: anchor,
            bodyB: foot,
            length: legLength,
            stiffness: 0.3,
            damping: 0.2
        });
        World.add(world, constraint);

        return { foot, constraint, anchor, side };
    }

    update() {
        // A cabeça é atraída para o mouse
        const dx = mouse.x - this.head.position.x;
        const dy = mouse.y - this.head.position.y;
        Body.applyForce(this.head, this.head.position, {
            x: dx * 0.0006,
            y: dy * 0.0006
        });

        // As patas oscilam para frente e para trás (efeito de andar)
        const t = performance.now() * 0.01;
        for (let i = 0; i < this.legs.length; i++) {
            const leg = this.legs[i];
            const phase = i * Math.PI / 2;
            const swing = Math.sin(t + phase) * 15;
            // Empurra a pata levemente para o lado
            Body.applyForce(leg.foot, leg.foot.position, {
                x: leg.side * swing * 0.00005,
                y: Math.cos(t + phase) * 0.00002
            });
        }
    }

    draw() {
        // Corpo (corrente)
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Linhas entre os nós
        for (let i = 0; i < this.nodes.length - 1; i++) {
            const a = this.nodes[i].position;
            const b = this.nodes[i + 1].position;
            const t = i / this.nodes.length;

            ctx.beginPath();
            ctx.strokeStyle = `rgba(180, 220, 255, ${0.3 + t * 0.7})`;
            ctx.lineWidth = 2 + t * 4;
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }

        // Patas
        ctx.strokeStyle = 'rgba(120, 180, 240, 0.6)';
        ctx.lineWidth = 2;
        for (const leg of this.legs) {
            ctx.beginPath();
            ctx.moveTo(leg.anchor.position.x, leg.anchor.position.y);
            ctx.lineTo(leg.foot.position.x, leg.foot.position.y);
            ctx.stroke();
        }

        // Ferroadas / nós (desenha cada nó)
        for (let i = 0; i < this.nodes.length; i++) {
            const n = this.nodes[i];
            const t = i / this.nodes.length;
            const r = 3 + t * 3;

            ctx.beginPath();
            ctx.fillStyle = `rgba(200, 230, 255, ${0.4 + t * 0.6})`;
            ctx.arc(n.position.x, n.position.y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        // Cabeça (destaque)
        ctx.beginPath();
        ctx.fillStyle = '#ff5577';
        ctx.arc(this.head.position.x, this.head.position.y, 8, 0, Math.PI * 2);
        ctx.fill();

        // Brilho na cabeça
        ctx.beginPath();
        ctx.fillStyle = 'rgba(255, 200, 220, 0.8)';
        ctx.arc(this.head.position.x, this.head.position.y, 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ============================================================
//   Loop principal
// ============================================================
const scorpion = new Scorpion(22);

function loop() {
    scorpion.update();
    Engine.update(engine, 1000 / 60);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    scorpion.draw();

    requestAnimationFrame(loop);
}
loop();