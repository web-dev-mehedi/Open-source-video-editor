import { ProjectData, VideoClip, OverlayElement } from '../../types/project';
import { CaptionLine, WordTimestamp } from '../../types/caption';
import { getActiveTransitionAtTime, renderTransitionOverlay } from '../../utils/transitionEngine';
import { buildCssFilterString, renderCanvasPostEffects } from '../../utils/effectShaderEngine';
import { renderCroppedClip } from '../renderer/canvasRenderer';
import { backgroundRemovalEngine } from '../ai/backgroundRemovalEngine';
import { calculateAnimatedCaptionTransform } from '../../utils/captionAnimationEngine';
import { getInterpolatedClipTransform } from '../../utils/keyframeEngine';
import { buildColorGradingCssFilter, applyCanvasColorGrading } from '../../utils/colorGradingEngine';
import { getActiveClipEffectsAtTime } from '../../utils/nleTimeline';
import { renderCanvasParticles } from '../../utils/particleSystemEngine';
import { buildBeautyCssFilter } from '../../utils/beautyRetouchEngine';

/**
 * Race-condition-free video seek utility.
 * Guarantees the video element has updated its pixel buffer to the target timestamp before returning.
 */
export function seekVideoElement(
  video: HTMLVideoElement,
  targetTime: number,
  timeoutMs = 600
): Promise<void> {
  return new Promise((resolve) => {
    const clampedTime = Math.max(0, Math.min(video.duration || 9999, targetTime));

    if (Math.abs(video.currentTime - clampedTime) < 0.02 && video.readyState >= 2) {
      return resolve();
    }

    let isDone = false;
    const cleanup = () => {
      if (isDone) return;
      isDone = true;
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      clearTimeout(timer);
      resolve();
    };

    const onSeeked = () => cleanup();
    const onError = () => cleanup();

    const timer = setTimeout(() => {
      cleanup();
    }, timeoutMs);

    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onError, { once: true });

    try {
      video.currentTime = clampedTime;
    } catch {
      cleanup();
    }
  });
}

export class FrameCompositor {
  private width: number;
  private height: number;
  private project: ProjectData;
  private burnCaptions: boolean;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private videoMap = new Map<string, HTMLVideoElement>();
  private imageMap = new Map<string, HTMLImageElement>();
  private isPrepared = false;

