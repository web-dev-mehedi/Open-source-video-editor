import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { SUPPORTED_LANGUAGES } from '../../utils/presetStyles';
import { useProject } from '../../context/ProjectContext';
import { useSettings } from '../../context/SettingsContext';
import { Languages, Sparkles, Check } from 'lucide-react';

interface TranslateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TranslateModal: React.FC<TranslateModalProps> = ({ isOpen, onClose }) => {
  const { project, setCaptions, autoTranscribeVideo } = useProject();
  const { settings } = useSettings();
  const [selectedLang, setSelectedLang] = useState<string>('es');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [translateStatus, setTranslateStatus] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');

  const hasExistingCaptions = Boolean(project?.captions && project.captions.length > 0);
  const primaryClip = project?.clips?.[0];

  const filteredLanguages = SUPPORTED_LANGUAGES.filter(
    (l) =>
      l.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      l.nativeName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      l.code.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const handleTranslate = async () => {
    if (!project) return;
    setIsTranslating(true);

    try {
      if (!hasExistingCaptions) {
        // Direct Video Audio Transcribe + Translate Flow
        if (!primaryClip) {
          alert('Please import a video footage clip first.');
          return;
        }
        setTranslateStatus('Detecting audio speech & transcribing with Gemini AI...');
        await autoTranscribeVideo(selectedLang);
        onClose();
        return;
      }

      setTranslateStatus('Translating captions with Gemini AI...');
      if (window.captionForgeAPI && settings.geminiApiKey) {
        const translated = await window.captionForgeAPI.translateCaptions(
          project.captions,
          selectedLang,
          settings.geminiApiKey
        );
        if (translated && translated.length > 0) {
          setCaptions(translated);
          onClose();
        }
      } else {
        // Fallback translation preview
        await new Promise((r) => setTimeout(r, 900));
        const sampleTranslated = project.captions.map((c) => ({
          ...c,
          text: `[${selectedLang.toUpperCase()}] ${c.text}`,
        }));
        setCaptions(sampleTranslated);
        onClose();
      }
    } catch (e: any) {
      alert(`Translation failed: ${e?.message || 'Unknown error'}`);
    } finally {
      setIsTranslating(false);
      setTranslateStatus('');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Translate Captions with Gemini AI"
      subtitle="Translate into 50+ languages while preserving exact word synchronization"
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Search input */}
        <input
          type="text"
          placeholder="Search languages..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-canvas-card border border-canvas-border rounded-xl text-gray-200 focus:outline-none focus:border-forge-purple"
        />

        {/* Languages Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
          {filteredLanguages.map((lang) => {
            const isSelected = lang.code === selectedLang;
            return (
              <button
                key={lang.code}
                onClick={() => setSelectedLang(lang.code)}
                className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                  isSelected
                    ? 'border-forge-purple bg-purple-950/30 text-white ring-1 ring-forge-purple'
                    : 'border-canvas-border bg-canvas-card/60 text-gray-300 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="text-base">{lang.flag}</span>
                  <div className="truncate">
                    <p className="text-xs font-semibold truncate">{lang.name}</p>
                    <p className="text-[10px] text-gray-500 truncate">{lang.nativeName}</p>
                  </div>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-forge-cyan flex-shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Status Message if translating */}
        {isTranslating && translateStatus && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-forge-purple/10 border border-forge-purple/30 text-xs text-forge-purple animate-pulse font-medium">
            <Sparkles className="w-4 h-4" />
            <span>{translateStatus}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#27272a]">
          <span className="text-[11px] text-gray-500 font-mono">
            {hasExistingCaptions
              ? `${project?.captions.length || 0} lines to translate`
              : 'Auto-detects speech from video'}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="md" onClick={onClose} disabled={isTranslating}>
              Cancel
            </Button>
            <Button
              variant="gradient"
              size="md"
              leftIcon={<Sparkles className="w-4 h-4" />}
              onClick={handleTranslate}
              isLoading={isTranslating}
            >
              {hasExistingCaptions ? 'Translate Captions' : 'Auto-Transcribe & Translate'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
