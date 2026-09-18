import { describe, it, expect, vi } from 'vitest';
import {
  encodeAudioBufferToWav,
  audioProcessor,
} from '../audioProcessor';

// Create a mock AudioBuffer helper for Node/Vitest environment
function createMockAudioBuffer(
  channels: number,
  length: number,
  sampleRate = 48000
): AudioBuffer {
  const channelData: Float32Array[] = [];
  for (let c = 0; c < channels; c++) {
    const data = new Float32Array(length);
    // Populate with dummy sine wave
    for (let i = 0; i < length; i++) {
      data[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
    }
    channelData.push(data);
  }

  return {
    numberOfChannels: channels,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: (ch: number) => channelData[ch] || channelData[0],
    copyFromChannel: () => {},
    copyToChannel: () => {},
  } as unknown as AudioBuffer;
}

// Mock Web Audio OfflineAudioContext in test environment if needed
if (typeof window !== 'undefined') {
  if (!window.OfflineAudioContext) {
    (window as any).OfflineAudioContext = class MockOfflineAudioContext {
      constructor(
        public channels: number,
        public length: number,
        public sampleRate: number
      ) {}
      createBuffer(ch: number, len: number, sr: number) {
        return createMockAudioBuffer(ch, len, sr);
      }
    };
  }
} else {
  (global as any).window = {
    OfflineAudioContext: class MockOfflineAudioContext {
      constructor(
        public channels: number,
        public length: number,
        public sampleRate: number
      ) {}
      createBuffer(ch: number, len: number, sr: number) {
        return createMockAudioBuffer(ch, len, sr);
      }
    },
  };
}

// Polyfill URL.createObjectURL if missing in Node
if (typeof URL.createObjectURL === 'undefined') {
  URL.createObjectURL = vi.fn((blob: Blob) => `blob:mock-audio-${Math.random()}`);
}

describe('AudioProcessor & WAV Encoder Engine', () => {
  it('encodes an AudioBuffer into a valid 16-bit PCM WAV Blob with correct RIFF headers', async () => {
    const sampleRate = 48000;
    const length = 4800; // 0.1s
    const mockBuffer = createMockAudioBuffer(2, length, sampleRate);

    const blob = encodeAudioBufferToWav(mockBuffer);
    expect(blob).toBeDefined();
    expect(blob.type).toBe('audio/wav');

    // Verify RIFF and WAVE magic headers
    const arrayBuffer = await blob.arrayBuffer();
    const view = new DataView(arrayBuffer);

    const riffTag = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3)
    );
    const waveTag = String.fromCharCode(
      view.getUint8(8),
      view.getUint8(9),
      view.getUint8(10),
      view.getUint8(11)
    );
    const fmtTag = String.fromCharCode(
      view.getUint8(12),
      view.getUint8(13),
      view.getUint8(14),
      view.getUint8(15)
    );

    expect(riffTag).toBe('RIFF');
    expect(waveTag).toBe('WAVE');
    expect(fmtTag).toBe('fmt ');

    // 16-bit stereo PCM validation
    expect(view.getUint16(20, true)).toBe(1); // AudioFormat: 1 (PCM)
    expect(view.getUint16(22, true)).toBe(2); // Channels: 2
    expect(view.getUint32(24, true)).toBe(48000); // SampleRate
    expect(view.getUint16(34, true)).toBe(16); // BitsPerSample: 16
  });

  it('denoises an AudioBuffer non-destructively preserving dimensions and sample rate', () => {
    const sampleRate = 48000;
    const length = 9600; // 0.2s
    const mockBuffer = createMockAudioBuffer(2, length, sampleRate);

    const denoised = audioProcessor.denoiseAudioBuffer(mockBuffer, {
      strength: 0.7,
      speechPreserve: true,
      rumbleCut: true,
    });

    expect(denoised).toBeDefined();
    expect(denoised.numberOfChannels).toBe(2);
    expect(denoised.length).toBe(length);
    expect(denoised.sampleRate).toBe(sampleRate);
  });

  it('separates stereo audio into Vocals and Instrumental stems and generates Blob URLs', async () => {
    const sampleRate = 48000;
    const length = 4800; // 0.1s
    const mockBuffer = createMockAudioBuffer(2, length, sampleRate);

    const result = await audioProcessor.separateVocalStems(mockBuffer, {
      vocalGain: 1.2,
      instrumentalGain: 1.0,
    });

    expect(result).toBeDefined();
    expect(result.vocalsBuffer.numberOfChannels).toBe(2);
    expect(result.instrumentalBuffer.numberOfChannels).toBe(2);
    expect(result.vocalsBlobUrl).toMatch(/^blob:/);
    expect(result.instrumentalBlobUrl).toMatch(/^blob:/);
  });
});
