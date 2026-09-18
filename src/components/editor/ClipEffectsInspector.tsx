import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { getEffectDefinition } from '../../utils/effectPresets';
import { Slider } from '../common/Slider';
import {
  Sparkles,
  Sliders,
  Eye,
  EyeOff,
  Trash2,
  Copy,
  ClipboardPaste,
  RotateCcw,
  Plus,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Check,
} from 'lucide-react';

export const ClipEffectsInspector: React.FC = () => {
  const {
    project,
    selectedClipId,
    updateEffectParams,
    removeEffectFromClip,
    toggleEffect,
    reorderEffects,
    duplicateEffect,
    resetEffect,
    copyEffects,
    pasteEffects,
    copiedEffects,
    setActiveSidebarTab,
  } = useProject();

  const [expandedEffectId, setExpandedEffectId] = useState<string | null>(null);
  const [copiedToast, setCopiedToast] = useState(false);

  const activeClip = project?.clips?.find((c) => c.id === selectedClipId) || project?.clips?.[0];
  const effects = activeClip?.effects || [];

  if (!activeClip) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6 text-gray-500 select-none">
        <Sliders className="w-8 h-8 text-gray-600 mb-2" />
        <p className="text-xs font-semibold text-gray-300">No Clip Selected</p>
        <p className="text-[11px] text-gray-500 mt-1">Select a video clip on the timeline to inspect and edit its effect stack.</p>
      </div>
    );
  }

  const handleCopy = () => {
    copyEffects(activeClip.id);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 1800);
  };

  return (
    <div className="flex flex-col h-full bg-canvas-surface text-gray-200 select-none overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-canvas-border space-y-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <Sliders className="w-4 h-4 text-forge-cyan flex-shrink-0" />
            <h3 className="text-sm font-bold text-white truncate">Clip Effects Inspector</h3>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              disabled={effects.length === 0}
              className="p-1 rounded text-gray-400 hover:text-white bg-canvas-card border border-canvas-border disabled:opacity-40"
              title="Copy All Effects"
            >
              {copiedToast ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => pasteEffects(activeClip.id)}
              disabled={!copiedEffects || copiedEffects.length === 0}
              className="p-1 rounded text-gray-400 hover:text-white bg-canvas-card border border-canvas-border disabled:opacity-40"
              title="Paste Copied Effects"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setActiveSidebarTab('effects')}
              className="flex items-center gap-1 px-2 py-1 rounded bg-forge-purple hover:bg-purple-600 text-white text-xs font-semibold shadow-xs"
              title="Browse & Add Video Filters"
            >
              <Plus className="w-3 h-3" />
              <span>Add Effect</span>
            </button>
          </div>
        </div>

        {/* Clip Name HUD */}
        <div className="flex items-center justify-between text-[11px] bg-canvas-dark px-2 py-1 rounded border border-canvas-border font-mono">
          <span className="text-forge-cyan font-bold truncate max-w-[180px]">{activeClip.name}</span>
          <span className="text-gray-400">{effects.length} {effects.length === 1 ? 'Effect' : 'Effects'}</span>
        </div>
      </div>

      {/* Effect Stack List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {effects.length === 0 ? (
          <div className="p-8 rounded-lg border-2 border-dashed border-canvas-border flex flex-col items-center justify-center text-center text-gray-500 space-y-2 bg-canvas-card/30">
            <Sparkles className="w-6 h-6 text-gray-600" />
            <div>
              <p className="text-xs font-semibold text-gray-300">No Effects on this Clip</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Add color grading, vignette, blur, or cinematic grain.</p>
            </div>
            <button
              onClick={() => setActiveSidebarTab('effects')}
              className="mt-1 px-2.5 py-1 rounded-md bg-canvas-card hover:bg-canvas-hover border border-canvas-border text-xs font-semibold text-forge-cyan"
            >
              Browse 20 Effects
            </button>
          </div>
        ) : (
          effects.map((effect, idx) => {
            const def = getEffectDefinition(effect.type);
            const isExpanded = expandedEffectId === effect.id || (expandedEffectId === null && idx === 0);

            return (
              <div
                key={effect.id}
                className={`rounded-lg border transition-all overflow-hidden ${
                  effect.enabled
                    ? 'bg-canvas-card border-canvas-border'
                    : 'bg-canvas-card/40 border-canvas-border/50 opacity-60'
                }`}
              >
                {/* Effect Card Header */}
                <div className="p-2.5 flex items-center justify-between bg-canvas-surface/80 border-b border-canvas-border/60">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      onClick={() => toggleEffect(activeClip.id, effect.id)}
                      className={`p-0.5 rounded hover:bg-canvas-card transition-colors ${
                        effect.enabled ? 'text-forge-cyan' : 'text-gray-500'
                      }`}
                      title={effect.enabled ? 'Disable Effect' : 'Enable Effect'}
                    >
                      {effect.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>

                    <div
                      onClick={() => setExpandedEffectId(isExpanded ? '' : effect.id)}
                      className="cursor-pointer font-bold text-xs text-white truncate hover:text-forge-cyan transition-colors"
                    >
                      {effect.name}
                    </div>
                  </div>

                  {/* Action Buttons (Reorder, Duplicate, Reset, Delete) */}
                  <div className="flex items-center gap-1 text-gray-400">
                    {idx > 0 && (
                      <button
                        onClick={() => reorderEffects(activeClip.id, idx, idx - 1)}
                        className="p-1 rounded hover:text-white hover:bg-canvas-dark"
                        title="Move Up"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                    )}
                    {idx < effects.length - 1 && (
                      <button
                        onClick={() => reorderEffects(activeClip.id, idx, idx + 1)}
                        className="p-1 rounded hover:text-white hover:bg-canvas-dark"
                        title="Move Down"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    )}

                    <button
                      onClick={() => resetEffect(activeClip.id, effect.id)}
                      className="p-1 rounded hover:text-white hover:bg-canvas-dark"
                      title="Reset Effect Defaults"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>

                    <button
                      onClick={() => duplicateEffect(activeClip.id, effect.id)}
                      className="p-1 rounded hover:text-white hover:bg-canvas-dark"
                      title="Duplicate Effect"
                    >
                      <Copy className="w-3 h-3" />
                    </button>

                    <button
                      onClick={() => removeEffectFromClip(activeClip.id, effect.id)}
                      className="p-1 rounded hover:text-red-400 hover:bg-canvas-dark"
                      title="Remove Effect"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Effect Parameters Form */}
                {isExpanded && def && (
                  <div className="p-3 space-y-3 bg-canvas-card/90">
                    {def.parameters.map((param) => {
                      const currentValue = effect.params[param.id] ?? param.defaultValue;

                      if (param.type === 'number') {
                        return (
                          <Slider
                            key={param.id}
                            label={param.name}
                            value={currentValue}
                            min={param.min ?? 0}
                            max={param.max ?? 100}
                            step={param.step ?? 1}
                            unit={param.unit ?? ''}
                            onChange={(val) =>
                              updateEffectParams(activeClip.id, effect.id, { [param.id]: val })
                            }
                          />
                        );
                      }

                      if (param.type === 'color') {
                        return (
                          <div key={param.id} className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">{param.name}</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={currentValue}
                                onChange={(e) =>
                                  updateEffectParams(activeClip.id, effect.id, { [param.id]: e.target.value })
                                }
                                className="w-6 h-6 rounded bg-transparent cursor-pointer border border-canvas-border"
                              />
                              <span className="font-mono text-[11px] text-gray-300 uppercase">
                                {currentValue}
                              </span>
                            </div>
                          </div>
                        );
                      }

                      if (param.type === 'select' && param.options) {
                        return (
                          <div key={param.id} className="space-y-1 text-xs">
                            <label className="text-gray-400 block">{param.name}</label>
                            <select
                              value={currentValue}
                              onChange={(e) =>
                                updateEffectParams(activeClip.id, effect.id, { [param.id]: e.target.value })
                              }
                              className="w-full px-2.5 py-1 text-xs bg-canvas-surface border border-canvas-border rounded-md text-gray-200 focus:outline-none focus:border-forge-purple"
                            >
                              {param.options.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      }

                      if (param.type === 'boolean') {
                        return (
                          <div key={param.id} className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">{param.name}</span>
                            <input
                              type="checkbox"
                              checked={!!currentValue}
                              onChange={(e) =>
                                updateEffectParams(activeClip.id, effect.id, { [param.id]: e.target.checked })
                              }
                              className="rounded bg-canvas-surface border-canvas-border accent-forge-purple cursor-pointer"
                            />
                          </div>
                        );
                      }

                      return null;
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
