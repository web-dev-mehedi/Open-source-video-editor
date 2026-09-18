import { describe, it, expect, vi } from 'vitest';
import {
  toBitrateBps,
  toBitrateKbps,
  validateAudioBitrate,
  resolvePresetAudioBitrate,
  resolveVideoBitrateKbps,
  AAC_SUPPORTED_BITRATES_BPS,
  OPUS_SUPPORTED_BITRATES_BPS,
  MP3_SUPPORTED_BITRATES_BPS,
} from '../bitrateHelper';
import {
  sanitizeFileName,
  joinExportPath,
  isAbsolutePath,
  resolveCanonicalExportFolder,
  validateExportDestination,
} from '../destinationService';
import { buildExportOptions, resolveExportResolution, sanitizeExportDimensions } from '../exportConfig';
import { ExportSettings } from '../../../types/export';
import { ProjectData } from '../../../types/project';

describe('CaptionForge Export System Audit & Verification Suite', () => {
  // =========================================================================
  // 1. BITRATE ARCHITECTURE & UNIT CONVERSION
  // =========================================================================
  describe('Bitrate Architecture & Unit Conversions', () => {
    it('converts kbps and bps to canonical bps without unit mixing', () => {
      expect(toBitrateBps(192)).toBe(192000);
      expect(toBitrateBps(128)).toBe(128000);
      expect(toBitrateBps(96)).toBe(96000);
      expect(toBitrateBps(320)).toBe(320000);

      // Already in bps
      expect(toBitrateBps(192000)).toBe(192000);
      expect(toBitrateBps(128000)).toBe(128000);
      expect(toBitrateBps(8000000)).toBe(8000000);

      // Fallback on invalid/empty values
      expect(toBitrateBps(undefined)).toBe(192000);
      expect(toBitrateBps(null)).toBe(192000);
      expect(toBitrateBps(-50)).toBe(192000);
    });

    it('converts canonical bps to display kbps', () => {
      expect(toBitrateKbps(192000)).toBe(192);
      expect(toBitrateKbps(128000)).toBe(128);
      expect(toBitrateKbps(96000)).toBe(96);
      expect(toBitrateKbps(320000)).toBe(320);
      expect(toBitrateKbps(192)).toBe(192);
    });

    it('validates supported AAC bitrates strictly for Chromium WebCodecs', () => {
      // All 4 supported AAC-LC bitrates must pass validation
      for (const bps of AAC_SUPPORTED_BITRATES_BPS) {
        const result = validateAudioBitrate('mp4', bps);
        expect(result.valid).toBe(true);
        expect(result.clampedBps).toBe(bps);
        expect(result.clampedKbps).toBe(bps / 1000);
      }
    });

    it('catches and clamps unsupported AAC bitrates (e.g. 320000 bps) before reaching encoder', () => {
      // 320000 bps caused the fatal error in Chromium WebCodecs
      const result320k = validateAudioBitrate('mp4', 320000);
      expect(result320k.valid).toBe(false);
      expect(result320k.errorCode).toBe('ERR_UNSUPPORTED_BITRATE');
      expect(result320k.clampedBps).toBe(192000); // Clamped to highest supported AAC bitrate
      expect(result320k.clampedKbps).toBe(192);

      // Arbitrary unsupported bitrate
      const resultCustom = validateAudioBitrate('mp4', 123456);
      expect(resultCustom.valid).toBe(false);
      expect(resultCustom.clampedBps).toBe(128000); // Clamped to nearest (128k)
    });

    it('supports wide bitrate ranges for MP3 audio export up to 320 kbps', () => {
      const result320k = validateAudioBitrate('mp3', 320000);
      expect(result320k.valid).toBe(true);
      expect(result320k.clampedBps).toBe(320000);

      const result192k = validateAudioBitrate('mp3', 192);
      expect(result192k.valid).toBe(true);
      expect(result192k.clampedBps).toBe(192000);
    });

    it('isolates video bitrate calculations from audio bitrate', () => {
      // 1080p video bitrate should be 12 Mbps (High), 8 Mbps (Med), 5 Mbps (Low)
      expect(resolveVideoBitrateKbps('1080p', 'high')).toBe(12000);
      expect(resolveVideoBitrateKbps('1080p', 'medium')).toBe(8000);
      expect(resolveVideoBitrateKbps('1080p', 'low')).toBe(5000);

      // 4K video bitrate
      expect(resolveVideoBitrateKbps('4k', 'high')).toBe(35000);

      // Audio bitrates must remain in AAC bounds
      const presetHigh = resolvePresetAudioBitrate('mp4', 'high');
      expect(presetHigh.bitrateKbps).toBe(192);
      expect(presetHigh.bitrateBps).toBe(192000);

      const presetLow = resolvePresetAudioBitrate('mp4', 'low');
      expect(presetLow.bitrateKbps).toBe(96);
      expect(presetLow.bitrateBps).toBe(96000);
    });
  });

  // =========================================================================
  // 2. DESTINATION FOLDER, PATH CONSTRUCTION & FILENAME SANITIZATION
  // =========================================================================
  describe('Destination Folder & Path Architecture', () => {
    it('detects absolute paths correctly across Windows and POSIX', () => {
      expect(isAbsolutePath('C:\\Users\\Editor\\Videos')).toBe(true);
      expect(isAbsolutePath('D:/Exports/Shorts')).toBe(true);
      expect(isAbsolutePath('\\\\network-share\\videos')).toBe(true);
      expect(isAbsolutePath('/home/user/videos')).toBe(true);

      // Relative paths or labels must return false
      expect(isAbsolutePath('Video')).toBe(false);
      expect(isAbsolutePath('Videos')).toBe(false);
      expect(isAbsolutePath('./exports')).toBe(false);
      expect(isAbsolutePath('')).toBe(false);
    });

    it('resolves canonical absolute export folder and never uses relative label "Video"', async () => {
      // When saved folder is literally "Video" or empty, resolve to canonical absolute folder
      const resFromLabel = await resolveCanonicalExportFolder('Video');
      expect(resFromLabel.absolutePath).not.toBe('Video');
      expect(isAbsolutePath(resFromLabel.absolutePath)).toBe(true);

      const resFromEmpty = await resolveCanonicalExportFolder('');
      expect(isAbsolutePath(resFromEmpty.absolutePath)).toBe(true);

      // Valid absolute custom path is preserved
      const custom = 'D:\\MediaProduction\\CaptionForgeExports';
      const resCustom = await resolveCanonicalExportFolder(custom);
      expect(resCustom.absolutePath).toBe(custom);
      expect(resCustom.isCustom).toBe(true);
    });

    it('joins export paths using platform-safe separators without double slashes', () => {
      const winJoined = joinExportPath('C:\\Users\\ailsh\\Videos', 'MyShort_CaptionForge.mp4');
      expect(winJoined).toBe('C:\\Users\\ailsh\\Videos\\MyShort_CaptionForge.mp4');

      const posixJoined = joinExportPath('/home/user/videos', 'MyShort_CaptionForge.mp4');
      expect(posixJoined).toBe('/home/user/videos/MyShort_CaptionForge.mp4');

      // Handles trailing and leading slashes safely
      const cleanSlash = joinExportPath('C:\\Exports\\', '\\video.mp4');
      expect(cleanSlash).toBe('C:\\Exports\\video.mp4');
    });

    it('sanitizes illegal Windows filename characters safely', () => {
      const badName = 'Episode 1: Why "AI" is > than *anything*? | Part/1\\';
      const sanitized = sanitizeFileName(badName, 'mp4');
      expect(sanitized).not.toContain(':');
      expect(sanitized).not.toContain('*');
      expect(sanitized).not.toContain('?');
      expect(sanitized).not.toContain('"');
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
      expect(sanitized).not.toContain('|');
      expect(sanitized).not.toContain('/');
      expect(sanitized).not.toContain('\\');
      expect(sanitized.endsWith('.mp4')).toBe(true);
    });

    it('supports Unicode and Bangla characters in filenames', () => {
      const banglaName = 'আমার ভাইরাল ভিডিও ০৭';
      const sanitized = sanitizeFileName(banglaName, 'mp4');
      expect(sanitized).toBe('আমার ভাইরাল ভিডিও ০৭.mp4');
    });

    it('enforces file extension matching the selected export format', () => {
      expect(sanitizeFileName('Interview.mp3', 'mp4')).toBe('Interview.mp4');
      expect(sanitizeFileName('AudioPodcast.mp4', 'mp3')).toBe('AudioPodcast.mp3');
      expect(sanitizeFileName('Captions.txt', 'srt')).toBe('Captions.srt');
      expect(sanitizeFileName('Reaction', 'gif')).toBe('Reaction.gif');
    });

    it('validates destination directory format and rejects empty paths', async () => {
      const emptyCheck = await validateExportDestination('');
      expect(emptyCheck.valid).toBe(false);
      expect(emptyCheck.errorCode).toBe('ERR_PATH_EMPTY');

      const relativeCheck = await validateExportDestination('RelativeFolder');
      expect(relativeCheck.valid).toBe(false);
      expect(relativeCheck.errorCode).toBe('ERR_NOT_ABSOLUTE');

      const validCheck = await validateExportDestination('C:\\Valid\\Export\\Path');
      expect(validCheck.valid).toBe(true);
    });
  });

  // =========================================================================
  // 3. EXPORT CONFIGURATION & RESOLUTION DIMENSIONS
  // =========================================================================
  describe('Export Configuration & Dimensions', () => {
    it('ensures all resolved dimensions are even integers for hardware encoder compatibility', () => {
      const resolutions = ['480p', '720p', '1080p', '4k'] as const;
      const aspectRatios = ['9:16', '16:9', '1:1', '4:5', '21:9'] as const;

      for (const res of resolutions) {
        for (const ar of aspectRatios) {
          const dim = resolveExportResolution(ar, res);
          expect(dim.width % 2).toBe(0);
          expect(dim.height % 2).toBe(0);
          expect(dim.width).toBeGreaterThan(0);
          expect(dim.height).toBeGreaterThan(0);
        }
      }
    });

    it('builds full normalized ExportOptions without leaking invalid bitrates', () => {
      const mockSettings: ExportSettings = {
        category: 'video',
        format: 'mp4',
        resolution: '1080p',
        fps: 30,
        bitrateKbps: 12000,
        hardwareEncoder: 'auto',
        burnCaptions: true,
        burnOverlays: true,
        outputPath: 'C:\\Exports\\Video.mp4',
        outputFolder: 'C:\\Exports',
        projectName: 'My Viral Video',
        qualityPreset: 'high',
        audioBitrate: 320, // Erroneous UI input
      };

      const options = buildExportOptions('My Viral Video', '9:16', mockSettings);

      expect(options.format).toBe('mp4');
      expect(options.resolution.width).toBe(1080);
      expect(options.resolution.height).toBe(1920);
      expect(options.fps).toBe(30);
      expect(options.bitrate).toBe(12000000); // 12 Mbps video bitrate
      // CRITICAL: Must be clamped to 192000 bps for AAC MP4
      expect(options.audioBitrate).toBe(192000);
      expect(options.sampleRate).toBe(48000);
      expect(options.burnCaptions).toBe(true);
    });
  });

  // =========================================================================
  // 4. CRITICAL REGRESSION TEST: TEST-EXPORT-001
  // =========================================================================
  describe('TEST-EXPORT-001: End-to-End Export Pipeline Integrity', () => {
    it('successfully processes full project export configuration with video, audio, captions, and custom destination', async () => {
      const mockProject: ProjectData = {
        metadata: {
          id: 'proj_test_001',
          name: 'My Viral Short 07',
          aspectRatio: '9:16',
          fps: 30,
          duration: 15.0,
          width: 1080,
          height: 1920,
          exportFolder: 'D:\\UserVideos\\CaptionForge',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        clips: [
          {
            id: 'v1',
            name: 'Interview.mp4',
            filePath: 'C:/media/interview.mp4',
            trackIndex: 1,
            timelineStart: 0,
            timelineDuration: 15.0,
            duration: 20.0,
            startOffset: 0,
            endOffset: 15.0,
            speed: 1.0,
            volume: 1.0,
            isMuted: false,
            fps: 30,
            width: 1080,
            height: 1920,
          },
        ],
        audioClips: [
          {
            id: 'a1',
            name: 'BackgroundMusic.mp3',
            filePath: 'C:/audio/bgm.mp3',
            timelineStart: 0,
            timelineDuration: 15.0,
            duration: 60.0,
            startOffset: 0,
            endOffset: 15.0,
            speed: 1.0,
            volume: 0.3,
            isMuted: false,
          },
        ],
        captions: [
          {
            id: 'cap1',
            text: 'Welcome to CaptionForge!',
            start: 0.5,
            end: 2.5,
            words: [],
          },
          {
            id: 'cap2',
            text: 'এই ভিডিওটি টেস্ট করার জন্য তৈরি।',
            start: 2.6,
            end: 5.0,
            words: [],
          },
        ],
        overlays: [],
        transitions: [],
        activeStyle: { fontSize: 40, fontFamily: 'Arial' } as any,
      };

      // 1. Select destination folder
      const chosenFolder = 'D:\\UserVideos\\CaptionForge';
      const folderRes = await resolveCanonicalExportFolder(chosenFolder);
      expect(folderRes.absolutePath).toBe(chosenFolder);

      // 2. Sanitize filename
      const finalFileName = sanitizeFileName(mockProject.metadata.name, 'mp4');
      expect(finalFileName).toBe('My Viral Short 07.mp4');

      // 3. Join destination path
      const finalOutputPath = joinExportPath(folderRes.absolutePath, finalFileName);
      expect(finalOutputPath).toBe('D:\\UserVideos\\CaptionForge\\My Viral Short 07.mp4');

      // 4. Validate audio bitrate (192 kbps High Quality AAC)
      const audioVal = validateAudioBitrate('mp4', 192000);
      expect(audioVal.valid).toBe(true);
      expect(audioVal.clampedBps).toBe(192000);

      // 5. Build export options
      const settings: ExportSettings = {
        category: 'video',
        format: 'mp4',
        resolution: '1080p',
        fps: 30,
        bitrateKbps: 12000,
        hardwareEncoder: 'auto',
        burnCaptions: true,
        burnOverlays: true,
        outputPath: finalOutputPath,
        outputFolder: folderRes.absolutePath,
        projectName: 'My Viral Short 07',
        qualityPreset: 'high',
        audioBitrate: 192,
      };

      const exportOptions = buildExportOptions(mockProject.metadata.name, mockProject.metadata.aspectRatio, settings);

      // 6. Verify export parameters ready for native encoding
      expect(exportOptions.outputPath).toBe('D:\\UserVideos\\CaptionForge\\My Viral Short 07.mp4');
      expect(exportOptions.resolution.width).toBe(1080);
      expect(exportOptions.resolution.height).toBe(1920);
      expect(exportOptions.fps).toBe(30);
      expect(exportOptions.bitrate).toBe(12000000);
      expect(exportOptions.audioBitrate).toBe(192000);
      expect(exportOptions.burnCaptions).toBe(true);
    });
  });
});
