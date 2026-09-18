import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Slider } from '../common/Slider';
import { CaptionAnimationType, CaptionPosition, TextAlignment, TextCasing, CaptionStyleConfig } from '../../types/caption';
import {
  Sliders,
  Type,
  Palette,
  Sparkles,
  Move,
  Activity,
  Layers,
  Box,
  Sun,
  Eye,
  BookmarkPlus,
  Save,
  CheckCircle2,
} from 'lucide-react';

const FONT_OPTIONS = [
  'Montserrat',
  'Poppins',
  'Inter',
  'Roboto',
  'Hind Siliguri',
  'Noto Sans Bengali',
  'Plus Jakarta Sans',
  'Playfair Display',
  'Cinzel',
  'Courier Prime',
  'Bebas Neue',
  'Impact',
  'Anton',
  'Oswald',
  'Bangers',
  'Rubik Glitch',
  'Righteous',
  'Caveat',
];

const ANIMATION_OPTIONS: { label: string; value: CaptionAnimationType }[] = [
  { label: 'MrBeast Pop (Viral Heavy)', value: 'mrbeast' },
  { label: 'Hormozi Snap (Contrast Box)', value: 'hormozi' },
  { label: 'Bold Pop (Cyan Punch)', value: 'bold-pop' },
  { label: 'Punch Caption (Explosion)', value: 'punch' },
  { label: 'Color Emphasis (Palette Flow)', value: 'color-emphasis' },
  { label: 'Word Pop (Spring Overshoot)', value: 'word-pop' },
  { label: 'Bounce (Vertical Arc)', value: 'bounce' },
  { label: 'Slide Up (Smooth Entry)', value: 'slide-up' },
  { label: 'Slide In (Kinetic Left)', value: 'slide-in' },
  { label: 'Dynamic Scale (Wave Pulse)', value: 'dynamic-scale' },
  { label: 'Shake / Jitter (Energetic)', value: 'shake' },
  { label: 'Pop + Motion Blur (Velocity)', value: 'pop-blur' },
  { label: 'Karaoke (Lead Vocal Highlight)', value: 'karaoke' },
  { label: 'Word Highlight (Accent Glow)', value: 'word-highlight' },
  { label: 'Highlight Box (Marker Underlay)', value: 'highlight-box' },
  { label: 'Active Word Color (Clean Hue)', value: 'active-color' },
  { label: 'Cinematic Minimal (Subtle)', value: 'cinematic' },
  { label: 'Clean Subtitle (Accessible)', value: 'clean-sub' },
  { label: 'Typewriter (Character Type)', value: 'typewriter' },
  { label: 'Uppercase Punch (Impact)', value: 'uppercase-punch' },
  { label: '3D Caption (Depth Extrusion)', value: '3d' },
  { label: 'Neon Caption (Cyber Bloom)', value: 'neon' },
  { label: 'Glitch Caption (RGB Aberration)', value: 'glitch' },
  { label: 'Dynamic Multi-Line (Smart Wrap)', value: 'multiline' },
  { label: 'None (Static Subtitle)', value: 'none' },
];

const POSITION_PRESETS: { label: string; pos: CaptionPosition; y: number }[] = [
  { label: 'Top', pos: 'top', y: 16 },
  { label: 'Center', pos: 'middle', y: 50 },
  { label: 'Lower Center', pos: 'bottom', y: 74 },
  { label: 'Lower Third', pos: 'lower-third', y: 82 },
  { label: 'Bottom Edge', pos: 'bottom', y: 88 },
];

