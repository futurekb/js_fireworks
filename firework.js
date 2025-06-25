// 設定オブジェクト
const CONFIG = {
    physics: {
        gravity: 0.04,
        explosionGravity: 0.03,
        willowGravity: 0.05,
        friction: 0.995,
        explosionFriction: 0.995,
        airResistance: 0.998
    },
    particles: {
        baseCount: 120,
        burstModeCount: 80,
        maxParticles: 600,
        burstMaxParticles: 400,
        minBrightness: 50,
        maxBrightness: 80,
        minSize: 0.8,
        maxSize: 2.5,
        minSpeed: 0.8,
        maxSpeed: 1.2,
        explosionMinSpeed: 1.5,
        explosionMaxSpeed: 3.5,
        trailLength: 3
    },
    colors: {
        hueVariance: 15,
        smokeHue: 220,
        smokeBrightness: 15
    },
    timing: {
        minLife: 30,
        maxLife: 45,
        explosionMinLife: 60,
        explosionMaxLife: 85,
        fadeAlpha: 0.05,
        minDecay: 0.02,
        maxDecay: 0.03,
        explosionMinDecay: 0.025,
        explosionMaxDecay: 0.04
    },
    effects: {
        flashSize: 10,
        flashLife: 25,
        flashDecay: 0.1,
        smokeParticles: 12,
        glowParticles: 8
    },
    rocket: {
        minScale: 0.6,
        maxScale: 2.2,
        minSpeed: 1.8,
        maxSpeed: 2.2,
        targetHeightMin: 0.15,
        targetHeightMax: 0.45,
        trailLength: 15,
        sparkChance: 0.15
    },
    burst: {
        minCount: 6,
        maxCount: 10,
        minInterval: 30,
        maxInterval: 60,
        minRockets: 1,
        maxRockets: 2,
        cooldownTime: 480000
    },
    performance: {
        backgroundAlpha: 0.25,
        minRenderAlpha: 0.08,
        particleCleanupThreshold: 0.15
    }
};

class Particle {
    constructor(x, y, hue, type = 'normal', scale = 1, velocity = null) {
        this.x = x;
        this.y = y;
        this.hue = hue;
        this.type = type;
        this.history = [];
        this.brightness = random(CONFIG.particles.minBrightness, CONFIG.particles.maxBrightness);
        this.alpha = 1;
        this.decay = type === 'explosion' ? 
            random(CONFIG.timing.explosionMinDecay, CONFIG.timing.explosionMaxDecay) : 
            random(CONFIG.timing.minDecay, CONFIG.timing.maxDecay);
        this.smokeDecay = random(0.01, 0.02);
        this.size = random(CONFIG.particles.minSize, CONFIG.particles.maxSize) * scale;
        this.angle = random(0, Math.PI * 2);
        this.speed = random(
            type === 'explosion' ? CONFIG.particles.explosionMinSpeed : CONFIG.particles.minSpeed,
            type === 'explosion' ? CONFIG.particles.explosionMaxSpeed : CONFIG.particles.maxSpeed
        ) * scale;
        this.friction = type === 'explosion' ? CONFIG.physics.explosionFriction : CONFIG.physics.friction;
        this.gravity = type === 'explosion' ? CONFIG.physics.explosionGravity : CONFIG.physics.gravity;
        this.hueVariance = random(-CONFIG.colors.hueVariance, CONFIG.colors.hueVariance);
        this.maxLife = type === 'explosion' ? 
            random(CONFIG.timing.explosionMinLife, CONFIG.timing.explosionMaxLife) : 
            random(CONFIG.timing.minLife, CONFIG.timing.maxLife);
        this.life = 0;
        this.velocity = velocity || {
            x: Math.cos(this.angle) * this.speed,
            y: Math.sin(this.angle) * this.speed
        };
    }

