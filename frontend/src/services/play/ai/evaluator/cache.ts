/**
 * Cache des scores pour eviter les recalculs
 */

/**
 * Cache LRU simple pour les scores
 */
export class ScoreCache {
  private cache: Map<string, number>;
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Recupere un score du cache
   */
  get(key: string): number | undefined {
    const value = this.cache.get(key);

    if (value !== undefined) {
      // LRU: remettre en fin de Map
      this.cache.delete(key);
      this.cache.set(key, value);
    }

    return value;
  }

  /**
   * Ajoute un score au cache
   */
  set(key: string, value: number): void {
    // Si la cle existe deja, la supprimer d'abord (LRU)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Si le cache est plein, supprimer le plus ancien
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, value);
  }

  /**
   * Vide le cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Taille actuelle du cache
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Verifie si une cle existe
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }
}
