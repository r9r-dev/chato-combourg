/**
 * Model Storage Service
 *
 * Handles storing and retrieving the ONNX model in IndexedDB for offline inference.
 */

const DB_NAME = 'chato-offline';
const DB_VERSION = 1;
const STORE_NAME = 'models';
const MODEL_KEY = 'yolo-model';

interface StoredModel {
  key: string;
  version: string;
  variant: string;
  sha256: string;
  data: ArrayBuffer;
  storedAt: string;
}

class ModelStorage {
  private db: IDBDatabase | null = null;

  /**
   * Open the IndexedDB database
   */
  private async openDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Check if a model is stored locally
   */
  async hasModel(): Promise<boolean> {
    try {
      const model = await this.getModelInfo();
      return model !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get info about the stored model (without loading the data)
   */
  async getModelInfo(): Promise<{ version: string; variant: string; sha256: string; storedAt: string } | null> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(MODEL_KEY);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const result = request.result as StoredModel | undefined;
          if (result) {
            resolve({
              version: result.version,
              variant: result.variant || 'fp16', // Default for old stored models
              sha256: result.sha256,
              storedAt: result.storedAt,
            });
          } else {
            resolve(null);
          }
        };
      });
    } catch {
      return null;
    }
  }

  /**
   * Load the model data from storage
   */
  async loadModel(): Promise<ArrayBuffer | null> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(MODEL_KEY);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const result = request.result as StoredModel | undefined;
          resolve(result?.data ?? null);
        };
      });
    } catch {
      return null;
    }
  }

  /**
   * Save the model to storage
   */
  async saveModel(data: ArrayBuffer, version: string, variant: string, sha256: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const model: StoredModel = {
        key: MODEL_KEY,
        version,
        variant,
        sha256,
        data,
        storedAt: new Date().toISOString(),
      };

      const request = store.put(model);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Delete the stored model
   */
  async deleteModel(): Promise<void> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(MODEL_KEY);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    } catch {
      // Ignore errors on delete
    }
  }

  /**
   * Check if the stored model matches the expected version
   */
  async isModelUpToDate(expectedSha256: string): Promise<boolean> {
    const info = await this.getModelInfo();
    return info?.sha256 === expectedSha256;
  }

  /**
   * Get approximate storage usage
   */
  async getStorageUsage(): Promise<{ used: number; available: number } | null> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage ?? 0,
        available: estimate.quota ?? 0,
      };
    }
    return null;
  }
}

export const modelStorage = new ModelStorage();
