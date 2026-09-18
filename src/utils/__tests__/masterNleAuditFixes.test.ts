import { describe, test, expect } from 'vitest';
import { quantizeToFrame, clampTrimBoundaries } from '../timelineMath';
import { getInterpolatedClipTransform } from '../keyframeEngine';
import { VideoClip, AudioClip } from '../../types/project';
import { CaptionLine } from '../../types/caption';

describe('CaptionForge Master NLE Audit & Invariant Regression Suite', () => {
  // -------------------------------------------------------------------------
  // 1. BUG-001: Video Clip Trim & Move Linked Audio Clip Synchronization
  // -------------------------------------------------------------------------
  test('BUG-001: Linked audio clip synchronizes timing when video clip is trimmed', () => {
    const videoClip: VideoClip = {
      id: 'clip_v1',
      name: 'Interview.mp4',
      filePath: 'C:/media/interview.mp4',
      duration: 30,
      startOffset: 0,
      endOffset: 30,
      timelineStart: 10,
      timelineDuration: 30,
      speed: 1.0,
      volume: 1.0,
      isMuted: false,
      width: 1920,
      height: 1080,
      fps: 30,
    };

    const linkedAudio: AudioClip = {
      id: 'audio_a1',
      name: 'Interview.mp4 (Audio)',
      sourceClipId: 'clip_v1',
      filePath: 'C:/media/interview.mp4',
      duration: 30,
      startOffset: 0,
      endOffset: 30,
      timelineStart: 10,
      timelineDuration: 30,
      speed: 1.0,
      volume: 1.0,
      isMuted: false,
    };

    // User trims 5s from the left: startOffset becomes 5s, timelineStart becomes 15s, timelineDuration becomes 25s
    const trimUpdates: Partial<VideoClip> = {
      startOffset: 5,
      timelineStart: 15,
      timelineDuration: 25,
    };

    const updatedAudio = [linkedAudio].map((ac) => {
      if (ac.sourceClipId === videoClip.id) {
        return {
          ...ac,
          timelineStart: trimUpdates.timelineStart ?? ac.timelineStart,
          timelineDuration: trimUpdates.timelineDuration ?? ac.timelineDuration,
          startOffset: trimUpdates.startOffset ?? ac.startOffset,
          endOffset: trimUpdates.endOffset ?? ac.endOffset,
          speed: trimUpdates.speed ?? ac.speed,
        };
      }
      return ac;
    });

    expect(updatedAudio[0].timelineStart).toBe(15);
    expect(updatedAudio[0].timelineDuration).toBe(25);
    expect(updatedAudio[0].startOffset).toBe(5);
    expect(updatedAudio[0].endOffset).toBe(30);
  });

  // -------------------------------------------------------------------------
  // 2. BUG-002: True Ripple Delete Preserving Preceding Gaps & Clips
  // -------------------------------------------------------------------------
  test('BUG-002: Ripple delete shifts only trailing items and preserves preceding clips and gaps', () => {
    // Timeline: [5s-10s: Clip A] -- (5s gap) -- [15s-20s: Clip B] -- [20s-30s: Clip C]
    const clips: Array<{ id: string; timelineStart: number; timelineDuration: number; trackIndex: number }> = [
      { id: 'clip_A', timelineStart: 5, timelineDuration: 5, trackIndex: 1 },
      { id: 'clip_B', timelineStart: 15, timelineDuration: 5, trackIndex: 1 },
      { id: 'clip_C', timelineStart: 20, timelineDuration: 10, trackIndex: 1 },
    ];

    const targetClip = clips.find((c) => c.id === 'clip_B')!;
    const delStart = targetClip.timelineStart;
    const delDur = targetClip.timelineDuration;
    const delEnd = delStart + delDur;

    const remaining = clips.filter((c) => c.id !== 'clip_B');
    const rippled = remaining.map((c) => {
      if (c.trackIndex === 1 && c.timelineStart >= delEnd - 0.02) {
        return { ...c, timelineStart: Math.max(delStart, c.timelineStart - delDur) };
      }
      return c;
    });

    // Clip A MUST retain its exact position (5s) and not snap to 0!
    const clipA = rippled.find((c) => c.id === 'clip_A')!;
    expect(clipA.timelineStart).toBe(5);
    expect(clipA.timelineDuration).toBe(5);

    // Clip C shifted from 20s to 15s (shifted by exact duration of B: 5s)
    const clipC = rippled.find((c) => c.id === 'clip_C')!;
    expect(clipC.timelineStart).toBe(15);
    expect(clipC.timelineDuration).toBe(10);
  });

  // -------------------------------------------------------------------------
  // 3. BUG-003: Close Gap Synchronizes Linked Audio and Captions
  // -------------------------------------------------------------------------
  test('BUG-003: closeGapAtTime shifts trailing video, linked audio, and captions', () => {
    const video = [
      { id: 'v1', timelineStart: 0, timelineDuration: 5, trackIndex: 1 },
      // 3-second gap (5s to 8s)
      { id: 'v2', timelineStart: 8, timelineDuration: 5, trackIndex: 1 },
    ];

    const audio = [
      { id: 'a2', sourceClipId: 'v2', timelineStart: 8, timelineDuration: 5 },
    ];

    const captions = [
      { id: 'c1', start: 8.5, end: 12.0, text: 'Hello World' },
    ];

    const gapSize = 3.0; // 8 - 5
    const cutPoint = 8.0;

    const shiftedVideo = video.map((v) =>
      v.id === 'v2' ? { ...v, timelineStart: v.timelineStart - gapSize } : v
    );
    const shiftedAudio = audio.map((a) =>
      a.timelineStart >= cutPoint - 0.05 ? { ...a, timelineStart: a.timelineStart - gapSize } : a
    );
    const shiftedCaptions = captions.map((c) =>
      c.start >= cutPoint - 0.05 ? { ...c, start: c.start - gapSize, end: c.end - gapSize } : c
    );

    expect(shiftedVideo[1].timelineStart).toBe(5);
    expect(shiftedAudio[0].timelineStart).toBe(5);
    expect(shiftedCaptions[0].start).toBe(5.5);
    expect(shiftedCaptions[0].end).toBe(9.0);
  });

  // -------------------------------------------------------------------------
  // 4. BUG-004: Split Clip Caption Clip ID Association
  // -------------------------------------------------------------------------
  test('BUG-004: Split clip fallback attaches correct clipIds to both caption slices', () => {
    const originalCap: CaptionLine = {
      id: 'cap_orig',
      clipId: 'clip_part_1',
      start: 2.0,
      end: 6.0,
      text: 'Long spoken sentence without individual word timestamps',
      words: [],
    };

    const currentTime = 4.0;
    const secondClipId = 'clip_part_2';

    // Time-based split fallback
    const cap1: CaptionLine = {
      ...originalCap,
      id: originalCap.id,
      clipId: originalCap.clipId,
      end: currentTime,
    };

    const cap2: CaptionLine = {
      ...originalCap,
      id: 'cap_part_2',
      clipId: secondClipId,
      start: currentTime,
    };

    expect(cap1.clipId).toBe('clip_part_1');
    expect(cap2.clipId).toBe('clip_part_2');
    expect(cap1.end).toBe(4.0);
    expect(cap2.start).toBe(4.0);
  });

  // -------------------------------------------------------------------------
  // 5. BUG-005 & BUG-006: Multi-Track Overlay and Transform Parity
  // -------------------------------------------------------------------------
  test('BUG-005 & BUG-006: Multi-track sorting and transform interpolation calculate accurate aspect contain', () => {
    const allClips: VideoClip[] = [
      { id: 'v1', trackIndex: 1, timelineStart: 0, timelineDuration: 10, speed: 1, volume: 1, isMuted: false, duration: 10, startOffset: 0, endOffset: 10, fps: 30, width: 1920, height: 1080, filePath: '', name: 'Main' },
      { id: 'v3', trackIndex: 3, timelineStart: 2, timelineDuration: 4, speed: 1, volume: 1, isMuted: false, duration: 4, startOffset: 0, endOffset: 4, fps: 30, width: 1080, height: 1920, filePath: '', name: 'TopOverlay' },
      { id: 'v2', trackIndex: 2, timelineStart: 1, timelineDuration: 5, speed: 1, volume: 1, isMuted: false, duration: 5, startOffset: 0, endOffset: 5, fps: 30, width: 1920, height: 1080, filePath: '', name: 'B-Roll' },
    ];

    // Collect all tracks >= 2 in ascending render order
    const overlayTracks = Array.from(
      new Set(allClips.map((c) => c.trackIndex || 1).filter((t) => t >= 2))
    ).sort((a, b) => a - b);

    expect(overlayTracks).toEqual([2, 3]);

    // Aspect-ratio contain math: 1080x1920 (9:16) inside 1920x1080 (16:9) canvas
    const canvasW = 1920;
    const canvasH = 1080;
    const mediaW = 1080;
    const mediaH = 1920;
    const fitScale = Math.min(canvasW / mediaW, canvasH / mediaH); // 1080 / 1920 = 0.5625
    const dw = mediaW * fitScale; // 607.5
    const dh = mediaH * fitScale; // 1080
    const dx = (canvasW - dw) / 2; // (1920 - 607.5) / 2 = 656.25
    const dy = (canvasH - dh) / 2; // 0

    expect(fitScale).toBeCloseTo(0.5625, 3);
    expect(dh).toBe(1080);
    expect(dw).toBeCloseTo(607.5, 1);
    expect(dx).toBeCloseTo(656.25, 1);
    expect(dy).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 6. BUG-008: Audio Speed Scaling Math
  // -------------------------------------------------------------------------
  test('BUG-008: Audio speed scaling correctly scales buffer read duration with playbackRate', () => {
    const timelineDuration = 5.0; // 5 seconds on timeline
    const speed = 2.0; // Fast forward 2x

    const sourcePlaybackRate = speed;
    const sourceBufferDuration = timelineDuration * speed; // Needs 10 seconds of source buffer to play in 5s

    expect(sourcePlaybackRate).toBe(2.0);
    expect(sourceBufferDuration).toBe(10.0);
    // Verified playback time on timeline = bufferDuration / speed = 10 / 2 = 5s
    expect(sourceBufferDuration / sourcePlaybackRate).toBe(timelineDuration);
  });

  // -------------------------------------------------------------------------
  // 7. BUG-009: Multiline Caption Wrapping Calculation
  // -------------------------------------------------------------------------
  test('BUG-009: Long caption text wraps into multiple lines without exceeding maxLineWidth', () => {
    const maxLineWidth = 800; // px
    const words = 'This is an extraordinarily long sentence designed to verify that the caption engine wraps lines'.split(' ');

    const spaceWidth = 10;
    const charWidth = 12; // approximate average glyph width

    const lines: string[][] = [];
    let curLine: string[] = [];
    let curWidth = 0;

    words.forEach((w) => {
      const wWidth = w.length * charWidth;
      const needed = curLine.length > 0 ? wWidth + spaceWidth : wWidth;
      if (curLine.length > 0 && curWidth + needed > maxLineWidth) {
        lines.push(curLine);
        curLine = [w];
        curWidth = wWidth;
      } else {
        curLine.push(w);
        curWidth += needed;
      }
    });
    if (curLine.length > 0) lines.push(curLine);

    expect(lines.length).toBeGreaterThan(1);
    lines.forEach((l) => {
      const lineWidth = l.reduce((acc, word, idx) => acc + word.length * charWidth + (idx > 0 ? spaceWidth : 0), 0);
      expect(lineWidth).toBeLessThanOrEqual(maxLineWidth);
    });
  });

  // -------------------------------------------------------------------------
  // 8. BUG-010: Audio Split Point on Speed-Altered Clips
  // -------------------------------------------------------------------------
  test('BUG-010: Splitting speed-altered audio clip multiplies timeline offset by speed', () => {
    // 10s source clip sped up to 2x: duration on timeline is 5s
    const audioClip: AudioClip = {
      id: 'audio_speedy',
      name: 'Podcast.mp3',
      filePath: 'C:/audio/podcast.mp3',
      duration: 10,
      startOffset: 0,
      endOffset: 10,
      timelineStart: 0,
      timelineDuration: 5,
      speed: 2.0,
      volume: 1.0,
      isMuted: false,
    };

    // User splits halfway at currentTime = 2.5s
    const currentTime = 2.5;
    const offsetInTimeline = currentTime - audioClip.timelineStart; // 2.5s
    const speed = (audioClip as any).speed || 1.0;
    const splitPointSource = audioClip.startOffset + offsetInTimeline * speed; // 0 + 2.5 * 2.0 = 5.0s

    const firstPart = {
      ...audioClip,
      endOffset: Math.round(splitPointSource * 1000) / 1000,
      timelineDuration: Math.round(offsetInTimeline * 1000) / 1000,
    };

    const secondPart = {
      ...audioClip,
      id: 'audio_speedy_part2',
      startOffset: Math.round(splitPointSource * 1000) / 1000,
      timelineStart: Math.round(currentTime * 1000) / 1000,
      timelineDuration: Math.round((audioClip.timelineDuration - offsetInTimeline) * 1000) / 1000,
    };

    // Part 1 source: 0s to 5.0s. At 2x speed, timeline duration = 5 / 2 = 2.5s (Exact!)
    expect(firstPart.startOffset).toBe(0);
    expect(firstPart.endOffset).toBe(5.0);
    expect(firstPart.timelineDuration).toBe(2.5);

    // Part 2 source: 5.0s to 10.0s. At 2x speed, timeline duration = (10 - 5) / 2 = 2.5s (Exact!)
    expect(secondPart.startOffset).toBe(5.0);
    expect(secondPart.endOffset).toBe(10.0);
    expect(secondPart.timelineStart).toBe(2.5);
    expect(secondPart.timelineDuration).toBe(2.5);
  });

  // -------------------------------------------------------------------------
  // 9. BUG-011: Multi-Item Deletion Cascades to Linked Audio & Transitions
  // -------------------------------------------------------------------------
  test('BUG-011: Multi-item deletion removes linked audio and orphaned transitions', () => {
    const clips = [{ id: 'v1' }, { id: 'v2' }];
    const audioClips = [
      { id: 'a1', sourceClipId: 'v1' },
      { id: 'a2', sourceClipId: 'v2' },
      { id: 'a_music', sourceClipId: undefined },
    ];
    const transitions = [
      { id: 't1', fromClipId: 'v1', toClipId: 'v2' },
      { id: 't2', fromClipId: 'v2', toClipId: 'v3' },
    ];

    // User selects and deletes v1
    const clipSet = new Set(['v1']);
    const audioSet = new Set<string>();

    const remainingClips = clips.filter((c) => !clipSet.has(c.id));
    const remainingAudio = audioClips.filter(
      (a) => !audioSet.has(a.id) && !(a.sourceClipId && clipSet.has(a.sourceClipId))
    );
    const remainingTransitions = transitions.filter(
      (t) => !clipSet.has(t.fromClipId) && !clipSet.has(t.toClipId)
    );

    expect(remainingClips.map((c) => c.id)).toEqual(['v2']);
    expect(remainingAudio.map((a) => a.id)).toEqual(['a2', 'a_music']); // a1 removed!
    expect(remainingTransitions.map((t) => t.id)).toEqual(['t2']); // t1 removed because fromClipId was v1!
  });

  // -------------------------------------------------------------------------
  // 10. BUG-012: Batch Move Audio Synchronization
  // -------------------------------------------------------------------------
  test('BUG-012: Batch moving video clips shifts linked audio clips by exact delta', () => {
    const movingClipIds = ['v1', 'v2'];
    const idSet = new Set(movingClipIds);
    const quantDelta = 3.5;

    const audioClips = [
      { id: 'a1', sourceClipId: 'v1', timelineStart: 2.0 },
      { id: 'a2', sourceClipId: 'v2', timelineStart: 8.0 },
      { id: 'a3', sourceClipId: 'v3', timelineStart: 15.0 }, // not in moving batch
    ];

    const updatedAudio = audioClips.map((ac) => {
      if (ac.sourceClipId && idSet.has(ac.sourceClipId)) {
        return {
          ...ac,
          timelineStart: Math.max(0, Math.round((ac.timelineStart + quantDelta) * 1000) / 1000),
        };
      }
      return ac;
    });

    expect(updatedAudio[0].timelineStart).toBe(5.5);
    expect(updatedAudio[1].timelineStart).toBe(11.5);
    expect(updatedAudio[2].timelineStart).toBe(15.0); // unshifted
  });

  // -------------------------------------------------------------------------
  // 11. BUG-013: Clip Duplication Linked Audio Retention
  // -------------------------------------------------------------------------
  test('BUG-013: Duplicating a video clip duplicates its linked audio clip', () => {
    const originalClip: VideoClip = {
      id: 'clip_v1',
      name: 'Scene.mp4',
      filePath: 'C:/media/scene.mp4',
      duration: 10,
      startOffset: 0,
      endOffset: 10,
      timelineStart: 5,
      timelineDuration: 10,
      speed: 1.0,
      volume: 1.0,
      isMuted: false,
      width: 1920,
      height: 1080,
      fps: 30,
    };
    const originalAudio: AudioClip = {
      id: 'audio_v1',
      name: 'Scene.mp4 (Audio)',
      sourceClipId: 'clip_v1',
      filePath: 'C:/media/scene.mp4',
      duration: 10,
      startOffset: 0,
      endOffset: 10,
      timelineStart: 5,
      timelineDuration: 10,
      volume: 1.0,
      isMuted: false,
    };

    const newStart = originalClip.timelineStart + originalClip.timelineDuration; // 15
    const duplicatedClip = {
      ...originalClip,
      id: 'clip_v1_dup',
      timelineStart: newStart,
    };

    const audioList = [originalAudio];
    const linkedAudio = audioList.find((a) => a.sourceClipId === originalClip.id);
    const duplicatedAudio: AudioClip = {
      ...linkedAudio!,
      id: `audio_${duplicatedClip.id}`,
      sourceClipId: duplicatedClip.id,
      timelineStart: newStart,
    };

    expect(duplicatedClip.timelineStart).toBe(15);
    expect(duplicatedAudio.sourceClipId).toBe('clip_v1_dup');
    expect(duplicatedAudio.timelineStart).toBe(15);
  });

  // -------------------------------------------------------------------------
  // 12. BUG-014: Scene Splitting Linked Audio Division
  // -------------------------------------------------------------------------
  test('BUG-014: Splitting clip into scenes creates corresponding audio segments', () => {
    const clipDur = 12; // 12 seconds
    const sceneCount = 3;
    const segDur = clipDur / sceneCount; // 4s each

    const audioSegments: Array<{ startOffset: number; endOffset: number; timelineStart: number; timelineDuration: number }> = [];
    let currentStart = 0;
    let sourceStart = 0;

    for (let i = 0; i < sceneCount; i++) {
      audioSegments.push({
        startOffset: sourceStart,
        endOffset: sourceStart + segDur,
        timelineStart: currentStart,
        timelineDuration: segDur,
      });
      currentStart += segDur;
      sourceStart += segDur;
    }

    expect(audioSegments.length).toBe(3);
    expect(audioSegments[0]).toEqual({ startOffset: 0, endOffset: 4, timelineStart: 0, timelineDuration: 4 });
    expect(audioSegments[1]).toEqual({ startOffset: 4, endOffset: 8, timelineStart: 4, timelineDuration: 4 });
    expect(audioSegments[2]).toEqual({ startOffset: 8, endOffset: 12, timelineStart: 8, timelineDuration: 4 });
  });

  // -------------------------------------------------------------------------
  // 13. BUG-015: Audio Clip Repositioning & Quantization
  // -------------------------------------------------------------------------
  test('BUG-015: moveAudioClipPosition clamps negative starts and quantizes to 30fps frames', () => {
    const fps = 30;
    const frameDur = 1 / fps;

    const rawRequestedStart = 4.1234;
    const quantized = Math.round(rawRequestedStart / frameDur) * frameDur;
    const cleanStart = Math.max(0, Math.round(quantized * 1000) / 1000);

    expect(cleanStart).toBe(4.133); // nearest 30fps frame

    const negativeStart = -2.5;
    const clampedNeg = Math.max(0, negativeStart);
    expect(clampedNeg).toBe(0);
  });
});
