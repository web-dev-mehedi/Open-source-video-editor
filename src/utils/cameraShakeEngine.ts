import { CameraShakeConfig } from '../types/cameraShake';

/**
 * Generate real-time CSS Transform for synthetic camera shake & physics drift
 */
export function getCameraShakeTransform(
  currentTime: number,
  config?: CameraShakeConfig
): { transform?: string } {
  if (!config || !config.isEnabled || config.preset === 'none') {
    return {};
  }

  const intensity = (config.intensity / 100);
  const freq = config.frequency;
  const t = currentTime * freq;

  let dx = 0;
  let dy = 0;
  let dRot = 0;

  if (config.preset === 'subtle_handheld') {
    dx = (Math.sin(t * 1.3) + Math.sin(t * 2.7) * 0.5) * intensity * 8;
    dy = (Math.cos(t * 0.9) + Math.cos(t * 2.1) * 0.5) * intensity * 6;
    dRot = Math.sin(t * 1.1) * intensity * 0.8;
  } else if (config.preset === 'action_cam') {
    dx = (Math.sin(t * 3.7) * 1.2 + Math.cos(t * 7.1) * 0.8) * intensity * 18;
    dy = (Math.cos(t * 4.3) * 1.2 + Math.sin(t * 6.7) * 0.8) * intensity * 16;
    dRot = Math.sin(t * 3.1) * intensity * 2.5;
  } else if (config.preset === 'earthquake') {
    dx = (Math.random() - 0.5) * intensity * 35;
    dy = (Math.random() - 0.5) * intensity * 35;
    dRot = (Math.random() - 0.5) * intensity * 3.5;
  } else if (config.preset === 'cinematic_drift') {
    dx = Math.sin(currentTime * 0.5) * intensity * 12;
    dy = Math.cos(currentTime * 0.3) * intensity * 8;
    dRot = Math.sin(currentTime * 0.4) * intensity * 0.5;
  }

  const zoom = config.autoZoom ? (config.zoomFactor || 1.08) : 1.0;

  return {
    transform: `scale(${zoom.toFixed(3)}) translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${dRot.toFixed(2)}deg)`,
  };
}
