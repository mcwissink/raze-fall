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
            ctx.scale(Math.sign(this.velocity.x), 1)
            ctx.lineWidth = 10 * (1 - easedValue);
            ctx.setLineDash([100 * (1 - easedValue), 100 * easedValue]);
            ctx.strokeStyle = this.color;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * easedValue, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.restore();
        }
    }
}

class Spike {
    position = new Vector(0, 0);
    velocity = new Vector(0, 5);
    radius = 20;
    friction = 0.8;

    static ANIMATION_DURATION = 50;
    animation = 0;
    color = 'red';


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
        gradient.addColorStop(easeOut(1 - this.animation / Spike.ANIMATION_DURATION), 'white');
        gradient.addColorStop(1, this.color);

        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, 2 * Math.PI);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.stroke();
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
    static MAP = {
        'ArrowLeft': -1,
        'ArrowRight': 1,
    }
    stickX
    key(key, down) {
        this.stickX = down ? Controller.MAP[key] : 0;
    }
}

class Game {
    previousTime = 0;
    target = new Vector(0, 0);
    controller = new Controller();
    player = new Player(new Vector(250, 250));
    spikes = [
        new Spike(),
        new Spike(),
        new Spike(),
        new Spike(),
    ];
    hitEffectsCooldown = 0;
    hitEffects = [
        new HitEffect(),
        new HitEffect(),
        new HitEffect(),
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

            this.update();
            CTX.fillStyle = "rgba(255, 255, 255, 1)";
            CTX.fillRect(0, 0, CANVAS.width, CANVAS.height);
            this.render(CTX);
        }

        window.requestAnimationFrame(this.animation);
    }

    update() {
        this.target.x = this.player.position.x;
        if (this.controller.stickX) {
            this.target.x = this.player.position.x + (100 * this.controller.stickX);
            this.player.moveTowardsTarget(this.target);
        }

        if (this.hitEffectsCooldown) {
            this.hitEffectsCooldown -= 1;
        }

        this.spikes.forEach((spike) => {
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

                const color = playerVelocityY < 0 ? 'green' : 'red';
                spike.hit(color);

                const strength = Math.abs(playerVelocityY) * 10;
                if (strength > this.hitEffectsCooldown) {
                    const hitEffect = this.hitEffects.shift();
                    hitEffect.spawn(
                        new Vector(this.player.position.x + dx / 2, this.player.position.y + dy / 2),
                        new Vector(this.player.velocity.x, this.player.velocity.y),
                        color,
                        strength
                    );
                    this.hitEffects.push(hitEffect);
                    this.hitEffectsCooldown = Math.round(strength);
                }
            }

            if (spike.position.y - spike.radius > CANVAS.height) {
                spike.position.x = Math.random() * CANVAS.width;
                spike.position.y = -spike.radius;
            }
        });

        this.player.update();
        this.hitEffects.forEach((hitEffect) => hitEffect.update());
    }

    render(ctx) {
        this.hitEffects.forEach((hitEffect) => hitEffect.render(ctx));
        this.player.render(ctx);
        this.spikes.forEach((spike) => spike.render(ctx));
    }
}

const game = new Game()
game.start();
