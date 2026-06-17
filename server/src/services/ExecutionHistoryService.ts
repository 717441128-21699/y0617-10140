import { ExecutionHistoryModel, IExecutionHistoryDocument } from '../models/ExecutionHistory';
import { ExecutionStatus, JobType } from '../types';
import { PaginatedResult } from './JobService';

export interface ExecutionHistoryQuery {
  page?: number;
  pageSize?: number;
  jobId?: string;
  status?: ExecutionStatus;
  type?: JobType;
  startTime?: Date;
  endTime?: Date;
  triggeredBy?: 'scheduler' | 'manual';
}

export class ExecutionHistoryService {
  async getHistory(query: ExecutionHistoryQuery): Promise<PaginatedResult<IExecutionHistoryDocument>> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const filter: any = {};
    if (query.jobId) filter.jobId = query.jobId;
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;
    if (query.triggeredBy) filter.triggeredBy = query.triggeredBy;

    if (query.startTime || query.endTime) {
      filter.startTime = {};
      if (query.startTime) filter.startTime.$gte = new Date(query.startTime);
      if (query.endTime) filter.startTime.$lte = new Date(query.endTime);
    }

    const [data, total] = await Promise.all([
      ExecutionHistoryModel.find(filter)
        .sort({ startTime: -1 })
        .skip(skip)
        .limit(pageSize),
      ExecutionHistoryModel.countDocuments(filter),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getHistoryById(id: string): Promise<IExecutionHistoryDocument | null> {
    return ExecutionHistoryModel.findById(id);
  }

  async deleteHistory(id: string): Promise<void> {
    const history = await ExecutionHistoryModel.findById(id);
    if (!history) {
      throw new Error('Execution history not found');
    }
    await ExecutionHistoryModel.findByIdAndDelete(id);
  }

  async clearOldHistory(days: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await ExecutionHistoryModel.deleteMany({
      createdAt: { $lt: cutoffDate },
    });

    return result.deletedCount || 0;
  }
}

export const executionHistoryService = new ExecutionHistoryService();
