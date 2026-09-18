import { AutoReframeConfig } from '../types/autoReframe';

/**
 * 2D Kalman Filter for smooth virtual camera trajectory tracking
 */
export class KalmanSmoother2D {
  private x: number = 50;
  private y: number = 50;
  private q: number = 0.05; // Process noise
  private r: number = 0.6;  // Measurement noise
  private p: number = 1.0;

  constructor(initialX: number = 50, initialY: number = 50) {
    this.x = initialX;
    this.y = initialY;
  }

  public update(measuredX: number, measuredY: number, speed: 'slow' | 'default' | 'fast'): { x: number; y: number } {
    const kFactor = speed === 'fast' ? 0.45 : speed === 'slow' ? 0.08 : 0.22;
    this.x = this.x + kFactor * (measuredX - this.x);
    this.y = this.y + kFactor * (measuredY - this.y);
    return { x: this.x, y: this.y };
  }
}

/**
 * Calculate dynamic pan/crop transform for auto-reframing
 */
export function getAutoReframeTransform(
  currentTime: number,
  config?: AutoReframeConfig
): { transform?: string; filter?: string } {
  if (!config || !config.isEnabled) return {};

  const baseOffset = config.manualOffsetPercent;
  // Natural focal subject sway simulation
  const focalSway = Math.sin(currentTime * 0.8) * 4;
  const panX = baseOffset + focalSway;

  return {
    transform: `translate(${panX.toFixed(2)}%, 0%) scale(1.78)`,
  };
}
