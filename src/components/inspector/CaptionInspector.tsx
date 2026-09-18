import React, { useState, useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import {
  Type,
  Palette,
  Move,
  Sparkles,
  Bookmark,
  Layers,
  RotateCcw,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sun,
  Eye,
  Check,
  Zap,
  Sliders,
  ChevronDown,
  ChevronRight,
  Trash2,
  Copy,
  Plus,
} from 'lucide-react';
import {
  IN_ANIMATIONS,
  OUT_ANIMATIONS,
  LOOP_ANIMATIONS,
} from '../../utils/captionAnimationEngine';
import {
  CAPTION_PRESET_STYLES,
  TEMPLATE_CATEGORIES,
} from '../../utils/presetStyles';
import { CaptionAnimationConfig } from '../../types/captionAnimation';

const POPULAR_FONTS = [
  'Montserrat',
  'Poppins',
  'Inter',
  'Roboto',
  'Plus Jakarta Sans',
  'Bebas Neue',
  'Anton',
  'Impact',
  'Oswald',
  'Bangers',
  'Playfair Display',
  'Cinzel',
  'Caveat',
  'Courier Prime',
  'Hind Siliguri',
  'Noto Sans Bengali',
];

type InspectorTab = 'text' | 'style' | 'transform' | 'animation' | 'templates';

export const CaptionInspector: React.FC = () => {
  const {
    project,
    selectedCaptionId,
    setSelectedCaptionId,
    updateCaptionLine,
    updateActiveStyle,
    setCaptionLineStyleOverride,
    deleteCaptionLine,
    applyPresetStyle,
    pushHistoryState,
  } = useProject() as any;

  const [activeTab, setActiveTab] = useState<InspectorTab>('text');
  const [animationCategory, setAnimationCategory] = useState<'in' | 'out' | 'loop'>('in');
  const [templateCategory, setTemplateCategory] = useState<string>('All');
  const [templateSearch, setTemplateSearch] = useState<string>('');
  const [applyToAll, setApplyToAll] = useState<boolean>(false);

  // Retrieve current selected caption(s)
  const caption = useMemo(() => {
    return project?.captions.find((c: any) => c.id === selectedCaptionId) || project?.captions[0];
  }, [project?.captions, selectedCaptionId]);

  const style = useMemo(() => {
    if (!caption) return project?.activeStyle;
    return caption.styleOverride ? { ...project.activeStyle, ...caption.styleOverride } : project.activeStyle;
  }, [project?.activeStyle, caption]);

  if (!project) {
    return <div className="p-4 text-xs text-gray-500">No project active</div>;
  }

  if (!caption || !style) {
    return (
      <div className="p-6 text-center text-gray-500 space-y-3">
        <div className="w-12 h-12 rounded-xl bg-[#18181c] border border-[#27272a] mx-auto flex items-center justify-center text-forge-purple">
          <Type className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-bold text-gray-300">No Caption Selected</p>
          <p className="text-[11px] text-gray-500 mt-1">
            Click a caption on the timeline or directly on the video canvas to edit its properties.
          </p>
        </div>
      </div>
    );
  }

  // Unified property updater: updates selected caption override or project default
  const handleUpdate = (updates: any) => {
    if (applyToAll) {
      // Apply style updates across all captions
      updateActiveStyle(updates);
      if (project.captions) {
        project.captions.forEach((cap: any) => {
          if (cap.styleOverride) {
            setCaptionLineStyleOverride(cap.id, { ...cap.styleOverride, ...updates });
          }
        });
      }
    } else if (caption) {
      setCaptionLineStyleOverride(caption.id, {
        ...(caption.styleOverride || {}),
        ...updates,
      });
    } else {
      updateActiveStyle(updates);
    }
  };

  const animConfig: CaptionAnimationConfig = style.animationConfig || {
    inPreset: style.animation === 'none' ? 'none' : 'pop-in',
    inDuration: 0.35,
    inEasing: 'back-out',
    outPreset: 'none',
    outDuration: 0.3,
    outEasing: 'ease-out',
    loopPreset: 'none',
    loopSpeed: 1.0,
    loopIntensity: 1.0,
  };

  const handleAnimationChange = (category: 'in' | 'out' | 'loop', presetId: string) => {
    const updated: CaptionAnimationConfig = { ...animConfig };
    if (category === 'in') updated.inPreset = presetId as any;
    if (category === 'out') updated.outPreset = presetId as any;
    if (category === 'loop') updated.loopPreset = presetId as any;

    handleUpdate({
      animation: updated.inPreset !== 'none' ? updated.inPreset : 'none',
      animationConfig: updated,
    });
  };

  // Filtered Templates
  const filteredTemplates = useMemo(() => {
    return CAPTION_PRESET_STYLES.filter((tmpl) => {
      const matchCat =
        templateCategory === 'All' ||
        tmpl.category?.toLowerCase() === templateCategory.toLowerCase() ||
        (templateCategory === 'VIRAL' && tmpl.category?.toUpperCase() === 'VIRAL');
      const matchSearch =
        !templateSearch ||
        tmpl.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
        tmpl.description?.toLowerCase().includes(templateSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [templateCategory, templateSearch]);

  return (
    <div className="flex flex-col h-full bg-[#121214] text-gray-200 select-none">
      {/* Top Navigation Tabs */}
      <div className="grid grid-cols-5 bg-[#18181c] border-b border-[#27272a] p-1 gap-0.5 text-[11px] font-medium flex-shrink-0">
        <button
          onClick={() => setActiveTab('text')}
          className={`flex flex-col items-center justify-center py-2 rounded-lg transition-all ${
            activeTab === 'text'
              ? 'bg-forge-purple/20 text-forge-purple font-bold border border-forge-purple/40 shadow-xs'
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#27272a]/50'
          }`}
        >
          <Type className="w-3.5 h-3.5 mb-1" />
          <span>Text</span>
        </button>

        <button
          onClick={() => setActiveTab('style')}
          className={`flex flex-col items-center justify-center py-2 rounded-lg transition-all ${
            activeTab === 'style'
              ? 'bg-forge-purple/20 text-forge-purple font-bold border border-forge-purple/40 shadow-xs'
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#27272a]/50'
          }`}
        >
          <Palette className="w-3.5 h-3.5 mb-1" />
          <span>Style</span>
        </button>

        <button
          onClick={() => setActiveTab('transform')}
          className={`flex flex-col items-center justify-center py-2 rounded-lg transition-all ${
            activeTab === 'transform'
              ? 'bg-forge-purple/20 text-forge-purple font-bold border border-forge-purple/40 shadow-xs'
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#27272a]/50'
          }`}
        >
          <Move className="w-3.5 h-3.5 mb-1" />
          <span>Transform</span>
        </button>

        <button
          onClick={() => setActiveTab('animation')}
          className={`flex flex-col items-center justify-center py-2 rounded-lg transition-all ${
            activeTab === 'animation'
              ? 'bg-forge-purple/20 text-forge-purple font-bold border border-forge-purple/40 shadow-xs'
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#27272a]/50'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 mb-1" />
          <span>Animation</span>
        </button>

        <button
          onClick={() => setActiveTab('templates')}
          className={`flex flex-col items-center justify-center py-2 rounded-lg transition-all ${
            activeTab === 'templates'
              ? 'bg-forge-purple/20 text-forge-purple font-bold border border-forge-purple/40 shadow-xs'
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#27272a]/50'
          }`}
        >
          <Bookmark className="w-3.5 h-3.5 mb-1" />
          <span>Templates</span>
        </button>
      </div>

      {/* Scope Selector: Apply to Current Caption vs Apply to All */}
      <div className="px-3 py-2 bg-[#141418] border-b border-[#27272a] flex items-center justify-between text-[11px] flex-shrink-0">
        <span className="text-gray-400 font-mono">
          Caption #{project.captions.findIndex((c: any) => c.id === caption.id) + 1} of {project.captions.length}
        </span>
        <label className="flex items-center gap-1.5 cursor-pointer text-gray-300 hover:text-white">
          <input
            type="checkbox"
            checked={applyToAll}
            onChange={(e) => setApplyToAll(e.target.checked)}
            className="w-3.5 h-3.5 rounded bg-[#27272a] border-[#3f3f46] text-forge-purple focus:ring-forge-purple"
          />
          <span className="font-semibold text-[10px] tracking-wide uppercase">Apply to all</span>
        </label>
      </div>

      {/* Main Tab Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
        {/* ========================================================================= */}
        {/* 1. TEXT TAB                                                               */}
        {/* ========================================================================= */}
        {activeTab === 'text' && (
          <div className="space-y-4 animate-fade-in">
            {/* Text Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                  Text Content
                </label>
                <span className="text-[10px] text-gray-500 font-mono">
                  {caption.text.length} chars
                </span>
              </div>
              <textarea
                value={caption.text}
                onChange={(e) => updateCaptionLine(caption.id, e.target.value)}
                rows={2}
                className="w-full p-2.5 text-xs bg-[#18181c] border border-[#27272a] rounded-lg text-white font-medium focus:outline-none focus:border-forge-purple focus:ring-1 focus:ring-forge-purple transition-all resize-none"
                placeholder="Caption text..."
              />
            </div>

            {/* Font Family */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block">
                Font Family
              </label>
              <select
                value={style.fontFamily}
                onChange={(e) => handleUpdate({ fontFamily: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs bg-[#18181c] border border-[#27272a] rounded-lg text-white focus:outline-none focus:border-forge-purple font-semibold"
              >
                {POPULAR_FONTS.map((font) => (
                  <option key={font} value={font} style={{ fontFamily: font }}>
                    {font}
                  </option>
                ))}
              </select>
            </div>

            {/* Font Size & Weight */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-gray-300 uppercase">Size</span>
                  <span className="font-mono text-forge-purple font-bold">{style.fontSize}px</span>
                </div>
                <input
                  type="range"
                  min={16}
                  max={140}
                  step={1}
                  value={style.fontSize}
                  onChange={(e) => handleUpdate({ fontSize: Number(e.target.value) })}
                  className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-forge-purple"
                />
              </div>

              <div className="space-y-1.5">
                <span className="font-bold text-gray-300 uppercase text-[11px] block">Weight</span>
                <select
                  value={String(style.fontWeight || '700')}
                  onChange={(e) => handleUpdate({ fontWeight: e.target.value })}
                  className="w-full px-2 py-1 text-xs bg-[#18181c] border border-[#27272a] rounded-lg text-white focus:outline-none focus:border-forge-purple font-medium"
                >
                  <option value="normal">Regular (400)</option>
                  <option value="600">Semi Bold (600)</option>
                  <option value="700">Bold (700)</option>
                  <option value="800">Extra Bold (800)</option>
                  <option value="900">Black (900)</option>
                </select>
              </div>
            </div>

            {/* Alignment & Text Case */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <span className="font-bold text-gray-300 uppercase text-[11px] block">Alignment</span>
                <div className="flex rounded-lg bg-[#18181c] border border-[#27272a] p-0.5">
                  {(['left', 'center', 'right'] as const).map((align) => (
                    <button
                      key={align}
                      onClick={() => handleUpdate({ alignment: align })}
                      className={`flex-1 py-1 flex items-center justify-center rounded transition-colors ${
                        style.alignment === align
                          ? 'bg-forge-purple text-white shadow-xs'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {align === 'left' && <AlignLeft className="w-3.5 h-3.5" />}
                      {align === 'center' && <AlignCenter className="w-3.5 h-3.5" />}
                      {align === 'right' && <AlignRight className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="font-bold text-gray-300 uppercase text-[11px] block">Case</span>
                <div className="flex rounded-lg bg-[#18181c] border border-[#27272a] p-0.5">
                  {(['uppercase', 'titlecase', 'preserve'] as const).map((casing) => (
                    <button
                      key={casing}
                      onClick={() => handleUpdate({ casing })}
                      className={`flex-1 py-1 text-[10px] font-bold rounded transition-colors ${
                        style.casing === casing
                          ? 'bg-forge-purple text-white shadow-xs'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {casing === 'uppercase' ? 'AA' : casing === 'titlecase' ? 'Aa' : 'as-is'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Letter Spacing & Line Height */}
            <div className="space-y-3 pt-2 border-t border-[#27272a]">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-gray-300 uppercase">Letter Spacing</span>
                  <span className="font-mono text-gray-400">{style.letterSpacing || 0}px</span>
                </div>
                <input
                  type="range"
                  min={-2}
                  max={20}
                  step={0.5}
                  value={style.letterSpacing || 0}
                  onChange={(e) => handleUpdate({ letterSpacing: Number(e.target.value) })}
                  className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-forge-purple"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-gray-300 uppercase">Line Height</span>
                  <span className="font-mono text-gray-400">{(style.lineHeight || 1.2).toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.8}
                  max={2.2}
                  step={0.05}
                  value={style.lineHeight || 1.2}
                  onChange={(e) => handleUpdate({ lineHeight: Number(e.target.value) })}
                  className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-forge-purple"
                />
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. STYLE TAB                                                              */}
        {/* ========================================================================= */}
        {activeTab === 'style' && (
          <div className="space-y-4 animate-fade-in">
            {/* Fill Colors */}
            <div className="p-3 rounded-xl bg-[#18181c] border border-[#27272a] space-y-3">
              <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block">
                Fill & Karaoke Colors
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] text-gray-400 block">Base Text Color</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={style.textColor || '#FFFFFF'}
                      onChange={(e) => handleUpdate({ textColor: e.target.value })}
                      className="w-7 h-7 rounded border border-[#3f3f46] cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={style.textColor || '#FFFFFF'}
                      onChange={(e) => handleUpdate({ textColor: e.target.value })}
                      className="w-full px-2 py-1 text-xs bg-[#27272a] rounded border border-[#3f3f46] text-white font-mono uppercase"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-gray-400 block">Spoken Word Highlight</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={style.activeWordColor || '#FFCC00'}
                      onChange={(e) => handleUpdate({ activeWordColor: e.target.value })}
                      className="w-7 h-7 rounded border border-[#3f3f46] cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={style.activeWordColor || '#FFCC00'}
                      onChange={(e) => handleUpdate({ activeWordColor: e.target.value })}
                      className="w-full px-2 py-1 text-xs bg-[#27272a] rounded border border-[#3f3f46] text-white font-mono uppercase"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Stroke / Outline */}
            <div className="p-3 rounded-xl bg-[#18181c] border border-[#27272a] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                  Stroke / Outline
                </span>
                <span className="font-mono text-forge-purple text-[11px] font-bold">
                  {style.strokeWidth || 0}px
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={style.strokeColor || '#000000'}
                  onChange={(e) => handleUpdate({ strokeColor: e.target.value })}
                  className="w-7 h-7 rounded border border-[#3f3f46] cursor-pointer bg-transparent"
                />
                <input
                  type="range"
                  min={0}
                  max={24}
                  step={1}
                  value={style.strokeWidth || 0}
                  onChange={(e) => handleUpdate({ strokeWidth: Number(e.target.value) })}
                  className="flex-1 h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-forge-purple"
                />
              </div>
            </div>

            {/* Drop Shadow */}
            <div className="p-3 rounded-xl bg-[#18181c] border border-[#27272a] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                  Drop Shadow
                </span>
                <input
                  type="checkbox"
                  checked={!!style.hasShadow}
                  onChange={(e) => handleUpdate({ hasShadow: e.target.checked })}
                  className="w-3.5 h-3.5 rounded bg-[#27272a] border-[#3f3f46] text-forge-purple focus:ring-forge-purple"
                />
              </div>

              {style.hasShadow && (
                <div className="space-y-2 pt-1 border-t border-[#27272a]">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">Shadow Blur</span>
                    <span className="font-mono text-gray-400">{style.shadowBlur || 0}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    step={1}
                    value={style.shadowBlur || 0}
                    onChange={(e) => handleUpdate({ shadowBlur: Number(e.target.value) })}
                    className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-forge-purple"
                  />

                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-gray-400">Offset Y</span>
                    <span className="font-mono text-gray-400">{style.shadowOffsetY || 0}px</span>
                  </div>
                  <input
                    type="range"
                    min={-20}
                    max={20}
                    step={1}
                    value={style.shadowOffsetY || 0}
                    onChange={(e) => handleUpdate({ shadowOffsetY: Number(e.target.value) })}
                    className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-forge-purple"
                  />
                </div>
              )}
            </div>

            {/* Background Pill / Box */}
            <div className="p-3 rounded-xl bg-[#18181c] border border-[#27272a] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                  Background Box
                </span>
                <input
                  type="checkbox"
                  checked={!!style.hasBackgroundPill}
                  onChange={(e) => handleUpdate({ hasBackgroundPill: e.target.checked })}
                  className="w-3.5 h-3.5 rounded bg-[#27272a] border-[#3f3f46] text-forge-purple focus:ring-forge-purple"
                />
              </div>

              {style.hasBackgroundPill && (
                <div className="space-y-2 pt-1 border-t border-[#27272a]">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">Opacity</span>
                    <span className="font-mono text-gray-400">
                      {Math.round((style.backgroundOpacity ?? 0.85) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1.0}
                    step={0.05}
                    value={style.backgroundOpacity ?? 0.85}
                    onChange={(e) => handleUpdate({ backgroundOpacity: Number(e.target.value) })}
                    className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-forge-purple"
                  />

                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-gray-400">Corner Radius</span>
                    <span className="font-mono text-gray-400">{style.backgroundBorderRadius || 0}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    step={1}
                    value={style.backgroundBorderRadius || 0}
                    onChange={(e) => handleUpdate({ backgroundBorderRadius: Number(e.target.value) })}
                    className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-forge-purple"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. TRANSFORM TAB                                                          */}
        {/* ========================================================================= */}
        {activeTab === 'transform' && (
          <div className="space-y-4 animate-fade-in">
            {/* Position Preset Buttons */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block">
                Position Presets
              </span>
              <div className="grid grid-cols-5 gap-1">
                {[
                  { label: 'Top', y: 15 },
                  { label: 'Upper', y: 30 },
                  { label: 'Center', y: 50 },
                  { label: 'Lower', y: 72 },
                  { label: 'Bottom', y: 88 },
                ].map((pos) => (
                  <button
                    key={pos.label}
                    onClick={() => handleUpdate({ xOffsetPercent: 50, yOffsetPercent: pos.y })}
                    className="py-1.5 rounded-lg bg-[#18181c] border border-[#27272a] text-[11px] font-medium text-gray-300 hover:text-white hover:border-forge-purple/50 transition-colors"
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Position X & Y Sliders */}
            <div className="p-3 rounded-xl bg-[#18181c] border border-[#27272a] space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-gray-300 uppercase">Position X</span>
                  <span className="font-mono text-forge-purple font-bold">
                    {Math.round(style.xOffsetPercent ?? 50)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={style.xOffsetPercent ?? 50}
                  onChange={(e) => handleUpdate({ xOffsetPercent: Number(e.target.value) })}
                  className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-forge-purple"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-gray-300 uppercase">Position Y</span>
                  <span className="font-mono text-forge-purple font-bold">
                    {Math.round(style.yOffsetPercent ?? 75)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={95}
                  step={1}
                  value={style.yOffsetPercent ?? 75}
                  onChange={(e) => handleUpdate({ yOffsetPercent: Number(e.target.value) })}
                  className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-forge-purple"
                />
              </div>
            </div>

            {/* Scale & Rotation */}
            <div className="p-3 rounded-xl bg-[#18181c] border border-[#27272a] space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-gray-300 uppercase">Scale</span>
                  <span className="font-mono text-gray-400">{(style.scale ?? 1.0).toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min={0.4}
                  max={2.5}
                  step={0.05}
                  value={style.scale ?? 1.0}
                  onChange={(e) => handleUpdate({ scale: Number(e.target.value) })}
                  className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-forge-purple"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-gray-300 uppercase">Rotation</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-gray-400">{Math.round(style.rotation ?? 0)}°</span>
                    <button
                      onClick={() => handleUpdate({ rotation: 0 })}
                      className="text-[10px] text-forge-purple hover:underline"
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={style.rotation ?? 0}
                  onChange={(e) => handleUpdate({ rotation: Number(e.target.value) })}
                  className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-forge-purple"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-gray-300 uppercase">Max Width</span>
                  <span className="font-mono text-gray-400">{Math.round(style.maxWidthPercent ?? 88)}%</span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={100}
                  step={2}
                  value={style.maxWidthPercent ?? 88}
                  onChange={(e) => handleUpdate({ maxWidthPercent: Number(e.target.value) })}
                  className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-forge-purple"
                />
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. ANIMATION TAB                                                          */}
        {/* ========================================================================= */}
        {activeTab === 'animation' && (
          <div className="space-y-4 animate-fade-in">
            {/* IN / OUT / LOOP Switcher */}
            <div className="grid grid-cols-3 bg-[#18181c] border border-[#27272a] p-1 rounded-xl text-xs font-bold">
              {(['in', 'out', 'loop'] as const).map((cat) => {
                const active = animationCategory === cat;
                const currentPreset =
                  cat === 'in'
                    ? animConfig.inPreset
                    : cat === 'out'
                    ? animConfig.outPreset
                    : animConfig.loopPreset;
                return (
                  <button
                    key={cat}
                    onClick={() => setAnimationCategory(cat)}
                    className={`py-1.5 rounded-lg transition-all capitalize flex flex-col items-center justify-center ${
                      active
                        ? 'bg-forge-purple text-white shadow-md'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <span>{cat.toUpperCase()}</span>
                    {currentPreset && currentPreset !== 'none' && (
                      <span className="text-[9px] font-normal text-purple-200 truncate max-w-[90%]">
                        {currentPreset}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Animation Presets Grid */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block">
                {animationCategory === 'in'
                  ? 'Entry Animation'
                  : animationCategory === 'out'
                  ? 'Exit Animation'
                  : 'Continuous Loop Motion'}
              </span>

              <div className="grid grid-cols-2 gap-2">
                {(animationCategory === 'in'
                  ? IN_ANIMATIONS
                  : animationCategory === 'out'
                  ? OUT_ANIMATIONS
                  : LOOP_ANIMATIONS
                ).map((anim) => {
                  const isSelected =
                    animationCategory === 'in'
                      ? animConfig.inPreset === anim.id
                      : animationCategory === 'out'
                      ? animConfig.outPreset === anim.id
                      : animConfig.loopPreset === anim.id;

                  return (
                    <button
                      key={anim.id}
                      onClick={() => handleAnimationChange(animationCategory, anim.id)}
                      className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                        isSelected
                          ? 'bg-forge-purple/20 border-forge-purple text-white shadow-md ring-1 ring-forge-purple'
                          : 'bg-[#18181c] border-[#27272a] text-gray-300 hover:border-gray-600 hover:bg-[#202024]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs">{anim.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-forge-purple" />}
                      </div>
                      <p className="text-[10px] text-gray-400 line-clamp-2 leading-tight">
                        {anim.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Animation Parameter Controls */}
            {((animationCategory === 'in' && animConfig.inPreset !== 'none') ||
              (animationCategory === 'out' && animConfig.outPreset !== 'none') ||
              (animationCategory === 'loop' && animConfig.loopPreset !== 'none')) && (
              <div className="p-3 rounded-xl bg-[#18181c] border border-[#27272a] space-y-3 pt-2">
                <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block">
                  Fine-Tune Animation
                </span>

                {animationCategory === 'in' && (
                  <>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-400">Duration</span>
                        <span className="font-mono text-forge-purple font-bold">
                          {(animConfig.inDuration || 0.35).toFixed(2)}s
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.1}
                        max={1.5}
                        step={0.05}
                        value={animConfig.inDuration || 0.35}
                        onChange={(e) =>
                          handleUpdate({
                            animationConfig: {
                              ...animConfig,
                              inDuration: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-forge-purple"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-gray-400 text-[11px] block">Easing</span>
                      <select
                        value={animConfig.inEasing || 'back-out'}
                        onChange={(e) =>
                          handleUpdate({
                            animationConfig: {
                              ...animConfig,
                              inEasing: e.target.value as any,
                            },
                          })
                        }
                        className="w-full px-2 py-1 text-xs bg-[#27272a] border border-[#3f3f46] rounded text-white"
                      >
                        <option value="back-out">Back Out (Punchy Bounce)</option>
                        <option value="ease-out">Ease Out (Smooth)</option>
                        <option value="ease-in-out">Ease In-Out</option>
                        <option value="bounce">Bounce</option>
                        <option value="elastic-out">Elastic Spring</option>
                        <option value="linear">Linear</option>
                      </select>
                    </div>
                  </>
                )}

                {animationCategory === 'out' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-400">Exit Duration</span>
                      <span className="font-mono text-forge-purple font-bold">
                        {(animConfig.outDuration || 0.3).toFixed(2)}s
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={1.2}
                      step={0.05}
                      value={animConfig.outDuration || 0.3}
                      onChange={(e) =>
                        handleUpdate({
                          animationConfig: {
                            ...animConfig,
                            outDuration: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-forge-purple"
                    />
                  </div>
                )}

                {animationCategory === 'loop' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-400">Loop Speed</span>
                      <span className="font-mono text-forge-purple font-bold">
                        {(animConfig.loopSpeed || 1.0).toFixed(1)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={3.0}
                      step={0.1}
                      value={animConfig.loopSpeed || 1.0}
                      onChange={(e) =>
                        handleUpdate({
                          animationConfig: {
                            ...animConfig,
                            loopSpeed: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-forge-purple"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 5. TEMPLATES TAB                                                          */}
        {/* ========================================================================= */}
        {activeTab === 'templates' && (
          <div className="space-y-3 animate-fade-in">
            {/* Search Input */}
            <input
              type="text"
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
              placeholder="Search templates (e.g. Hormozi, Neon)..."
              className="w-full px-2.5 py-1.5 text-xs bg-[#18181c] border border-[#27272a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-forge-purple"
            />

            {/* Category Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
              {['All', 'VIRAL', 'ANIMATED', 'HIGHLIGHT', 'CLASSIC', 'CREATIVE'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setTemplateCategory(cat)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-colors ${
                    templateCategory === cat
                      ? 'bg-forge-purple text-white'
                      : 'bg-[#18181c] border border-[#27272a] text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Templates List */}
            <div className="space-y-2">
              {filteredTemplates.slice(0, 40).map((tmpl) => {
                const isCurrent = style.presetKey === tmpl.presetKey || style.name === tmpl.name;
                return (
                  <button
                    key={tmpl.id || tmpl.presetKey}
                    onClick={() => applyPresetStyle(tmpl)}
                    className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                      isCurrent
                        ? 'bg-forge-purple/20 border-forge-purple shadow-md ring-1 ring-forge-purple'
                        : 'bg-[#18181c] border-[#27272a] hover:border-gray-600 hover:bg-[#202024]'
                    }`}
                  >
                    <div className="space-y-0.5 max-w-[80%]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-white">{tmpl.name}</span>
                        {tmpl.category && (
                          <span className="px-1.5 py-0.2 rounded bg-[#27272a] text-[9px] font-mono text-gray-400">
                            {tmpl.category}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 truncate">{tmpl.description}</p>
                    </div>

                    {isCurrent ? (
                      <Check className="w-4 h-4 text-forge-purple" />
                    ) : (
                      <span className="text-[10px] text-forge-purple font-semibold">Apply</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions: Delete & Duplicate */}
      <div className="p-3 bg-[#18181c] border-t border-[#27272a] flex items-center justify-between flex-shrink-0">
        <button
          onClick={() => {
            if (caption) deleteCaptionLine(caption.id);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/40 border border-red-800/60 text-red-400 hover:bg-red-900/60 text-xs font-semibold transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Caption</span>
        </button>

        <button
          onClick={() => {
            if (caption) {
              const newStart = caption.end + 0.1;
              const newEnd = newStart + Math.max(1.0, caption.end - caption.start);
              const newCap = {
                ...caption,
                id: `cap_${Date.now()}`,
                start: newStart,
                end: newEnd,
              };
              if (project.captions) {
                const updated = [...project.captions, newCap].sort((a, b) => a.start - b.start);
                (project as any).captions = updated;
                setSelectedCaptionId(newCap.id);
              }
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#27272a] border border-[#3f3f46] text-gray-200 hover:text-white text-xs font-semibold transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Duplicate</span>
        </button>
      </div>
    </div>
  );
};
