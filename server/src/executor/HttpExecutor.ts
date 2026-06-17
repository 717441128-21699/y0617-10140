import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { HttpJobConfig } from '../types';
import logger from '../utils/logger';

export interface ExecutionResult {
  success: boolean;
  result?: string;
  error?: string;
  duration: number;
}

export class HttpExecutor {
  async execute(config: HttpJobConfig): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      const axiosConfig: AxiosRequestConfig = {
        url: config.url,
        method: config.method,
        headers: config.headers || {},
        params: config.params,
        data: config.body,
        timeout: config.timeout || 30000,
        validateStatus: () => true,
      };

      logger.debug(`Executing HTTP request: ${config.method} ${config.url}`);
      const response: AxiosResponse = await axios(axiosConfig);

      const duration = Date.now() - startTime;
      const success = response.status >= 200 && response.status < 300;

      let result: string;
      try {
        result = typeof response.data === 'string'
          ? response.data
          : JSON.stringify(response.data);
      } catch {
        result = String(response.data);
      }

      if (!success) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${result}`,
          duration,
        };
      }

      return {
        success: true,
        result,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage = error.code === 'ECONNABORTED'
        ? `Request timeout after ${duration}ms`
        : error.message || 'Unknown error';

      logger.error(`HTTP execution failed: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        duration,
      };
    }
  }
}

export const httpExecutor = new HttpExecutor();
