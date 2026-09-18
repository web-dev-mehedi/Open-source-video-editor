/**
 * Destination & Folder Selection Service
 * 
 * Provides a single source of truth for:
 * 1. Native folder picking across Electron and browser runtimes.
 * 2. Absolute filesystem paths vs UI display labels (never using "Video" as actual path).
 * 3. Platform-safe path construction supporting Windows, POSIX, Unicode, Bangla.
 * 4. Windows filename sanitization and illegal character stripping.
 * 5. Format extension enforcement and non-colliding filename generation.
 * 6. Pre-export destination writability validation.
 */

export interface ExportDestinationResolution {
  absolutePath: string;
  displayPath: string;
  isCustom: boolean;
}

export interface FolderValidationResult {
  valid: boolean;
  resolvedPath?: string;
  error?: string;
  errorCode?: 'ERR_PATH_EMPTY' | 'ERR_NOT_ABSOLUTE' | 'ERR_NOT_FOUND' | 'ERR_PERMISSION_DENIED';
}

/**
 * Strips Windows illegal filename characters: \ / : * ? " < > |
 * Trims whitespace, replaces control characters, and handles Unicode & Bangla safely.
 */
export function sanitizeFileName(name: string, format: string): string {
  const fmt = (format || 'mp4').toLowerCase().replace(/^\./, '');
  const raw = (name || '').trim();

  // Strip illegal Windows path characters
  let clean = raw.replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_').trim();
  clean = clean.replace(/\s+/g, ' ');

  // If sanitized name becomes empty, provide standard fallback
  if (!clean || clean === '.' || clean === '..') {
    clean = 'Video_CaptionForge';
  }

  // Remove existing extension if present (e.g. .mp3, .mp4, .txt, .srt)
  const withoutExt = clean.replace(/\.[a-zA-Z0-9]{1,6}$/i, '');
  return `${withoutExt}.${fmt}`;
}

/**
 * Joins a folder path and filename using the platform-appropriate separator.
 * Correctly preserves Windows drive letters (C:\, D:\) and UNC network paths.
 */
export function joinExportPath(folder: string, fileName: string): string {
  const normFolder = (folder || '').trim().replace(/[\\/]+$/, '');
  const normFile = (fileName || '').trim().replace(/^[\\/]+/, '');

  if (!normFolder) return normFile;
  const isWindows = normFolder.includes('\\') || /^[a-zA-Z]:/.test(normFolder);
  const sep = isWindows ? '\\' : '/';
  return `${normFolder}${sep}${normFile}`;
}

/**
 * Checks if a given path is an absolute filesystem path.
 */
export function isAbsolutePath(p: string): boolean {
  if (!p || typeof p !== 'string') return false;
  const trimmed = p.trim();
  // Windows absolute: "C:\...", "D:/...", or "\\server\share"
  if (/^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.startsWith('\\\\')) return true;
  // POSIX absolute: "/..."
  if (trimmed.startsWith('/')) return true;
  return false;
}

/**
 * Resolves a canonical absolute folder path.
 * Guarantees that display labels like "Video" or relative strings are NEVER used as actual filesystem destinations.
 */
export async function resolveCanonicalExportFolder(
  savedFolder?: string | null,
  defaultVideosFallback = 'C:\\Users\\Default\\Videos\\CaptionForge'
): Promise<ExportDestinationResolution> {
  const trimmed = (savedFolder || '').trim();

  // If savedFolder is a valid absolute path, use it directly
  if (trimmed && isAbsolutePath(trimmed) && trimmed.toLowerCase() !== 'video') {
    return {
      absolutePath: trimmed,
      displayPath: trimmed,
      isCustom: true,
    };
  }

  // Query native Electron default export directory if available
  if (typeof window !== 'undefined' && (window as any).captionForgeAPI?.getDefaultExportPath) {
    try {
      const defaultFilePath = await (window as any).captionForgeAPI.getDefaultExportPath();
      if (defaultFilePath && isAbsolutePath(defaultFilePath)) {
        // Extract directory from sample file path
        const sep = defaultFilePath.includes('/') ? '/' : '\\';
        const parts = defaultFilePath.split(sep);
        parts.pop(); // remove sample filename
        const folder = parts.join(sep);
        if (folder) {
          return {
            absolutePath: folder,
            displayPath: folder,
            isCustom: false,
          };
        }
      }
    } catch {}
  }

  // Check Settings / LocalStorage
  if (typeof window !== 'undefined') {
    const lsDir = localStorage.getItem('cf_last_export_dir');
    if (lsDir && isAbsolutePath(lsDir) && lsDir.toLowerCase() !== 'video') {
      return {
        absolutePath: lsDir,
        displayPath: lsDir,
        isCustom: true,
      };
    }
  }

  // Sensible default fallback
  return {
    absolutePath: defaultVideosFallback,
    displayPath: defaultVideosFallback,
    isCustom: false,
  };
}

