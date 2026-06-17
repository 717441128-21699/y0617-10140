export enum JobType {
  HTTP = 'http',
  SCRIPT = 'script',
}

export enum JobStatus {
  ENABLED = 'enabled',
  DISABLED = 'disabled',
  PAUSED = 'paused',
}

export interface RunningJobInfo {
  jobId: string;
  nodeId: string;
  startTime: number;
  triggeredBy: 'scheduler' | 'manual';
  executionId: string;
}

export interface RetryDetail {
  attempt: number;
  startTime: string;
  endTime: string;
  duration: number;
  status: ExecutionStatus;
  result?: string;
  error?: string;
}

export enum ExecutionStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  PENDING = 'pending',
  RETRYING = 'retrying',
  FINAL_FAILED = 'final_failed',
}

export enum ScheduleType {
  CRON = 'cron',
  ONCE = 'once',
}

export interface HttpJobConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  params?: Record<string, any>;
  body?: any;
  timeout?: number;
}

export interface ScriptJobConfig {
  script: string;
  interpreter?: string;
  timeout?: number;
  env?: Record<string, string>;
}

export interface RetryConfig {
  maxRetries: number;
  retryInterval: number;
}

export interface Job {
  _id: string;
  name: string;
  description?: string;
  type: JobType;
  scheduleType: ScheduleType;
  cronExpression?: string;
  executeAt?: string;
  httpConfig?: HttpJobConfig;
  scriptConfig?: ScriptJobConfig;
  retryConfig: RetryConfig;
  status: JobStatus;
  lastExecutionTime?: string;
  nextExecutionTime?: string;
  totalExecutions: number;
  successCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  runningInfo?: RunningJobInfo | null;
}

export interface ExecutionHistory {
  _id: string;
  jobId: string;
  jobName: string;
  type: JobType;
  startTime: string;
  endTime?: string;
  duration?: number;
  status: ExecutionStatus;
  result?: string;
  error?: string;
  retryCount: number;
  maxRetries: number;
  retryDetails?: RetryDetail[];
  nodeId: string;
  triggeredBy: 'scheduler' | 'manual';
  createdAt: string;
}

export interface Statistics {
  totalJobs: number;
  enabledJobs: number;
  disabledJobs: number;
  pausedJobs: number;
  totalExecutions: number;
  successCount: number;
  failedCount: number;
  successRate: number;
  averageDuration: number;
  executionsByDay: Array<{ date: string; count: number; success: number; failed: number }>;
  averageDurationByDay: Array<{ date: string; averageDuration: number }>;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  pagination?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface JobListQuery {
  page?: number;
  pageSize?: number;
  status?: JobStatus;
  type?: JobType;
  keyword?: string;
}

export interface ExecutionHistoryQuery {
  page?: number;
  pageSize?: number;
  jobId?: string;
  status?: ExecutionStatus;
  type?: JobType;
  startTime?: string;
  endTime?: string;
  triggeredBy?: 'scheduler' | 'manual';
}

export interface CreateJobRequest {
  name: string;
  description?: string;
  type: JobType;
  scheduleType: ScheduleType;
  cronExpression?: string;
  executeAt?: string;
  httpConfig?: HttpJobConfig;
  scriptConfig?: ScriptJobConfig;
  retryConfig: RetryConfig;
}

export type UpdateJobRequest = Partial<CreateJobRequest> & {
  status?: JobStatus;
};
