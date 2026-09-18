import { ClipEffect } from '../types/effects';

/**
 * Master intensity (0..100) folds into the effect's primary numeric params so
 * preview (CSS filter path) and export (canvas path) render identically.
 * Unknown keys pass through untouched.
 */
const INTENSITY_KEYS = new Set([
  'amount', 'intensity', 'radius', 'opacity', 'saturation', 'vibrance',
  'grainAmount', 'grayscale', 'sepia', 'brightness', 'contrast',
]);
export function withEffectIntensity(effect: ClipEffect): ClipEffect {
  const k = Math.max(0, Math.min(1, (effect.intensity ?? 100) / 100));
  if (k === 1) return effect;
  const params: Record<string, any> = { ...(effect.params || {}) };
  for (const key of Object.keys(params)) {
    if (typeof params[key] === 'number' && (INTENSITY_KEYS.has(key) || key.toLowerCase().includes('intens') || key.toLowerCase().includes('amount') || key.toLowerCase().includes('opacity'))) {
      params[key] = params[key] * k;
    }
  }
  return { ...effect, params };
}

/**
 * Build dynamic CSS filter string from active effect stack for HTML5 video element
 */
export function buildCssFilterString(effects?: ClipEffect[]): string {
  if (!effects || effects.length === 0) return 'none';

  const filters: string[] = [];

  for (const rawEffect of effects) {
    if (!rawEffect.enabled) continue;
    const effect = withEffectIntensity(rawEffect);
    const p = effect.params || {};

    switch (effect.type) {
      case 'brightness-contrast': {
        const b = 1 + (p.brightness || 0) / 100;
        const c = 1 + (p.contrast || 0) / 100;
        filters.push(`brightness(${Math.max(0, b)})`);
        filters.push(`contrast(${Math.max(0, c)})`);
        break;
      }
      case 'exposure': {
        const ev = p.exposure || 0;
        const b = Math.pow(2, ev);
        filters.push(`brightness(${Math.max(0, b)})`);
        if (p.gamma && p.gamma !== 1.0) {
          filters.push(`contrast(${Math.max(0.2, p.gamma)})`);
        }
        break;
      }
      case 'saturation': {
        const s = (p.saturation ?? 100) / 100;
        filters.push(`saturate(${Math.max(0, s)})`);
        break;
      }
      case 'temperature': {
        const temp = p.temperature || 0; // -100 to 100
        if (temp > 0) {
          // Warm golden
          filters.push(`sepia(${Math.min(0.6, (temp / 100) * 0.5)}) saturate(${1 + (temp / 100) * 0.4}) hue-rotate(-${(temp / 100) * 15}deg)`);
        } else if (temp < 0) {
          // Cool blue
          const abs = Math.abs(temp) / 100;
          filters.push(`saturate(${1 + abs * 0.2}) hue-rotate(${abs * 20}deg)`);
        }
        break;
      }
      case 'tint': {
        const amount = (p.amount ?? 30) / 100;
        if (amount > 0) {
          filters.push(`sepia(${amount * 0.4}) hue-rotate(240deg)`);
        }
        break;
      }
      case 'hue': {
        const h = p.hueShift || 0;
        if (h !== 0) filters.push(`hue-rotate(${h}deg)`);
        break;
      }
      case 'vibrance': {
        const v = 1 + (p.vibrance || 0) / 100;
        filters.push(`saturate(${Math.max(0, v)})`);
        break;
      }
      case 'sharpen': {
        const amount = (p.amount ?? 35) / 100;
        filters.push(`contrast(${1 + amount * 0.4}) brightness(${1 + amount * 0.1})`);
        break;
      }
      case 'gaussian-blur': {
        const r = p.radius || 0;
        if (r > 0) filters.push(`blur(${r * 0.5}px)`);
        break;
      }
      case 'motion-blur': {
        const amount = (p.amount ?? 15) / 10;
        if (amount > 0) filters.push(`blur(${amount}px)`);
        break;
      }
      case 'glow': {
        const intensity = (p.intensity ?? 45) / 100;
        if (intensity > 0) {
          filters.push(`brightness(${1 + intensity * 0.3}) drop-shadow(0 0 ${intensity * 12}px rgba(255,255,255,0.7))`);
        }
        break;
      }
      case 'glitch': {
        const intensity = (p.intensity ?? 45) / 100;
        if (intensity > 0) {
          filters.push(`contrast(${1 + intensity * 0.3}) drop-shadow(2px 0 0 rgba(239,68,68,0.7)) drop-shadow(-2px 0 0 rgba(6,182,212,0.7))`);
        }
        break;
      }
      case 'chromatic-aberration': {
        const offset = p.offset ?? 8;
        if (offset > 0) {
          filters.push(`drop-shadow(${offset}px 0 0 rgba(239,68,68,0.6)) drop-shadow(-${offset}px 0 0 rgba(6,182,212,0.6))`);
        }
        break;
      }
      case 'black-white': {
        const a = (p.amount ?? 100) / 100;
        filters.push(`grayscale(${Math.min(1, Math.max(0, a))})`);
        if (p.contrastBoost) {
          filters.push(`contrast(${1 + p.contrastBoost / 100})`);
        }
        break;
      }
      case 'sepia': {
        const s = (p.intensity ?? 80) / 100;
        filters.push(`sepia(${Math.min(1, Math.max(0, s))})`);
        break;
      }
    }
  }

  return filters.length > 0 ? filters.join(' ') : 'none';
}

