const CANVAS = document.querySelector('canvas');
const CTX = CANVAS.getContext('2d');

const easeOut = (t, exponent = 5) => 1 - Math.pow(1 - t, exponent);

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
        this.velocity.scale(this.friction);
        this.position.add(this.velocity);
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

class Explosion {
    hitEffect = new HitEffect();
    position = new Vector(0, 0);
    velocity = new Vector(0, 0);
    radius = 0;
    static ANIMATION_DURATION = 10;
    animation = 0;

    reset(position) {
        this.animation = Explosion.ANIMATION_DURATION;
        this.position = position;
        this.hitEffect.spawn(this.position, this.velocity, 'black', 70);
    }

    update() {
        this.radius = this.animation * 18;
    }

    render(ctx) {
        this.hitEffect.render(ctx);
        ctx.save();
        if (this.animation) {
            this.animation -= 1;
        }

        const gradient = ctx.createRadialGradient(
            this.position.x,
            this.position.y,
            0,
            this.position.x,
            this.position.y,
            this.radius
        );
        gradient.addColorStop(easeOut(1 - this.animation / Explosion.ANIMATION_DURATION), 'white');
        gradient.addColorStop(1, 'black');

        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, 2 * Math.PI);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

class Spike {
    scored = false;
    position = new Vector(0, 0);
    velocity = new Vector(0, 0);
    targetVelocity = 0;
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
        this.targetVelocity = Math.random() * Spike.MAX_SPAWN_VELOCITY;
        this.velocity.y = this.targetVelocity;
    }

    hit(color) {
        this.animation = Spike.ANIMATION_DURATION;
        this.color = color;
    }

    update() {
        this.velocity.scale(this.friction, Math.abs(this.velocity.y) > Math.abs(this.targetVelocity) ? this.friction : 1);
        this.position.add(this.velocity);
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
    radius = 25;
    maxSpeed = 100;
    friction = 0.85;
    acceleration = 2;
    velocity = new Vector(0, 0);

    constructor(position) {
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
    score = 0;
    hitEffects = [
        new HitEffect(),
        new HitEffect(),
        new HitEffect(),
    ];
    explosions = [
        new Explosion(),
        new Explosion(),
    ]
    scoreEffects = [
        new ScoreEffect(),
        new ScoreEffect(),
        new ScoreEffect(),
    ];


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
        if (!this.gameOver && this.frameCount % 10 === 0) {
            this.spikePool.activate();
        }

        if (!this.gameOver && this.frameCount % 100 === 0) {
            this.score++;
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


        if (this.hitEffectsCooldown) {
            this.hitEffectsCooldown -= 1;
        }

        this.explosions.forEach((explosion) => {
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
                    const scoreEffect = this.scoreEffects.shift();
                    scoreEffect.spawn(result.contactPosition);
                    this.scoreEffects.push(scoreEffect);
                    this.score++;
                }

                const strength = Math.abs(result.entityAVelocity.y) * 10;
                if (strength > this.hitEffectsCooldown) {
                    const hitEffect = this.hitEffects.shift();
                    hitEffect.spawn(
                        result.contactPosition,
                        new Vector(this.player.velocity.x, this.player.velocity.y),
                        color,
                        Math.max(strength, 10)
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
            this.explosions[0].reset(new Vector(this.player.position.x, this.player.position.y));
        }

        this.hitEffects.forEach((hitEffect) => hitEffect.update());
    }

    render(ctx) {
        this.hitEffects.forEach((hitEffect) => hitEffect.render(ctx));
        this.player.render(ctx);
        this.spikePool.active.forEach((spike) => spike.render(ctx));
        this.scoreEffects.forEach((scoreEffect) => scoreEffect.render(ctx));
        this.explosions.forEach((explosion) => explosion.render(ctx));

        ctx.fillStyle = 'black';
        ctx.fillText(this.score, 10, 15);
    }
}

const game = new Game()
game.start();
