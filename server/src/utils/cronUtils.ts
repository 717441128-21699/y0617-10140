import { parseExpression } from 'cron-parser';
import { ScheduleType, Job } from '../types';

export function isValidCronExpression(expression: string): boolean {
  try {
    parseExpression(expression);
    return true;
  } catch {
    return false;
  }
}

export function getNextExecutionTime(
  scheduleType: ScheduleType,
  cronExpression?: string,
  executeAt?: Date,
  fromTime: Date = new Date()
): Date | null {
  if (scheduleType === ScheduleType.ONCE) {
    if (!executeAt) return null;
    const executeDate = new Date(executeAt);
    return executeDate > fromTime ? executeDate : null;
  }

  if (scheduleType === ScheduleType.CRON) {
    if (!cronExpression) return null;
    try {
      const interval = parseExpression(cronExpression, { currentDate: fromTime });
      return interval.next().toDate();
    } catch {
      return null;
    }
  }

  return null;
}

export function getNextExecutionTimes(
  scheduleType: ScheduleType,
  cronExpression?: string,
  executeAt?: Date,
  count: number = 5,
  fromTime: Date = new Date()
): Date[] {
  const times: Date[] = [];

  if (scheduleType === ScheduleType.ONCE) {
    const nextTime = getNextExecutionTime(scheduleType, cronExpression, executeAt, fromTime);
    if (nextTime) times.push(nextTime);
    return times;
  }

  if (scheduleType === ScheduleType.CRON && cronExpression) {
    try {
      const interval = parseExpression(cronExpression, { currentDate: fromTime });
      for (let i = 0; i < count; i++) {
        times.push(interval.next().toDate());
      }
    } catch {
      // ignore
    }
  }

  return times;
}

export function shouldExecuteJob(job: Job, currentTime: Date = new Date()): boolean {
  if (!job.nextExecutionTime) return false;
  const nextExec = new Date(job.nextExecutionTime);
  return nextExec <= currentTime;
}

export function formatCronDescription(expression: string): string {
  if (!isValidCronExpression(expression)) {
    return '无效的Cron表达式';
  }

  const parts = expression.trim().split(/\s+/);
  if (parts.length < 5 || parts.length > 6) {
    return '无效的Cron表达式';
  }

  const hasSecond = parts.length === 6;
  const second = hasSecond ? parts[0] : null;
  const minute = hasSecond ? parts[1] : parts[0];
  const hour = hasSecond ? parts[2] : parts[1];
  const dayOfMonth = hasSecond ? parts[3] : parts[2];
  const month = hasSecond ? parts[4] : parts[3];
  const dayOfWeek = hasSecond ? parts[5] : parts[4];

  const parseInterval = (part: string): string | null => {
    if (part === '*') return null;
    if (part.startsWith('*/')) {
      return `每${part.slice(2)}`;
    }
    return null;
  };

  const secInterval = second ? parseInterval(second) : null;
  const minInterval = parseInterval(minute);
  const hourInterval = parseInterval(hour);

  const pad2 = (s: string) => s.padStart(2, '0');

  const isAllStar = (...args: string[]) => args.every(p => p === '*');

  if (isAllStar(minute, hour, dayOfMonth, month, dayOfWeek)) {
    if (hasSecond) {
      if (second === '*') return '每秒执行';
      if (secInterval) return `${secInterval}秒执行`;
      return `每分钟第 ${second} 秒执行`;
    }
    return '每分钟执行';
  }

  if (isAllStar(hour, dayOfMonth, month, dayOfWeek)) {
    if (minInterval) {
      if (hasSecond && second === '0') {
        return `${minInterval}分钟执行`;
      }
      if (hasSecond && second !== '*') {
        return `${minInterval}分钟第 ${second} 秒执行`;
      }
      return `${minInterval}分钟执行`;
    }
    if (hasSecond) {
      if (second === '*') {
        return `每小时第 ${minute} 分钟每秒执行`;
      }
      if (secInterval) {
        return `每小时第 ${minute} 分钟${secInterval}秒执行`;
      }
      return `每小时第 ${minute} 分 ${second} 秒执行`;
    }
    return `每小时第 ${minute} 分钟执行`;
  }

  const secStr = hasSecond && second !== '*' ? second : null;
  const formatTime = (h: string, m: string, s?: string | null) => {
    return `${h}:${pad2(m)}${s ? `:${pad2(s)}` : ''}`;
  };

  if (isAllStar(dayOfMonth, month, dayOfWeek)) {
    const timeStr = formatTime(hour, minute, secStr);

    if (hourInterval) {
      if (minute === '0' && (!hasSecond || second === '0')) {
        return `${hourInterval}小时执行`;
      }
      return `${hourInterval}小时 ${minute} 分${secStr ? ` ${secStr} 秒` : ''}执行`;
    }

    return `每天 ${timeStr} 执行`;
  }

  if (isAllStar(month, dayOfWeek)) {
    const timeStr = formatTime(hour, minute, secStr);
    return `每月 ${dayOfMonth} 日 ${timeStr} 执行`;
  }

  if (isAllStar(dayOfMonth, month)) {
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const dayNames = dayOfWeek.split(',').map(d => weekDays[parseInt(d)] || d).join('、');
    const timeStr = formatTime(hour, minute, secStr);
    return `每周 ${dayNames} ${timeStr} 执行`;
  }

  if (dayOfWeek === '*') {
    const timeStr = formatTime(hour, minute, secStr);
    return `每年 ${month} 月 ${dayOfMonth} 日 ${timeStr} 执行`;
  }

  return `Cron: ${expression}`;
}
