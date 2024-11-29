const CANVAS = document.querySelector('canvas');
const CTX = CANVAS.getContext('2d');

const FRAMES_PER_SECOND = 60;
const POINTS_PER_SECOND = 1;
const POINTS_PER_HIT = 1;

const easeOut = (t, exponent = 5) => 1 - Math.pow(1 - t, exponent);

const fillTextCenter = (ctx, text) => {
    const measuredText = ctx.measureText(text);
    ctx.fillText(text, -measuredText.actualBoundingBoxRight / 2, measuredText.actualBoundingBoxAscent / 2);
}

const collide = (entityA, entityB, ratio) => {
    const dx = entityA.position.x - entityB.position.x;
    const dy = entityA.position.y - entityB.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < entityA.radius + entityB.radius) {
        const force = ((entityA.radius + entityB.radius) - distance) * 2;
        const angle = Math.atan2(dy, dx);

        const entityAVelocity = new Vector(
            Math.cos(angle) * force * ratio,
            Math.sin(angle) * force * ratio
        )

        const entityBVelocity = new Vector(
            -1 * Math.cos(angle) * force * (1 - ratio),
            -1 * Math.sin(angle) * force * (1 - ratio)
        )

        entityA.velocity.add(entityAVelocity);
        entityB.velocity.add(entityBVelocity);

        return {
            entityAVelocity,
            entityBVelocity,
            contactPosition: entityA.position
                .copy()
                .subtract(entityB.position)
                .normalize()
                .scale(-entityA.radius)
                .add(entityA.position)
        }
    } else {
        return null;
    }
}

class Vector {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    add(vector) {
        this.x += vector.x;
        this.y += vector.y;
        return this;
    }

    subtract(vector) {
        this.x -= vector.x;
        this.y -= vector.y;
        return this;
    }

    scale(magnitueX, magnitudeY) {
        this.x *= magnitueX;
        this.y *= magnitudeY ? magnitudeY : magnitueX;
        return this;
    }

    normalize() {
        const magnitude = Math.hypot(this.x, this.y) || 1;
        this.x = this.x / magnitude;
        this.y = this.y / magnitude;
        return this;
    };

    copy() {
        return new Vector(this.x, this.y);
    }
}

class HitEffect {
    static ANIMATION_DURATION = 20;

    position = new Vector(0, 0);
    velocity = new Vector(0, 0);
    friction = 0.7;
    animation = 0;
    color = 'red';
    radius = 0;

    constructor(game) {
        this.game = game;
    }

    spawn(position, velocity, color, strength) {
        this.animation = HitEffect.ANIMATION_DURATION;
        if (!velocity) {
            console.log('no vel')
        }
        this.velocity = velocity;
        this.position = position;
        this.color = color;
        this.radius = strength
    }

    update() {
        if (!--this.animation) {
            this.game.hitEffectPool.despawn(this);
        }

        this.velocity.scale(this.friction);
        this.position.add(this.velocity);
    }

