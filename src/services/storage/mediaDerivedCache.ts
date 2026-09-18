/**
 * Media Derived Cache Service (src/services/storage/mediaDerivedCache.ts)
 * 
 * Persistent IndexedDB and high-speed in-memory LRU cache for derived media artifacts:
 * - Metadata (duration, resolution, fps, codecs)
 * - Thumbnails (Base64 / WebP Data URLs)
 * - Audio Waveform Peaks (float arrays)
 * - Preview Proxies
 * 
 * Keyed by stable deterministic fingerprint: `${filePath}_${fileSize}_${lastModified}`
 * Preserves original source media untouched while accelerating subsequent imports,
 * project loads, media library scrolling, and timeline renders.
 */

const DB_NAME = 'CaptionForge_DerivedCache';
const DB_VERSION = 1;
const STORE_THUMBNAILS = 'thumbnails';
const STORE_WAVEFORMS = 'waveforms';
const STORE_METADATA = 'metadata';
const STORE_PROXIES = 'proxies';

export interface CachedMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
  aspectRatio: string;
  codecName?: string;
  hasAudio?: boolean;
  sampleRate?: number;
  channels?: number;
  cachedAt: number;
}

export interface CachedThumbnail {
  dataUrl: string;
  width?: number;
  height?: number;
  cachedAt: number;
}

export interface CachedWaveform {
  peaks: number[];
  duration: number;
  sampleRate?: number;
  cachedAt: number;
}

export interface CachedProxy {
  proxyPath: string;
  generatedAt: number;
}

export function computeMediaFingerprint(
  filePathOrName: string,
  fileSize?: number,
  lastModified?: number
): string {
  const cleanPath = filePathOrName.replace(/\\/g, '/').toLowerCase();
  const size = fileSize !== undefined && fileSize > 0 ? fileSize : '0';
  const lm = lastModified !== undefined && lastModified > 0 ? lastModified : '0';
  return `${cleanPath}::${size}::${lm}`;
}

