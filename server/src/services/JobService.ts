import { JobModel, IJobDocument } from '../models/Job';
import { ExecutionHistoryModel } from '../models/ExecutionHistory';
import {
  Job,
  JobStatus,
  JobType,
  ScheduleType,
  ExecutionStatus,
} from '../types';
import { isValidCronExpression, getNextExecutionTime } from '../utils/cronUtils';
import { jobScheduler } from '../scheduler/JobScheduler';
import logger from '../utils/logger';

export interface CreateJobRequest {
  name: string;
  description?: string;
  type: JobType;
  scheduleType: ScheduleType;
  cronExpression?: string;
  executeAt?: Date;
  httpConfig?: Job['httpConfig'];
  scriptConfig?: Job['scriptConfig'];
  retryConfig: Job['retryConfig'];
}

export interface UpdateJobRequest extends Partial<CreateJobRequest> {
  status?: JobStatus;
}

export interface JobListQuery {
  page?: number;
  pageSize?: number;
  status?: JobStatus;
  type?: JobType;
  keyword?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class JobService {
  async createJob(request: CreateJobRequest): Promise<IJobDocument> {
    this.validateJobRequest(request);

    const job = new JobModel({
      ...request,
      status: JobStatus.ENABLED,
      totalExecutions: 0,
      successCount: 0,
      failedCount: 0,
    });

    const nextTime = getNextExecutionTime(
      job.scheduleType,
      job.cronExpression,
      job.executeAt
    );
    job.nextExecutionTime = nextTime || undefined;

    await job.save();
    logger.info(`Job created: ${job.name} (${job._id})`);

    return job;
  }

  async updateJob(id: string, request: UpdateJobRequest): Promise<IJobDocument> {
    const job = await JobModel.findById(id);
    if (!job) {
      throw new Error('Job not found');
    }

    if (request.name !== undefined) job.name = request.name;
    if (request.description !== undefined) job.description = request.description;
    if (request.type !== undefined) job.type = request.type;
    if (request.scheduleType !== undefined) job.scheduleType = request.scheduleType;
    if (request.cronExpression !== undefined) job.cronExpression = request.cronExpression;
    if (request.executeAt !== undefined) job.executeAt = request.executeAt;
    if (request.httpConfig !== undefined) job.httpConfig = request.httpConfig;
    if (request.scriptConfig !== undefined) job.scriptConfig = request.scriptConfig;
    if (request.retryConfig !== undefined) job.retryConfig = request.retryConfig;
    if (request.status !== undefined) job.status = request.status;

    this.validateJobRequest(job);

    const nextTime = getNextExecutionTime(
      job.scheduleType,
      job.cronExpression,
      job.executeAt
    );
    job.nextExecutionTime = nextTime || undefined;

    await job.save();
    logger.info(`Job updated: ${job.name} (${job._id})`);

    return job;
  }

  async getJob(id: string): Promise<IJobDocument | null> {
    return JobModel.findById(id);
  }

  async getJobs(query: JobListQuery): Promise<PaginatedResult<IJobDocument>> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;
    const skip = (page - 1) * pageSize;

    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;
    if (query.keyword) {
      filter.$or = [
        { name: { $regex: query.keyword, $options: 'i' } },
        { description: { $regex: query.keyword, $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      JobModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
      JobModel.countDocuments(filter),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async deleteJob(id: string): Promise<void> {
    const job = await JobModel.findById(id);
    if (!job) {
      throw new Error('Job not found');
    }

    await JobModel.findByIdAndDelete(id);
    logger.info(`Job deleted: ${job.name} (${id})`);
  }

  async enableJob(id: string): Promise<IJobDocument> {
    const job = await JobModel.findById(id);
    if (!job) {
      throw new Error('Job not found');
    }

    job.status = JobStatus.ENABLED;
    const nextTime = getNextExecutionTime(
      job.scheduleType,
      job.cronExpression,
      job.executeAt
    );
    job.nextExecutionTime = nextTime || undefined;

    await job.save();
    logger.info(`Job enabled: ${job.name} (${id})`);

    return job;
  }

  async disableJob(id: string): Promise<IJobDocument> {
    const job = await JobModel.findById(id);
    if (!job) {
      throw new Error('Job not found');
    }

    job.status = JobStatus.DISABLED;
    job.nextExecutionTime = undefined;

    await job.save();
    logger.info(`Job disabled: ${job.name} (${id})`);

    return job;
  }

  async triggerJob(id: string): Promise<{ success: boolean; reason?: string }> {
    const job = await JobModel.findById(id);
    if (!job) {
      throw new Error('Job not found');
    }

    return jobScheduler.triggerJobManually(id);
  }

  private validateJobRequest(request: Partial<CreateJobRequest>): void {
    if (!request.name) {
      throw new Error('Job name is required');
    }

    if (!request.type) {
      throw new Error('Job type is required');
    }

    if (!request.scheduleType) {
      throw new Error('Schedule type is required');
    }

    if (request.scheduleType === ScheduleType.CRON) {
      if (!request.cronExpression) {
        throw new Error('Cron expression is required for cron schedule');
      }
      if (!isValidCronExpression(request.cronExpression)) {
        throw new Error('Invalid cron expression');
      }
    }

    if (request.scheduleType === ScheduleType.ONCE) {
      if (!request.executeAt) {
        throw new Error('Execute time is required for one-time schedule');
      }
      const executeAt = new Date(request.executeAt);
      if (executeAt < new Date()) {
        throw new Error('Execute time must be in the future');
      }
    }

    if (request.type === JobType.HTTP) {
      if (!request.httpConfig) {
        throw new Error('HTTP config is required for HTTP job');
      }
      if (!request.httpConfig.url) {
        throw new Error('HTTP URL is required');
      }
      if (!request.httpConfig.method) {
        throw new Error('HTTP method is required');
      }
    }

    if (request.type === JobType.SCRIPT) {
      if (!request.scriptConfig) {
        throw new Error('Script config is required for script job');
      }
      if (!request.scriptConfig.script) {
        throw new Error('Script content is required');
      }
    }

    if (!request.retryConfig) {
      throw new Error('Retry config is required');
    }
    if (request.retryConfig.maxRetries < 0) {
      throw new Error('Max retries must be >= 0');
    }
    if (request.retryConfig.retryInterval < 1000) {
      throw new Error('Retry interval must be >= 1000ms');
    }
  }
}

export const jobService = new JobService();