    update() {
        this.life++;
        
        if (this.life >= this.maxLife || this.alpha <= CONFIG.timing.fadeAlpha) {
            this.alpha = 0;
            this.history = [];
            return false;
        }

        // トレイルの更新は可視状態でのみ
        if (this.alpha > CONFIG.performance.minRenderAlpha) {
            this.history.push({ x: this.x, y: this.y, alpha: this.alpha });
            if (this.history.length > CONFIG.particles.trailLength) this.history.shift();
        }

        // より現実的な物理演算
        const airDensity = 1 - (this.y / canvas.height) * 0.1; // 高度による空気密度変化
        this.velocity.x *= this.friction * (CONFIG.physics.airResistance + airDensity * 0.002);
        this.velocity.y *= this.friction;
        this.velocity.y += this.gravity * airDensity;
        
        // 風の影響（微弱）
        if (this.type === 'explosion' && this.y < canvas.height * 0.6) {
            this.velocity.x += random(-0.02, 0.02);
        }
        
        this.x += this.velocity.x;
        this.y += this.velocity.y;

        // タイプ別のアルファ減衰
        if (this.type === 'explosion') {
            const lifeRatio = this.life / this.maxLife;
            const fadeStrength = lifeRatio < 0.3 ? 0.3 : 0.9; // 初期は明るく保つ
            this.alpha = Math.max(0, 1 - (lifeRatio * fadeStrength));
            this.brightness = Math.max(10, this.brightness - (lifeRatio * 0.3));
            
            // 高度による明るさの変化
            if (this.y < canvas.height * 0.4) {
                this.alpha *= 0.998;
            }
        } else if (this.type === 'willow') {
            // 柳は非常にゆっくりと消える
            const lifeRatio = this.life / this.maxLife;
            if (lifeRatio < 0.7) {
                this.alpha = Math.max(0.3, 1 - (lifeRatio * 0.4)); // 初期70%は明るく
            } else {
                this.alpha = Math.max(0, 0.3 - ((lifeRatio - 0.7) * 1.0)); // 後半30%で徐々に消える
            }
            this.brightness = Math.max(20, this.brightness - (lifeRatio * 0.2));
        } else {
            this.alpha = Math.max(0, this.alpha - this.decay);
        }

        // 画面外の判定を簡略化
        if (this.y > canvas.height + 50 || this.x < -50 || this.x > canvas.width + 50) {
            this.alpha = 0;
        }

        return this.alpha > CONFIG.timing.fadeAlpha;
    }

    draw(ctx) {
        if (this.alpha <= CONFIG.performance.minRenderAlpha) return;

        // グラデーションを使用してよりリアルな光を表現
        const gradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, this.size * 2
        );
        
        const coreAlpha = this.alpha;
        const edgeAlpha = this.alpha * 0.1;
        const hsl = `${this.hue + this.hueVariance}, 100%, ${this.brightness}%`;
        
