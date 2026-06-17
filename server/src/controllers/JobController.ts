import { Request, Response, NextFunction } from 'express';
import { jobService, CreateJobRequest, UpdateJobRequest, JobListQuery } from '../services/JobService';
import { JobStatus, JobType } from '../types';
import { getNextExecutionTimes, formatCronDescription, isValidCronExpression } from '../utils/cronUtils';
import logger from '../utils/logger';

export class JobController {
  async createJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const request: CreateJobRequest = req.body;
      const job = await jobService.createJob(request);
      res.status(201).json({
        success: true,
        data: job,
        message: 'Job created successfully',
      });
    } catch (error) {
      logger.error('Error creating job:', error);
      next(error);
    }
  }

  async updateJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const request: UpdateJobRequest = req.body;
      const job = await jobService.updateJob(id, request);
      res.json({
        success: true,
        data: job,
        message: 'Job updated successfully',
      });
    } catch (error) {
      logger.error('Error updating job:', error);
      next(error);
    }
  }

  async getJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const job = await jobService.getJob(id);
      if (!job) {
        res.status(404).json({
          success: false,
          message: 'Job not found',
        });
        return;
      }
      res.json({
        success: true,
        data: job,
      });
    } catch (error) {
      logger.error('Error getting job:', error);
      next(error);
    }
  }

  async getJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query: JobListQuery = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : undefined,
        status: req.query.status as JobStatus | undefined,
        type: req.query.type as JobType | undefined,
        keyword: req.query.keyword as string | undefined,
      };
      const result = await jobService.getJobs(query);
      res.json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      logger.error('Error getting jobs:', error);
      next(error);
    }
  }

  async deleteJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await jobService.deleteJob(id);
      res.json({
        success: true,
        message: 'Job deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting job:', error);
      next(error);
    }
  }

  async enableJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const job = await jobService.enableJob(id);
      res.json({
        success: true,
        data: job,
        message: 'Job enabled successfully',
      });
    } catch (error) {
      logger.error('Error enabling job:', error);
      next(error);
    }
  }

  async disableJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const job = await jobService.disableJob(id);
      res.json({
        success: true,
        data: job,
        message: 'Job disabled successfully',
      });
    } catch (error) {
      logger.error('Error disabling job:', error);
      next(error);
    }
  }

  async triggerJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await jobService.triggerJob(id);
      if (!result.success) {
        res.status(409).json({
          success: false,
          message: result.reason || '任务触发失败',
        });
        return;
      }
      res.json({
        success: true,
        message: '任务触发成功',
      });
    } catch (error) {
      logger.error('Error triggering job:', error);
      next(error);
    }
  }

  async previewNextExecutions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { scheduleType, cronExpression, executeAt, count } = req.query;
      const countNum = count ? parseInt(count as string, 10) : 5;

      const times = getNextExecutionTimes(
        scheduleType as any,
        cronExpression as string,
        executeAt ? new Date(executeAt as string) : undefined,
        countNum
      );

      const formattedTimes = times.map((t) => ({
        timestamp: t.getTime(),
        iso: t.toISOString(),
        local: t.toLocaleString('zh-CN'),
      }));

      let description = '';
      if (scheduleType === 'cron' && cronExpression) {
        description = formatCronDescription(cronExpression as string);
      } else if (scheduleType === 'once' && executeAt) {
        description = `一次性执行: ${new Date(executeAt as string).toLocaleString('zh-CN')}`;
      }

      res.json({
        success: true,
        data: {
          nextExecutions: formattedTimes,
          description,
        },
      });
    } catch (error) {
      logger.error('Error previewing next executions:', error);
      next(error);
    }
  }

  async validateCron(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { expression } = req.query;
      const isValid = isValidCronExpression(expression as string);
      const description = isValid ? formatCronDescription(expression as string) : '无效的Cron表达式';

      res.json({
        success: true,
        data: {
          valid: isValid,
          description,
        },
      });
    } catch (error) {
      logger.error('Error validating cron:', error);
      next(error);
    }
  }
}

export const jobController = new JobController();
