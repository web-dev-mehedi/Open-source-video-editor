import { BackgroundMattingConfig } from '../../types/matting';

const DB_NAME = 'CaptionForge_MatteCache';
const DB_VERSION = 1;
const STORE_NAME = 'mattes';
const MAX_MEMORY_ENTRIES = 120; // 120 frames in-memory hot cache (~4 seconds at 30fps)

export interface CachedMatteEntry {
  cacheKey: string;
  sourceMediaId: string;
  frameIndex: number;
  width: number;
  height: number;
  modelTier: string;
  alphaBuffer: Float32Array; // raw alpha channel [0..1]
  cachedAt: number;
}

export function computeMatteCacheKey(
  sourceMediaId: string,
  lastModified: number | string,
  width: number,
  height: number,
  frameIndex: number,
  config: BackgroundMattingConfig
): string {
  const normPath = String(sourceMediaId).toLowerCase().replace(/\\/g, '/');
  return [
    normPath,
    lastModified,
    `${width}x${height}`,
    frameIndex,
    config.modelTier,
    config.threshold,
    config.feather,
    config.maskExpansion,
    config.smoothness,
    config.edgeRefinement,
    config.hairDetail,
    config.foregroundProtection,
    config.backgroundSuppression,
  ].join('::');
}

class MatteCacheService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private memoryCache: Map<string, CachedMatteEntry> = new Map();

  constructor() {
    this.initDB();
  }

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB not supported in current environment'));
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'cacheKey' });
          store.createIndex('sourceMediaId', 'sourceMediaId', { unique: false });
          store.createIndex('cachedAt', 'cachedAt', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  private async initDB() {
    try {
      await this.getDB();
    } catch {}
  }

  /**
   * Fast 0ms synchronous in-memory lookup for instant playhead scrubbing
   */
  public getSync(cacheKey: string): CachedMatteEntry | undefined {
    const item = this.memoryCache.get(cacheKey);
    if (item) {
      // Refresh LRU position
      this.memoryCache.delete(cacheKey);
      this.memoryCache.set(cacheKey, item);
    }
    return item;
  }

  /**
   * Asynchronous persistent lookup in IndexedDB
   */
  public async get(cacheKey: string): Promise<CachedMatteEntry | null> {
    const syncHit = this.getSync(cacheKey);
    if (syncHit) return syncHit;

    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(cacheKey);
        req.onsuccess = () => {
          const res = req.result;
          if (res) {
            // Populate in-memory LRU
            this.setMemoryCache(cacheKey, res);
            resolve(res);
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

  /**
   * Stores a generated matte entry in both in-memory LRU and IndexedDB
   */
  public async set(entry: CachedMatteEntry): Promise<void> {
    this.setMemoryCache(entry.cacheKey, entry);

    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(entry);
    } catch {}
  }

  private setMemoryCache(key: string, entry: CachedMatteEntry) {
    if (this.memoryCache.size >= MAX_MEMORY_ENTRIES) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) this.memoryCache.delete(firstKey);
    }
    this.memoryCache.set(key, entry);
  }

  /**
   * Clear cache for a specific media item or all items
   */
  public async clearForMedia(sourceMediaId: string): Promise<void> {
    for (const [key, item] of this.memoryCache.entries()) {
      if (item.sourceMediaId === sourceMediaId) {
        this.memoryCache.delete(key);
      }
    }

    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('sourceMediaId');
      const req = index.getAllKeys(sourceMediaId);
      req.onsuccess = () => {
        for (const k of req.result) {
          store.delete(k);
        }
      };
    } catch {}
  }

  public async clearAll(): Promise<void> {
    this.memoryCache.clear();
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
    } catch {}
  }
}

export const matteCache = new MatteCacheService();
