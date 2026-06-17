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
  if (parts.length < 5) {
    return '无效的Cron表达式';
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  const parseInterval = (part: string): string | null => {
    if (part === '*') return null;
    if (part.startsWith('*/')) {
      return `每${part.slice(2)}`;
    }
    return null;
  };

  const minInterval = parseInterval(minute);
  const hourInterval = parseInterval(hour);

  if (minute === '*' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return '每分钟执行';
  }

  if (minInterval && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return `${minInterval}分钟执行`;
  }

  if (hourInterval && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    if (minute === '*') {
      return `${hourInterval}小时执行`;
    }
    if (!minute.includes('*') && !minute.includes('/')) {
      return `${hourInterval}小时第${minute}分钟执行`;
    }
  }

  if (hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    if (minute.includes(',') || minute.includes('-')) {
      return `每小时第 ${minute} 分钟执行`;
    }
    return `每小时第 ${minute} 分钟执行`;
  }

  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    if (minute === '*' && hour !== '*') {
      const hourInterval2 = parseInterval(hour);
      if (hourInterval2) {
        return `${hourInterval2}小时执行`;
      }
      return `每天 ${hour}:00 执行`;
    }
    return `每天 ${hour}:${minute.padStart(2, '0')} 执行`;
  }

  if (month === '*' && dayOfWeek === '*') {
    return `每月 ${dayOfMonth} 日 ${hour}:${minute.padStart(2, '0')} 执行`;
  }

  if (dayOfMonth === '*' && month === '*') {
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const dayNames = dayOfWeek.split(',').map(d => weekDays[parseInt(d)] || d).join('、');
    return `每周 ${dayNames} ${hour}:${minute.padStart(2, '0')} 执行`;
  }

  if (dayOfWeek === '*') {
    return `每年 ${month} 月 ${dayOfMonth} 日 ${hour}:${minute.padStart(2, '0')} 执行`;
  }

  return `Cron: ${expression}`;
}
