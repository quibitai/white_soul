/**
 * Cache performance monitoring utilities
 * Helps track cache hit rates and identify optimization opportunities
 */

interface CacheStats {
  hits: number;
  misses: number;
  errors: number;
  totalRequests: number;
  hitRate: number;
}

class CacheMonitor {
  private stats: Map<string, CacheStats> = new Map();

  /**
   * Record a cache hit
   * @param cacheType - Type of cache (e.g., 'chunks', 'renders')
   */
  recordHit(cacheType: string): void {
    const stats = this.getStats(cacheType);
    stats.hits++;
    stats.totalRequests++;
    stats.hitRate = (stats.hits / stats.totalRequests) * 100;
    this.stats.set(cacheType, stats);
  }

  /**
   * Record a cache miss
   * @param cacheType - Type of cache (e.g., 'chunks', 'renders')
   */
  recordMiss(cacheType: string): void {
    const stats = this.getStats(cacheType);
    stats.misses++;
    stats.totalRequests++;
    stats.hitRate = (stats.hits / stats.totalRequests) * 100;
    this.stats.set(cacheType, stats);
  }

  /**
   * Record a cache error
   * @param cacheType - Type of cache (e.g., 'chunks', 'renders')
   */
  recordError(cacheType: string): void {
    const stats = this.getStats(cacheType);
    stats.errors++;
    stats.totalRequests++;
    stats.hitRate = (stats.hits / stats.totalRequests) * 100;
    this.stats.set(cacheType, stats);
  }

  /**
   * Get current cache statistics
   * @param cacheType - Type of cache to get stats for
   * @returns Cache statistics
   */
  getStats(cacheType: string): CacheStats {
    if (!this.stats.has(cacheType)) {
      this.stats.set(cacheType, {
        hits: 0,
        misses: 0,
        errors: 0,
        totalRequests: 0,
        hitRate: 0,
      });
    }
    return { ...this.stats.get(cacheType)! };
  }

  /**
   * Log cache performance summary
   */
  logSummary(): void {
    console.log('📊 Cache Performance Summary:');
    for (const [cacheType, stats] of this.stats.entries()) {
      console.log(`  ${cacheType}:`);
      console.log(`    - Hit Rate: ${stats.hitRate.toFixed(1)}%`);
      console.log(`    - Hits: ${stats.hits}`);
      console.log(`    - Misses: ${stats.misses}`);
      console.log(`    - Errors: ${stats.errors}`);
      console.log(`    - Total: ${stats.totalRequests}`);
    }
  }

  /**
   * Reset all statistics
   */
  reset(): void {
    this.stats.clear();
  }
}

// Global cache monitor instance
export const cacheMonitor = new CacheMonitor();

/**
 * Helper function to log cache performance for a render
 * @param renderId - Render ID for context
 */
export function logCachePerformance(renderId: string): void {
  console.log(`📊 Cache Performance for render ${renderId}:`);
  cacheMonitor.logSummary();
}
