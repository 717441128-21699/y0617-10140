import { getRedisClient } from '../db/redis';
import { config } from '../config';
import logger from './logger';
import { v4 as uuidv4 } from 'uuid';

const LOCK_PREFIX = 'job:lock:';
const UNLOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

export interface Lock {
  key: string;
  value: string;
  acquired: boolean;
}

export class DistributedLock {
  private lockKey: string;
  private lockValue: string;
  private ttl: number;
  private locked: boolean = false;

  constructor(jobId: string, ttl?: number) {
    this.lockKey = `${LOCK_PREFIX}${jobId}`;
    this.lockValue = uuidv4();
    this.ttl = ttl || config.lockTtl;
  }

  async acquire(): Promise<boolean> {
    const redis = getRedisClient();
    try {
      const result = await redis.set(
        this.lockKey,
        this.lockValue,
        'PX',
        this.ttl,
        'NX'
      );
      this.locked = result === 'OK';
      if (this.locked) {
        logger.debug(`Lock acquired for job: ${this.lockKey}`);
      } else {
        logger.debug(`Lock already held for job: ${this.lockKey}`);
      }
      return this.locked;
    } catch (error) {
      logger.error(`Failed to acquire lock for job ${this.lockKey}:`, error);
      return false;
    }
  }

  async release(): Promise<boolean> {
    if (!this.locked) {
      return true;
    }
    const redis = getRedisClient();
    try {
      const result = await redis.eval(UNLOCK_SCRIPT, 1, this.lockKey, this.lockValue);
      const released = result === 1;
      if (released) {
        logger.debug(`Lock released for job: ${this.lockKey}`);
        this.locked = false;
      }
      return released;
    } catch (error) {
      logger.error(`Failed to release lock for job ${this.lockKey}:`, error);
      return false;
    }
  }

  async extend(additionalTtl?: number): Promise<boolean> {
    if (!this.locked) {
      return false;
    }
    const redis = getRedisClient();
    const newTtl = additionalTtl || this.ttl;
    try {
      const currentValue = await redis.get(this.lockKey);
      if (currentValue !== this.lockValue) {
        logger.warn(`Lock expired or stolen for job: ${this.lockKey}`);
        this.locked = false;
        return false;
      }
      const result = await redis.pexpire(this.lockKey, newTtl);
      if (result === 1) {
        logger.debug(`Lock extended for job: ${this.lockKey}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Failed to extend lock for job ${this.lockKey}:`, error);
      return false;
    }
  }

  isLocked(): boolean {
    return this.locked;
  }

  async isLockedBySomeoneElse(): Promise<boolean> {
    const redis = getRedisClient();
    try {
      const currentValue = await redis.get(this.lockKey);
      return currentValue !== null && currentValue !== this.lockValue;
    } catch (error) {
      logger.error(`Failed to check lock status for job ${this.lockKey}:`, error);
      return false;
    }
  }
}

export async function tryWithLock<T>(
  jobId: string,
  fn: () => Promise<T>,
  ttl?: number
): Promise<T | null> {
  const lock = new DistributedLock(jobId, ttl);
  const acquired = await lock.acquire();
  if (!acquired) {
    return null;
  }
  try {
    return await fn();
  } finally {
    await lock.release();
  }
}