  constructor(width: number, height: number, project: ProjectData, burnCaptions = true) {
    this.width = width;
    this.height = height;
    this.project = project;
    this.burnCaptions = burnCaptions;

    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    const context = this.canvas.getContext('2d', { willReadFrequently: false, alpha: false });
    if (!context) throw new Error('Failed to create 2D Canvas rendering context for export.');
    this.ctx = context;
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  private isImageClip(clip: VideoClip): boolean {
    if (clip.mediaType === 'image') return true;
    const pathOrName = clip.name || clip.filePath || '';
    return /\.(jpg|jpeg|png|webp|gif|bmp|avif|heic|svg)$/i.test(pathOrName);
  }

  /**
   * Pre-creates and warms all media elements and web fonts.
   */
  public async prepare(): Promise<void> {
    if (this.isPrepared) return;

    // 1. Ensure all custom web fonts are fully loaded to prevent font fallback glitches
    try {
      if (document.fonts) {
        await document.fonts.ready;
      }
    } catch (e) {
      console.warn('[FrameCompositor] Font loading wait error:', e);
    }

    // 2. Pre-create Video and Image elements for all clips
    const allClips = this.project.clips || [];
    const mediaPromises: Promise<void>[] = [];

    for (const clip of allClips) {
      const src = clip.mediaBlobUrl || clip.filePath;
      if (!src) continue;

      if (this.isImageClip(clip)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const p = new Promise<void>((res) => {
          img.onload = () => res();
          img.onerror = () => res();
          img.src = src;
        });
        this.imageMap.set(clip.id, img);
        mediaPromises.push(p);
      } else {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.muted = true;
        video.preload = 'auto';
        (video as any).playsInline = true;

        const p = new Promise<void>((res) => {
          video.onloadedmetadata = () => res();
          video.onerror = () => res();
          video.src = src;
          // Fallback timeout
          setTimeout(() => res(), 1200);
        });

        this.videoMap.set(clip.id, video);
        mediaPromises.push(p);
      }
    }

    // 3. Pre-create Image elements for image overlays
    for (const ov of this.project.overlays || []) {
      if (ov.type === 'image') {
        const src = ov.mediaBlobUrl || ov.filePath;
        if (!src) continue;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const p = new Promise<void>((res) => {
          img.onload = () => res();
          img.onerror = () => res();
          img.src = src;
        });
        this.imageMap.set(ov.id, img);
        mediaPromises.push(p);
      }
    }

    await Promise.all(mediaPromises);
    this.isPrepared = true;
  }

  /**
   * Renders a single frame at timestamp `t` (seconds).
   */
  public async renderFrame(t: number): Promise<HTMLCanvasElement> {
    const { ctx, width, height, project } = this;

    // 1. Clear background to dark/black
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    const v1Clips = (project.clips || [])
      .filter((c) => (c.trackIndex || 1) === 1)
      .sort((a, b) => a.timelineStart - b.timelineStart);

    const activeV1 = v1Clips.find(
      (c) => t >= c.timelineStart && t < c.timelineStart + c.timelineDuration
    );

    const activeTrans = getActiveTransitionAtTime(
      t,
      project.transitions,
      project.clips as any
    );

    // 2. Draw Main Track V1 Footage with Transitions & Effects
    if (activeTrans && activeTrans.fromClip && activeTrans.toClip) {
      const fromClip = activeTrans.fromClip as VideoClip;
      const toClip = activeTrans.toClip as VideoClip;
      const prog = activeTrans.progress;
      const tType = activeTrans.transition.type;

      if (
        tType === 'crossfade' ||
        tType === 'fade-in' ||
        tType === 'fade-out' ||
        tType === 'dip-black' ||
        tType === 'dip-white' ||
        tType === 'fade-color'
      ) {
        await this.drawClip(fromClip, t, 1 - prog);
        await this.drawClip(toClip, t, prog);
      } else if (
        tType === 'wipe' ||
        tType.startsWith('wipe') ||
        tType === 'slide' ||
        tType.startsWith('slide') ||
        tType === 'push' ||
        tType.startsWith('push') ||
        tType === 'whip-pan' ||
        tType.startsWith('whip')
      ) {
        // Draw toClip in revealed region, fromClip in remaining region
        await this.drawClip(toClip, t, 1);
        ctx.save();
        ctx.beginPath();
        const dir =
          activeTrans.transition.direction ||
          (tType.includes('left') ? 'left' : tType.includes('down') ? 'down' : tType.includes('up') ? 'up' : 'right');
        if (dir === 'right') {
          ctx.rect(prog * width, 0, width * (1 - prog), height);
        } else if (dir === 'left') {
          ctx.rect(0, 0, width * (1 - prog), height);
        } else if (dir === 'down') {
          ctx.rect(0, prog * height, width, height * (1 - prog));
        } else {
          ctx.rect(0, 0, width, height * (1 - prog));
        }
        ctx.clip();
        await this.drawClip(fromClip, t, 1);
        ctx.restore();
      } else {
        if (activeV1) await this.drawClip(activeV1, t, 1);
      }

      renderTransitionOverlay(ctx, width, height, activeTrans as any);
    } else if (activeV1) {
      await this.drawClip(activeV1, t, activeV1.transform?.opacity ?? 1);
    }

    // 3. Draw Overlay Tracks V2, V3, V4... in ascending layer order (Multi-track support)
    const overlayTrackIndices = Array.from(
      new Set(
        (project.clips || [])
          .map((c) => c.trackIndex || 1)
          .filter((trk) => trk >= 2)
      )
    ).sort((a, b) => a - b);

    for (const trk of overlayTrackIndices) {
      const activeOverlayClip = (project.clips || []).find(
        (c) => (c.trackIndex || 1) === trk && t >= c.timelineStart && t < c.timelineStart + c.timelineDuration
      );
      if (activeOverlayClip) {
        await this.drawClip(activeOverlayClip, t, activeOverlayClip.transform?.opacity ?? 1);
      }
    }

    // 3.5. Apply Timeline Adjustment Layers / Effect Overlays across the whole composition
    const activeEffectOverlays = (project.overlays || []).filter(
      (ov: any) =>
        ((ov.type as any) === 'effect' || (ov.type as any) === 'filter') &&
        t >= ov.timelineStart &&
        t < ov.timelineStart + ov.timelineDuration
    );
    for (const effOv of activeEffectOverlays) {
      if (effOv.effectType) {
        renderCanvasPostEffects(
          ctx,
          width,
          height,
          [
            {
              id: effOv.id,
              type: effOv.effectType as any,
              name: effOv.name,
              category: 'creative',
              enabled: true,
              params: effOv.params || {},
            },
          ],
          t
        );
      }
    }

    // 4. Draw Overlay Elements (Stickers, Text Overlays, Motion Graphics)
    if (project.overlays && project.overlays.length > 0) {
      this.drawOverlays(t);
    }

    // 5. Draw Dynamic Captions
    if (this.burnCaptions && project.captions && project.captions.length > 0) {
      this.drawCaptions(t);
    }

    return this.canvas;
  }

  /**
   * Draws a specific VideoClip (image or video) at time `t` with opacity, filters, and transforms.
   */
  private async drawClip(clip: VideoClip, t: number, alpha = 1.0): Promise<void> {
    const { ctx, width, height } = this;
    if (!clip || alpha <= 0) return;

    ctx.save();

    // 1. Get interpolated transform (position, scale, rotation, opacity)
    const transform = getInterpolatedClipTransform(clip, t);
    const effectiveAlpha = Math.max(0, Math.min(1, alpha * (transform.opacity ?? 1)));
    if (effectiveAlpha <= 0) {
      ctx.restore();
      return;
    }
    ctx.globalAlpha = effectiveAlpha;

    // 2. Apply combined CSS filter + color grading — time-gated through the
    // shared NLE core so export matches preview exactly (timed effect bars).
    const fps = this.project.metadata.fps || 30;
    const activeEffects = getActiveClipEffectsAtTime(clip, t, fps);
    const filterParts: string[] = [];
    const effectFilter = buildCssFilterString(activeEffects as any);
    if (effectFilter && effectFilter !== 'none') filterParts.push(effectFilter);
    const gradeFilter = buildColorGradingCssFilter((clip as any)?.colorGrading);
    if (gradeFilter && gradeFilter !== 'none') filterParts.push(gradeFilter);
    const beautyFilter = buildBeautyCssFilter((clip as any)?.beautyRetouch);
    if (beautyFilter && beautyFilter !== 'none') filterParts.push(beautyFilter);

    const filterStr = filterParts.join(' ').trim();
    if (filterStr) {
      try {
        (ctx as any).filter = filterStr;
      } catch {}
    }

    // 3. Apply spatial transform around center
    const posX = ((transform.xPercent || 0) / 100) * width;
    const posY = ((transform.yPercent || 0) / 100) * height;
    const rot = transform.rotation || 0;
    const scl = transform.scale !== undefined && transform.scale > 0 ? transform.scale : 1.0;

    ctx.translate(width / 2 + posX, height / 2 + posY);
    if (rot !== 0) ctx.rotate((rot * Math.PI) / 180);
    if (scl !== 1.0) ctx.scale(scl, scl);
    ctx.translate(-width / 2, -height / 2);

    const isImg = this.isImageClip(clip);
    let imgEl: HTMLImageElement | undefined;
    let videoEl: HTMLVideoElement | undefined;

    if (isImg) {
      imgEl = this.imageMap.get(clip.id);
    } else {
      videoEl = this.videoMap.get(clip.id);
      if (videoEl) {
        const offsetInTimeline = Math.max(0, t - clip.timelineStart);
        const sourceTime = clip.startOffset + offsetInTimeline * (clip.speed || 1.0);
        await seekVideoElement(videoEl, sourceTime);
      }
    }

    const sw = isImg ? (imgEl?.naturalWidth || width) : (videoEl?.videoWidth || width);
    const sh = isImg ? (imgEl?.naturalHeight || height) : (videoEl?.videoHeight || height);
    const fitScale = Math.min(width / sw, height / sh);
    const dw = sw * fitScale;
    const dh = sh * fitScale;
    const dx = (width - dw) / 2;
    const dy = (height - dh) / 2;

    // Matting / AI Background Removal offscreen render buffer if active
    if (clip.matting?.isEnabled) {
      const offscreenSource = document.createElement('canvas');
      offscreenSource.width = width;
      offscreenSource.height = height;
      const offCtx = offscreenSource.getContext('2d', { willReadFrequently: true });

      if (offCtx) {
        if (isImg && imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
          if (clip.crop) renderCroppedClip(offCtx, imgEl, sw, sh, dx, dy, dw, dh, clip.crop);
          else offCtx.drawImage(imgEl, dx, dy, dw, dh);
        } else if (videoEl && videoEl.readyState >= 2) {
          if (clip.crop) renderCroppedClip(offCtx, videoEl, sw, sh, dx, dy, dw, dh, clip.crop);
          else offCtx.drawImage(videoEl, dx, dy, dw, dh);
        }

        const offscreenTarget = document.createElement('canvas');
        const frameIdx = Math.round(t * (this.project.metadata.fps || 30));
        await backgroundRemovalEngine.processFrame(
          offscreenSource,
          offscreenTarget,
          clip.matting,
          frameIdx,
          t,
          clip.mediaId || clip.id,
          0
        );

        ctx.drawImage(offscreenTarget, 0, 0);
      }
    } else if (isImg) {
      if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
        if (clip.crop) {
          renderCroppedClip(ctx, imgEl, sw, sh, dx, dy, dw, dh, clip.crop);
        } else {
          ctx.drawImage(imgEl, dx, dy, dw, dh);
        }
      }
    } else if (videoEl && videoEl.readyState >= 2) {
      if (clip.crop) {
        renderCroppedClip(ctx, videoEl, sw, sh, dx, dy, dw, dh, clip.crop);
      } else {
        ctx.drawImage(videoEl, dx, dy, dw, dh);
      }
    }

    // Apply Canvas Post-Effects (Vignette, Film Grain, Noise, Glow, Flare, Glitch, Pixelate, etc.)
    // — same time-gated set the preview renders.
    if (activeEffects.length > 0) {
      renderCanvasPostEffects(ctx, width, height, activeEffects, t);
    }

    // Procedural particle overlays — preview renders these; export must too.
    if ((clip as any)?.particles?.isEnabled) {
      try {
        renderCanvasParticles(ctx, width, height, (clip as any).particles, t);
      } catch { /* particle render must never fail export */ }
    }

    try {
      (ctx as any).filter = 'none';
    } catch {}
    ctx.restore();
  }

