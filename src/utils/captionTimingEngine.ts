import { CaptionLine, WordTimestamp } from '../types/caption';
import { sanitizeTime } from './timecode';

// =========================================================================
// CAPTION TIMING ENGINE — Two-Stage Pipeline + Validator + Normalizer
// Goal: NEVER let AI-generated caption duration exceed real media duration.
// =========================================================================

export interface TimingValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fixedCaptions: CaptionLine[];
}

export interface QualityCheckResult {
  emptyCaptions: number;
  overlapping: number;
  beyondMedia: number;
  veryShort: number; // <0.25s
  veryLong: number;  // >8s
  invalidTimestamps: number;
  nanEntries: number;
  markEstimated: boolean;
}

// Canonical frame quantization (30fps default, pass project fps)
export function quantizeToFrame(t: number, fps: number = 30): number {
  if (!isFinite(t)) return 0;
  const frameDur = 1 / fps;
  return Math.round(t / frameDur) * frameDur;
}

// Clamp helper
function clamp(v: number, min: number, max: number) {
  if (!isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

// -------------------------------------------------------------------------
// FALLBACK: Estimate word timing proportionally within parent caption
// Marks each word as estimated (isCustomEdited=false + confidence 0.5)
// -------------------------------------------------------------------------
export function estimateWordTimingFallback(
  text: string,
  capStart: number,
  capEnd: number
): WordTimestamp[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const totalDur = Math.max(0.2, capEnd - capStart);
  // Weight by char length for slightly more natural distribution vs equal division
  const totalChars = words.reduce((s, w) => s + w.length, 0);
  let cursor = capStart;
  return words.map((w, idx) => {
    const ratio = w.length / totalChars;
    // Allocate duration proportional to length, with min 0.15s per word, max 0.8s
    let dur = totalDur * ratio;
    dur = clamp(dur, 0.15, 0.8);
    // On last word, snap to capEnd to avoid drift
    let start = cursor;
    let end = idx === words.length - 1 ? capEnd : cursor + dur;
    // Normalize to 0.01 precision
    start = Math.round(start * 100) / 100;
    end = Math.round(end * 100) / 100;
    if (end <= start) end = Math.round((start + 0.2) * 100) / 100;
    cursor = end;
    return {
      id: `w_est_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 4)}`,
      word: w,
      start,
      end,
      confidence: 0.5,
      isCustomEdited: false,
    };
  });
}

// -------------------------------------------------------------------------
// Fix word timestamps inside parent: ensure start<end, inside parent bounds,
// ordered, no NaN, no negative, propagate parent clamping
// -------------------------------------------------------------------------
export function normalizeWordTimings(
  words: WordTimestamp[],
  parentStart: number,
  parentEnd: number,
  fps: number = 30
): WordTimestamp[] {
  if (!words || words.length === 0) return [];

  const pStart = quantizeToFrame(clamp(parentStart, 0, 86400), fps);
  const pEnd = quantizeToFrame(clamp(parentEnd, pStart + 0.1, 86400), fps);
  const pDur = Math.max(0.2, pEnd - pStart);

  // First, sanitize each word
  let sanitized: WordTimestamp[] = words.map((w, idx) => {
    let s = sanitizeTime(w.start, pStart + idx * (pDur / words.length));
    let e = sanitizeTime(w.end, s + pDur / words.length);
    if (!isFinite(s) || isNaN(s)) s = pStart;
    if (!isFinite(e) || isNaN(e)) e = s + 0.2;
    s = quantizeToFrame(s, fps);
    e = quantizeToFrame(e, fps);
    if (e <= s) e = Math.round((s + 0.2) * 100) / 100;
    // Clamp inside parent
    s = clamp(s, pStart, pEnd - 0.05);
    e = clamp(e, s + 0.05, pEnd);
    return { ...w, start: Math.round(s * 100) / 100, end: Math.round(e * 100) / 100 };
  });

  // Sort by start
  sanitized.sort((a, b) => a.start - b.start);

  // Fix overlaps and gaps: ensure strictly increasing and no gaps >0.01 drift compensation
  for (let i = 1; i < sanitized.length; i++) {
    const prev = sanitized[i - 1];
    const cur = sanitized[i];
    if (cur.start < prev.end + 0.005) {
      // Overlap — push cur start to prev.end
      const dur = cur.end - cur.start;
      cur.start = Math.round(prev.end * 100) / 100;
      cur.end = Math.round((cur.start + Math.max(0.12, dur)) * 100) / 100;
      if (cur.end > pEnd) {
        cur.end = pEnd;
        cur.start = Math.max(pStart, Math.round((cur.end - Math.max(0.12, dur)) * 100) / 100);
      }
    }
  }

  // Ensure last word ends at parent end (no drift beyond), first starts at parent start if close
  if (sanitized.length > 0) {
    if (sanitized[0].start - pStart > 0.15) {
      // If first word starts noticeably after parent, keep it — speech may have leading silence
    } else {
      sanitized[0].start = pStart;
    }
    const last = sanitized[sanitized.length - 1];
    if (pEnd - last.end > 0.15) {
      // Keep trailing gap if intentional? clamp to parent if small
      if (pEnd - last.end < 0.4) last.end = pEnd;
    } else {
      last.end = pEnd;
    }
  }

  // Re-quantize and ensure start<end
  sanitized = sanitized.map((w) => ({
    ...w,
    start: Math.round(quantizeToFrame(w.start, fps) * 100) / 100,
    end: Math.round(quantizeToFrame(w.end, fps) * 100) / 100,
  }));

  return sanitized.filter((w) => isFinite(w.start) && isFinite(w.end) && w.end > w.start);
}

// -------------------------------------------------------------------------
// MAIN NORMALIZER — ensures all 8 validation conditions
// -------------------------------------------------------------------------
export function normalizeCaptionTimings(
  captions: CaptionLine[],
  mediaDuration: number,
  fps: number = 30
): CaptionLine[] {
  if (!captions || captions.length === 0) return [];

  const mediaEnd = quantizeToFrame(clamp(mediaDuration, 0.5, 86400), fps);
  const mediaStart = 0;

  // Step 1: Sanitize and clamp each caption
  let normalized: CaptionLine[] = captions.map((cap) => {
    let s = sanitizeTime(cap.start, 0);
    let e = sanitizeTime(cap.end, s + 0.5);
    if (!isFinite(s)) s = 0;
    if (!isFinite(e) || isNaN(e)) e = s + 0.8;
    s = quantizeToFrame(clamp(s, mediaStart, mediaEnd), fps);
    e = quantizeToFrame(clamp(e, s + 0.1, mediaEnd), fps);
    if (e <= s) e = Math.round((s + 0.4) * 100) / 100;
    if (e > mediaEnd) e = mediaEnd;
    if (s >= e) s = Math.max(mediaStart, Math.round((e - 0.4) * 100) / 100);

    let words = cap.words && cap.words.length > 0 ? [...cap.words] : estimateWordTimingFallback(cap.text || '', s, e);

    // Mark estimated if we had to synthesize
    if (!cap.words || cap.words.length === 0) {
      words = words.map((w) => ({ ...w, confidence: 0.5 }));
    }

    // Ensure words inside parent
    words = normalizeWordTimings(words, s, e, fps);

    // Re-derive caption bounds from words if words exist (keeps consistency)
    if (words.length > 0) {
      const wStart = Math.min(...words.map((w) => w.start));
      const wEnd = Math.max(...words.map((w) => w.end));
      // If parent was significantly larger than word span, keep parent but ensure words fit
      // Else snap parent to word span
      const wordSpan = wEnd - wStart;
      const parentSpan = e - s;
      if (Math.abs(wordSpan - parentSpan) > 0.3) {
        // Keep parent, but clamp words already done
      } else {
        s = wStart;
        e = wEnd;
      }
    }

    // Ensure text matches words if text was empty or mismatched
    let text = cap.text || '';
    if (!text.trim() && words.length > 0) {
      text = words.map((w) => w.word).join(' ');
    }

    return {
      ...cap,
      start: Math.round(s * 100) / 100,
      end: Math.round(e * 100) / 100,
      text: text.trim(),
      words,
    };
  });

  // Step 2: Sort chronologically
  normalized.sort((a, b) => a.start - b.start);

  // Step 3: Fix overlaps and gaps — no cumulative drift
  for (let i = 1; i < normalized.length; i++) {
    const prev = normalized[i - 1];
    const cur = normalized[i];
    // Overlap
    if (cur.start < prev.end - 0.005) {
      const overlap = prev.end - cur.start;
      // Push cur forward by overlap, keep duration
      const dur = cur.end - cur.start;
      const newStart = Math.round(prev.end * 100) / 100;
      let newEnd = Math.round((newStart + dur) * 100) / 100;
      if (newEnd > mediaEnd) {
        newEnd = mediaEnd;
        // If we would exceed media, shrink duration instead of pushing beyond
        const newDur = Math.max(0.2, newEnd - newStart);
        // Also shrink words proportionally
        const wDur = cur.words.length > 0 ? newDur / cur.words.length : newDur;
        cur.words = cur.words.map((w, idx) => ({
          ...w,
          start: Math.round((newStart + idx * wDur) * 100) / 100,
          end: Math.round((newStart + (idx + 1) * wDur) * 100) / 100,
        }));
        cur.start = newStart;
        cur.end = Math.round((newStart + newDur) * 100) / 100;
      } else {
        // Shift words by delta
        const delta = newStart - cur.start;
        cur.words = cur.words.map((w) => ({
          ...w,
          start: Math.round((w.start + delta) * 100) / 100,
          end: Math.round((w.end + delta) * 100) / 100,
        }));
        cur.words = normalizeWordTimings(cur.words, newStart, newEnd, fps);
        cur.start = newStart;
        cur.end = newEnd;
      }
    } else if (cur.start - prev.end > 0.4) {
      // Large gap >0.4s — keep it (could be silence). But if it's >1.5s and words are short, it's likely drift — keep as is for natural pause
      // Do not auto-compact gaps; preserves speech rhythm
    }
  }

  // Step 4: Ensure no caption beyond mediaEnd — trim or re-scale if needed
  const lastIdx = normalized.length - 1;
  if (lastIdx >= 0 && normalized[lastIdx].end > mediaEnd) {
    const last = normalized[lastIdx];
    const dur = last.end - last.start;
    last.end = mediaEnd;
    last.start = Math.max(0, Math.round((mediaEnd - Math.max(0.2, dur)) * 100) / 100);
    last.words = normalizeWordTimings(last.words, last.start, last.end, fps);
  }

  // Step 5: Remove invalid / empty
  normalized = normalized.filter(
    (c) => isFinite(c.start) && isFinite(c.end) && c.end > c.start && c.text.trim().length > 0 && c.words.length > 0
  );

  // Step 6: Re-quantize all to frame
  normalized = normalized.map((c) => ({
    ...c,
    start: Math.round(quantizeToFrame(c.start, fps) * 100) / 100,
    end: Math.round(quantizeToFrame(c.end, fps) * 100) / 100,
    words: c.words.map((w) => ({
      ...w,
      start: Math.round(quantizeToFrame(w.start, fps) * 100) / 100,
      end: Math.round(quantizeToFrame(w.end, fps) * 100) / 100,
    })),
  }));

  // Final sort
  normalized.sort((a, b) => a.start - b.start);

  return normalized;
}

// -------------------------------------------------------------------------
// VALIDATOR — checks all 8 conditions + returns fixed version
// -------------------------------------------------------------------------
export function validateCaptionTimings(
  captions: CaptionLine[],
  mediaDuration: number,
  fps: number = 30
): TimingValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!captions || captions.length === 0) {
    return { isValid: true, errors, warnings: ['No captions to validate'], fixedCaptions: [] };
  }

  const mediaEnd = clamp(mediaDuration, 0.5, 86400);

  captions.forEach((cap, idx) => {
    if (!isFinite(cap.start) || !isFinite(cap.end) || isNaN(cap.start) || isNaN(cap.end)) {
      errors.push(`Caption ${idx} (${cap.id}): NaN/Infinity timestamps`);
    }
    if (cap.start < 0) errors.push(`Caption ${idx}: start < 0 (${cap.start})`);
    if (cap.end > mediaEnd + 0.01) errors.push(`Caption ${idx}: end ${cap.end} > mediaEnd ${mediaEnd}`);
    if (cap.start >= cap.end) errors.push(`Caption ${idx}: start >= end (${cap.start} >= ${cap.end})`);
    if (cap.end - cap.start < 0.05) warnings.push(`Caption ${idx}: very short (${(cap.end - cap.start).toFixed(3)}s)`);
    if (cap.end - cap.start > 8) warnings.push(`Caption ${idx}: very long (${(cap.end - cap.start).toFixed(2)}s)`);

    // Word checks
    if (!cap.words || cap.words.length === 0) warnings.push(`Caption ${idx}: no words`);
    else {
      cap.words.forEach((w, wIdx) => {
        if (!isFinite(w.start) || !isFinite(w.end)) errors.push(`Caption ${idx} word ${wIdx}: NaN`);
        if (w.start >= w.end) errors.push(`Caption ${idx} word ${wIdx}: start >= end`);
        if (w.start < cap.start - 0.02 || w.end > cap.end + 0.02) errors.push(`Caption ${idx} word ${wIdx}: outside parent (${w.start}-${w.end} not in ${cap.start}-${cap.end})`);
        if (w.start < 0 || w.end > mediaEnd + 0.01) errors.push(`Caption ${idx} word ${wIdx}: outside media`);
      });
      // Overlap / order
      const sorted = [...cap.words].sort((a, b) => a.start - b.start);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].start < sorted[i - 1].end - 0.005) warnings.push(`Caption ${idx}: word ${i} overlaps previous`);
      }
    }
  });

  // Chronological order and gaps
  for (let i = 1; i < captions.length; i++) {
    if (captions[i].start < captions[i - 1].start) errors.push(`Caption ${i}: out of order`);
    if (captions[i].start < captions[i - 1].end - 0.01) warnings.push(`Caption ${i}: overlaps previous caption`);
    if (captions[i].start - captions[i - 1].end > 2) warnings.push(`Caption ${i}: large gap ${(captions[i].start - captions[i - 1].end).toFixed(2)}s`);
  }

  const fixedCaptions = normalizeCaptionTimings(captions, mediaDuration, fps);
  const isValid = errors.length === 0;

  return { isValid, errors, warnings, fixedCaptions };
}

