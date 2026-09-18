import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useSettings } from '../../context/SettingsContext';
import { aiModelManager } from '../../services/ai/modelManager';
import { ModelManagerModal } from '../ai/ModelManagerModal';
import { Key, Cpu, Sparkles, CheckCircle2, AlertCircle, RefreshCw, ExternalLink, Eye, EyeOff, ShieldCheck, Folder, FolderOpen } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings, ffmpegStatus, isCheckingFFmpeg, checkFFmpeg } = useSettings();
  const [apiKey, setApiKey] = useState(settings.geminiApiKey);
  const [isSaved, setIsSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testMsg, setTestMsg] = useState('');
  const [isModelManagerOpen, setIsModelManagerOpen] = useState(false);

  // Sync local input when settings load asynchronously from native store / localStorage
  useEffect(() => {
    if (isOpen) {
      setApiKey(settings.geminiApiKey || '');
      setTestStatus('idle');
      setTestMsg('');
    }
  }, [settings.geminiApiKey, isOpen]);

  const maskedPreview = apiKey ? `${apiKey.slice(0, 4)}••••${apiKey.slice(-4)}` : 'Not set';
  const isKeyLooksValid = apiKey.trim().startsWith('AIza') && apiKey.trim().length >= 20;

  const handleSave = async () => {
    const trimmed = apiKey.trim();
    if (trimmed && !isKeyLooksValid) {
      setTestStatus('fail');
      setTestMsg('Key format looks invalid — Gemini keys start with AIza...');
      return;
    }
    await updateSettings({ geminiApiKey: trimmed });
    setIsSaved(true);
    setTestStatus('ok');
    setTestMsg(trimmed ? `Saved ${maskedPreview}` : 'Key cleared — AI captions will require a key next time');
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 800);
  };

  const handleTestKey = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setTestStatus('fail');
      setTestMsg('Paste your Gemini API key first.');
      return;
    }
    setTestStatus('testing');
    setTestMsg('Testing connection to Gemini...');
    try {
      // Lightweight validation via list models endpoint (no media payload)
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const count = (data.models || []).length;
        setTestStatus('ok');
        setTestMsg(`✓ Key valid — ${count} models accessible`);
      } else {
        const err = await res.json().catch(() => ({}));
        const msg = err?.error?.message || `HTTP ${res.status}`;
        setTestStatus('fail');
        setTestMsg(`✗ ${msg}`);
      }
    } catch (e: any) {
      setTestStatus('fail');
      setTestMsg(`✗ Network error: ${e?.message || 'failed to reach Google'}`);
    }
  };

  const handleBrowseExportFolder = async () => {
    if (window.captionForgeAPI?.selectFolderDialog) {
      const chosen = await window.captionForgeAPI.selectFolderDialog({
        title: 'Choose Default Export Directory',
        defaultPath: settings.exportDirectory,
      });
      if (chosen) {
        await updateSettings({ exportDirectory: chosen });
        localStorage.setItem('cf_last_export_dir', chosen);
      }
    }
  };

  const handleOpenExportFolder = () => {
    if (settings.exportDirectory && window.captionForgeAPI?.openFolderInExplorer) {
      window.captionForgeAPI.openFolderInExplorer(settings.exportDirectory);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="CaptionForge Settings"
      subtitle="Configure AI speech-to-text API keys and native FFmpeg engine"
      maxWidth="lg"
    >
      <div className="space-y-5 select-none">
        {/* 1. Google Gemini 1.5 Flash API Key */}
        <div className="p-4 rounded-xl bg-canvas-card/70 border border-canvas-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-forge-purple" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Google Gemini 1.5 Flash API Key
              </h4>
            </div>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-forge-cyan hover:underline flex items-center gap-1"
            >
              <span>Get Free Key</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <p className="text-xs text-gray-400">
            Your key is stored locally on your machine (never sent to our servers) and used solely to transcribe audio into word-level timestamps. The editor works fully offline — AI captions are optional.
          </p>

          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder="AIzaSy..."
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setTestStatus('idle'); }}
                className="w-full pl-3 pr-9 py-2 text-xs bg-canvas-dark border border-canvas-border rounded-lg text-gray-200 font-mono focus:outline-none focus:border-forge-purple"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white"
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <button
              onClick={handleTestKey}
              disabled={testStatus === 'testing'}
              className="px-3 py-2 text-xs font-bold rounded-lg bg-canvas-dark border border-canvas-border text-forge-cyan hover:bg-canvas-hover disabled:opacity-50 flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {testStatus === 'testing' ? 'Testing...' : 'Test'}
            </button>
          </div>

          {/* Key status row */}
          <div className="flex items-center justify-between text-[11px]">
            <span className={`flex items-center gap-1.5 ${apiKey ? (isKeyLooksValid ? 'text-emerald-400' : 'text-amber-400') : 'text-gray-500'}`}>
              <span className={`w-2 h-2 rounded-full ${apiKey ? (isKeyLooksValid ? 'bg-emerald-400' : 'bg-amber-400') : 'bg-gray-600'}`} />
              {apiKey ? (isKeyLooksValid ? `Key set — ${maskedPreview}` : 'Format check: key should start with AIza...') : 'No key set — AI captions disabled until you add one'}
            </span>
          </div>

          {testStatus !== 'idle' && testMsg && (
            <div className={`text-xs px-2.5 py-1.5 rounded-lg border font-mono ${testStatus === 'ok' ? 'bg-emerald-950/30 border-emerald-800 text-emerald-300' : testStatus === 'fail' ? 'bg-red-950/30 border-red-800 text-red-300' : 'bg-canvas-dark border-canvas-border text-gray-300'}`}>
              {testMsg}
            </div>
          )}
        </div>

        {/* 2. FFmpeg Engine Status */}
        <div className="p-4 rounded-xl bg-canvas-card/70 border border-canvas-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-forge-cyan" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                FFmpeg Native Video Engine
              </h4>
            </div>
            <button
              onClick={checkFFmpeg}
              disabled={isCheckingFFmpeg}
              className="text-[11px] text-gray-400 hover:text-white flex items-center gap-1 p-1 rounded hover:bg-white/5"
            >
              <RefreshCw className={`w-3 h-3 ${isCheckingFFmpeg ? 'animate-spin' : ''}`} />
              <span>Re-check</span>
            </button>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-lg bg-canvas-dark border border-canvas-border text-xs">
            <div className="flex items-center gap-2">
              {ffmpegStatus.available ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400" />
              )}
              <span className="font-semibold text-gray-200">
                {ffmpegStatus.available ? 'FFmpeg Engine Active' : 'FFmpeg Not Detected'}
              </span>
            </div>
            <span className="text-[11px] font-mono text-gray-500 truncate max-w-[200px]">
              {ffmpegStatus.version ? ffmpegStatus.version.slice(0, 30) : 'System default'}
            </span>
          </div>

          <div className="text-[11px] text-gray-400 flex items-center gap-2">
            <span>Hardware Encoders:</span>
            <div className="flex gap-1.5 font-mono">
              {ffmpegStatus.encoders?.map((enc) => (
                <span
                  key={enc}
                  className="px-1.5 py-0.5 rounded bg-forge-purple/15 text-forge-purple border border-forge-purple/30 uppercase text-[10px]"
                >
                  {enc}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Default Video Export Directory */}
        <div className="p-4 rounded-xl bg-canvas-card/70 border border-canvas-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-forge-cyan" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Default Export Destination
              </h4>
            </div>
            <div className="flex items-center gap-2">
              {settings.exportDirectory && (
                <button
                  type="button"
                  onClick={handleOpenExportFolder}
                  className="text-[11px] text-gray-400 hover:text-white flex items-center gap-1 font-medium transition-colors"
                >
                  <FolderOpen className="w-3 h-3 text-forge-cyan" />
                  <span>Open Folder</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleBrowseExportFolder}
                className="text-[11px] text-forge-cyan hover:underline flex items-center gap-1 font-medium"
              >
                <span>Change Folder</span>
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Rendered videos and caption exports are written directly to this directory by default without re-prompting.
          </p>

          <div className="flex items-center justify-between p-2.5 rounded-lg bg-canvas-dark border border-canvas-border text-xs">
            <span className="font-mono text-gray-200 truncate select-all" title={settings.exportDirectory}>
              {settings.exportDirectory || 'Default user Videos folder'}
            </span>
          </div>
        </div>

        {/* 4. Image Default Duration */}
        <div className="p-4 rounded-xl bg-canvas-card/70 border border-canvas-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-200 block">Still Image Default Duration</span>
            <span className="text-[11px] font-mono bg-canvas-dark border border-canvas-border px-2 py-0.5 rounded text-forge-cyan">
              {(settings.defaultImageDuration ?? 5).toFixed(1)}s
            </span>
          </div>
          <p className="text-[11px] text-gray-400">
            How long a still image holds when dragged to the timeline. Applied consistently to every new image clip (drag, insert at playhead, duplicate).
          </p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={15}
              step={0.5}
              value={settings.defaultImageDuration ?? 5}
              onChange={(e) => updateSettings({ defaultImageDuration: parseFloat(e.target.value) })}
              className="flex-1 accent-violet-600"
            />
            <div className="flex items-center gap-1">
              {[3, 5, 8].map((v) => (
                <button
                  key={v}
                  onClick={() => updateSettings({ defaultImageDuration: v })}
                  className={`px-2 py-1 rounded text-[11px] font-bold border ${Math.abs((settings.defaultImageDuration ?? 5) - v) < 0.1 ? 'bg-white text-black border-white' : 'bg-canvas-dark text-gray-300 border-canvas-border hover:border-white/20'}`}
                >
                  {v}s
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4. AI Models & Background Removal */}
        <div className="p-4 rounded-xl bg-canvas-card/70 border border-canvas-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-forge-purple" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Local AI Background Removal Models
              </h4>
            </div>
            <button
              onClick={() => setIsModelManagerOpen(true)}
              className="text-[11px] text-forge-cyan hover:underline font-medium"
            >
              Open Model Manager
            </button>
          </div>

          <p className="text-xs text-gray-400">
            Local neural models run 100% offline on your device with no cloud API or server upload. Manage modular downloads and free up disk space.
          </p>

          <div className="flex items-center justify-between p-2.5 rounded-lg bg-canvas-dark border border-canvas-border text-xs">
            <span className="font-semibold text-gray-300">
              Total AI Model Storage Used:
            </span>
            <span className="font-mono text-forge-cyan font-bold">
              {(aiModelManager.getTotalDiskUsageBytes() / (1024 * 1024)).toFixed(1)} MB
            </span>
          </div>
        </div>

        {/* 5. Hardware Acceleration Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-canvas-card/70 border border-canvas-border">
          <div>
            <span className="text-xs font-bold text-gray-200 block">GPU Hardware Acceleration</span>
            <span className="text-[11px] text-gray-400">
              Accelerate 4K video rendering using NVIDIA NVENC, Intel QSV, or AMD AMF
            </span>
          </div>
          <input
            type="checkbox"
            checked={settings.hardwareAcceleration}
            onChange={(e) => updateSettings({ hardwareAcceleration: e.target.checked })}
            className="w-4 h-4 rounded bg-canvas-card border-canvas-border text-forge-purple focus:ring-forge-purple"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-canvas-border">
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="gradient"
            size="md"
            leftIcon={isSaved ? <CheckCircle2 className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            onClick={handleSave}
          >
            {isSaved ? 'Saved!' : 'Save Settings'}
          </Button>
        </div>
      </div>

      <ModelManagerModal
        isOpen={isModelManagerOpen}
        onClose={() => setIsModelManagerOpen(false)}
      />
    </Modal>
  );
};
