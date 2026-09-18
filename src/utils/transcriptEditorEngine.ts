import { ProjectData, VideoClip, AudioClip } from '../types/project';
import { CaptionLine, WordTimestamp } from '../types/caption';

export interface TranscriptSentence {
  id: string;
  captionId: string;
  text: string;
  start: number;
  end: number;
  words: WordTimestamp[];
}

export interface DetectedStumble {
  id: string;
  type: 'silence' | 'filler';
  label: string;
  start: number;
  end: number;
  duration: number;
}

/**
 * Build flat continuous transcript sentence blocks from project captions
 */
export function buildTranscriptSentences(captions: CaptionLine[]): TranscriptSentence[] {
  return captions.map((cap) => {
    return {
      id: `sent_${cap.id}`,
      captionId: cap.id,
      text: cap.text,
      start: cap.start,
      end: cap.end,
      words: cap.words && cap.words.length > 0 ? cap.words : [
        { id: `w_${cap.id}`, word: cap.text, start: cap.start, end: cap.end, confidence: 1.0 }
      ],
    };
  });
}

/**
 * Detect silence gaps > 0.4s between words and filler phrases ("uh", "um", "ah", "like")
 */
export function detectStumblesAndSilences(captions: CaptionLine[]): DetectedStumble[] {
  const stumbles: DetectedStumble[] = [];
  const fillerRegex = /^(uh|um|er|ah|like|you know)$/i;

  for (let i = 0; i < captions.length; i++) {
    const current = captions[i];

    // Check gap before next caption
    if (i < captions.length - 1) {
      const next = captions[i + 1];
      const gap = next.start - current.end;
      if (gap >= 0.45) {
        stumbles.push({
          id: `stumble_gap_${i}`,
          type: 'silence',
          label: `Silence (${gap.toFixed(1)}s)`,
          start: current.end,
          end: next.start,
          duration: gap,
        });
      }
    }

    // Check filler words within words list
    if (current.words) {
      for (let w = 0; w < current.words.length; w++) {
        const wordObj = current.words[w];
        if (fillerRegex.test(wordObj.word.trim())) {
          stumbles.push({
            id: `stumble_filler_${current.id}_${w}`,
            type: 'filler',
            label: `Filler "${wordObj.word}"`,
            start: wordObj.start,
            end: wordObj.end,
            duration: wordObj.end - wordObj.start,
          });
        }
      }
    }
  }

  return stumbles;
}

/**
 * Text-Driven Video Ripple Delete:
 * Slices and deletes any video, audio, or caption data between cutStart and cutEnd,
 * and shifts all subsequent media back by cutDuration to close the gap seamlessly.
 */