  /**
   * Draws text/sticker overlays active at time `t`.
   */
  private drawOverlays(t: number): void {
    const { ctx, width, height, project } = this;
    const activeOverlays = (project.overlays || []).filter(
      (ov) => t >= ov.timelineStart && t < ov.timelineStart + ov.timelineDuration
    );

    for (const ov of activeOverlays) {
      ctx.save();
      const x = (ov.x / 100) * width;
      const y = (ov.y / 100) * height;
      const scale = ov.scale || 1.0;
      const opacity = ov.opacity ?? 1.0;

      ctx.globalAlpha = opacity;
      ctx.translate(x, y);
      if (ov.rotation) ctx.rotate((ov.rotation * Math.PI) / 180);
      ctx.scale(scale, scale);

      if (ov.type === 'text' && ov.text) {
        const fontSize = (ov.fontSize || 36) * (width / 1080);
        const fontName = ov.fontFamily || 'Inter';
        const weight = ov.fontWeight || '700';
        ctx.font = `${weight} ${fontSize}px "${fontName}", sans-serif`;
        ctx.textAlign = (ov.alignment as any) || 'center';
        ctx.textBaseline = 'middle';

        if (ov.backgroundColor) {
          const metrics = ctx.measureText(ov.text);
          const pad = (ov.backgroundPadding || 12) * (width / 1080);
          ctx.fillStyle = ov.backgroundColor;
          const rectX = ov.alignment === 'left' ? -pad : ov.alignment === 'right' ? -metrics.width - pad : -metrics.width / 2 - pad;
          ctx.fillRect(rectX, -fontSize / 2 - pad / 2, metrics.width + pad * 2, fontSize + pad);
        }

        if (ov.strokeColor && ov.strokeWidth) {
          ctx.strokeStyle = ov.strokeColor;
          ctx.lineWidth = ov.strokeWidth * (width / 1080);
          ctx.strokeText(ov.text, 0, 0);
        }

        if (ov.shadowColor) {
          ctx.shadowColor = ov.shadowColor;
          ctx.shadowBlur = (ov.shadowBlur || 8) * (width / 1080);
          ctx.shadowOffsetX = (ov.shadowOffsetX || 0) * (width / 1080);
          ctx.shadowOffsetY = (ov.shadowOffsetY || 2) * (width / 1080);
        }

        ctx.fillStyle = ov.textColor || '#FFFFFF';
        ctx.fillText(ov.text, 0, 0);
      } else if (ov.type === 'image') {
        const img = this.imageMap.get(ov.id);
        if (img && img.complete && img.naturalWidth > 0) {
          const iw = img.naturalWidth;
          const ih = img.naturalHeight;
          const baseW = width * 0.25;
          const baseH = (ih / iw) * baseW;
          ctx.drawImage(img, -baseW / 2, -baseH / 2, baseW, baseH);
        }
      } else if (ov.type === 'element' || ov.type === 'motion-graphic' || ov.type === 'intro' || ov.type === 'outro') {
        // Render stylized badge / lower third / title card
        const cardW = width * 0.45;
        const cardH = height * 0.12;
        ctx.fillStyle = ov.backgroundColor || 'rgba(18, 18, 22, 0.85)';
        ctx.fillRect(-cardW / 2, -cardH / 2, cardW, cardH);
        ctx.strokeStyle = ov.textColor || '#38BDF8';
        ctx.lineWidth = 2 * (width / 1080);
        ctx.strokeRect(-cardW / 2, -cardH / 2, cardW, cardH);

        const titleText = ov.title || ov.name || '';
        if (titleText) {
          ctx.font = `800 ${28 * (width / 1080)}px sans-serif`;
          ctx.fillStyle = ov.textColor || '#FFFFFF';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(titleText, 0, ov.subtitle ? -cardH * 0.18 : 0);
        }
        if (ov.subtitle) {
          ctx.font = `500 ${18 * (width / 1080)}px sans-serif`;
          ctx.fillStyle = '#9CA3AF';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(ov.subtitle, 0, cardH * 0.22);
        }
      }

      ctx.restore();
    }
  }

