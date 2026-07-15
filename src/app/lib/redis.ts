/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from 'redis';
import { envVars } from '../config/env.js';

// Parse the REDIS_URL to handle command wrapper e.g. "redis-cli -u redis://..."
let redisUrl = envVars.REDIS_URL;

// Remove any leading or trailing quotes
redisUrl = redisUrl.replace(/^["']|["']$/g, '').trim();

if (redisUrl.startsWith('redis-cli -u ')) {
  redisUrl = redisUrl.replace('redis-cli -u ', '').trim();
}

export const redisClient = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries) => {
      // Reconnect strategy: try every 2 seconds, up to 10 times, then stop trying for a bit
      if (retries > 10) {
        console.warn('Redis reconnection failed after 10 retries. Will try again in 30 seconds.');
        return 30000;
      }
      return 2000;
    }
  }
});

redisClient.on('error', (err) => {
  console.error('❌ Redis Connection Error:', err.message || err);
});

redisClient.on('connect', () => {
  console.log('⏳ Connecting to Redis...');
});

redisClient.on('ready', () => {
  console.log('✅ Redis Connected successfully!');
});

export const connectRedis = async (): Promise<void> => {
  try {
    await redisClient.connect();
    // Attempt to set eviction policy to noeviction to resolve BullMQ warning
    try {
      await redisClient.sendCommand(['CONFIG', 'SET', 'maxmemory-policy', 'noeviction']);
    } catch {
      // Fail silently if hosted Redis restricts CONFIG command
    }
  } catch (error: any) {
    console.error('❌ Could not connect to Redis:', error.message || error);
  }
};

// --- Cache Helpers ---

/**
 * Set a key-value pair in Redis
 * @param key Cache key
 * @param value Value (will be JSON serialized)
 * @param ttlSeconds Time to live in seconds (optional)
 */
export const redisSet = async (key: string, value: any, ttlSeconds?: number): Promise<void> => {
  try {
    const stringifiedValue = JSON.stringify(value);
    if (ttlSeconds) {
      await redisClient.set(key, stringifiedValue, {
        EX: ttlSeconds
      });
    } else {
      await redisClient.set(key, stringifiedValue);
    }
  } catch (error) {
    console.error(`Error setting key "${key}" in Redis:`, error);
  }
};

/**
 * Get a value from Redis
 * @param key Cache key
 * @returns Parsed JSON value or null
 */
export const redisGet = async <T = any>(key: string): Promise<T | null> => {
  try {
    const value = await redisClient.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch (error) {
    console.error(`Error getting key "${key}" from Redis:`, error);
    return null;
  }
};

/**
 * Delete a key from Redis
 * @param key Cache key
 */
export const redisDel = async (key: string): Promise<void> => {
  try {
    await redisClient.del(key);
  } catch (error) {
    console.error(`Error deleting key "${key}" from Redis:`, error);
  }
};

/**
 * Check if a key exists in Redis
 * @param key Cache key
 */
export const redisExists = async (key: string): Promise<boolean> => {
  try {
    const res = await redisClient.exists(key);
    return res === 1;
  } catch (error) {
    console.error(`Error checking existence of key "${key}" in Redis:`, error);
    return false;
  }
};
