import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Button } from '../common/Button';
import { Slider } from '../common/Slider';
import { Layers, Image, Type, Sparkles, Trash2, Plus, Upload } from 'lucide-react';

export const OverlaysPanel: React.FC = () => {
  const {
    project,
    currentTime,
    addOverlay,
    updateOverlay,
    deleteOverlay,
    selectedOverlayId,
    setSelectedOverlayId,
  } = useProject();

  const [overlayTab, setOverlayTab] = useState<'watermark' | 'text' | 'intro'>('watermark');
  const [customText, setCustomText] = useState('Subscribe for more!');
  const [introTitle, setIntroTitle] = useState('CaptionForge');
  const [introSubtitle, setIntroSubtitle] = useState('AI Powered Video Editor');

  const handleUploadLogo = async () => {
    if (window.captionForgeAPI?.openFileDialog) {
      const filePath = await window.captionForgeAPI.openFileDialog({
        filters: [{ name: 'Image Files', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp'] }]
      });

      if (filePath) {
        addOverlay({
          type: 'image',
          name: 'Brand Logo',
          filePath,
          timelineStart: 0,
          timelineDuration: project?.metadata.duration || 15,
          x: 88, // Top Right
          y: 8,
          scale: 0.8,
          opacity: 0.85,
        });
      }
    } else {
      // Mock for browser
      addOverlay({
        type: 'image',
        name: 'Brand Logo',
        timelineStart: 0,
        timelineDuration: project?.metadata.duration || 15,
        x: 88,
        y: 8,
        scale: 0.8,
        opacity: 0.85,
      });
    }
  };

  const handleAddTextOverlay = () => {
    addOverlay({
      type: 'text',
      name: customText.slice(0, 16) || 'Text Overlay',
      text: customText,
      timelineStart: currentTime,
      timelineDuration: 3,
      x: 50,
      y: 80,
      scale: 1,
      opacity: 1,
      textColor: '#FFFFFF',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      fontSize: 28,
    });
  };

  const handleAddIntroCard = () => {
    addOverlay({
      type: 'intro',
      name: 'Intro Title Card',
      title: introTitle,
      subtitle: introSubtitle,
      text: `${introTitle}\n${introSubtitle}`,
      timelineStart: 0,
      timelineDuration: 2.5,
      x: 50,
      y: 50,
      scale: 1.2,
      opacity: 1,
      textColor: '#FBBF24',
      backgroundColor: 'rgba(10, 10, 15, 0.85)',
      fontSize: 36,
    });
  };

  const activeOverlay = project?.overlays.find((o) => o.id === selectedOverlayId);

  return (
    <div className="flex flex-col h-full bg-canvas-surface text-gray-200 select-none overflow-y-auto p-4 space-y-4">
      {/* Title */}
      <div className="flex items-center justify-between pb-2 border-b border-canvas-border">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-forge-emerald" />
          <span>Overlays & Branding</span>
        </h3>
        <span className="text-[11px] text-gray-400 font-mono bg-canvas-card px-2 py-0.5 rounded">
          {project?.overlays.length || 0} active
        </span>
      </div>

      {/* Sub-tabs: Watermark vs Text vs Intro */}
      <div className="flex bg-canvas-card p-1 rounded-xl border border-canvas-border">
        <button
          onClick={() => setOverlayTab('watermark')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
            overlayTab === 'watermark' ? 'bg-forge-purple text-white shadow' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Image className="w-3.5 h-3.5" />
          Logo / Watermark
        </button>

        <button
          onClick={() => setOverlayTab('text')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
            overlayTab === 'text' ? 'bg-forge-purple text-white shadow' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Type className="w-3.5 h-3.5" />
          Text Banner
        </button>

        <button
          onClick={() => setOverlayTab('intro')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
            overlayTab === 'intro' ? 'bg-forge-purple text-white shadow' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Intro / Outro
        </button>
      </div>

      {/* Tab 1: Logo Watermark */}
      {overlayTab === 'watermark' && (
        <div className="space-y-3 p-3 rounded-xl bg-canvas-card/60 border border-canvas-border">
          <p className="text-xs text-gray-400">
            Upload your brand watermark or creator badge to overlay across the entire video.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            leftIcon={<Upload className="w-3.5 h-3.5 text-forge-cyan" />}
            onClick={handleUploadLogo}
          >
            Select Logo Image (PNG / SVG)
          </Button>
        </div>
      )}

      {/* Tab 2: Text Overlay */}
      {overlayTab === 'text' && (
        <div className="space-y-3 p-3 rounded-xl bg-canvas-card/60 border border-canvas-border">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Banner Text</label>
            <input
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-canvas-dark border border-canvas-border rounded-lg text-gray-200 focus:outline-none focus:border-forge-purple"
            />
          </div>
          <div
            draggable
            onDragStart={(e) => {
              const obj = {
                type: 'text-preset',
                preset: {
                  name: customText || 'Text Banner',
                  previewText: customText || 'Text Banner',
                  duration: 3,
                  fontSize: 28,
                  textColor: '#FFFFFF',
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  defaultY: 80,
                },
              };
              const payload = JSON.stringify(obj);
              e.dataTransfer.setData('application/json', payload);
              e.dataTransfer.setData('text/plain', payload);
              try {
                e.dataTransfer.effectAllowed = 'copy';
                (window as any).__cf_draggedMedia = obj;
              } catch {}
            }}
          >
            <Button
              variant="secondary"
              size="sm"
              className="w-full cursor-grab active:cursor-grabbing"
              leftIcon={<Plus className="w-3.5 h-3.5 text-forge-emerald" />}
              onClick={handleAddTextOverlay}
            >
              Add or Drag to Timeline
            </Button>
          </div>
        </div>
      )}

      {/* Tab 3: Intro / Outro */}
      {overlayTab === 'intro' && (
        <div className="space-y-3 p-3 rounded-xl bg-canvas-card/60 border border-canvas-border">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Main Title</label>
            <input
              type="text"
              value={introTitle}
              onChange={(e) => setIntroTitle(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-canvas-dark border border-canvas-border rounded-lg text-gray-200 focus:outline-none focus:border-forge-purple"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Subtitle / Tagline</label>
            <input
              type="text"
              value={introSubtitle}
              onChange={(e) => setIntroSubtitle(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-canvas-dark border border-canvas-border rounded-lg text-gray-200 focus:outline-none focus:border-forge-purple"
            />
          </div>
          <div
            draggable
            onDragStart={(e) => {
              const obj = {
                type: 'motion-graphic',
                template: {
                  id: 'intro_card',
                  name: introTitle || 'Intro Title Card',
                  defaultParams: {
                    title: introTitle,
                    subtitle: introSubtitle,
                    durationInSeconds: 2.5,
                    x: 50,
                    y: 50,
                    scale: 1.2,
                    textColor: '#FBBF24',
                    backgroundColor: 'rgba(10, 10, 15, 0.85)',
                    fontSize: 36,
                    animationStyle: 'pop',
                  },
                },
              };
              const payload = JSON.stringify(obj);
              e.dataTransfer.setData('application/json', payload);
              e.dataTransfer.setData('text/plain', payload);
              try {
                e.dataTransfer.effectAllowed = 'copy';
                (window as any).__cf_draggedMedia = obj;
              } catch {}
            }}
          >
            <Button
              variant="gradient"
              size="sm"
              className="w-full cursor-grab active:cursor-grabbing"
              leftIcon={<Sparkles className="w-3.5 h-3.5" />}
              onClick={handleAddIntroCard}
            >
              Add or Drag Intro to Timeline
            </Button>
          </div>
        </div>
      )}

      {/* Active Selected Overlay Controller */}
      {activeOverlay && (
        <div className="space-y-3 pt-3 border-t border-canvas-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-300">Edit Selected Overlay</span>
            <button
              onClick={() => deleteOverlay(activeOverlay.id)}
              className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-500/10 text-xs flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete</span>
            </button>
          </div>

          <Slider
            label="Horizontal Position (X)"
            value={activeOverlay.x}
            min={5}
            max={95}
            step={1}
            unit="%"
            onChange={(val) => updateOverlay(activeOverlay.id, { x: val })}
          />

          <Slider
            label="Vertical Position (Y)"
            value={activeOverlay.y}
            min={5}
            max={95}
            step={1}
            unit="%"
            onChange={(val) => updateOverlay(activeOverlay.id, { y: val })}
          />

          <Slider
            label="Scale"
            value={activeOverlay.scale}
            min={0.2}
            max={3.0}
            step={0.1}
            unit="x"
            onChange={(val) => updateOverlay(activeOverlay.id, { scale: val })}
          />

          <Slider
            label="Opacity"
            value={Math.round(activeOverlay.opacity * 100)}
            min={10}
            max={100}
            step={5}
            unit="%"
            onChange={(val) => updateOverlay(activeOverlay.id, { opacity: val / 100 })}
          />
        </div>
      )}

      {/* List of active overlays */}
      <div className="space-y-1.5 pt-2">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
          Current Overlay Layers
        </span>
        {project?.overlays.map((ov) => (
          <div
            key={ov.id}
            onClick={() => setSelectedOverlayId(ov.id)}
            className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all ${
              ov.id === selectedOverlayId
                ? 'border-forge-emerald bg-emerald-950/20 text-white'
                : 'border-canvas-border bg-canvas-card text-gray-400 hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              {ov.type === 'image' && <Image className="w-3.5 h-3.5 text-emerald-400" />}
              {ov.type === 'text' && <Type className="w-3.5 h-3.5 text-emerald-400" />}
              {ov.type === 'intro' && <Sparkles className="w-3.5 h-3.5 text-emerald-400" />}
              <span className="truncate font-medium">{ov.name}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteOverlay(ov.id);
              }}
              className="text-gray-500 hover:text-red-400 p-1"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