class MediaDerivedCacheService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  
  // In-memory hot LRU caches for 0ms synchronous access
  private memoryThumbnails = new Map<string, string>();
  private memoryWaveforms = new Map<string, number[]>();
  private memoryMetadata = new Map<string, CachedMetadata>();
  private maxMemoryEntries = 500;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        // Fallback for non-browser/test environments
        reject(new Error('IndexedDB not supported in current environment'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_THUMBNAILS)) {
          db.createObjectStore(STORE_THUMBNAILS, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_WAVEFORMS)) {
          db.createObjectStore(STORE_WAVEFORMS, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_METADATA)) {
          db.createObjectStore(STORE_METADATA, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_PROXIES)) {
          db.createObjectStore(STORE_PROXIES, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.warn('[MediaDerivedCache] IndexedDB open error, using in-memory only:', request.error);
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  // ========================================================
  // 1. THUMBNAIL CACHE
  // ========================================================

  public getThumbnailSync(fingerprint: string): string | null {
    return this.memoryThumbnails.get(fingerprint) || null;
  }

  public async getThumbnail(fingerprint: string): Promise<string | null> {
    const memoryHit = this.memoryThumbnails.get(fingerprint);
    if (memoryHit) return memoryHit;

    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_THUMBNAILS, 'readonly');
        const store = tx.objectStore(STORE_THUMBNAILS);
        const req = store.get(fingerprint);
        req.onsuccess = () => {
          if (req.result && req.result.dataUrl) {
            this.setMemoryThumbnail(fingerprint, req.result.dataUrl);
            resolve(req.result.dataUrl);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  public async setThumbnail(fingerprint: string, dataUrl: string): Promise<void> {
    if (!fingerprint || !dataUrl) return;
    this.setMemoryThumbnail(fingerprint, dataUrl);

    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_THUMBNAILS, 'readwrite');
      const store = tx.objectStore(STORE_THUMBNAILS);
      store.put({
        key: fingerprint,
        dataUrl,
        cachedAt: Date.now(),
      });
    } catch (e) {
      // Non-fatal
    }
  }

  private setMemoryThumbnail(key: string, dataUrl: string) {
    if (this.memoryThumbnails.size >= this.maxMemoryEntries) {
      const firstKey = this.memoryThumbnails.keys().next().value;
      if (firstKey) this.memoryThumbnails.delete(firstKey);
    }
    this.memoryThumbnails.set(key, dataUrl);
  }

  // ========================================================
  // 2. WAVEFORM CACHE
  // ========================================================

  public getWaveformSync(fingerprint: string): number[] | null {
    return this.memoryWaveforms.get(fingerprint) || null;
  }

  public async getWaveform(fingerprint: string): Promise<number[] | null> {
    const memoryHit = this.memoryWaveforms.get(fingerprint);
    if (memoryHit) return memoryHit;

    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_WAVEFORMS, 'readonly');
        const store = tx.objectStore(STORE_WAVEFORMS);
        const req = store.get(fingerprint);
        req.onsuccess = () => {
          if (req.result && req.result.peaks) {
            this.setMemoryWaveform(fingerprint, req.result.peaks);
            resolve(req.result.peaks);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  public async setWaveform(fingerprint: string, peaks: number[], duration = 0): Promise<void> {
    if (!fingerprint || !peaks || peaks.length === 0) return;
    this.setMemoryWaveform(fingerprint, peaks);

    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_WAVEFORMS, 'readwrite');
      const store = tx.objectStore(STORE_WAVEFORMS);
      store.put({
        key: fingerprint,
        peaks,
        duration,
        cachedAt: Date.now(),
      });
    } catch (e) {
      // Non-fatal
    }
  }

  private setMemoryWaveform(key: string, peaks: number[]) {
    if (this.memoryWaveforms.size >= this.maxMemoryEntries) {
      const firstKey = this.memoryWaveforms.keys().next().value;
      if (firstKey) this.memoryWaveforms.delete(firstKey);
    }
    this.memoryWaveforms.set(key, peaks);
  }

  // ========================================================
  // 3. METADATA CACHE
  // ========================================================

  public getMetadataSync(fingerprint: string): CachedMetadata | null {
    return this.memoryMetadata.get(fingerprint) || null;
  }

  public async getMetadata(fingerprint: string): Promise<CachedMetadata | null> {
    const memoryHit = this.memoryMetadata.get(fingerprint);
    if (memoryHit) return memoryHit;

    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_METADATA, 'readonly');
        const store = tx.objectStore(STORE_METADATA);
        const req = store.get(fingerprint);
        req.onsuccess = () => {
          if (req.result && req.result.metadata) {
            this.setMemoryMetadata(fingerprint, req.result.metadata);
            resolve(req.result.metadata);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  public async setMetadata(fingerprint: string, metadata: CachedMetadata): Promise<void> {
    if (!fingerprint || !metadata) return;
    this.setMemoryMetadata(fingerprint, metadata);

    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_METADATA, 'readwrite');
      const store = tx.objectStore(STORE_METADATA);
      store.put({
        key: fingerprint,
        metadata,
        cachedAt: Date.now(),
      });
    } catch (e) {
      // Non-fatal
    }
  }

  private setMemoryMetadata(key: string, metadata: CachedMetadata) {
    if (this.memoryMetadata.size >= this.maxMemoryEntries) {
      const firstKey = this.memoryMetadata.keys().next().value;
      if (firstKey) this.memoryMetadata.delete(firstKey);
    }
    this.memoryMetadata.set(key, metadata);
  }

  // ========================================================
  // 4. COMBINED DERIVED ASSET CHECK
  // ========================================================

  public async getDerivedAsset(fingerprint: string): Promise<{
    metadata: CachedMetadata | null;
    thumbnailUrl: string | null;
    waveformPeaks: number[] | null;
  }> {
    const [metadata, thumbnailUrl, waveformPeaks] = await Promise.all([
      this.getMetadata(fingerprint),
      this.getThumbnail(fingerprint),
      this.getWaveform(fingerprint),
    ]);
    return { metadata, thumbnailUrl, waveformPeaks };
  }

  /**
   * Clear all derived caches (for maintenance or reset)
   */
  public async clearCache(): Promise<void> {
    this.memoryThumbnails.clear();
    this.memoryWaveforms.clear();
    this.memoryMetadata.clear();
    try {
      const db = await this.getDB();
      const tx = db.transaction([STORE_THUMBNAILS, STORE_WAVEFORMS, STORE_METADATA, STORE_PROXIES], 'readwrite');
      tx.objectStore(STORE_THUMBNAILS).clear();
      tx.objectStore(STORE_WAVEFORMS).clear();
      tx.objectStore(STORE_METADATA).clear();
      tx.objectStore(STORE_PROXIES).clear();
    } catch {}
  }
}

export const mediaDerivedCache = new MediaDerivedCacheService();