// -------------------------------------------------------------------------
// QUALITY CHECK
// -------------------------------------------------------------------------
export function runCaptionQualityCheck(
  captions: CaptionLine[],
  mediaDuration: number
): QualityCheckResult {
  let emptyCaptions = 0;
  let overlapping = 0;
  let beyondMedia = 0;
  let veryShort = 0;
  let veryLong = 0;
  let invalidTimestamps = 0;
  let nanEntries = 0;
  let markEstimated = false;

  captions.forEach((cap) => {
    if (!cap.text.trim()) emptyCaptions++;
    if (!isFinite(cap.start) || !isFinite(cap.end) || isNaN(cap.start) || isNaN(cap.end)) { invalidTimestamps++; nanEntries++; }
    if (cap.start >= cap.end) invalidTimestamps++;
    if (cap.end > mediaDuration + 0.01) beyondMedia++;
    const dur = cap.end - cap.start;
    if (dur < 0.25) veryShort++;
    if (dur > 8) veryLong++;
    cap.words?.forEach((w) => {
      if (!isFinite(w.start) || !isFinite(w.end) || isNaN(w.start) || isNaN(w.end)) { nanEntries++; invalidTimestamps++; }
      if (w.confidence !== undefined && w.confidence < 0.6) markEstimated = true;
    });
  });

  for (let i = 1; i < captions.length; i++) {
    if (captions[i].start < captions[i - 1].end - 0.01) overlapping++;
  }

  return { emptyCaptions, overlapping, beyondMedia, veryShort, veryLong, invalidTimestamps, nanEntries, markEstimated };
}

