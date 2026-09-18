import React from 'react';
import { useProject } from '../../context/ProjectContext';
import { TRANSITION_DEFINITIONS, getTransitionDefinition } from '../../utils/transitionPresets';
import { TransitionType, TransitionDirection, TransitionAlignment, TransitionEasing } from '../../types/transitions';
import { Slider } from '../common/Slider';
import {
  Film,
  Clock,
  Sliders,
  Trash2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

export const TransitionInspector: React.FC = () => {
  const {
    project,
    selectedTransitionId,
    updateTransition,
    deleteTransition,
    setSelectedTransitionId,
    setActiveSidebarTab,
  } = useProject();

  const transition = project?.transitions?.find((t) => t.id === selectedTransitionId);

  if (!transition) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6 text-gray-500 select-none">
        <Film className="w-8 h-8 text-gray-600 mb-2" />
        <p className="text-xs font-semibold text-gray-300">No Transition Selected</p>
        <p className="text-[11px] text-gray-500 mt-1">
          Click on any transition badge on the timeline video track or add one from the Transitions panel.
        </p>
        <button
          onClick={() => setActiveSidebarTab('transitions')}
          className="mt-3 px-3 py-1.5 rounded-md bg-canvas-card hover:bg-canvas-hover border border-canvas-border text-xs font-semibold text-forge-purple"
        >
          Browse Transitions
        </button>
      </div>
    );
  }

  const def = getTransitionDefinition(transition.type);

  const handleTypeChange = (type: TransitionType) => {
    const newDef = getTransitionDefinition(type);
    if (!newDef) return;
    updateTransition(transition.id, {
      type,
      name: newDef.name,
      duration: newDef.defaultDuration,
      params: { ...newDef.defaultParams },
    });
  };

  return (
    <div className="flex flex-col h-full bg-canvas-surface text-gray-200 select-none overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-canvas-border space-y-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <Film className="w-4 h-4 text-forge-purple flex-shrink-0" />
            <h3 className="text-sm font-bold text-white truncate">Transition Inspector</h3>
          </div>

          <button
            onClick={() => deleteTransition(transition.id)}
            className="p-1 rounded text-gray-400 hover:text-red-400 bg-canvas-card border border-canvas-border"
            title="Delete Transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Transition Badge HUD */}
        <div className="flex items-center justify-between text-[11px] bg-canvas-dark px-2 py-1 rounded border border-canvas-border font-mono">
          <span className="text-forge-purple font-bold truncate">{transition.name}</span>
          <span className="text-gray-400">{transition.duration.toFixed(2)}s</span>
        </div>
      </div>

      {/* Settings Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 1. Transition Type Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-300">Transition Type</label>
          <select
            value={transition.type}
            onChange={(e) => handleTypeChange(e.target.value as TransitionType)}
            className="w-full px-2.5 py-1.5 text-xs bg-canvas-card border border-canvas-border rounded-lg text-gray-200 focus:outline-none focus:border-forge-purple"
          >
            {TRANSITION_DEFINITIONS.map((td) => (
              <option key={td.type} value={td.type}>
                {td.name} ({td.category})
              </option>
            ))}
          </select>
          {def && <p className="text-[10px] text-gray-400 mt-0.5">{def.description}</p>}
        </div>

        {/* 2. Duration Slider */}
        <Slider
          label="Transition Duration"
          value={transition.duration}
          min={0.1}
          max={3.0}
          step={0.05}
          unit="s"
          onChange={(val) => updateTransition(transition.id, { duration: Math.round(val * 100) / 100 })}
        />

        {/* 3. Alignment Options */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-300">Cut Alignment</label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'center', label: 'Center Cut' },
              { id: 'start', label: 'Start at Cut' },
              { id: 'end', label: 'End at Cut' },
            ].map((align) => (
              <button
                key={align.id}
                onClick={() =>
                  updateTransition(transition.id, { alignment: align.id as TransitionAlignment })
                }
                className={`py-1 text-[11px] rounded font-semibold transition-all border ${
                  transition.alignment === align.id
                    ? 'bg-forge-purple text-white border-forge-purple shadow-xs'
                    : 'bg-canvas-card text-gray-400 hover:text-gray-200 border-canvas-border hover:bg-canvas-hover'
                }`}
              >
                {align.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Direction Selector (if supported) */}
        {def?.supportedDirections && def.supportedDirections.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-300">Direction</label>
            <select
              value={transition.direction || def.supportedDirections[0]}
              onChange={(e) =>
                updateTransition(transition.id, { direction: e.target.value as TransitionDirection })
              }
              className="w-full px-2.5 py-1.5 text-xs bg-canvas-card border border-canvas-border rounded-lg text-gray-200 focus:outline-none focus:border-forge-purple"
            >
              {def.supportedDirections.map((dir) => (
                <option key={dir} value={dir}>
                  {dir.replace('-', ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 5. Easing Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-300">Blend Curve / Easing</label>
          <select
            value={transition.easing || 'easeInOut'}
            onChange={(e) =>
              updateTransition(transition.id, { easing: e.target.value as TransitionEasing })
            }
            className="w-full px-2.5 py-1.5 text-xs bg-canvas-card border border-canvas-border rounded-lg text-gray-200 focus:outline-none focus:border-forge-purple"
          >
            <option value="easeInOut">Ease In-Out (Smooth)</option>
            <option value="linear">Linear (Constant Speed)</option>
            <option value="easeIn">Ease In (Accelerate)</option>
            <option value="easeOut">Ease Out (Decelerate)</option>
          </select>
        </div>

        {/* 6. Dynamic Custom Parameters from Definition */}
        {def?.parameters && def.parameters.length > 0 && (
          <div className="pt-2 border-t border-canvas-border space-y-3">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Specific Parameters
            </h4>

            {def.parameters.map((param) => {
              const currentVal = transition.params[param.id] ?? param.defaultValue;

              if (param.type === 'number') {
                return (
                  <Slider
                    key={param.id}
                    label={param.name}
                    value={currentVal}
                    min={param.min ?? 0}
                    max={param.max ?? 100}
                    step={param.step ?? 1}
                    unit={param.unit ?? ''}
                    onChange={(val) =>
                      updateTransition(transition.id, {
                        params: { ...transition.params, [param.id]: val },
                      })
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
                        value={currentVal}
                        onChange={(e) =>
                          updateTransition(transition.id, {
                            color: e.target.value,
                            params: { ...transition.params, [param.id]: e.target.value },
                          })
                        }
                        className="w-6 h-6 rounded bg-transparent cursor-pointer border border-canvas-border"
                      />
                      <span className="font-mono text-[11px] text-gray-300 uppercase">{currentVal}</span>
                    </div>
                  </div>
                );
              }

              if (param.type === 'boolean') {
                return (
                  <div key={param.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">{param.name}</span>
                    <input
                      type="checkbox"
                      checked={!!currentVal}
                      onChange={(e) =>
                        updateTransition(transition.id, {
                          params: { ...transition.params, [param.id]: e.target.checked },
                        })
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
    </div>
  );
};
