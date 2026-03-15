import { redis } from '@/lib/redis/client';

/**
 * 🔒 withDistributedLock
 * A Senior-level wrapper to prevent race conditions across parallel serverless functions.
 */
export async function withDistributedLock<T>(
  sku: string,
  fn: () => Promise<T>,
  retries = 3,
  delay = 500 // ms
): Promise<T | { success: false; message: string }> {
  const lockKey = `lock:${sku}`;
  const ttl = 30; // 30 seconds (Auto-release if the server crashes)

  for (let attempt = 0; attempt <= retries; attempt++) {
    // 1. Try to set the lock ONLY if it doesn't exist (NX)
    const acquired = await redis.set(lockKey, 'locked', { nx: true, ex: ttl });

    if (acquired === 'OK') {
      try {
        // 2. We own the lock! Execute the logic.
        return await fn();
      } finally {
        // 3. Always release the lock when done
        await redis.del(lockKey);
      }
    }

    // 4. If we failed and have retries left, wait and try again
    if (attempt < retries) {
      console.log(`[Redis] Lock busy for ${sku}, retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // 5. Total Failure
  console.error(`🚩 [Redis] Could not acquire lock for SKU: ${sku} after ${retries} attempts.`);
  return { success: false, message: '🚨 System busy: Multiple updates detected for this SKU. Please try again in a moment.' };
}
