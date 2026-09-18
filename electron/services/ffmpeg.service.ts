import { spawn, execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { MediaProbeResult, ExportProgressPayload } from '../types/ipc.types';

import { compileClipEffectsToFfmpeg, compileAllClipFilters, compileAudioFiltersToFfmpeg } from './ffmpegFilterBuilder';

// Map CaptionForge transition types + direction to FFmpeg xfade transition names (fallback to fade)
function mapTransitionToXfade(type: string, direction?: string): string {
  const dir = direction || 'right';
  switch (type) {
    case 'crossfade':
      return 'fade';
    case 'fade-in':
    case 'fade-out':
      return 'fade';
    case 'dip-black':
      return 'fadeblack';
    case 'dip-white':
      return 'fadewhite';
    case 'fade-color':
      return 'fade';
    case 'wipe':
      if (dir === 'left') return 'wipeleft';
      if (dir === 'right') return 'wiperight';
      if (dir === 'up') return 'wipeup';
      if (dir === 'down') return 'wipedown';
      if (dir === 'diagonal-tl' || dir === 'diagonal-tr') return 'slideright';
      return 'wipeleft';
    case 'push':
      if (dir === 'left') return 'slideleft';
      if (dir === 'right') return 'slideright';
      if (dir === 'up') return 'slideup';
      if (dir === 'down') return 'slidedown';
      return 'slideleft';
    case 'slide':
      if (dir === 'left') return 'slideleft';
      if (dir === 'right') return 'slideright';
      if (dir === 'up') return 'slideup';
      if (dir === 'down') return 'slidedown';
      return 'slideleft';
    case 'whip-pan':
      if (dir === 'left' || dir === 'right') return dir === 'left' ? 'slideleft' : 'slideright';
      return dir === 'up' ? 'slideup' : 'slidedown';
    case 'iris':
      return 'circleopen';
    case 'zoom':
      return 'zoomin';
    case 'spin':
      return 'rotate';
    case 'flash':
      return 'fadewhite';
    case 'glitch':
      return 'fade';
    case 'light-leak':
    case 'film-burn':
      return 'fade';
    case 'luma-wipe':
      return 'wipeleft';
    case 'morph':
      return 'smoothleft';
    case 'cut':
    default:
      return 'fade';
  }
}

export class FFmpegService {
  private ffmpegPath: string = 'ffmpeg';
  private ffprobePath: string = 'ffprobe';
  private activeJobs: Map<string, any> = new Map();

  constructor(customFfmpegPath?: string, customFfprobePath?: string) {
    if (customFfmpegPath && fs.existsSync(customFfmpegPath)) {
      this.ffmpegPath = customFfmpegPath;
    }
    if (customFfprobePath && fs.existsSync(customFfprobePath)) {
      this.ffprobePath = customFfprobePath;
    }
  }

  /**
   * Check if FFmpeg is installed and get version/encoders
   */
  public async checkStatus(): Promise<{ available: boolean; version?: string; encoders?: string[] }> {
    return new Promise((resolve) => {
      execFile(this.ffmpegPath, ['-version'], (err, stdout) => {
        if (err) {
          resolve({ available: false });
        } else {
          const firstLine = stdout.split('\n')[0] || '';
          
          // Check available encoders
          execFile(this.ffmpegPath, ['-encoders'], (encErr, encStdout) => {
            const encoders: string[] = [];
            if (!encErr && encStdout) {
              if (encStdout.includes('h264_nvenc')) encoders.push('nvenc');
              if (encStdout.includes('h264_qsv')) encoders.push('qsv');
              if (encStdout.includes('h264_amf')) encoders.push('amf');
              if (encStdout.includes('libx264')) encoders.push('cpu');
            }
            resolve({
              available: true,
              version: firstLine,
              encoders: encoders.length > 0 ? encoders : ['cpu']
            });
          });
        }
      });
    });
  }

  /**
   * Probe media file for duration, resolution, fps, codecs
   */
  public async probeMedia(filePath: string): Promise<MediaProbeResult> {
    return new Promise((resolve, reject) => {
      const args = [
        '-v', 'error',
        '-show_entries', 'format=duration:stream=width,height,r_frame_rate,codec_name,codec_type,sample_rate',
        '-of', 'json',
        filePath
      ];

      execFile(this.ffprobePath, args, (err, stdout, stderr) => {
        if (err) {
          // Fallback probe using ffmpeg -i if ffprobe fails
          this.probeWithFFmpeg(filePath).then(resolve).catch(reject);
          return;
        }

        try {
          const data = JSON.parse(stdout);
          const videoStream = data.streams?.find((s: any) => s.codec_type === 'video');
          const audioStream = data.streams?.find((s: any) => s.codec_type === 'audio');
          
          let duration = parseFloat(data.format?.duration) || 0;
          let width = videoStream?.width || 1080;
          let height = videoStream?.height || 1920;
          let codecName = videoStream?.codec_name || 'unknown';
          let fps = 30;

          if (videoStream?.r_frame_rate) {
            const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
            if (den && den > 0) {
              fps = Math.round((num / den) * 100) / 100;
            }
          }

          resolve({
            duration,
            width,
            height,
            fps: fps || 30,
            codecName,
            hasAudio: !!audioStream,
            audioCodec: audioStream?.codec_name,
            sampleRate: audioStream?.sample_rate ? parseInt(audioStream.sample_rate) : undefined
          });
        } catch (e) {
          this.probeWithFFmpeg(filePath).then(resolve).catch(reject);
        }
      });
    });
  }

  private async probeWithFFmpeg(filePath: string): Promise<MediaProbeResult> {
    return new Promise((resolve, reject) => {
      execFile(this.ffmpegPath, ['-i', filePath], (_err, _stdout, stderr) => {
        const durationMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
        let duration = 0;
        if (durationMatch) {
          duration = parseInt(durationMatch[1]) * 3600 + parseInt(durationMatch[2]) * 60 + parseFloat(durationMatch[3]);
        }

        const videoMatch = stderr.match(/Video:.*?(\d{2,5})x(\d{2,5})/);
        const width = videoMatch ? parseInt(videoMatch[1]) : 1080;
        const height = videoMatch ? parseInt(videoMatch[2]) : 1920;

        const fpsMatch = stderr.match(/(\d+(?:\.\d+)?)\s*fps/);
        const fps = fpsMatch ? parseFloat(fpsMatch[1]) : 30;

        const hasAudio = /Audio:/.test(stderr);

        resolve({
          duration,
          width,
          height,
          fps,
          codecName: 'h264',
          hasAudio,
        });
      });
    });
  }

  /**
   * Generates a fast web-compatible x264/yuv420p preview proxy for videos that Chromium cannot natively decode
   */
  public async getOrCreatePreviewProxy(filePath: string): Promise<string> {
    if (!fs.existsSync(filePath)) throw new Error('Source file does not exist');

    const stats = fs.statSync(filePath);
    const proxyDir = path.join(os.tmpdir(), 'captionforge_proxies');
    if (!fs.existsSync(proxyDir)) {
      fs.mkdirSync(proxyDir, { recursive: true });
    }

    const baseName = path.basename(filePath, path.extname(filePath));
    const proxyPath = path.join(proxyDir, `${baseName}_proxy_${stats.size}_${Math.round(stats.mtimeMs)}.mp4`);

    if (fs.existsSync(proxyPath)) {
      return proxyPath;
    }

    return new Promise((resolve) => {
      const args = [
        '-y',
        '-i', filePath,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'ultrafast',
        '-crf', '22',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        proxyPath
      ];

      execFile(this.ffmpegPath, args, (err) => {
        if (err || !fs.existsSync(proxyPath)) {
          console.error('Preview proxy generation error:', err);
          resolve('');
        } else {
          resolve(proxyPath);
        }
      });
    });
  }

  /**
   * Extract video thumbnail at specific timecode as Base64 Data URL
   */
  public async generateThumbnail(filePath: string, timestampSeconds: number): Promise<string> {
    const tempThumbnailPath = path.join(os.tmpdir(), `cf_thumb_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`);
    
    return new Promise((resolve, reject) => {
      const args = [
        '-ss', String(Math.max(0, timestampSeconds)),
        '-i', filePath,
        '-vframes', '1',
        '-q:v', '3',
        '-vf', 'scale=320:-1',
        '-y',
        tempThumbnailPath
      ];

      execFile(this.ffmpegPath, args, (err) => {
        if (err || !fs.existsSync(tempThumbnailPath)) {
          reject(new Error(`Failed to generate thumbnail: ${err?.message || 'File not created'}`));
          return;
        }

        try {
          const imageBuffer = fs.readFileSync(tempThumbnailPath);
          const base64 = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
          fs.unlinkSync(tempThumbnailPath);
          resolve(base64);
        } catch (readErr) {
          reject(readErr);
        }
      });
    });
  }

  /**
   * Extract 16kHz mono audio WAV file for AI speech transcription
   */
  public async extractAudioForAI(filePath: string): Promise<string> {
    const outputAudioPath = path.join(os.tmpdir(), `cf_audio_${Date.now()}_${Math.random().toString(36).substring(7)}.wav`);

    return new Promise((resolve, reject) => {
      const args = [
        '-i', filePath,
        '-vn',
        '-acodec', 'pcm_s16le',
        '-ar', '16000',
        '-ac', '1',
        '-y',
        outputAudioPath
      ];

      execFile(this.ffmpegPath, args, (err) => {
        if (err || !fs.existsSync(outputAudioPath)) {
          reject(new Error(`Failed to extract audio: ${err?.message || 'Audio file not found'}`));
          return;
        }
        resolve(outputAudioPath);
      });
    });
  }


  /**
   * Extract audio peaks (60-120 data points per minute) for waveform rendering
   */
  public async extractWaveformPeaks(filePath: string): Promise<{ peaks: number[]; audioPath: string; duration: number }> {
    const audioPath = await this.extractAudioForAI(filePath);
    
    // Read raw PCM samples to generate peaks
    return new Promise((resolve) => {
      try {
        const stats = fs.statSync(audioPath);
        const headerSize = 44; // Standard WAV header
        const buffer = fs.readFileSync(audioPath);
        const sampleCount = (stats.size - headerSize) / 2; // 16-bit = 2 bytes
        const duration = sampleCount / 16000;

        const totalPeaks = Math.min(600, Math.max(100, Math.round(duration * 20)));
        const samplesPerPeak = Math.floor(sampleCount / totalPeaks);
        const peaks: number[] = [];

        for (let i = 0; i < totalPeaks; i++) {
          let max = 0;
          const start = headerSize + i * samplesPerPeak * 2;
          const end = Math.min(buffer.length - 2, start + samplesPerPeak * 2);

          for (let j = start; j < end; j += 4) { // Step by 2 samples
            const sample = Math.abs(buffer.readInt16LE(j)) / 32768;
            if (sample > max) max = sample;
          }
          peaks.push(Math.round(max * 100) / 100);
        }

        resolve({ peaks, audioPath, duration });
      } catch (e) {
        // Fallback default mock peaks
        const mockPeaks = Array.from({ length: 150 }, () => Math.random() * 0.7 + 0.2);
        resolve({ peaks: mockPeaks, audioPath, duration: 10 });
      }
    });
  }

  /**
   * Render and export final video with burned-in subtitles and optional overlays
   */
  public async renderVideo(
    jobId: string,
    params: {
      inputVideoPath: string;
      outputFilePath: string;
      assSubtitlePath?: string;
      resolution: string; // '720p', '1080p', '4k', 'original'
      aspectRatio: string; // '9:16', '16:9', '1:1', '4:5'
      fps: number;
      bitrateKbps: number;
      hardwareEncoder: string;
      speed?: number;
      trimStart?: number;
      trimEnd?: number;
      effects?: any[];
      colorGrading?: any;
      chromaKey?: any;
      transform?: any;
      audioFilters?: any;
    },
    onProgress: (progress: ExportProgressPayload) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const {
        inputVideoPath,
        outputFilePath,
        assSubtitlePath,
        resolution,
        aspectRatio,
        fps,
        bitrateKbps,
        hardwareEncoder,
        speed = 1.0,
        trimStart = 0,
        trimEnd,
        effects = [],
        colorGrading,
        chromaKey,
        transform,
        audioFilters: clipAudioFilters,
      } = params;

      // Determine dimensions based on resolution and aspect ratio
      let targetWidth = 1080;
      let targetHeight = 1920;

      if (aspectRatio === '9:16') {
        if (resolution === '720p') { targetWidth = 720; targetHeight = 1280; }
        else if (resolution === '4k') { targetWidth = 2160; targetHeight = 3840; }
        else { targetWidth = 1080; targetHeight = 1920; }
      } else if (aspectRatio === '16:9') {
        if (resolution === '720p') { targetWidth = 1280; targetHeight = 720; }
        else if (resolution === '4k') { targetWidth = 3840; targetHeight = 2160; }
        else { targetWidth = 1920; targetHeight = 1080; }
      } else if (aspectRatio === '1:1') {
        if (resolution === '720p') { targetWidth = 720; targetHeight = 720; }
        else if (resolution === '4k') { targetWidth = 2160; targetHeight = 2160; }
        else { targetWidth = 1080; targetHeight = 1080; }
      } else if (aspectRatio === '4:5') {
        targetWidth = 1080;
        targetHeight = 1350;
      }

      // Build filter chain
      const videoFilters: string[] = [];

      // Speed adjustment
      if (speed !== 1.0) {
        videoFilters.push(`setpts=${(1 / speed).toFixed(4)}*PTS`);
      }

      // Scale & crop to exact aspect ratio canvas
      videoFilters.push(`scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight},setsar=1`);

      // Compile and append all clip visual filters & effects (Effects, Color Grading, Chroma Key, Transform)
      const compiledClipFilters = compileAllClipFilters(
        { effects, colorGrading, chromaKey, transform },
        targetWidth,
        targetHeight
      );
      if (compiledClipFilters.length > 0) {
        videoFilters.push(...compiledClipFilters);
      }

      // Subtitle burn-in via libass filter
      if (assSubtitlePath && fs.existsSync(assSubtitlePath)) {
        // Normalize path for FFmpeg filter on Windows
        const normalizedSubPath = assSubtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:');
        videoFilters.push(`ass='${normalizedSubPath}'`);
      }

      const audioFilters: string[] = [];
      if (speed !== 1.0) {
        // atempo only accepts 0.5 to 2.0 per filter instance
        let remainingSpeed = speed;
        while (remainingSpeed > 2.0) {
          audioFilters.push('atempo=2.0');
          remainingSpeed /= 2.0;
        }
        while (remainingSpeed < 0.5) {
          audioFilters.push('atempo=0.5');
          remainingSpeed /= 0.5;
        }
        audioFilters.push(`atempo=${remainingSpeed.toFixed(4)}`);
      }

      // Append compiled parametric audio filters
      if (clipAudioFilters) {
        const af = compileAudioFiltersToFfmpeg(clipAudioFilters);
        if (af.length > 0) {
          audioFilters.push(...af);
        }
      }

      // Encoder selection
      let vcodec = 'libx264';
      if (hardwareEncoder === 'nvenc') vcodec = 'h264_nvenc';
      else if (hardwareEncoder === 'qsv') vcodec = 'h264_qsv';
      else if (hardwareEncoder === 'amf') vcodec = 'h264_amf';

      const args: string[] = ['-y'];

      // Trim start
      if (trimStart > 0) {
        args.push('-ss', String(trimStart));
      }

      args.push('-i', inputVideoPath);

      // Duration trimming with -t for unambiguous precision
      if (trimEnd && trimEnd > trimStart) {
        args.push('-t', String(Math.max(0.05, (trimEnd - trimStart) / (speed || 1.0))));
      }

      if (videoFilters.length > 0) {
        args.push('-vf', videoFilters.join(','));
      }

      if (audioFilters.length > 0) {
        args.push('-af', audioFilters.join(','));
      }

      const ext = path.extname(outputFilePath).toLowerCase();
      const rawAudioBitrate = (params as any).audioBitrateKbps || (params as any).audioBitrate || 192;
      const resolvedAudioKbps = rawAudioBitrate >= 1000 ? Math.round(rawAudioBitrate / 1000) : rawAudioBitrate;
      const audioBitrateStr = `${resolvedAudioKbps || 192}k`;

      if (ext === '.mp3') {
        const mp3BitrateStr = `${resolvedAudioKbps || 320}k`;
        args.push('-vn', '-c:a', 'libmp3lame', '-b:a', mp3BitrateStr, outputFilePath);
      } else if (ext === '.wav') {
        args.push('-vn', '-c:a', 'pcm_s16le', outputFilePath);
      } else if (ext === '.gif') {
        const gifFilters = ['fps=15', 'scale=480:-1:flags=lanczos'];
        if (assSubtitlePath && fs.existsSync(assSubtitlePath)) {
          const normalizedSubPath = assSubtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:');
          gifFilters.push(`ass='${normalizedSubPath}'`);
        }
        gifFilters.push('split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse');
        args.push('-vf', gifFilters.join(','), outputFilePath);
      } else if (ext === '.webm') {
        args.push(
          '-c:v', 'libvpx-vp9',
          '-b:v', `${bitrateKbps || 6000}k`,
          '-r', String(fps || 30),
          '-c:a', 'libopus',
          '-b:a', audioBitrateStr,
          outputFilePath
        );
      } else {
        // Standard MP4 / MOV
        args.push(
          '-c:v', vcodec,
          '-preset', 'veryfast',
          '-threads', '0',
          '-b:v', `${bitrateKbps || 8000}k`,
          '-r', String(fps || 30),
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac',
          '-b:a', audioBitrateStr,
          '-movflags', '+faststart',
          outputFilePath
        );
      }

      const ffmpegProcess = spawn(this.ffmpegPath, args);
      this.activeJobs.set(jobId, ffmpegProcess);

      let totalDurationSeconds = 0;

      // First probe total duration if possible
      this.probeMedia(inputVideoPath).then((meta) => {
        totalDurationSeconds = (trimEnd || meta.duration) - trimStart;
        if (speed !== 1.0 && totalDurationSeconds > 0) {
          totalDurationSeconds /= speed;
        }
      }).catch(() => {});

      ffmpegProcess.stderr.on('data', (data) => {
        const text = data.toString();

        // Check for time progress
        const timeMatch = text.match(/time=(\d+):(\d+):(\d+\.\d+)/);
        const fpsMatch = text.match(/fps=\s*(\d+(?:\.\d+)?)/);
        const speedMatch = text.match(/speed=\s*([\d\.]+)x/);
        const frameMatch = text.match(/frame=\s*(\d+)/);

        if (timeMatch) {
          const currentTime = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseFloat(timeMatch[3]);
          let percent = 0;
          if (totalDurationSeconds > 0) {
            percent = Math.min(99, Math.round((currentTime / totalDurationSeconds) * 100));
          }

          onProgress({
            jobId,
            projectId: '',
            status: 'rendering',
            percent,
            fps: fpsMatch ? parseFloat(fpsMatch[1]) : undefined,
            currentFrame: frameMatch ? parseInt(frameMatch[1]) : undefined,
            speed: speedMatch ? `${speedMatch[1]}x` : undefined,
            outputFilePath
          });
        }
      });

      ffmpegProcess.on('close', (code) => {
        this.activeJobs.delete(jobId);
        if (code === 0 && fs.existsSync(outputFilePath)) {
          try {
            const stats = fs.statSync(outputFilePath);
            if (stats.size > 0) {
              onProgress({
                jobId,
                projectId: '',
                status: 'completed',
                percent: 100,
                outputFilePath
              });
              resolve(outputFilePath);
              return;
            }
          } catch (e) {}
        }

        const errorMsg = `FFmpeg export failed: ${code !== 0 ? `Process exited with code ${code}` : 'Output file was not generated or has 0 bytes.'}`;
        onProgress({
          jobId,
          projectId: '',
          status: 'failed',
          percent: 0,
          error: errorMsg
        });
        reject(new Error(errorMsg));
      });

      ffmpegProcess.on('error', (err) => {
        this.activeJobs.delete(jobId);
        onProgress({
          jobId,
          projectId: '',
          status: 'failed',
          percent: 0,
          error: err.message
        });
        reject(err);
      });
    });
  }

  /**
   * Render and export full project timeline with multi-clip sequencing, multicam cuts,
   * V2 overlay track layers, 3-way color grading, chroma keying, transforms, audio tracks, and burned-in captions.
   */
  public async renderProjectTimeline(
    jobId: string,
    project: any,
    settings: any,
    assSubtitlePath?: string,
    onProgress: (progress: ExportProgressPayload) => void = () => {}
  ): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        const outputFilePath = settings.outputPath;
        if (!outputFilePath) {
          throw new Error('Export destination file path is missing.');
        }

        // Ensure output folder exists
        const outDir = path.dirname(outputFilePath);
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }

        // Extract clips
        const allClips = project.clips || [];
        const v1Clips = allClips.filter((c: any) => (c.trackIndex || 1) === 1).sort((a: any, b: any) => a.timelineStart - b.timelineStart);
        const v2Clips = allClips.filter((c: any) => (c.trackIndex || 1) === 2).sort((a: any, b: any) => a.timelineStart - b.timelineStart);
        const audioClips = (project.audioClips || []).filter((a: any) => !a.isMuted);

        // Determine canvas dimensions from aspect ratio and resolution
        const aspectRatio = project.metadata?.aspectRatio || '9:16';
        const resolution = settings.resolution || '1080p';
        let targetWidth = 1080;
        let targetHeight = 1920;

        if (aspectRatio === '9:16') {
          if (resolution === '720p') { targetWidth = 720; targetHeight = 1280; }
          else if (resolution === '2k') { targetWidth = 1440; targetHeight = 2560; }
          else if (resolution === '4k') { targetWidth = 2160; targetHeight = 3840; }
          else { targetWidth = 1080; targetHeight = 1920; }
        } else if (aspectRatio === '16:9') {
          if (resolution === '720p') { targetWidth = 1280; targetHeight = 720; }
          else if (resolution === '2k') { targetWidth = 2560; targetHeight = 1440; }
          else if (resolution === '4k') { targetWidth = 3840; targetHeight = 2160; }
          else { targetWidth = 1920; targetHeight = 1080; }
        } else if (aspectRatio === '1:1') {
          if (resolution === '720p') { targetWidth = 720; targetHeight = 720; }
          else if (resolution === '2k') { targetWidth = 1440; targetHeight = 1440; }
          else if (resolution === '4k') { targetWidth = 2160; targetHeight = 2160; }
          else { targetWidth = 1080; targetHeight = 1080; }
        } else if (aspectRatio === '4:5') {
          targetWidth = 1080;
          targetHeight = 1350;
        }

        const ext = path.extname(outputFilePath).toLowerCase();
        const fps = settings.fps || 30;
        const bitrateKbps = settings.bitrateKbps || 8000;
        const hardwareEncoder = settings.hardwareEncoder || 'auto';

        // Select video encoder
        let vcodec = 'libx264';
        if (hardwareEncoder === 'nvenc') vcodec = 'h264_nvenc';
        else if (hardwareEncoder === 'qsv') vcodec = 'h264_qsv';
        else if (hardwareEncoder === 'amf') vcodec = 'h264_amf';

        // Check primary video fallback
        const primaryFallback = project.metadata?.primaryMediaFilePath;
        if (v1Clips.length === 0 && !primaryFallback) {
          throw new Error('No video clips found in project to export.');
        }

        const isImageClip = (c: any) => {
          if (!c) return false;
          if (c.mediaType === 'image') return true;
          const p = (c.filePath || c.name || '') as string;
          return /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(p);
        };

        // If simple single video clip without V2/Audio tracks/transitions, use single-clip pipeline
        const projectTransitions = project.transitions || [];
        if (v1Clips.length <= 1 && v2Clips.length === 0 && audioClips.length === 0 && projectTransitions.length === 0) {
          const singleClip = v1Clips[0] || { filePath: primaryFallback, duration: 10, startOffset: 0, endOffset: 10 };
          if (!isImageClip(singleClip)) {
            return this.renderVideo(
              jobId,
              {
                inputVideoPath: singleClip.filePath,
                outputFilePath,
                assSubtitlePath,
                resolution,
                aspectRatio,
                fps,
                bitrateKbps,
                hardwareEncoder,
                speed: singleClip.speed || 1.0,
                trimStart: singleClip.startOffset || 0,
                trimEnd: singleClip.endOffset,
                effects: singleClip.effects || [],
                colorGrading: singleClip.colorGrading,
                chromaKey: singleClip.chromaKey,
                transform: singleClip.transform,
                audioFilters: singleClip.audioFilters,
              },
              onProgress
            ).then(resolve).catch(reject);
          }
        }

        // Multi-clip / Multi-track timeline pipeline using FFmpeg filter_complex
        // 1. Register all input video and audio files
        const inputFiles: string[] = [];
        const fileToIndex = new Map<string, number>();

        const registerFile = (filePath: string) => {
          if (!filePath) return -1;
          if (fileToIndex.has(filePath)) return fileToIndex.get(filePath)!;
          const idx = inputFiles.length;
          inputFiles.push(filePath);
          fileToIndex.set(filePath, idx);
          return idx;
        };

        for (const c of v1Clips) registerFile(c.filePath);
        for (const c of v2Clips) registerFile(c.filePath);
        for (const a of audioClips) registerFile(a.filePath);

        // Probe media files to verify which files contain audio streams
        const fileProbeMap = new Map<string, MediaProbeResult>();
        for (const f of inputFiles) {
          try {
            const probe = await this.probeMedia(f);
            fileProbeMap.set(f, probe);
          } catch {
            fileProbeMap.set(f, {
              duration: 10,
              width: 1080,
              height: 1920,
              fps: 30,
              codecName: 'unknown',
              hasAudio: false
            });
          }
        }

        const args: string[] = ['-y'];

        // Add all input arguments
        for (const f of inputFiles) {
          args.push('-i', f);
        }

        const filterComplex: string[] = [];
        const v1VideoTags: string[] = [];
        const v1AudioTags: string[] = [];

        // Build per-clip filters for Track 1 (V1)
        for (let i = 0; i < v1Clips.length; i++) {
          const c = v1Clips[i];
          const inputIdx = fileToIndex.get(c.filePath) ?? 0;
          const isImg = isImageClip(c);
          const start = Math.max(0, c.startOffset || 0);
          const end = c.endOffset && c.endOffset > start ? c.endOffset : (c.duration || 10);
          const spd = c.speed || 1.0;
          const clipTimelineDur = Math.max(0.1, c.timelineDuration || ((end - start) / spd));

          // Video trim & format
          const vFilters: string[] = [];
          if (isImg) {
            vFilters.push(`loop=loop=-1:size=1:start=0`, `trim=duration=${clipTimelineDur.toFixed(3)}`, `setpts=PTS-STARTPTS`);
          } else {
            vFilters.push(`trim=start=${start}:end=${end}`, `setpts=PTS-STARTPTS`);
            if (spd !== 1.0) {
              vFilters.push(`setpts=${(1 / spd).toFixed(4)}*PTS`);
            }
          }

          vFilters.push(`scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight},setsar=1`);

          const customFilters = compileAllClipFilters(c, targetWidth, targetHeight);
          if (customFilters.length > 0) {
            vFilters.push(...customFilters);
          }

          const vTag = `v1_v${i}`;
          filterComplex.push(`[${inputIdx}:v]${vFilters.join(',')}[${vTag}]`);
          v1VideoTags.push(`[${vTag}]`);

          // Audio handling — if file has audio stream, trim and volume adjust; otherwise generate clean silent audio
          const probe = fileProbeMap.get(c.filePath);
          const hasAudioStream = !isImg && (probe?.hasAudio ?? false);
          const aTag = `v1_a${i}`;

          if (hasAudioStream) {
            const aFilters: string[] = [
              `atrim=start=${start}:end=${end}`,
              `asetpts=PTS-STARTPTS`,
            ];

            if (spd !== 1.0) {
              let rem = spd;
              while (rem > 2.0) { aFilters.push('atempo=2.0'); rem /= 2.0; }
              while (rem < 0.5) { aFilters.push('atempo=0.5'); rem /= 0.5; }
              aFilters.push(`atempo=${rem.toFixed(4)}`);
            }

            if (c.audioFilters) {
              const af = compileAudioFiltersToFfmpeg(c.audioFilters);
              if (af.length > 0) aFilters.push(...af);
            }

            const vol = c.isMuted ? 0 : (c.volume ?? 1.0);
            aFilters.push(`volume=${vol.toFixed(2)}`);

            filterComplex.push(`[${inputIdx}:a]${aFilters.join(',')}[${aTag}]`);
          } else {
            // Synthesize silent audio stream matching clip duration
            filterComplex.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${clipTimelineDur.toFixed(3)},asetpts=PTS-STARTPTS[${aTag}]`);
          }
          v1AudioTags.push(`[${aTag}]`);
        }

        // Transition-aware assembly: group clips by transition connectivity, xfade within groups, concat between groups
        const transitions: any[] = project.transitions || [];
        // Helper to find inter-clip center transition between two consecutive V1 clips
        const findInterClipTransition = (prevId: string, nextId: string) => {
          return transitions.find((t: any) => 
            t.fromClipId === prevId && t.toClipId === nextId && t.fromClipId !== t.toClipId
          );
        };
        // Also handle single-clip fade in/out (intro/outro) by adding fade filters directly to per-clip chains
        // Those were already validated; we add fade filter for alignment start/end single-clip transitions
        for (let i = 0; i < v1Clips.length; i++) {
          const clip = v1Clips[i];
          const introTrans = transitions.find((t: any) => t.fromClipId === clip.id && t.toClipId === clip.id && t.alignment === 'start');
          const outroTrans = transitions.find((t: any) => t.fromClipId === clip.id && t.toClipId === clip.id && t.alignment === 'end');
          // Append fade filters to existing video tag if intro/outro transitions exist (post-scale)
          if (introTrans) {
            const dur = Math.min(introTrans.duration, clip.timelineDuration * 0.5);
            const fadeColor = introTrans.color || introTrans.params?.color || '#000000';
            // Use fade filter with t=in
            const fadeTag = `v1_v${i}_fadein`;
            filterComplex.push(`[v1_v${i}]fade=t=in:st=0:d=${dur}:color=${fadeColor}[${fadeTag}]`);
            // Replace tag reference for later assembly
            const idx = v1VideoTags.indexOf(`[v1_v${i}]`);
            if (idx !== -1) v1VideoTags[idx] = `[${fadeTag}]`;
          }
          if (outroTrans) {
            const dur = Math.min(outroTrans.duration, clip.timelineDuration * 0.5);
            const fadeColor = outroTrans.color || outroTrans.params?.color || '#000000';
            // Need to compute start time: clip duration - dur
            const clipDur = clip.timelineDuration;
            const start = Math.max(0, clipDur - dur);
            const sourceTag = introTrans ? `v1_v${i}_fadein` : `v1_v${i}`;
            const fadeTag = `v1_v${i}_fadeout`;
            filterComplex.push(`[${sourceTag}]fade=t=out:st=${start}:d=${dur}:color=${fadeColor}[${fadeTag}]`);
            const idx = v1VideoTags.indexOf(introTrans ? `[v1_v${i}_fadein]` : `[v1_v${i}]`);
            if (idx !== -1) v1VideoTags[idx] = `[${fadeTag}]`;
          }
        }

        // Group V1 clips into xfade-connected segments
        interface ClipGroup { startIdx: number; endIdx: number; clipIndices: number[]; }
        const groups: ClipGroup[] = [];
        if (v1Clips.length > 0) {
          let currentGroupIndices: number[] = [0];
          for (let i = 1; i < v1Clips.length; i++) {
            const prevId = v1Clips[i - 1].id;
            const curId = v1Clips[i].id;
            const trans = findInterClipTransition(prevId, curId);
            if (trans) {
              currentGroupIndices.push(i);
            } else {
              groups.push({ startIdx: currentGroupIndices[0], endIdx: currentGroupIndices[currentGroupIndices.length - 1], clipIndices: [...currentGroupIndices] });
              currentGroupIndices = [i];
            }
          }
          groups.push({ startIdx: currentGroupIndices[0], endIdx: currentGroupIndices[currentGroupIndices.length - 1], clipIndices: [...currentGroupIndices] });
        }

        const groupVideoTags: string[] = [];
        const groupAudioTags: string[] = [];
        let xfadeCounter = 0;

        for (const group of groups) {
          if (group.clipIndices.length === 1) {
            const idx = group.clipIndices[0];
            // Single clip group — no xfade needed
            groupVideoTags.push(v1VideoTags[idx]);
            groupAudioTags.push(v1AudioTags[idx]);
          } else {
            // Multi-clip group with xfade chain between each consecutive pair
            let chainVTag = `v1_v${group.clipIndices[0]}`.replace(/[\[\]]/g, '');
            // Resolve actual tag name after fade processing
            const firstIdx = group.clipIndices[0];
            const firstTagMatch = v1VideoTags[firstIdx].match(/\[([^\]]+)\]/);
            chainVTag = firstTagMatch ? firstTagMatch[1] : chainVTag;
            let chainATag = `v1_a${firstIdx}`;
            // Audio chain similarly
            let runningDuration = v1Clips[firstIdx].timelineDuration;
            let currentV = chainVTag;
            let currentA = chainATag;
            for (let g = 1; g < group.clipIndices.length; g++) {
              const curIdx = group.clipIndices[g];
              const prevIdx = group.clipIndices[g - 1];
              const trans = findInterClipTransition(v1Clips[prevIdx].id, v1Clips[curIdx].id);
              const transDur = trans ? Math.min(trans.duration, runningDuration * 0.45, v1Clips[curIdx].timelineDuration * 0.45) : 0.5;
              const xfName = trans ? mapTransitionToXfade(trans.type, trans.direction) : 'fade';
              const offset = Math.max(0, runningDuration - transDur);
              const nextVTag = `xf_v${xfadeCounter}_${g}`;
              const nextATag = `xf_a${xfadeCounter}_${g}`;
              // Determine correct source tag for current curIdx (after fade processing)
              const curVTagMatch = v1VideoTags[curIdx].match(/\[([^\]]+)\]/);
              const curVTag = curVTagMatch ? curVTagMatch[1] : `v1_v${curIdx}`;
              filterComplex.push(`[${currentV}][${curVTag}]xfade=transition=${xfName}:duration=${transDur.toFixed(3)}:offset=${offset.toFixed(3)}[${nextVTag}]`);
              filterComplex.push(`[${currentA}][v1_a${curIdx}]acrossfade=d=${transDur.toFixed(3)}[${nextATag}]`);
              currentV = nextVTag;
              currentA = nextATag;
              runningDuration = runningDuration + v1Clips[curIdx].timelineDuration - transDur;
            }
            groupVideoTags.push(`[${currentV}]`);
            groupAudioTags.push(`[${currentA}]`);
            xfadeCounter++;
          }
        }

        // Final concat across groups (if multiple groups, they are hard-cut separated)
        const concatVTag = 'v1_concat';
        const concatATag = 'a1_concat';
        if (groupVideoTags.length > 1) {
          // Need paired video+audio per group for concat: interleave
          const concatInputs = groupVideoTags.map((v, i) => `${v}${groupAudioTags[i]}`).join('');
          filterComplex.push(`${concatInputs}concat=n=${groupVideoTags.length}:v=1:a=1[${concatVTag}][${concatATag}]`);
        } else if (groupVideoTags.length === 1) {
          filterComplex.push(`${groupVideoTags[0]}null[${concatVTag}]`);
          filterComplex.push(`${groupAudioTags[0]}anull[${concatATag}]`);
        } else {
          // Fallback single
          filterComplex.push(`${v1VideoTags[0]}null[${concatVTag}]`);
          filterComplex.push(`${v1AudioTags[0]}anull[${concatATag}]`);
        }

        let currentVTag = concatVTag;

        // Overlay V2 clips if present
        for (let k = 0; k < v2Clips.length; k++) {
          const v2 = v2Clips[k];
          const inputIdx = fileToIndex.get(v2.filePath) ?? 0;
          const isV2Img = isImageClip(v2);
          const start = Math.max(0, v2.startOffset || 0);
          const end = v2.endOffset && v2.endOffset > start ? v2.endOffset : (v2.duration || 10);
          const v2TimelineDur = Math.max(0.1, v2.timelineDuration || (end - start));
          const v2Filters = [];

          if (isV2Img) {
            v2Filters.push(`loop=loop=-1:size=1:start=0`, `trim=duration=${v2TimelineDur.toFixed(3)}`, `setpts=PTS-STARTPTS`);
          } else {
            v2Filters.push(`trim=start=${start}:end=${end}`, `setpts=PTS-STARTPTS`);
          }

          v2Filters.push(
            `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight},setsar=1`,
            ...compileAllClipFilters(v2, targetWidth, targetHeight)
          );

          const v2Tag = `v2_layer_${k}`;
          filterComplex.push(`[${inputIdx}:v]${v2Filters.join(',')}[${v2Tag}]`);

          const nextVTag = `v_overlay_${k}`;
          const tStart = v2.timelineStart || 0;
          const tEnd = tStart + v2TimelineDur;
          filterComplex.push(`[${currentVTag}][${v2Tag}]overlay=enable='between(t,${tStart.toFixed(3)},${tEnd.toFixed(3)})':x=0:y=0[${nextVTag}]`);
          currentVTag = nextVTag;
        }

        // Subtitle burn-in via libass
        let finalVTag = 'v_final';
        if (assSubtitlePath && fs.existsSync(assSubtitlePath)) {
          const normalizedSubPath = assSubtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:');
          filterComplex.push(`[${currentVTag}]ass='${normalizedSubPath}'[${finalVTag}]`);
        } else {
          filterComplex.push(`[${currentVTag}]null[${finalVTag}]`);
        }

        // Mix Audio
        let finalATag = concatATag;
        if (audioClips.length > 0) {
          const audioMixTags: string[] = [`[${concatATag}]`];
          for (let m = 0; m < audioClips.length; m++) {
            const ac = audioClips[m];
            const inputIdx = fileToIndex.get(ac.filePath) ?? 0;
            const delayMs = Math.max(0, Math.round((ac.timelineStart || 0) * 1000));
            const vol = ac.isMuted ? 0 : (ac.volume ?? 1.0);
            const aFilters = [
              `atrim=start=${ac.startOffset || 0}:end=${ac.endOffset || ac.duration || 30}`,
              `asetpts=PTS-STARTPTS`,
              `adelay=${delayMs}|${delayMs}`,
              `volume=${vol.toFixed(2)}`
            ];
            const aTag = `ac_${m}`;
            filterComplex.push(`[${inputIdx}:a]${aFilters.join(',')}[${aTag}]`);
            audioMixTags.push(`[${aTag}]`);
          }

          finalATag = 'a_mixed';
          filterComplex.push(`${audioMixTags.join('')}amix=inputs=${audioMixTags.length}:duration=longest[${finalATag}]`);
        }

        const isAudioOnly = ['.mp3', '.wav', '.aac', '.m4a', '.flac', '.ogg'].includes(ext);
        args.push('-filter_complex', filterComplex.join(';'));
        if (isAudioOnly) {
          args.push('-map', `[${finalATag}]`, '-vn');
        } else {
          args.push('-map', `[${finalVTag}]`, '-map', `[${finalATag}]`);
        }

        // Format specific encoding options
        const rawAudioBitrate = settings.audioBitrateKbps || settings.audioBitrate || 192;
        const resolvedAudioKbps = rawAudioBitrate >= 1000 ? Math.round(rawAudioBitrate / 1000) : rawAudioBitrate;
        const audioBitrateStr = `${resolvedAudioKbps || 192}k`;

        if (ext === '.mp3') {
          const mp3BitrateStr = `${resolvedAudioKbps || 320}k`;
          args.push('-c:a', 'libmp3lame', '-b:a', mp3BitrateStr, outputFilePath);
        } else if (ext === '.wav') {
          args.push('-c:a', 'pcm_s16le', outputFilePath);
        } else if (ext === '.gif') {
          args.push('-c:v', 'gif', outputFilePath);
        } else if (ext === '.webm') {
          args.push(
            '-c:v', 'libvpx-vp9',
            '-b:v', `${bitrateKbps}k`,
            '-r', String(fps),
            '-c:a', 'libopus',
            '-b:a', audioBitrateStr,
            outputFilePath
          );
        } else {
          // MP4 / MOV
          args.push(
            '-c:v', vcodec,
            '-preset', 'veryfast',
            '-threads', '0',
            '-b:v', `${bitrateKbps}k`,
            '-r', String(fps),
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', audioBitrateStr,
            '-movflags', '+faststart',
            outputFilePath
          );
        }

        const totalDuration = project.metadata?.duration || v1Clips.reduce((sum: number, c: any) => sum + (c.timelineDuration || 10), 0);

        const ffmpegProcess = spawn(this.ffmpegPath, args);
        this.activeJobs.set(jobId, ffmpegProcess);

        ffmpegProcess.stderr.on('data', (data) => {
          const text = data.toString();
          const timeMatch = text.match(/time=(\d+):(\d+):(\d+\.\d+)/);
          const fpsMatch = text.match(/fps=\s*(\d+(?:\.\d+)?)/);
          const speedMatch = text.match(/speed=\s*([\d\.]+)x/);
          const frameMatch = text.match(/frame=\s*(\d+)/);

          if (timeMatch) {
            const currentTime = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseFloat(timeMatch[3]);
            let percent = 0;
            if (totalDuration > 0) {
              percent = Math.min(99, Math.round((currentTime / totalDuration) * 100));
            }

            onProgress({
              jobId,
              projectId: project.metadata?.id || '',
              status: 'rendering',
              percent,
              fps: fpsMatch ? parseFloat(fpsMatch[1]) : undefined,
              currentFrame: frameMatch ? parseInt(frameMatch[1]) : undefined,
              speed: speedMatch ? `${speedMatch[1]}x` : undefined,
              outputFilePath
            });
          }
        });

        ffmpegProcess.on('close', (code) => {
          this.activeJobs.delete(jobId);
          if (code === 0 && fs.existsSync(outputFilePath)) {
            try {
              const stats = fs.statSync(outputFilePath);
              if (stats.size > 0) {
                onProgress({
                  jobId,
                  projectId: project.metadata?.id || '',
                  status: 'completed',
                  percent: 100,
                  outputFilePath
                });
                resolve(outputFilePath);
                return;
              }
            } catch (statErr) {}
          }

          const errorMsg = `FFmpeg export failed: ${code !== 0 ? `Process exited with code ${code}` : 'Output file was not generated or has 0 bytes.'}`;
          onProgress({
            jobId,
            projectId: project.metadata?.id || '',
            status: 'failed',
            percent: 0,
            error: errorMsg
          });
          reject(new Error(errorMsg));
        });

        ffmpegProcess.on('error', (err) => {
          this.activeJobs.delete(jobId);
          onProgress({
            jobId,
            projectId: project.metadata?.id || '',
            status: 'failed',
            percent: 0,
            error: err.message
          });
          reject(err);
        });
      } catch (err: any) {
        onProgress({
          jobId,
          projectId: project.metadata?.id || '',
          status: 'failed',
          percent: 0,
          error: err.message
        });
        reject(err);
      }
    });
  }

  /**
   * Cancel an active rendering job
   */
  public cancelJob(jobId: string): boolean {
    const process = this.activeJobs.get(jobId);
    if (process) {
      try {
        process.kill('SIGKILL');
        this.activeJobs.delete(jobId);
        return true;
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  /**
   * Extracts clean 16kHz mono uncompressed PCM WAV speech audio stream for Gemini multimodal ingestion
   * Robust with validation, specific errors, and progress (P2-P3, P8, P12-P13, P22-P23)
   */
  public async extractAudioForTranscription(filePath: string): Promise<string> {
    if (!fs.existsSync(filePath)) throw new Error(`Source file does not exist: ${filePath}`);
    const stats = fs.statSync(filePath);
    if (stats.size === 0) throw new Error('Selected file is empty (0 bytes). Please choose a valid video file.');
    if (stats.size > 4 * 1024 * 1024 * 1024) throw new Error('File exceeds 4GB — please use a smaller file or trim the video.');

    // P3: Detect audio stream before extraction via ffprobe
    let probe: MediaProbeResult | null = null;
    try {
      probe = await this.probeMedia(filePath);
      if (probe && probe.hasAudio === false) {
        throw new Error('This video does not contain an audio track.');
      }
      if (probe && probe.duration === 0) {
        throw new Error('Media file appears to be corrupt or empty (duration 0). Please re-import a valid video.');
      }
    } catch (probeErr: any) {
      if (probeErr?.message === 'This video does not contain an audio track.' || probeErr?.message?.includes('does not contain')) throw probeErr;
      console.warn('Probe before extraction warning (continuing):', probeErr?.message);
    }

    const tempDir = path.join(os.tmpdir(), 'captionforge_audio');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const baseName = path.basename(filePath, path.extname(filePath));
    const outputPath = path.join(tempDir, `${baseName}_16k_${Date.now()}.wav`);

    return new Promise((resolve, reject) => {
      const args = [
        '-y',
        '-i', filePath,
        '-vn',
        '-c:a', 'pcm_s16le',
        '-ar', '16000',
        '-ac', '1',
        outputPath
      ];

      execFile(this.ffmpegPath, args, (err, _stdout, stderr) => {
        if (err || !fs.existsSync(outputPath)) {
          const stderrStr = (stderr as any)?.toString() || err?.message || '';
          console.warn('FFmpeg speech audio extraction failed:', err, stderrStr);
          // P5: distinguish no audio vs unsupported codec vs corrupt
          if (stderrStr.includes('Output file #0 does not contain any stream') || stderrStr.includes('does not contain any stream')) {
            reject(new Error('This video does not contain an audio track.'));
            return;
          }
          if (stderrStr.includes('Unknown decoder') || stderrStr.includes('Decoder') || stderrStr.includes('Invalid data found')) {
            reject(new Error(`Unsupported audio codec or corrupt file. Convert to MP4 (H.264 + AAC) or WebM (VP9 + Opus) for widest support. Details: ${stderrStr.slice(0, 300)}`));
            return;
          }
          if (stderrStr.includes('Invalid argument') && stderrStr.includes('codec')) {
            reject(new Error(`Unsupported audio codec in this container. Try converting to MP4 (AAC).`));
            return;
          }
          // For large/long files, still try fallback if native probe said hasAudio but extraction failed due to container anomaly — fallback to original file
          if (probe && probe.hasAudio) {
            console.warn('Falling back to original container for Gemini (native can ingest MP4/WebM directly).');
            resolve(filePath);
            return;
          }
          reject(new Error(`Failed to extract audio: ${err?.message || 'Audio file not created'}. ${stderrStr.slice(0, 200)}`));
          return;
        }
        // P13 validate extracted audio
        try {
          const outStats = fs.statSync(outputPath);
          if (outStats.size < 1024) {
            fs.unlinkSync(outputPath);
            reject(new Error('Extracted audio is too short/empty. Check that the video contains audible speech.'));
            return;
          }
          // Check WAV header duration
          const fd = fs.openSync(outputPath, 'r');
          const header = Buffer.alloc(44);
          fs.readSync(fd, header, 0, 44, 0);
          fs.closeSync(fd);
          // Simple check: data chunk size
          const dataSize = header.readUInt32LE(40);
          if (dataSize < 32000) { // <1s at 16k mono 16-bit = 32000 bytes per sec
            // Allow short files but warn if <0.5s
            if (dataSize < 16000) {
              fs.unlinkSync(outputPath);
              reject(new Error('No audible speech detected — audio duration is too short. Check that the video volume is not muted.'));
              return;
            }
          }
        } catch (validateErr: any) {
          console.warn('Post-extraction validation warning:', validateErr?.message);
        }
        resolve(outputPath);
      });
    });
  }
}

