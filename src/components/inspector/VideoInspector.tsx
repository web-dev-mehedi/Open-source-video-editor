import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Section } from './shared/Section';
import { NumberControl } from './shared/NumberControl';
import {
  Scissors,
  Gauge,
  Layers,
  Sparkles,
  SunMedium,
  Box,
  Crop,
  Search,
  RotateCw,
  RotateCcw,
  Volume2,
  VolumeX,
  Wand2,
  Sliders,
  Play,
  UserCheck,
  Eye,
  SlidersHorizontal,
  Diamond,
  Lock,
  Unlock,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignHorizontalJustifyCenter,
  ArrowUp,
  ArrowDown,
  FlipHorizontal,
  FlipVertical,
  Activity,
  Palette,
  Film,
} from 'lucide-react';
import { ColorGradingStudio } from '../grading/ColorGradingStudio';
import { MaskStudio } from '../editor/MaskStudio';
import { BeautyRetouchStudio } from '../editor/BeautyRetouchStudio';
import { BackgroundMattingStudio } from '../editor/BackgroundMattingStudio';
import { ClipAnimationStudio } from './ClipAnimationStudio';

type PrimaryTab = 'video' | 'audio' | 'speed' | 'animation' | 'adjust' | 'ai';
type VideoSubTab = 'basic' | 'remove_bg' | 'mask' | 'retouch';

const BLEND_MODES = [
  { id: 'normal', label: 'Normal' },
  { id: 'screen', label: 'Screen' },
  { id: 'multiply', label: 'Multiply' },
  { id: 'overlay', label: 'Overlay' },
  { id: 'darken', label: 'Darken' },
  { id: 'lighten', label: 'Lighten' },
  { id: 'color-dodge', label: 'Color Dodge' },
  { id: 'difference', label: 'Difference' },
  { id: 'soft-light', label: 'Soft Light' },
];