    render(ctx) {
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

class ScoreEffect {
    static ANIMATION_DURATION = 30;

    position = new Vector(0, 0);
    animation = 0;
    score = 0;

    constructor(game) {
        this.game = game;
    }

    spawn(position, score) {
        this.animation = ScoreEffect.ANIMATION_DURATION;
        this.position = position;
        this.score = score;
    }

    update() {
        if (!--this.animation) {
            this.game.scoreEffectPool.despawn(this);
        };
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.position.x, this.position.y + easeOut(this.animation / ScoreEffect.ANIMATION_DURATION, 2) * 10);

        ctx.beginPath();
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.arc(0, 0, 10, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'black';
        fillTextCenter(ctx, `+${this.score}`);
        ctx.restore();
    }
}

class Explosion {
    static ANIMATION_DURATION = 10;

    position = new Vector(0, 0);
    velocity = new Vector(0, 0);
    radius = 0;
    animation = 0;

    constructor(game) {
        this.game = game;
    }

    spawn(position) {
        this.animation = Explosion.ANIMATION_DURATION;
        this.position = position;
        this.game.hitEffectPool.spawn(this.position.copy(), this.velocity.copy(), 'black', 70);
    }

    update() {
        this.radius = this.animation * 18;
        if (!this.animation--) {
            this.game.explosionPool.despawn(this);
        }
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius)
        gradient.addColorStop(easeOut(1 - this.animation / Explosion.ANIMATION_DURATION), 'white');
        gradient.addColorStop(1, 'black');

        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, 2 * Math.PI);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

class Spike {
    static MAX_SPAWN_VELOCITY = 10;
    static MAX_RADIUS = 40;
    static MIN_RADIUS = 10;
    static ANIMATION_DURATION = 50;

    scored = false;
    position = new Vector(0, 0);
    velocity = new Vector(0, 0);
    targetVelocity = 0;
    radius = 20;
    friction = 0.8;
    animation = 0;
    color = 'black';
    multiplier = 1;

    constructor(game) {
        this.game = game;
    }

    spawn() {
        this.scored = false;
        this.color = 'black';
        this.animation = 0;
        this.radius = Spike.MIN_RADIUS + Math.random() * (Spike.MAX_RADIUS - Spike.MIN_RADIUS);
        this.position.x = Math.random() * CANVAS.width;
        this.position.y = -this.radius;
        this.targetVelocity = Math.random() * Spike.MAX_SPAWN_VELOCITY;
        this.velocity.y = this.targetVelocity;

        const spikesWithMultiplier = this.game.spikePool.active.filter((spike) => spike.multiplier > 1);
        if (Math.random() > 0.9 && spikesWithMultiplier.length < 2) {
            this.multiplier = 2;
        }

    }

    hit(color) {
        this.animation = Spike.ANIMATION_DURATION;
        this.color = color;
    }

    update() {
        this.velocity.scale(this.friction, Math.abs(this.velocity.y) > Math.abs(this.targetVelocity) ? this.friction : 1);
        this.position.add(this.velocity);
        if (this.animation && !--this.animation) {
            this.color = 'black';
        }

        if (this.position.y - this.radius > CANVAS.height + 10) {
            this.game.spikePool.despawn(this);
        }

        if (this.position.y + this.radius < -10) {
            this.game.spikePool.despawn(this);
        }
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.strokeStyle = this.color;

        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius)

        gradient.addColorStop(easeOut(1 - this.animation / Spike.ANIMATION_DURATION), 'white');
        gradient.addColorStop(1, this.color);

        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, 2 * Math.PI);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.stroke();

        if (this.multiplier > 1) {
            ctx.fillStyle = 'black';
            fillTextCenter(ctx, `x${this.multiplier}`);
        }
        ctx.restore();
    }
}

class Player {
    radius = 25;
    maxSpeed = 100;
    friction = 0.85;
    acceleration = 2;
    velocity = new Vector(0, 0);

    constructor(game, position) {
        this.game = game;
        this.position = position;
    }

    moveTowardsTarget(target) {
        const difference = target.x - this.position.x;
        const direction = Math.sign(difference);
        this.velocity.x += Math.min(Math.abs(difference / 30), this.acceleration) * direction;
    }

