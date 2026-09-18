import { MaskConfig } from '../types/masking';

/**
 * Generate CSS clip-path / mask styling for real-time HTML5 video playback
 */
export function generateCssMaskStyle(mask?: MaskConfig): React.CSSProperties {
  if (!mask || mask.type === 'none') {
    return {};
  }

  const { centerX, centerY, width, height, rotation, feather, isInverted, filmstripBarHeight = 12 } = mask;

  // 1. Filmstrip / Cinematic Letterbox Mask
  if (mask.type === 'filmstrip') {
    const topH = filmstripBarHeight;
    const botH = 100 - filmstripBarHeight;
    const clip = isInverted
      ? `polygon(0% 0%, 100% 0%, 100% ${topH}%, 0% ${topH}%), polygon(0% ${botH}%, 100% ${botH}%, 100% 100%, 0% 100%)`
      : `polygon(0% ${topH}%, 100% ${topH}%, 100% ${botH}%, 0% ${botH}%)`;
    return {
      clipPath: clip,
      WebkitClipPath: clip,
      transition: 'clip-path 0.05s ease-out',
    };
  }

  // 2. Linear / Split Screen Mask
  if (mask.type === 'linear') {
    const rad = (rotation * Math.PI) / 180;
    const nx = Math.cos(rad);
    const ny = Math.sin(rad);

    // Using linear-gradient mask for smooth feathering
    const featherSpread = Math.max(0.1, feather * 0.4);
    const splitPoint = (centerX * nx + centerY * ny);

    if (feather > 0) {
      const grad = isInverted
        ? `linear-gradient(${rotation + 90}deg, transparent ${splitPoint - featherSpread}%, black ${splitPoint + featherSpread}%)`
        : `linear-gradient(${rotation + 90}deg, black ${splitPoint - featherSpread}%, transparent ${splitPoint + featherSpread}%)`;
      return {
        maskImage: grad,
        WebkitMaskImage: grad,
      };
    }

    const clip = isInverted
      ? `polygon(0% 0%, 100% 0%, 100% ${centerY}%, 0% ${centerY}%)`
      : `polygon(0% ${centerY}%, 100% ${centerY}%, 100% 100%, 0% 100%)`;
    return {
      clipPath: clip,
      WebkitClipPath: clip,
    };
  }

  // 3. Mirror Mask (Two symmetrical split lines)
  if (mask.type === 'mirror') {
    const halfH = height / 2;
    const top = Math.max(0, centerY - halfH);
    const bot = Math.min(100, centerY + halfH);
    const clip = isInverted
      ? `polygon(0% 0%, 100% 0%, 100% ${top}%, 0% ${top}%), polygon(0% ${bot}%, 100% ${bot}%, 100% 100%, 0% 100%)`
      : `polygon(0% ${top}%, 100% ${top}%, 100% ${bot}%, 0% ${bot}%)`;
    return {
      clipPath: clip,
      WebkitClipPath: clip,
    };
  }

  // 4. Radial / Ellipse Mask
  if (mask.type === 'radial') {
    const rx = width / 2;
    const ry = height / 2;

    if (feather > 0) {
      const featherPct = Math.min(30, feather * 0.3);
      const grad = isInverted
        ? `radial-gradient(ellipse ${rx}% ${ry}% at ${centerX}% ${centerY}%, transparent ${Math.max(0, 100 - featherPct)}%, black 100%)`
        : `radial-gradient(ellipse ${rx}% ${ry}% at ${centerX}% ${centerY}%, black ${Math.max(0, 100 - featherPct)}%, transparent 100%)`;
      return {
        maskImage: grad,
        WebkitMaskImage: grad,
      };
    }

    const clip = `ellipse(${rx}% ${ry}% at ${centerX}% ${centerY}%)`;
    return {
      clipPath: clip,
      WebkitClipPath: clip,
    };
  }

  // 5. Rectangle Mask
  if (mask.type === 'rectangle') {
    const x0 = Math.max(0, centerX - width / 2);
    const y0 = Math.max(0, centerY - height / 2);
    const x1 = Math.min(100, centerX + width / 2);
    const y1 = Math.min(100, centerY + height / 2);

    if (feather > 0) {
      const grad = `radial-gradient(ellipse at ${centerX}% ${centerY}%, black 60%, transparent 100%)`;
      return {
        maskImage: grad,
        WebkitMaskImage: grad,
      };
    }

    const clip = `polygon(${x0}% ${y0}%, ${x1}% ${y0}%, ${x1}% ${y1}%, ${x0}% ${y1}%)`;
    return {
      clipPath: clip,
      WebkitClipPath: clip,
    };
  }

  // 6. Heart / Star Mask
  if (mask.type === 'heart') {
    const clip = `path('M 50 15 C 35 -10, -10 20, 50 85 C 110 20, 65 -10, 50 15 Z')`;
    return {
      clipPath: clip,
      WebkitClipPath: clip,
    };
  }

  return {};
}

/**
 * Apply feathered mask onto an offscreen canvas context
 */
export function applyCanvasMask(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  mask: MaskConfig
) {
  if (mask.type === 'none') return;

  ctx.save();
  ctx.globalCompositeOperation = mask.isInverted ? 'destination-out' : 'destination-in';

  const cx = (mask.centerX / 100) * width;
  const cy = (mask.centerY / 100) * height;
  const w = (mask.width / 100) * width;
  const h = (mask.height / 100) * height;

  ctx.translate(cx, cy);
  ctx.rotate((mask.rotation * Math.PI) / 180);

  if (mask.type === 'radial') {
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
  } else if (mask.type === 'rectangle') {
    ctx.beginPath();
    ctx.rect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = '#000000';
    ctx.fill();
  } else if (mask.type === 'filmstrip') {
    const barH = ((mask.filmstripBarHeight || 12) / 100) * height;
    ctx.beginPath();
    ctx.rect(-width / 2, -height / 2 + barH, width, height - barH * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
  }

  ctx.restore();
}