// -------------------------------------------------------------------------
// TWO-STAGE PIPELINE HELPER — call after Gemini, before saving to project
// Validates and calibrates against real media duration + fps
// -------------------------------------------------------------------------
export function processGeminiCaptionsThroughTimingEngine(
  rawCaptions: CaptionLine[],
  mediaDuration: number,
  fps: number = 30,
  options?: { trimBeyondMedia?: boolean; estimateFallback?: boolean }
): { captions: CaptionLine[]; validation: TimingValidationResult; quality: QualityCheckResult } {
  let caps = [...rawCaptions];

  // Ensure each caption has words; if missing, fallback
  caps = caps.map((cap) => {
    if (!cap.words || cap.words.length === 0) {
      const est = estimateWordTimingFallback(cap.text || '', cap.start, cap.end);
      return { ...cap, words: est };
    }
    return cap;
  });

  const validation = validateCaptionTimings(caps, mediaDuration, fps);
  caps = validation.fixedCaptions;

  // Final safety: hard clamp any remaining beyond media
  caps = caps.map((cap) => {
    let s = clamp(cap.start, 0, mediaDuration);
    let e = clamp(cap.end, s + 0.1, mediaDuration);
    if (e - s < 0.1) e = Math.min(mediaDuration, s + 0.25);
    let words = normalizeWordTimings(cap.words, s, e, fps);
    return { ...cap, start: Math.round(s * 100) / 100, end: Math.round(e * 100) / 100, words };
  }).filter((c) => c.end > c.start && c.end <= mediaDuration + 0.01);

  caps.sort((a, b) => a.start - b.start);

  const quality = runCaptionQualityCheck(caps, mediaDuration);

  return { captions: caps, validation, quality };
}