    update() {
        this.velocity.scale(this.friction);
        this.position.add(this.velocity);

        if (this.position.x + this.radius > CANVAS.width) {
            this.position.x = CANVAS.width - this.radius;
            this.velocity.x *= -1;
        }

        if (this.position.x - this.radius < 0) {
            this.position.x = this.radius;
            this.velocity.x *= -1;
        }

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
    static KEYBOARD_CONFIG = {
        'ArrowLeft': 'left',
        'ArrowRight': 'right',
    }

    static FOCUS = {
        mouse: 0,
        keyboard: 1,
    }

    focus = Controller.FOCUS.keyboard;
    left = false;
    right = false;
    stickX = 0;
    mouseX = 0;
    constructor() {
        window.addEventListener('mousemove', (e) => this.mouseMove(e.clientX - CANVAS.getBoundingClientRect().x));
        window.addEventListener('touchmove', (e) => this.mouseMove(e.touches[0].clientX - CANVAS.getBoundingClientRect().x));
        window.addEventListener('keydown', (e) => this.key(e.key, true));
        window.addEventListener('keyup', (e) => this.key(e.key, false));
    }

    key(key, down) {
        this.focus = Controller.FOCUS.keyboard;
        const mappedKey = Controller.KEYBOARD_CONFIG[key]
        if (mappedKey) {
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

    mouseMove(mouseX) {
        this.focus = Controller.FOCUS.mouse;
        this.mouseX = mouseX;
    }
}

class Pool {
    active = []
    inactive = []
    constructor(game, entity, size) {
        this.game = game;
        this.size = size;
        this.entity = entity;
    }

    spawn(...args) {
        if (this.inactive.length) {
            const entity = this.inactive.pop();
            entity.spawn(...args);
            this.active.push(entity);
        } else if (this.active.length + this.inactive.length < this.size) {
            const entity = new this.entity(this.game)
            entity.spawn(...args);
            this.active.push(entity);
        }
    }

    despawn(entity) {
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
    gameOver = false;
    hitEffectsCooldown = 0;
    score = 0;

    constructor() {
        this.explosionPool = new Pool(this, Explosion, 5);
        this.scoreEffectPool = new Pool(this, ScoreEffect, 5);
        this.hitEffectPool = new Pool(this, HitEffect, 5);
        this.spikePool = new Pool(this, Spike, 20);
        this.player = new Player(this, new Vector(250, 250));
    }


    start() {
        window.requestAnimationFrame(this.animation);
    }

    animation = (time) => {
        const frameInterval = 1000 / FRAMES_PER_SECOND;
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
        this.score += POINTS_PER_SECOND / FRAMES_PER_SECOND;

        if (!this.gameOver && this.frameCount % 10 === 0) {
            this.spikePool.spawn();
        }

        if (this.hitEffectsCooldown) {
            this.hitEffectsCooldown -= 1;
        }

        if (this.controller.focus === Controller.FOCUS.keyboard) {
            this.target.x = this.player.position.x
            if (this.controller.stickX) {
                this.target.x = this.player.position.x + (100 * this.controller.stickX);
                this.player.moveTowardsTarget(this.target);
            }
        } else if (this.controller.focus === Controller.FOCUS.mouse) {
            this.target.x = this.controller.mouseX;
            this.player.moveTowardsTarget(this.target);
        }

        this.explosionPool.active.forEach((explosion) => {
            explosion.update();
            collide(explosion, this.player, 0.94);
            this.spikePool.active.forEach((spike) => collide(explosion, spike, 0.94));
        });

        this.spikePool.active.forEach((spike) => {
            spike.update()
            const result = collide(this.player, spike, 0.9);
            if (result) {
                const isPositiveHit = result.entityAVelocity.y < 0;
                const color = isPositiveHit ? 'green' : 'red';
                spike.hit(color);

                if (isPositiveHit && !spike.scored) {
                    spike.scored = true;
                    const score = 1 * spike.multiplier;
                    this.scoreEffectPool.spawn(result.contactPosition, score);
                    this.score += score;
                }

                const strength = Math.abs(result.entityAVelocity.y) * 10;
                if (strength > this.hitEffectsCooldown) {
                    this.hitEffectPool.spawn(
                        result.contactPosition,
                        this.player.velocity.copy(),
                        color,
                        Math.max(strength, 10)
                    );
                    this.hitEffectsCooldown = 5;
                }
            }
        });

        this.player.update();
        this.hitEffectPool.active.forEach((hitEffect) => hitEffect.update());
        this.scoreEffectPool.active.forEach((scoreEffect) => scoreEffect.update());

        if (!this.gameOver && this.player.position.y - this.player.radius > CANVAS.height) {
            this.gameOver = true;
            this.explosionPool.spawn(new Vector(this.player.position.x, this.player.position.y));
        }
    }

    render(ctx) {
        this.explosionPool.active.forEach((explosion) => explosion.render(ctx));
        this.hitEffectPool.active.forEach((hitEffect) => hitEffect.render(ctx));
        this.player.render(ctx);
        this.spikePool.active.forEach((spike) => spike.render(ctx));
        this.scoreEffectPool.active.forEach((scoreEffect) => scoreEffect.render(ctx));

        ctx.fillStyle = 'black';
        ctx.fillText(this.score.toFixed(0), 10, 15);
    }
}

const game = new Game()
game.start();
