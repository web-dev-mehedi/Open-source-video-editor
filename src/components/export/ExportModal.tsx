import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../common/Modal';
import {
  ExportCategory,
  ExportFormat,
  ExportResolution,
  VideoCodec,
  HardwareEncoder,
  ExportSettings,
} from '../../types/export';
import { useProject } from '../../context/ProjectContext';
import { useSettings } from '../../context/SettingsContext';
import { getActiveContentDuration } from '../../utils/timelineDuration';
import { formatTimecode } from '../../utils/timecode';
import {
  resolvePresetAudioBitrate,
  validateAudioBitrate,
  getSupportedAudioBitrates,
  resolveVideoBitrateKbps,
} from '../../services/export/bitrateHelper';
import {
  resolveCanonicalExportFolder,
  pickExportDestinationFolder,
  sanitizeFileName,
  joinExportPath,
  validateExportDestination,
} from '../../services/export/destinationService';
import {
  Download,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  Cpu,
  Clock,
  HardDrive,
  AlertCircle,
  Volume2,
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartExport: (settings: ExportSettings) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  onStartExport,
}) => {
  const { project, setProjectExportFolder } = useProject();
  const { settings, updateSettings, ffmpegStatus } = useSettings();

  // Export Category / Format Mode
  const [category, setCategory] = useState<ExportCategory>('video');
  const [fileName, setFileName] = useState<string>('');
  const [destinationFolder, setDestinationFolder] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Video Settings
  const [videoFormat, setVideoFormat] = useState<ExportFormat>('mp4');
  const [qualityPreset, setQualityPreset] = useState<'high' | 'medium' | 'low'>('high');
  const [resolution, setResolution] = useState<ExportResolution>('1080p');
  const [fps, setFps] = useState<number>(30);
  const [burnCaptions, setBurnCaptions] = useState<boolean>(true);

  // Audio Bitrate (User Selectable & Preset-driven)
  const [audioBitrateKbps, setAudioBitrateKbps] = useState<number>(192);

  // Advanced Settings (Progressive Disclosure)
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [codec, setCodec] = useState<VideoCodec>('h264');
  const [encoder, setEncoder] = useState<HardwareEncoder>('auto');
  const [alsoExportSubtitles, setAlsoExportSubtitles] = useState<boolean>(false);
  const [alsoExportAudio, setAlsoExportAudio] = useState<boolean>(false);

  // Audio / Subtitle / GIF specific settings
  const [audioFormat, setAudioFormat] = useState<ExportFormat>('mp3');
  const [subtitleFormat, setSubtitleFormat] = useState<ExportFormat>('srt');
  const [subtitleScope, setSubtitleScope] = useState<'all' | 'selected'>('all');
  const [gifResolution, setGifResolution] = useState<ExportResolution>('480p');
  const [gifFps, setGifFps] = useState<number>(15);
  const [gifLoop, setGifLoop] = useState<'infinite' | 'once'>('infinite');

  // Active format extension based on current category
  const activeFormat: ExportFormat =
    category === 'video'
      ? videoFormat
      : category === 'audio'
      ? audioFormat
      : category === 'subtitle'
      ? subtitleFormat
      : 'gif';

  // Synchronize audio bitrate whenever category, format, or quality preset changes
  useEffect(() => {
    const preset = resolvePresetAudioBitrate(activeFormat, qualityPreset);
    setAudioBitrateKbps(preset.bitrateKbps);
  }, [activeFormat, qualityPreset]);

  // Synchronize initial canonical destination folder and non-colliding file name when modal opens
  useEffect(() => {
    if (!isOpen) {
      setValidationError('');
      setIsSubmitting(false);
      return;
    }

    let isMounted = true;

    async function initDestinationAndFileName() {
      // 1. Resolve canonical absolute directory (never use relative "Video" as actual path)
      const saved =
        project?.metadata?.exportFolder ||
        settings?.exportDirectory ||
        localStorage.getItem('cf_last_export_dir') ||
        '';

      const resolved = await resolveCanonicalExportFolder(saved);
      if (!isMounted) return;
      setDestinationFolder(resolved.absolutePath);

      // 2. Resolve safe project name
      const rawName = project?.metadata?.name || 'Untitled Video';
      const cleanSafeName = sanitizeFileName(rawName, activeFormat);

      // 3. Auto-detect if project has captions
      const hasCaptions = (project?.captions?.length || 0) > 0;
      setBurnCaptions(hasCaptions);

      // 4. Match project FPS default
      if (project?.metadata?.fps) {
        setFps(project.metadata.fps >= 50 ? 60 : 30);
      }

      // 5. Query non-colliding file name from native system if possible
      if (window.captionForgeAPI?.getNextExportFileName) {
        try {
          const res = await window.captionForgeAPI.getNextExportFileName({
            folder: resolved.absolutePath,
            projectName: cleanSafeName.replace(/\.[^/.]+$/, ''),
            format: activeFormat,
          });
          if (res?.fileName && isMounted) setFileName(res.fileName);
        } catch {
          if (isMounted) setFileName(cleanSafeName);
        }
      } else {
        if (isMounted) setFileName(cleanSafeName);
      }
    }

    initDestinationAndFileName();

    return () => {
      isMounted = false;
    };
  }, [isOpen, project?.metadata?.id, activeFormat]);

  // Handle manual destination folder change using unified native picker
  const handleChooseFolder = async () => {
    setValidationError('');
    const chosen = await pickExportDestinationFolder(destinationFolder || settings.exportDirectory);
    if (chosen) {
      setDestinationFolder(chosen);
      await setProjectExportFolder(chosen);
      await updateSettings({ exportDirectory: chosen });

      // Update non-colliding name for the newly chosen folder
      const rawName = project?.metadata?.name || 'Untitled Video';
      const cleanSafeName = sanitizeFileName(rawName, activeFormat);
      if (window.captionForgeAPI?.getNextExportFileName) {
        try {
          const res = await window.captionForgeAPI.getNextExportFileName({
            folder: chosen,
            projectName: cleanSafeName.replace(/\.[^/.]+$/, ''),
            format: activeFormat,
          });
          if (res?.fileName) setFileName(res.fileName);
        } catch {}
      }
    }
  };

  // Video Bitrate calculation based on quality and resolution
  const getBitrateKbps = useCallback(() => {
    return resolveVideoBitrateKbps(resolution, qualityPreset);
  }, [qualityPreset, resolution]);

  // Duration & estimated size
  const durationSec = Math.max(0.1, getActiveContentDuration(project) || project?.metadata?.duration || 5);
  const estimatedFileSizeMb = (() => {
    if (category === 'subtitle') return '0.05';
    if (category === 'audio') {
      return ((durationSec * audioBitrateKbps) / 8 / 1024).toFixed(1);
    }
    if (category === 'gif') {
      const mult = gifResolution === '720p' ? 1.8 : gifResolution === '480p' ? 0.9 : 0.4;
      return (durationSec * gifFps * 0.08 * mult).toFixed(1);
    }
    const videoKbps = getBitrateKbps();
    return (((videoKbps + audioBitrateKbps) * durationSec) / 8 / 1024).toFixed(1);
  })();

  // Main Export Click Handler with Full Pre-Flight Validation
  const handleConfirmExport = async () => {
    if (isSubmitting) return; // Prevent duplicate clicks
    setIsSubmitting(true);
    setValidationError('');

    try {
      // 1. Content check
      const hasClips = (project?.clips?.length || 0) > 0;
      const hasAudio = (project?.audioClips?.length || 0) > 0;
      const hasCaptions = (project?.captions?.length || 0) > 0;
      const hasOverlays = (project?.overlays?.length || 0) > 0;

      if (!hasClips && !hasAudio && !hasCaptions && !hasOverlays) {
        setValidationError('The project timeline is empty. Add video, audio, or captions before exporting.');
        setIsSubmitting(false);
        return;
      }

      // 2. Resolve destination folder
      let targetFolder = destinationFolder;
      if (!targetFolder || targetFolder.trim() === '' || targetFolder.toLowerCase() === 'video') {
        const canonical = await resolveCanonicalExportFolder();
        targetFolder = canonical.absolutePath;
        setDestinationFolder(targetFolder);
      }

      // 3. Validate folder accessibility & writability
      const folderCheck = await validateExportDestination(targetFolder);
      if (!folderCheck.valid) {
        setValidationError(`Cannot write to selected export destination: ${folderCheck.error || 'Access denied'}`);
        setIsSubmitting(false);
        return;
      }

      // 4. Validate Audio Bitrate
      const audioValidation = validateAudioBitrate(activeFormat, audioBitrateKbps * 1000);
      const safeAudioBps = audioValidation.clampedBps;
      const safeAudioKbps = audioValidation.clampedKbps;

      // 5. Construct safe destination file path
      const finalFileName = sanitizeFileName(fileName || project?.metadata?.name || 'Video', activeFormat);
      const finalOutputPath = joinExportPath(targetFolder, finalFileName);

      const settingsObj: ExportSettings = {
        category,
        format: activeFormat,
        resolution: category === 'gif' ? gifResolution : resolution,
        fps: category === 'gif' ? gifFps : fps,
        codec: category === 'video' ? codec : undefined,
        bitrateKbps: getBitrateKbps(),
        bitratePreset: qualityPreset === 'high' ? 'higher' : qualityPreset === 'medium' ? 'recommended' : 'lower',
        hardwareEncoder: encoder,
        burnCaptions: category === 'video' ? burnCaptions : false,
        burnOverlays: true,
        outputPath: finalOutputPath,
        outputFolder: targetFolder,
        projectName: finalFileName.replace(/\.[^/.]+$/, ''),
        qualityPreset,
        audioSampleRate: 48000,
        audioChannels: 'stereo',
        audioBitrate: safeAudioKbps,
        audioBitrateKbps: safeAudioKbps,
        audioBitrateBps: safeAudioBps,
        subtitleScope,
        alsoExportSubtitles: category === 'video' && alsoExportSubtitles,
        alsoExportAudio: category === 'video' && alsoExportAudio,
        gifLoop,
        gifDithering: true,
      };

      onClose();
      onStartExport(settingsObj);
    } catch (err: any) {
      setValidationError(err?.message || 'Failed to prepare export settings.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const { supportedKbps: audioBitrateOptions } = getSupportedAudioBitrates(activeFormat);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Export Media"
      subtitle="Render and save your project directly into your chosen destination"
      maxWidth="lg"
    >
      <div className="space-y-4 select-none">
        {/* Validation Alert */}
        {validationError && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/50 flex items-center gap-2.5 text-xs text-red-200">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* 1. Destination Section — Authoritative Canonical Saved Folder */}
        <div className="p-3.5 rounded-xl bg-workspace-panel border border-workspace-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-workspace-cyan" />
              <span>Export Destination</span>
            </span>
            <button
              type="button"
              onClick={handleChooseFolder}
              className="text-[11px] text-workspace-cyan hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>Change Folder</span>
            </button>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-workspace-bg border border-workspace-border/70 text-xs font-mono text-gray-300">
            <span
              className="truncate flex-1 select-all"
              title={destinationFolder || 'No destination selected'}
            >
              {destinationFolder || 'Will resolve to default Videos/CaptionForge directory'}
            </span>
            {destinationFolder && (
              <span className="text-[10px] text-emerald-400 font-sans font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                Authoritative
              </span>
            )}
          </div>
        </div>

        {/* 2. File Name */}
        <div className="p-3.5 rounded-xl bg-workspace-panel border border-workspace-border space-y-1.5">
          <label className="text-xs font-bold text-gray-200 block">File Name</label>
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            className="w-full bg-workspace-bg border border-workspace-border text-white text-xs font-mono rounded-lg px-3 py-2 focus:outline-none focus:border-workspace-cyan"
            placeholder="export-video.mp4"
          />
        </div>

        {/* 3. Format & Category Switcher */}
        <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-workspace-panel border border-workspace-border">
          {[
            { id: 'video', label: 'Video (MP4)' },
            { id: 'audio', label: 'Audio (MP3)' },
            { id: 'subtitle', label: 'Captions (SRT)' },
            { id: 'gif', label: 'GIF Animation' },
          ].map((tab) => {
            const isSelected = category === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategory(tab.id as ExportCategory)}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                  isSelected
                    ? 'bg-workspace-active text-workspace-cyan shadow-sm border border-workspace-border'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-workspace-elevated'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 4. Essential Video Settings */}
        {category === 'video' && (
          <div className="p-3.5 rounded-xl bg-workspace-panel border border-workspace-border space-y-3">
            <div className="grid grid-cols-3 gap-3">
              {/* Quality Preset */}
              <div>
                <span className="text-[11px] font-bold text-gray-300 block mb-1">Quality</span>
                <select
                  value={qualityPreset}
                  onChange={(e) => setQualityPreset(e.target.value as any)}
                  className="w-full bg-workspace-bg border border-workspace-border text-white text-xs rounded-lg p-2 focus:outline-none focus:border-workspace-cyan"
                >
                  <option value="high">High (Recommended)</option>
                  <option value="medium">Medium (Balanced)</option>
                  <option value="low">Low (Fast / Compact)</option>
                </select>
              </div>

              {/* Resolution */}
              <div>
                <span className="text-[11px] font-bold text-gray-300 block mb-1">Resolution</span>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as ExportResolution)}
                  className="w-full bg-workspace-bg border border-workspace-border text-white text-xs rounded-lg p-2 focus:outline-none focus:border-workspace-cyan"
                >
                  <option value="720p">720p HD</option>
                  <option value="1080p">1080p Full HD (Default)</option>
                  <option value="2k">2K QHD</option>
                  <option value="4k">4K Ultra HD</option>
                  <option value="480p">480p SD</option>
                </select>
              </div>

              {/* Frame Rate */}
              <div>
                <span className="text-[11px] font-bold text-gray-300 block mb-1">Frame Rate</span>
                <select
                  value={fps}
                  onChange={(e) => setFps(parseInt(e.target.value, 10))}
                  className="w-full bg-workspace-bg border border-workspace-border text-white text-xs rounded-lg p-2 focus:outline-none focus:border-workspace-cyan"
                >
                  <option value="30">30 FPS (Standard)</option>
                  <option value="60">60 FPS (Smooth)</option>
                  <option value="24">24 FPS (Cinematic)</option>
                </select>
              </div>
            </div>

            {/* Burn Captions Toggle */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-workspace-bg border border-workspace-border">
              <div>
                <span className="text-xs font-bold text-gray-200 block">Burn Captions into Video</span>
                <span className="text-[10px] text-gray-400">Renders animated typography directly onto the video frames</span>
              </div>
              <input
                type="checkbox"
                checked={burnCaptions}
                onChange={(e) => setBurnCaptions(e.target.checked)}
                className="w-4 h-4 rounded bg-workspace-panel border-workspace-border text-workspace-cyan focus:ring-workspace-cyan cursor-pointer"
              />
            </div>

            {/* Collapsible Advanced Settings */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-gray-400 hover:text-workspace-cyan flex items-center gap-1 font-semibold transition-colors cursor-pointer"
              >
                {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span>{showAdvanced ? 'Hide Advanced Settings' : 'Show Advanced Settings'}</span>
              </button>

              {showAdvanced && (
                <div className="mt-2.5 p-3 rounded-lg bg-workspace-bg border border-workspace-border space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[11px] font-bold text-gray-300 block mb-1">Video Codec</span>
                      <select
                        value={codec}
                        onChange={(e) => setCodec(e.target.value as VideoCodec)}
                        className="w-full bg-workspace-panel border border-workspace-border text-white text-xs rounded-lg p-1.5 focus:outline-none"
                      >
                        <option value="h264">H.264 / AVC (Broad Compatibility)</option>
                        <option value="hevc">H.265 / HEVC (High Efficiency)</option>
                        <option value="prores">Apple ProRes 422 (Lossless Master)</option>
                      </select>
                    </div>

                    {/* Audio Bitrate Selector */}
                    <div>
                      <span className="text-[11px] font-bold text-gray-300 flex items-center gap-1 mb-1">
                        <Volume2 className="w-3 h-3 text-workspace-cyan" />
                        <span>Audio Bitrate</span>
                      </span>
                      <select
                        value={audioBitrateKbps}
                        onChange={(e) => setAudioBitrateKbps(parseInt(e.target.value, 10))}
                        className="w-full bg-workspace-panel border border-workspace-border text-white text-xs rounded-lg p-1.5 focus:outline-none font-mono"
                      >
                        {audioBitrateOptions.map((kbps) => (
                          <option key={kbps} value={kbps}>
                            {kbps} kbps {kbps === 192 ? '(High / Default)' : kbps === 160 ? '(Medium)' : kbps === 128 ? '(Standard)' : '(Compact)'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[11px] font-bold text-gray-300 block mb-1">Hardware Acceleration</span>
                      <div className="flex items-center gap-2 p-1.5 rounded-lg bg-workspace-panel border border-workspace-border text-xs">
                        <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-gray-200 font-semibold truncate text-[11px]">
                          {ffmpegStatus?.encoders?.includes('nvenc')
                            ? 'NVIDIA NVENC (Active)'
                            : ffmpegStatus?.encoders?.includes('qsv')
                            ? 'Intel QSV (Active)'
                            : 'Auto Hardware Acceleration'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Multi-Export Bundle Options */}
                  <div className="pt-2 border-t border-workspace-border/60">
                    <span className="text-[11px] font-bold text-gray-300 block mb-1.5">Also Export Beside Video:</span>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 p-2 rounded-lg bg-workspace-panel border border-workspace-border hover:border-workspace-cyan cursor-pointer transition-all">
                        <input
                          type="checkbox"
                          checked={alsoExportSubtitles}
                          onChange={(e) => setAlsoExportSubtitles(e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-workspace-cyan focus:ring-workspace-cyan cursor-pointer"
                        />
                        <span className="text-[11px] text-gray-200">+ Clean Subtitles (.srt)</span>
                      </label>

                      <label className="flex items-center gap-2 p-2 rounded-lg bg-workspace-panel border border-workspace-border hover:border-workspace-cyan cursor-pointer transition-all">
                        <input
                          type="checkbox"
                          checked={alsoExportAudio}
                          onChange={(e) => setAlsoExportAudio(e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-workspace-cyan focus:ring-workspace-cyan cursor-pointer"
                        />
                        <span className="text-[11px] text-gray-200">+ Clean Audio (.mp3)</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. Subtitle Only Mode */}
        {category === 'subtitle' && (
          <div className="p-3.5 rounded-xl bg-workspace-panel border border-workspace-border space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] font-bold text-gray-300 block mb-1">Subtitle Format</span>
                <select
                  value={subtitleFormat}
                  onChange={(e) => setSubtitleFormat(e.target.value as ExportFormat)}
                  className="w-full bg-workspace-bg border border-workspace-border text-white text-xs rounded-lg p-2 focus:outline-none"
                >
                  <option value="srt">SubRip (.srt) for YouTube / Social</option>
                  <option value="vtt">WebVTT (.vtt) for Web Players</option>
                  <option value="ass">Advanced SubStation Alpha (.ass)</option>
                </select>
              </div>

              <div>
                <span className="text-[11px] font-bold text-gray-300 block mb-1">Export Scope</span>
                <select
                  value={subtitleScope}
                  onChange={(e) => setSubtitleScope(e.target.value as any)}
                  className="w-full bg-workspace-bg border border-workspace-border text-white text-xs rounded-lg p-2 focus:outline-none"
                >
                  <option value="all">All Subtitle Lines ({project?.captions?.length || 0} lines)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 6. Audio Only Mode */}
        {category === 'audio' && (
          <div className="p-3.5 rounded-xl bg-workspace-panel border border-workspace-border space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] font-bold text-gray-300 block mb-1">Audio Format</span>
                <select
                  value={audioFormat}
                  onChange={(e) => setAudioFormat(e.target.value as ExportFormat)}
                  className="w-full bg-workspace-bg border border-workspace-border text-white text-xs rounded-lg p-2 focus:outline-none"
                >
                  <option value="mp3">MP3 Audio (.mp3)</option>
                  <option value="wav">WAV Uncompressed (.wav)</option>
                  <option value="aac">AAC Audio (.aac)</option>
                </select>
              </div>

              <div>
                <span className="text-[11px] font-bold text-gray-300 block mb-1">Bitrate</span>
                <select
                  value={audioBitrateKbps}
                  onChange={(e) => setAudioBitrateKbps(parseInt(e.target.value, 10))}
                  className="w-full bg-workspace-bg border border-workspace-border text-white text-xs rounded-lg p-2 focus:outline-none font-mono"
                >
                  {audioBitrateOptions.map((kbps) => (
                    <option key={kbps} value={kbps}>
                      {kbps} kbps {kbps === 320 ? '(Maximum Quality)' : kbps === 192 ? '(High)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 7. GIF Animation Mode */}
        {category === 'gif' && (
          <div className="p-3.5 rounded-xl bg-workspace-panel border border-workspace-border space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] font-bold text-gray-300 block mb-1">Resolution</span>
                <select
                  value={gifResolution}
                  onChange={(e) => setGifResolution(e.target.value as ExportResolution)}
                  className="w-full bg-workspace-bg border border-workspace-border text-white text-xs rounded-lg p-2 focus:outline-none"
                >
                  <option value="480p">480p (Standard Social Meme)</option>
                  <option value="720p">720p HD (High Quality)</option>
                </select>
              </div>

              <div>
                <span className="text-[11px] font-bold text-gray-300 block mb-1">Frame Rate</span>
                <select
                  value={gifFps}
                  onChange={(e) => setGifFps(parseInt(e.target.value, 10))}
                  className="w-full bg-workspace-bg border border-workspace-border text-white text-xs rounded-lg p-2 focus:outline-none"
                >
                  <option value="15">15 FPS (Recommended)</option>
                  <option value="24">24 FPS (Smooth)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Summary Footer */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-workspace-panel border border-workspace-border">
          <div className="flex items-center gap-3 text-xs text-gray-300 font-medium">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span>Duration: <strong className="text-white font-mono">{formatTimecode(durationSec, false)}</strong></span>
            </div>
            <div className="w-[1px] h-3.5 bg-workspace-border" />
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-gray-400" />
              <span>Est. Size: <strong className="text-workspace-cyan font-mono">~{estimatedFileSizeMb} MB</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg bg-workspace-bg hover:bg-workspace-elevated border border-workspace-border text-xs font-semibold text-gray-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirmExport}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg bg-workspace-cyan text-black font-extrabold text-xs shadow-lg shadow-cyan-950/60 hover:brightness-110 active:scale-95 transition-all cursor-pointer ${
                isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{isSubmitting ? 'Preparing...' : 'Export'}</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
