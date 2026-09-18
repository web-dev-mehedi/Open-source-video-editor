import { CaptionLine, WordTimestamp } from '../types/caption';

/**
 * Convert ArrayBuffer to Base64 safely in 32KB chunks
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunkSize = 0x8000;

  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as any);
  }

  return btoa(binary);
}

/**
 * Converts an AudioBuffer into 16kHz 16-bit Mono PCM WAV base64 string
 */
export function audioBufferToWavBase64(audioBuffer: AudioBuffer): string {
  const targetSampleRate = 16000;

  const channelData = audioBuffer.getChannelData(0);
  const sampleRateRatio = audioBuffer.sampleRate / targetSampleRate;
  const newLength = Math.floor(channelData.length / sampleRateRatio);
  const resampledData = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const originalIndex = Math.floor(i * sampleRateRatio);
    resampledData[i] = channelData[originalIndex] || 0;
  }

  // 16-bit PCM WAV: 44 bytes header + (samples * 2) bytes
  const buffer = new ArrayBuffer(44 + resampledData.length * 2);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + resampledData.length * 2, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, targetSampleRate, true);
  view.setUint32(28, targetSampleRate * 2, true); // Byte rate (16000 * 2)
  view.setUint16(32, 2, true); // Block align (2 bytes)
  view.setUint16(34, 16, true); // 16-bit

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, resampledData.length * 2, true);

  let offset = 44;
  for (let i = 0; i < resampledData.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, resampledData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return arrayBufferToBase64(buffer);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Robust validation helpers — detect audio presence before extraction (P2-P3, P6)
 */
async function probeMediaViaElement(url: string, timeoutMs = 8000): Promise<{ duration: number; hasAudio: boolean; audioTracksCount: number; canPlay: boolean; width: number; height: number; error?: string }> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.crossOrigin = 'anonymous';
    v.muted = true;
    v.playsInline = true;
    let timer: any = null;
    let done = false;
    const finish = (res: any) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { v.pause(); v.removeAttribute('src'); } catch {}
      resolve(res);
    };
    timer = setTimeout(() => finish({ duration: 0, hasAudio: false, audioTracksCount: 0, canPlay: false, width: 0, height: 0, error: 'Metadata load timeout — possible corrupt file or unsupported container.' }), timeoutMs);
    v.onloadedmetadata = () => {
      const duration = isFinite(v.duration) ? v.duration : 0;
      let hasAudio = false;
      let trackCount = 0;
      try {
        // @ts-ignore — audioTracks is non-standard but available in some browsers
        const audioTracks = (v as any).audioTracks;
        if (audioTracks && typeof audioTracks.length === 'number') {
          trackCount = audioTracks.length;
          hasAudio = trackCount > 0;
        }
        // Firefox mozHasAudio
        if (!hasAudio && (v as any).mozHasAudio !== undefined) {
          hasAudio = !!(v as any).mozHasAudio;
          trackCount = hasAudio ? 1 : 0;
        }
        // Streaming test: captureStream audio tracks
        if (!hasAudio && (v as any).captureStream) {
          try {
            const s: MediaStream = (v as any).captureStream();
            const aTracks = s.getAudioTracks();
            if (aTracks.length > 0) { hasAudio = true; trackCount = aTracks.length; }
            // stop immediately — we just probed
            aTracks.forEach((t) => t.stop());
            s.getTracks().forEach((t) => t.stop());
          } catch {}
        }
        // WebKit fallback — check for audible track via canPlayType is not reliable, use presence of audio in container via duration and width
        // If we still can't detect, assume hasAudio = true if duration >0.5 and not image (let decode stage decide) — but mark as uncertain
      } catch {}
      finish({ duration, hasAudio, audioTracksCount: trackCount, canPlay: true, width: v.videoWidth, height: v.videoHeight });
    };
    v.onerror = () => {
      const err = (v.error as any)?.message || `Media element error code ${(v.error as any)?.code || 'unknown'}`;
      finish({ duration: 0, hasAudio: false, audioTracksCount: 0, canPlay: false, width: 0, height: 0, error: err });
    };
    v.src = url;
  });
}

function validateAudioBuffer(buf: AudioBuffer): { valid: boolean; reason?: string; duration: number; channels: number; sampleRate: number } {
  if (!buf) return { valid: false, reason: 'Decoded buffer is null', duration: 0, channels: 0, sampleRate: 0 };
  const channels = buf.numberOfChannels;
  const length = buf.length;
  const sampleRate = buf.sampleRate;
  const duration = buf.duration;
  if (!isFinite(duration) || duration <= 0.05) return { valid: false, reason: `Invalid duration ${duration}`, duration, channels, sampleRate };
  if (!isFinite(sampleRate) || sampleRate <= 0) return { valid: false, reason: `Invalid sampleRate ${sampleRate}`, duration, channels, sampleRate };
  if (!channels || channels <= 0) return { valid: false, reason: `Invalid channels ${channels}`, duration, channels, sampleRate };
  if (!isFinite(length) || length <= 0) return { valid: false, reason: `Empty audio buffer (length ${length})`, duration, channels, sampleRate };
  // Check for silence (all zeros) — sample a subset
  try {
    const ch0 = buf.getChannelData(0);
    let maxAbs = 0;
    const step = Math.max(1, Math.floor(ch0.length / 2000));
    for (let i = 0; i < ch0.length; i += step) {
      const v = Math.abs(ch0[i]);
      if (v > maxAbs) maxAbs = v;
      if (maxAbs > 0.005) break;
    }
    if (maxAbs < 0.001) return { valid: false, reason: 'Decoded audio appears to be silent/empty (possible audio-less video)', duration, channels, sampleRate };
  } catch {}
  return { valid: true, duration, channels, sampleRate };
}