export const VideoInspector: React.FC = () => {
  const {
    project,
    selectedClipId,
    setSelectedClipId,
    updateClip,
    updateClipTransform,
    deleteClip,
    splitClipAtPlayhead,
    duplicateClip,
    isCropping,
    toggleCropMode,
    setActiveSidebarTab,
  } = useProject();

  const [primaryTab, setPrimaryTab] = useState<PrimaryTab>('video');
  const [videoSubTab, setVideoSubTab] = useState<VideoSubTab>('basic');
  const [isUniformScale, setIsUniformScale] = useState(true);

  const clip = project?.clips.find((c) => c.id === selectedClipId);

  if (!clip) {
    return (
      <div className="p-4 text-xs text-neutral-500 text-center flex flex-col items-center justify-center h-full space-y-2">
        <Film className="w-8 h-8 text-neutral-600 animate-pulse" />
        <p className="font-semibold text-neutral-400">Select a clip on the timeline</p>
        <p className="text-[11px] text-neutral-600">Properties, transform, audio, and AI tools will appear here.</p>
      </div>
    );
  }

  const transform = clip.transform || {
    scale: 1,
    xPercent: 0,
    yPercent: 0,
    rotation: 0,
    opacity: 1,
  };

  const currentScalePercent = Math.round((transform.scale ?? 1) * 100);
  const currentOpacityPercent = Math.round((transform.opacity ?? 1) * 100);
  const currentRotation = Math.round(transform.rotation ?? 0);
  const currentX = Math.round(transform.xPercent ?? 0);
  const currentY = Math.round(transform.yPercent ?? 0);
  const currentBlendMode = clip.blendMode || 'normal';

  // Quick Alignment Handlers
  const handleAlign = (type: 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom') => {
    switch (type) {
      case 'left': updateClipTransform(clip.id, { xPercent: -35 }); break;
      case 'center-h': updateClipTransform(clip.id, { xPercent: 0 }); break;
      case 'right': updateClipTransform(clip.id, { xPercent: 35 }); break;
      case 'top': updateClipTransform(clip.id, { yPercent: -35 }); break;
      case 'center-v': updateClipTransform(clip.id, { yPercent: 0 }); break;
      case 'bottom': updateClipTransform(clip.id, { yPercent: 35 }); break;
    }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-900 text-gray-200 select-none overflow-hidden font-sans">
      {/* ────────────────── 1. PRIMARY NAVIGATION TABS (CapCut Architecture) ────────────────── */}
      <div className="h-10 border-b border-neutral-800 bg-neutral-950 flex items-center px-1.5 gap-1 overflow-x-auto no-scrollbar flex-shrink-0">
        {[
          { id: 'video', label: 'Video' },
          { id: 'audio', label: 'Audio' },
          { id: 'speed', label: 'Speed' },
          { id: 'animation', label: 'Animation' },
          { id: 'adjust', label: 'Adjust' },
          { id: 'ai', label: 'AI Tools' },
        ].map((tab) => {
          const isActive = primaryTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setPrimaryTab(tab.id as PrimaryTab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-neutral-800 text-forge-cyan shadow-xs border border-neutral-700/60'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-neutral-800/50'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ────────────────── 2. SECONDARY SUB-TABS (Under Video) ────────────────── */}
      {primaryTab === 'video' && (
        <div className="h-8 border-b border-neutral-800 bg-neutral-900/90 flex items-center px-3 gap-2 flex-shrink-0">
          {[
            { id: 'basic', label: 'Basic' },
            { id: 'remove_bg', label: 'Remove BG' },
            { id: 'mask', label: 'Mask' },
            { id: 'retouch', label: 'Retouch' },
          ].map((sub) => {
            const isActive = videoSubTab === sub.id;
            return (
              <button
                key={sub.id}
                onClick={() => setVideoSubTab(sub.id as VideoSubTab)}
                className={`text-[11px] font-semibold transition-colors relative py-1 ${
                  isActive ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <span>{sub.label}</span>
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-forge-cyan rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ────────────────── 3. TAB CONTENT PANELS ────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* ======================= VIDEO TAB: BASIC ======================= */}
        {primaryTab === 'video' && videoSubTab === 'basic' && (
          <>
            {/* TRANSFORM ACCORDION */}
            <Section
              title="Transform"
              defaultOpen
              storageKey="capcut_transform"
              onReset={() =>
                updateClipTransform(clip.id, {
                  scale: 1,
                  xPercent: 0,
                  yPercent: 0,
                  rotation: 0,
                  opacity: 1,
                })
              }
            >
              {/* Scale Control + Keyframe Toggle */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-300">
                  <span className="flex items-center gap-1">
                    <span>Scale</span>
                    <button
                      onClick={() => setIsUniformScale(!isUniformScale)}
                      className={`p-1 rounded text-[10px] ${
                        isUniformScale ? 'text-forge-cyan' : 'text-gray-500'
                      }`}
                      title={isUniformScale ? 'Uniform scale locked' : 'Independent X/Y scale'}
                    >
                      {isUniformScale ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    </button>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={500}
                      value={currentScalePercent}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        updateClipTransform(clip.id, { scale: Math.max(0, val) / 100 });
                      }}
                      className="w-14 px-1.5 py-0.5 text-right font-mono bg-neutral-800 border border-neutral-700 rounded text-xs text-white focus:outline-none focus:border-forge-cyan"
                    />
                    <span className="text-gray-400 font-mono text-[10px]">%</span>
                    <button
                      className="p-1 text-gray-500 hover:text-amber-400 transition-colors"
                      title="Add Keyframe"
                    >
                      <Diamond className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <input
                  type="range"
                  min={0}
                  max={500}
                  value={currentScalePercent}
                  onChange={(e) =>
                    updateClipTransform(clip.id, {
                      scale: parseFloat(e.target.value) / 100,
                    })
                  }
                  className="w-full accent-forge-cyan h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Position X / Y Dual Scrubbers */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-gray-400">Position X</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={-100}
                      max={100}
                      value={currentX}
                      onChange={(e) =>
                        updateClipTransform(clip.id, {
                          xPercent: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-2 py-1 font-mono bg-neutral-800 border border-neutral-700 rounded text-xs text-white focus:outline-none focus:border-forge-cyan"
                    />
                    <span className="text-[10px] text-gray-500 font-mono">px</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-gray-400">Position Y</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={-100}
                      max={100}
                      value={currentY}
                      onChange={(e) =>
                        updateClipTransform(clip.id, {
                          yPercent: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-2 py-1 font-mono bg-neutral-800 border border-neutral-700 rounded text-xs text-white focus:outline-none focus:border-forge-cyan"
                    />
                    <span className="text-[10px] text-gray-500 font-mono">px</span>
                  </div>
                </div>
              </div>

              {/* Rotation Dial / Angle Control */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-300">
                  <span>Rotate</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        updateClipTransform(clip.id, {
                          rotation: (currentRotation - 90) % 360,
                        })
                      }
                      className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-gray-400 hover:text-white"
                      title="Rotate -90°"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      min={-360}
                      max={360}
                      value={currentRotation}
                      onChange={(e) =>
                        updateClipTransform(clip.id, {
                          rotation: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-14 px-1.5 py-0.5 text-right font-mono bg-neutral-800 border border-neutral-700 rounded text-xs text-white focus:outline-none focus:border-forge-cyan"
                    />
                    <span className="text-gray-400 font-mono text-[10px]">°</span>
                    <button
                      onClick={() =>
                        updateClipTransform(clip.id, {
                          rotation: (currentRotation + 90) % 360,
                        })
                      }
                      className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-gray-400 hover:text-white"
                      title="Rotate +90°"
                    >
                      <RotateCw className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <input
                  type="range"
                  min={-180}
                  max={180}
                  value={currentRotation}
                  onChange={(e) =>
                    updateClipTransform(clip.id, {
                      rotation: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-forge-cyan h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Alignment Grid Quick-Actions (6 Buttons) */}
              <div className="space-y-1 pt-1.5">
                <span className="text-[11px] font-semibold text-gray-400 block">Quick Align</span>
                <div className="grid grid-cols-6 gap-1 bg-neutral-950/60 p-1 rounded-lg border border-neutral-800">
                  <button
                    onClick={() => handleAlign('left')}
                    className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-gray-300 hover:text-white"
                    title="Align Left"
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleAlign('center-h')}
                    className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-gray-300 hover:text-white"
                    title="Center Horizontally"
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleAlign('right')}
                    className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-gray-300 hover:text-white"
                    title="Align Right"
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleAlign('top')}
                    className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-gray-300 hover:text-white"
                    title="Align Top"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleAlign('center-v')}
                    className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-gray-300 hover:text-white"
                    title="Center Vertically"
                  >
                    <AlignHorizontalJustifyCenter className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleAlign('bottom')}
                    className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-gray-300 hover:text-white"
                    title="Align Bottom"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </Section>

            {/* BLEND & COMPOSITING ACCORDION */}
            <Section
              title="Blend & Compositing"
              defaultOpen
              storageKey="capcut_blend"
              onReset={() => {
                updateClip(clip.id, { blendMode: 'normal' });
                updateClipTransform(clip.id, { opacity: 1 });
              }}
            >
              {/* Blend Mode Dropdown */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-gray-400 block">Blend Mode</span>
                <select
                  value={currentBlendMode}
                  onChange={(e) => updateClip(clip.id, { blendMode: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-forge-cyan capitalize"
                >
                  {BLEND_MODES.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Opacity Slider */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-300">
                  <span>Opacity</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={currentOpacityPercent}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        updateClipTransform(clip.id, { opacity: Math.max(0, Math.min(100, val)) / 100 });
                      }}
                      className="w-14 px-1.5 py-0.5 text-right font-mono bg-neutral-800 border border-neutral-700 rounded text-xs text-white focus:outline-none focus:border-forge-cyan"
                    />
                    <span className="text-gray-400 font-mono text-[10px]">%</span>
                    <button
                      className="p-1 text-gray-500 hover:text-amber-400 transition-colors"
                      title="Add Keyframe"
                    >
                      <Diamond className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <input
                  type="range"
                  min={0}
                  max={100}
                  value={currentOpacityPercent}
                  onChange={(e) =>
                    updateClipTransform(clip.id, {
                      opacity: parseFloat(e.target.value) / 100,
                    })
                  }
                  className="w-full accent-forge-cyan h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>
            </Section>

            {/* CROP & FRAMING ACCORDION */}
            <Section
              title="Crop & Framing"
              defaultOpen={false}
              storageKey="capcut_crop"
              onReset={() => updateClip(clip.id, { crop: { top: 0, bottom: 0, left: 0, right: 0 } })}
            >
              <button
                onClick={() => {
                  setSelectedClipId(clip.id);
                  toggleCropMode();
                }}
                className={`w-full px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all mb-2 ${
                  isCropping
                    ? 'bg-forge-cyan/20 text-forge-cyan border-forge-cyan/50'
                    : 'bg-neutral-800 border-neutral-700 text-gray-200 hover:text-white'
                }`}
              >
                <Crop className="w-3.5 h-3.5 text-forge-cyan" />
                <span>{isCropping ? 'Close Crop Overlay' : 'Interactive Crop Tool'}</span>
              </button>

              <div className="grid grid-cols-4 gap-1 mb-2">
                {[
                  { label: 'Free', crop: { top: 0, bottom: 0, left: 0, right: 0 } },
                  { label: '16:9', crop: { top: 12.5, bottom: 12.5, left: 0, right: 0 } },
                  { label: '9:16', crop: { top: 0, bottom: 0, left: 21.9, right: 21.9 } },
                  { label: '1:1', crop: { top: 0, bottom: 0, left: 16.7, right: 16.7 } },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => updateClip(clip.id, { crop: preset.crop })}
                    className="px-1.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[10px] text-gray-300 font-medium transition-colors text-center"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </Section>
          </>
        )}

        {/* ======================= VIDEO TAB: REMOVE BG ======================= */}
        {primaryTab === 'video' && videoSubTab === 'remove_bg' && (
          <div className="h-[480px]">
            <BackgroundMattingStudio />
          </div>
        )}

        {/* ======================= VIDEO TAB: MASK ======================= */}
        {primaryTab === 'video' && videoSubTab === 'mask' && <MaskStudio />}

        {/* ======================= VIDEO TAB: RETOUCH ======================= */}
        {primaryTab === 'video' && videoSubTab === 'retouch' && <BeautyRetouchStudio />}

        {/* ======================= AUDIO TAB ======================= */}
        {primaryTab === 'audio' && (
          <div className="space-y-3">
            <Section title="Volume & Dynamics" defaultOpen storageKey="capcut_audio">
              <NumberControl
                label="Volume"
                value={Math.round((clip.volume ?? 1) * 100)}
                min={0}
                max={200}
                onChange={(v) => updateClip(clip.id, { volume: v / 100 })}
                unit="%"
              />

              <button
                onClick={() => updateClip(clip.id, { isMuted: !clip.isMuted })}
                className={`w-full py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 border transition-all ${
                  clip.isMuted
                    ? 'bg-red-500/20 text-red-300 border-red-500/40'
                    : 'bg-neutral-800 border-neutral-700 text-gray-200 hover:bg-neutral-700'
                }`}
              >
                {clip.isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-forge-cyan" />}
                <span>{clip.isMuted ? 'Muted' : 'Mute Clip Audio'}</span>
              </button>
            </Section>
          </div>
        )}

        {/* ======================= SPEED TAB ======================= */}
        {primaryTab === 'speed' && (
          <div className="space-y-3">
            <Section title="Playback Speed" defaultOpen storageKey="capcut_speed">
              <NumberControl
                label="Speed"
                value={clip.speed || 1.0}
                min={0.1}
                max={10.0}
                step={0.1}
                onChange={(v) => {
                  const newSpeed = Math.max(0.1, v);
                  const newTimelineDuration = (clip.endOffset - clip.startOffset) / newSpeed;
                  updateClip(clip.id, { speed: newSpeed, timelineDuration: newTimelineDuration });
                }}
                unit="x"
              />

              <div className="grid grid-cols-4 gap-1 pt-1">
                {[0.5, 1.0, 1.5, 2.0].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      const newTimelineDuration = (clip.endOffset - clip.startOffset) / s;
                      updateClip(clip.id, { speed: s, timelineDuration: newTimelineDuration });
                    }}
                    className={`py-1 rounded text-xs font-mono font-semibold transition-colors ${
                      clip.speed === s
                        ? 'bg-forge-cyan text-black font-bold'
                        : 'bg-neutral-800 text-gray-300 hover:bg-neutral-700'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </Section>
          </div>
        )}

        {/* ======================= ANIMATION TAB ======================= */}
        {primaryTab === 'animation' && <ClipAnimationStudio />}

        {/* ======================= ADJUST TAB (COLOR GRADING) ======================= */}
        {primaryTab === 'adjust' && <ColorGradingStudio />}

        {/* ======================= AI TOOLS TAB ======================= */}
        {primaryTab === 'ai' && (
          <div className="space-y-3">
            <Section title="Intelligent AI Features" defaultOpen storageKey="capcut_ai_tools">
              <div className="space-y-2">
                <button
                  onClick={() => setActiveSidebarTab('captions')}
                  className="w-full p-2.5 rounded-xl bg-neutral-800 border border-neutral-700/80 hover:border-forge-cyan flex items-center justify-between text-left transition-all group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-200">Auto Captions & Subtitles</div>
                      <div className="text-[10px] text-gray-400">Generate synced animated words</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-amber-400">AI</span>
                </button>

                <button
                  onClick={() => setActiveSidebarTab('audio')}
                  className="w-full p-2.5 rounded-xl bg-neutral-800 border border-neutral-700/80 hover:border-forge-cyan flex items-center justify-between text-left transition-all group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Wand2 className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-200">Vocal Remover / Denoise</div>
                      <div className="text-[10px] text-gray-400">Isolate vocals & remove room noise</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-purple-400">Pro</span>
                </button>
              </div>
            </Section>
          </div>
        )}
      </div>
    </div>
  );
};
