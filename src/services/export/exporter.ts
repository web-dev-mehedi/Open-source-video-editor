import { ProjectData } from '../../types/project';
import { ExportOptions } from './exportConfig';
import { renderTimelineAudio } from './audioMixer';
import { FrameCompositor } from './frameCompositor';
import { getActiveContentDuration } from '../../utils/timelineDuration';
import { validateAudioBitrate } from './bitrateHelper';
import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4ArrayBufferTarget } from 'mp4-muxer';
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmArrayBufferTarget } from 'webm-muxer';

export interface ExportProgressUpdate {
  phase: 'preparing' | 'audio' | 'rendering' | 'muxing' | 'verifying' | 'completed' | 'failed';
  percent: number;
  currentFrame: number;
  totalFrames: number;
  statusMessage?: string;
  outputBlobUrl?: string;
  error?: string;
}

/**
 * Checks if WebCodecs VideoEncoder and AudioEncoder are available in the current runtime.
 */
export function isWebCodecsSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as any).VideoEncoder === 'function' &&
    typeof (window as any).AudioEncoder === 'function' &&
    typeof (window as any).VideoFrame === 'function'
  );
}

/**
 * Encodes audio buffer into chunks and feeds to WebCodecs AudioEncoder.
 */
async function encodeAudioBufferToWebCodecs(
  audioBuffer: AudioBuffer,
  audioEncoder: AudioEncoder,
  sampleRate = 48000
): Promise<void> {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const chunkSize = 4096; // Standard audio frame chunk size

  for (let offset = 0; offset < length; offset += chunkSize) {
    const currentChunkSize = Math.min(chunkSize, length - offset);
    const audioDataPlanar = new Float32Array(numberOfChannels * currentChunkSize);

    for (let channel = 0; channel < numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      const sub = channelData.subarray(offset, offset + currentChunkSize);
      audioDataPlanar.set(sub, channel * currentChunkSize);
    }

    const timestampMicroseconds = Math.round((offset / sampleRate) * 1_000_000);

    const AudioDataClass = (window as any).AudioData;
    if (!AudioDataClass) break;

    const audioData = new AudioDataClass({
      format: 'f32-planar',
      sampleRate,
      numberOfFrames: currentChunkSize,
      numberOfChannels,
      timestamp: timestampMicroseconds,
      data: audioDataPlanar,
    });

    audioEncoder.encode(audioData);
    audioData.close();
  }

  await audioEncoder.flush();
}

/**
 * High-performance WebCodecs + Muxer (MP4/WebM) Frame-by-Frame Video Exporter.
 */
