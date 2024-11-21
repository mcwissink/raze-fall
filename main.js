const CANVAS = document.querySelector('canvas');
const CTX = CANVAS.getContext('2d');

const easeOut = (t, exponent = 5) => 1 - Math.pow(1 - t, exponent);

class Vector {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

class HitEffect {
    position = new Vector(0, 0);
    velocity = new Vector(0, 0);
    friction = 0.7;

    static ANIMATION_DURATION = 15;
    animation = 0;
    color = 'red';
    radius = 0;

    spawn(position, velocity, color, strength) {
        this.animation = HitEffect.ANIMATION_DURATION;
        this.velocity = velocity;
        this.position = position;
        this.color = color;
        this.radius = strength
    }

    update() {
        this.velocity.x *= this.friction;
        this.velocity.y *= this.friction;
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
    }

    render(ctx) {
        if (this.animation) {
            this.animation -= 1;
            const easedValue = easeOut(1 - this.animation / HitEffect.ANIMATION_DURATION, 2);
            ctx.save();
            ctx.translate(this.position.x, this.position.y);
            ctx.scale(Math.sign(this.velocity.x || 1), 1)
            ctx.lineWidth = 50 * (1 - easedValue);
            ctx.setLineDash([100 * (1 - easedValue), 100 * easedValue]);
            ctx.strokeStyle = this.color;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * easedValue, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.restore();
        }
    }
}

class ScoreEffect {
    position = new Vector(0, 0);
    static ANIMATION_DURATION = 30;
    animation = 0;

    spawn(position) {
        this.position = position;
        this.animation = ScoreEffect.ANIMATION_DURATION;
    }

    render(ctx) {
        if (this.animation) {
            this.animation -= 1;
            ctx.save();
            ctx.translate(this.position.x, this.position.y + easeOut(this.animation / ScoreEffect.ANIMATION_DURATION, 2) * 10);
            ctx.beginPath();
            ctx.fillStyle = 'white';
            ctx.strokeStyle = 'black';
            ctx.arc(0, 0, 10, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = 'black';
            ctx.fillText('+1', -5, 3);
            ctx.restore();
        }
    }
}

class Spike {
    scored = false;
    position = new Vector(0, 0);
    velocity = new Vector(0, 5);
    radius = 20;
    friction = 0.8;

    static MAX_SPAWN_VELOCITY = 10;
    static MAX_RADIUS = 40;
    static MIN_RADIUS = 10;
    static ANIMATION_DURATION = 50;
    animation = 0;
    color = 'red';

    reset() {
        this.scored = false;
        this.animation = 0;
        this.radius = Spike.MIN_RADIUS + Math.random() * (Spike.MAX_RADIUS - Spike.MIN_RADIUS);
        this.position.x = Math.random() * CANVAS.width;
        this.position.y = -this.radius;
        this.velocity.y = Math.random() * Spike.MAX_SPAWN_VELOCITY;
    }

    hit(color) {
        this.animation = Spike.ANIMATION_DURATION;
        this.color = color;
    }

    update() {
        this.velocity.x *= this.friction;
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
    }

    render(ctx) {
        ctx.save();
        if (this.animation) {
            this.animation -= 1;
            ctx.strokeStyle = this.color;
        }

        const gradient = ctx.createRadialGradient(
            this.position.x,
            this.position.y,
            0,
            this.position.x,
            this.position.y,
            this.radius
        );
        gradient.addColorStop(easeOut(1 - this.animation / Spike.ANIMATION_DURATION), 'white');
        gradient.addColorStop(1, this.color);

        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, 2 * Math.PI);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

class Player {
    radius = 20;
    maxSpeed = 100;
    friction = 0.8;
    acceleration = 10;
    velocity = new Vector(0, 0);

    constructor(position) {
        this.position = position;
    }

    moveTowardsTarget(target) {
        const difference = target.x - this.position.x;
        const direction = Math.sign(difference);
        // find distance between target and position
        this.velocity.x = Math.min(Math.abs(difference), this.acceleration) * direction;
    }

    update() {
        this.velocity.x *= this.friction;
        this.velocity.y *= this.friction;
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
    }

    render(ctx) {
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, 2 * Math.PI);
        ctx.fillStyle = 'black';
        ctx.fill();
        ctx.stroke();
    }
}

class Controller {
    static CONFIG = {
        'ArrowLeft': 'left',
        'ArrowRight': 'right',
    }
    left = false;
    right = false;
    stickX = 0;
    key(key, down) {
        const mappedKey = Controller.CONFIG[key]
        this[mappedKey] = down;
        if (down) {
            this.stickX = mappedKey === 'left' ? -1 : 1;
        } else if (this.left) {
            this.stickX = -1;
        } else if (this.right) {
            this.stickX = 1;
        } else {
            this.stickX = 0;
        }
    }
}

class Pool {
    active = []
    inactive = []
    constructor(entity, size) {
        this.size = size;
        this.entity = entity;
    }
    activate() {
        if (this.inactive.length) {
            const entity = this.inactive.pop();
            entity.reset();
            this.active.push(entity);
        } else if (this.active.length + this.inactive.length < this.size) {
            const entity = new this.entity()
            entity.reset()
            this.active.push(entity);
        }
    }

