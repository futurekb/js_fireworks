class Particle {
    constructor(x, y, hue, type = 'normal', scale = 1, velocity = null) {
        this.x = x;
        this.y = y;
        this.hue = hue;
        this.type = type;
        this.history = [];
        this.brightness = random(50, 80);
        this.alpha = 1;
        this.decay = type === 'explosion' ? random(0.03, 0.05) : random(0.02, 0.03);
        this.smokeDecay = random(0.01, 0.02);
        this.size = random(1, 3) * scale;
        this.angle = random(0, Math.PI * 2);
        this.speed = random(1, type === 'explosion' ? 3 : 1.5) * scale;
        this.friction = type === 'explosion' ? 0.995 : 0.995;
        this.gravity = type === 'explosion' ? 0.03 : 0.04;
        this.hueVariance = random(-15, 15);
        this.maxLife = type === 'explosion' ? random(80, 100) : random(40, 50);
        this.life = 0;
        this.velocity = velocity || {
            x: Math.cos(this.angle) * this.speed,
            y: Math.sin(this.angle) * this.speed
        };
    }

    update() {
        this.life++;
        
        if (this.life >= this.maxLife || this.alpha <= 0.05) {
            this.alpha = 0;
            this.history = [];
            return false;
        }

        this.history.push({ x: this.x, y: this.y, alpha: this.alpha });
        if (this.history.length > 4) this.history.shift();

        this.velocity.x *= this.friction;
        this.velocity.y *= this.friction;
        this.velocity.y += this.gravity;
        this.x += this.velocity.x;
        this.y += this.velocity.y;

        if (this.type === 'explosion') {
            const lifeRatio = this.life / this.maxLife;
            this.alpha = Math.max(0, 1 - (lifeRatio * 0.8));
            this.brightness = Math.max(0, this.brightness - (lifeRatio * 0.4));
            
            if (this.y < canvas.height * 0.3) {
                this.alpha *= 0.995;
            }
        } else {
            this.alpha = Math.max(0, this.alpha - this.decay);
        }

        if (this.y >= canvas.height || this.y < 0 || this.x < 0 || this.x > canvas.width) {
            this.alpha = 0;
        }

        return this.alpha > 0.05;
    }

    draw(ctx) {
        if (this.alpha <= 0.05) return;

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';

        const visibleHistory = this.history.filter(h => h.alpha > 0.2);
        visibleHistory.forEach((pos, index) => {
            const ratio = index / visibleHistory.length;
            const alpha = pos.alpha * 0.3 * ratio;
            if (alpha <= 0.1) return;
            
            ctx.fillStyle = `hsla(${this.hue + this.hueVariance}, 100%, ${this.brightness}%, ${alpha})`;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, this.size * ratio, 0, Math.PI * 2);
            ctx.fill();
        });

        if (this.alpha > 0.2) {
            ctx.fillStyle = `hsla(${this.hue + this.hueVariance}, 100%, ${this.brightness}%, ${this.alpha})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

class Rocket {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.scale = random(0.5, 2.5);
        this.explosionType = Math.floor(random(0, 4));
        this.targetY = random(canvas.height * 0.1, canvas.height * 0.4);
        this.velocity = {
            x: random(-0.1, 0.1),
            y: -random(2, 2.5) * (1 + this.scale * 0.2)
        };
        this.trail = [];
        this.sparkTrail = [];
        this.flickerIntensity = random(0.2, 1.0);
        this.flickerRate = random(0.1, 0.3);
        this.currentFlicker = 1.0;
        this.targetFlicker = random(0.1, 1.0);
        this.fadeStartY = 0;
        this.fadeDistance = 120;
        this.timeToExplode = 1000 / this.velocity.y * this.targetY;
        this.fadeStartTime = 2000;
        this.startTime = performance.now();
    }

    updateFlicker() {
        if (Math.random() < this.flickerRate) {
            this.targetFlicker = random(0.1, 1.0);
        }
        this.currentFlicker += (this.targetFlicker - this.currentFlicker) * 0.3;
    }

    update() {
        const elapsedTime = performance.now() - this.startTime;
        const timeLeft = this.timeToExplode + elapsedTime;
        
        const fadeRatio = Math.min(1, Math.max(0, timeLeft / this.fadeStartTime));

        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.updateFlicker();

        if (this.fadeStartY === 0) {
            this.fadeStartY = this.targetY + this.fadeDistance;
        }
        
        this.trail.push({ 
            x: this.x, 
            y: this.y,
            flicker: this.currentFlicker,
            fadeRatio: fadeRatio,
            sparkX: this.x + random(-1, 1),
            sparkY: this.y + random(-1, 1)
        });
        
        if (this.trail.length > 20) this.trail.shift();
        
        if (Math.random() < 0.2) {
            this.sparkTrail.push({
                x: this.x + random(-1, 1),
                y: this.y + random(-1, 1),
                alpha: 0.6,
                fadeRatio: fadeRatio,
                flicker: this.currentFlicker,
                velocity: {
                    x: random(-0.3, 0.3),
                    y: random(-0.3, 0.3)
                }
            });
        }
        
        this.sparkTrail.forEach(spark => {
            spark.x += spark.velocity.x;
            spark.y += spark.velocity.y;
            spark.alpha *= 0.95;
        });
        
        this.sparkTrail = this.sparkTrail.filter(spark => spark.alpha > 0.1);
        
        if (this.y <= this.targetY) {
            createFirework(this.x, this.y, this.scale, this.explosionType);
            return true;
        }
        return false;
    }

    draw(ctx) {
        ctx.save();
        
        const globalFlicker = this.currentFlicker * this.flickerIntensity;
        
        this.sparkTrail.forEach(spark => {
            const flickeredAlpha = spark.alpha * globalFlicker * spark.fadeRatio;
            const gradient = ctx.createRadialGradient(
                spark.x, spark.y, 0,
                spark.x, spark.y, 1.5
            );
            gradient.addColorStop(0, `rgba(255, 140, 20, ${flickeredAlpha * 0.7})`);
            gradient.addColorStop(1, `rgba(255, 100, 0, 0)`);
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(spark.x, spark.y, 1.5, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < this.trail.length; i++) {
            const point = this.trail[i];
            const baseAlpha = (i / this.trail.length) * 0.4;
            const flickeredAlpha = baseAlpha * globalFlicker * point.fadeRatio;
            
            ctx.strokeStyle = `rgba(255, 120, 0, ${flickeredAlpha})`;
            if (i === 0) {
                ctx.moveTo(point.x, point.y);
            } else {
                ctx.lineTo(point.x, point.y);
            }
        }
        ctx.stroke();

        const fadeRatio = Math.max(0, (this.y - this.targetY) / this.fadeDistance);
        const headFlicker = this.currentFlicker * globalFlicker * fadeRatio;
        const headGradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, 3
        );
        headGradient.addColorStop(0, `rgba(255, 180, 40, ${headFlicker})`);
        headGradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
        
        ctx.fillStyle = headGradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}

const canvas = document.getElementById('fireworkCanvas');
const ctx = canvas.getContext('2d');
let particles = [];
let rockets = [];
let animationId;
let displayText = '';

let burstMode = {
    active: false,
    count: 0,
    maxCount: 0,
    interval: null,
    lastBurstTime: Date.now()
};

function random(min, max) {
    return Math.random() * (max - min) + min;
}

function createFirework(x, y, scale, explosionType) {
    const hue = random(0, 360);
    const baseParticleCount = burstMode.active ? 100 : 150;
    const particleCount = Math.floor(baseParticleCount * scale);

    switch (explosionType) {
        case 0: // 変化菊
            // 内側の小さな球形
            for (let i = 0; i < particleCount * 0.3; i++) {
                const angle = (i / (particleCount * 0.3)) * Math.PI * 2;
                const speed = random(1, 2) * scale;
                const velocity = {
                    x: Math.cos(angle) * speed,
                    y: Math.sin(angle) * speed
                };
                particles.push(new Particle(x, y, hue, 'explosion', scale * 0.5, velocity));
            }
            // 外側の大きな球形
            for (let i = 0; i < particleCount * 0.7; i++) {
                const angle = (i / (particleCount * 0.7)) * Math.PI * 2;
                const speed = random(2.5, 4) * scale;
                const velocity = {
                    x: Math.cos(angle) * speed,
                    y: Math.sin(angle) * speed
                };
                particles.push(new Particle(x, y, hue, 'explosion', scale, velocity));
            }
            break;

        case 1: // 牡丹
            for (let i = 0; i < particleCount; i++) {
                const angle = (i / particleCount) * Math.PI * 2;
                const baseSpeed = random(2, 4) * scale;
                const layerOffset = Math.sin(angle * 8) * 0.5; // 花びらのような波打つ効果
                const speed = baseSpeed * (1 + layerOffset);
                const velocity = {
                    x: Math.cos(angle) * speed,
                    y: Math.sin(angle) * speed
                };
                particles.push(new Particle(x, y, hue + random(-10, 10), 'explosion', scale, velocity));
            }
            break;

        case 2: // 冠
            const rings = 3; // 冠の層数
            for (let ring = 0; ring < rings; ring++) {
                const ringScale = 1 - (ring * 0.2); // 内側ほど小さく
                for (let i = 0; i < particleCount / rings; i++) {
                    const angle = (i / (particleCount / rings)) * Math.PI * 2;
                    const speed = (3 - ring) * scale;
                    const velocity = {
                        x: Math.cos(angle) * speed,
                        y: Math.sin(angle) * speed
                    };
                    particles.push(new Particle(x, y, hue + (ring * 15), 'explosion', scale * ringScale, velocity));
                }
            }
            break;

        case 3: // 柳
            for (let i = 0; i < particleCount; i++) {
                const angle = random(-Math.PI * 0.3, Math.PI * 0.3) - Math.PI / 2; // 上向きの扇形
                const speed = random(2, 5) * scale;
                const velocity = {
                    x: Math.cos(angle) * speed + random(-0.5, 0.5), // 揺らぎを加える
                    y: Math.sin(angle) * speed
                };
                const particle = new Particle(x, y, hue, 'explosion', scale, velocity);
                particle.gravity = 0.05; // 柳は重力の影響を強く
                particles.push(particle);
            }
            break;
    }

    // 閃光エフェクト
    const flash = new Particle(x, y, hue, 'flash', scale);
    flash.size = 12 * scale;
    flash.decay = 0.08;
    flash.maxLife = 35;
    particles.push(flash);

    // グローエフェクト
    for (let i = 0; i < 10; i++) {
        particles.push(new Particle(x, y, hue + 30, 'glow', scale));
    }

    // 煙エフェクト
    for (let i = 0; i < 15; i++) {
        const smoke = new Particle(x, y, 0, 'smoke', scale);
        smoke.velocity.y *= -0.15;
        smoke.gravity = 0.01;
        smoke.brightness = 10;
        smoke.size = random(5, 8) * scale;
        particles.push(smoke);
    }
}

function showText(text) {
    const textElement = document.getElementById('textDisplay');
    textElement.textContent = text;
    
    textElement.style.transition = 'none';
    textElement.style.opacity = '0';
    textElement.style.transform = 'translate(-50%, -50%) perspective(1000px) translateZ(-1000px)';
    
    textElement.offsetHeight;
    
    textElement.style.transition = 'all 1.5s cubic-bezier(0.190, 1.000, 0.220, 1.000)';
    textElement.style.opacity = '1';
    textElement.style.transform = 'translate(-50%, -50%) perspective(1000px) translateZ(0)';
}

function createRocket() {
    const x = random(canvas.width * 0.1, canvas.width * 0.9);
    rockets.push(new Rocket(x, canvas.height));
}

function startBurstMode() {
    if (burstMode.active) return;
    
    burstMode.active = true;
    burstMode.count = 0;
    burstMode.maxCount = Math.floor(random(8, 12));
    burstMode.lastBurstTime = Date.now();
    
    burstMode.interval = setInterval(() => {
        if (burstMode.count >= burstMode.maxCount) {
            clearInterval(burstMode.interval);
            burstMode.active = false;
            return;
        }
        
        const burstCount = Math.floor(random(1, 3));
        for (let i = 0; i < burstCount; i++) {
            createRocket();
        }
        burstMode.count++;
    }, random(25, 50));
}

function animate() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.globalCompositeOperation = 'source-over';

    rockets = rockets.filter(rocket => {
        rocket.draw(ctx);
        return !rocket.update();
    });

    particles = particles.filter(particle => {
        if (particle.update()) {
            particle.draw(ctx);
            return true;
        }
        return false;
    });

    const maxParticles = burstMode.active ? 500 : 800;
    if (particles.length > maxParticles) {
        particles = particles.filter(p => p.alpha > 0.2);
    }

    if (!burstMode.active) {
        const currentTime = Date.now();
        const timeSinceLastBurst = currentTime - burstMode.lastBurstTime;
        
        if (Math.random() < 0.005) {
            if (timeSinceLastBurst > 600000 && Math.random() < 0.4) {
                startBurstMode();
            } else {
                createRocket();
            }
        }
    }

    animationId = requestAnimationFrame(animate);
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
animate();

canvas.addEventListener('click', (e) => {
    const rocket = new Rocket(e.clientX, canvas.height);
    rockets.push(rocket);
});

window.addEventListener('load', () => {
    showText('花火');
});