/**
 * Render advanced Canvas post-processing effects (Vignette, Grain, Glitch, Flare, Glow, Pixelate, RGB Shift)
 */
export function renderCanvasPostEffects(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  effects?: ClipEffect[],
  timeSeconds: number = 0
): void {
  if (!effects || effects.length === 0) return;

  for (const rawEffect of effects) {
    if (!rawEffect.enabled) continue;
    const effect = withEffectIntensity(rawEffect);
    const p = effect.params || {};

    switch (effect.type) {
      // 1. Vignette
      case 'vignette': {
        const amount = (p.amount ?? 50) / 100;
        const size = p.size ?? 0.65;
        const feather = (p.feather ?? 60) / 100;
        if (amount > 0) {
          const cx = width / 2;
          const cy = height / 2;
          const maxRadius = Math.sqrt(cx * cx + cy * cy);
          const innerRadius = maxRadius * (size * 0.55);
          const outerRadius = maxRadius * (size + feather * 0.45);

          const grad = ctx.createRadialGradient(cx, cy, innerRadius, cx, cy, outerRadius);
          grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
          grad.addColorStop(1, `rgba(0, 0, 0, ${amount * 0.92})`);

          ctx.save();
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, width, height);
          ctx.restore();
        }
        break;
      }

      // 2. Film Grain / Noise
      case 'film-grain':
      case 'noise': {
        const amount = (p.amount ?? p.intensity ?? 30) / 100;
        if (amount > 0.05) {
          ctx.save();
          ctx.globalAlpha = amount * 0.22;
          ctx.fillStyle = '#FFFFFF';
          const seed = Math.floor(timeSeconds * 24);
          for (let i = 0; i < 300; i++) {
            const x = (Math.sin(i * 99 + seed) * 0.5 + 0.5) * width;
            const y = (Math.cos(i * 33 + seed) * 0.5 + 0.5) * height;
            const w = Math.random() * 2.5 + 1;
            ctx.fillRect(x, y, w, w);
          }
          ctx.restore();
        }
        break;
      }

      // 3. Tint / Color Wash
      case 'tint': {
        const color = p.color || '#8B5CF6';
        const amount = (p.amount ?? 30) / 100;
        if (amount > 0) {
          ctx.save();
          ctx.globalAlpha = amount * 0.35;
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, width, height);
          ctx.restore();
        }
        break;
      }

      // 4. Temperature / White Balance Wash
      case 'temperature': {
        const temp = p.temperature || 0; // -100 to 100
        const tint = p.tint || 0;
        if (temp !== 0 || tint !== 0) {
          ctx.save();
          if (temp > 0) {
            ctx.globalAlpha = (temp / 100) * 0.25;
            ctx.fillStyle = '#FFA500';
            ctx.fillRect(0, 0, width, height);
          } else if (temp < 0) {
            ctx.globalAlpha = (Math.abs(temp) / 100) * 0.25;
            ctx.fillStyle = '#06B6D4';
            ctx.fillRect(0, 0, width, height);
          }
          if (tint > 0) {
            ctx.globalAlpha = (tint / 100) * 0.18;
            ctx.fillStyle = '#EC4899';
            ctx.fillRect(0, 0, width, height);
          } else if (tint < 0) {
            ctx.globalAlpha = (Math.abs(tint) / 100) * 0.18;
            ctx.fillStyle = '#10B981';
            ctx.fillRect(0, 0, width, height);
          }
          ctx.restore();
        }
        break;
      }

      // 5. Glow / Bloom Highlight Bleed
      case 'glow': {
        const intensity = (p.intensity ?? 45) / 100;
        const radius = p.radius ?? 20;
        if (intensity > 0) {
          ctx.save();
          ctx.globalAlpha = intensity * 0.45;
          ctx.filter = `blur(${radius * 0.6}px) brightness(1.6)`;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.fillRect(0, 0, width, height);
          ctx.restore();
        }
        break;
      }

      // 6. Anamorphic Lens Flare
      case 'lens-flare': {
        const posX = ((p.posX ?? 50) / 100) * width;
        const posY = ((p.posY ?? 35) / 100) * height;
        const intensity = (p.intensity ?? 60) / 100;
        const flareColor = p.color || '#38BDF8';
        const size = p.size ?? 1.0;

        if (intensity > 0.05) {
          ctx.save();
          ctx.globalAlpha = intensity * 0.8;

          // Horizontal streak
          const streakGrad = ctx.createLinearGradient(0, posY, width, posY);
          streakGrad.addColorStop(0, 'rgba(0,0,0,0)');
          streakGrad.addColorStop(Math.max(0, posX / width - 0.3), 'rgba(0,0,0,0)');
          streakGrad.addColorStop(posX / width, flareColor);
          streakGrad.addColorStop(Math.min(1, posX / width + 0.3), 'rgba(0,0,0,0)');
          streakGrad.addColorStop(1, 'rgba(0,0,0,0)');

          ctx.fillStyle = streakGrad;
          ctx.fillRect(0, posY - 5 * size, width, 10 * size);

          // Center starburst
          const starGrad = ctx.createRadialGradient(posX, posY, 0, posX, posY, 55 * size);
          starGrad.addColorStop(0, '#FFFFFF');
          starGrad.addColorStop(0.3, flareColor);
          starGrad.addColorStop(1, 'rgba(0,0,0,0)');

          ctx.fillStyle = starGrad;
          ctx.beginPath();
          ctx.arc(posX, posY, 55 * size, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }
        break;
      }

      // 7. Glitch / CRT Scanlines
      case 'glitch': {
        const intensity = (p.intensity ?? 45) / 100;
        const scanlines = (p.scanlines ?? 30) / 100;
        const rgbSplit = p.rgbSplit ?? 12;

        ctx.save();
        // Scanlines
        if (scanlines > 0) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
          const lineSpacing = 4;
          for (let y = 0; y < height; y += lineSpacing) {
            ctx.fillRect(0, y, width, 1.5);
          }
        }

        // Horizontal glitch tears (intermittent)
        if (intensity > 0.1 && Math.sin(timeSeconds * 14) > 0.2) {
          ctx.fillStyle = 'rgba(6, 182, 212, 0.45)';
          const tearY = (Math.abs(Math.sin(timeSeconds * 28)) * height);
          ctx.fillRect(0, tearY, width, 14);
          ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
          ctx.fillRect(rgbSplit, tearY + 4, width, 10);
        }
        ctx.restore();
        break;
      }

      // 8. Chromatic Aberration / RGB Shift
      case 'chromatic-aberration': {
        const offset = p.offset ?? 8;
        if (offset > 0) {
          ctx.save();
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = 'rgba(6, 182, 212, 0.5)';
          ctx.fillRect(-offset, 0, width, height);
          ctx.fillStyle = 'rgba(239, 68, 68, 0.5)';
          ctx.fillRect(offset, 0, width, height);
          ctx.restore();
        }
        break;
      }
    }
  }
}
