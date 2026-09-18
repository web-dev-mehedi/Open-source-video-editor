import React, { useRef, useEffect } from 'react';
import { CaptionLine, CaptionStyleConfig, WordTimestamp } from '../../types/caption';
import { computeCurvedGlyphLayout, renderCurvedTextOnCanvas } from '../../utils/curvedTextEngine';
import { calculateAnimatedCaptionTransform } from '../../utils/captionAnimationEngine';

interface CaptionCanvasOverlayProps {
  captions: CaptionLine[];
  style: CaptionStyleConfig;
  currentTime: number;
  canvasWidth: number;
  canvasHeight: number;
}

export const CaptionCanvasOverlay: React.FC<CaptionCanvasOverlayProps> = ({
  captions,
  style,
  currentTime,
  canvasWidth,
  canvasHeight,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Find active caption line with micro-gap tolerance (up to 120ms between lines)
    let activeLine = captions.find(
      (c) => currentTime >= c.start && currentTime <= c.end
    );

    // Smooth micro-gap bridging if currentTime falls between closely spaced caption phrases
    if (!activeLine && captions.length > 0) {
      for (let cIdx = 0; cIdx < captions.length; cIdx++) {
        const currentCap = captions[cIdx];
        const nextCap = captions[cIdx + 1];
        if (currentTime >= currentCap.end && (!nextCap || currentTime < nextCap.start)) {
          if (currentTime - currentCap.end <= 0.12) {
            activeLine = currentCap;
            break;
          }
        }
      }
    }

    if (!activeLine) return;

    // Scale factor based on standard 1080p canvas width — P13 responsive
    const scaleFactor = canvasWidth / 1080;
    const letterSpacingBase = style.letterSpacing * scaleFactor;

    // Format words with casing
    const formatWord = (w: string) => {
      if (style.casing === 'uppercase') return w.toUpperCase();
      if (style.casing === 'lowercase') return w.toLowerCase();
      if (style.casing === 'titlecase') return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      return w;
    };

    const rawWords = (activeLine.words && activeLine.words.length > 0)
      ? activeLine.words
      : (activeLine.text || '').trim().split(/\s+/).filter(Boolean).map((w, idx, arr) => {
          const dur = Math.max(0.05, (activeLine.end - activeLine.start) / Math.max(1, arr.length));
          return {
            id: `w_synth_${idx}`,
            word: w,
            start: activeLine.start + idx * dur,
            end: activeLine.start + (idx + 1) * dur,
          };
        });

    const words = rawWords;
    if (words.length === 0) return;

    // Effective style combining project style with line override
    const effStyle: CaptionStyleConfig = {
      ...style,
      ...(activeLine.styleOverride || {}),
    } as CaptionStyleConfig;

    // P12/P13: responsive font + width + rotation aware
    const effGlobalScale = (effStyle as any).scale ?? 1;
    const effRotation = (effStyle as any).rotation ?? 0;
    const baseFontSize = Math.max(14, Math.round((effStyle.fontSize || style.fontSize) * scaleFactor * effGlobalScale));
    const effStrokeWidth = Math.max(1, Math.round((effStyle.strokeWidth || style.strokeWidth) * scaleFactor * Math.max(0.85, effGlobalScale)));
    const strokeWidth = effStrokeWidth;
    const letterSpacing = (effStyle.letterSpacing ?? style.letterSpacing) * scaleFactor;

    // Calculate Base Center Position
    const xCenter = ((effStyle.xOffsetPercent ?? style.xOffsetPercent ?? 50) / 100) * canvasWidth;
    let yCenter = ((effStyle.yOffsetPercent ?? style.yOffsetPercent ?? 75) / 100) * canvasHeight;
    if (effStyle.position === 'top') yCenter = 0.16 * canvasHeight;
    if (effStyle.position === 'middle') yCenter = 0.50 * canvasHeight;
    if (effStyle.position === 'lower-third') yCenter = 0.82 * canvasHeight;
    if (effStyle.position === 'bottom' && (!effStyle.yOffsetPercent || effStyle.yOffsetPercent === 75)) {
      yCenter = 0.76 * canvasHeight;
    }

    // Dynamic Animation Engine Evaluation (IN / OUT / LOOP)
    const animEval = calculateAnimatedCaptionTransform(
      activeLine,
      effStyle,
      currentTime,
      canvasWidth,
      canvasHeight
    );
    if (animEval.opacity <= 0.001) return;
    if (animEval.opacity < 1.0) {
      ctx.globalAlpha = (ctx.globalAlpha || 1.0) * animEval.opacity;
    }

    // =========================================================================
    // CURVED & CIRCULAR TEXT LAYOUT PASS (Module 16)
    // =========================================================================
    if (effStyle.curvedText?.isEnabled && effStyle.curvedText.preset !== 'none') {
      const fullText = formatWord(activeLine.text || words.map((w) => w.word).join(' '));
      const glyphs = computeCurvedGlyphLayout(fullText, effStyle.curvedText, xCenter, yCenter, baseFontSize);
      renderCurvedTextOnCanvas(
        ctx,
        glyphs,
        effStyle.fontFamily,
        baseFontSize,
        effStyle.textColor || '#FFFFFF',
        effStyle.strokeWidth > 0 ? effStyle.strokeColor || '#000000' : undefined,
        strokeWidth,
        effStyle.hasShadow ? effStyle.shadowColor : undefined,
        effStyle.hasShadow ? (effStyle.shadowBlur || 8) * scaleFactor : undefined
      );
      return;
    }

    // Identify active word and animation progress with high acoustic precision
    let activeWordIndex = -1;
    let activeWordProgress = 0; // 0.0 to 1.0 within active word

    for (let i = 0; i < words.length; i++) {
      const wStart = words[i].start;
      const nextWordStart = words[i + 1] ? words[i + 1].start : words[i].end;
      const wEnd = Math.max(words[i].end, nextWordStart);

      if (currentTime >= wStart && currentTime < wEnd) {
        activeWordIndex = i;
        const dur = Math.max(0.05, words[i].end - words[i].start);
        activeWordProgress = Math.max(0, Math.min(1, (currentTime - wStart) / dur));
        break;
      }
    }

    // Fallback: If currentTime is past the last word or at exact boundary
    if (activeWordIndex === -1 && words.length > 0) {
      if (currentTime >= words[words.length - 1].start) {
        activeWordIndex = words.length - 1;
        activeWordProgress = 1;
      } else {
        for (let i = words.length - 1; i >= 0; i--) {
          if (currentTime >= words[i].end) {
            activeWordIndex = i;
            activeWordProgress = 1;
            break;
          }
        }
        if (activeWordIndex === -1) {
          activeWordIndex = 0;
          activeWordProgress = 0;
        }
      }
    }

    // =========================================================================
    // LIGHTING GLOW / NEON BLOOM RADIAL BACKGROUND
    // =========================================================================
    if (effStyle.hasLightingGlow || effStyle.animation === 'neon') {
      const glowRadius = Math.max(40, (effStyle.lightingGlowRadius || 36) * scaleFactor * 3.5);
      const glowGrad = ctx.createRadialGradient(xCenter, yCenter, 0, xCenter, yCenter, glowRadius);
      const baseGlowColor = effStyle.lightingGlowColor || 'rgba(0, 240, 255, 0.55)';
      glowGrad.addColorStop(0, baseGlowColor);
      glowGrad.addColorStop(0.5, baseGlowColor.replace(/[\d.]+\)$/g, '0.2)'));
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.save();
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(xCenter, yCenter, glowRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // =========================================================================
    // 🌟 5 VIRAL CREATOR MASTER LAYOUTS (MATCHING USER SCREENSHOTS)
    // =========================================================================

    // 1. Neon Red Lightning Hook (Image 1: NEVER SAY "SAVE THIS VIDEO")
    if (effStyle.layoutStyle === 'neon-red-hook' && words.length >= 1) {
      if (words.length === 1) {
        // Single word: Render 1 glowing red box centered at yCenter without duplication!
        const text = formatWord(words[0].word);
        const fontSize = Math.round(baseFontSize * 1.3);

        ctx.save();
        ctx.font = `900 italic ${fontSize}px "${effStyle.fontFamily}", Montserrat, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const metrics = ctx.measureText(`"${text}"`);
        const padX = 22 * scaleFactor;
        const padY = 10 * scaleFactor;
        const boxW = metrics.width + padX * 2;
        const boxH = fontSize * 1.3 + padY * 2;
        const boxX = xCenter - boxW / 2;
        const boxY = yCenter - boxH / 2;

        ctx.shadowColor = '#FF0033';
        ctx.shadowBlur = 24 * scaleFactor;
        ctx.strokeStyle = '#FF0033';
        ctx.lineWidth = Math.max(3, Math.round(4 * scaleFactor));
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 12 * scaleFactor);
        ctx.fill();
        ctx.stroke();

        ctx.shadowColor = '#FF0033';
        ctx.shadowBlur = 16 * scaleFactor;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(2, Math.round(5 * scaleFactor));
        ctx.strokeText(`"${text}"`, xCenter, yCenter);
        ctx.fillStyle = '#FF1133';
        ctx.fillText(`"${text}"`, xCenter, yCenter);
        ctx.restore();
        return;
      }

      // 2 or more words: 2-Tier Stacked Layout
      const splitIdx = words.length <= 2 ? 1 : Math.max(1, Math.floor(words.length / 2));
      const topWords = words.slice(0, splitIdx);
      const bottomWords = words.slice(splitIdx);

      const topText = topWords.map((w) => formatWord(w.word)).join(' ');
      const bottomText = bottomWords.map((w) => formatWord(w.word)).join(' ');

      const topFontSize = Math.round(baseFontSize * 0.95);
      const bottomFontSize = Math.round(baseFontSize * (effStyle.highlightScale || 1.4));
      const lineGap = Math.max(topFontSize, bottomFontSize) * 0.92;
      const startY = yCenter - lineGap * 0.45;
      const bottomY = startY + lineGap;

      // Top Line: Ultra Heavy Bold White with Black Drop Shadow
      ctx.save();
      ctx.font = `900 ${topFontSize}px "${effStyle.fontFamily}", Montserrat, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 1.0)';
      ctx.shadowBlur = 12 * scaleFactor;
      ctx.shadowOffsetX = 3 * scaleFactor;
      ctx.shadowOffsetY = 5 * scaleFactor;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(2, Math.round(7 * scaleFactor));
      ctx.lineJoin = 'round';
      ctx.strokeText(topText, xCenter, startY);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(topText, xCenter, startY);
      ctx.restore();

      // Bottom Line: Glowing Neon Red Border Frame + Italic Bold Red
      ctx.save();
      ctx.font = `900 italic ${bottomFontSize}px "${effStyle.fontFamily}", Montserrat, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const bottomMetrics = ctx.measureText(`"${bottomText}"`);
      const padX = 22 * scaleFactor;
      const padY = 10 * scaleFactor;
      const boxW = bottomMetrics.width + padX * 2;
      const boxH = bottomFontSize * 1.3 + padY * 2;
      const boxX = xCenter - boxW / 2;
      const boxY = bottomY - boxH / 2;

      ctx.shadowColor = '#FF0033';
      ctx.shadowBlur = 24 * scaleFactor;
      ctx.strokeStyle = '#FF0033';
      ctx.lineWidth = Math.max(3, Math.round(4 * scaleFactor));
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 12 * scaleFactor);
      ctx.fill();
      ctx.stroke();

      ctx.shadowColor = '#FF0033';
      ctx.shadowBlur = 16 * scaleFactor;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(2, Math.round(5 * scaleFactor));
      ctx.strokeText(`"${bottomText}"`, xCenter, bottomY);
      ctx.fillStyle = '#FF1133';
      ctx.fillText(`"${bottomText}"`, xCenter, bottomY);
      ctx.restore();
      return;
    }

    // 2. Violet Metallic 3D & Heavy Block (Image 2: ERECTILE DISFUNCTION)
    if (effStyle.layoutStyle === 'violet-metallic-3d' && words.length >= 1) {
      if (words.length === 1) {
        // Single word: Render 1 3D Glossy Violet text centered at yCenter without duplication!
        const text = formatWord(words[0].word);
        const fontSize = Math.round(baseFontSize * 1.35);

        ctx.save();
        ctx.font = `900 ${fontSize}px "${effStyle.fontFamily}", Montserrat, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(168, 85, 247, 0.95)';
        ctx.shadowBlur = 22 * scaleFactor;
        ctx.strokeStyle = '#3B0764';
        ctx.lineWidth = Math.max(2, Math.round(7 * scaleFactor));
        ctx.strokeText(text, xCenter, yCenter);

        const purpleGrad = ctx.createLinearGradient(0, yCenter - fontSize / 2, 0, yCenter + fontSize / 2);
        purpleGrad.addColorStop(0, '#E879F9');
        purpleGrad.addColorStop(0.5, '#A855F7');
        purpleGrad.addColorStop(1, '#6B21A8');
        ctx.fillStyle = purpleGrad;
        ctx.fillText(text, xCenter, yCenter);
        ctx.restore();
        return;
      }

      // 2 or more words: 2-Tier Stacked Layout
      const splitIdx = words.length <= 2 ? 1 : Math.max(1, Math.floor(words.length / 2));
      const topWords = words.slice(0, splitIdx);
      const bottomWords = words.slice(splitIdx);

      const topText = topWords.map((w) => formatWord(w.word)).join(' ');
      const bottomText = bottomWords.map((w) => formatWord(w.word)).join(' ');

      const topFontSize = Math.round(baseFontSize * 1.15);
      const bottomFontSize = Math.round(baseFontSize * (effStyle.highlightScale || 1.35));
      const lineGap = Math.max(topFontSize, bottomFontSize) * 0.88;
      const startY = yCenter - lineGap * 0.45;
      const bottomY = startY + lineGap;

      // Top Line: 3D Glossy Violet / Purple Gradient
      ctx.save();
      ctx.font = `900 ${topFontSize}px "${effStyle.fontFamily}", Montserrat, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(168, 85, 247, 0.9)';
      ctx.shadowBlur = 20 * scaleFactor;
      ctx.strokeStyle = '#3B0764';
      ctx.lineWidth = Math.max(2, Math.round(6 * scaleFactor));
      ctx.strokeText(topText, xCenter, startY);

      const purpleGrad = ctx.createLinearGradient(0, startY - topFontSize / 2, 0, startY + topFontSize / 2);
      purpleGrad.addColorStop(0, '#E879F9');
      purpleGrad.addColorStop(0.5, '#A855F7');
      purpleGrad.addColorStop(1, '#6B21A8');
      ctx.fillStyle = purpleGrad;
      ctx.fillText(topText, xCenter, startY);
      ctx.restore();

      // Bottom Line: Heavy White Block with 3D Bevel Offset Shadow
      ctx.save();
      ctx.font = `900 ${bottomFontSize}px "${effStyle.fontFamily}", Montserrat, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 1.0)';
      ctx.shadowBlur = 14 * scaleFactor;
      ctx.shadowOffsetX = 3 * scaleFactor;
      ctx.shadowOffsetY = 6 * scaleFactor;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(2, Math.round(8 * scaleFactor));
      ctx.strokeText(bottomText, xCenter, bottomY);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(bottomText, xCenter, bottomY);
      ctx.restore();
      return;
    }

    // 3. Electric Yellow Gym & Retention Punch (Image 3: SAVE IT FOR YOUR CHEST DAY)
    if (effStyle.layoutStyle === 'fitness-yellow-punch' && words.length >= 1) {
      if (words.length === 1) {
        // Single word: Render 1 Electric Yellow punch word centered at yCenter without duplication!
        const text = formatWord(words[0].word);
        const fontSize = Math.round(baseFontSize * 1.3);

        ctx.save();
        ctx.font = `900 ${fontSize}px "${effStyle.fontFamily}", Montserrat, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 1.0)';
        ctx.shadowBlur = 16 * scaleFactor;
        ctx.shadowOffsetX = 3 * scaleFactor;
        ctx.shadowOffsetY = 6 * scaleFactor;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(2, Math.round(8 * scaleFactor));
        ctx.strokeText(text, xCenter, yCenter);
        ctx.fillStyle = '#E2FD00';
        ctx.fillText(text, xCenter, yCenter);
        ctx.restore();
        return;
      }

      // 2 or more words: 2-Tier Stacked Layout
      const splitIdx = words.length <= 2 ? 1 : Math.max(1, Math.floor(words.length / 2));
      const topWords = words.slice(0, splitIdx);
      const bottomWords = words.slice(splitIdx);

      const topText = topWords.map((w) => formatWord(w.word)).join(' ');
      const bottomText = bottomWords.map((w) => formatWord(w.word)).join(' ');

      const topFontSize = Math.round(baseFontSize * 0.95);
      const bottomFontSize = Math.round(baseFontSize * (effStyle.highlightScale || 1.3));
      const lineGap = Math.max(topFontSize, bottomFontSize) * 0.88;
      const startY = yCenter - lineGap * 0.45;
      const bottomY = startY + lineGap;

      // Line 1: Ultra-Crisp White
      ctx.save();
      ctx.font = `900 ${topFontSize}px "${effStyle.fontFamily}", Montserrat, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 1.0)';
      ctx.shadowBlur = 10 * scaleFactor;
      ctx.shadowOffsetX = 2 * scaleFactor;
      ctx.shadowOffsetY = 4 * scaleFactor;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(2, Math.round(6 * scaleFactor));
      ctx.strokeText(topText, xCenter, startY);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(topText, xCenter, startY);
      ctx.restore();

      // Line 2: Saturated Electric Lime-Yellow Punch
      ctx.save();
      ctx.font = `900 ${bottomFontSize}px "${effStyle.fontFamily}", Montserrat, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 1.0)';
      ctx.shadowBlur = 14 * scaleFactor;
      ctx.shadowOffsetX = 3 * scaleFactor;
      ctx.shadowOffsetY = 5 * scaleFactor;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(2, Math.round(7 * scaleFactor));
      ctx.strokeText(bottomText, xCenter, bottomY);
      ctx.fillStyle = '#E2FD00';
      ctx.fillText(bottomText, xCenter, bottomY);
      ctx.restore();
      return;
    }

    // 4. Crimson 3D Numbers & Cursive Script (Image 4: $30,000 Business)
    if (effStyle.layoutStyle === 'money-crimson-script' && words.length >= 1) {
      if (words.length === 1) {
        // Single word: Render 1 3D Crimson Red or Cursive Script centered at yCenter without duplication!
        const text = formatWord(words[0].word);
        const hasDigits = /\d|\$|€|£|%/.test(text);
        const fontSize = Math.round(baseFontSize * 1.35);

        ctx.save();
        if (hasDigits) {
          ctx.font = `900 ${fontSize}px "${effStyle.fontFamily}", Montserrat, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(255, 0, 51, 0.95)';
          ctx.shadowBlur = 24 * scaleFactor;
          ctx.strokeStyle = '#300008';
          ctx.lineWidth = Math.max(2, Math.round(7 * scaleFactor));
          ctx.strokeText(text, xCenter, yCenter);

          const redGrad = ctx.createLinearGradient(0, yCenter - fontSize / 2, 0, yCenter + fontSize / 2);
          redGrad.addColorStop(0, '#FF4455');
          redGrad.addColorStop(0.5, '#FF0033');
          redGrad.addColorStop(1, '#990011');
          ctx.fillStyle = redGrad;
          ctx.fillText(text, xCenter, yCenter);
        } else {
          ctx.font = `700 italic ${Math.round(fontSize * 1.15)}px 'Caveat', 'Playball', 'Brush Script MT', cursive, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0, 0, 0, 1.0)';
          ctx.shadowBlur = 14 * scaleFactor;
          ctx.shadowOffsetX = 2 * scaleFactor;
          ctx.shadowOffsetY = 5 * scaleFactor;
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = Math.max(2, Math.round(6 * scaleFactor));
          ctx.strokeText(text, xCenter, yCenter);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(text, xCenter, yCenter);
        }
        ctx.restore();
        return;
      }

      // 2 or more words: 2-Tier Stacked Layout
      const splitIdx = words.length <= 2 ? 1 : Math.max(1, Math.floor(words.length / 2));
      const topWords = words.slice(0, splitIdx);
      const bottomWords = words.slice(splitIdx);

      const topText = topWords.map((w) => formatWord(w.word)).join(' ');
      const bottomText = bottomWords.map((w) => formatWord(w.word)).join(' ');

      const topFontSize = Math.round(baseFontSize * 1.35);
      const bottomFontSize = Math.round(baseFontSize * 1.15);
      const lineGap = Math.max(topFontSize, bottomFontSize) * 0.82;
      const startY = yCenter - lineGap * 0.45;
      const bottomY = startY + lineGap;

      // Line 1: Giant 3D Glossy Crimson Red Numbers with Red Neon Glow
      ctx.save();
      ctx.font = `900 ${topFontSize}px "${effStyle.fontFamily}", Montserrat, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(255, 0, 51, 0.9)';
      ctx.shadowBlur = 24 * scaleFactor;
      ctx.strokeStyle = '#300008';
      ctx.lineWidth = Math.max(2, Math.round(6 * scaleFactor));
      ctx.strokeText(topText, xCenter, startY);

      const redGrad = ctx.createLinearGradient(0, startY - topFontSize / 2, 0, startY + topFontSize / 2);
      redGrad.addColorStop(0, '#FF4455');
      redGrad.addColorStop(0.5, '#FF0033');
      redGrad.addColorStop(1, '#990011');
      ctx.fillStyle = redGrad;
      ctx.fillText(topText, xCenter, startY);
      ctx.restore();

      // Line 2: Elegant White Handwritten Brush Script (Overlapping)
      ctx.save();
      ctx.font = `700 italic ${bottomFontSize}px 'Caveat', 'Playball', 'Brush Script MT', cursive, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 1.0)';
      ctx.shadowBlur = 12 * scaleFactor;
      ctx.shadowOffsetX = 2 * scaleFactor;
      ctx.shadowOffsetY = 4 * scaleFactor;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(2, Math.round(5 * scaleFactor));
      ctx.strokeText(bottomText, xCenter, bottomY);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(bottomText, xCenter, bottomY);
      ctx.restore();
      return;
    }

    // 5. Modern Minimalist & Gradient Badge (Image 5: help you Skip ▶)
    if (effStyle.layoutStyle === 'skip-badge-pill' && words.length >= 1) {
      if (words.length === 1) {
        // Single word: Render 1 Gradient Pill Badge centered at yCenter without duplication!
        const text = words[0].word;
        const fontSize = Math.round(baseFontSize * 1.25);

        ctx.save();
        ctx.font = `900 ${fontSize}px "${effStyle.fontFamily}", Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const metrics = ctx.measureText(`${text}  ▶`);
        const padX = 24 * scaleFactor;
        const padY = 8 * scaleFactor;
        const boxW = metrics.width + padX * 2;
        const boxH = fontSize * 1.2 + padY * 2;
        const boxX = xCenter - boxW / 2;
        const boxY = yCenter - boxH / 2;

        const pillGrad = ctx.createLinearGradient(boxX, 0, boxX + boxW, 0);
        pillGrad.addColorStop(0, '#8B5CF6');
        pillGrad.addColorStop(1, '#6366F1');
        ctx.shadowColor = 'rgba(139, 92, 246, 0.6)';
        ctx.shadowBlur = 18 * scaleFactor;
        ctx.fillStyle = pillGrad;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 18 * scaleFactor);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'transparent';
        ctx.fillText(`${text}  ▶`, xCenter, yCenter);
        ctx.restore();
        return;
      }

      // 2 or more words: 2-Tier Stacked Layout
      const splitIdx = words.length <= 2 ? 1 : Math.max(1, Math.floor(words.length / 2));
      const topWords = words.slice(0, splitIdx);
      const bottomWords = words.slice(splitIdx);

      const topText = topWords.map((w) => w.word).join(' ');
      const bottomText = bottomWords.map((w) => w.word).join(' ');

      const topFontSize = Math.round(baseFontSize * 0.9);
      const bottomFontSize = Math.round(baseFontSize * 1.25);
      const lineGap = Math.max(topFontSize, bottomFontSize) * 0.95;
      const startY = yCenter - lineGap * 0.45;
      const bottomY = startY + lineGap;

      // Line 1: Clean Minimalist White Text
      ctx.save();
      ctx.font = `700 ${topFontSize}px "${effStyle.fontFamily}", Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 10 * scaleFactor;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.lineWidth = Math.max(1, Math.round(3 * scaleFactor));
      ctx.strokeText(topText, xCenter, startY);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(topText, xCenter, startY);
      ctx.restore();

      // Line 2: Gradient Violet Pill with Play ▶ Icon Badge
      ctx.save();
      ctx.font = `900 ${bottomFontSize}px "${effStyle.fontFamily}", Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const bottomMetrics = ctx.measureText(`${bottomText}  ▶`);
      const padX = 24 * scaleFactor;
      const padY = 8 * scaleFactor;
      const boxW = bottomMetrics.width + padX * 2;
      const boxH = bottomFontSize * 1.2 + padY * 2;
      const boxX = xCenter - boxW / 2;
      const boxY = bottomY - boxH / 2;

      // Gradient Pill
      const pillGrad = ctx.createLinearGradient(boxX, 0, boxX + boxW, 0);
      pillGrad.addColorStop(0, '#8B5CF6');
      pillGrad.addColorStop(1, '#6366F1');
      ctx.shadowColor = 'rgba(139, 92, 246, 0.6)';
      ctx.shadowBlur = 18 * scaleFactor;
      ctx.fillStyle = pillGrad;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 18 * scaleFactor);
      ctx.fill();

      // Pill Text + Play Icon
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = 'transparent';
      ctx.fillText(`${bottomText}  ▶`, xCenter, bottomY);
      ctx.restore();
      return;
    }

    // =========================================================================
    // DUAL-TIER HOOK TEMPLATE (Matches Older Styles)
    // =========================================================================
    if (effStyle.layoutStyle === 'dual-tier-hook' && words.length >= 2) {
      const splitIdx = typeof activeLine.splitHookIndex === 'number' && activeLine.splitHookIndex > 0
        ? activeLine.splitHookIndex
        : words.length <= 2 ? 1 : Math.max(1, Math.floor(words.length / 2));

      const topWords = words.slice(0, splitIdx);
      const bottomWords = words.slice(splitIdx);

      const topText = topWords.map((w) => formatWord(w.word)).join(' ');
      const bottomText = bottomWords.map((w) => formatWord(w.word)).join(' ');

      const isCalligraphy = effStyle.presetKey === 'hook-calligraphy-red' || effStyle.id === 'hook-calligraphy-red';
      const isImpact = effStyle.presetKey === 'hook-impact-gradient' || effStyle.id === 'hook-impact-gradient';

      const topFontSize = Math.round(baseFontSize * (isImpact ? 1.4 : 0.85));
      const bottomFontSize = Math.round(baseFontSize * (effStyle.highlightScale || 1.6));
      const lineGap = Math.max(topFontSize, bottomFontSize) * 0.85;
      const startY = yCenter - lineGap * 0.45;
      const bottomY = startY + lineGap;

      // Top Line
      ctx.save();
      ctx.font = isImpact
        ? `900 ${topFontSize}px "${effStyle.fontFamily}", sans-serif`
        : `900 ${topFontSize}px "${effStyle.fontFamily}", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (effStyle.hasShadow) {
        ctx.shadowColor = isCalligraphy ? 'rgba(0, 0, 0, 0.95)' : (effStyle.shadowColor || 'rgba(0,0,0,0.9)');
        ctx.shadowBlur = 12 * scaleFactor;
        ctx.shadowOffsetX = 2 * scaleFactor;
        ctx.shadowOffsetY = 4 * scaleFactor;
      }
      ctx.strokeStyle = isImpact ? '#FFFFFF' : '#000000';
      ctx.lineWidth = Math.max(1, Math.round((isImpact ? 5 : 4) * scaleFactor));
      ctx.lineJoin = 'round';
      ctx.strokeText(topText, xCenter, startY);
      ctx.fillStyle = isImpact ? '#000000' : '#FFFFFF';
      ctx.fillText(topText, xCenter, startY);
      ctx.restore();

      // Bottom Line (Cursive Calligraphy for Hook 1 or Clean Subtitle for Hook 2)
      ctx.save();
      if (isCalligraphy) {
        ctx.font = `700 italic ${Math.round(bottomFontSize * 1.2)}px 'Caveat', 'Playball', 'Brush Script MT', 'Dancing Script', cursive, sans-serif`;
      } else {
        ctx.font = `800 ${bottomFontSize}px "${effStyle.fontFamily}", sans-serif`;
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (effStyle.hasShadow) {
        ctx.shadowColor = effStyle.shadowColor || 'rgba(0, 0, 0, 0.95)';
        ctx.shadowBlur = (effStyle.shadowBlur || 16) * scaleFactor;
        ctx.shadowOffsetX = (effStyle.shadowOffsetX || 0) * scaleFactor;
        ctx.shadowOffsetY = (effStyle.shadowOffsetY || 5) * scaleFactor;
      }
      ctx.strokeStyle = effStyle.strokeColor || '#000000';
      ctx.lineWidth = Math.max(2, Math.round((effStyle.strokeWidth || 6) * scaleFactor));
      ctx.lineJoin = 'round';
      ctx.strokeText(bottomText, xCenter, bottomY);
      ctx.fillStyle = effStyle.activeWordColor || '#EF4444';
      ctx.fillText(bottomText, xCenter, bottomY);
      ctx.restore();
      return;
    }

    // =========================================================================
    // TYPEWRITER PRESET
    // =========================================================================
    if (effStyle.animation === 'typewriter') {
      const fullText = words.length > 0 ? words.map((w) => formatWord(w.word)).join(' ') : formatWord(activeLine.text || '');
      const lineDur = Math.max(0.1, activeLine.end - activeLine.start);
      const lineProgress = Math.max(0, Math.min(1, (currentTime - activeLine.start) / lineDur));
      const charCount = Math.floor(fullText.length * Math.min(1, lineProgress * 1.5));
      const visibleText = fullText.slice(0, charCount);
      const showCursor = effStyle.typewriterShowCursor !== false && Math.floor(currentTime * 3) % 2 === 0;
      const displayText = showCursor ? `${visibleText}▌` : visibleText;

      ctx.save();
      ctx.font = `${effStyle.fontWeight || '700'} ${baseFontSize}px "${effStyle.fontFamily}", sans-serif`;
      ctx.textAlign = effStyle.alignment || 'center';
      ctx.textBaseline = 'middle';

      // Background Box
      if (effStyle.hasBackgroundPill) {
        const textMetrics = ctx.measureText(fullText);
        const padX = (effStyle.backgroundPaddingX || 16) * scaleFactor;
        const padY = (effStyle.backgroundPaddingY || 8) * scaleFactor;
        const boxW = textMetrics.width + padX * 2;
        const boxH = baseFontSize * 1.3 + padY * 2;
        const boxX = xCenter - boxW / 2;
        const boxY = yCenter - boxH / 2;
        const rad = (effStyle.backgroundBorderRadius || 6) * scaleFactor;

        ctx.fillStyle = effStyle.backgroundColor || '#000000';
        ctx.globalAlpha = effStyle.backgroundOpacity || 0.75;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, rad);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // Text Stroke & Fill
      if (effStyle.strokeWidth > 0) {
        ctx.strokeStyle = effStyle.strokeColor || '#000000';
        ctx.lineWidth = strokeWidth;
        ctx.lineJoin = 'round';
        ctx.strokeText(displayText, xCenter, yCenter);
      }

      ctx.fillStyle = effStyle.textColor || '#FFFFFF';
      ctx.fillText(displayText, xCenter, yCenter);
      ctx.restore();
      return;
    }

    // =========================================================================
    // GENERAL MULTI-WORD & MULTI-LINE VIRAL CAPTION ENGINE
    // =========================================================================

    // 1. Group words into lines and pages (sliding active window) to keep captions compact & viral — P12 maxWidth + P13 responsive
    const maxWidthPercent = Math.max(30, Math.min(95, (effStyle as any).maxWidthPercent ?? 88));
    const maxLineWidth = canvasWidth * (maxWidthPercent / 100);
    const maxWords = effStyle.maxWordsPerLine || 3;
    const lineMode = effStyle.lineMode || 'auto';

    // Apply global rotation to entire caption block if needed (P8)
    const needsGlobalTransform = effRotation !== 0;
    if (needsGlobalTransform) {
      ctx.save();
      ctx.translate(xCenter, yCenter);
      ctx.rotate((effRotation * Math.PI) / 180);
      ctx.translate(-xCenter, -yCenter);
    }

    // Set font to measure word widths
    ctx.font = `${effStyle.fontWeight || '900'} ${baseFontSize}px "${effStyle.fontFamily}", sans-serif`;
    const spaceWidth = ctx.measureText(' ').width + letterSpacing;

    // All lines generated from the caption block
    const allLines: { wordObj: WordTimestamp; globalIdx: number; text: string }[][] = [];

    if (lineMode === 'single') {
      // Each line has at most maxWords
      for (let i = 0; i < words.length; i += maxWords) {
        const chunk = words.slice(i, i + maxWords).map((w, idx) => ({
          wordObj: w,
          globalIdx: i + idx,
          text: formatWord(w.word),
        }));
        allLines.push(chunk);
      }
    } else if (lineMode === 'two-line') {
      // 2 lines per page, each line having maxWords
      const wordsPerLine = Math.max(2, Math.min(maxWords, 4));
      for (let i = 0; i < words.length; i += wordsPerLine) {
        const chunk = words.slice(i, i + wordsPerLine).map((w, idx) => ({
          wordObj: w,
          globalIdx: i + idx,
          text: formatWord(w.word),
        }));
        allLines.push(chunk);
      }
    } else {
      // Auto-wrapping based on max words and container width
      let currentLineWords: { wordObj: WordTimestamp; globalIdx: number; text: string }[] = [];
      let accumulatedWidth = 0;

      words.forEach((w, idx) => {
        const formatted = formatWord(w.word);
        const wWidth = ctx.measureText(formatted).width + letterSpacing;

        if (
          currentLineWords.length >= maxWords ||
          (currentLineWords.length > 0 && accumulatedWidth + spaceWidth + wWidth > maxLineWidth)
        ) {
          allLines.push(currentLineWords);
          currentLineWords = [];
          accumulatedWidth = 0;
        }

        currentLineWords.push({ wordObj: w, globalIdx: idx, text: formatted });
        accumulatedWidth += currentLineWords.length === 1 ? wWidth : spaceWidth + wWidth;
      });

      if (currentLineWords.length > 0) {
        allLines.push(currentLineWords);
      }
    }

    // PAGING: Find which line contains the active word (default to 0)
    const activeLineIdx = Math.max(
      0,
      allLines.findIndex((line) => line.some((item) => item.globalIdx === activeWordIndex))
    );

    // Filter lines to display on screen based on active window (max 1 or 2 lines)
    let linesOfWords: { wordObj: WordTimestamp; globalIdx: number; text: string }[][] = [];
    if (lineMode === 'single') {
      // Show ONLY 1 active line on screen
      linesOfWords = [allLines[activeLineIdx] || allLines[0]];
    } else if (lineMode === 'two-line') {
      // Group lines in pairs of 2 (page 0: lines 0,1; page 1: lines 2,3; etc.)
      const pageStartLine = Math.floor(activeLineIdx / 2) * 2;
      linesOfWords = allLines.slice(pageStartLine, pageStartLine + 2);
    } else {
      // Auto mode: If more than 2 lines, show active 2-line window
      if (allLines.length <= 2) {
        linesOfWords = allLines;
      } else {
        const pageStartLine = Math.floor(activeLineIdx / 2) * 2;
        linesOfWords = allLines.slice(pageStartLine, pageStartLine + 2);
      }
    }

    const totalLines = Math.max(1, linesOfWords.length);
    const lineHeight = baseFontSize * (effStyle.lineHeight || 1.25);
    const totalBlockHeight = totalLines * lineHeight;
    const startY = yCenter - (totalBlockHeight / 2) + (lineHeight / 2);

    // Render each line
    linesOfWords.forEach((lineWords, lineIdx) => {
      const lineY = startY + lineIdx * lineHeight;

      // Measure total line width
      const wordMetrics = lineWords.map((item) => {
        const isWordActive = item.globalIdx === activeWordIndex;
        const scaleMult = isWordActive ? (effStyle.highlightScale || 1.2) : 1.0;
        const width = ctx.measureText(item.text).width + letterSpacing;
        return { ...item, width, isWordActive, scaleMult };
      });

      const totalLineWidth = wordMetrics.reduce((sum, item, idx) => {
        return sum + item.width + (idx < wordMetrics.length - 1 ? spaceWidth : 0);
      }, 0);

      // Line start X based on alignment
      let currentWordX = xCenter - totalLineWidth / 2;
      if (effStyle.alignment === 'left') currentWordX = xCenter - maxLineWidth / 2;
      if (effStyle.alignment === 'right') currentWordX = xCenter + maxLineWidth / 2 - totalLineWidth;

      // Draw Line Background Pill if enabled
      if (effStyle.hasBackgroundPill && effStyle.animation !== 'highlight-box') {
        const padX = (effStyle.backgroundPaddingX || 16) * scaleFactor;
        const padY = (effStyle.backgroundPaddingY || 8) * scaleFactor;
        const pillW = totalLineWidth + padX * 2;
        const pillH = lineHeight + padY * 0.8;
        const pillX = currentWordX - padX;
        const pillY = lineY - pillH / 2;
        const pillRad = (effStyle.backgroundBorderRadius || 8) * scaleFactor;

        ctx.save();
        ctx.fillStyle = effStyle.backgroundColor || '#000000';
        ctx.globalAlpha = effStyle.backgroundOpacity || 0.8;
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, pillRad);
        ctx.fill();
        ctx.restore();
      }

      // Draw each word in this line
      wordMetrics.forEach((wItem) => {
        const isWordActive = wItem.isWordActive;
        const wordCenterX = currentWordX + wItem.width / 2;
        const wordCenterY = lineY;

        ctx.save();

        // Compute Dynamic Word Animation Transformations
        let scaleX = 1.0;
        let scaleY = 1.0;
        let offsetY = 0;
        let offsetX = 0;
        let alpha = 1.0;
        let wordColor = effStyle.textColor || '#FFFFFF';

        // Palette emphasis colors
        if (isWordActive) {
          wordColor = effStyle.activeWordColor || '#FACC15';
        } else if (effStyle.animation === 'karaoke') {
          wordColor = effStyle.secondaryColor || '#94A3B8';
          alpha = effStyle.inactiveWordOpacity || 0.4;
        }

        // =====================================================================
        // PRESET ANIMATION BEHAVIORS
        // =====================================================================
        const anim = effStyle.animation;

        if (isWordActive) {
          const t = activeWordProgress;
          // P39-P41: adapt animation to available duration — short caps get reduced motion, long caps stay stable
          const wordDur = Math.max(0.05, wItem.wordObj.end - wItem.wordObj.start);
          const isVeryShort = wordDur < 0.3;
          const isVeryLong = wordDur > 2.2;
          const durationScale = isVeryShort ? Math.max(0.35, wordDur / 0.6) : isVeryLong ? 1.0 : 1.0;

          // 1. MrBeast / Hormozi / Bold Pop / Word Pop / Punch
          if (anim === 'mrbeast' || anim === 'hormozi' || anim === 'bold-pop' || anim === 'word-pop' || anim === 'punch' || anim === 'pop') {
            const rawMax = effStyle.highlightScale || (anim === 'punch' ? 1.4 : anim === 'bold-pop' ? 1.35 : 1.25);
            const maxScale = isVeryShort ? 1 + (rawMax - 1) * durationScale : rawMax;
            // Fast spring overshoot curve: 1.0 -> maxScale -> 1.0, shortened for tiny words
            const spring = Math.sin(Math.min(Math.PI, t * Math.PI * 2)) * Math.exp(-t * (isVeryShort ? 4 : 2.5));
            const scaleBump = 1.0 + (maxScale - 1.0) * Math.max(0, spring);
            scaleX = scaleBump;
            scaleY = scaleBump;
          }

          // 2. Bounce
          else if (anim === 'bounce') {
            const bounceHeight = -16 * scaleFactor * Math.sin(t * Math.PI) * Math.exp(-t * 1.5);
            offsetY = bounceHeight;
            scaleX = 1.0 + 0.15 * Math.sin(t * Math.PI);
            scaleY = 1.0 + 0.15 * Math.sin(t * Math.PI);
          }

          // 3. Slide Up
          else if (anim === 'slide-up') {
            const slideOffset = (1 - Math.min(1, t * 2.5)) * 24 * scaleFactor;
            offsetY = slideOffset;
            alpha = Math.min(1, t * 3);
          }

          // 4. Slide In
          else if (anim === 'slide-in') {
            const slideOffset = (1 - Math.min(1, t * 2.5)) * -30 * scaleFactor;
            offsetX = slideOffset;
            alpha = Math.min(1, t * 3);
          }

          // 5. Dynamic Scale
          else if (anim === 'dynamic-scale') {
            const maxScale = effStyle.highlightScale || 1.35;
            const dynamicScale = 1.0 + (maxScale - 1.0) * Math.sin(t * Math.PI);
            scaleX = dynamicScale;
            scaleY = dynamicScale;
          }

          // 6. Shake / Jitter
          else if (anim === 'shake') {
            const intensity = (effStyle.shakeIntensity || 4) * scaleFactor;
            offsetX = Math.sin(currentTime * 45) * intensity;
            offsetY = Math.cos(currentTime * 55) * (intensity * 0.7);
            scaleX = effStyle.highlightScale || 1.15;
            scaleY = effStyle.highlightScale || 1.15;
          }

          // 7. Pop + Motion Blur
          else if (anim === 'pop-blur') {
            const scaleBump = 1.0 + 0.3 * Math.sin(t * Math.PI);
            scaleX = scaleBump;
            scaleY = scaleBump;
          }

          // 8. Highlight Box (Marker under active word)
          else if (anim === 'highlight-box' || effStyle.hasHighlightBox) {
            const padX = (effStyle.highlightBoxPaddingX || 10) * scaleFactor;
            const padY = (effStyle.highlightBoxPaddingY || 5) * scaleFactor;
            const boxW = wItem.width + padX * 2;
            const boxH = baseFontSize * 1.25 + padY * 2;
            const boxX = wordCenterX - boxW / 2;
            const boxY = wordCenterY - boxH / 2;
            const rad = (effStyle.highlightBoxRadius || 6) * scaleFactor;

            ctx.save();
            ctx.fillStyle = effStyle.highlightBoxColor || '#FACC15';
            ctx.globalAlpha = effStyle.highlightBoxOpacity || 1.0;
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxW, boxH, rad);
            ctx.fill();
            ctx.restore();

            wordColor = effStyle.highlightBoxTextColor || '#000000';
          }
        }

        // Apply World Matrix for Active Word (Center-anchored scaling & offsets)
        ctx.translate(wordCenterX + offsetX, wordCenterY + offsetY);
        ctx.scale(scaleX, scaleY);
        ctx.globalAlpha = alpha;

        // Apply Font Styles with Comprehensive Multilingual Fallback Stack
        ctx.font = `${effStyle.fontWeight || '900'} ${baseFontSize}px "${effStyle.fontFamily}", 'Inter', 'Noto Sans Bengali', 'Noto Sans Devanagari', 'Apple SD Gothic Neo', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // =====================================================================
        // 3D EXTRUSION PASSES (for 3D Preset)
        // =====================================================================
        if (effStyle.has3DExtrusion || effStyle.animation === '3d') {
          const depth = Math.round((effStyle.depth3D || 8) * scaleFactor);
          const dColor = effStyle.depthColor || '#0369A1';

          ctx.save();
          ctx.fillStyle = dColor;
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = strokeWidth;
          for (let d = depth; d >= 1; d--) {
            ctx.strokeText(wItem.text, d * 0.8, d * 1.2);
            ctx.fillText(wItem.text, d * 0.8, d * 1.2);
          }
          ctx.restore();
        }

        // =====================================================================
        // GLITCH CHROMATIC ABERRATION SPLIT (for Glitch Preset)
        // =====================================================================
        if (effStyle.animation === 'glitch' && isWordActive) {
          const glitchShift = (effStyle.glitchIntensity || 4) * scaleFactor;

          // Red Channel Shift
          ctx.save();
          ctx.fillStyle = effStyle.secondaryColor || '#FF0055';
          ctx.globalAlpha = 0.85;
          ctx.fillText(wItem.text, -glitchShift, 0);
          ctx.restore();

          // Cyan Channel Shift
          ctx.save();
          ctx.fillStyle = effStyle.activeWordColor || '#00F0FF';
          ctx.globalAlpha = 0.85;
          ctx.fillText(wItem.text, glitchShift, 0);
          ctx.restore();
        }

        // =====================================================================
        // POP + MOTION BLUR GHOSTING PASSES
        // =====================================================================
        if (effStyle.hasMotionBlur && isWordActive && activeWordProgress < 0.4) {
          const blurDist = (1 - activeWordProgress / 0.4) * 8 * scaleFactor;
          ctx.save();
          ctx.fillStyle = wordColor;
          ctx.globalAlpha = 0.25;
          ctx.fillText(wItem.text, -blurDist, 0);
          ctx.fillText(wItem.text, blurDist, 0);
          ctx.restore();
        }

        // =====================================================================
        // PREMIERE PRO / AFTER EFFECTS MULTI-PASS RADIANT TEXT GLOW
        // =====================================================================
        if (effStyle.hasLightingGlow || effStyle.animation === 'neon' || (isWordActive && effStyle.lightingGlowColor)) {
          const glowColor = (isWordActive ? effStyle.lightingGlowColor : null) || effStyle.lightingGlowColor || effStyle.activeWordColor || '#00F0FF';
          const glowRadius = Math.max(8, (effStyle.lightingGlowRadius || 24) * scaleFactor);

          ctx.save();
          ctx.shadowColor = glowColor;
          ctx.fillStyle = glowColor;

          // Multi-layer Gaussian bloom simulation (wide soft outer + tight intense inner)
          ctx.shadowBlur = glowRadius * 1.6;
          ctx.globalAlpha = 0.55;
          ctx.fillText(wItem.text, 0, 0);

          ctx.shadowBlur = glowRadius * 0.8;
          ctx.globalAlpha = 0.85;
          ctx.fillText(wItem.text, 0, 0);

          ctx.shadowBlur = glowRadius * 0.3;
          ctx.globalAlpha = 1.0;
          ctx.fillText(wItem.text, 0, 0);

          ctx.restore();
        }

        // =====================================================================
        // SHADOW PASS
        // =====================================================================
        if (effStyle.hasShadow && (effStyle.shadowBlur > 0 || effStyle.shadowOffsetX !== 0 || effStyle.shadowOffsetY !== 0)) {
          ctx.shadowColor = effStyle.shadowColor || 'rgba(0, 0, 0, 0.85)';
          ctx.shadowBlur = (effStyle.shadowBlur || 0) * scaleFactor;
          ctx.shadowOffsetX = (effStyle.shadowOffsetX || 0) * scaleFactor;
          ctx.shadowOffsetY = (effStyle.shadowOffsetY || 4) * scaleFactor;
        }

        // =====================================================================
        // TEXT STROKE & FILL PASS
        // =====================================================================
        if (effStyle.strokeWidth > 0 && !(anim === 'highlight-box' && isWordActive)) {
          ctx.strokeStyle = effStyle.strokeColor || '#000000';
          ctx.lineWidth = strokeWidth;
          ctx.lineJoin = 'round';
          ctx.strokeText(wItem.text, 0, 0);
        }

        // Remove shadow before fill to keep letters crisp
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = wordColor;
        ctx.fillText(wItem.text, 0, 0);

        ctx.restore();

        // Advance X position for next word in line
        currentWordX += wItem.width + spaceWidth;
      });
    });
    if (needsGlobalTransform) ctx.restore();
  }, [captions, style, currentTime, canvasWidth, canvasHeight]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      className="absolute inset-0 w-full h-full pointer-events-none z-30"
    />
  );
};
