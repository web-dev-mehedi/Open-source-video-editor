import { describe, test, expect } from 'vitest';
import { evaluateClipAnimation } from '../animationEngine';
import { getInterpolatedClipTransform } from '../keyframeEngine';
import { VideoClip } from '../../types/project';

describe('Video Clip Animation Engine', () => {
  const baseClip: VideoClip = {
    id: 'clip_anim_1',
    name: 'Sample.mp4',
    filePath: 'C:/sample.mp4',
    duration: 10,
    startOffset: 0,
    endOffset: 10,
    timelineStart: 5.0,
    timelineDuration: 10.0,
    speed: 1.0,
    volume: 1.0,
    isMuted: false,
    width: 1920,
    height: 1080,
    fps: 30,
    transform: {
      scale: 1.0,
      xPercent: 0,
      yPercent: 0,
      rotation: 0,
      opacity: 1.0,
    },
  };

  test('Returns identity when clip has no animation', () => {
    const delta = evaluateClipAnimation(baseClip, 6.0);
    expect(delta.scaleMultiplier).toBe(1.0);
    expect(delta.opacityMultiplier).toBe(1.0);
    expect(delta.deltaXPercent).toBe(0);
    expect(delta.deltaYPercent).toBe(0);
    expect(delta.deltaRotation).toBe(0);
  });

  test('In-Animation (Fade In) smoothly transitions opacity from 0 to 1', () => {
    const animClip: VideoClip = {
      ...baseClip,
      animation: {
        category: 'in',
        type: 'fade-in',
        name: 'Fade In',
        duration: 1.0,
        intensity: 100,
      },
    };

    // Before animation starts
    const atStart = evaluateClipAnimation(animClip, 5.0);
    expect(atStart.opacityMultiplier).toBeCloseTo(0, 1);

    // Midpoint
    const atMid = evaluateClipAnimation(animClip, 5.5);
    expect(atMid.opacityMultiplier).toBeGreaterThan(0.2);
    expect(atMid.opacityMultiplier).toBeLessThan(1.0);

    // Complete
    const atEnd = evaluateClipAnimation(animClip, 6.0);
    expect(atEnd.opacityMultiplier).toBe(1.0);

    // Long after
    const after = evaluateClipAnimation(animClip, 8.0);
    expect(after.opacityMultiplier).toBe(1.0);
  });

  test('In-Animation (Zoom In) starts at smaller scale and expands to 1.0', () => {
    const animClip: VideoClip = {
      ...baseClip,
      animation: {
        category: 'in',
        type: 'zoom-in',
        name: 'Zoom In',
        duration: 1.0,
        intensity: 100,
      },
    };

    const atStart = evaluateClipAnimation(animClip, 5.0);
    expect(atStart.scaleMultiplier).toBeLessThan(0.5);

    const atMid = evaluateClipAnimation(animClip, 5.5);
    expect(atMid.scaleMultiplier).toBeGreaterThan(atStart.scaleMultiplier);
    expect(atMid.scaleMultiplier).toBeLessThan(1.0);

    const atEnd = evaluateClipAnimation(animClip, 6.0);
    expect(atEnd.scaleMultiplier).toBe(1.0);
  });

  test('In-Animation (Slide Right) enters from negative X into 0', () => {
    const animClip: VideoClip = {
      ...baseClip,
      animation: {
        category: 'in',
        type: 'slide-right',
        name: 'Slide Right',
        duration: 1.0,
        intensity: 100,
      },
    };

    const atStart = evaluateClipAnimation(animClip, 5.0);
    expect(atStart.deltaXPercent).toBeCloseTo(-100, 0);

    const atEnd = evaluateClipAnimation(animClip, 6.0);
    expect(atEnd.deltaXPercent).toBe(0);
  });

  test('Out-Animation (Fade Out) transitions opacity to 0 at clip end', () => {
    const animClip: VideoClip = {
      ...baseClip,
      animation: {
        category: 'out',
        type: 'fade-out',
        name: 'Fade Out',
        duration: 1.0,
        intensity: 100,
      },
    };

    // Clip ends at 15.0. Out animation starts at 14.0.
    const beforeOut = evaluateClipAnimation(animClip, 13.5);
    expect(beforeOut.opacityMultiplier).toBe(1.0);

    const midOut = evaluateClipAnimation(animClip, 14.5);
    expect(midOut.opacityMultiplier).toBeLessThan(1.0);
    expect(midOut.opacityMultiplier).toBeGreaterThan(0);

    const atEnd = evaluateClipAnimation(animClip, 15.0);
    expect(atEnd.opacityMultiplier).toBe(0);
  });

  test('Combo-Animation (Pulse) modulates scale continuously', () => {
    const animClip: VideoClip = {
      ...baseClip,
      animation: {
        category: 'combo',
        type: 'pulse',
        name: 'Pulse',
        duration: 1.0,
        intensity: 100,
      },
    };

    const atStart = evaluateClipAnimation(animClip, 5.0);
    expect(atStart.scaleMultiplier).toBeCloseTo(1.0, 1);

    const atQuarter = evaluateClipAnimation(animClip, 5.25);
    // At quarter cycle (sin(pi/2) = 1), scale should peak > 1.0
    expect(atQuarter.scaleMultiplier).toBeGreaterThan(1.03);
  });

  test('getInterpolatedClipTransform seamlessly factors in animation for preview and export parity', () => {
    const animClip: VideoClip = {
      ...baseClip,
      transform: {
        scale: 1.5,
        xPercent: 10,
        yPercent: 20,
        rotation: 45,
        opacity: 0.8,
      },
      animation: {
        category: 'in',
        type: 'fade-in',
        name: 'Fade In',
        duration: 1.0,
        intensity: 100,
      },
    };

    // At start of animation, opacity should be 0 even though base transform is 0.8
    const t0 = getInterpolatedClipTransform(animClip, 5.0);
    expect(t0.opacity).toBe(0);
    expect(t0.xPercent).toBe(10);
    expect(t0.yPercent).toBe(20);
    expect(t0.rotation).toBe(45);

    // After animation ends, full base opacity (0.8) and scale (1.5) are returned
    const tEnd = getInterpolatedClipTransform(animClip, 6.5);
    expect(tEnd.opacity).toBe(0.8);
    expect(tEnd.scale).toBe(1.5);
    expect(tEnd.xPercent).toBe(10);
    expect(tEnd.yPercent).toBe(20);
    expect(tEnd.rotation).toBe(45);
  });
});
