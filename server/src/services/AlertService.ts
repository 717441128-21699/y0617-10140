import axios from 'axios';
import { IJobDocument } from '../models/Job';
import { IExecutionHistoryDocument } from '../models/ExecutionHistory';
import { config } from '../config';
import logger from '../utils/logger';

export interface AlertMessage {
  jobId: string;
  jobName: string;
  error: string;
  retryCount: number;
  maxRetries: number;
  startTime: Date;
  duration?: number;
  nodeId: string;
  triggeredBy: string;
}

export class AlertService {
  private webhookUrl: string;

  constructor() {
    this.webhookUrl = config.alertWebhookUrl;
  }

  async sendAlert(
    job: IJobDocument,
    history: IExecutionHistoryDocument,
    error: string
  ): Promise<boolean> {
    try {
      const message: AlertMessage = {
        jobId: job._id.toString(),
        jobName: job.name,
        error,
        retryCount: history.retryCount,
        maxRetries: history.maxRetries,
        startTime: history.startTime,
        duration: history.duration,
        nodeId: history.nodeId,
        triggeredBy: history.triggeredBy,
      };

      logger.warn(`Sending alert for failed job: ${job.name}`, message);

      if (!this.webhookUrl) {
        logger.info('No alert webhook configured, logging alert only');
        return true;
      }

      await this.sendToWebhook(message);
      logger.info(`Alert sent successfully for job: ${job.name}`);
      return true;
    } catch (error) {
      logger.error('Failed to send alert:', error);
      return false;
    }
  }

  private async sendToWebhook(message: AlertMessage): Promise<void> {
    const payload = this.formatWebhookPayload(message);

    await axios.post(this.webhookUrl, payload, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private formatWebhookPayload(message: AlertMessage): any {
    const isDingTalk = this.webhookUrl.includes('dingtalk');
    const isWeChat = this.webhookUrl.includes('weixin') || this.webhookUrl.includes('qyapi');
    const isFeishu = this.webhookUrl.includes('feishu') || this.webhookUrl.includes('lark');

    if (isDingTalk) {
      return {
        msgtype: 'markdown',
        markdown: {
          title: '任务执行失败告警',
          text: this.formatMarkdown(message),
        },
        at: {
          isAtAll: true,
        },
      };
    }

    if (isWeChat) {
      return {
        msgtype: 'markdown',
        markdown: {
          content: this.formatMarkdown(message),
        },
      };
    }

    if (isFeishu) {
      return {
        msg_type: 'interactive',
        card: {
          header: {
            title: {
              tag: 'plain_text',
              content: '任务执行失败告警',
            },
          },
          elements: [
            {
              tag: 'markdown',
              content: this.formatMarkdown(message),
            },
          ],
        },
      };
    }

    return message;
  }

  private formatMarkdown(message: AlertMessage): string {
    const durationText = message.duration
      ? `${message.duration}ms`
      : '未知';

    return `
# ⚠️ 任务执行失败告警

**任务名称**: ${message.jobName}
**任务ID**: ${message.jobId}
**错误信息**: ${message.error}
**重试次数**: ${message.retryCount}/${message.maxRetries}
**开始时间**: ${new Date(message.startTime).toLocaleString('zh-CN')}
**执行耗时**: ${durationText}
**执行节点**: ${message.nodeId}
**触发方式**: ${message.triggeredBy === 'manual' ? '手动触发' : '定时触发'}

请及时处理！
    `.trim();
  }

  async sendCustomAlert(title: string, content: string): Promise<boolean> {
    try {
      if (!this.webhookUrl) {
        logger.info(`[${title}] ${content}`);
        return true;
      }

      const message = {
        title,
        content,
        timestamp: new Date().toISOString(),
      };

      await axios.post(this.webhookUrl, message, {
        timeout: 10000,
      });

      return true;
    } catch (error) {
      logger.error('Failed to send custom alert:', error);
      return false;
    }
  }
}

export const alertService = new AlertService();
