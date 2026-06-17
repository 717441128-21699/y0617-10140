import mongoose, { Schema, Document } from 'mongoose';
import { Job, JobType, JobStatus, ScheduleType } from '../types';

export interface IJobDocument extends Omit<Job, '_id'>, Document {}

const HttpJobConfigSchema = new Schema({
  url: { type: String, required: true },
  method: { type: String, enum: ['GET', 'POST', 'PUT', 'DELETE'], required: true },
  headers: { type: Map, of: String },
  params: { type: Map, of: Schema.Types.Mixed },
  body: Schema.Types.Mixed,
  timeout: { type: Number, default: 30000 },
}, { _id: false });

const ScriptJobConfigSchema = new Schema({
  script: { type: String, required: true },
  interpreter: { type: String, default: 'node' },
  timeout: { type: Number, default: 30000 },
  env: { type: Map, of: String },
}, { _id: false });

const RetryConfigSchema = new Schema({
  maxRetries: { type: Number, default: 0, min: 0 },
  retryInterval: { type: Number, default: 5000, min: 1000 },
}, { _id: false });

const JobSchema: Schema = new Schema<IJobDocument>(
  {
    name: { type: String, required: true, index: true },
    description: String,
    type: { type: String, enum: Object.values(JobType), required: true },
    scheduleType: { type: String, enum: Object.values(ScheduleType), required: true },
    cronExpression: String,
    executeAt: Date,
    httpConfig: HttpJobConfigSchema,
    scriptConfig: ScriptJobConfigSchema,
    retryConfig: { type: RetryConfigSchema, required: true },
    status: { type: String, enum: Object.values(JobStatus), default: JobStatus.ENABLED },
    lastExecutionTime: Date,
    nextExecutionTime: Date,
    totalExecutions: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    createdBy: String,
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

JobSchema.index({ status: 1, nextExecutionTime: 1 });
JobSchema.index({ type: 1 });
JobSchema.index({ createdAt: -1 });

export const JobModel = mongoose.model<IJobDocument>('Job', JobSchema);
