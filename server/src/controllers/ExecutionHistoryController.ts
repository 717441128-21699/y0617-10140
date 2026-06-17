import { Request, Response, NextFunction } from 'express';
import { executionHistoryService, ExecutionHistoryQuery } from '../services/ExecutionHistoryService';
import { ExecutionStatus, JobType } from '../types';
import logger from '../utils/logger';

export class ExecutionHistoryController {
  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query: ExecutionHistoryQuery = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : undefined,
        jobId: req.query.jobId as string | undefined,
        status: req.query.status as ExecutionStatus | undefined,
        type: req.query.type as JobType | undefined,
        triggeredBy: req.query.triggeredBy as 'scheduler' | 'manual' | undefined,
        startTime: req.query.startTime ? new Date(req.query.startTime as string) : undefined,
        endTime: req.query.endTime ? new Date(req.query.endTime as string) : undefined,
      };

      const result = await executionHistoryService.getHistory(query);

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
      logger.error('Error getting execution history:', error);
      next(error);
    }
  }

  async getHistoryById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const history = await executionHistoryService.getHistoryById(id);

      if (!history) {
        res.status(404).json({
          success: false,
          message: 'Execution history not found',
        });
        return;
      }

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      logger.error('Error getting execution history:', error);
      next(error);
    }
  }

  async deleteHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await executionHistoryService.deleteHistory(id);

      res.json({
        success: true,
        message: 'Execution history deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting execution history:', error);
      next(error);
    }
  }

  async clearOldHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
      const deletedCount = await executionHistoryService.clearOldHistory(days);

      res.json({
        success: true,
        message: `Deleted ${deletedCount} old execution history records`,
        data: { deletedCount },
      });
    } catch (error) {
      logger.error('Error clearing old execution history:', error);
      next(error);
    }
  }
}

export const executionHistoryController = new ExecutionHistoryController();
