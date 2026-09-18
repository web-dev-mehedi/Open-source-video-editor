import { describe, test, assert } from 'vitest';
import { calculateTrimUpdate, quantizeToFrame } from '../../hooks/useClipTrim';

describe('CapCut-Style Non-Destructive Timeline Trimming Engine', () => {
  // Test 1: Right-edge trimming (shortening clip)
  test('1. Right-edge trimming reduces duration and endOffset without touching duration or startOffset', () => {
    const clip = {
      timelineStart: 0,
      timelineDuration: 30,
      startOffset: 0,
      endOffset: 30,
      duration: 30,
      speed: 1.0,
      fps: 30,
    };

    // Drag right edge 10s to the left (delta = -10s)
    const res = calculateTrimUpdate(clip, 'right', -10);

    assert.strictEqual(res.timelineStart, 0);
    assert.strictEqual(res.timelineDuration, 20);
    assert.strictEqual(res.startOffset, 0);
    assert.strictEqual(res.endOffset, 20);
    assert.strictEqual(res.effectiveCurrentCutTime, 20);
    assert.strictEqual(res.effectiveSourceCutTime, 20);
  });

  // Test 2: Left-edge trimming (moving in-point forward, right edge stays pinned)
  test('2. Left-edge trimming moves startOffset and timelineStart forward while keeping right edge fixed', () => {
    const clip = {
      timelineStart: 0,
      timelineDuration: 30,
      startOffset: 0,
      endOffset: 30,
      duration: 30,
      speed: 1.0,
      fps: 30,
    };

    // Drag left edge 5s to the right (delta = +5s)
    const res = calculateTrimUpdate(clip, 'left', 5);

    assert.strictEqual(res.timelineStart, 5);
    assert.strictEqual(res.timelineDuration, 25);
    assert.strictEqual(res.startOffset, 5);
    assert.strictEqual(res.endOffset, 30);
    // Right timeline edge is timelineStart + timelineDuration = 5 + 25 = 30 (PINNED)
    assert.strictEqual(res.timelineStart + res.timelineDuration, 30);
    assert.strictEqual(res.effectiveCurrentCutTime, 5);
    assert.strictEqual(res.effectiveSourceCutTime, 5);
  });

  // Test 3: Restoring trimmed content (right edge outward)
  test('3. Restoring trimmed content by dragging right edge outward recovers hidden source content', () => {
    const trimmedClip = {
      timelineStart: 0,
      timelineDuration: 20,
      startOffset: 0,
      endOffset: 20,
      duration: 30, // Original 30s source media remains available!
      speed: 1.0,
      fps: 30,
    };

    // Drag right edge 10s outward (delta = +10s)
    const res = calculateTrimUpdate(trimmedClip, 'right', 10);

    assert.strictEqual(res.timelineStart, 0);
    assert.strictEqual(res.timelineDuration, 30);
    assert.strictEqual(res.startOffset, 0);
    assert.strictEqual(res.endOffset, 30);
  });

  // Test 4: Restoring trimmed content (left edge outward)
  test('4. Restoring trimmed content by dragging left edge outward recovers hidden source content down to 0', () => {
    const trimmedClip = {
      timelineStart: 5,
      timelineDuration: 25,
      startOffset: 5,
      endOffset: 30,
      duration: 30,
      speed: 1.0,
      fps: 30,
    };

    // Drag left edge 5s outward / to the left (delta = -5s)
    const res = calculateTrimUpdate(trimmedClip, 'left', -5);

    assert.strictEqual(res.timelineStart, 0);
    assert.strictEqual(res.timelineDuration, 30);
    assert.strictEqual(res.startOffset, 0);
    assert.strictEqual(res.endOffset, 30);
    // Right edge still pinned at 30
    assert.strictEqual(res.timelineStart + res.timelineDuration, 30);
  });

  // Test 5: Speed compatibility (2x playback rate)
  test('5. Trimming with 2x playback speed scales timeline delta correctly to source delta', () => {
    const fastClip = {
      timelineStart: 10,
      timelineDuration: 10, // (25 - 5) / 2 = 10s on timeline
      startOffset: 5,
      endOffset: 25,
      duration: 60,
      speed: 2.0, // 2x speed
      fps: 30,
    };

    // Drag right edge +5s on timeline -> corresponds to +10s in source space (5s * 2x)
    const resRight = calculateTrimUpdate(fastClip, 'right', 5);
    assert.strictEqual(resRight.endOffset, 35); // 25 + 10 = 35s
    assert.strictEqual(resRight.startOffset, 5);
    assert.strictEqual(resRight.timelineDuration, 15); // (35 - 5) / 2 = 15s

    // Drag left edge +2s on timeline -> corresponds to +4s in source space (2s * 2x)
    const resLeft = calculateTrimUpdate(fastClip, 'left', 2);
    assert.strictEqual(resLeft.startOffset, 9); // 5 + 4 = 9s
    assert.strictEqual(resLeft.endOffset, 25);
    assert.strictEqual(resLeft.timelineStart, 12); // 10 + 2 = 12s
    assert.strictEqual(resLeft.timelineDuration, 8); // (25 - 9) / 2 = 8s
    // Right edge pinned: 12 + 8 = 20s (initial 10 + 10 = 20s)
    assert.strictEqual(resLeft.timelineStart + resLeft.timelineDuration, 20);
  });

  // Test 6: Speed compatibility (0.5x slow motion playback rate)
  test('6. Trimming with 0.5x slow motion scales timeline delta correctly', () => {
    const slowClip = {
      timelineStart: 0,
      timelineDuration: 20, // (10 - 0) / 0.5 = 20s on timeline
      startOffset: 0,
      endOffset: 10,
      duration: 30,
      speed: 0.5,
      fps: 30,
    };

    // Drag right edge +10s on timeline -> corresponds to +5s in source space (10s * 0.5x)
    const res = calculateTrimUpdate(slowClip, 'right', 10);
    assert.strictEqual(res.endOffset, 15); // 10 + 5 = 15s
    assert.strictEqual(res.timelineDuration, 30); // 15 / 0.5 = 30s
  });

  // Test 7: Boundary constraints (cannot drag left past 0)
  test('7. Left handle cannot be dragged past 0s in source space', () => {
    const clip = {
      timelineStart: 10,
      timelineDuration: 20,
      startOffset: 2,
      endOffset: 22,
      duration: 30,
      speed: 1.0,
      fps: 30,
    };

    // Attempt to drag left by -10s (would be -8s source offset)
    const res = calculateTrimUpdate(clip, 'left', -10);
    assert.strictEqual(res.startOffset, 0); // Clamped to 0
    assert.strictEqual(res.timelineStart, 8); // 10 - 2 = 8s
    assert.strictEqual(res.timelineDuration, 22); // 22 - 0 = 22s
    // Right edge remains pinned at 8 + 22 = 30s (was 10 + 20 = 30s)
    assert.strictEqual(res.timelineStart + res.timelineDuration, 30);
  });

  // Test 8: Boundary constraints (cannot drag right past source duration)
  test('8. Right handle cannot exceed raw source media duration for video/audio', () => {
    const clip = {
      timelineStart: 0,
      timelineDuration: 25,
      startOffset: 0,
      endOffset: 25,
      duration: 30,
      speed: 1.0,
      fps: 30,
    };

    // Attempt to drag right by +20s (would be 45s, beyond 30s duration)
    const res = calculateTrimUpdate(clip, 'right', 20);
    assert.strictEqual(res.endOffset, 30); // Clamped to raw duration (30s)
    assert.strictEqual(res.timelineDuration, 30);
  });

  // Test 9: Minimum clip duration constraint
  test('9. Enforces minimum clip duration when trimming either edge', () => {
    const clip = {
      timelineStart: 0,
      timelineDuration: 5,
      startOffset: 0,
      endOffset: 5,
      duration: 30,
      speed: 1.0,
      fps: 30,
    };

    // Drag right edge to collapse clip (delta = -10s)
    const resRight = calculateTrimUpdate(clip, 'right', -10, { minDuration: 0.1 });
    assert.ok(resRight.endOffset >= 0.1);
    assert.ok(resRight.timelineDuration >= 0.1);

    // Drag left edge to collapse clip (delta = +10s)
    const resLeft = calculateTrimUpdate(clip, 'left', 10, { minDuration: 0.1 });
    assert.ok(resLeft.startOffset <= 4.9);
    assert.ok(resLeft.timelineDuration >= 0.1);
  });

  // Test 10: Still image infinite right-edge expansion
  test('10. Still images support indefinite right-edge expansion while clamping startOffset >= 0', () => {
    const imageClip = {
      timelineStart: 0,
      timelineDuration: 5,
      startOffset: 0,
      endOffset: 5,
      duration: 5,
      speed: 1.0,
      fps: 30,
    };

    // Expand right edge by +55s (to 60s total)
    const res = calculateTrimUpdate(imageClip, 'right', 55, { isImage: true });
    assert.strictEqual(res.endOffset, 60);
    assert.strictEqual(res.timelineDuration, 60);
  });

  // Test 11: Frame quantization
  test('11. Quantizes cut points to exact frame boundaries based on FPS', () => {
    assert.ok(Math.abs(quantizeToFrame(1.016, 30) - 1.0) < 0.01);
    assert.ok(Math.abs(quantizeToFrame(1.033, 30) - 1.033) < 0.01);
  });

  // Test 12: Magnetic snapping to playhead
  test('12. Snaps to playhead when dragged near playhead position', () => {
    const clip = {
      timelineStart: 0,
      timelineDuration: 20,
      startOffset: 0,
      endOffset: 20,
      duration: 30,
      speed: 1.0,
      fps: 30,
    };

    // Playhead is at 15.0s, user drags right edge from 20s to ~15.02s
    const res = calculateTrimUpdate(clip, 'right', -4.98, {
      fps: 30,
      snapCandidates: [15.0],
      snapThresholdTimeline: 0.2, // within 200ms
    });

    assert.strictEqual(res.snapped, true);
    assert.strictEqual(res.snapPoint, 15.0);
    assert.ok(Math.abs(res.timelineDuration - 15.0) < 0.01);
    assert.ok(Math.abs(res.endOffset - 15.0) < 0.01);
  });

  // Test 13: Separate Timeline Space vs Source Space
  test('13. Timeline offset does not corrupt source offsets when clip is placed later on timeline', () => {
    const clip = {
      timelineStart: 120, // starts at 2 minutes on timeline
      timelineDuration: 30,
      startOffset: 10,
      endOffset: 40,
      duration: 60,
      speed: 1.0,
      fps: 30,
    };

    // Trim 5s from right edge
    const resRight = calculateTrimUpdate(clip, 'right', -5);
    assert.strictEqual(resRight.timelineStart, 120);
    assert.strictEqual(resRight.timelineDuration, 25);
    assert.strictEqual(resRight.startOffset, 10);
    assert.strictEqual(resRight.endOffset, 35);

    // Trim 5s from left edge
    const resLeft = calculateTrimUpdate(clip, 'left', 5);
    assert.strictEqual(resLeft.timelineStart, 125);
    assert.strictEqual(resLeft.timelineDuration, 25);
    assert.strictEqual(resLeft.startOffset, 15);
    assert.strictEqual(resLeft.endOffset, 40);
  });
});