export function rippleDeleteTimeRangeFromProject(
  project: ProjectData,
  cutStart: number,
  cutEnd: number
): ProjectData {
  const cutDuration = Math.max(0, cutEnd - cutStart);
  if (cutDuration <= 0.01) return project;

  // 1. Process Video Clips (all tracks)
  const newClips: VideoClip[] = [];

  for (const clip of project.clips) {
    const clipStart = clip.timelineStart;
    const clipEnd = clip.timelineStart + clip.timelineDuration;

    if (clipEnd <= cutStart + 0.01) {
      // Entirely before cut: keep intact
      newClips.push(clip);
    } else if (clipStart >= cutEnd - 0.01) {
      // Entirely after cut: shift back by cutDuration
      newClips.push({
        ...clip,
        timelineStart: Math.max(0, Math.round((clip.timelineStart - cutDuration) * 1000) / 1000),
      });
    } else {
      // Overlaps cut range
      const speed = clip.speed || 1.0;

      // Part 1: before cutStart (if significant)
      if (cutStart > clipStart + 0.03) {
        const part1Dur = cutStart - clipStart;
        newClips.push({
          ...clip,
          id: `clip_${Date.now()}_a_${Math.random().toString(36).substring(7)}`,
          startOffset: clip.startOffset,
          endOffset: Math.round((clip.startOffset + part1Dur * speed) * 1000) / 1000,
          timelineStart: clipStart,
          timelineDuration: Math.round(part1Dur * 1000) / 1000,
        });
      }

      // Part 2: after cutEnd (if significant)
      if (cutEnd < clipEnd - 0.03) {
        const offsetIntoClip = (cutEnd - clipStart) * speed;
        const part2Dur = clipEnd - cutEnd;
        newClips.push({
          ...clip,
          id: `clip_${Date.now()}_b_${Math.random().toString(36).substring(7)}`,
          startOffset: Math.round((clip.startOffset + offsetIntoClip) * 1000) / 1000,
          endOffset: clip.endOffset,
          timelineStart: Math.max(0, Math.round(cutStart * 1000) / 1000),
          timelineDuration: Math.round(part2Dur * 1000) / 1000,
        });
      }
    }
  }

  // 2. Process Audio Clips (all tracks)
  const newAudioClips: AudioClip[] = [];

  for (const audio of project.audioClips || []) {
    const audioStart = audio.timelineStart;
    const audioEnd = audio.timelineStart + audio.timelineDuration;

    if (audioEnd <= cutStart + 0.01) {
      newAudioClips.push(audio);
    } else if (audioStart >= cutEnd - 0.01) {
      newAudioClips.push({
        ...audio,
        timelineStart: Math.max(0, Math.round((audio.timelineStart - cutDuration) * 1000) / 1000),
      });
    } else {
      // Overlaps cut range
      if (cutStart > audioStart + 0.03) {
        const part1Dur = cutStart - audioStart;
        newAudioClips.push({
          ...audio,
          id: `audio_${Date.now()}_a_${Math.random().toString(36).substring(7)}`,
          startOffset: audio.startOffset,
          endOffset: Math.round((audio.startOffset + part1Dur) * 1000) / 1000,
          timelineStart: audioStart,
          timelineDuration: Math.round(part1Dur * 1000) / 1000,
        });
      }

      if (cutEnd < audioEnd - 0.03) {
        const offsetIntoAudio = cutEnd - audioStart;
        const part2Dur = audioEnd - cutEnd;
        newAudioClips.push({
          ...audio,
          id: `audio_${Date.now()}_b_${Math.random().toString(36).substring(7)}`,
          startOffset: Math.round((audio.startOffset + offsetIntoAudio) * 1000) / 1000,
          endOffset: audio.endOffset,
          timelineStart: Math.max(0, Math.round(cutStart * 1000) / 1000),
          timelineDuration: Math.round(part2Dur * 1000) / 1000,
        });
      }
    }
  }

  // 3. Process Captions with Word-by-Word Precision
  const newCaptions: CaptionLine[] = [];

  for (const cap of project.captions || []) {
    if (cap.end <= cutStart + 0.02) {
      // Entirely before cut
      newCaptions.push(cap);
    } else if (cap.start >= cutEnd - 0.02) {
      // Entirely after cut: shift back by cutDuration
      newCaptions.push({
        ...cap,
        start: Math.max(0, Math.round((cap.start - cutDuration) * 1000) / 1000),
        end: Math.max(0.1, Math.round((cap.end - cutDuration) * 1000) / 1000),
        words: (cap.words || []).map((w) => ({
          ...w,
          start: Math.max(0, Math.round((w.start - cutDuration) * 1000) / 1000),
          end: Math.max(0.1, Math.round((w.end - cutDuration) * 1000) / 1000),
        })),
      });
    } else {
      // Overlaps cut range: filter out words inside [cutStart, cutEnd]
      const rawWords = cap.words && cap.words.length > 0
        ? cap.words
        : cap.text.split(/\s+/).map((w, idx, arr) => {
            const dur = (cap.end - cap.start) / Math.max(1, arr.length);
            return {
              id: `w_${cap.id}_${idx}`,
              word: w,
              start: cap.start + idx * dur,
              end: cap.start + (idx + 1) * dur,
            };
          });

      const remainingWords: WordTimestamp[] = [];

      for (const w of rawWords) {
        if (w.end <= cutStart + 0.02) {
          // Word before cut: keep untouched
          remainingWords.push(w);
        } else if (w.start >= cutEnd - 0.02) {
          // Word after cut: shift back
          remainingWords.push({
            ...w,
            start: Math.max(0, Math.round((w.start - cutDuration) * 1000) / 1000),
            end: Math.max(0.1, Math.round((w.end - cutDuration) * 1000) / 1000),
          });
        }
        // Words strictly inside [cutStart, cutEnd] are dropped
      }

      if (remainingWords.length > 0) {
        newCaptions.push({
          ...cap,
          start: remainingWords[0].start,
          end: remainingWords[remainingWords.length - 1].end,
          text: remainingWords.map((w) => w.word).join(' ').trim(),
          words: remainingWords,
        });
      }
    }
  }

  // 4. Process Overlays
  const newOverlays = (project.overlays || []).map((ov) => {
    if (ov.timelineStart + ov.timelineDuration <= cutStart) {
      return ov;
    } else if (ov.timelineStart >= cutEnd) {
      return {
        ...ov,
        timelineStart: Math.max(0, Math.round((ov.timelineStart - cutDuration) * 1000) / 1000),
      };
    }
    return {
      ...ov,
      timelineDuration: Math.max(0.2, Math.round((ov.timelineDuration - cutDuration) * 1000) / 1000),
    };
  });

  // 5. Calculate new project duration
  const maxClipEnd = newClips.reduce((max, c) => Math.max(max, c.timelineStart + c.timelineDuration), 0);
  const maxAudioEnd = newAudioClips.reduce((max, a) => Math.max(max, a.timelineStart + a.timelineDuration), 0);
  const newDuration = Math.max(1, Math.max(maxClipEnd, maxAudioEnd));

  return {
    ...project,
    metadata: {
      ...project.metadata,
      duration: Math.round(newDuration * 1000) / 1000,
      updatedAt: new Date().toISOString(),
    },
    clips: newClips,
    audioClips: newAudioClips,
    captions: newCaptions,
    overlays: newOverlays,
  };
}
