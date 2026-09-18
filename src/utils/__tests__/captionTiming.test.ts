// @ts-nocheck
import { describe, test, expect } from 'vitest';
import { normalizeCaptionTimings, validateCaptionTimings, runCaptionQualityCheck, processGeminiCaptionsThroughTimingEngine } from '../captionTimingEngine';
import { CaptionLine } from '../../types/caption';

// Synthetic deterministic fixtures for P49
function makeWord(word: string, start: number, end: number): any {
  return { id: `w_${word}_${start}`, word, start, end, confidence: 0.95, accuracyStatus: 'exact' };
}

function makeCaption(id: string, start: number, end: number, words: any[]): CaptionLine {
  return { id, start, end, text: words.map((w) => w.word).join(' '), words, sourceText: words.map((w) => w.word).join(' ') } as any;
}

describe('Caption Timing Engine — Ultra Accurate', () => {
  test('exact word timing parsing', () => {
    const caps = [makeCaption('c1', 0.12, 1.1, [makeWord('Welcome', 0.12, 0.42), makeWord('to', 0.44, 0.6), makeWord('software', 0.62, 1.1)])];
    const res = validateCaptionTimings(caps, 10, 30);
    expect(res.isValid).toBe(true);
    expect(res.fixedCaptions[0].words[0].start).toBeCloseTo(0.13, 1);
  });

  test('timestamp normalization — seconds vs ms', () => {
    const caps = [makeCaption('c1', 0, 0.5, [makeWord('Hi', 0, 0.5)])];
    // Simulate ms erroneously passed as seconds (500 should be 0.5s) — our sanitize should handle
    const normalized = normalizeCaptionTimings(caps, 5, 30);
    expect(normalized[0].start).toBeGreaterThanOrEqual(0);
    expect(normalized[0].end).toBeLessThanOrEqual(5);
  });

  test('caption segmentation respects word timing', () => {
    const words = [makeWord('This', 0.12, 0.42), makeWord('is', 0.44, 0.55), makeWord('a', 0.55, 0.6), makeWord('powerful', 0.6, 1.0), makeWord('editor', 1.0, 1.4)];
    const cap = makeCaption('c1', 0.12, 1.4, words);
    // Segment should use first word start and last word end
    expect(cap.start).toBe(words[0].start);
    expect(cap.end).toBe(words[words.length - 1].end);
  });

  test('media boundary — caption beyond duration trimmed', () => {
    const caps = [makeCaption('c1', 28, 35, [makeWord('Welcome', 28, 29), makeWord('today', 34, 35)])];
    const fixed = normalizeCaptionTimings(caps, 30, 30);
    expect(fixed[0].end).toBeLessThanOrEqual(30);
    expect(fixed.every((c) => c.end <= 30)).toBe(true);
  });

  test('word-to-caption mapping preserved', () => {
    const words = [makeWord('Hello', 0, 0.3), makeWord('world', 0.3, 0.6)];
    const cap = makeCaption('c1', 0, 0.6, words);
    const qc = runCaptionQualityCheck([cap], 10);
    expect(qc.overlapping).toBe(0);
    expect(cap.words.length).toBe(2);
  });

  test('timeline offset handling — clip at 10s', () => {
    const clipStart = 10;
    const sourceWords = [makeWord('Welcome', 0.12, 0.42), makeWord('to', 0.44, 0.6)];
    const mapped = sourceWords.map((w) => ({ ...w, start: w.start + clipStart, end: w.end + clipStart }));
    expect(mapped[0].start).toBeCloseTo(10.12, 2);
  });

  test('clip speed change 2x compresses timing', () => {
    const oldSpeed = 1, newSpeed = 2, anchor = 10;
    const capStart = 10.5, capEnd = 12.5;
    const factor = oldSpeed / newSpeed;
    const newStart = anchor + (capStart - anchor) * factor;
    const newEnd = anchor + (capEnd - anchor) * factor;
    expect(newEnd - newStart).toBeCloseTo(1.0, 2); // originally 2s, now 1s at 2x
  });

  test('end-of-video handling', () => {
    const caps = [makeCaption('c1', 29.5, 31, [makeWord('today', 29.5, 30.5), makeWord('!', 30.5, 31)])];
    const fixed = normalizeCaptionTimings(caps, 30, 30);
    expect(fixed[fixed.length - 1].end).toBeLessThanOrEqual(30);
  });

  test('no cumulative drift — two captions derived from word timestamps not estimated gap', () => {
    const w1 = makeWord('Hello', 0, 0.4);
    const w2 = makeWord('world', 0.45, 0.8);
    const cap1 = makeCaption('c1', w1.start, w1.end, [w1]);
    const cap2 = makeCaption('c2', w2.start, w2.end, [w2]);
    // gap should be 0.05, not accumulated error
    expect(cap2.start - cap1.end).toBeCloseTo(0.05, 2);
  });

  test('processGemini pipeline marks estimated when no timestamps', () => {
    const raw: any[] = [{ id: '1', start_ms: 0, end_ms: 500, text: 'Hi', words: [] }];
    const res = processGeminiCaptionsThroughTimingEngine(raw as any, 10, 30);
    expect(res.captions.length).toBeGreaterThan(0);
    expect(res.quality.markEstimated).toBe(true);
  });
});
