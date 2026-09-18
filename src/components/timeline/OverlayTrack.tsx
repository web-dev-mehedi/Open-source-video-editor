import React, { useState } from 'react';
import { OverlayElement } from '../../types/project';
import { useProject } from '../../context/ProjectContext';
import { resolveEffectPreset } from '../../utils/presetBridge';
import { getDragPayload, clearDragPayload } from '../../utils/nleDnD';
import { Image, Type, Sparkles, Layout, Film, Copy, Trash2 } from 'lucide-react';

interface OverlayTrackProps {
  overlays: OverlayElement[];
  selectedOverlayId: string | null;
  pixelsPerSecond: number;
  totalWidth: number;
  isLocked?: boolean;
  isHidden?: boolean;
  onSelectOverlay: (id: string) => void;
  visibleStartSeconds?: number;
  visibleEndSeconds?: number;
}

export const OverlayTrack: React.FC<OverlayTrackProps> = React.memo(({
  overlays = [],
  selectedOverlayId,
  pixelsPerSecond,
  totalWidth,
  isLocked = false,
  isHidden = false,
  visibleStartSeconds,
  visibleEndSeconds,
  onSelectOverlay,
}) => {
  const { addOverlay, updateOverlay, deleteOverlay, duplicateOverlay, currentTime } = useProject() as any;
  const [isDragOver, setIsDragOver] = useState(false);
  const [trimPreview, setTrimPreview] = useState<Record<string, { timelineStart: number; timelineDuration: number }>>({});
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; overlayId: string } | null>(null);

  const handleTrackDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    // Handle OS image files dropped directly on OverlayTrack
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const dropX = e.clientX - rect.left;
      const dropTime = Math.max(0, dropX / pixelsPerSecond);

      for (const file of Array.from(e.dataTransfer.files)) {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            const img = new window.Image();
            img.onload = () => {
              const overlayId = `ov_img_${Date.now()}_${Math.random().toString(36).substring(7)}`;
              addOverlay({
                id: overlayId,
                type: 'image',
                name: file.name.slice(0, 20),
                timelineStart: dropTime,
                timelineDuration: 4.0,
                x: 50,
                y: 50,
                scale: 1.0,
                opacity: 1.0,
                rotation: 0,
                imageUrl: dataUrl,
              });
              onSelectOverlay(overlayId);
            };
            img.src = dataUrl;
          };
          reader.readAsDataURL(file);
        }
      }
      return;
    }

    try {
      const data = getDragPayload(e as any);
      clearDragPayload();
      if (!data) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const dropX = e.clientX - rect.left;
      const dropTime = Math.max(0, dropX / pixelsPerSecond);

      if (data.type === 'text-preset' && data.preset) {
        const p = data.preset;
        const overlayId = `ov_txt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        addOverlay({
          id: overlayId,
          type: 'text',
          name: p.name,
          timelineStart: dropTime,
          timelineDuration: p.duration || 4,
          x: 50,
          y: p.defaultY ?? 50,
          scale: 1.0,
          opacity: 1.0,
          rotation: 0,
          text: p.previewText,
          fontFamily: p.fontFamily,
          fontSize: p.fontSize,
          fontWeight: p.fontWeight,
          textColor: p.textColor,
          backgroundColor: p.backgroundColor,
          backgroundPadding: p.backgroundPadding,
          backgroundRadius: p.backgroundRadius,
          strokeColor: p.strokeColor,
          strokeWidth: p.strokeWidth,
          shadowColor: p.shadowColor,
          shadowBlur: p.shadowBlur,
          shadowOffsetX: p.shadowOffsetX,
          shadowOffsetY: p.shadowOffsetY,
          animationStyle: p.animationStyle || 'fade',
        });
        onSelectOverlay(overlayId);
      } else if (data.type === 'element-preset' && data.item) {
        const el = data.item;
        const overlayId = `ov_el_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        addOverlay({
          id: overlayId,
          type: 'element',
          name: el.name,
          timelineStart: dropTime,
          timelineDuration: el.duration || 3,
          x: 50,
          y: 50,
          scale: 1.0,
          opacity: 1.0,
          textColor: el.defaultColor || '#FFFFFF',
          title: el.name,
          animationStyle: 'pop',
        });
        onSelectOverlay(overlayId);
      } else if (data.type === 'motion-graphic' && data.template) {
        const tpl = data.template;
        const overlayId = `ov_mogrt_${Date.now()}`;
        addOverlay({
          id: overlayId,
          type: 'motion-graphic' as any,
          name: tpl.name,
          timelineStart: dropTime,
          timelineDuration: tpl.defaultParams?.durationInSeconds || 3.5,
          x: tpl.defaultParams?.x ?? 50,
          y: tpl.defaultParams?.y ?? 80,
          scale: tpl.defaultParams?.scale ?? 1.0,
          opacity: tpl.defaultParams?.opacity ?? 1.0,
          title: tpl.defaultParams?.title,
          subtitle: tpl.defaultParams?.subtitle,
          textColor: tpl.defaultParams?.textColor,
          backgroundColor: tpl.defaultParams?.backgroundColor,
          fontFamily: tpl.defaultParams?.fontFamily,
          fontSize: tpl.defaultParams?.fontSize,
          animationStyle: tpl.defaultParams?.animationStyle || 'slide',
          templateId: tpl.id,
          motionParams: { ...tpl.defaultParams },
        } as any);
        onSelectOverlay(overlayId);
      } else if (data.type === 'effect' && (data.effectType || (data as any).presetId)) {
        const presetId = data.effectType || (data as any).presetId;
        const resolved = resolveEffectPreset(presetId);
        if (!resolved) return;
        const overlayId = `ov_fx_${Date.now()}`;
        addOverlay({
          id: overlayId,
          type: 'effect' as any,
          name: `${resolved.name} Layer`,
          timelineStart: dropTime,
          timelineDuration: 6.0,
          x: 50,
          y: 50,
          scale: 1.0,
          opacity: 1.0,
          effectType: resolved.engineType,
          params: { ...resolved.params },
        } as any);
        onSelectOverlay(overlayId);
      }
    } catch (err) {
      console.error('Failed to parse dropped overlay', err);
    }
  };

  // Horizontal drag-to-move overlay block across timeline
  const handleOverlayMouseDown = (ov: OverlayElement, e: React.MouseEvent) => {
    if (e.button !== 0 || isLocked) return;
    onSelectOverlay(ov.id);

    const startX = e.clientX;
    const initialStart = ov.timelineStart;
    let latestStart = initialStart;

    const onMove = (me: MouseEvent) => {
      const deltaSec = (me.clientX - startX) / pixelsPerSecond;
      let newStart = Math.max(0, initialStart + deltaSec);
      // Snap to playhead or 0
      const snapThreshold = 6 / pixelsPerSecond;
      if (Math.abs(newStart) < snapThreshold) newStart = 0;
      if (isFinite(currentTime) && Math.abs(newStart - currentTime) < snapThreshold) newStart = currentTime;

      latestStart = Math.max(0, Math.round(newStart * 100) / 100);
      setTrimPreview((prev) => ({
        ...prev,
        [ov.id]: { timelineStart: latestStart, timelineDuration: ov.timelineDuration },
      }));
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setTrimPreview((prev) => {
        const { [ov.id]: _, ...rest } = prev;
        return rest;
      });
      if (Math.abs(latestStart - initialStart) > 0.01) {
        updateOverlay(ov.id, { timelineStart: latestStart });
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const getOverlayIcon = (type: string) => {
    switch (type) {
      case 'effect':
        return <Sparkles className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />;
      case 'text':
        return <Type className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />;
      case 'image':
        return <Image className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />;
      case 'motion-graphic':
        return <Film className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />;
      default:
        return <Layout className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />;
    }
  };

  const getOverlayStyle = (ov: OverlayElement, isSelected: boolean) => {
    if (isSelected) {
      return 'bg-[#0e2a35] border-forge-cyan text-cyan-100 ring-2 ring-forge-cyan shadow-lg shadow-cyan-950/60 z-20';
    }
    switch (ov.type) {
      case 'effect':
        return 'bg-gradient-to-r from-purple-950/90 to-indigo-950/90 border-purple-500/70 text-purple-200 hover:border-purple-400 hover:text-white z-10';
      case 'text':
        return 'bg-gradient-to-r from-cyan-950/90 to-blue-950/90 border-cyan-500/70 text-cyan-200 hover:border-cyan-400 hover:text-white z-10';
      case 'image':
        return 'bg-gradient-to-r from-emerald-950/90 to-teal-950/90 border-emerald-500/70 text-emerald-200 hover:border-emerald-400 hover:text-white z-10';
      case 'motion-graphic':
        return 'bg-gradient-to-r from-rose-950/90 to-pink-950/90 border-rose-500/70 text-rose-200 hover:border-rose-400 hover:text-white z-10';
      default:
        return 'bg-[#1e1e24] border-[#3f3f46] text-gray-300 hover:border-forge-cyan/60 hover:text-white z-10';
    }
  };

  return (
    <div
      onDragOver={(e) => {
        if (!isLocked) {
          e.preventDefault();
          setIsDragOver(true);
        }
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={isLocked ? undefined : handleTrackDrop}
      style={{ width: `${totalWidth}px` }}
      className={`h-11 border-b border-canvas-border relative select-none flex-shrink-0 transition-colors ${
        isHidden ? 'opacity-40 grayscale-30' : ''
      } ${
        isDragOver ? 'bg-cyan-950/30 ring-1 ring-forge-cyan' : 'bg-[#151518]/60'
      }`}
    >
      {/* Virtualized Overlay Blocks */}
      {overlays
        .filter((ov) => {
          if (visibleStartSeconds === undefined || visibleEndSeconds === undefined) return true;
          const isSelected = ov.id === selectedOverlayId;
          if (isSelected) return true;
          const preview = trimPreview[ov.id];
          const start = preview ? preview.timelineStart : ov.timelineStart;
          const end = start + (preview ? preview.timelineDuration : ov.timelineDuration);
          return end >= visibleStartSeconds && start <= visibleEndSeconds;
        })
        .map((ov) => {
          const isSelected = ov.id === selectedOverlayId;
          const preview = trimPreview[ov.id];
          const effectiveStart = preview ? preview.timelineStart : ov.timelineStart;
          const effectiveDur = preview ? preview.timelineDuration : ov.timelineDuration;
          const left = effectiveStart * pixelsPerSecond;
          const width = Math.max(28, effectiveDur * pixelsPerSecond);

          return (
            <div
              key={ov.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectOverlay(ov.id);
              }}
              onMouseDown={(e) => handleOverlayMouseDown(ov, e)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelectOverlay(ov.id);
                setContextMenu({ x: e.clientX, y: e.clientY, overlayId: ov.id });
              }}
              style={{
                left: `${left}px`,
                width: `${width}px`,
              }}
              className={`absolute top-1 bottom-1 rounded-lg border flex items-center justify-between px-2.5 overflow-hidden transition-all text-xs font-semibold gap-1.5 group select-none ${
                isLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
              } ${getOverlayStyle(ov, isSelected)}`}
              title={`"${ov.name || ov.type}" (${effectiveDur.toFixed(1)}s)${isLocked ? ' [LOCKED]' : ''}`}
            >
              {/* Left Trim Handle */}
              {!isLocked && (
                <div
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    const startX = e.clientX;
                    const initialStart = ov.timelineStart;
                    const initialDur = ov.timelineDuration;
                    let latestStart = initialStart;
                    let latestDur = initialDur;

                    const onMove = (me: MouseEvent) => {
                      const deltaSec = (me.clientX - startX) / pixelsPerSecond;
                      latestStart = Math.max(0, initialStart + deltaSec);
                      latestDur = Math.max(0.2, initialDur - deltaSec);
                      setTrimPreview((prev) => ({
                        ...prev,
                        [ov.id]: { timelineStart: latestStart, timelineDuration: latestDur },
                      }));
                    };
                    const onUp = () => {
                      window.removeEventListener('mousemove', onMove);
                      window.removeEventListener('mouseup', onUp);
                      setTrimPreview((prev) => {
                        const { [ov.id]: _, ...rest } = prev;
                        return rest;
                      });
                      if (Math.abs(latestStart - initialStart) > 0.01 || Math.abs(latestDur - initialDur) > 0.01) {
                        updateOverlay(ov.id, { timelineStart: latestStart, timelineDuration: latestDur });
                      }
                    };
                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                  }}
                  className="absolute left-0 top-0 bottom-0 w-2 bg-white/40 hover:bg-white cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity rounded-l z-30"
                  title="Trim start"
                />
              )}

              <div className="flex items-center gap-1.5 truncate max-w-[85%] pointer-events-none">
                {getOverlayIcon(ov.type)}
                <span className="truncate text-[11px] font-medium">{ov.name || ov.type}</span>
              </div>

              <span className="text-[9px] font-mono text-gray-400 bg-black/40 px-1 py-0.5 rounded flex-shrink-0 pointer-events-none">
                {effectiveDur.toFixed(1)}s
              </span>

              {/* Right Trim Handle */}
              {!isLocked && (
                <div
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    const startX = e.clientX;
                    const initialDur = ov.timelineDuration;
                    let latestDur = initialDur;

                    const onMove = (me: MouseEvent) => {
                      const deltaSec = (me.clientX - startX) / pixelsPerSecond;
                      latestDur = Math.max(0.2, initialDur + deltaSec);
                      setTrimPreview((prev) => ({
                        ...prev,
                        [ov.id]: { timelineStart: ov.timelineStart, timelineDuration: latestDur },
                      }));
                    };
                    const onUp = () => {
                      window.removeEventListener('mousemove', onMove);
                      window.removeEventListener('mouseup', onUp);
                      setTrimPreview((prev) => {
                        const { [ov.id]: _, ...rest } = prev;
                        return rest;
                      });
                      if (Math.abs(latestDur - initialDur) > 0.01) {
                        updateOverlay(ov.id, { timelineDuration: latestDur });
                      }
                    };
                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                  }}
                  className="absolute right-0 top-0 bottom-0 w-2 bg-white/40 hover:bg-white cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity rounded-r z-30"
                  title="Trim duration"
                />
              )}
            </div>
          );
        })}

      {/* Overlay Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-[#1e1e24] border border-[#3f3f46] rounded-xl shadow-2xl p-1.5 text-xs text-gray-200 min-w-[140px]"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              duplicateOverlay(contextMenu.overlayId);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] text-left transition-colors cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-cyan-400" />
            <span>Duplicate</span>
          </button>
          <button
            onClick={() => {
              deleteOverlay(contextMenu.overlayId);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-red-950/60 text-red-400 text-left transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* Dismiss context menu when clicking outside */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu(null);
          }}
        />
      )}
    </div>
  );
});
