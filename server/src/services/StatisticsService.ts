import { JobModel } from '../models/Job';
import { ExecutionHistoryModel } from '../models/ExecutionHistory';
import { JobStatus, ExecutionStatus, Statistics } from '../types';

export class StatisticsService {
  async getStatistics(days: number = 7): Promise<Statistics> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const [
      totalJobs,
      enabledJobs,
      disabledJobs,
      totalExecutions,
      successCount,
      failedCount,
      averageDuration,
      executionsByDay,
      averageDurationByDay,
    ] = await Promise.all([
      JobModel.countDocuments(),
      JobModel.countDocuments({ status: JobStatus.ENABLED }),
      JobModel.countDocuments({ status: JobStatus.DISABLED }),
      ExecutionHistoryModel.countDocuments({ startTime: { $gte: cutoffDate } }),
      ExecutionHistoryModel.countDocuments({
        startTime: { $gte: cutoffDate },
        status: ExecutionStatus.SUCCESS,
      }),
      ExecutionHistoryModel.countDocuments({
        startTime: { $gte: cutoffDate },
        status: { $in: [ExecutionStatus.FAILED, ExecutionStatus.FINAL_FAILED] },
      }),
      this.getAverageDuration(cutoffDate),
      this.getExecutionsByDay(cutoffDate),
      this.getAverageDurationByDay(cutoffDate),
    ]);

    const successRate = totalExecutions > 0 ? (successCount / totalExecutions) * 100 : 0;

    return {
      totalJobs,
      enabledJobs,
      disabledJobs,
      totalExecutions,
      successCount,
      failedCount,
      successRate: Math.round(successRate * 100) / 100,
      averageDuration: Math.round(averageDuration * 100) / 100,
      executionsByDay,
      averageDurationByDay,
    };
  }

  private async getAverageDuration(cutoffDate: Date): Promise<number> {
    const result = await ExecutionHistoryModel.aggregate([
      { $match: { startTime: { $gte: cutoffDate }, duration: { $exists: true, $ne: null } } },
      { $group: { _id: null, avgDuration: { $avg: '$duration' } } },
    ]);

    return result.length > 0 ? result[0].avgDuration || 0 : 0;
  }

  private async getExecutionsByDay(
    cutoffDate: Date
  ): Promise<Array<{ date: string; count: number; success: number; failed: number }>> {
    const result = await ExecutionHistoryModel.aggregate([
      { $match: { startTime: { $gte: cutoffDate } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$startTime' },
          },
          count: { $sum: 1 },
          success: {
            $sum: { $cond: [{ $eq: ['$status', ExecutionStatus.SUCCESS] }, 1, 0] },
          },
          failed: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$status', ExecutionStatus.FAILED] },
                    { $eq: ['$status', ExecutionStatus.FINAL_FAILED] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return result.map((item) => ({
      date: item._id,
      count: item.count,
      success: item.success,
      failed: item.failed,
    }));
  }

  private async getAverageDurationByDay(
    cutoffDate: Date
  ): Promise<Array<{ date: string; averageDuration: number }>> {
    const result = await ExecutionHistoryModel.aggregate([
      { $match: { startTime: { $gte: cutoffDate }, duration: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$startTime' },
          },
          averageDuration: { $avg: '$duration' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return result.map((item) => ({
      date: item._id,
      averageDuration: Math.round(item.averageDuration * 100) / 100,
    }));
  }

  async getJobStatistics(jobId: string, days: number = 7): Promise<any> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const [totalExecutions, successCount, failedCount, averageDuration] = await Promise.all([
      ExecutionHistoryModel.countDocuments({ jobId, startTime: { $gte: cutoffDate } }),
      ExecutionHistoryModel.countDocuments({
        jobId,
        startTime: { $gte: cutoffDate },
        status: ExecutionStatus.SUCCESS,
      }),
      ExecutionHistoryModel.countDocuments({
        jobId,
        startTime: { $gte: cutoffDate },
        status: { $in: [ExecutionStatus.FAILED, ExecutionStatus.FINAL_FAILED] },
      }),
      ExecutionHistoryModel.aggregate([
        { $match: { jobId, startTime: { $gte: cutoffDate }, duration: { $exists: true, $ne: null } } },
        { $group: { _id: null, avgDuration: { $avg: '$duration' } } },
      ]),
    ]);

    const successRate = totalExecutions > 0 ? (successCount / totalExecutions) * 100 : 0;

    return {
      totalExecutions,
      successCount,
      failedCount,
      successRate: Math.round(successRate * 100) / 100,
      averageDuration: averageDuration.length > 0 ? Math.round(averageDuration[0].avgDuration * 100) / 100 : 0,
    };
  }
}

export const statisticsService = new StatisticsService();
