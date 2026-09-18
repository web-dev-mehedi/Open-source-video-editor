import { ProjectData, ProjectMetadata, VideoClip, AudioClip, MediaAsset } from '../../types/project';

const DB_NAME = 'CaptionForge_DB';
const DB_VERSION = 1;

export interface StoredAsset {
  blobKey: string; // `${projectId}_${assetId}`
  projectId: string;
  assetId: string;
  name: string;
  mimeType: string;
  size: number;
  blob: Blob;
  createdAt: number;
}

export interface StoredThumbnail {
  projectId: string;
  thumbnailDataUrl: string;
  updatedAt: number;
}

class StorageDB {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private activeBlobUrls = new Map<string, string>(); // blobKey -> objectUrl

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. Projects table
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }

        // 2. Offline Binary Assets table
        if (!db.objectStoreNames.contains('assets')) {
          const assetStore = db.createObjectStore('assets', { keyPath: 'blobKey' });
          assetStore.createIndex('projectId', 'projectId', { unique: false });
        }

        // 3. Thumbnails table
        if (!db.objectStoreNames.contains('thumbnails')) {
          db.createObjectStore('thumbnails', { keyPath: 'projectId' });
        }

        // 4. Lightweight Recent Projects Index
        if (!db.objectStoreNames.contains('recent_index')) {
          const indexStore = db.createObjectStore('recent_index', { keyPath: 'id' });
          indexStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('[StorageDB] Failed to open IndexedDB:', request.error);
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  /**
   * Saves a raw media Blob/File internally in IndexedDB.
   * Keyed by `${projectId}_${assetId}`.
   */
  public async saveAssetBlob(
    projectId: string,
    assetId: string,
    fileOrBlob: Blob | File,
    name?: string
  ): Promise<string> {
    const db = await this.getDB();
    const blobKey = `${projectId}_${assetId}`;
    const fileName = name || (fileOrBlob instanceof File ? fileOrBlob.name : 'media_asset');
    const mimeType = fileOrBlob.type || 'application/octet-stream';
    const size = fileOrBlob.size;

    const record: StoredAsset = {
      blobKey,
      projectId,
      assetId,
      name: fileName,
      mimeType,
      size,
      blob: fileOrBlob,
      createdAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction('assets', 'readwrite');
      const store = tx.objectStore('assets');
      const req = store.put(record);

      req.onsuccess = () => {
        // Cache created object URL for immediate high-speed access
        const url = URL.createObjectURL(fileOrBlob);
        this.activeBlobUrls.set(blobKey, url);
        resolve(blobKey);
      };

      req.onerror = () => {
        console.error(`[StorageDB] Failed to save asset blob ${blobKey}:`, req.error);
        reject(req.error);
      };
    });
  }

  /**
   * Retrieves stored raw Blob by blobKey.
   */
  public async getAssetBlob(blobKey: string): Promise<Blob | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('assets', 'readonly');
      const store = tx.objectStore('assets');
      const req = store.get(blobKey);

      req.onsuccess = () => {
        const res = req.result as StoredAsset | undefined;
        resolve(res ? res.blob : null);
      };

      req.onerror = () => {
        console.warn(`[StorageDB] Error fetching asset ${blobKey}:`, req.error);
        reject(req.error);
      };
    });
  }

  /**
   * Retrieves an active playable Object URL for a stored asset.
   * Reuses existing object URL if still active.
   */
  public async getAssetBlobUrl(blobKey: string): Promise<string | null> {
    if (this.activeBlobUrls.has(blobKey)) {
      return this.activeBlobUrls.get(blobKey)!;
    }

    const blob = await this.getAssetBlob(blobKey);
    if (!blob) return null;

    const url = URL.createObjectURL(blob);
    this.activeBlobUrls.set(blobKey, url);
    return url;
  }

  /**
   * Revokes all cached object URLs and drops the map without deleting stored
   * binaries. Call on project close so a later open in the same session mints
   * fresh URLs instead of reusing revoked ones.
   */
  public clearMemoryUrls(): void {
    for (const url of this.activeBlobUrls.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
    this.activeBlobUrls.clear();
  }

  /**
   * Saves or updates a project's full state and updates the recent projects index.
   */
  public async saveProjectState(project: ProjectData, thumbnailDataUrl?: string): Promise<void> {
    const db = await this.getDB();
    const projectId = project.metadata.id;
    const now = new Date().toISOString();

    const updatedMetadata: ProjectMetadata = {
      ...project.metadata,
      updatedAt: now,
      thumbnailPath: thumbnailDataUrl || project.metadata.thumbnailPath,
    };

    const projectRecord = {
      ...project,
      id: projectId,
      metadata: updatedMetadata,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['projects', 'recent_index', 'thumbnails'], 'readwrite');
      const projectStore = tx.objectStore('projects');
      const indexStore = tx.objectStore('recent_index');
      const thumbStore = tx.objectStore('thumbnails');

      projectStore.put(projectRecord);
      indexStore.put({
        ...updatedMetadata,
        id: projectId,
      });

      if (thumbnailDataUrl) {
        thumbStore.put({
          projectId,
          thumbnailDataUrl,
          updatedAt: Date.now(),
        });
      }

      tx.oncomplete = () => {
        resolve();
      };

      tx.onerror = () => {
        console.error(`[StorageDB] Error saving project ${projectId}:`, tx.error);
        reject(tx.error);
      };
    });
  }

  /**
   * Loads a full ProjectData record from IndexedDB.
   */
  public async getProjectState(projectId: string): Promise<ProjectData | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readonly');
      const store = tx.objectStore('projects');
      const req = store.get(projectId);

      req.onsuccess = () => {
        resolve((req.result as ProjectData) || null);
      };

      req.onerror = () => {
        console.error(`[StorageDB] Error fetching project ${projectId}:`, req.error);
        reject(req.error);
      };
    });
  }

  /**
   * Lists all recent projects sorted by updatedAt descending.
   */
  public async listRecentProjects(): Promise<ProjectMetadata[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('recent_index', 'readonly');
      const store = tx.objectStore('recent_index');
      const req = store.getAll();

      req.onsuccess = () => {
        const list = (req.result as ProjectMetadata[]) || [];
        list.sort((a, b) => {
          const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return bTime - aTime;
        });
        resolve(list);
      };

      req.onerror = () => {
        console.error('[StorageDB] Error listing recent projects:', req.error);
        reject(req.error);
      };
    });
  }

  /**
   * Cascading Project Deletion:
   * 1. Permanently deletes the project record from 'projects'.
   * 2. Purges all offline asset blobs belonging to this project from 'assets'.
   * 3. Deletes project thumbnail from 'thumbnails'.
   * 4. Deletes entry from 'recent_index'.
   * 5. Revokes all active in-memory blob URLs.
   */
  public async deleteProjectCompletely(projectId: string): Promise<void> {
    const db = await this.getDB();

    // 1. Revoke active URLs belonging to this project
    for (const [key, url] of this.activeBlobUrls.entries()) {
      if (key.startsWith(`${projectId}_`)) {
        try { URL.revokeObjectURL(url); } catch {}
        this.activeBlobUrls.delete(key);
      }
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['projects', 'assets', 'thumbnails', 'recent_index'], 'readwrite');
      const projectStore = tx.objectStore('projects');
      const assetStore = tx.objectStore('assets');
      const thumbStore = tx.objectStore('thumbnails');
      const indexStore = tx.objectStore('recent_index');

      // Delete project record & index & thumbnail
      projectStore.delete(projectId);
      thumbStore.delete(projectId);
      indexStore.delete(projectId);

      // Purge all assets keyed by projectId
      const assetIndex = assetStore.index('projectId');
      const cursorReq = assetIndex.openCursor(IDBKeyRange.only(projectId));

      cursorReq.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => {
        resolve();
      };

      tx.onerror = () => {
        console.error(`[StorageDB] Error deleting project ${projectId}:`, tx.error);
        reject(tx.error);
      };
    });
  }

  /**
   * Duplicates a project state and clones all offline internal asset blobs.
   */
  public async duplicateProjectState(
    sourceProjectId: string,
    newProjectId: string,
    newName: string
  ): Promise<ProjectData | null> {
    const sourceProject = await this.getProjectState(sourceProjectId);
    if (!sourceProject) return null;

    const db = await this.getDB();
    const now = new Date().toISOString();

    // 1. Clone Assets
    const clonedAssetsPromise = new Promise<void>((resolve, reject) => {
      const tx = db.transaction('assets', 'readwrite');
      const assetStore = tx.objectStore('assets');
      const assetIndex = assetStore.index('projectId');
      const cursorReq = assetIndex.openCursor(IDBKeyRange.only(sourceProjectId));

      cursorReq.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const item = cursor.value as StoredAsset;
          const clonedRecord: StoredAsset = {
            ...item,
            projectId: newProjectId,
            blobKey: `${newProjectId}_${item.assetId}`,
            createdAt: Date.now(),
          };
          assetStore.put(clonedRecord);
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    await clonedAssetsPromise;

    // 2. Clone Project Object
    const duplicated: ProjectData = {
      ...JSON.parse(JSON.stringify(sourceProject)),
      id: newProjectId,
      metadata: {
        ...sourceProject.metadata,
        id: newProjectId,
        name: newName,
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: now,
      },
    };

    await this.saveProjectState(duplicated, duplicated.metadata.thumbnailPath);
    return duplicated;
  }
}

export const dbService = new StorageDB();
