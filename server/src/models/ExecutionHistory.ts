import mongoose, { Schema, Document } from 'mongoose';
import { ExecutionHistory, JobType, ExecutionStatus } from '../types';

export interface IExecutionHistoryDocument extends Omit<ExecutionHistory, '_id'>, Document {}

const RetryDetailSchema = new Schema({
  attempt: { type: Number, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  duration: { type: Number, required: true },
  status: { type: String, enum: Object.values(ExecutionStatus), required: true },
  result: String,
  error: String,
}, { _id: false });

const ExecutionHistorySchema: Schema = new Schema<IExecutionHistoryDocument>(
  {
    jobId: { type: String, required: true, index: true },
    jobName: { type: String, required: true },
    type: { type: String, enum: Object.values(JobType), required: true },
    startTime: { type: Date, required: true, index: true },
    endTime: Date,
    duration: Number,
    status: {
      type: String,
      enum: Object.values(ExecutionStatus),
      required: true,
      index: true,
    },
    result: String,
    error: String,
    retryCount: { type: Number, default: 0 },
    maxRetries: { type: Number, default: 0 },
    retryDetails: { type: [RetryDetailSchema], default: [] },
    nodeId: { type: String, required: true, index: true },
    triggeredBy: { type: String, enum: ['scheduler', 'manual'], required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

ExecutionHistorySchema.index({ jobId: 1, createdAt: -1 });
ExecutionHistorySchema.index({ status: 1, createdAt: -1 });
ExecutionHistorySchema.index({ startTime: -1 });

export const ExecutionHistoryModel = mongoose.model<IExecutionHistoryDocument>(
  'ExecutionHistory',
  ExecutionHistorySchema
);