// -------------------------------------------------------------------------
// SEGMENTATION HELPERS — sensible caps splitting (max words/chars, reading speed)
// -------------------------------------------------------------------------
export function segmentCaptionsByRules(
  captions: CaptionLine[],
  maxWords: number = 4,
  maxChars: number = 28,
  maxDuration: number = 3.5
): CaptionLine[] {
  const out: CaptionLine[] = [];
  for (const cap of captions) {
    const words = cap.words || [];
    if (words.length <= maxWords && cap.text.length <= maxChars && cap.end - cap.start <= maxDuration) {
      out.push(cap);
      continue;
    }
    // Need to split
    let idx = 0;
    while (idx < words.length) {
      const chunk = words.slice(idx, idx + maxWords);
      // Also enforce char limit
      let charCount = 0;
      let take = 0;
      for (let j = 0; j < chunk.length; j++) {
        charCount += chunk[j].word.length + 1;
        if (charCount > maxChars && j > 0) break;
        take++;
      }
      const actualChunk = chunk.slice(0, Math.max(1, take));
      const cStart = actualChunk[0].start;
      const cEnd = actualChunk[actualChunk.length - 1].end;
      out.push({
        id: `cap_seg_${Date.now()}_${out.length}_${Math.random().toString(36).slice(2, 4)}`,
        start: cStart,
        end: cEnd,
        text: actualChunk.map((w) => w.word).join(' '),
        words: actualChunk,
        splitHookIndex: actualChunk.length > 1 ? 1 : undefined,
      });
      idx += actualChunk.length;
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

// -------------------------------------------------------------------------
// TEXT EDIT PRESERVATION — when user edits caption text, preserve timing where possible
// -------------------------------------------------------------------------
export function preserveTimingOnTextEdit(
  original: CaptionLine,
  newText: string,
  fps: number = 30
): CaptionLine {
  const oldWords = original.words || [];
  const newWordsStr = newText.trim().split(/\s+/).filter(Boolean);
  if (newWordsStr.length === 0) {
    return { ...original, text: newText, words: [] };
  }
  if (oldWords.length === 0) {
    const est = estimateWordTimingFallback(newText, original.start, original.end);
    const words = normalizeWordTimings(est, original.start, original.end, fps);
    return { ...original, text: newText, words };
  }

  // Try to map old timings to new words where word strings match
  const oldMap = new Map<string, WordTimestamp[]>();
  oldWords.forEach((w) => {
    const key = w.word.toLowerCase().replace(/[^\w]/g, '');
    if (!oldMap.has(key)) oldMap.set(key, []);
    oldMap.get(key)!.push(w);
  });

  const totalDur = original.end - original.start;
  let newWords: WordTimestamp[] = [];
  let cursor = original.start;
  const fallbackDur = totalDur / newWordsStr.length;

  for (let i = 0; i < newWordsStr.length; i++) {
    const nw = newWordsStr[i];
    const key = nw.toLowerCase().replace(/[^\w]/g, '');
    const candidates = oldMap.get(key);
    let w: WordTimestamp | null = null;
    if (candidates && candidates.length > 0) {
      w = candidates.shift()!;
      // Reuse timing but adjust to be within new sequence if needed
    }
    if (w) {
      newWords.push({ ...w, word: nw, isCustomEdited: true });
    } else {
      // No match — estimate proportionally
      const dur = fallbackDur;
      const start = cursor;
      const end = i === newWordsStr.length - 1 ? original.end : cursor + dur;
      newWords.push({
        id: `w_edit_${Date.now()}_${i}`,
        word: nw,
        start: Math.round(start * 100) / 100,
        end: Math.round(end * 100) / 100,
        confidence: 0.5,
      });
      cursor = end;
    }
  }

  // Re-normalize to ensure no overlaps and proper parent fit
  newWords = normalizeWordTimings(newWords, original.start, original.end, fps);

  return { ...original, text: newText, words: newWords };
}
