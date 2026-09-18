import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FrameCompositor } from '../frameCompositor';
import { syncTransitionsWithClips } from '../../../utils/transitionEngine';
import { ProjectData, VideoClip } from '../../../types/project';
import { TransitionConfig } from '../../../types/transitions';

describe('CapCut-Style Timeline Export & State Engine Parity', () => {
  let mockContext: any;
  let mockCanvas: any;

  beforeEach(() => {
    mockContext = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 100 }),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      setTransform: vi.fn(),
      roundRect: vi.fn(),
      createLinearGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
      createRadialGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
      getImageData: vi.fn().mockReturnValue({
        data: new Uint8ClampedArray(100 * 100 * 4),
        width: 100,
        height: 100,
      }),
      putImageData: vi.fn(),
      globalAlpha: 1.0,
      globalCompositeOperation: 'source-over',
      filter: 'none',
      fillStyle: '#000000',
      strokeStyle: '#000000',
      lineWidth: 1,
      font: '10px sans-serif',
      textAlign: 'center',
      textBaseline: 'middle',
      shadowColor: 'transparent',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
    };

    mockCanvas = {
      width: 1920,
      height: 1080,
      getContext: vi.fn().mockReturnValue(mockContext),
    };

    (globalThis as any).document = {
      createElement: (tagName: string) => {
        if (tagName === 'canvas') return mockCanvas;
        if (tagName === 'img') return { onload: null, src: '', width: 1920, height: 1080 } as any;
        return {} as any;
      },
    };
  });

  describe('Transition Engine Integrity & Synchronization', () => {
    const clips: VideoClip[] = [
      {
        id: 'c1',
        name: 'Intro Clip',
        filePath: 'path/to/c1.mp4',
        timelineStart: 0,
        timelineDuration: 5.0,
        startOffset: 0,
        endOffset: 5.0,
        duration: 10.0,
        trackIndex: 1,
        speed: 1,
        volume: 1,
        isMuted: false,
        width: 1920,
        height: 1080,
        fps: 30,
      },
      {
        id: 'c2',
        name: 'Main Clip',
        filePath: 'path/to/c2.mp4',
        timelineStart: 5.0,
        timelineDuration: 6.0,
        startOffset: 0,
        endOffset: 6.0,
        duration: 12.0,
        trackIndex: 1,
        speed: 1,
        volume: 1,
        isMuted: false,
        width: 1920,
        height: 1080,
        fps: 30,
      },
      {
        id: 'c3',
        name: 'Outro Clip',
        filePath: 'path/to/c3.mp4',
        timelineStart: 11.0,
        timelineDuration: 4.0,
        startOffset: 0,
        endOffset: 4.0,
        duration: 8.0,
        trackIndex: 1,
        speed: 1,
        volume: 1,
        isMuted: false,
        width: 1920,
        height: 1080,
        fps: 30,
      },
    ];

    it('recalibrates transition editPoint and clamps duration on clip move', () => {
      const transitions: TransitionConfig[] = [
        {
          id: 't1',
          name: 'Crossfade',
          type: 'crossfade',
          fromClipId: 'c1',
          toClipId: 'c2',
          timelineStart: 5.0,
          duration: 1.0,
          alignment: 'center',
          params: {},
        },
      ];

      // Move c1 to 2.0s and c2 to 7.0s (edit point moves from 5.0s to 7.0s)
      const movedClips: VideoClip[] = [
        { ...clips[0], timelineStart: 2.0 },
        { ...clips[1], timelineStart: 7.0 },
      ];

      const synced = syncTransitionsWithClips(transitions, movedClips);
      expect(synced.length).toBe(1);
      expect(synced[0].timelineStart).toBe(7.0);
      expect(synced[0].duration).toBe(1.0);
    });

    it('safely clamps transition duration when source clip media handles are trimmed short', () => {
      const transitions: TransitionConfig[] = [
        {
          id: 't1',
          name: 'Crossfade',
          type: 'crossfade',
          fromClipId: 'c1',
          toClipId: 'c2',
          timelineStart: 5.0,
          duration: 2.0,
          alignment: 'center',
          params: {},
        },
      ];

      // Trim c1 so it is only 0.4s long
      const trimmedClips: VideoClip[] = [
        { ...clips[0], timelineStart: 4.6, timelineDuration: 0.4 },
        { ...clips[1], timelineStart: 5.0, timelineDuration: 6.0 },
      ];

      const synced = syncTransitionsWithClips(transitions, trimmedClips);
      expect(synced.length).toBe(1);
      // For center alignment, transition duration cannot exceed 2 * min(c1, c2) = 2 * 0.4 = 0.8s
      expect(synced[0].duration).toBeLessThanOrEqual(0.8);
    });

    it('eliminates orphan transitions when a clip is deleted', () => {
      const transitions: TransitionConfig[] = [
        {
          id: 't1',
          name: 'Crossfade',
          type: 'crossfade',
          fromClipId: 'c1',
          toClipId: 'c2',
          timelineStart: 5.0,
          duration: 1.0,
          alignment: 'center',
          params: {},
        },
        {
          id: 't2',
          name: 'Wipe',
          type: 'wipe',
          fromClipId: 'c2',
          toClipId: 'c3',
          timelineStart: 11.0,
          duration: 1.0,
          alignment: 'center',
          params: {},
        },
      ];

      // Delete clip c2
      const remainingClips = [clips[0], clips[2]];
      const synced = syncTransitionsWithClips(transitions, remainingClips);

      // Both t1 (references c2 as toClip) and t2 (references c2 as fromClip) must be removed
      expect(synced.length).toBe(0);
    });
  });

  describe('Export Compositor Parity (FrameCompositor)', () => {
    const mockVideo: any = {
      videoWidth: 1920,
      videoHeight: 1080,
      currentTime: 0,
      readyState: 4,
      addEventListener: vi.fn((event, handler) => {
        if (event === 'seeked') setTimeout(handler, 0);
      }),
      removeEventListener: vi.fn(),
    };

    it('initializes and configures output dimensions correctly', () => {
      const dummyProject: any = {
        id: 'p1',
        name: 'P1',
        metadata: {
          width: '1920',
          height: '1080',
          fps: 30,
          duration: 10.0,
          aspectRatio: '16:9',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          primaryVideoPath: 'v.mp4',
        },
        clips: [],
        transitions: [],
        overlays: [],
        captions: [],
      };

      const compositor = new FrameCompositor(1920, 1080, dummyProject);
      expect(compositor).toBeDefined();
      expect(compositor.getCanvas()).toBeDefined();
    });

    it('renders progressive transition reveals (wipe/slide/push) between clips', async () => {
      const project: any = {
        id: 'test-proj',
        name: 'Export Test',
        metadata: {
          width: '1920',
          height: '1080',
          fps: 30,
          duration: 10.0,
          aspectRatio: '16:9',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          primaryVideoPath: 'test.mp4',
        },
        clips: [
          {
            id: 'c1',
            name: 'Clip A',
            filePath: 'c1.mp4',
            timelineStart: 0,
            timelineDuration: 5.0,
            startOffset: 0,
            endOffset: 5.0,
            duration: 10.0,
            trackIndex: 1,
            speed: 1,
            volume: 1,
            isMuted: false,
            width: 1920,
            height: 1080,
            fps: 30,
          },
          {
            id: 'c2',
            name: 'Clip B',
            filePath: 'c2.mp4',
            timelineStart: 5.0,
            timelineDuration: 5.0,
            startOffset: 0,
            endOffset: 5.0,
            duration: 10.0,
            trackIndex: 1,
            speed: 1,
            volume: 1,
            isMuted: false,
            width: 1920,
            height: 1080,
            fps: 30,
          },
        ],
        transitions: [
          {
            id: 'trans1',
            name: 'Wipe',
            type: 'wipe',
            direction: 'right',
            fromClipId: 'c1',
            toClipId: 'c2',
            timelineStart: 5.0,
            duration: 1.0,
            alignment: 'center',
            params: {},
          },
        ],
        overlays: [],
        captions: [],
      };

      const compositor = new FrameCompositor(1920, 1080, project);
      (compositor as any).videoMap.set('c1', mockVideo);
      (compositor as any).videoMap.set('c2', mockVideo);

      // Midpoint of transition at t = 5.0s (transition runs from 4.5s to 5.5s)
      const renderedCanvas = await compositor.renderFrame(5.0);
      expect(renderedCanvas).toBeDefined();

      // Check that clip() or save()/restore() was called for progressive reveal
      expect(mockContext.save).toHaveBeenCalled();
      expect(mockContext.restore).toHaveBeenCalled();
      expect(mockContext.clip).toHaveBeenCalled();
    });

    it('renders timeline effect adjustment layers from project.overlays', async () => {
      const project: any = {
        id: 'test-proj-fx',
        name: 'Effect Layer Test',
        metadata: {
          width: '1920',
          height: '1080',
          fps: 30,
          duration: 8.0,
          aspectRatio: '16:9',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          primaryVideoPath: 'test.mp4',
        },
        clips: [
          {
            id: 'c1',
            name: 'Clip A',
            filePath: 'c1.mp4',
            timelineStart: 0,
            timelineDuration: 8.0,
            startOffset: 0,
            endOffset: 8.0,
            duration: 8.0,
            trackIndex: 1,
            speed: 1,
            volume: 1,
            isMuted: false,
            width: 1920,
            height: 1080,
            fps: 30,
            effects: [
              {
                id: 'fx_vignette',
                type: 'vignette',
                name: 'Vignette',
                category: 'color',
                enabled: true,
                params: { amount: 0.6 },
              },
            ],
          },
        ],
        transitions: [],
        overlays: [
          {
            id: 'ov_layer_glow',
            type: 'effect',
            name: 'Glow Layer',
            timelineStart: 1.0,
            timelineDuration: 4.0,
            x: 50,
            y: 50,
            scale: 1.0,
            opacity: 0.8,
            effectType: 'glow',
            params: { intensity: 0.7 },
          },
        ],
        captions: [],
      };

      const compositor = new FrameCompositor(1920, 1080, project);
      (compositor as any).videoMap.set('c1', mockVideo);

      // Render at t = 2.0s (active clip effect AND active effect overlay layer)
      const renderedCanvas = await compositor.renderFrame(2.0);
      expect(renderedCanvas).toBeDefined();

      // Check that canvas rendering operations were executed
      expect(mockContext.drawImage).toHaveBeenCalled();
    });

    it('renders styled text overlays with font, stroke, shadow, and background', async () => {
      const project: any = {
        id: 'test-text-overlay',
        name: 'Text Overlay Test',
        metadata: {
          width: '1920',
          height: '1080',
          fps: 30,
          duration: 5.0,
          aspectRatio: '16:9',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          primaryVideoPath: 'test.mp4',
        },
        clips: [
          {
            id: 'c1',
            name: 'Clip A',
            filePath: 'c1.mp4',
            timelineStart: 0,
            timelineDuration: 5.0,
            startOffset: 0,
            endOffset: 5.0,
            duration: 5.0,
            trackIndex: 1,
            speed: 1,
            volume: 1,
            isMuted: false,
            width: 1920,
            height: 1080,
            fps: 30,
          },
        ],
        transitions: [],
        overlays: [
          {
            id: 'ov_txt_1',
            type: 'text',
            name: 'Header Banner',
            text: 'VIRAL HOOK',
            timelineStart: 0.5,
            timelineDuration: 3.0,
            x: 50,
            y: 30,
            scale: 1.0,
            opacity: 1.0,
            fontFamily: 'Montserrat',
            fontSize: 48,
            fontWeight: '900',
            textColor: '#FFFFFF',
            strokeColor: '#000000',
            strokeWidth: 4,
            backgroundColor: 'rgba(0,0,0,0.7)',
            backgroundPadding: 16,
            backgroundRadius: 8,
            shadowColor: 'rgba(0,0,0,0.8)',
            shadowBlur: 10,
          },
        ],
        captions: [],
      };

      const compositor = new FrameCompositor(1920, 1080, project);
      (compositor as any).videoMap.set('c1', mockVideo);

      // Render at t = 1.0s (overlay active)
      await compositor.renderFrame(1.0);

      // Verify that fillText and strokeText were called for the styled text
      expect(mockContext.fillText).toHaveBeenCalled();
      expect(mockContext.strokeText).toHaveBeenCalled();
    });
  });
});
