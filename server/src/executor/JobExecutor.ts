import { IJobDocument } from '../models/Job';
import { ExecutionHistoryModel } from '../models/ExecutionHistory';
import { JobType, ExecutionStatus } from '../types';
import { httpExecutor, ExecutionResult } from './HttpExecutor';
import { scriptExecutor } from './ScriptExecutor';
import { alertService } from '../services/AlertService';
import { config } from '../config';
import logger from '../utils/logger';
import { DistributedLock } from '../utils/distributedLock';

export type ExecuteResult = 'executed' | 'already_running' | 'skipped';

export class JobExecutor {
  private pendingExecutions: Set<string> = new Set();

  isJobRunning(jobId: string): boolean {
    return this.pendingExecutions.has(jobId);
  }

  async execute(
    job: IJobDocument,
    triggeredBy: 'scheduler' | 'manual'
  ): Promise<ExecuteResult> {
    const jobId = job._id.toString();
    const executionId = `${jobId}-${Date.now()}`;

    if (this.pendingExecutions.has(jobId)) {
      logger.debug(`Job ${job.name} is already executing, skipping`);
      return 'already_running';
    }

    this.pendingExecutions.add(jobId);

    try {
      await this.executeWithRetry(job, triggeredBy, executionId);
      return 'executed';
    } finally {
      this.pendingExecutions.delete(jobId);
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
      nodeId: config.instanceId,
      triggeredBy,
    });

    let retryCount = 0;
    let lastResult: ExecutionResult | null = null;

    while (retryCount <= maxRetries) {
      const executionLock = new DistributedLock(`${job._id}:exec:${retryCount}`, 60000);
      const lockAcquired = await executionLock.acquire();

      if (!lockAcquired) {
        logger.debug(`Could not acquire execution lock for retry ${retryCount} of job ${job.name}`);
        return;
      }

      try {
        if (retryCount > 0) {
          logger.info(`Retrying job ${job.name} (attempt ${retryCount}/${maxRetries})`);
          history.status = ExecutionStatus.RETRYING;
          history.retryCount = retryCount;
          await history.save();
        }

        lastResult = await this.executeJob(job);

        if (lastResult.success) {
          history.endTime = new Date();
          history.duration = lastResult.duration;
          history.status = ExecutionStatus.SUCCESS;
          history.result = lastResult.result;
          await history.save();

          job.successCount++;
          await job.save();

          logger.info(`Job ${job.name} executed successfully in ${lastResult.duration}ms`);
          return;
        }

        if (retryCount === maxRetries) {
          break;
        }

        logger.warn(
          `Job ${job.name} failed (attempt ${retryCount + 1}/${maxRetries + 1}): ${lastResult.error}`
        );

        await this.sleep(retryInterval);
        retryCount++;
      } catch (error: any) {
        lastResult = {
          success: false,
          error: error.message || 'Unknown execution error',
          duration: Date.now() - startTime.getTime(),
        };

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

    history.endTime = new Date();
    history.duration = lastResult?.duration || Date.now() - startTime.getTime();
    history.status = ExecutionStatus.FINAL_FAILED;
    history.error = lastResult?.error || 'Max retries exceeded';
    history.retryCount = retryCount;
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
