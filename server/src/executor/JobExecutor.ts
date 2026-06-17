import { IJobDocument } from '../models/Job';
import { ExecutionHistoryModel } from '../models/ExecutionHistory';
import { JobType, ExecutionStatus, RetryDetail, RunningJobInfo } from '../types';
import { httpExecutor, ExecutionResult } from './HttpExecutor';
import { scriptExecutor } from './ScriptExecutor';
import { alertService } from '../services/AlertService';
import { config } from '../config';
import logger from '../utils/logger';
import { DistributedLock } from '../utils/distributedLock';
import { getRedisClient } from '../db/redis';

export type ExecuteResult = 'executed' | 'already_running' | 'skipped';

const EXECUTING_KEY_PREFIX = 'job:executing:';
const EXECUTING_KEY_TTL = 3600;

export class JobExecutor {
  private pendingExecutions: Set<string> = new Set();

  async getRunningJobInfo(jobId: string): Promise<RunningJobInfo | null> {
    if (this.pendingExecutions.has(jobId)) {
      try {
        const redis = getRedisClient();
        const result = await redis.get(`${EXECUTING_KEY_PREFIX}${jobId}`);
        if (result) {
          return JSON.parse(result) as RunningJobInfo;
        }
      } catch (error) {
        logger.warn('Failed to get running job info from Redis:', error);
      }
    }
    try {
      const redis = getRedisClient();
      const result = await redis.get(`${EXECUTING_KEY_PREFIX}${jobId}`);
      return result ? (JSON.parse(result) as RunningJobInfo) : null;
    } catch (error) {
      logger.warn('Failed to get running job info from Redis:', error);
      return null;
    }
  }

  async isJobRunning(jobId: string): Promise<boolean> {
    const info = await this.getRunningJobInfo(jobId);
    return info !== null;
  }

  private async setJobRunning(info: RunningJobInfo): Promise<boolean> {
    try {
      const redis = getRedisClient();
      const result = await redis.set(
        `${EXECUTING_KEY_PREFIX}${info.jobId}`,
        JSON.stringify(info),
        'EX',
        EXECUTING_KEY_TTL,
        'NX'
      );
      return result === 'OK';
    } catch (error) {
      logger.warn('Failed to set job running status in Redis:', error);
      return true;
    }
  }