  /**
   * Draws burned captions with exact typography, stroke, shadow, and word highlights.
   */
  private drawCaptions(t: number): void {
    const { ctx, width, height, project } = this;
    let activeCap = (project.captions || []).find((c) => t >= c.start && t <= c.end);

    // Minor tolerance lookup for seamless transitions
    if (!activeCap) {
      for (let i = 0; i < project.captions.length; i++) {
        const cCap = project.captions[i];
        const nCap = project.captions[i + 1];
        if (t >= cCap.end && (!nCap || t < nCap.start)) {
          if (t - cCap.end <= 0.1) {
            activeCap = cCap;
            break;
          }
        }
      }
    }

    if (!activeCap || !activeCap.text) return;

    const effStyle = activeCap.styleOverride || project.activeStyle;
    const animEval = calculateAnimatedCaptionTransform(activeCap, effStyle, t, width, height);
    if (animEval.opacity <= 0.001) return;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, ctx.globalAlpha * animEval.opacity));
    const fontName = effStyle?.fontFamily || 'Montserrat';
    const scaleFactor = width / 1080;
    const baseFontSize = (effStyle?.fontSize || 54) * scaleFactor;
    const yPos = height * ((effStyle?.yOffsetPercent ?? 74) / 100);
    const xPos = width * ((effStyle?.xOffsetPercent ?? 50) / 100);

    const casing = effStyle?.casing || 'uppercase';
    const formatText = (txt: string) => (casing === 'uppercase' ? txt.toUpperCase() : txt);
    const fullText = formatText(activeCap.text);

    // Standard word timing synthesis if words not pre-provided
    const words =
      activeCap.words && activeCap.words.length > 0
        ? activeCap.words
        : activeCap.text
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map((w, idx, arr) => {
              const dur = Math.max(0.05, (activeCap!.end - activeCap!.start) / Math.max(1, arr.length));
              return {
                id: `w_synth_${idx}`,
                word: w,
                start: activeCap!.start + idx * dur,
                end: activeCap!.start + (idx + 1) * dur,
              };
            });

    const activeWordIndex = words.findIndex((w) => t >= w.start && t <= w.end);

    // Handle Specialized Preset Layouts
    if (effStyle?.layoutStyle === 'neon-red-hook') {
      this.drawNeonRedStyle(xPos, yPos, baseFontSize, scaleFactor, fontName, words, formatText, fullText);
    } else if (effStyle?.layoutStyle === 'violet-metallic-3d') {
      this.drawViolet3DStyle(xPos, yPos, baseFontSize, scaleFactor, fontName, words, formatText, fullText);
    } else if (effStyle?.layoutStyle === 'fitness-yellow-punch') {
      this.drawFitnessYellowStyle(xPos, yPos, baseFontSize, scaleFactor, fontName, words, formatText, fullText);
    } else if (effStyle?.layoutStyle === 'money-crimson-script') {
      this.drawMoneyCrimsonStyle(xPos, yPos, baseFontSize, scaleFactor, fontName, words, formatText, fullText);
    } else {
      // Universal Standard & Active-Word Highlight Style
      this.drawStandardKaraokeStyle(
        xPos,
        yPos,
        baseFontSize,
        scaleFactor,
        fontName,
        words,
        activeWordIndex,
        effStyle,
        formatText,
        fullText
      );
    }

    ctx.restore();
  }

  private drawStandardKaraokeStyle(
    xPos: number,
    yPos: number,
    baseFontSize: number,
    scaleFactor: number,
    fontName: string,
    words: WordTimestamp[],
    activeWordIndex: number,
    effStyle: any,
    formatText: (t: string) => string,
    fullText: string
  ): void {
    const { ctx, width } = this;
    ctx.font = `900 ${baseFontSize}px "${fontName}", sans-serif`;
    ctx.textBaseline = 'middle';

    const strokeWidth = (effStyle?.strokeWidth || 6) * scaleFactor;
    const strokeColor = effStyle?.strokeColor || '#000000';
    const primaryColor = effStyle?.primaryColor || '#FFFFFF';
    const highlightColor = effStyle?.highlightColor || '#FFE600';
    const maxLineWidth = width * 0.88;
    const lineHeight = baseFontSize * (effStyle?.lineHeight || 1.3);
    const spaceWidth = ctx.measureText(' ').width;

    // Multi-line word-wrapped layout
    const lines: Array<{ words: Array<{ text: string; width: number; isWordActive: boolean }>; totalWidth: number }> = [];
    let curLineWords: Array<{ text: string; width: number; isWordActive: boolean }> = [];
    let curLineWidth = 0;

    const sourceWords = (words && words.length > 0)
      ? words
      : fullText.trim().split(/\s+/).map((w, idx) => ({ id: `w_${idx}`, word: w, start: 0, end: 0 }));

    sourceWords.forEach((w, idx) => {
      const wText = formatText(w.word);
      const wWidth = ctx.measureText(wText).width;
      const isWordActive = idx === activeWordIndex;
      const needed = curLineWords.length > 0 ? (wWidth + spaceWidth) : wWidth;

      if (curLineWords.length > 0 && curLineWidth + needed > maxLineWidth) {
        lines.push({ words: curLineWords, totalWidth: curLineWidth });
        curLineWords = [{ text: wText, width: wWidth, isWordActive }];
        curLineWidth = wWidth;
      } else {
        curLineWords.push({ text: wText, width: wWidth, isWordActive });
        curLineWidth += needed;
      }
    });
    if (curLineWords.length > 0) {
      lines.push({ words: curLineWords, totalWidth: curLineWidth });
    }

    const totalLines = Math.max(1, lines.length);
    const totalBlockHeight = totalLines * lineHeight;
    const startY = yPos - totalBlockHeight / 2 + lineHeight / 2;

    lines.forEach((line, lineIdx) => {
      const lineY = startY + lineIdx * lineHeight;
      let curX = xPos - line.totalWidth / 2;

      line.words.forEach((wItem) => {
        ctx.textAlign = 'left';
        if (strokeWidth > 0) {
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = strokeWidth;
          ctx.lineJoin = 'round';
          ctx.strokeText(wItem.text, curX, lineY);
        }
        ctx.fillStyle = (effStyle?.activeWordStyle && wItem.isWordActive) ? highlightColor : primaryColor;
        ctx.fillText(wItem.text, curX, lineY);
        curX += wItem.width + spaceWidth;
      });
    });
  }

  private drawNeonRedStyle(
    xPos: number,
    yPos: number,
    baseFontSize: number,
    scaleFactor: number,
    fontName: string,
    words: WordTimestamp[],
    formatText: (t: string) => string,
    fullText: string
  ): void {
    const { ctx } = this;
    const text = words.map((w) => formatText(w.word)).join(' ') || fullText;
    const size = baseFontSize * 1.25;

    ctx.font = `900 italic ${size}px "${fontName}", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const metrics = ctx.measureText(text);
    const boxW = metrics.width + 36 * scaleFactor;
    const boxH = size * 1.3 + 16 * scaleFactor;

    ctx.shadowColor = '#FF0033';
    ctx.shadowBlur = 24 * scaleFactor;
    ctx.strokeStyle = '#FF0033';
    ctx.lineWidth = 4 * scaleFactor;
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.beginPath();
    ctx.roundRect(xPos - boxW / 2, yPos - boxH / 2, boxW, boxH, 12 * scaleFactor);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 6 * scaleFactor;
    ctx.strokeText(text, xPos, yPos);
    ctx.fillStyle = '#FF1133';
    ctx.fillText(text, xPos, yPos);
  }

  private drawViolet3DStyle(
    xPos: number,
    yPos: number,
    baseFontSize: number,
    scaleFactor: number,
    fontName: string,
    words: WordTimestamp[],
    formatText: (t: string) => string,
    fullText: string
  ): void {
    const { ctx } = this;
    const text = words.map((w) => formatText(w.word)).join(' ') || fullText;
    const size = baseFontSize * 1.2;

    ctx.font = `900 ${size}px "${fontName}", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(168, 85, 247, 0.95)';
    ctx.shadowBlur = 20 * scaleFactor;
    ctx.strokeStyle = '#3B0764';
    ctx.lineWidth = 6 * scaleFactor;
    ctx.strokeText(text, xPos, yPos);
    ctx.fillStyle = '#A855F7';
    ctx.fillText(text, xPos, yPos);
  }

  private drawFitnessYellowStyle(
    xPos: number,
    yPos: number,
    baseFontSize: number,
    scaleFactor: number,
    fontName: string,
    words: WordTimestamp[],
    formatText: (t: string) => string,
    fullText: string
  ): void {
    const { ctx } = this;
    const text = words.map((w) => formatText(w.word)).join(' ') || fullText;
    const size = baseFontSize * 1.25;

    ctx.font = `900 ${size}px "${fontName}", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 1.0)';
    ctx.shadowBlur = 14 * scaleFactor;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 7 * scaleFactor;
    ctx.strokeText(text, xPos, yPos);
    ctx.fillStyle = '#E2FD00';
    ctx.fillText(text, xPos, yPos);
  }

  private drawMoneyCrimsonStyle(
    xPos: number,
    yPos: number,
    baseFontSize: number,
    scaleFactor: number,
    fontName: string,
    words: WordTimestamp[],
    formatText: (t: string) => string,
    fullText: string
  ): void {
    const { ctx } = this;
    const text = words.map((w) => formatText(w.word)).join(' ') || fullText;
    const size = baseFontSize * 1.25;

    ctx.font = `900 ${size}px "${fontName}", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#FF0033';
    ctx.shadowBlur = 20 * scaleFactor;
    ctx.strokeStyle = '#300008';
    ctx.lineWidth = 6 * scaleFactor;
    ctx.strokeText(text, xPos, yPos);
    ctx.fillStyle = '#FF0033';
    ctx.fillText(text, xPos, yPos);
  }

  /**
   * Releases all created media resources and object references.
   */
  public cleanup(): void {
    for (const v of this.videoMap.values()) {
      try {
        v.pause();
        v.removeAttribute('src');
      } catch {}
    }
    this.videoMap.clear();
    this.imageMap.clear();
  }
}
