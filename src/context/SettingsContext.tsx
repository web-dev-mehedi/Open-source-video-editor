import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppSettings } from '../types/ipc';

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  ffmpegStatus: { available: boolean; version?: string; encoders?: string[] };
  isCheckingFFmpeg: boolean;
  checkFFmpeg: () => Promise<void>;
}

const defaultSettings: AppSettings = {
  geminiApiKey: '',
  defaultLanguage: 'en',
  defaultExportFormat: 'mp4',
  defaultResolution: '1080p',
  hardwareAcceleration: true,
  theme: 'dark',
  projectsDirectory: '',
  exportDirectory: '',
  defaultImageDuration: 5,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const savedKey = localStorage.getItem('cf_gemini_api_key') || '';
    const savedImgDur = parseFloat(localStorage.getItem('cf_default_image_duration') || '5');
    return {
      ...defaultSettings,
      geminiApiKey: savedKey,
      defaultImageDuration: isFinite(savedImgDur) && savedImgDur >= 1 && savedImgDur <= 30 ? savedImgDur : 5,
    };
  });
  const [ffmpegStatus, setFfmpegStatus] = useState<{ available: boolean; version?: string; encoders?: string[] }>({
    available: true,
    encoders: ['cpu', 'nvenc']
  });
  const [isCheckingFFmpeg, setIsCheckingFFmpeg] = useState<boolean>(false);

  useEffect(() => {
    loadInitialSettings();
    checkFFmpeg();
  }, []);

  const loadInitialSettings = async () => {
    if (window.captionForgeAPI?.getSettings) {
      try {
        const loaded = await window.captionForgeAPI.getSettings();
        if (loaded) {
          setSettings((prev) => ({ ...prev, ...loaded }));
          if (loaded.geminiApiKey) {
            localStorage.setItem('cf_gemini_api_key', loaded.geminiApiKey);
          }
        }
      } catch (e) {
        console.warn('Could not load native settings, using localStorage fallback');
      }
    }
  };

  const checkFFmpeg = async () => {
    setIsCheckingFFmpeg(true);
    if (window.captionForgeAPI?.checkFFmpegStatus) {
      try {
        const status = await window.captionForgeAPI.checkFFmpegStatus();
        setFfmpegStatus(status);
      } catch (e) {
        setFfmpegStatus({ available: false });
      }
    }
    setIsCheckingFFmpeg(false);
  };

  const updateSettings = async (updated: Partial<AppSettings>) => {
    const next = { ...settings, ...updated };
    setSettings(next);
    if (updated.geminiApiKey !== undefined) {
      localStorage.setItem('cf_gemini_api_key', updated.geminiApiKey);
    }
    if (updated.defaultImageDuration !== undefined) {
      const v = Math.max(1, Math.min(30, Math.round(updated.defaultImageDuration * 100) / 100));
      localStorage.setItem('cf_default_image_duration', String(v));
      next.defaultImageDuration = v;
      setSettings({ ...next });
    }
    if (window.captionForgeAPI?.saveSettings) {
      try {
        await window.captionForgeAPI.saveSettings(updated);
      } catch (e) {
        console.error('Failed to save settings via native API');
      }
    }
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        ffmpegStatus,
        isCheckingFFmpeg,
        checkFFmpeg,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
};
