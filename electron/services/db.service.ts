import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { StorageService } from './storage.service';

export interface AppSettingsRecord {
  geminiApiKey: string;
  defaultLanguage: string;
  ffmpegPath?: string;
  ffprobePath?: string;
  defaultExportFormat: string;
  defaultResolution: string;
  hardwareAcceleration: boolean;
  theme: 'dark' | 'light' | 'system';
  projectsDirectory: string;
  exportDirectory: string;
}

export class DBService {
  private dbFilePath: string;
  private settingsFilePath: string;
  private exportHistoryFilePath: string;
  private storage: StorageService;

  constructor(storage: StorageService) {
    this.storage = storage;
    const baseDir = app ? app.getPath('userData') : path.join(process.cwd(), '.captionforge-data');
    this.dbFilePath = path.join(baseDir, 'captionforge_index.json');
    this.settingsFilePath = path.join(baseDir, 'settings.json');
    this.exportHistoryFilePath = path.join(baseDir, 'export_history.json');
    
    this.initDatabase();
  }

  private initDatabase() {
    if (!fs.existsSync(this.dbFilePath)) {
      fs.writeFileSync(this.dbFilePath, JSON.stringify({ projects: [] }, null, 2), 'utf-8');
    }
    if (!fs.existsSync(this.settingsFilePath)) {
      const defaultExportDir = this.resolveDefaultExportDir();
      const defaultSettings: AppSettingsRecord = {
        geminiApiKey: '',
        defaultLanguage: 'en',
        defaultExportFormat: 'mp4',
        defaultResolution: '1080p',
        hardwareAcceleration: true,
        theme: 'dark',
        projectsDirectory: this.storage.getProjectsDir(),
        exportDirectory: defaultExportDir,
      };
      fs.writeFileSync(this.settingsFilePath, JSON.stringify(defaultSettings, null, 2), 'utf-8');
    }
    if (!fs.existsSync(this.exportHistoryFilePath)) {
      fs.writeFileSync(this.exportHistoryFilePath, JSON.stringify({ exports: [] }, null, 2), 'utf-8');
    }
  }

  public resolveDefaultExportDir(): string {
    try {
      if (app) {
        const videos = app.getPath('videos');
        if (videos) {
          const exportDir = path.join(videos, 'CaptionForge');
          if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
          }
          return exportDir;
        }
      }
    } catch (e) {}
    return this.storage.getExportsDir();
  }

  public getSettings(): AppSettingsRecord {
    try {
      if (fs.existsSync(this.settingsFilePath)) {
        const content = fs.readFileSync(this.settingsFilePath, 'utf-8');
        const parsed = JSON.parse(content);
        if (!parsed.exportDirectory) {
          parsed.exportDirectory = this.resolveDefaultExportDir();
        }
        return parsed;
      }
    } catch (e) {}

    return {
      geminiApiKey: '',
      defaultLanguage: 'en',
      defaultExportFormat: 'mp4',
      defaultResolution: '1080p',
      hardwareAcceleration: true,
      theme: 'dark',
      projectsDirectory: this.storage.getProjectsDir(),
      exportDirectory: this.resolveDefaultExportDir(),
    };
  }

  public saveSettings(updated: Partial<AppSettingsRecord>): boolean {
    try {
      const current = this.getSettings();
      const merged = { ...current, ...updated };
      fs.writeFileSync(this.settingsFilePath, JSON.stringify(merged, null, 2), 'utf-8');
      return true;
    } catch (e) {
      return false;
    }
  }

  public getRecentProjects(): any[] {
    try {
      if (fs.existsSync(this.dbFilePath)) {
        const data = JSON.parse(fs.readFileSync(this.dbFilePath, 'utf-8'));
        return data.projects || [];
      }
    } catch (e) {}
    return [];
  }

  public saveProjectIndex(metadata: any): void {
    try {
      const db = JSON.parse(fs.readFileSync(this.dbFilePath, 'utf-8'));
      const projects: any[] = db.projects || [];
      
      const existingIdx = projects.findIndex((p) => p.id === metadata.id);
      if (existingIdx >= 0) {
        projects[existingIdx] = { ...projects[existingIdx], ...metadata, updatedAt: new Date().toISOString() };
      } else {
        projects.unshift({ ...metadata, updatedAt: new Date().toISOString() });
      }

      fs.writeFileSync(this.dbFilePath, JSON.stringify({ projects }, null, 2), 'utf-8');
    } catch (e) {}
  }

  public deleteProjectIndex(projectId: string): void {
    try {
      const db = JSON.parse(fs.readFileSync(this.dbFilePath, 'utf-8'));
      const projects = (db.projects || []).filter((p: any) => p.id !== projectId);
      fs.writeFileSync(this.dbFilePath, JSON.stringify({ projects }, null, 2), 'utf-8');
    } catch (e) {}
  }

  public addExportJob(job: any): void {
    try {
      const data = JSON.parse(fs.readFileSync(this.exportHistoryFilePath, 'utf-8'));
      const exports = data.exports || [];
      exports.unshift(job);
      fs.writeFileSync(this.exportHistoryFilePath, JSON.stringify({ exports: exports.slice(0, 50) }, null, 2), 'utf-8');
    } catch (e) {}
  }

  public getExportHistory(): any[] {
    try {
      if (fs.existsSync(this.exportHistoryFilePath)) {
        const data = JSON.parse(fs.readFileSync(this.exportHistoryFilePath, 'utf-8'));
        return data.exports || [];
      }
    } catch (e) {}
    return [];
  }
}
