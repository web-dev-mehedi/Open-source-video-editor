import { ParticleSystemConfig } from '../types/particleSystem';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  phase: number;
}

let particlesCache: Particle[] = [];
let lastPreset: string = '';

/**
 * Render procedural GPU particle systems on canvas context
 */
export function renderCanvasParticles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: ParticleSystemConfig,
  currentTime: number
) {
  if (!config.isEnabled || config.preset === 'none') return;

  const count = config.density;
  if (particlesCache.length !== count || lastPreset !== config.preset) {
    particlesCache = [];
    lastPreset = config.preset;

    for (let i = 0; i < count; i++) {
      particlesCache.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 20 * config.speed,
        vy: config.preset === 'falling_snow' ? (20 + Math.random() * 40) * config.speed : (Math.random() - 0.5) * 15 * config.speed,
        size: Math.random() * config.size + 2,
        alpha: Math.random() * config.opacity,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  ctx.save();
  ctx.globalCompositeOperation = config.blendMode as any;

  particlesCache.forEach((p) => {
    // Periodic animation based on currentTime
    const animX = (p.x + p.vx * currentTime + Math.sin(currentTime + p.phase) * 15) % width;
    const animY = (p.y + p.vy * currentTime) % height;
    const px = animX < 0 ? animX + width : animX;
    const py = animY < 0 ? animY + height : animY;

    ctx.save();
    ctx.globalAlpha = p.alpha * (0.6 + 0.4 * Math.sin(currentTime * 2 + p.phase));

    if (config.preset === 'bokeh_orbs') {
      const grad = ctx.createRadialGradient(px, py, 0, px, py, p.size * 2);
      grad.addColorStop(0, config.color || '#FDE047');
      grad.addColorStop(0.5, 'rgba(253, 224, 71, 0.4)');
      grad.addColorStop(1, 'rgba(253, 224, 71, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, p.size * 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = config.color || '#FFFFFF';
      ctx.shadowColor = config.color || '#FFFFFF';
      ctx.shadowBlur = p.size;
      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  });

  ctx.restore();
}
