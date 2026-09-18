const DB_NAME = 'CaptionForge_AssetDB';
const DB_VERSION = 1;
const STORE_NAME = 'media_assets';

interface StoredAssetRecord {
  assetId: string;
  projectId?: string;
  name: string;
  mimeType: string;
  size: number;
  blob: Blob;
  updatedAt: number;
}

class AssetStoreService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private activeUrlCache = new Map<string, string>(); // assetId -> objectUrl

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'assetId' });
          store.createIndex('projectId', 'projectId', { unique: false });
          store.createIndex('name', 'name', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('[AssetStore] Failed to open Asset IndexedDB:', request.error);
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  /**
   * Save raw binary File or Blob with stable assetId
   */
  public async storeMediaBlob(
    assetId: string,
    fileOrBlob: Blob | File,
    name?: string,
    projectId?: string
  ): Promise<string> {
    const db = await this.getDB();
    const fileName = name || (fileOrBlob instanceof File ? fileOrBlob.name : 'media_asset');
    const mimeType = fileOrBlob.type || 'application/octet-stream';
    const size = fileOrBlob.size;

    const record: StoredAssetRecord = {
      assetId,
      projectId,
      name: fileName,
      mimeType,
      size,
      blob: fileOrBlob,
      updatedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);

      req.onsuccess = () => {
        // Create or update runtime working URL
        try {
          if (this.activeUrlCache.has(assetId)) {
            const old = this.activeUrlCache.get(assetId);
            if (old) URL.revokeObjectURL(old);
          }
        } catch {}

        const newUrl = URL.createObjectURL(fileOrBlob);
        this.activeUrlCache.set(assetId, newUrl);
        resolve(newUrl);
      };

      req.onerror = () => {
        console.error(`[AssetStore] Error storing blob for assetId ${assetId}:`, req.error);
        reject(req.error);
      };
    });
  }

  /**
   * Retrieve raw binary Blob by assetId
   */
  public async getMediaBlob(assetId: string): Promise<Blob | null> {
    if (!assetId) return null;
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(assetId);

      req.onsuccess = () => {
        const res = req.result as StoredAssetRecord | undefined;
        resolve(res ? res.blob : null);
      };

      req.onerror = () => {
        console.warn(`[AssetStore] Error retrieving assetId ${assetId}:`, req.error);
        reject(req.error);
      };
    });
  }

  /**
   * Checks if an asset exists in persistent storage
   */
  public async hasMediaBlob(assetId: string): Promise<boolean> {
    if (!assetId) return false;
    const db = await this.getDB();

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.count(IDBKeyRange.only(assetId));

      req.onsuccess = () => {
        resolve((req.result || 0) > 0);
      };

      req.onerror = () => {
        resolve(false);
      };
    });
  }

  /**
   * Generates a fresh, working Object URL for an asset
   */
  public async getMediaBlobUrl(assetId: string): Promise<string | null> {
    if (!assetId) return null;

    // Check in-memory cache first
    if (this.activeUrlCache.has(assetId)) {
      return this.activeUrlCache.get(assetId)!;
    }

    const blob = await this.getMediaBlob(assetId);
    if (!blob) return null;

    const freshUrl = URL.createObjectURL(blob);
    this.activeUrlCache.set(assetId, freshUrl);
    return freshUrl;
  }

  /**
   * Revokes all in-memory object URLs and drops the cache without deleting
   * any persisted binaries. Must be called when a project is closed: the
   * previously handed-out `blob:` URLs die with the session, and returning
   * those same revoked strings on the next open is the black-screen cause.
   * Binaries stay in IndexedDB, so the next open mints fresh URLs.
   */
  public clearMemoryUrls(): void {
    for (const url of this.activeUrlCache.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
    this.activeUrlCache.clear();
  }

  /**
   * Delete media blob on project purge or asset removal
   */
  public async deleteMediaBlob(assetId: string): Promise<void> {
    if (!assetId) return;
    const db = await this.getDB();

    if (this.activeUrlCache.has(assetId)) {
      try {
        URL.revokeObjectURL(this.activeUrlCache.get(assetId)!);
      } catch {}
      this.activeUrlCache.delete(assetId);
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(assetId);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Delete all assets belonging to a specific project
   */
  public async deleteProjectAssets(projectId: string): Promise<void> {
    if (!projectId) return;
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('projectId');
      const cursorReq = index.openCursor(IDBKeyRange.only(projectId));

      cursorReq.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const item = cursor.value as StoredAssetRecord;
          if (this.activeUrlCache.has(item.assetId)) {
            try {
              URL.revokeObjectURL(this.activeUrlCache.get(item.assetId)!);
            } catch {}
            this.activeUrlCache.delete(item.assetId);
          }
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const assetStore = new AssetStoreService();

// Standalone function exports for easy modular imports
export const storeMediaBlob = (assetId: string, blob: Blob | File, name?: string, projectId?: string) =>
  assetStore.storeMediaBlob(assetId, blob, name, projectId);

export const getMediaBlob = (assetId: string) =>
  assetStore.getMediaBlob(assetId);

export const getMediaBlobUrl = (assetId: string) =>
  assetStore.getMediaBlobUrl(assetId);

export const deleteMediaBlob = (assetId: string) =>
  assetStore.deleteMediaBlob(assetId);

export const clearMemoryUrls = () =>
  assetStore.clearMemoryUrls();

export const hasMediaBlob = (assetId: string) =>
  assetStore.hasMediaBlob(assetId);
