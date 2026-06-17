import React from 'react';
import ReactECharts from 'echarts-for-react';
import { Card, Segmented } from 'antd';
import { Statistics } from '../types';

interface StatisticsChartsProps {
  statistics: Statistics | null;
  days: number;
  onDaysChange: (days: number) => void;
  loading?: boolean;
}

export const ExecutionTrendChart: React.FC<{
  data: Statistics['executionsByDay'];
}> = ({ data }) => {
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
    },
    legend: {
      data: ['执行总数', '成功数', '失败数'],
      top: 0,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: data.map((item) => item.date),
      axisLabel: {
        rotate: 45,
        fontSize: 11,
      },
    },
    yAxis: {
      type: 'value',
      name: '执行次数',
      nameTextStyle: {
        fontSize: 12,
      },
    },
    series: [
      {
        name: '执行总数',
        type: 'bar',
        data: data.map((item) => item.count),
        itemStyle: {
          color: '#1890ff',
        },
      },
      {
        name: '成功数',
        type: 'bar',
        data: data.map((item) => item.success),
        itemStyle: {
          color: '#52c41a',
        },
      },
      {
        name: '失败数',
        type: 'bar',
        data: data.map((item) => item.failed),
        itemStyle: {
          color: '#ff4d4f',
        },
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: '350px', width: '100%' }}
      notMerge={true}
      lazyUpdate={true}
    />
  );
};

export const DurationChart: React.FC<{
  data: Statistics['averageDurationByDay'];
}> = ({ data }) => {
  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const param = params[0];
        return `${param.name}<br/>平均耗时: ${param.value} ms`;
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: data.map((item) => item.date),
      axisLabel: {
        rotate: 45,
        fontSize: 11,
      },
    },
    yAxis: {
      type: 'value',
      name: '平均耗时 (ms)',
      nameTextStyle: {
        fontSize: 12,
      },
      scale: true,
    },
    series: [
      {
        name: '平均耗时',
        type: 'line',
        data: data.map((item) => item.averageDuration),
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: {
          color: '#722ed1',
          width: 2,
        },
        itemStyle: {
          color: '#722ed1',
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(114, 46, 209, 0.3)' },
              { offset: 1, color: 'rgba(114, 46, 209, 0.05)' },
            ],
          },
        },
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: '350px', width: '100%' }}
      notMerge={true}
      lazyUpdate={true}
    />
  );
};

const StatisticsCharts: React.FC<StatisticsChartsProps> = ({
  statistics,
  days,
  onDaysChange,
  loading = false,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-end mb-4">
        <Segmented
          value={days}
          onChange={(value) => onDaysChange(value as number)}
          options={[
            { label: '最近7天', value: 7 },
            { label: '最近14天', value: 14 },
            { label: '最近30天', value: 30 },
          ]}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="执行趋势图" loading={loading}>
          <ExecutionTrendChart data={statistics?.executionsByDay || []} />
        </Card>
        <Card title="平均耗时趋势图" loading={loading}>
          <DurationChart data={statistics?.averageDurationByDay || []} />
        </Card>
      </div>
    </div>
  );
};

export default StatisticsCharts;