  private async clearJobRunning(jobId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.del(`${EXECUTING_KEY_PREFIX}${jobId}`);
    } catch (error) {
      logger.warn('Failed to clear job running status from Redis:', error);
    }
  }

  async getAllRunningJobs(): Promise<RunningJobInfo[]> {
    try {
      const redis = getRedisClient();
      const keys = await redis.keys(`${EXECUTING_KEY_PREFIX}*`);
      const jobs: RunningJobInfo[] = [];
      for (const key of keys) {
        const value = await redis.get(key);
        if (value) {
          jobs.push(JSON.parse(value) as RunningJobInfo);
        }
      }
      return jobs;
    } catch (error) {
      logger.warn('Failed to get all running jobs from Redis:', error);
      return [];
    }
  }

  async execute(
    job: IJobDocument,
    triggeredBy: 'scheduler' | 'manual'
  ): Promise<ExecuteResult> {
    const jobId = job._id.toString();
    const executionId = `${jobId}-${Date.now()}`;

    if (this.pendingExecutions.has(jobId)) {
      logger.debug(`Job ${job.name} is already executing locally, skipping`);
      return 'already_running';
    }

    const runningInfo: RunningJobInfo = {
      jobId,
      nodeId: config.instanceId,
      startTime: Date.now(),
      triggeredBy,
      executionId,
    };

    const acquired = await this.setJobRunning(runningInfo);
    if (!acquired) {
      logger.debug(`Job ${job.name} is already executing on another node, skipping`);
      return 'already_running';
    }

    this.pendingExecutions.add(jobId);

    try {
      await this.executeWithRetry(job, triggeredBy, executionId);
      return 'executed';
    } finally {
      this.pendingExecutions.delete(jobId);
      await this.clearJobRunning(jobId);
    }
  }

  private async executeWithRetry(
    job: IJobDocument,
    triggeredBy: 'scheduler' | 'manual',
    executionId: string
  ): Promise<void> {
    const startTime = new Date();
    const maxRetries = job.retryConfig.maxRetries;
    const retryInterval = job.retryConfig.retryInterval;

    const history = await ExecutionHistoryModel.create({
      jobId: job._id,
      jobName: job.name,
      type: job.type,
      startTime,
      status: ExecutionStatus.PENDING,
      retryCount: 0,
      maxRetries,
      retryDetails: [],
      nodeId: config.instanceId,
      triggeredBy,
    });

    let retryCount = 0;
    let lastResult: ExecutionResult | null = null;
    const retryDetails: RetryDetail[] = [];

    while (retryCount <= maxRetries) {
      const attemptStartTime = new Date();
      const executionLock = new DistributedLock(`${job._id}:exec:${retryCount}`, 60000);
      const lockAcquired = await executionLock.acquire();

      if (!lockAcquired) {
        logger.debug(`Could not acquire execution lock for retry ${retryCount} of job ${job.name}`);
        return;
      }

      let attemptResult: ExecutionResult;

      try {
        if (retryCount > 0) {
          logger.info(`Retrying job ${job.name} (attempt ${retryCount}/${maxRetries})`);
          history.status = ExecutionStatus.RETRYING;
          history.retryCount = retryCount;
          await history.save();
        }

        lastResult = await this.executeJob(job);
        attemptResult = lastResult;

        const attemptEndTime = new Date();
        const attemptDuration = attemptResult.duration || (attemptEndTime.getTime() - attemptStartTime.getTime());

        if (attemptResult.success) {
          const detail: RetryDetail = {
            attempt: retryCount,
            startTime: attemptStartTime,
            endTime: attemptEndTime,
            duration: attemptDuration,
            status: ExecutionStatus.SUCCESS,
            result: attemptResult.result,
          };
          retryDetails.push(detail);

          history.endTime = attemptEndTime;
          history.duration = attemptEndTime.getTime() - startTime.getTime();
          history.status = ExecutionStatus.SUCCESS;
          history.result = attemptResult.result;
          history.retryDetails = retryDetails;
          history.retryCount = retryCount;
          await history.save();

          job.successCount++;
          await job.save();

          logger.info(`Job ${job.name} executed successfully in ${attemptDuration}ms`);
          return;
        }

        const detail: RetryDetail = {
          attempt: retryCount,
          startTime: attemptStartTime,
          endTime: attemptEndTime,
          duration: attemptDuration,
          status: ExecutionStatus.FAILED,
          result: attemptResult.result,
          error: attemptResult.error,
        };
        retryDetails.push(detail);
        history.retryDetails = retryDetails;
        await history.save();

        if (retryCount === maxRetries) {
          break;
        }

        logger.warn(
          `Job ${job.name} failed (attempt ${retryCount + 1}/${maxRetries + 1}): ${attemptResult.error}`
        );

        await this.sleep(retryInterval);
        retryCount++;
      } catch (error: any) {
        const attemptEndTime = new Date();
        const attemptDuration = attemptEndTime.getTime() - attemptStartTime.getTime();

        lastResult = {
          success: false,
          error: error.message || 'Unknown execution error',
          duration: attemptDuration,
        };

        const detail: RetryDetail = {
          attempt: retryCount,
          startTime: attemptStartTime,
          endTime: attemptEndTime,
          duration: attemptDuration,
          status: ExecutionStatus.FAILED,
          error: error.message || 'Unknown execution error',
        };
        retryDetails.push(detail);
        history.retryDetails = retryDetails;
        await history.save();

        if (retryCount === maxRetries) {
          break;
        }

        logger.error(
          `Error executing job ${job.name} (attempt ${retryCount + 1}/${maxRetries + 1}):`,
          error
        );
        await this.sleep(retryInterval);
        retryCount++;
      } finally {
        await executionLock.release();
      }
    }

    const endTime = new Date();
    history.endTime = endTime;
    history.duration = endTime.getTime() - startTime.getTime();
    history.status = ExecutionStatus.FINAL_FAILED;
    history.error = lastResult?.error || 'Max retries exceeded';
    history.result = lastResult?.result || undefined;
    history.retryCount = retryCount;
    history.retryDetails = retryDetails;
    await history.save();

    job.failedCount++;
    await job.save();

    logger.error(
      `Job ${job.name} failed after ${retryCount + 1} attempts: ${lastResult?.error}`
    );

    await alertService.sendAlert(job, history, lastResult?.error || 'Unknown error');
  }

  private async executeJob(job: IJobDocument): Promise<ExecutionResult> {
    switch (job.type) {
      case JobType.HTTP:
        if (!job.httpConfig) {
          return {
            success: false,
            error: 'HTTP job config is missing',
            duration: 0,
          };
        }
        return httpExecutor.execute(job.httpConfig);

      case JobType.SCRIPT:
        if (!job.scriptConfig) {
          return {
            success: false,
            error: 'Script job config is missing',
            duration: 0,
          };
        }
        return scriptExecutor.execute(job.scriptConfig);

      default:
        return {
          success: false,
          error: `Unknown job type: ${job.type}`,
          duration: 0,
        };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getPendingCount(): number {
    return this.pendingExecutions.size;
  }

  async shutdown(): Promise<void> {
    const timeout = 30000;
    const startTime = Date.now();

    while (this.pendingExecutions.size > 0) {
      if (Date.now() - startTime > timeout) {
        logger.warn(
          `Timeout waiting for ${this.pendingExecutions.size} jobs to complete during shutdown`
        );
        break;
      }
      await this.sleep(100);
    }

    logger.info('JobExecutor shutdown complete');
  }
}

export const jobExecutor = new JobExecutor();
