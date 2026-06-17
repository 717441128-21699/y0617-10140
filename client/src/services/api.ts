import axios from 'axios';
import {
  Job,
  ExecutionHistory,
  Statistics,
  JobListQuery,
  ExecutionHistoryQuery,
  CreateJobRequest,
  UpdateJobRequest,
  ApiResponse,
  RunningJobInfo,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || error.message || '请求失败';
    return Promise.reject(new Error(message));
  }
);

export const jobApi = {
  getJobs: (query?: JobListQuery): Promise<ApiResponse<Job[]>> =>
    api.get('/jobs', { params: query }),

  getJob: (id: string): Promise<ApiResponse<Job>> =>
    api.get(`/jobs/${id}`),

  createJob: (data: CreateJobRequest): Promise<ApiResponse<Job>> =>
    api.post('/jobs', data),

  updateJob: (id: string, data: UpdateJobRequest): Promise<ApiResponse<Job>> =>
    api.put(`/jobs/${id}`, data),

  deleteJob: (id: string): Promise<ApiResponse> =>
    api.delete(`/jobs/${id}`),

  enableJob: (id: string): Promise<ApiResponse<Job>> =>
    api.post(`/jobs/${id}/enable`),

  disableJob: (id: string): Promise<ApiResponse<Job>> =>
    api.post(`/jobs/${id}/disable`),

  pauseJob: (id: string): Promise<ApiResponse<Job>> =>
    api.post(`/jobs/${id}/pause`),

  resumeJob: (id: string): Promise<ApiResponse<Job>> =>
    api.post(`/jobs/${id}/resume`),

  triggerJob: (id: string): Promise<ApiResponse & { success: boolean; reason?: string }> =>
    api.post(`/jobs/${id}/trigger`),

  getRunningInfo: (id: string): Promise<ApiResponse<RunningJobInfo | null>> =>
    api.get(`/jobs/${id}/running-info`),

  validateCron: (expression: string): Promise<ApiResponse<{ valid: boolean; description: string }>> =>
    api.get('/jobs/validate-cron', { params: { expression } }),

  previewExecutions: (params: {
    scheduleType: string;
    cronExpression?: string;
    executeAt?: string;
    count?: number;
  }): Promise<ApiResponse<{ nextExecutions: Array<{ timestamp: number; iso: string; local: string }>; description: string }>> =>
    api.get('/jobs/preview-executions', { params }),
};

export const historyApi = {
  getHistory: (query?: ExecutionHistoryQuery): Promise<ApiResponse<ExecutionHistory[]>> =>
    api.get('/execution-history', { params: query }),

  getHistoryById: (id: string): Promise<ApiResponse<ExecutionHistory>> =>
    api.get(`/execution-history/${id}`),

  deleteHistory: (id: string): Promise<ApiResponse> =>
    api.delete(`/execution-history/${id}`),

  clearOldHistory: (days: number): Promise<ApiResponse<{ deletedCount: number }>> =>
    api.delete('/execution-history', { params: { days } }),
};

export const statisticsApi = {
  getStatistics: (days?: number): Promise<ApiResponse<Statistics>> =>
    api.get('/statistics', { params: { days } }),

  getJobStatistics: (jobId: string, days?: number): Promise<ApiResponse<any>> =>
    api.get(`/statistics/jobs/${jobId}`, { params: { days } }),
};

export const healthApi = {
  check: (): Promise<ApiResponse<{ status: string; timestamp: string }>> =>
    api.get('/health'),
};
