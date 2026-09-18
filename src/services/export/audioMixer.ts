import { ProjectData } from '../../types/project';
import { audioProcessor } from '../audio/audioProcessor';

// In-memory cache for decoded AudioBuffers to prevent redundant network fetches/decoding during export
const audioBufferCache = new Map<string, AudioBuffer>();

/**
 * Fetches and decodes audio from a URL/BlobURL into an AudioBuffer using the provided AudioContext.
 */
export async function fetchAndDecodeAudio(
  mediaUrl: string,
  audioCtx: BaseAudioContext
): Promise<AudioBuffer | null> {
  if (!mediaUrl) return null;
  if (audioBufferCache.has(mediaUrl)) {
    return audioBufferCache.get(mediaUrl)!;
  }

  try {
    const res = await fetch(mediaUrl);
    if (!res.ok) {
      console.warn(`[AudioMixer] Failed to fetch audio: ${res.statusText} for ${mediaUrl}`);
      return null;
    }
    const arrayBuffer = await res.arrayBuffer();
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
    audioBufferCache.set(mediaUrl, decoded);
    return decoded;
  } catch (err) {
    console.warn(`[AudioMixer] Error decoding audio from ${mediaUrl}:`, err);
    return null;
  }
}

/**
 * Clears the audio buffer cache to free memory after export completes.
 */
export function clearAudioBufferCache(): void {
  audioBufferCache.clear();
}

/**
 * Renders all active timeline audio (Audio tracks A1/A2 + Video clip audio) into a single stereo AudioBuffer.
 * Runs completely deterministically in an OfflineAudioContext.
 */
export async function renderTimelineAudio(
  project: ProjectData,
  durationSeconds: number,
  sampleRate = 48000
): Promise<AudioBuffer | null> {
  const saneDuration = Math.max(0.5, durationSeconds);
  const totalSamples = Math.ceil(saneDuration * sampleRate);

  const OfflineCtxClass =
    window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  if (!OfflineCtxClass) {
    console.warn('[AudioMixer] OfflineAudioContext is not supported.');
    return null;
  }

  const offlineCtx = new OfflineCtxClass(2, totalSamples, sampleRate);
  let hasAnyAudio = false;

  // 1. Process Dedicated Audio Clips (Track A1 and A2)
  for (const clip of project.audioClips || []) {
    if (clip.isMuted) continue;
    let mediaUrl = clip.mediaBlobUrl || clip.filePath;
    if (clip.vocalIsolation?.isEnabled) {
      if (clip.vocalIsolation.isolationMode === 'isolate_vocals' && clip.vocalIsolation.vocalsBlobUrl) {
        mediaUrl = clip.vocalIsolation.vocalsBlobUrl;
      } else if (clip.vocalIsolation.isolationMode === 'remove_vocals' && clip.vocalIsolation.instrumentalBlobUrl) {
        mediaUrl = clip.vocalIsolation.instrumentalBlobUrl;
      }
    } else if (clip.denoise?.enabled && clip.denoise.processedBlobUrl) {
      mediaUrl = clip.denoise.processedBlobUrl;
    }
    if (!mediaUrl) continue;

    const buffer = await fetchAndDecodeAudio(mediaUrl, offlineCtx);
    if (!buffer) continue;

    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;

    const gainNode = offlineCtx.createGain();
    const baseVolume = clip.volume ?? 1.0;
    gainNode.gain.setValueAtTime(baseVolume, 0);

    const speed = (clip as any).speed && isFinite((clip as any).speed) && (clip as any).speed > 0 ? (clip as any).speed : 1.0;
    source.playbackRate.value = speed;

    const startTime = Math.max(0, clip.timelineStart);
    const timelineDur = Math.max(0.05, clip.timelineDuration);
    const sourceDuration = Math.max(0.05, timelineDur * speed);
    const offset = Math.max(0, clip.startOffset || 0);

    // Apply Fade In
    const fadeInDur = clip.fadeIn || 0;
    if (fadeInDur > 0) {
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(
        baseVolume,
        startTime + Math.min(timelineDur, fadeInDur)
      );
    }

    // Apply Fade Out
    const fadeOutDur = clip.fadeOut || 0;
    if (fadeOutDur > 0) {
      const fadeStart = Math.max(startTime, startTime + timelineDur - fadeOutDur);
      gainNode.gain.setValueAtTime(baseVolume, fadeStart);
      gainNode.gain.linearRampToValueAtTime(0, startTime + timelineDur);
    }

    // Connect through parametric EQ, vocal enhancer, and compressor
    const filteredNode = audioProcessor.applyAudioFiltersToChain(offlineCtx, source, clip.audioFilters);
    filteredNode.connect(gainNode);
    gainNode.connect(offlineCtx.destination);

    source.start(startTime, offset, sourceDuration);
    hasAnyAudio = true;
  }

  // 2. Process Embedded Audio from Video Clips (Track V1, V2, etc.)
  for (const clip of project.clips || []) {
    if (clip.isMuted) continue;
    if (clip.mediaType === 'image') continue; // Images have no audio
    let mediaUrl = clip.mediaBlobUrl || clip.filePath;
    if (clip.vocalIsolation?.isEnabled) {
      if (clip.vocalIsolation.isolationMode === 'isolate_vocals' && clip.vocalIsolation.vocalsBlobUrl) {
        mediaUrl = clip.vocalIsolation.vocalsBlobUrl;
      } else if (clip.vocalIsolation.isolationMode === 'remove_vocals' && clip.vocalIsolation.instrumentalBlobUrl) {
        mediaUrl = clip.vocalIsolation.instrumentalBlobUrl;
      }
    } else if (clip.denoise?.enabled && clip.denoise.processedBlobUrl) {
      mediaUrl = clip.denoise.processedBlobUrl;
    }
    if (!mediaUrl) continue;

    const buffer = await fetchAndDecodeAudio(mediaUrl, offlineCtx);
    if (!buffer) continue;

    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;

    const gainNode = offlineCtx.createGain();
    const baseVolume = clip.volume ?? 1.0;
    gainNode.gain.setValueAtTime(baseVolume, 0);

    const speed = clip.speed && isFinite(clip.speed) && clip.speed > 0 ? clip.speed : 1.0;
    source.playbackRate.value = speed;

    const startTime = Math.max(0, clip.timelineStart);
    const timelineDur = Math.max(0.05, clip.timelineDuration);
    const sourceDuration = Math.max(0.05, timelineDur * speed);
    const offset = Math.max(0, clip.startOffset || 0);

    // Connect through parametric EQ, vocal enhancer, and compressor
    const filteredNode = audioProcessor.applyAudioFiltersToChain(offlineCtx, source, clip.audioFilters);
    filteredNode.connect(gainNode);
    gainNode.connect(offlineCtx.destination);

    source.start(startTime, offset, sourceDuration);
    hasAnyAudio = true;
  }

  if (!hasAnyAudio) {
    // Return empty silent audio buffer
    return offlineCtx.createBuffer(2, totalSamples, sampleRate);
  }

  return await offlineCtx.startRendering();
}