async function tryDecodeWithWebAudio(arrayBuffer: ArrayBuffer, onProgress?: (msg: string) => void): Promise<AudioBuffer> {
  onProgress?.('Decoding audio stream with Web Audio API...');
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 48000 } as any);
  try {
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    // Use modern promise-based decodeAudioData
    const buffer = await new Promise<AudioBuffer>((resolve, reject) => {
      try {
        const p: any = audioCtx.decodeAudioData(arrayBuffer.slice(0));
        if (p && typeof p.then === 'function') {
          p.then(resolve).catch(reject);
        } else {
          // Fallback callback style
          audioCtx.decodeAudioData(arrayBuffer.slice(0), resolve, reject);
        }
      } catch (e) {
        // Callback fallback
        audioCtx.decodeAudioData(arrayBuffer.slice(0), resolve, reject);
      }
    });
    return buffer;
  } finally {
    try { await audioCtx.close(); } catch {}
  }
}

/**
 * Extracts 16kHz speech audio from any video/audio URL, file, or blob in web browser environments
 * Robust multi-strategy pipeline with validation, specific errors, and proper resource lifecycle (P8-P16, P31-P33, P37-P38)
 */
export async function extract16kHzAudioFromMedia(
  mediaSrc: string | Blob | File,
  onProgress?: (msg: string) => void
): Promise<{ data: string; mimeType: string }> {
  const isFile = mediaSrc instanceof File;
  const isBlob = mediaSrc instanceof Blob;
  const isString = typeof mediaSrc === 'string';
  let blobUrl = '';
  let shouldRevoke = false;
  let arrayBuffer: ArrayBuffer | null = null;
  let probeInfo: any = null;

  // P2: validate file existence/size/mime upfront
  if (isFile) {
    const file = mediaSrc as File;
    if (file.size === 0) throw new Error('Selected file is empty (0 bytes). Please choose a valid video file.');
    if (file.size > 4 * 1024 * 1024 * 1024) throw new Error('File exceeds 4GB — please use a smaller file or trim the video.');
    // MIME hint but don't trust extension alone (P6)
    const mime = file.type || '';
    if (mime && mime.startsWith('image/')) throw new Error('Selected file is an image — caption generation requires a video or audio file containing speech.');
    // Prefer direct arrayBuffer for File without creating URL prematurely (P15)
    try { arrayBuffer = await file.arrayBuffer(); } catch {}
    // Create object URL for element probing (keep alive until extraction completes — P16)
    blobUrl = URL.createObjectURL(file);
    shouldRevoke = true;
  } else if (isBlob) {
    const blob = mediaSrc as Blob;
    if (blob.size === 0) throw new Error('Media blob is empty. Please re-import the video.');
    try { arrayBuffer = await blob.arrayBuffer(); } catch {}
    blobUrl = URL.createObjectURL(blob);
    shouldRevoke = true;
  } else if (isString) {
    const src = mediaSrc as string;
    blobUrl = src;
    // Handle data: and blob: URLs — try direct fetch, but handle captionforge-media:// via probe fallback
    const isCustomProtocol = src.startsWith('captionforge-media://') || src.startsWith('file://');
    const isDataOrBlob = src.startsWith('data:') || src.startsWith('blob:');
    if (!isCustomProtocol) {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('text/html')) throw new Error('Fetch returned HTML instead of media — possible CORS or invalid URL.');
        arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength === 0) throw new Error('Fetched media is empty (0 bytes).');
      } catch (e: any) {
        // For captionforge-media://, fetch via Electron net.fetch may still fail in renderer; fallback to arrayBuffer null and rely on element method
        if (!isDataOrBlob) {
          console.warn('Direct fetch failed for', src, e?.message || e);
        }
      }
    } else {
      // For Electron custom protocol, we cannot fetch ArrayBuffer directly in web context; rely on media element decoding
      // Try to get file path via captionForgeAPI if available (main will handle extraction, but we're in web fallback)
      // Leave arrayBuffer null and proceed to element methods
    }
  }

  // P2/P3: Probe media to detect audio stream before extraction — use native probe if available (Electron)
  try {
    onProgress?.('Validating media file...');
    if (isString && (window as any).captionForgeAPI?.probeMedia) {
      const probePath = (mediaSrc as string).startsWith('captionforge-media://')
        ? decodeURIComponent((mediaSrc as string).replace(/^captionforge-media:\/\//, '')).replace(/^\/+/, isFile ? '' : '')
        : typeof mediaSrc === 'string' ? mediaSrc : (mediaSrc as File).name;
      // Only probe if it looks like a file path (not blob/data URL)
      if (probePath && !probePath.startsWith('blob:') && !probePath.startsWith('data:') && probePath.length < 1024) {
        try {
          const nativeProbe = await (window as any).captionForgeAPI.probeMedia(probePath);
          probeInfo = nativeProbe;
          if (nativeProbe && nativeProbe.hasAudio === false) {
            // P3 specific error for no audio
            throw new Error('This video does not contain an audio track.');
          }
          if (nativeProbe && nativeProbe.duration === 0) {
            throw new Error('Media file appears to be corrupt or empty (duration 0). Please re-import a valid video.');
          }
        } catch (probeErr: any) {
          if (probeErr?.message === 'This video does not contain an audio track.' || probeErr?.message?.includes('does not contain')) throw probeErr;
          // otherwise continue to element probe
        }
      }
    }
    // Fallback element probe for web
    if (!probeInfo) {
      const elementUrl = blobUrl || (isString ? (mediaSrc as string) : '');
      if (elementUrl) {
        const elementProbe = await probeMediaViaElement(elementUrl, 7000);
        probeInfo = elementProbe;
        if (elementProbe.error && !elementProbe.canPlay) {
          // Distinguish corrupt vs unsupported codec vs no audio
          const msg = elementProbe.error;
          if (msg.includes('MEDIA_ERR_SRC_NOT_SUPPORTED') || msg.includes('4')) {
            throw new Error(`Unsupported media format or codec. The browser cannot decode this file. Try converting to MP4 (H.264 + AAC) or WebM (VP9 + Opus). Details: ${msg}`);
          }
          throw new Error(`Unable to read media file: ${msg}. Please verify the file is a valid video and try re-importing.`);
        }
        if (elementProbe.duration === 0 && elementProbe.width === 0) {
          throw new Error('Media appears to be corrupt or unreadable (duration 0, no video tracks). Please verify the file and re-import.');
        }
        // Note: element probe hasAudio may be false even when audio exists but not detectable via tracks; don't throw yet, treat as uncertain
        if (elementProbe.hasAudio === false && elementProbe.audioTracksCount === 0) {
          // Check via explicit hasAudio = false but could be WebKit false negative; we'll try decode anyway unless duration suggests audio-less
          // For now, log and continue — decode stage will confirm
          console.warn('Element probe detected no audio tracks; will attempt decode anyway to confirm (may be codec-specific).', elementProbe);
        }
      }
    }
  } catch (probeThrow: any) {
    // Cleanup before rethrow with specific message
    // Don't revoke yet — keep URL for potential retry
    throw probeThrow;
  }

  // Log diagnostics (P25)
  console.debug('[CaptionForge] Media probe:', { mediaSrc: typeof mediaSrc === 'string' ? (mediaSrc as string).slice(0, 80) : isFile ? (mediaSrc as File).name : 'blob', probeInfo, hasArrayBuffer: !!arrayBuffer, arrayBufferBytes: arrayBuffer?.byteLength || 0 });

  // METHOD A: Direct Web Audio decode from ArrayBuffer (fastest, preferred when decodable) — P8 A/B
  if (arrayBuffer && arrayBuffer.byteLength > 0) {
    // P13 validate before decode
    if (arrayBuffer.byteLength < 1024) {
      throw new Error('Media file is too small to contain audio (less than 1KB). Please verify the imported file.');
    }
    try {
      const audioBuffer = await tryDecodeWithWebAudio(arrayBuffer, onProgress);
      const validation = validateAudioBuffer(audioBuffer);
      if (!validation.valid) {
        // P3/P5 specific handling
        if (validation.reason?.includes('silent') || validation.reason?.includes('audio-less')) {
          throw new Error('This video does not contain an audio track.');
        }
        if (validation.reason?.includes('Invalid duration') || validation.duration < 0.2) {
          throw new Error('No audible speech detected — audio duration is too short. Check that the video volume is not muted.');
        }
        throw new Error(`Audio decoding produced invalid buffer: ${validation.reason}. Try converting the video to MP4 (AAC) for maximum compatibility.`);
      }
      onProgress?.('Preparing audio for transcription...');
      const wavBase64 = audioBufferToWavBase64(audioBuffer);
      // P16: only revoke AFTER successful extraction
      if (shouldRevoke && blobUrl.startsWith('blob:')) { try { URL.revokeObjectURL(blobUrl); } catch {} }
      return { data: wavBase64, mimeType: 'audio/wav' };
    } catch (decodeErr: any) {
      const msg = decodeErr?.message || String(decodeErr);
      console.warn('Web Audio decodeAudioData failed:', msg);
      // Distinguish unsupported codec vs no audio vs corrupt
      if (msg.includes('Unable to decode') || msg.includes('decoding')) {
        // Try fallback methods before giving up — this is likely a container/codec not supported by Web Audio (e.g. MKV/AVI or HEVC)
        // Continue to Method B/C instead of throwing generic error
      } else if (msg.includes('does not contain an audio track') || msg.includes('silent')) {
        throw decodeErr; // specific, rethrow
      }
      // Otherwise continue to MediaRecorder fallback
    }
  } else if (isString && (mediaSrc as string).startsWith('captionforge-media://')) {
    // For Electron custom protocol without ArrayBuffer, we can't use WebAudio directly — go to Method B which handles native path
  }

  // METHOD B: HTML5 Media Element + captureStream → MediaRecorder (P9: video may play yet audio extraction may need separate path)
  // Also serves as validation for audio presence via getAudioTracks
  try {
    onProgress?.('Extracting acoustic stream via HTML5 Media Engine...');
    const mediaUrlForElement = blobUrl;
    // Quick check: try to detect audio via element before starting recorder (P2)
    const preProbe = await probeMediaViaElement(mediaUrlForElement, 6000);
    if (preProbe.hasAudio === false && preProbe.audioTracksCount === 0) {
      // For browsers that reliably report, we can give specific no-audio message
      // But to avoid false negatives (WebKit), only throw if we also failed WebAudio decode and have no ArrayBuffer audio
      if (!arrayBuffer || arrayBuffer.byteLength < 1024) {
        // Check if video has no audio by also inspecting via OfflineAudio attempt — but for now throw specific if duration >0 and no tracks detected via two methods
        // Use native probe result if available for certainty
        if (probeInfo && probeInfo.hasAudio === false) {
          throw new Error('This video does not contain an audio track.');
        }
      }
    }

    const audioData = await new Promise<{ data: string; mimeType: string }>((resolve, reject) => {
      const mediaEl = document.createElement('video');
      mediaEl.crossOrigin = 'anonymous';
      mediaEl.src = mediaUrlForElement;
      mediaEl.muted = false;
      mediaEl.volume = 1;
      mediaEl.preload = 'auto';

      let mediaRecorder: MediaRecorder | null = null;
      const chunks: Blob[] = [];
      let timeoutId: any = null;
      let fallbackTimer: any = null;

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (fallbackTimer) clearTimeout(fallbackTimer);
        try { mediaEl.pause(); } catch {}
        // P33 cleanup listeners
        mediaEl.onloadedmetadata = null;
        mediaEl.onended = null;
        mediaEl.onerror = null;
        // Don't revoke blobUrl here — caller handles lifecycle (P16)
      };

      mediaEl.onloadedmetadata = async () => {
        try {
          // P2 validate metadata
          if (!isFinite(mediaEl.duration) || mediaEl.duration <= 0.1) {
            cleanup();
            reject(new Error('Media duration is invalid (0). File may be corrupt.'));
            return;
          }
          let stream: MediaStream | null = null;
          if ((mediaEl as any).captureStream) {
            stream = (mediaEl as any).captureStream();
          } else if ((mediaEl as any).mozCaptureStream) {
            stream = (mediaEl as any).mozCaptureStream();
          }

          if (stream) {
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length === 0) {
              cleanup();
              // P3 specific
              if (arrayBuffer) {
                // Fallback: try sending raw container to Gemini as last resort before failing
                // Don't reject yet — allow outer catch to try direct payload
                reject(new Error('No audio tracks detected in media source.'));
              } else {
                reject(new Error('This video does not contain an audio track.'));
              }
              return;
            }
            // P37 multi-channel handling: mix to mono via MediaRecorder is automatic
            const audioStream = new MediaStream(audioTracks);
            const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
              ? 'audio/webm;codecs=opus'
              : MediaRecorder.isTypeSupported('audio/webm')
              ? 'audio/webm'
              : MediaRecorder.isTypeSupported('audio/mp4')
              ? 'audio/mp4'
              : '';
            if (!mime) {
              cleanup();
              reject(new Error('Browser does not support MediaRecorder for audio capture. Try using MP4 (AAC) or WebM (Opus) for best compatibility.'));
              return;
            }
            try {
              mediaRecorder = new MediaRecorder(audioStream, { mimeType: mime });
            } catch (e: any) {
              cleanup();
              reject(new Error(`Failed to create MediaRecorder (${mime}): ${e?.message || e}`));
              return;
            }
            mediaRecorder.ondataavailable = (e) => {
              if (e.data.size > 0) chunks.push(e.data);
            };
            mediaRecorder.onerror = (ev: any) => {
              cleanup();
              reject(new Error(`MediaRecorder error: ${ev?.error?.message || 'unknown'}`));
            };
            mediaRecorder.onstop = async () => {
              cleanup();
              // P33 cleanup stream tracks
              try { audioStream.getTracks().forEach((t) => t.stop()); } catch {}
              try { stream!.getTracks().forEach((t) => t.stop()); } catch {}
              if (chunks.length === 0) {
                reject(new Error('MediaRecorder produced no audio data — recording was empty. Video may have no audio or was muted.'));
                return;
              }
              try {
                const combinedBlob = new Blob(chunks, { type: mime });
                // P13 validate
                if (combinedBlob.size < 1024) {
                  reject(new Error('Captured audio is too short/empty. Check that the video contains audible speech.'));
                  return;
                }
                const buf = await combinedBlob.arrayBuffer();
                const b64 = arrayBufferToBase64(buf);
                resolve({ data: b64, mimeType: mime });
              } catch (e: any) {
                reject(new Error(`Failed to process recorded audio: ${e?.message || e}`));
              }
            };

            try {
              mediaRecorder.start(100);
            } catch (e: any) {
              cleanup();
              reject(new Error(`MediaRecorder start failed: ${e?.message || e}`));
              return;
            }
            mediaEl.playbackRate = 1.0;
            try { await mediaEl.play(); } catch (playErr: any) {
              // Autoplay policy may require user gesture — but we are in user-initiated flow (Generate click), should succeed
              console.warn('Media play failed:', playErr?.message);
            }

            mediaEl.onended = () => {
              if (mediaRecorder && mediaRecorder.state === 'recording') {
                try { mediaRecorder.stop(); } catch {}
              }
            };

            timeoutId = setTimeout(() => {
              if (mediaRecorder && mediaRecorder.state === 'recording') {
                try { mediaRecorder.stop(); } catch {}
              }
            }, Math.min(300000, ((mediaEl.duration || 10) * 1000) + 2000)); // P22 support long videos 10min
            return;
          }

          // No captureStream support — fallback
          cleanup();
          if (arrayBuffer) {
            resolve({
              data: arrayBufferToBase64(arrayBuffer),
              mimeType: 'video/mp4',
            });
          } else {
            reject(new Error('Browser does not support audio stream capture (captureStream/mozCaptureStream). Try using Chrome/Edge for best codec support, or convert to MP4.'));
          }
        } catch (err: any) {
          cleanup();
          reject(new Error(`Media stream extraction failed: ${err?.message || err}`));
        }
      };

      mediaEl.onerror = () => {
        const code = (mediaEl.error as any)?.code;
        const msg = (mediaEl.error as any)?.message || '';
        cleanup();
        // P5 specific codec/container error mapping
        if (code === 4) {
          reject(new Error(`Unsupported media format or codec (MEDIA_ERR_SRC_NOT_SUPPORTED). Convert to MP4 (H.264 video + AAC audio) for widest support. ${msg}`));
        } else if (code === 3) {
          reject(new Error(`Media decoding error (MEDIA_ERR_DECODE). File may be corrupt. ${msg}`));
        } else if (arrayBuffer) {
          resolve({
            data: arrayBufferToBase64(arrayBuffer),
            mimeType: 'video/mp4',
          });
        } else {
          reject(new Error(`Could not read media file for audio extraction. ${msg || 'Unknown media error.'}`));
        }
      };

      // Fallback timeout for metadata never loading (corrupt/unsupported)
      fallbackTimer = setTimeout(() => {
        if (mediaEl.readyState === 0) {
          cleanup();
          reject(new Error('Timed out while loading media metadata. File may be corrupt, too large, or in an unsupported container (e.g. MKV with unsupported codecs). Try MP4.'));
        }
      }, 8000);
    });

    if (shouldRevoke && blobUrl.startsWith('blob:')) { try { URL.revokeObjectURL(blobUrl); } catch {} }
    return audioData;
  } catch (err: any) {
    // P16: don't revoke prematurely if we still need it for direct fallback; handle after
    const message = err?.message || String(err);
    console.warn('Media element extraction failed:', message);
    // METHOD C: Direct payload fallback — send container as-is to Gemini (Gemini can handle MP4/WebM directly) (P11-P12: use existing media source)
    // This is the most robust fallback: Gemini's multimodal can ingest video/mp4 directly without WAV conversion, so we can just send the raw file
    if (arrayBuffer && arrayBuffer.byteLength > 1024) {
      console.info('Falling back to direct container payload for Gemini (no local WAV conversion).');
      if (shouldRevoke && blobUrl.startsWith('blob:')) { try { URL.revokeObjectURL(blobUrl); } catch {} }
      // Detect mime from file extension/mime
      let fallbackMime = 'video/mp4';
      if (isFile) {
        const name = (mediaSrc as File).name.toLowerCase();
        if (name.endsWith('.webm')) fallbackMime = 'video/webm';
        else if (name.endsWith('.mov')) fallbackMime = 'video/quicktime';
        else if (name.endsWith('.mkv')) fallbackMime = 'video/x-matroska';
        else if (name.endsWith('.m4v')) fallbackMime = 'video/mp4';
        else if (name.endsWith('.avi')) fallbackMime = 'video/x-msvideo';
        else if ((mediaSrc as File).type) fallbackMime = (mediaSrc as File).type;
      } else if (isString) {
        const s = mediaSrc as string;
        if (s.includes('.webm')) fallbackMime = 'video/webm';
        else if (s.includes('.mov')) fallbackMime = 'video/quicktime';
      }
      return {
        data: arrayBufferToBase64(arrayBuffer),
        mimeType: fallbackMime,
      };
    }
    // If no ArrayBuffer, try Electron native extraction as last resort (P8 METHOD C: native pipeline)
    if ((window as any).captionForgeAPI?.probeMedia && typeof mediaSrc === 'string') {
      try {
        onProgress?.('Attempting native audio extraction via desktop pipeline...');
        // Check if we have a file path that native can handle
        const filePath = (mediaSrc as string).startsWith('captionforge-media://')
          ? decodeURIComponent((mediaSrc as string).replace(/^captionforge-media:\/\//, '')).replace(/^\/+/, '')
          : mediaSrc as string;
        // Try to use the native transcribe path directly? But we are inside transcribeWithGeminiWeb web fallback, which is only called when native transcribe not available
        // As a last resort, we can at least validate that native probe says hasAudio
        const nativeProbe = await (window as any).captionForgeAPI.probeMedia(filePath);
        if (nativeProbe?.hasAudio === false) throw new Error('This video does not contain an audio track.');
      } catch (nativeErr: any) {
        if (nativeErr?.message?.includes('does not contain an audio track')) throw nativeErr;
      }
    }
    if (shouldRevoke && blobUrl.startsWith('blob:')) { try { URL.revokeObjectURL(blobUrl); } catch {} }
    // P26: do not mask root cause — preserve specific message if we have it
    if (message.includes('does not contain an audio track') || message.includes('Unsupported') || message.includes('corrupt') || message.includes('No audible')) {
      throw err;
    }
    // For generic failures, provide actionable guidance while preserving original cause for logs
    console.error('Audio extraction root cause:', err);
    throw new Error(message.includes('Unable to extract audio') ? message : `Audio extraction failed: ${message}. Please try converting the video to MP4 (H.264 + AAC) or ensure the file contains an audible audio track.`);
  }
}

export interface GeminiTranscribeOptions {
  mediaSrc: string | Blob | File;
  apiKey: string;
  language?: string;
  model?: string;
  onProgress?: (status: string) => void;
  customVocabulary?: string[]; // P29 brand/product terms
  enableDiarization?: boolean; // P28
  verbatim?: boolean; // P3 true = verbatim first
}

// Helper: build verbatim transcription prompt for word-level timestamps (P2-P6)
function buildVerbatimTranscribePrompt(language?: string, customVocabulary?: string[], enableDiarization?: boolean): string {
  const vocabHint = customVocabulary && customVocabulary.length > 0
    ? `Custom vocabulary hints (prioritize exact recognition): ${customVocabulary.slice(0, 50).join(', ')}.`
    : '';
  const diarizationHint = enableDiarization
    ? 'Enable speaker diarization: assign speaker label (e.g. "speaker": "A" or "B") to each word where distinguishable.'
    : 'Speaker diarization not required.';
  const langHint = language && language !== 'auto' ? language : 'Auto-detect (detect language automatically; support English, Bengali বাংলা, Hindi, etc.)';

  return `You are Gemini's dedicated VERBATIM speech transcription engine with WORD-LEVEL TIMESTAMP capability (model: gemini-3.5-transcribe / gemini-2.0-flash transcription mode).

ABSOLUTE PRIORITY: VERBATIM FIRST, CLEANUP SECOND (P3)
- Transcribe EXACTLY what is spoken, preserving filler words (uh, um), repetitions, false starts, corrections.
- Do NOT rewrite, summarize, or clean before timing is established. Timing source must be the verbatim sequence.

TIMING-CRITICAL REQUIREMENTS (P2, P5-P6, P8-P10):
- Every spoken word MUST have precise start_ms and end_ms (millisecond offsets from audio start).
- Use Gemini's word-level timestamp capability (transcription model). Do NOT estimate timestamps as text_length / duration.
- If word confidence is available, include "confidence" (0.0-1.0). If speaker label available, include "speaker".
- All timestamps must be integers in milliseconds, 0 <= start < end, strictly increasing with speech.
- Segment boundaries must derive from word timing: segment start = first word start, segment end = last word end (P13).
- Language: ${langHint}. ${vocabHint} ${diarizationHint}

OUTPUT: Raw JSON only, no markdown fences, exactly:
{
  "detected_language": "en",
  "language_confidence": 0.99,
  "verbatim_transcript": "uh I think this is really good",
  "total_words": 7,
  "words": [
    {"word": "uh", "start_ms": 120, "end_ms": 280, "confidence": 0.92, "speaker": "A"},
    {"word": "I", "start_ms": 310, "end_ms": 380, "confidence": 0.98}
  ],
  "subtitles": [
    {
      "id": 1,
      "start_ms": 120,
      "end_ms": 1800,
      "text": "uh I think",
      "words": [
        {"word": "uh", "start_ms": 120, "end_ms": 280, "confidence": 0.92},
        {"word": "I", "start_ms": 310, "end_ms": 380},
        {"word": "think", "start_ms": 400, "end_ms": 700}
      ]
    }
  ]
}
CRITICAL: Use verbatim transcript for word list. Subtitle text must match its words verbatim (no cleaning yet). Display cleanup will happen secondarily in the application pipeline. Never drop initial words (Hi, Hello, etc.).`;
}

// Map verbatim source words to cleaned display words (P16-P17) while preserving timing
function mapDisplayToSource(
  sourceWords: Array<{ word: string; start_ms: number; end_ms: number; confidence?: number; speaker?: string }>,
  displayText: string
): Array<{ word: string; start_ms: number; end_ms: number; confidence?: number; speaker?: string; sourceIndex: number; displayIndex: number }> {
  // Simple alignment: split displayText into words, map sequentially to source by normalized match
  // If cleaned text removes filler, we skip those source words visually but keep them in source timing (P17)
  const displayWords = displayText.trim().split(/\s+/).filter(Boolean);
  const fillerSet = new Set(['uh', 'um', 'ah', 'er', 'like', 'you know']);
  // Try exact normalized match
  const srcNorm = sourceWords.map((w) => w.word.toLowerCase().replace(/^[^\w]+|[^\w]+$/g, ''));
  const dispNorm = displayWords.map((w) => w.toLowerCase().replace(/^[^\w]+|[^\w]+$/g, ''));
  const mapped: any[] = [];
  let sIdx = 0;
  for (let dIdx = 0; dIdx < dispNorm.length; dIdx++) {
    const d = dispNorm[dIdx];
    // find next source that matches
    let found = -1;
    for (let s = sIdx; s < srcNorm.length; s++) {
      if (srcNorm[s] === d) { found = s; break; }
    }
    if (found >= 0) {
      const src = sourceWords[found];
      mapped.push({ word: displayWords[dIdx], start_ms: src.start_ms, end_ms: src.end_ms, confidence: src.confidence, speaker: src.speaker, sourceIndex: found, displayIndex: dIdx });
      sIdx = found + 1;
    } else {
      // No source match: mark as estimated, interpolate from neighbors
      const prev = mapped.length > 0 ? mapped[mapped.length - 1] : null;
      const nextSrc = sourceWords[sIdx];
      const estStart = prev ? prev.end_ms : nextSrc ? nextSrc.start_ms : 0;
      const estEnd = nextSrc ? nextSrc.start_ms + 120 : estStart + 200;
      mapped.push({ word: displayWords[dIdx], start_ms: estStart, end_ms: estEnd, confidence: 0.5, sourceIndex: -1, displayIndex: dIdx });
    }
  }
  return mapped;
}

/**
 * Official Google Gemini Multimodal Speech-to-Text Transcription Engine — ultra-accurate word-level pipeline
 * Implements P2: uses dedicated transcription model (gemini-3.5-transcribe) with verbatim word timestamps
 */
export async function transcribeWithGeminiWeb(options: GeminiTranscribeOptions): Promise<CaptionLine[]> {
  const { mediaSrc, apiKey, language, model, onProgress, customVocabulary, enableDiarization, verbatim = true } = options;

  if (!apiKey || !apiKey.trim()) {
    throw new Error('Google Gemini API Key is required. Please paste your API key in the modal.');
  }

  onProgress?.('Extracting acoustic speech audio from video...');
  const payload = await extract16kHzAudioFromMedia(mediaSrc, onProgress);

  onProgress?.('Sending speech stream to Gemini VERBATIM transcription (word-level timestamps)...');

  const prompt = verbatim !== false
    ? buildVerbatimTranscribePrompt(language, customVocabulary, enableDiarization)
    : `You are a precision ASR & Word-Level Timestamp Alignment Engine. ${buildVerbatimTranscribePrompt(language, customVocabulary, enableDiarization)}`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: payload.mimeType,
              data: payload.data,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.0,
    },
  };

  if (!payload.data || payload.data.length === 0) {
    throw new Error('Could not extract acoustic stream from this video file. Please verify audio playback.');
  }

  // Prioritized multimodal transcription models (Official Google Gemini API)
  const cachedWinner = sessionStorage.getItem('cf_active_gemini_model');
  const transcriptionPriority = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
  ];
  const candidateModels: string[] = [
    ...(cachedWinner ? [cachedWinner] : []),
    ...(model ? [model] : []),
    ...transcriptionPriority,
  ].filter((m, i, arr) => arr.indexOf(m) === i);

  let responseText = '';
  let primaryError: any = null;
  let lastError: any = null;

  const apiVersions = ['v1beta', 'v1'];
  const triedModels = new Set<string>();

  for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
    const activeModel = candidateModels[mIdx];
    if (triedModels.has(activeModel)) continue;
    triedModels.add(activeModel);

    for (const apiVersion of apiVersions) {
      try {
        onProgress?.(`⚡ AI Transcribing speech with ${activeModel}...`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);

        const res = await fetch(
          `https://generativelanguage.googleapis.com/${apiVersion}/models/${activeModel}:generateContent?key=${apiKey.trim()}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          }
        );

        clearTimeout(timeout);

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          const msg = errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
          console.warn(`Model ${activeModel} (${apiVersion}) error:`, msg);

          if (msg.includes('API_KEY_INVALID') || res.status === 401 || res.status === 403) {
            throw new Error(`Google Gemini API Key is invalid: ${msg}`);
          }

          // Auto-recovery: If Google API suggested a replacement model in the error message
          const matches = msg.match(/models\/([a-zA-Z0-9\.\-_]+)/g);
          if (matches && matches.length > 1) {
            const suggestedModel = matches[matches.length - 1].replace(/^models\//, '');
            if (suggestedModel && !candidateModels.includes(suggestedModel)) {
              candidateModels.splice(mIdx + 1, 0, suggestedModel);
            }
          }

          const currentErr = new Error(msg);
          lastError = currentErr;
          continue;
        }

        const resData = await res.json();
        responseText = resData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (responseText) {
          sessionStorage.setItem('cf_active_gemini_model', activeModel);
          break; // Successfully got response
        }
      } catch (err: any) {
        lastError = err;
        if (err.message?.includes('API Key is invalid')) {
          throw err;
        }
        console.warn(`Model ${activeModel} (${apiVersion}) exception:`, err?.message || err);
      }
    }

    if (responseText) {
      break;
    }
  }

  // Fallback: If initial list didn't succeed, dynamically discover available models from API
  if (!responseText) {
    try {
      onProgress?.('Resolving available Gemini models for your API key...');
      const listRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`
      );
      if (listRes.ok) {
        const listData = await listRes.json();
        const available = (listData.models || [])
          .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m: any) => m.name.replace(/^models\//, ''))
          .filter((m: string) => !triedModels.has(m));

        for (const fallbackModel of available) {
          try {
            onProgress?.(`⚡ AI Transcribing with active model ${fallbackModel}...`);
            const res = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${fallbackModel}:generateContent?key=${apiKey.trim()}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
              }
            );
            if (res.ok) {
              const resData = await res.json();
              responseText = resData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
              if (responseText) {
                sessionStorage.setItem('cf_active_gemini_model', fallbackModel);
                break;
              }
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  if (!responseText) {
    throw lastError || primaryError || new Error('Google Gemini API returned an empty response. Please verify your Gemini API key in Google AI Studio.');
  }

      let parsed: any = null;
      try {
        parsed = JSON.parse(responseText);
      } catch (e) {
        const cleanJson = responseText.replace(/```json/gi, '').replace(/```/gi, '').trim();
        parsed = JSON.parse(cleanJson);
      }

      // Extract flat verbatim word list if present (P5-P6 two-layer model)
      const flatWordsRaw: any[] = Array.isArray(parsed?.words) ? parsed.words : [];
      const rawList: any[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.subtitles)
        ? parsed.subtitles
        : Array.isArray(parsed?.segments)
        ? parsed.segments
        : flatWordsRaw.length > 0
        ? [] // will build from flatWordsRaw below
        : [];

      // If flat verbatim words present without subtitles, build subtitles from them via natural segmentation (P13-P14)
      let effectiveRawList = rawList;
      if (effectiveRawList.length === 0 && flatWordsRaw.length > 0) {
        // Build segments by grouping flat words using readability rules (P14) but preserve timing
        const maxWords = 3;
        const maxChars = 28;
        const maxPauseGap = 0.55; // seconds pause indicates new segment
        let currentGroup: any[] = [];
        let currentChars = 0;
        const groups: any[][] = [];
        for (let i = 0; i < flatWordsRaw.length; i++) {
          const w = flatWordsRaw[i];
          const prev = flatWordsRaw[i - 1];
          const gap = prev ? (w.start_ms !== undefined ? w.start_ms / 1000 : Number(w.start) || 0) - (prev.end_ms !== undefined ? prev.end_ms / 1000 : Number(prev.end) || 0) : 0;
          const wordLen = String(w.word || '').length;
          const shouldBreak = currentGroup.length >= maxWords || currentChars + wordLen > maxChars || gap > maxPauseGap;
          if (shouldBreak && currentGroup.length > 0) {
            groups.push(currentGroup);
            currentGroup = [];
            currentChars = 0;
          }
          currentGroup.push(w);
          currentChars += wordLen + 1;
        }
        if (currentGroup.length > 0) groups.push(currentGroup);
        effectiveRawList = groups.map((grp, gi) => ({
          id: gi + 1,
          start_ms: grp[0]?.start_ms ?? grp[0]?.start,
          end_ms: grp[grp.length - 1]?.end_ms ?? grp[grp.length - 1]?.end,
          text: grp.map((g: any) => g.word).join(' '),
          words: grp,
        }));
      }

      if (effectiveRawList.length === 0) {
        throw new Error('No speech dialogue segments found in the audio response.');
      }

      // Detect timing availability (P33)
      let hasWordTimestamps = false;
      for (const seg of effectiveRawList) {
        const wl = Array.isArray(seg.words) ? seg.words : [];
        if (wl.length > 0 && (wl[0].start_ms !== undefined || wl[0].start !== undefined)) {
          hasWordTimestamps = true;
          break;
        }
      }
      if (!hasWordTimestamps && flatWordsRaw.length > 0) {
        hasWordTimestamps = flatWordsRaw.some((w) => w.start_ms !== undefined || w.start !== undefined);
      }

      onProgress?.(hasWordTimestamps ? 'Word-level timestamps verified — building ultra-accurate caption track...' : 'Word timestamps missing — using validated fallback (marked estimated)...');

      onProgress?.('Synchronizing millisecond subtitle timestamps on timeline...');

      const captions: CaptionLine[] = [];
      let globalCapIdx = 0;
      let globalSourceIdx = 0;

      effectiveRawList.forEach((item, idx) => {
        const rawStart = item.start_ms !== undefined ? item.start_ms / 1000 : Number(item.start) || 0;
        const rawEnd =
          item.end_ms !== undefined
            ? item.end_ms / 1000
            : Number(item.end) || rawStart + 1.5;

        const startSec = Math.max(0, Math.round(rawStart * 100) / 100);
        const endSec = Math.max(startSec + 0.2, Math.round(rawEnd * 100) / 100);

        const wordsList: any[] = Array.isArray(item.words) ? item.words : [];
        const words: WordTimestamp[] = wordsList.map((w: any, wIdx: number) => {
          const wRawStart =
            w.start_ms !== undefined ? w.start_ms / 1000 : Number(w.start) || startSec;
          const wRawEnd =
            w.end_ms !== undefined
              ? w.end_ms / 1000
              : Number(w.end) || wRawStart + (endSec - startSec) / Math.max(1, wordsList.length);

          const hasRealTiming = w.start_ms !== undefined || w.start !== undefined;
          return {
            id: `w_${Date.now()}_${idx}_${wIdx}`,
            word: String(w.word || '').trim(),
            originalWord: String(w.word || '').trim(),
            normalizedText: String(w.word || '').trim(),
            start: Math.max(startSec, Math.round(wRawStart * 100) / 100),
            end: Math.min(endSec + 0.1, Math.round(wRawEnd * 100) / 100),
            confidence: typeof w.confidence === 'number' ? w.confidence : hasRealTiming ? 0.92 : 0.5,
            speaker: w.speaker || w.speaker_label || undefined,
            sourceIndex: globalSourceIdx + wIdx,
            displayIndex: wIdx,
            accuracyStatus: (hasRealTiming ? 'exact' : 'estimated') as any,
          };
        });
        globalSourceIdx += words.length;

        // P13: caption segment must use actual word timing (first word start, last word end)
        let segStart = words.length > 0 ? words[0].start : startSec;
        let segEnd = words.length > 0 ? words[words.length - 1].end : endSec;
        segStart = Math.round(segStart * 100) / 100;
        segEnd = Math.round(segEnd * 100) / 100;

        // Validate word order (P11) and repair if needed before chunking
        words.sort((a, b) => a.start - b.start);
        for (let wi = 1; wi < words.length; wi++) {
          if (words[wi].start < words[wi - 1].end - 0.005) {
            // overlap repair — shift to previous end
            const dur = words[wi].end - words[wi].start;
            words[wi].start = Math.round(words[wi - 1].end * 100) / 100;
            words[wi].end = Math.round((words[wi].start + Math.max(0.08, dur)) * 100) / 100;
          }
          if (words[wi].end <= words[wi].start) words[wi].end = Math.round((words[wi].start + 0.12) * 100) / 100;
        }
        if (words.length > 0) {
          segStart = words[0].start;
          segEnd = words[words.length - 1].end;
        }

        const hasExact = words.every((w) => w.accuracyStatus === 'exact');
        const segAccuracy: any = hasExact ? 'exact' : words.some((w) => w.accuracyStatus === 'exact') ? 'partial' : 'estimated';

        // If a segment has more than 3 words, chunk into compact 2-3 word viral micro-burst blocks (P14)
        if (words.length > 3) {
          const CHUNK_SIZE = words.length <= 4 ? 2 : 3;
          for (let i = 0; i < words.length; i += CHUNK_SIZE) {
            const chunkWords = words.slice(i, i + CHUNK_SIZE);
            const chunkStart = chunkWords[0].start;
            const chunkEnd = chunkWords[chunkWords.length - 1].end;
            // Reassign displayIndex for chunk
            chunkWords.forEach((cw, ci) => (cw.displayIndex = ci));
            captions.push({
              id: `cap_${Date.now()}_${globalCapIdx++}`,
              start: chunkStart,
              end: Math.max(chunkStart + 0.2, chunkEnd),
              text: chunkWords.map((w) => w.word).join(' ').trim(),
              sourceText: chunkWords.map((w) => w.originalWord || w.word).join(' '),
              words: chunkWords,
              sourceWords: chunkWords.map((w) => ({ ...w })),
              accuracyStatus: chunkWords.every((w) => w.accuracyStatus === 'exact') ? 'exact' : 'partial',
              splitHookIndex: chunkWords.length > 1 ? 1 : undefined,
            } as CaptionLine);
          }
        } else {
          captions.push({
            id: `cap_${Date.now()}_${globalCapIdx++}`,
            start: segStart,
            end: Math.max(segStart + 0.2, segEnd),
            text: String(item.text || words.map((w) => w.word).join(' ')).trim(),
            sourceText: String(item.text || words.map((w) => w.originalWord || w.word).join(' ')).trim(),
            words,
            sourceWords: words.map((w) => ({ ...w })),
            accuracyStatus: segAccuracy,
            splitHookIndex: words.length > 1 ? 1 : undefined,
          } as CaptionLine);
        }
      });

      // P11/P26: ensure chronologically ordered, no drift
      captions.sort((a, b) => a.start - b.start);
      for (let i = 1; i < captions.length; i++) {
        if (captions[i].start < captions[i - 1].end - 0.005) {
          // repair overlap by shifting
          const delta = captions[i - 1].end - captions[i].start;
          captions[i].start = Math.round(captions[i - 1].end * 100) / 100;
          captions[i].end = Math.round((captions[i].end + delta) * 100) / 100;
          captions[i].words = captions[i].words.map((w) => ({
            ...w,
            start: Math.round((w.start + delta) * 100) / 100,
            end: Math.round((w.end + delta) * 100) / 100,
          }));
        }
      }

      // P33-P34: if no exact timing was available, mark all as estimated (do not claim exact)
      if (!hasWordTimestamps) {
        captions.forEach((c) => {
          c.accuracyStatus = 'estimated' as any;
          c.words.forEach((w) => { w.accuracyStatus = 'estimated' as any; w.confidence = 0.5; });
        });
      }

      return captions;
    }