/**
 * Opens a real native directory selection dialog across runtimes.
 * 
 * 1. In Electron desktop runtime: invokes window.captionForgeAPI.selectFolderDialog
 * 2. In modern Web runtime: invokes window.showDirectoryPicker()
 * 
 * Returns the selected absolute path (or directory identifier), or null if cancelled.
 * Cancelling MUST NOT clear or alter existing settings.
 */
export async function pickExportDestinationFolder(
  currentFolder?: string
): Promise<string | null> {
  // 1. Electron Desktop Native Bridge
  if (typeof window !== 'undefined' && (window as any).captionForgeAPI?.selectFolderDialog) {
    try {
      const chosen = await (window as any).captionForgeAPI.selectFolderDialog({
        title: 'Select Destination Folder for Export',
        defaultPath: isAbsolutePath(currentFolder || '') ? currentFolder : undefined,
      });
      if (chosen && isAbsolutePath(chosen)) {
        localStorage.setItem('cf_last_export_dir', chosen);
        return chosen;
      }
      return null;
    } catch (err) {
      console.error('[destinationService] Native folder picker error:', err);
      return null;
    }
  }

  // 2. Modern Browser File System Access API
  if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
    try {
      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
      });
      if (handle && handle.name) {
        // Store directory handle reference if available
        (window as any).__cfExportDirectoryHandle = handle;
        const displayName = `Folder: ${handle.name}`;
        localStorage.setItem('cf_last_export_dir', displayName);
        return displayName;
      }
    } catch (err: any) {
      // User cancelled picker (AbortError) - return null cleanly
      if (err?.name === 'AbortError') return null;
      console.warn('[destinationService] File System Access picker error:', err);
    }
  }

  return null;
}

/**
 * Validates whether the destination directory exists and is writable before starting export.
 */
export async function validateExportDestination(folderPath: string): Promise<FolderValidationResult> {
  if (!folderPath || typeof folderPath !== 'string' || folderPath.trim() === '') {
    return {
      valid: false,
      errorCode: 'ERR_PATH_EMPTY',
      error: 'Export destination folder path cannot be empty.',
    };
  }

  const trimmed = folderPath.trim();

  // If running in browser with Directory Handle
  if (trimmed.startsWith('Folder:') && typeof window !== 'undefined' && (window as any).__cfExportDirectoryHandle) {
    return { valid: true, resolvedPath: trimmed };
  }

  // Ensure path is absolute
  if (!isAbsolutePath(trimmed)) {
    return {
      valid: false,
      errorCode: 'ERR_NOT_ABSOLUTE',
      error: `Destination path "${trimmed}" is not an absolute filesystem path. Please select a valid folder.`,
    };
  }

  // Native Electron validation via IPC
  if (typeof window !== 'undefined' && (window as any).captionForgeAPI?.validateExportFolder) {
    try {
      const res = await (window as any).captionForgeAPI.validateExportFolder(trimmed);
      if (!res.valid) {
        return {
          valid: false,
          errorCode: 'ERR_PERMISSION_DENIED',
          error: res.error || 'Destination folder is not accessible or not writable.',
        };
      }
      return { valid: true, resolvedPath: res.resolvedPath || trimmed };
    } catch (err: any) {
      return {
        valid: false,
        errorCode: 'ERR_PERMISSION_DENIED',
        error: err?.message || 'Folder verification failed.',
      };
    }
  }

  // In Web fallback without native IPC, treat absolute path as syntactically valid
  return { valid: true, resolvedPath: trimmed };
}
