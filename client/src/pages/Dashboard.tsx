import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Statistic, Button, Space, message } from 'antd';
import {
  ReloadOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import StatisticsCharts from '../components/StatisticsCharts';
import { statisticsApi } from '../services/api';
import { Statistics } from '../types';

const Dashboard: React.FC = () => {
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(7);

  const fetchStatistics = useCallback(async (selectedDays: number) => {
    setLoading(true);
    try {
      const response = await statisticsApi.getStatistics(selectedDays);
      if (response.success && response.data) {
        setStatistics(response.data);
      } else {
          message.error(response.message || '获取统计数据失败');
        }
    } catch (error: any) {
      message.error(error.message || '获取统计数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatistics(days);
  }, [days, fetchStatistics]);

  const handleRefresh = () => {
    fetchStatistics(days);
  };

  const handleDaysChange = (newDays: number) => {
    setDays(newDays);
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  };

  const successRateColor = (rate: number) => {
    if (rate >= 95) return '#52c41a';
    if (rate >= 80) return '#faad14';
    return '#ff4d4f';
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 'bold' }}>数据概览</h2>
        <Space>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={loading}
          >
            刷新数据
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="任务总数"
              value={statistics?.totalJobs || 0}
              prefix={<AppstoreOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="已启用任务"
              value={statistics?.enabledJobs || 0}
              prefix={<PlayCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="已禁用任务"
              value={statistics?.disabledJobs || 0}
              prefix={<PauseCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="执行总次数"
              value={statistics?.totalExecutions || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="成功次数"
              value={statistics?.successCount || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="失败次数"
              value={statistics?.failedCount || 0}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="成功率"
              value={statistics?.successRate || 0}
              precision={2}
              suffix="%"
              valueStyle={{ color: successRateColor(statistics?.successRate || 0) }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="平均执行耗时"
              value={statistics?.averageDuration || 0}
              formatter={(value) => formatDuration(value as number)}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
      </Row>

      <StatisticsCharts
        statistics={statistics}
        days={days}
        onDaysChange={handleDaysChange}
        loading={loading}
      />
    </div>
  );
};

export default Dashboard;