export const StyleCustomizer: React.FC = () => {
  const {
    project,
    updateActiveStyle,
    setCaptionLineStyleOverride,
    selectedCaptionId,
  } = useProject();

  const [activeTab, setActiveTab] = useState<'typo' | 'colors' | 'effects' | 'motion' | 'layout'>('typo');
  const [customizerScope, setCustomizerScope] = useState<'selected' | 'all'>('selected');
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const selectedCaption = project?.captions.find((c) => c.id === selectedCaptionId);
  const selectedCaptionIndex = project?.captions.findIndex((c) => c.id === selectedCaptionId);
  const hasSelectedCaption = selectedCaptionId && selectedCaptionIndex !== undefined && selectedCaptionIndex >= 0;

  const activeEffectiveStyle =
    hasSelectedCaption && customizerScope === 'selected' && selectedCaption?.styleOverride
      ? { ...project!.activeStyle, ...selectedCaption.styleOverride }
      : project?.activeStyle;

  if (!activeEffectiveStyle || !project) return null;
  const style = activeEffectiveStyle;

  const handleUpdate = (updates: Partial<CaptionStyleConfig>) => {
    if (hasSelectedCaption && customizerScope === 'selected' && selectedCaptionId) {
      const currentOverride = selectedCaption?.styleOverride || {};
      setCaptionLineStyleOverride(selectedCaptionId, { ...currentOverride, ...updates });
    } else {
      updateActiveStyle(updates);
    }
  };

  const handleSaveAsTemplate = () => {
    const baseName = style.name || 'Custom Style';
    const suggested = `${baseName} Custom`;
    const name = window.prompt('Save as My Template — enter a name:', suggested);
    if (!name || !name.trim()) return;
    const trimmed = name.trim().slice(0, 40);
    const newTemplate: CaptionStyleConfig = {
      ...style,
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      presetKey: `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      category: (style.category as any) || 'Minimal',
      description: `Custom template based on ${style.name}`,
    };
    try {
      const raw = localStorage.getItem('cf_custom_templates');
      const existing: CaptionStyleConfig[] = raw ? JSON.parse(raw) : [];
      const next = [newTemplate, ...existing].slice(0, 50);
      localStorage.setItem('cf_custom_templates', JSON.stringify(next));
      window.dispatchEvent(new Event('cf_custom_templates_updated'));
      setSaveToast(`Saved "${trimmed}" to My Templates`);
      setTimeout(() => setSaveToast(null), 2400);
    } catch {
      setSaveToast('Failed to save — storage full');
      setTimeout(() => setSaveToast(null), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-canvas-surface text-gray-200 select-none overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-canvas-border space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-forge-purple" />
            <span>Caption Inspector</span>
          </h3>
          <span className="text-[11px] text-forge-cyan font-mono bg-canvas-card px-2 py-0.5 rounded border border-canvas-border truncate max-w-[140px]">
            {style.name}
          </span>
        </div>

        {/* Multi-Style Scope Switcher */}
        {project.captions.length > 0 && (
          <div className="p-1.5 rounded-lg bg-canvas-card border border-canvas-border flex items-center justify-between gap-1 text-[10px]">
            <span className="text-gray-400 font-semibold truncate">Target:</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCustomizerScope('selected')}
                className={`px-2 py-0.5 rounded font-bold transition-all ${
                  customizerScope === 'selected'
                    ? 'bg-forge-cyan text-black shadow-sm font-black'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                title="Edit styling for ONLY the currently selected caption"
              >
                Selected #{hasSelectedCaption ? selectedCaptionIndex! + 1 : '1'}
              </button>
              <button
                type="button"
                onClick={() => setCustomizerScope('all')}
                className={`px-2 py-0.5 rounded font-bold transition-all ${
                  customizerScope === 'all'
                    ? 'bg-forge-purple text-white shadow-sm font-black'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                title="Edit global styling for ALL captions"
              >
                All Captions ({project.captions.length})
              </button>
            </div>
          </div>
        )}

        {/* Tab Switcher Pills */}
        <div className="grid grid-cols-5 gap-1 bg-canvas-card p-1 rounded-lg border border-canvas-border text-[10px] font-bold">
          <button
            onClick={() => setActiveTab('typo')}
            className={`py-1 rounded text-center transition-all ${
              activeTab === 'typo' ? 'bg-forge-purple text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Font
          </button>
          <button
            onClick={() => setActiveTab('colors')}
            className={`py-1 rounded text-center transition-all ${
              activeTab === 'colors' ? 'bg-forge-purple text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Color
          </button>
          <button
            onClick={() => setActiveTab('effects')}
            className={`py-1 rounded text-center transition-all ${
              activeTab === 'effects' ? 'bg-forge-purple text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            FX & Box
          </button>
          <button
            onClick={() => setActiveTab('motion')}
            className={`py-1 rounded text-center transition-all ${
              activeTab === 'motion' ? 'bg-forge-purple text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Motion
          </button>
          <button
            onClick={() => setActiveTab('layout')}
            className={`py-1 rounded text-center transition-all ${
              activeTab === 'layout' ? 'bg-forge-purple text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Position
          </button>
        </div>
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* 1. TYPOGRAPHY TAB */}
        {activeTab === 'typo' && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Font Family</label>
              <select
                value={style.fontFamily}
                onChange={(e) => handleUpdate({ fontFamily: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-canvas-card border border-canvas-border rounded-lg text-gray-200 focus:outline-none focus:border-forge-purple font-semibold"
              >
                {FONT_OPTIONS.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Font Weight</label>
                <select
                  value={style.fontWeight}
                  onChange={(e) => handleUpdate({ fontWeight: e.target.value as any })}
                  className="w-full px-3 py-1.5 text-xs bg-canvas-card border border-canvas-border rounded-lg text-gray-200 focus:outline-none focus:border-forge-purple"
                >
                  <option value="normal">Normal (400)</option>
                  <option value="600">Semi Bold (600)</option>
                  <option value="bold">Bold (700)</option>
                  <option value="800">Extra Bold (800)</option>
                  <option value="900">Black / Ultra (900)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Text Casing</label>
                <select
                  value={style.casing}
                  onChange={(e) => handleUpdate({ casing: e.target.value as TextCasing })}
                  className="w-full px-3 py-1.5 text-xs bg-canvas-card border border-canvas-border rounded-lg text-gray-200 focus:outline-none focus:border-forge-purple uppercase"
                >
                  <option value="uppercase">ALL CAPS</option>
                  <option value="titlecase">Title Case</option>
                  <option value="lowercase">lowercase</option>
                  <option value="preserve">Preserve Case</option>
                </select>
              </div>
            </div>

            {/* Line Structure / Display Mode (Single Line vs Two Lines vs Auto) */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">Line Structure</label>
              <div className="grid grid-cols-3 gap-1 bg-canvas-card p-1 rounded-lg border border-canvas-border">
                <button
                  onClick={() => handleUpdate({ lineMode: 'single' })}
                  className={`py-1.5 rounded text-[11px] font-bold transition-all ${
                    style.lineMode === 'single'
                      ? 'bg-forge-purple text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Force all words onto 1 single line"
                >
                  1 Line
                </button>
                <button
                  onClick={() => handleUpdate({ lineMode: 'two-line' })}
                  className={`py-1.5 rounded text-[11px] font-bold transition-all ${
                    style.lineMode === 'two-line'
                      ? 'bg-forge-purple text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Balance words cleanly into exactly 2 stacked lines"
                >
                  2 Lines
                </button>
                <button
                  onClick={() => handleUpdate({ lineMode: 'auto' })}
                  className={`py-1.5 rounded text-[11px] font-bold transition-all ${
                    !style.lineMode || style.lineMode === 'auto'
                      ? 'bg-forge-purple text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Automatically wrap based on max words & canvas width"
                >
                  Auto Wrap
                </button>
              </div>
            </div>

            <Slider
              label="Caption Screen Size (Font Size)"
              value={style.fontSize}
              min={16}
              max={140}
              step={2}
              unit="px"
              onChange={(val) => handleUpdate({ fontSize: val })}
            />

            <Slider
              label="Letter Spacing"
              value={style.letterSpacing}
              min={-2}
              max={12}
              step={0.5}
              unit="px"
              onChange={(val) => handleUpdate({ letterSpacing: val })}
            />

            <Slider
              label="Line Height Spacing"
              value={style.lineHeight || 1.2}
              min={0.8}
              max={2.5}
              step={0.05}
              unit="x"
              onChange={(val) => handleUpdate({ lineHeight: val })}
            />
          </div>
        )}

        {/* 2. COLORS & STROKE TAB */}
        {activeTab === 'colors' && (
          <div className="space-y-4 animate-fade-in">
            {/* Main Text Color */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-canvas-card border border-canvas-border">
              <div>
                <span className="text-xs font-bold text-gray-200 block">Base Text Color</span>
                <span className="text-[10px] text-gray-400">Color for regular spoken words</span>
              </div>
              <input
                type="color"
                value={style.textColor || '#FFFFFF'}
                onChange={(e) => handleUpdate({ textColor: e.target.value })}
                className="w-8 h-8 rounded border border-canvas-border cursor-pointer bg-transparent"
              />
            </div>

            {/* Active Word Accent Color */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-canvas-card border border-canvas-border">
              <div>
                <span className="text-xs font-bold text-forge-amber block">Active Spoken Word Color</span>
                <span className="text-[10px] text-gray-400">Highlight color when word is spoken</span>
              </div>
              <input
                type="color"
                value={style.activeWordColor || '#FACC15'}
                onChange={(e) => handleUpdate({ activeWordColor: e.target.value })}
                className="w-8 h-8 rounded border border-canvas-border cursor-pointer bg-transparent"
              />
            </div>

            {/* Secondary Color */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-canvas-card border border-canvas-border">
              <div>
                <span className="text-xs font-bold text-forge-cyan block">Secondary / Accent Color</span>
                <span className="text-[10px] text-gray-400">Dual-tier hooks & gradient shadows</span>
              </div>
              <input
                type="color"
                value={style.secondaryColor || '#38BDF8'}
                onChange={(e) => handleUpdate({ secondaryColor: e.target.value })}
                className="w-8 h-8 rounded border border-canvas-border cursor-pointer bg-transparent"
              />
            </div>

            {/* Stroke Outline */}
            <div className="space-y-3 pt-2 border-t border-canvas-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-300">Stroke Outline Color</span>
                <input
                  type="color"
                  value={style.strokeColor || '#000000'}
                  onChange={(e) => handleUpdate({ strokeColor: e.target.value })}
                  className="w-7 h-7 rounded border border-canvas-border cursor-pointer bg-transparent"
                />
              </div>

              <Slider
                label="Outline Thickness"
                value={style.strokeWidth}
                min={0}
                max={20}
                step={1}
                unit="px"
                onChange={(val) => handleUpdate({ strokeWidth: val })}
              />
            </div>
          </div>
        )}

        {/* 3. EFFECTS & BACKGROUND BOX TAB */}
        {activeTab === 'effects' && (
          <div className="space-y-4 animate-fade-in">
            {/* Shadow Controls */}
            <div className="p-3 rounded-xl bg-canvas-card border border-canvas-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-forge-amber" />
                  <span>Drop Shadow & Glow</span>
                </span>
                <button
                  onClick={() => handleUpdate({ hasShadow: !style.hasShadow })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                    style.hasShadow ? 'bg-forge-purple text-white border-forge-purple' : 'bg-canvas-dark text-gray-400 border-canvas-border'
                  }`}
                >
                  {style.hasShadow ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              {style.hasShadow && (
                <>
                  <Slider
                    label="Shadow Blur Radius"
                    value={style.shadowBlur}
                    min={0}
                    max={40}
                    step={2}
                    unit="px"
                    onChange={(val) => handleUpdate({ shadowBlur: val })}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <Slider
                      label="Shadow Offset X"
                      value={style.shadowOffsetX}
                      min={-20}
                      max={20}
                      step={1}
                      unit="px"
                      onChange={(val) => handleUpdate({ shadowOffsetX: val })}
                    />
                    <Slider
                      label="Shadow Offset Y"
                      value={style.shadowOffsetY}
                      min={-20}
                      max={20}
                      step={1}
                      unit="px"
                      onChange={(val) => handleUpdate({ shadowOffsetY: val })}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Background Pill Box */}
            <div className="p-3 rounded-xl bg-canvas-card border border-canvas-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Box className="w-3.5 h-3.5 text-forge-cyan" />
                  <span>Sentence Background Pill</span>
                </span>
                <button
                  onClick={() => handleUpdate({ hasBackgroundPill: !style.hasBackgroundPill })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                    style.hasBackgroundPill ? 'bg-forge-cyan text-black border-forge-cyan' : 'bg-canvas-dark text-gray-400 border-canvas-border'
                  }`}
                >
                  {style.hasBackgroundPill ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              {style.hasBackgroundPill && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Background Color</span>
                    <input
                      type="color"
                      value={style.backgroundColor || '#000000'}
                      onChange={(e) => handleUpdate({ backgroundColor: e.target.value })}
                      className="w-7 h-7 rounded border border-canvas-border cursor-pointer bg-transparent"
                    />
                  </div>

                  <Slider
                    label="Background Opacity"
                    value={Math.round((style.backgroundOpacity || 0.8) * 100)}
                    min={10}
                    max={100}
                    step={5}
                    unit="%"
                    onChange={(val) => handleUpdate({ backgroundOpacity: val / 100 })}
                  />

                  <Slider
                    label="Corner Radius"
                    value={style.backgroundBorderRadius || 8}
                    min={0}
                    max={30}
                    step={2}
                    unit="px"
                    onChange={(val) => handleUpdate({ backgroundBorderRadius: val })}
                  />
                </>
              )}
            </div>

            {/* Active Word Highlight Marker Box */}
            <div className="p-3 rounded-xl bg-canvas-card border border-canvas-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-lime-400" />
                  <span>Active Word Marker Box</span>
                </span>
                <button
                  onClick={() => handleUpdate({ hasHighlightBox: !style.hasHighlightBox })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                    style.hasHighlightBox ? 'bg-lime-400 text-black border-lime-400' : 'bg-canvas-dark text-gray-400 border-canvas-border'
                  }`}
                >
                  {style.hasHighlightBox ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              {style.hasHighlightBox && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Marker Box Color</span>
                  <input
                    type="color"
                    value={style.highlightBoxColor || '#FACC15'}
                    onChange={(e) => handleUpdate({ highlightBoxColor: e.target.value })}
                    className="w-7 h-7 rounded border border-canvas-border cursor-pointer bg-transparent"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. MOTION & TIMING TAB */}
        {activeTab === 'motion' && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Preset Animation Engine</label>
              <select
                value={style.animation}
                onChange={(e) => handleUpdate({ animation: e.target.value as CaptionAnimationType })}
                className="w-full px-3 py-2 text-xs bg-canvas-card border border-canvas-border rounded-lg text-gray-200 focus:outline-none focus:border-forge-purple font-semibold"
              >
                {ANIMATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <Slider
              label="Active Word Scale Multiplier"
              value={Math.round((style.highlightScale || 1.25) * 100)}
              min={100}
              max={200}
              step={5}
              unit="%"
              onChange={(val) => handleUpdate({ highlightScale: val / 100 })}
            />

            <Slider
              label="Animation Motion Intensity"
              value={style.animationIntensity || 4}
              min={1}
              max={5}
              step={0.5}
              unit="lvl"
              onChange={(val) => handleUpdate({ animationIntensity: val })}
            />

            {style.animation === 'typewriter' && (
              <div className="p-3 rounded-xl bg-canvas-card border border-canvas-border space-y-2">
                <span className="text-xs font-bold text-forge-cyan block">Typewriter Options</span>
                <div className="flex items-center justify-between text-xs text-gray-300">
                  <span>Show Blinking Cursor (▌)</span>
                  <input
                    type="checkbox"
                    checked={style.typewriterShowCursor !== false}
                    onChange={(e) => handleUpdate({ typewriterShowCursor: e.target.checked })}
                    className="accent-forge-purple w-4 h-4 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. POSITION & LAYOUT TAB */}
        {activeTab === 'layout' && (
          <div className="space-y-4 animate-fade-in">
            {/* Quick Position Presets */}
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Quick Placement Presets</label>
              <div className="grid grid-cols-3 gap-1.5">
                {POSITION_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => handleUpdate({ position: p.pos, yOffsetPercent: p.y })}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-all ${
                      style.yOffsetPercent === p.y
                        ? 'bg-forge-purple border-forge-purple text-white shadow-sm'
                        : 'bg-canvas-card border-canvas-border text-gray-400 hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Position Sliders */}
            <Slider
              label="Vertical Position (Y Offset)"
              value={style.yOffsetPercent}
              min={5}
              max={95}
              step={1}
              unit="%"
              onChange={(val) => handleUpdate({ yOffsetPercent: val })}
            />

            <Slider
              label="Horizontal Position (X Offset)"
              value={style.xOffsetPercent ?? 50}
              min={10}
              max={90}
              step={1}
              unit="%"
              onChange={(val) => handleUpdate({ xOffsetPercent: val })}
            />

            {/* Text Alignment & Words Per Line */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-canvas-border">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Text Alignment</label>
                <div className="grid grid-cols-3 gap-1 bg-canvas-card p-1 rounded-lg border border-canvas-border">
                  {(['left', 'center', 'right'] as TextAlignment[]).map((align) => (
                    <button
                      key={align}
                      onClick={() => handleUpdate({ alignment: align })}
                      className={`py-1 rounded text-[10px] font-bold uppercase transition-all ${
                        style.alignment === align ? 'bg-forge-purple text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {align}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Max Words / Line</label>
                <select
                  value={style.maxWordsPerLine || 4}
                  onChange={(e) => handleUpdate({ maxWordsPerLine: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-1.5 text-xs bg-canvas-card border border-canvas-border rounded-lg text-gray-200 focus:outline-none focus:border-forge-purple"
                >
                  <option value={1}>1 Word (Fast Shorts)</option>
                  <option value={2}>2 Words</option>
                  <option value={3}>3 Words (Hormozi)</option>
                  <option value={4}>4 Words (Standard)</option>
                  <option value={5}>5 Words</option>
                  <option value={6}>6 Words (Cinematic)</option>
                  <option value={8}>8 Words (Subtitles)</option>
                  <option value={10}>10 Words (Extended)</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer — Save Custom Template & Safe Area Hint */}
      <div className="p-3 border-t border-canvas-border bg-canvas-card/50 space-y-2 flex-shrink-0">
        {saveToast && (
          <div className="flex items-center gap-1.5 text-xs bg-emerald-600 text-white px-2.5 py-1 rounded-lg font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{saveToast}</span>
          </div>
        )}
        <button
          onClick={handleSaveAsTemplate}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-gradient-to-r from-forge-purple to-forge-cyan text-white text-xs font-black shadow hover:opacity-90 transition-opacity"
        >
          <BookmarkPlus className="w-4 h-4" />
          <span>Save as My Template</span>
        </button>
        <p className="text-[10px] text-gray-500 text-center">
          Saves current style to <span className="text-gray-300 font-bold">My Templates</span> • Position uses % — safe for 9:16 / 16:9 / 1:1
        </p>
      </div>
    </div>
  );
};
