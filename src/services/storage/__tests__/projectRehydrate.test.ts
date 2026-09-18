import { describe, test, expect } from 'vitest';
import {
  buildProtocolUrl,
  isAbsoluteMediaPath,
  isStaleBlobUrl,
  rehydrateProjectMedia,
  sanitizeProjectForPersistence,
} from '../projectStorage';
import type { ProjectData } from '../../../types/project';

function makeProject(overrides: Partial<ProjectData> = {}): ProjectData {
  return {
    metadata: {
      id: 'proj_test',
      name: 'Test',
      aspectRatio: '16:9',
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    clips: [],
    captions: [],
    activeStyle: {} as any,
    overlays: [],
    ...overrides,
  } as ProjectData;
}

describe('project persistence: stale blob URLs never survive a reopen', () => {
  test('isStaleBlobUrl identifies session-only URLs', () => {
    expect(isStaleBlobUrl('blob:http://localhost/abc')).toBe(true);
    expect(isStaleBlobUrl('captionforge-media://C:/a.mp4')).toBe(false);
    expect(isStaleBlobUrl('')).toBe(false);
    expect(isStaleBlobUrl(undefined)).toBe(false);
  });

  test('isAbsoluteMediaPath accepts win/posix/file/protocol paths only', () => {
    expect(isAbsoluteMediaPath('C:\\media\\a.mp4')).toBe(true);
    expect(isAbsoluteMediaPath('C:/media/a.mp4')).toBe(true);
    expect(isAbsoluteMediaPath('/home/u/a.mp4')).toBe(true);
    expect(isAbsoluteMediaPath('file:///C:/a.mp4')).toBe(true);
    expect(isAbsoluteMediaPath('captionforge-media://C:/a.mp4')).toBe(true);
    expect(isAbsoluteMediaPath('a.mp4')).toBe(false);
    expect(isAbsoluteMediaPath('blob:http://x/y')).toBe(false);
    expect(isAbsoluteMediaPath('')).toBe(false);
  });

  test('buildProtocolUrl maps absolute paths, drops blob:/bare names', () => {
    expect(buildProtocolUrl('C:\\media\\a.mp4')).toBe('captionforge-media://C:/media/a.mp4');
    expect(buildProtocolUrl('captionforge-media://C:/a.mp4')).toBe('captionforge-media://C:/a.mp4');
    expect(buildProtocolUrl('blob:http://localhost/x')).toBe('');
    expect(buildProtocolUrl('a.mp4')).toBe('captionforge-media://a.mp4');
  });

  test('sanitize strips blob: media urls but keeps playable ones', () => {
    const p = makeProject({
      clips: [
        {
          id: 'c1',
          name: 'a.mp4',
          filePath: 'C:\\m\\a.mp4',
          duration: 5,
          startOffset: 0,
          endOffset: 5,
          timelineStart: 0,
          timelineDuration: 5,
          speed: 1,
          volume: 1,
          isMuted: false,
          width: 1920,
          height: 1080,
          fps: 30,
          mediaBlobUrl: 'blob:http://localhost/dead',
          thumbnailUrl: 'blob:http://localhost/deadthumb',
        } as any,
      ],
      mediaRegistry: [
        { id: 'm1', fileName: 'a.mp4', filePath: 'C:\\m\\a.mp4', mediaBlobUrl: 'blob:http://x', thumbnailUrl: 'data:image/jpeg;base64,AAA' } as any,
      ],
    });
    const out = sanitizeProjectForPersistence(p);
    expect(out.clips[0].mediaBlobUrl).toBe('');
    expect(out.clips[0].thumbnailUrl).toBe('');
    expect((out as any).mediaRegistry[0].mediaBlobUrl).toBe('');
    // data: thumbnails survive
    expect((out as any).mediaRegistry[0].thumbnailUrl).toBe('data:image/jpeg;base64,AAA');
    // input untouched (in-memory playback keeps working)
    expect(p.clips[0].mediaBlobUrl).toBe('blob:http://localhost/dead');
  });

  test('reopen with absolute path rebuilds protocol URL (no relink needed)', async () => {
    const p = makeProject({
      clips: [
        {
          id: 'c1',
          mediaId: 'm1',
          name: 'a.mp4',
          filePath: 'C:\\media\\a.mp4',
          duration: 10,
          startOffset: 0,
          endOffset: 10,
          timelineStart: 0,
          timelineDuration: 10,
          speed: 1,
          volume: 1,
          isMuted: false,
          width: 1920,
          height: 1080,
          fps: 30,
          mediaBlobUrl: 'blob:http://localhost/stale-session-url',
        } as any,
      ],
      mediaRegistry: [
        {
          id: 'm1',
          fileName: 'a.mp4',
          filePath: 'C:\\media\\a.mp4',
          mediaType: 'video',
          duration: 10,
          width: 1920,
          height: 1080,
          fps: 30,
          importDate: new Date().toISOString(),
          mediaBlobUrl: 'blob:http://localhost/stale-session-url',
        } as any,
      ],
    });
    // No IndexedDB in node env: blob store lookups fail soft to null, so the
    // absolute path fallback must kick in.
    const out = await rehydrateProjectMedia(p);
    expect(out.clips[0].mediaBlobUrl).toBe('captionforge-media://C:/media/a.mp4');
    expect((out as any).mediaRegistry[0].mediaBlobUrl).toBe('captionforge-media://C:/media/a.mp4');
    expect((out as any).missingMedia).toEqual([]);
  });

  test('reopen with filename-only File import and no stored binary flags missing (no black screen)', async () => {
    const p = makeProject({
      clips: [
        {
          id: 'c1',
          mediaId: 'm1',
          name: 'clip.mp4',
          filePath: 'clip.mp4',
          duration: 10,
          startOffset: 0,
          endOffset: 10,
          timelineStart: 0,
          timelineDuration: 10,
          speed: 1,
          volume: 1,
          isMuted: false,
          width: 1920,
          height: 1080,
          fps: 30,
          mediaBlobUrl: 'blob:http://localhost/stale-session-url',
        } as any,
      ],
      mediaRegistry: [
        {
          id: 'm1',
          fileName: 'clip.mp4',
          filePath: 'clip.mp4',
          mediaType: 'video',
          duration: 10,
          width: 1920,
          height: 1080,
          fps: 30,
          importDate: new Date().toISOString(),
          mediaBlobUrl: 'blob:http://localhost/stale-session-url',
        } as any,
      ],
    });
    const out = await rehydrateProjectMedia(p);
    // Stale blob cleared so the player cannot load a dead URL...
    expect(out.clips[0].mediaBlobUrl).toBe('');
    // ...and the asset is reported missing so OFFLINE/relink UI appears.
    expect((out as any).missingMedia).toContain('clip.mp4');
  });

  test('reopen output never contains blob: URLs', async () => {
    const p = makeProject({
      clips: [
        {
          id: 'c1',
          name: 'a.mp4',
          filePath: 'C:\\m\\a.mp4',
          duration: 5,
          startOffset: 0,
          endOffset: 5,
          timelineStart: 0,
          timelineDuration: 5,
          speed: 1,
          volume: 1,
          isMuted: false,
          width: 1,
          height: 1,
          fps: 30,
          mediaBlobUrl: 'blob:http://localhost/dead',
        } as any,
      ],
      audioClips: [
        { id: 'a1', name: 'b.mp3', filePath: 'b.mp3', mediaBlobUrl: 'blob:http://localhost/dead2' } as any,
      ],
      footageLibrary: [
        { id: 'f1', name: 'c.mp4', filePath: 'D:\\v\\c.mp4', mediaBlobUrl: 'blob:http://localhost/dead3' } as any,
      ],
    });
    const out = await rehydrateProjectMedia(p);
    const urls = [
      out.clips[0].mediaBlobUrl,
      (out.audioClips || [])[0].mediaBlobUrl,
      (out.footageLibrary || [])[0].mediaBlobUrl,
    ];
    expect(urls.every((u) => !String(u || '').startsWith('blob:'))).toBe(true);
  });

  test('repeated reopens do not corrupt (idempotent)', async () => {
    const p = makeProject({
      clips: [
        {
          id: 'c1',
          mediaId: 'm1',
          name: 'a.mp4',
          filePath: 'C:\\media\\a.mp4',
          duration: 10,
          startOffset: 2,
          endOffset: 8,
          timelineStart: 4,
          timelineDuration: 6,
          speed: 1,
          volume: 1,
          isMuted: false,
          width: 1920,
          height: 1080,
          fps: 30,
          mediaBlobUrl: '',
        } as any,
      ],
      mediaRegistry: [
        { id: 'm1', fileName: 'a.mp4', filePath: 'C:\\media\\a.mp4', mediaType: 'video', duration: 10, width: 1920, height: 1080, fps: 30, importDate: '' } as any,
      ],
    });
    const once = await rehydrateProjectMedia(p);
    const twice = await rehydrateProjectMedia(JSON.parse(JSON.stringify(once)));
    expect(twice.clips[0]).toMatchObject({
      timelineStart: 4,
      timelineDuration: 6,
      startOffset: 2,
      endOffset: 8,
    });
    expect(twice.clips[0].mediaBlobUrl).toBe(once.clips[0].mediaBlobUrl);
  });
});