    deactivate(entity) {
        const index = this.active.findIndex((e) => e === entity);
        this.active.splice(index, 1);
        this.inactive.push(entity);
    }
}

class Game {
    previousTime = 0;
    frameCount = 0;
    target = new Vector(0, 0);
    controller = new Controller();
    player = new Player(new Vector(250, 250));
    spikePool = new Pool(Spike, 20);
    gameOver = false;
    hitEffectsCooldown = 0;
    hitEffects = [
        new HitEffect(),
        new HitEffect(),
        new HitEffect(),
    ];
    deathEffects = [
        new HitEffect(),
        new HitEffect(),
        new HitEffect(),
        new HitEffect(),
        new HitEffect(),
    ];
    scoreEffects = [
        new ScoreEffect(),
        new ScoreEffect(),
        new ScoreEffect(),
    ];

    constructor() {
        window.addEventListener('keydown', (e) => this.controller.key(e.key, true));
        window.addEventListener('keyup', (e) => this.controller.key(e.key, false));
    }


    start() {
        window.requestAnimationFrame(this.animation);
    }

    animation = (time) => {
        const frameInterval = 1000 / 60;
        while (time - frameInterval > this.previousTime) {
            this.previousTime += frameInterval;

            this.update(time);
            CTX.fillStyle = "rgba(255, 255, 255, 1)";
            CTX.fillRect(0, 0, CANVAS.width, CANVAS.height);
            this.render(CTX);
        }

        window.requestAnimationFrame(this.animation);
    }

    update() {
        this.frameCount++;
        if (this.frameCount % 10 === 0) {
            this.spikePool.activate();
        }

        this.target.x = this.player.position.x;
        if (this.controller.stickX) {
            this.target.x = this.player.position.x + (100 * this.controller.stickX);
            this.player.moveTowardsTarget(this.target);
        }

        if (this.hitEffectsCooldown) {
            this.hitEffectsCooldown -= 1;
        }

        this.spikePool.active.forEach((spike) => {
            spike.update()

            const dx = (spike.position.x - this.player.position.x);
            const dy = (spike.position.y - this.player.position.y);
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < this.player.radius + spike.radius) {
                const force = (this.player.radius + spike.radius) - dist;
                const angle = Math.atan2(dy, dx);
                const playerVelocityY = -1 * Math.sin(angle) * force
                this.player.velocity.x += -1 * Math.cos(angle) * force;
                this.player.velocity.y += playerVelocityY;
                spike.velocity.x += Math.cos(angle) * force * 0.1;
                spike.velocity.y += Math.sin(angle) * force * 0.1;

                const hitPosition = new Vector(this.player.position.x + dx / 2, this.player.position.y + dy / 2);
                const isPositiveHit = playerVelocityY < 0;
                const color = isPositiveHit ? 'green' : 'red';
                spike.hit(color);

                if (isPositiveHit && !spike.scored) {
                    spike.scored = true;
                    const scoreEffect = this.scoreEffects.shift();
                    scoreEffect.spawn(hitPosition);
                    this.scoreEffects.push(scoreEffect);
                }

                const strength = Math.abs(playerVelocityY) * 10;
                if (strength > this.hitEffectsCooldown) {
                    const hitEffect = this.hitEffects.shift();
                    hitEffect.spawn(
                        hitPosition,
                        new Vector(this.player.velocity.x, this.player.velocity.y),
                        color,
                        strength
                    );
                    this.hitEffects.push(hitEffect);
                    this.hitEffectsCooldown = Math.round(strength);
                }
            }

            if (spike.position.y - spike.radius > CANVAS.height + 10) {
                this.spikePool.deactivate(spike);
            }

            if (spike.position.y + spike.radius < -10) {
                this.spikePool.deactivate(spike);
            }
        });

        this.player.update();

        if (this.player.position.x + this.player.radius > CANVAS.width) {
            this.player.position.x = CANVAS.width - this.player.radius;
            this.player.velocity.x *= -1;
        }

        if (this.player.position.x - this.player.radius < 0) {
            this.player.position.x = this.player.radius;
            this.player.velocity.x *= -1;
        }

        if (!this.gameOver && this.player.position.y - this.player.radius > CANVAS.height) {
            this.gameOver = true;
            this.deathEffects.forEach((deathEffect, index) => {
                deathEffect.spawn(
                    new Vector(this.player.position.x, this.player.position.y),
                    new Vector(0, 0),
                    'black',
                    50 * index,
                );
            });
        }

        this.hitEffects.forEach((hitEffect) => hitEffect.update());
        this.deathEffects.forEach((deathEffect) => deathEffect.update());
    }

    render(ctx) {
        this.hitEffects.forEach((hitEffect) => hitEffect.render(ctx));
        this.deathEffects.forEach((deathEffects) => deathEffects.render(ctx));
        this.player.render(ctx);
        this.spikePool.active.forEach((spike) => spike.render(ctx));
        this.scoreEffects.forEach((scoreEffect) => scoreEffect.render(ctx));
    }
}

const game = new Game()
game.start();
