import { StabilizationConfig } from '../types/stabilization';

/**
 * Generate real-time CSS Transform compensation to simulate camera stabilization in player viewport
 */
export function getStabilizationCssTransform(
  currentTime: number,
  config?: StabilizationConfig
): { transform?: string; transition?: string } {
  if (!config || !config.isEnabled) {
    return {};
  }

  const zoomFactor = 1.0 + (config.cropMargin / 100);
  
  if (config.tripodLock) {
    return {
      transform: `scale(${zoomFactor.toFixed(3)}) translate(0px, 0px)`,
      transition: 'transform 0.1s cubic-bezier(0.1, 0.9, 0.2, 1.0)',
    };
  }

  // Generate smooth counter-jitter based on current time & smoothness window
  const smooth = Math.max(1, config.smoothness);
  const freq = 3.5;
  const damp = (100 - smooth) / 100;

  // Counter displacement
  const jitterX = Math.sin(currentTime * freq * 1.3) * damp * 3.5;
  const jitterY = Math.cos(currentTime * freq * 0.9) * damp * 2.8;

  return {
    transform: `scale(${zoomFactor.toFixed(3)}) translate(${-jitterX.toFixed(2)}px, ${-jitterY.toFixed(2)}px)`,
    transition: 'transform 0.08s linear',
  };
}

/**
 * Build FFmpeg vidstabdetect and vidstabtransform filters for smart rendering export
 */
export function buildFFmpegStabilizationFilters(config: StabilizationConfig): {
  detectFilter: string;
  transformFilter: string;
} {
  const shakiness = config.mode === 'tripod' ? 10 : config.mode === 'strong' ? 8 : config.mode === 'smooth' ? 5 : 3;
  const accuracy = 15;
  const stepsize = 6;
  const smoothing = Math.round((config.smoothness / 100) * 30);
  const zoom = Math.round(config.cropMargin);

  const detectFilter = `vidstabdetect=shakiness=${shakiness}:accuracy=${accuracy}:stepsize=${stepsize}:result='transforms.trf'`;
  const transformFilter = `vidstabtransform=input='transforms.trf':smoothing=${smoothing}:zoom=${zoom}:tripod=${config.tripodLock ? 1 : 0}:optzoom=1`;

  return { detectFilter, transformFilter };
}
