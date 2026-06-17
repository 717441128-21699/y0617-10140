import { Request, Response, NextFunction } from 'express';
import { statisticsService } from '../services/StatisticsService';
import logger from '../utils/logger';

export class StatisticsController {
  async getStatistics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;
      const statistics = await statisticsService.getStatistics(days);

      res.json({
        success: true,
        data: statistics,
      });
    } catch (error) {
      logger.error('Error getting statistics:', error);
      next(error);
    }
  }

  async getJobStatistics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;
      const statistics = await statisticsService.getJobStatistics(jobId, days);

      res.json({
        success: true,
        data: statistics,
      });
    } catch (error) {
      logger.error('Error getting job statistics:', error);
      next(error);
    }
  }
}

export const statisticsController = new StatisticsController();
