import { JobModel, IJobDocument } from '../models/Job';
import { JobStatus, ScheduleType, ExecutionStatus } from '../types';
import { getNextExecutionTime, shouldExecuteJob } from '../utils/cronUtils';
import { DistributedLock } from '../utils/distributedLock';
import { JobExecutor } from '../executor/JobExecutor';
import { config } from '../config';
import logger from '../utils/logger';

export class JobScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private jobExecutor: JobExecutor;

  constructor() {
    this.jobExecutor = new JobExecutor();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('JobScheduler is already running');
      return;
    }

    logger.info(`Starting JobScheduler on instance ${config.instanceId}`);
    this.isRunning = true;

    await this.initializeJobs();

    this.intervalId = setInterval(() => {
      this.scheduleJobs().catch((error) => {
        logger.error('Error in scheduleJobs:', error);
      });
    }, config.scheduleInterval);

    logger.info('JobScheduler started successfully');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('JobScheduler is not running');
      return;
    }

    logger.info('Stopping JobScheduler...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    await this.jobExecutor.shutdown();
    logger.info('JobScheduler stopped');
  }

  private async initializeJobs(): Promise<void> {
    try {
      const jobs = await JobModel.find({ status: JobStatus.ENABLED });
      logger.info(`Initializing ${jobs.length} enabled jobs`);

      for (const job of jobs) {
        await this.updateNextExecutionTime(job);
      }
    } catch (error) {
      logger.error('Error initializing jobs:', error);
    }
  }

  async updateNextExecutionTime(job: IJobDocument): Promise<void> {
    const nextTime = getNextExecutionTime(
      job.scheduleType,
      job.cronExpression,
      job.executeAt,
      job.lastExecutionTime
    );

    if (nextTime) {
      job.nextExecutionTime = nextTime;
      await job.save();
      logger.debug(`Updated next execution time for job ${job.name}: ${nextTime.toISOString()}`);
    } else if (job.scheduleType === ScheduleType.ONCE && job.executeAt) {
      const executeAt = new Date(job.executeAt);
      if (executeAt < new Date() && job.totalExecutions > 0) {
        job.status = JobStatus.DISABLED;
        await job.save();
        logger.info(`Disabled one-time job ${job.name} that has already executed`);
      }
    }
  }

  private async scheduleJobs(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const now = new Date();
      const jobs = await JobModel.find({
        status: JobStatus.ENABLED,
        nextExecutionTime: { $lte: now },
      }).sort({ nextExecutionTime: 1 });

      if (jobs.length === 0) {
        return;
      }

      logger.debug(`Found ${jobs.length} jobs to schedule`);

      for (const job of jobs) {
        await this.processJob(job);
      }
    } catch (error) {
      logger.error('Error scheduling jobs:', error);
    }
  }

  private async processJob(job: IJobDocument): Promise<void> {
    const lock = new DistributedLock(job._id.toString(), config.lockTtl);
    let reloadedJob: IJobDocument | null = null;

    try {
      const acquired = await lock.acquire();
      if (!acquired) {
        logger.debug(`Could not acquire lock for job ${job.name}, skipping`);
        return;
      }

      reloadedJob = await JobModel.findById(job._id);
      if (!reloadedJob || reloadedJob.status !== JobStatus.ENABLED) {
        logger.info(`Job ${job.name} was disabled or deleted, skipping`);
        return;
      }

      const jobData = reloadedJob.toObject();
      if (!shouldExecuteJob({ ...jobData, _id: jobData._id.toString() })) {
        logger.debug(`Job ${job.name} should not execute yet, updating next time`);
        await this.updateNextExecutionTime(reloadedJob);
        return;
      }

      logger.info(`Executing job: ${reloadedJob.name} (${reloadedJob._id})`);

      const executionPromise = this.jobExecutor.execute(reloadedJob, 'scheduler');
      void executionPromise.catch((error) => {
        logger.error(`Error executing job ${reloadedJob!.name}:`, error);
      });

      reloadedJob.lastExecutionTime = new Date();
      reloadedJob.totalExecutions++;

      if (reloadedJob.scheduleType === ScheduleType.ONCE) {
        reloadedJob.nextExecutionTime = undefined;
        reloadedJob.status = JobStatus.DISABLED;
        logger.info(`One-time job ${reloadedJob.name} executed, disabling`);
      } else {
        await this.updateNextExecutionTime(reloadedJob);
      }

      await reloadedJob.save();
    } catch (error) {
      logger.error(`Error processing job ${reloadedJob?.name || job.name}:`, error);
    } finally {
      await lock.release();
    }
  }

  async triggerJobManually(jobId: string): Promise<boolean> {
    const job = await JobModel.findById(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    const lock = new DistributedLock(jobId, config.lockTtl);
    const acquired = await lock.acquire();

    if (!acquired) {
      logger.warn(`Could not acquire lock for manual trigger of job ${job.name}`);
      return false;
    }

    try {
      logger.info(`Manually triggering job: ${job.name}`);
      void this.jobExecutor.execute(job, 'manual').catch((error) => {
        logger.error(`Error in manual execution of job ${job.name}:`, error);
      });

      job.totalExecutions++;
      job.lastExecutionTime = new Date();
      await job.save();

      return true;
    } finally {
      await lock.release();
    }
  }

  getRunningStatus(): { isRunning: boolean; pendingJobs: number } {
    return {
      isRunning: this.isRunning,
      pendingJobs: this.jobExecutor.getPendingCount(),
    };
  }
}

export const jobScheduler = new JobScheduler();
