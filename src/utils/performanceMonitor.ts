/**
 * Real-Time NLE Performance Diagnostics & Telemetry Monitor
 */
export interface PerformanceMetrics {
  fps: number;
  frameRenderTimeMs: number;
  decodeTimeMs: number;
  activeClips: number;
  activeTracks: number;
  activeEffects: number;
  cacheHitRatePercent: number;
  effectivePreviewScale: number;
  timestamp: number;
}

class PerformanceMonitor {
  private lastFrameTimestamp = performance.now();
  private frameTimes: number[] = [];
  private renderDurations: number[] = [];
  private decodeDurations: number[] = [];
  private totalCacheLookups = 0;
  private totalCacheHits = 0;
  private maxSamples = 60;

  public recordFrame(renderDurationMs = 0, decodeDurationMs = 0) {
    const now = performance.now();
    const delta = now - this.lastFrameTimestamp;
    this.lastFrameTimestamp = now;

    if (delta > 0 && delta < 500) {
      this.frameTimes.push(delta);
      if (this.frameTimes.length > this.maxSamples) this.frameTimes.shift();
    }

    if (renderDurationMs > 0) {
      this.renderDurations.push(renderDurationMs);
      if (this.renderDurations.length > this.maxSamples) this.renderDurations.shift();
    }

    if (decodeDurationMs > 0) {
      this.decodeDurations.push(decodeDurationMs);
      if (this.decodeDurations.length > this.maxSamples) this.decodeDurations.shift();
    }
  }

  public recordCacheLookup(isHit: boolean) {
    this.totalCacheLookups++;
    if (isHit) this.totalCacheHits++;
  }

  public getMetrics(activeClips = 0, activeTracks = 0, activeEffects = 0, scale = 1.0): PerformanceMetrics {
    // Average FPS
    let avgFps = 60;
    if (this.frameTimes.length > 0) {
      const avgDelta = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
      avgFps = avgDelta > 0 ? Math.round(1000 / avgDelta) : 60;
    }

    // Average render time
    let avgRenderMs = 1.2;
    if (this.renderDurations.length > 0) {
      avgRenderMs = Math.round((this.renderDurations.reduce((a, b) => a + b, 0) / this.renderDurations.length) * 10) / 10;
    }

    // Average decode time
    let avgDecodeMs = 2.0;
    if (this.decodeDurations.length > 0) {
      avgDecodeMs = Math.round((this.decodeDurations.reduce((a, b) => a + b, 0) / this.decodeDurations.length) * 10) / 10;
    }

    const hitRate = this.totalCacheLookups > 0
      ? Math.round((this.totalCacheHits / this.totalCacheLookups) * 100)
      : 100;

    return {
      fps: Math.min(144, Math.max(0, avgFps)),
      frameRenderTimeMs: avgRenderMs,
      decodeTimeMs: avgDecodeMs,
      activeClips,
      activeTracks,
      activeEffects,
      cacheHitRatePercent: hitRate,
      effectivePreviewScale: scale,
      timestamp: Date.now(),
    };
  }

  public reset() {
    this.frameTimes = [];
    this.renderDurations = [];
    this.decodeDurations = [];
    this.totalCacheLookups = 0;
    this.totalCacheHits = 0;
  }
}

export const performanceMonitor = new PerformanceMonitor();
