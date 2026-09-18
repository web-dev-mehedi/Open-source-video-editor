import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export class StorageService {
  private baseDir: string;
  private projectsDir: string;
  private exportDir: string;
  private cacheDir: string;

  constructor() {
    // Standard user data path
    const userDataPath = app ? app.getPath('userData') : path.join(process.cwd(), '.captionforge-data');
    this.baseDir = userDataPath;
    this.projectsDir = path.join(userDataPath, 'projects');
    this.exportDir = path.join(userDataPath, 'exports');
    this.cacheDir = path.join(userDataPath, 'cache');

    this.ensureDirs();
  }

  private ensureDirs() {
    [this.baseDir, this.projectsDir, this.exportDir, this.cacheDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  public getProjectsDir(): string {
    return this.projectsDir;
  }

  public getExportsDir(): string {
    return this.exportDir;
  }

  public getCacheDir(): string {
    return this.cacheDir;
  }

  public getProjectFolder(projectId: string): string {
    const pFolder = path.join(this.projectsDir, projectId);
    if (!fs.existsSync(pFolder)) {
      fs.mkdirSync(pFolder, { recursive: true });
    }
    return pFolder;
  }

  public writeProjectJson(projectId: string, data: any): void {
    const pFolder = this.getProjectFolder(projectId);
    const filePath = path.join(pFolder, 'project.json');
    const tempPath = path.join(pFolder, 'project.json.tmp');
    const content = JSON.stringify(data, null, 2);
    // Crash-safe: write to temp, verify, then atomic rename
    fs.writeFileSync(tempPath, content, 'utf-8');
    // Verify temp is valid JSON
    try {
      JSON.parse(fs.readFileSync(tempPath, 'utf-8'));
    } catch {
      fs.unlinkSync(tempPath);
      throw new Error('Project verification failed');
    }
    fs.renameSync(tempPath, filePath);
  }

  public readProjectJson(projectId: string): any | null {
    const filePath = path.join(this.getProjectFolder(projectId), 'project.json');
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  public deleteProjectFolder(projectId: string): boolean {
    const pFolder = path.join(this.projectsDir, projectId);
    if (fs.existsSync(pFolder)) {
      try {
        fs.rmSync(pFolder, { recursive: true, force: true });
        return true;
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  public writeSubtitleTempFile(projectId: string, assContent: string, format: string = 'ass'): string {
    const pFolder = this.getProjectFolder(projectId);
    const subPath = path.join(pFolder, `subtitles_${Date.now()}.${format}`);
    fs.writeFileSync(subPath, assContent, 'utf-8');
    return subPath;
  }
}
