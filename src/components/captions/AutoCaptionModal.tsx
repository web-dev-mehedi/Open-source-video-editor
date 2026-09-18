import React, { useState, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useSettings } from '../../context/SettingsContext';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import {
  Sparkles,
  Languages,
  Key,
  Check,
  AlertCircle,
  ExternalLink,
  Volume2,
  Film,
  Zap,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { transcribeWithGeminiWeb } from '../../utils/geminiAudioTranscriber';
import { CaptionLine } from '../../types/caption';
import { generateMultiStyledCaptions } from '../../utils/multiCaptionStyleEngine';
import { processGeminiCaptionsThroughTimingEngine } from '../../utils/captionTimingEngine';

interface AutoCaptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LANGUAGE_OPTIONS = [
  { code: 'auto', name: 'Auto-Detect', nativeName: 'AI Powered', flag: '✨' },
  { code: 'bn', name: 'Bengali', nativeName: 'Bangla', flag: '🇧🇩' },
  { code: 'en', name: 'English', nativeName: 'English (US/UK)', flag: '🇺🇸' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिंदी', flag: '🇮🇳' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
];

export const AutoCaptionModal: React.FC<AutoCaptionModalProps> = ({ isOpen, onClose }) => {
  const { project, setCaptions, setActiveSidebarTab, selectedClipId } = useProject();
  const { settings, updateSettings } = useSettings();

  const [selectedLanguage, setSelectedLanguage] = useState<string>('bn');
  const [geminiApiKey, setGeminiApiKey] = useState<string>(settings.geminiApiKey || '');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-1.5-flash');
  const [selectedTrackSource, setSelectedTrackSource] = useState<'primary' | 'selected' | 'audio1'>('primary');
  const [autoMultiStyle, setAutoMultiStyle] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (settings.geminiApiKey) {
      setGeminiApiKey(settings.geminiApiKey);
    }
  }, [settings.geminiApiKey]);

  const primaryClip = project?.clips?.[0];
  const selectedClip = project?.clips?.find((c) => c.id === selectedClipId);
  const audioClip1 = project?.audioClips?.[0];

  const handleGenerateCaptions = async () => {
    setErrorMessage(null);

    const activeApiKey = geminiApiKey.trim() || settings.geminiApiKey?.trim();
    if (!activeApiKey) {
      setErrorMessage('Google Gemini API Key is required. Please paste your API key below.');
      return;
    }

    // Save key to global settings
    if (activeApiKey !== settings.geminiApiKey) {
      updateSettings({ geminiApiKey: activeApiKey });
    }

    // Determine target media clip
    let targetClip = primaryClip;
    let targetMediaFile = primaryClip?.mediaBlobUrl || primaryClip?.filePath || '';
    if (selectedTrackSource === 'selected' && selectedClip) {
      targetClip = selectedClip;
      targetMediaFile = selectedClip.mediaBlobUrl || selectedClip.filePath;
    } else if (selectedTrackSource === 'audio1' && audioClip1) {
      targetClip = audioClip1 as any;
      targetMediaFile = audioClip1.mediaBlobUrl || audioClip1.filePath;
    }

    if (!targetMediaFile) {
      setErrorMessage('No video or audio clip found on the timeline. Please add a video clip first.');
      return;
    }

    setIsProcessing(true);
    setProgressStatus('Initializing speech extraction pipeline...');

    try {
      let captions: CaptionLine[] = [];

      const isLocalDiskPath =
        typeof targetMediaFile === 'string' &&
        !targetMediaFile.startsWith('blob:') &&
        !targetMediaFile.startsWith('http:') &&
        !targetMediaFile.startsWith('https:') &&
        !targetMediaFile.startsWith('data:');

      if (window.captionForgeAPI && isLocalDiskPath) {
        // Desktop Electron native pipeline for local disk files
        setProgressStatus('Extracting 16kHz audio stream via local FFmpeg...');
        captions = await window.captionForgeAPI.transcribeAudio(
          targetMediaFile,
          activeApiKey,
          selectedLanguage === 'auto' ? undefined : selectedLanguage,
          selectedModel
        );
      } else {
        // Web / Blob in-memory audio extraction pipeline
        captions = await transcribeWithGeminiWeb({
          mediaSrc: targetMediaFile,
          apiKey: activeApiKey,
          language: selectedLanguage,
          model: selectedModel,
          onProgress: (status) => setProgressStatus(status),
        });
      }

      if (!captions || captions.length === 0) {
        throw new Error('No speech dialogue detected in the audio.');
      }

      // Map source-relative timestamps to timeline coordinate space
      if (targetClip) {
        const clipTimelineStart = targetClip.timelineStart ?? 0;
        const clipSpeed = targetClip.speed || 1;
        const clipStartOffset = targetClip.startOffset ?? 0;
        const clipEndOffset = targetClip.endOffset ?? targetClip.duration ?? targetClip.timelineDuration ?? project?.metadata?.duration ?? 30;

        const sourceToTimeline = (t: number) => {
          const tl = clipTimelineStart + (t - clipStartOffset) / clipSpeed;
          return Math.round(tl * 100) / 100;
        };

        const mappedCaptions = captions
          .map((c) => {
            const filteredWords = (c.words || []).filter((w) => w.end > clipStartOffset && w.start < clipEndOffset);
            if (filteredWords.length === 0 && (c.words || []).length > 0) return null;
            const mappedWords = (filteredWords.length > 0 ? filteredWords : c.words || []).map((w) => ({
              ...w,
              start: sourceToTimeline(w.start),
              end: sourceToTimeline(w.end),
            }));
            const newStart = mappedWords.length > 0 ? Math.min(...mappedWords.map((w) => w.start)) : sourceToTimeline(c.start);
            const newEnd = mappedWords.length > 0 ? Math.max(...mappedWords.map((w) => w.end)) : sourceToTimeline(c.end);
            return {
              ...c,
              clipId: targetClip.id,
              start: Math.round(newStart * 100) / 100,
              end: Math.round(newEnd * 100) / 100,
              words: mappedWords,
            } as CaptionLine;
          })
          .filter(Boolean)
          .filter((c: any) => c.end > c.start && isFinite(c.start) && isFinite(c.end)) as CaptionLine[];

        if (mappedCaptions.length > 0) {
          captions = mappedCaptions;
        }
      }

      // Two-stage validation through timing engine
      const mediaDuration = Math.max(0.5, project?.metadata?.duration || targetClip?.duration || 30);
      const fps = project?.metadata?.fps || 30;
      const engineResult = processGeminiCaptionsThroughTimingEngine(captions, mediaDuration, fps);
      captions = engineResult.captions;

      const finalCaptions = autoMultiStyle
        ? generateMultiStyledCaptions(captions, 'premiere-pro-viral')
        : captions;

      setCaptions(finalCaptions);
      setActiveSidebarTab('captions');
      onClose();
    } catch (err: any) {
      console.error('Transcription error:', err);
      setErrorMessage(
        err?.message || 'Failed to generate captions. Please verify your Gemini API key and audio track.'
      );
    } finally {
      setIsProcessing(false);
      setProgressStatus('');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Auto-Generate AI Captions & Subtitles"
      subtitle="100% accurate speech-to-text transcription powered by Google Gemini Multimodal ASR"
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 flex items-start gap-2.5 text-red-300 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
            <div className="flex-1">
              <span className="font-bold">Error: </span>
              {errorMessage}
            </div>
          </div>
        )}

        {/* 1. Spoken Language Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5 text-forge-cyan" />
              <span>Video Spoken Language</span>
            </span>
            <span className="text-[11px] text-gray-400 font-normal">
              Select or Auto-Detect
            </span>
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pr-1">
            {LANGUAGE_OPTIONS.map((lang) => {
              const isSelected = selectedLanguage === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setSelectedLanguage(lang.code)}
                  className={`flex items-center justify-between p-2 rounded-xl text-left border text-xs transition-all ${
                    isSelected
                      ? 'border-forge-cyan bg-cyan-950/40 text-forge-cyan shadow-sm ring-1 ring-cyan-400'
                      : 'border-canvas-border bg-canvas-card text-gray-300 hover:border-gray-600 hover:bg-canvas-dark'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{lang.flag}</span>
                    <span className="font-semibold">{lang.name}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-forge-cyan" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Audio Source Track Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-forge-cyan" />
            <span>Audio Source Track</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setSelectedTrackSource('primary')}
              className={`p-2.5 rounded-xl border text-left text-xs transition-all flex flex-col gap-1 ${
                selectedTrackSource === 'primary'
                  ? 'border-forge-cyan bg-cyan-950/40 text-forge-cyan shadow-sm ring-1 ring-cyan-400'
                  : 'border-canvas-border bg-canvas-card text-gray-300 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold">
                <Film className="w-3.5 h-3.5" />
                <span>Primary Video (V1)</span>
              </div>
              <span className="text-[10px] text-gray-400">Main camera dialogue</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedTrackSource('selected')}
              disabled={!selectedClip}
              className={`p-2.5 rounded-xl border text-left text-xs transition-all flex flex-col gap-1 ${
                !selectedClip
                  ? 'opacity-40 cursor-not-allowed border-canvas-border bg-canvas-card text-gray-500'
                  : selectedTrackSource === 'selected'
                  ? 'border-forge-cyan bg-cyan-950/40 text-forge-cyan shadow-sm ring-1 ring-cyan-400'
                  : 'border-canvas-border bg-canvas-card text-gray-300 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold">
                <Zap className="w-3.5 h-3.5" />
                <span>Selected Clip</span>
              </div>
              <span className="text-[10px] text-gray-400">Currently active clip</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedTrackSource('audio1')}
              disabled={!audioClip1}
              className={`p-2.5 rounded-xl border text-left text-xs transition-all flex flex-col gap-1 ${
                !audioClip1
                  ? 'opacity-40 cursor-not-allowed border-canvas-border bg-canvas-card text-gray-500'
                  : selectedTrackSource === 'audio1'
                  ? 'border-forge-cyan bg-cyan-950/40 text-forge-cyan shadow-sm ring-1 ring-cyan-400'
                  : 'border-canvas-border bg-canvas-card text-gray-300 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold">
                <Volume2 className="w-3.5 h-3.5" />
                <span>Audio Track (A1)</span>
              </div>
              <span className="text-[10px] text-gray-400">Microphone voiceover</span>
            </button>
          </div>
        </div>

        {/* 3. Gemini API Key Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-forge-cyan" />
              <span>Google Gemini API Key</span>
            </label>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-forge-cyan hover:underline flex items-center gap-1"
            >
              <span>Get Free Gemini Key</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="relative">
            <input
              type="password"
              placeholder="AIzaSy..."
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              className="w-full pl-3 pr-24 py-2 text-xs bg-canvas-card border border-canvas-border rounded-xl text-gray-200 focus:outline-none focus:border-forge-cyan placeholder-gray-600 font-mono"
            />
            {geminiApiKey && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-emerald-400 font-bold flex items-center gap-1 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
                <Check className="w-3 h-3" />
                <span>Ready</span>
              </span>
            )}
          </div>
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <span className="font-semibold text-gray-300">Model:</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-canvas-card border border-canvas-border rounded px-1.5 py-0.5 text-[10px] text-gray-300 focus:outline-none"
              >
                <option value="gemini-1.5-flash">Gemini 1.5 Flash (Production Fast & Reliable)</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro (Deep Multilingual Nuance)</option>
              </select>
            </span>

            <span className="text-[10px] text-emerald-400 font-semibold">
              ✓ Millisecond Word Alignment
            </span>
          </div>
        </div>

        {/* Dynamic Multi-Style Auto Flow Toggle */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-purple-950/40 border border-purple-500/40 shadow-sm">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-forge-cyan animate-pulse" />
            <div>
              <span className="text-xs font-black text-white block flex items-center gap-1.5">
                <span>Auto-Apply Multi-Template Variations</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/30 text-purple-200 border border-purple-400/40 font-bold">
                  VIRAL FLOW
                </span>
              </span>
              <span className="text-[10px] text-gray-300">
                Automatically applies dynamic styles, colors, and animations across every sentence (Premiere Pro style)
              </span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={autoMultiStyle}
            onChange={(e) => setAutoMultiStyle(e.target.checked)}
            className="w-4 h-4 rounded text-forge-cyan focus:ring-forge-cyan cursor-pointer"
          />
        </div>

        {/* Live Progress HUD */}
        {isProcessing && (
          <div className="p-3 rounded-xl bg-forge-cyan/10 border border-forge-cyan/30 space-y-2 animate-pulse">
            <div className="flex items-center gap-2 text-xs font-bold text-forge-cyan">
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>{progressStatus || 'Transcribing speech with Gemini AI...'}</span>
            </div>
            <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden">
              <div className="bg-forge-cyan h-full rounded-full w-full animate-indeterminate" />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-canvas-border">
          <Button variant="secondary" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>

          <Button
            variant="gradient"
            leftIcon={<Sparkles className="w-4 h-4" />}
            onClick={handleGenerateCaptions}
            isLoading={isProcessing}
            disabled={isProcessing}
          >
            Generate AI Captions
          </Button>
        </div>
      </div>
    </Modal>
  );
};