export async function exportTimelineWebCodecs(
  project: ProjectData,
  options: ExportOptions,
  onProgress: (update: ExportProgressUpdate) => void,
  abortSignal?: AbortSignal
): Promise<{ blob: Blob; mimeType: string }> {
  const activeDuration = getActiveContentDuration(project);
  const totalDuration = Math.max(0.5, activeDuration || project.metadata.duration || 5);
  const totalFrames = Math.max(1, Math.ceil(totalDuration * options.fps));
  const { width, height } = options.resolution;
  const isMp4 = options.format === 'mp4' || options.format === 'mov';

  onProgress({
    phase: 'preparing',
    percent: 2,
    currentFrame: 0,
    totalFrames,
    statusMessage: 'Preparing compositor & fonts...',
  });

  const compositor = new FrameCompositor(width, height, project, options.burnCaptions ?? true);
  await compositor.prepare();

  if (abortSignal?.aborted) {
    compositor.cleanup();
    throw new Error('Export was cancelled by user.');
  }

  // 1. Offline Audio Mixdown
  onProgress({
    phase: 'audio',
    percent: 8,
    currentFrame: 0,
    totalFrames,
    statusMessage: 'Rendering offline multi-track audio...',
  });

  const mixedAudioBuffer = await renderTimelineAudio(project, totalDuration, options.sampleRate);

  if (abortSignal?.aborted) {
    compositor.cleanup();
    throw new Error('Export was cancelled by user.');
  }

  // 2. Initialize Container Muxer
  let muxer: any = null;
  let target: any = null;

  if (isMp4) {
    target = new Mp4ArrayBufferTarget();
    muxer = new Mp4Muxer({
      target,
      video: {
        codec: 'avc',
        width,
        height,
      },
      audio: mixedAudioBuffer
        ? {
            codec: 'aac',
            numberOfChannels: mixedAudioBuffer.numberOfChannels,
            sampleRate: options.sampleRate,
          }
        : undefined,
      fastStart: 'in-memory',
    });
  } else {
    target = new WebmArrayBufferTarget();
    muxer = new WebmMuxer({
      target,
      video: {
        codec: 'V_VP9',
        width,
        height,
      },
      audio: mixedAudioBuffer
        ? {
            codec: 'A_OPUS',
            numberOfChannels: mixedAudioBuffer.numberOfChannels,
            sampleRate: options.sampleRate,
          }
        : undefined,
    });
  }

  // 3. Initialize WebCodecs VideoEncoder
  const VideoEncoderClass = (window as any).VideoEncoder;
  const videoEncoder = new VideoEncoderClass({
    output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
    error: (e: any) => console.error('[VideoEncoder Error]:', e),
  });

  videoEncoder.configure({
    codec: isMp4 ? 'avc1.640028' : 'vp09.00.10.08',
    width,
    height,
    bitrate: options.bitrate,
    framerate: options.fps,
    avc: isMp4 ? { format: 'avc' } : undefined,
  });

  // 4. Initialize WebCodecs AudioEncoder
  let audioEncoder: any = null;
  if (mixedAudioBuffer) {
    const AudioEncoderClass = (window as any).AudioEncoder;
    audioEncoder = new AudioEncoderClass({
      output: (chunk: any, meta: any) => muxer.addAudioChunk(chunk, meta),
      error: (e: any) => console.error('[AudioEncoder Error]:', e),
    });

    const audioCodec = isMp4 ? 'mp4a.40.2' : 'opus';
    const validation = validateAudioBitrate(audioCodec, options.audioBitrate);
    const safeAudioBitrate = validation.clampedBps;

    audioEncoder.configure({
      codec: audioCodec,
      numberOfChannels: mixedAudioBuffer.numberOfChannels,
      sampleRate: options.sampleRate,
      bitrate: safeAudioBitrate,
    });

    // Encode audio in background
    await encodeAudioBufferToWebCodecs(mixedAudioBuffer, audioEncoder, options.sampleRate);
  }

  // 5. Frame-by-Frame Video Composition & Encoding Loop
  const VideoFrameClass = (window as any).VideoFrame;
  const canvas = compositor.getCanvas();

  for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
    if (abortSignal?.aborted) {
      compositor.cleanup();
      try { videoEncoder.close(); } catch {}
      if (audioEncoder) try { audioEncoder.close(); } catch {}
      throw new Error('Export was cancelled by user.');
    }

    const t = frameIdx / options.fps;
    await compositor.renderFrame(t);

    const timestampMicroseconds = Math.round(frameIdx * (1_000_000 / options.fps));
    const videoFrame = new VideoFrameClass(canvas, {
      timestamp: timestampMicroseconds,
      duration: Math.round(1_000_000 / options.fps),
    });

    const isKeyframe = frameIdx % (options.fps * 2) === 0;
    videoEncoder.encode(videoFrame, { keyFrame: isKeyframe });
    videoFrame.close(); // Immediate memory reclamation

    // Progress update every 3 frames
    if (frameIdx % 3 === 0 || frameIdx === totalFrames - 1) {
      const renderPercent = 10 + Math.round((frameIdx / totalFrames) * 85);
      onProgress({
        phase: 'rendering',
        percent: renderPercent,
        currentFrame: frameIdx + 1,
        totalFrames,
        statusMessage: `Compositing frame ${frameIdx + 1}/${totalFrames} (${renderPercent}%)`,
      });
    }
  }

  // 6. Flush & Finalize Muxer
  onProgress({
    phase: 'muxing',
    percent: 96,
    currentFrame: totalFrames,
    totalFrames,
    statusMessage: 'Finalizing container muxing & header verification...',
  });

  await videoEncoder.flush();
  muxer.finalize();
  compositor.cleanup();
  try { videoEncoder.close(); } catch {}
  if (audioEncoder) try { audioEncoder.close(); } catch {}

  const mimeType = isMp4 ? 'video/mp4' : 'video/webm';
  const finalBuffer = target.buffer;
  const blob = new Blob([finalBuffer], { type: mimeType });

  return { blob, mimeType };
}