        gradient.addColorStop(0, `hsla(${hsl}, ${coreAlpha})`);
        gradient.addColorStop(0.6, `hsla(${hsl}, ${this.alpha * 0.4})`);
        gradient.addColorStop(1, `hsla(${hsl}, ${edgeAlpha})`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // トレイルの描画を簡略化
        if (this.history.length > 1 && this.alpha > CONFIG.performance.minRenderAlpha * 3) {
            ctx.globalAlpha = this.alpha * 0.2;
            ctx.strokeStyle = `hsl(${this.hue + this.hueVariance}, 100%, ${this.brightness}%)`;
            ctx.lineWidth = this.size * 0.5;
            ctx.beginPath();
            ctx.moveTo(this.history[0].x, this.history[0].y);
            for (let i = 1; i < this.history.length; i++) {
                ctx.lineTo(this.history[i].x, this.history[i].y);
            }
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    }
}

class Rocket {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.scale = random(CONFIG.rocket.minScale, CONFIG.rocket.maxScale);
        this.explosionType = Math.floor(random(0, 8));
        this.targetY = random(canvas.height * CONFIG.rocket.targetHeightMin, canvas.height * CONFIG.rocket.targetHeightMax);
        this.velocity = {
            x: random(-0.1, 0.1),
            y: -random(CONFIG.rocket.minSpeed, CONFIG.rocket.maxSpeed) * (1 + this.scale * 0.2)
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
        
        if (this.trail.length > CONFIG.rocket.trailLength) this.trail.shift();
        
        if (Math.random() < CONFIG.rocket.sparkChance) {
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
    const baseParticleCount = burstMode.active ? CONFIG.particles.burstModeCount : CONFIG.particles.baseCount;
    const particleCount = Math.floor(baseParticleCount * scale);

    switch (explosionType) {
        case 0: // 変化菊
            // 内側の小さな球形（ランダムな分布）
            for (let i = 0; i < particleCount * 0.25; i++) {
                const angle = random(0, Math.PI * 2);
                const radius = random(0.3, 0.8);
                const speed = random(0.8, 1.5) * scale * radius;
                const velocity = {
                    x: Math.cos(angle) * speed,
                    y: Math.sin(angle) * speed
                };
                particles.push(new Particle(x, y, hue + random(-5, 5), 'explosion', scale * 0.6, velocity));
            }
            // 外側の大きな球形（より自然な分布）
            for (let i = 0; i < particleCount * 0.75; i++) {
                const angle = random(0, Math.PI * 2);
                const variation = random(0.7, 1.3);
                const speed = random(2.0, 3.2) * scale * variation;
                const velocity = {
                    x: Math.cos(angle) * speed,
                    y: Math.sin(angle) * speed * 0.9
                };
                particles.push(new Particle(x, y, hue + random(-8, 8), 'explosion', scale, velocity));
            }
            break;

        case 1: // 牡丹
            const petalCount = 6;
            for (let petal = 0; petal < petalCount; petal++) {
                const petalAngle = (petal / petalCount) * Math.PI * 2;
                const particlesPerPetal = Math.floor(particleCount / petalCount);
                
                for (let i = 0; i < particlesPerPetal; i++) {
                    const angleVariation = random(-0.4, 0.4);
                    const angle = petalAngle + angleVariation;
                    const distanceFromCenter = i / particlesPerPetal;
                    const petalShape = Math.sin(distanceFromCenter * Math.PI) * 0.8 + 0.2;
                    const speed = random(1.5, 3.5) * scale * petalShape;
                    
                    const velocity = {
                        x: Math.cos(angle) * speed,
                        y: Math.sin(angle) * speed * 0.85
                    };
                    
                    const petalHue = hue + random(-12, 12) + (petal * 3);
                    particles.push(new Particle(x, y, petalHue, 'explosion', scale * (0.7 + petalShape * 0.3), velocity));
                }
            }
            break;

        case 2: // 冠
            const rings = 4;
            for (let ring = 0; ring < rings; ring++) {
                const ringRatio = ring / (rings - 1);
                const ringParticles = Math.floor(particleCount * (0.4 - ring * 0.08));
                const baseSpeed = (2.5 - ring * 0.4) * scale;
                
                for (let i = 0; i < ringParticles; i++) {
                    const angle = random(0, Math.PI * 2);
                    const speedVariation = random(0.8, 1.2);
                    const speed = baseSpeed * speedVariation;
                    
                    // 冠の形を作るための上向きバイアス
                    const upwardBias = Math.sin(angle) > 0 ? 1.2 : 0.9;
                    
                    const velocity = {
                        x: Math.cos(angle) * speed,
                        y: Math.sin(angle) * speed * upwardBias
                    };
                    
                    const ringHue = hue + (ring * 20) + random(-8, 8);
                    const ringScale = (1 - ring * 0.15) * scale;
                    particles.push(new Particle(x, y, ringHue, 'explosion', ringScale, velocity));
                }
            }
            break;

        case 3: // 柳
            // 中央から上向きに放射状に発射
            for (let i = 0; i < particleCount; i++) {
                const spreadAngle = random(-Math.PI * 0.25, Math.PI * 0.25);
                const mainAngle = -Math.PI / 2 + spreadAngle;
                const speed = random(1.8, 4.2) * scale;
                
                // 柳の特徴的な流れる動き
                const driftX = random(-0.8, 0.8);
                const velocity = {
                    x: Math.cos(mainAngle) * speed + driftX,
                    y: Math.sin(mainAngle) * speed
                };
                
                const particle = new Particle(x, y, hue + random(-10, 10), 'willow', scale * random(0.8, 1.2), velocity);
                particle.gravity = CONFIG.physics.willowGravity;
                particle.friction = 0.992;
                particle.maxLife = random(300, 400); // 10秒程度持続
                particles.push(particle);
            }
            break;
            
        case 4: // 菊（外側のみ）
            for (let i = 0; i < particleCount; i++) {
                const angle = random(0, Math.PI * 2);
                const speed = random(2.2, 3.8) * scale;
                const velocity = {
                    x: Math.cos(angle) * speed,
                    y: Math.sin(angle) * speed * 0.95
                };
                particles.push(new Particle(x, y, hue + random(-5, 5), 'explosion', scale, velocity));
            }
            break;
            
        case 5: // 梅（小さな花形）
            const branches = 5;
            for (let branch = 0; branch < branches; branch++) {
                const branchAngle = (branch / branches) * Math.PI * 2;
                const particlesPerBranch = Math.floor(particleCount / branches);
                
                for (let i = 0; i < particlesPerBranch; i++) {
                    const distance = i / particlesPerBranch;
                    const angle = branchAngle + random(-0.2, 0.2);
                    const speed = random(1.2, 2.8) * scale * (1 - distance * 0.3);
                    
                    const velocity = {
                        x: Math.cos(angle) * speed,
                        y: Math.sin(angle) * speed
                    };
                    
                    particles.push(new Particle(x, y, hue + random(-8, 8), 'explosion', scale * 0.8, velocity));
                }
            }
            break;
            
        case 6: // 蛇玉（らせん状）
            const spiralTurns = 3;
            for (let i = 0; i < particleCount; i++) {
                const progress = i / particleCount;
                const angle = progress * Math.PI * 2 * spiralTurns;
                const radius = progress * 2.5 * scale;
                const speed = random(1.5, 3.0) * scale;
                
                const velocity = {
                    x: Math.cos(angle) * speed + Math.cos(angle) * radius * 0.1,
                    y: Math.sin(angle) * speed + Math.sin(angle) * radius * 0.1
                };
                
                particles.push(new Particle(x, y, hue + (progress * 60), 'explosion', scale, velocity));
            }
            break;
            
        case 7: // 桃割（二色分かれ）
            const color1 = hue;
            const color2 = (hue + 180) % 360;
            
            for (let i = 0; i < particleCount; i++) {
                const angle = random(0, Math.PI * 2);
                const speed = random(2.0, 3.5) * scale;
                const velocity = {
                    x: Math.cos(angle) * speed,
                    y: Math.sin(angle) * speed
                };
                
                const particleColor = i < particleCount / 2 ? color1 : color2;
                particles.push(new Particle(x, y, particleColor, 'explosion', scale, velocity));
            }
            break;
    }

    // 閃光エフェクト
    const flash = new Particle(x, y, hue, 'flash', scale);
    flash.size = CONFIG.effects.flashSize * scale;
    flash.decay = CONFIG.effects.flashDecay;
    flash.maxLife = CONFIG.effects.flashLife;
    particles.push(flash);

    // グローエフェクト
    for (let i = 0; i < CONFIG.effects.glowParticles; i++) {
        particles.push(new Particle(x, y, hue + 30, 'glow', scale));
    }

    // 煙エフェクト
    for (let i = 0; i < CONFIG.effects.smokeParticles; i++) {
        const smoke = new Particle(x, y, CONFIG.colors.smokeHue, 'smoke', scale);
        smoke.velocity.y *= -0.15;
        smoke.gravity = 0.01;
        smoke.brightness = CONFIG.colors.smokeBrightness;
        smoke.size = random(4, 6) * scale;
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
    burstMode.maxCount = Math.floor(random(CONFIG.burst.minCount, CONFIG.burst.maxCount));
    burstMode.lastBurstTime = Date.now();
    
    burstMode.interval = setInterval(() => {
        if (burstMode.count >= burstMode.maxCount) {
            clearInterval(burstMode.interval);
            burstMode.active = false;
            return;
        }
        
        const burstCount = Math.floor(random(CONFIG.burst.minRockets, CONFIG.burst.maxRockets));
        for (let i = 0; i < burstCount; i++) {
            createRocket();
        }
        burstMode.count++;
    }, random(CONFIG.burst.minInterval, CONFIG.burst.maxInterval));
}

let frameCount = 0;
function animate() {
    frameCount++;
    
    ctx.fillStyle = `rgba(0, 0, 0, ${CONFIG.performance.backgroundAlpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ロケットの更新と描画
    for (let i = rockets.length - 1; i >= 0; i--) {
        const rocket = rockets[i];
        if (rocket.update()) {
            rockets.splice(i, 1);
        } else {
            rocket.draw(ctx);
        }
    }

    // パーティクルの更新と描画（バッチ処理）
    let aliveParticles = 0;
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        if (particle.update()) {
            particle.draw(ctx);
            aliveParticles++;
        } else {
            particles.splice(i, 1);
        }
    }

    // パフヮーマンス管理（フレーム間隔でチェック）
    if (frameCount % 10 === 0) {
        const maxParticles = burstMode.active ? CONFIG.particles.burstMaxParticles : CONFIG.particles.maxParticles;
        if (particles.length > maxParticles) {
            particles.sort((a, b) => b.alpha - a.alpha);
            particles = particles.slice(0, maxParticles);
        }
    }

    // ロケット発射の判定（フレーム間隔でチェック）
    if (!burstMode.active && frameCount % 12 === 0) {
        const currentTime = Date.now();
        const timeSinceLastBurst = currentTime - burstMode.lastBurstTime;
        
        if (Math.random() < 0.06) {
            if (timeSinceLastBurst > CONFIG.burst.cooldownTime && Math.random() < 0.4) {
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
