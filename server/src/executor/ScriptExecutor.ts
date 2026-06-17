import { exec, spawn } from 'child_process';
import { ScriptJobConfig } from '../types';
import logger from '../utils/logger';
import { ExecutionResult } from './HttpExecutor';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ScriptExecutor {
  async execute(config: ScriptJobConfig): Promise<ExecutionResult> {
    const startTime = Date.now();
    const interpreter = config.interpreter || 'node';
    const timeout = config.timeout || 30000;

    try {
      logger.debug(`Executing script with ${interpreter}`);

      let result: ExecutionResult;

      if (interpreter === 'bash' || interpreter === 'sh' || interpreter === 'powershell') {
        result = await this.executeShellScript(config.script, interpreter, timeout, config.env);
      } else if (interpreter === 'node' || interpreter === 'python' || interpreter === 'python3') {
        result = await this.executeInterpreterScript(
          config.script,
          interpreter,
          timeout,
          config.env
        );
      } else {
        result = await this.executeGenericCommand(config.script, interpreter, timeout, config.env);
      }

      result.duration = Date.now() - startTime;
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error(`Script execution failed: ${error.message}`);

      return {
        success: false,
        error: error.message || 'Unknown error',
        duration,
      };
    }
  }

  private async executeShellScript(
    script: string,
    shell: string,
    timeout: number,
    env?: Record<string, string>
  ): Promise<ExecutionResult> {
    try {
      const { stdout, stderr } = await execAsync(script, {
        shell,
        timeout,
        env: { ...process.env, ...env },
        maxBuffer: 10 * 1024 * 1024,
      });

      if (stderr && stderr.trim()) {
        logger.warn(`Script stderr: ${stderr}`);
      }

      return {
        success: true,
        result: stdout || stderr || 'Script executed successfully',
        duration: 0,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || error.stderr || 'Script execution failed',
        duration: 0,
      };
    }
  }

  private async executeInterpreterScript(
    script: string,
    interpreter: string,
    timeout: number,
    env?: Record<string, string>
  ): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      const execFlag = interpreter.startsWith('python') ? '-c' : '-e';
      const child = spawn(interpreter, [execFlag, script], {
        env: { ...process.env, ...env },
        timeout,
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timeoutTimer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 1000);
      }, timeout);

      child.on('error', (error) => {
        clearTimeout(timeoutTimer);
        resolve({
          success: false,
          error: error.message,
          duration: 0,
        });
      });

      child.on('close', (code) => {
        clearTimeout(timeoutTimer);

        if (timedOut) {
          resolve({
            success: false,
            error: `Script execution timed out after ${timeout}ms`,
            duration: 0,
          });
          return;
        }

        if (code !== 0) {
          resolve({
            success: false,
            error: stderr || `Script exited with code ${code}`,
            duration: 0,
          });
          return;
        }

        resolve({
          success: true,
          result: stdout || stderr || 'Script executed successfully',
          duration: 0,
        });
      });
    });
  }

  private async executeGenericCommand(
    script: string,
    interpreter: string,
    timeout: number,
    env?: Record<string, string>
  ): Promise<ExecutionResult> {
    try {
      const { stdout, stderr } = await execAsync(`${interpreter} ${script}`, {
        timeout,
        env: { ...process.env, ...env },
        maxBuffer: 10 * 1024 * 1024,
      });

      return {
        success: true,
        result: stdout || stderr || 'Command executed successfully',
        duration: 0,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || error.stderr || 'Command execution failed',
        duration: 0,
      };
    }
  }
}

export const scriptExecutor = new ScriptExecutor();
