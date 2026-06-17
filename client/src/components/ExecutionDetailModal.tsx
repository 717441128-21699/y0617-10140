import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  Descriptions,
  Tag,
  Spin,
  message,
  Tabs,
  Collapse,
  Space,
  Badge,
  Timeline,
  Alert,
  Switch,
  Tooltip,
  Button,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { historyApi } from '../services/api';
import {
  ExecutionHistory,
  ExecutionStatus,
  JobType,
  RetryDetail,
} from '../types';

interface ExecutionDetailModalProps {
  visible: boolean;
  historyId: string | null;
  onClose: () => void;
}

const AUTO_REFRESH_INTERVAL = 2000;

const ExecutionDetailModal: React.FC<ExecutionDetailModalProps> = ({
  visible,
  historyId,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<ExecutionHistory | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, setTick] = useState(0);

  const fetchDetail = useCallback(async () => {
    if (!historyId) return;

    try {
      const response = await historyApi.getHistoryById(historyId);
      if (response.success && response.data) {
        setDetail(response.data);
      } else {
        message.error(response.message || '获取执行详情失败');
      }
    } catch (error: any) {
      message.error(error.message || '获取执行详情失败');
    }
  }, [historyId]);

  const fetchDetailWithLoading = useCallback(async () => {
    setLoading(true);
    await fetchDetail();
    setLoading(false);
  }, [fetchDetail]);

  const isFinalStatus = (status: ExecutionStatus) => {
    return status === ExecutionStatus.SUCCESS ||
           status === ExecutionStatus.FAILED ||
           status === ExecutionStatus.FINAL_FAILED;
  };

  const isRunning = (detail: ExecutionHistory | null) => {
    if (!detail) return false;
    return detail.status === ExecutionStatus.PENDING ||
           detail.status === ExecutionStatus.RETRYING;
  };

  useEffect(() => {
    if (visible && historyId) {
      fetchDetailWithLoading();
    }
  }, [visible, historyId, fetchDetailWithLoading]);

  useEffect(() => {
    if (visible && autoRefresh && !isFinalStatus(detail?.status || ExecutionStatus.PENDING)) {
      timerRef.current = setInterval(() => {
        fetchDetail();
        setTick(t => t + 1);
      }, AUTO_REFRESH_INTERVAL);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [visible, autoRefresh, detail?.status, fetchDetail]);

  const getStatusTag = (status: ExecutionStatus) => {
    const statusMap: Record<ExecutionStatus, { color: string; text: string }> = {
      [ExecutionStatus.SUCCESS]: { color: 'green', text: '成功' },
      [ExecutionStatus.FAILED]: { color: 'red', text: '失败' },
      [ExecutionStatus.PENDING]: { color: 'orange', text: '等待中' },
      [ExecutionStatus.RETRYING]: { color: 'blue', text: '重试中' },
      [ExecutionStatus.FINAL_FAILED]: { color: 'red', text: '最终失败' },
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getTypeText = (type: JobType) => {
    return type === JobType.HTTP ? 'HTTP' : '脚本';
  };

  const getTriggeredByText = (triggeredBy: 'scheduler' | 'manual') => {
    return triggeredBy === 'scheduler' ? '定时' : '手动';
  };

  const formatJson = (str?: string) => {
    if (!str) return '';
    try {
      const obj = JSON.parse(str);
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return str;
    }
  };

  const renderCodeBlock = (content?: string) => {
    if (!content) return <span style={{ color: '#999' }}>无</span>;
    const formatted = formatJson(content);
    return (
      <pre
        style={{
          background: '#f5f5f5',
          padding: 12,
          borderRadius: 4,
          overflowX: 'auto',
          maxHeight: 400,
          margin: 0,
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        <code>{formatted}</code>
      </pre>
    );
  };

  const getStatusBadge = (status: ExecutionStatus) => {
    const colorMap: Record<ExecutionStatus, string> = {
      [ExecutionStatus.SUCCESS]: 'success',
      [ExecutionStatus.FAILED]: 'error',
      [ExecutionStatus.PENDING]: 'warning',
      [ExecutionStatus.RETRYING]: 'processing',
      [ExecutionStatus.FINAL_FAILED]: 'error',
    };
    return colorMap[status] || 'default';
  };

  const getStatusText = (status: ExecutionStatus) => {
    const textMap: Record<ExecutionStatus, string> = {
      [ExecutionStatus.SUCCESS]: '成功',
      [ExecutionStatus.FAILED]: '失败',
      [ExecutionStatus.PENDING]: '等待中',
      [ExecutionStatus.RETRYING]: '重试中',
      [ExecutionStatus.FINAL_FAILED]: '最终失败',
    };
    return textMap[status] || status;
  };

  const getTimelineIcon = (status: ExecutionStatus, isLatest: boolean) => {
    if (isLatest && (status === ExecutionStatus.PENDING || status === ExecutionStatus.RETRYING)) {
      return <SyncOutlined spin style={{ color: '#1890ff', fontSize: 16 }} />;
    }
    const iconMap: Record<ExecutionStatus, React.ReactNode> = {
      [ExecutionStatus.SUCCESS]: <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />,
      [ExecutionStatus.FAILED]: <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />,
      [ExecutionStatus.FINAL_FAILED]: <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />,
      [ExecutionStatus.PENDING]: <ClockCircleOutlined style={{ color: '#faad14', fontSize: 16 }} />,
      [ExecutionStatus.RETRYING]: <PlayCircleOutlined style={{ color: '#1890ff', fontSize: 16 }} />,
    };
    return iconMap[status] || <ClockCircleOutlined style={{ color: '#999', fontSize: 16 }} />;
  };

  const getTimelineColor = (status: ExecutionStatus) => {
    const colorMap: Record<ExecutionStatus, string> = {
      [ExecutionStatus.SUCCESS]: 'green',
      [ExecutionStatus.FAILED]: 'red',
      [ExecutionStatus.FINAL_FAILED]: 'red',
      [ExecutionStatus.PENDING]: 'orange',
      [ExecutionStatus.RETRYING]: 'blue',
    };
    return colorMap[status] || 'gray';
  };

  const buildTimelineItems = (history: ExecutionHistory) => {
    const items: any[] = [];
    const retryDetails = history.retryDetails || [];

    if (retryDetails.length === 0) {
      items.push({
        color: getTimelineColor(history.status),
        dot: getTimelineIcon(history.status, true),
        children: (
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Space>
              <span style={{ fontWeight: 500 }}>执行完成</span>
              <Badge status={getStatusBadge(history.status) as any} text={getStatusText(history.status)} />
              <Tag color="blue">{history.duration} ms</Tag>
            </Space>
            <div style={{ color: '#666', fontSize: 12 }}>
              {dayjs(history.startTime).format('YYYY-MM-DD HH:mm:ss.SSS')}
              {history.endTime && ` → ${dayjs(history.endTime).format('HH:mm:ss.SSS')}`}
            </div>
          </Space>
        ),
      });
    } else {
      retryDetails.forEach((retry: RetryDetail, index: number) => {
        const isLatestRetry = index === retryDetails.length - 1;
        const isLatest = isLatestRetry && !isFinalStatus(history.status);
        const isLastSuccess = retry.status === ExecutionStatus.SUCCESS && index === retryDetails.length - 1;
        const isFinalFailed = history.status === ExecutionStatus.FINAL_FAILED && index === retryDetails.length - 1;

        let displayStatus = retry.status;
        if (isLastSuccess) {
          displayStatus = ExecutionStatus.SUCCESS;
        } else if (isFinalFailed) {
          displayStatus = ExecutionStatus.FINAL_FAILED;
        } else if (isLatest && history.status === ExecutionStatus.RETRYING) {
          displayStatus = ExecutionStatus.RETRYING;
        }

        const attemptText = retry.attempt === 0 ? '首次执行' : `第 ${retry.attempt} 次重试`;

        items.push({
          color: getTimelineColor(displayStatus),
          dot: getTimelineIcon(displayStatus, isLatest),
          children: (
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Space>
                <span style={{ fontWeight: 500 }}>{attemptText}</span>
                <Badge
                  status={getStatusBadge(displayStatus) as any}
                  text={getStatusText(displayStatus)}
                />
                <Tag color="blue">{retry.duration} ms</Tag>
              </Space>
              <div style={{ color: '#666', fontSize: 12 }}>
                {dayjs(retry.startTime).format('YYYY-MM-DD HH:mm:ss.SSS')}
                {retry.endTime && ` → ${dayjs(retry.endTime).format('HH:mm:ss.SSS')}`}
              </div>
              {(retry.result || retry.error) && (
                <Collapse
                  ghost
                  size="small"
                  style={{ marginTop: 8 }}
                  items={[
                    {
                      key: '1',
                      label: '查看详情',
                      children: (
                        <Space direction="vertical" size={8} style={{ width: '100%' }}>
                          {retry.result && (
                            <div>
                              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>输出：</div>
                              {renderCodeBlock(retry.result)}
                            </div>
                          )}
                          {retry.error && (
                            <div>
                              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>错误：</div>
                              {renderCodeBlock(retry.error)}
                            </div>
                          )}
                        </Space>
                      ),
                    },
                  ]}
                />
              )}
            </Space>
          ),
        });
      });

      if (isFinalStatus(history.status) && retryDetails.length > 0) {
        const totalDuration = history.duration ||
          (new Date(history.endTime || Date.now()).getTime() - new Date(history.startTime).getTime());

        items.push({
          color: getTimelineColor(history.status),
          dot: getTimelineIcon(history.status, false),
          children: (
            <Space direction="vertical" size={4}>
              <Space>
                <span style={{ fontWeight: 500 }}>
                  {history.status === ExecutionStatus.SUCCESS ? '执行成功' : '执行结束'}
                </span>
                <Badge
                  status={getStatusBadge(history.status) as any}
                  text={getStatusText(history.status)}
                />
                <Tag color="geekblue">总耗时 {totalDuration} ms</Tag>
                <Tag color="purple">{retryDetails.length} 次执行</Tag>
              </Space>
            </Space>
          ),
        });
      }
    }

    return items;
  };

  const renderTimeline = () => {
    if (!detail) return null;

    const timelineItems = buildTimelineItems(detail);
    const running = isRunning(detail);

    return (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {running && (
          <Alert
            type="info"
            showIcon
            icon={<SyncOutlined spin />}
            message={
              <Space>
                <span>任务正在执行中</span>
                <Space size={4}>
                  <span style={{ fontSize: 12, color: '#666' }}>自动刷新</span>
                  <Switch
                    size="small"
                    checked={autoRefresh}
                    onChange={setAutoRefresh}
                  />
                </Space>
                <Tooltip title="立即刷新">
                  <Button
                    type="text"
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={fetchDetailWithLoading}
                  />
                </Tooltip>
              </Space>
            }
            description={`已执行 ${(detail.retryDetails?.length || 0)} 次，状态: ${getStatusText(detail.status)}`}
          />
        )}
        <Timeline
          mode="left"
          items={timelineItems}
        />
      </Space>
    );
  };

  const renderRetryDetail = (retry: RetryDetail, index: number) => {
    const attemptText = retry.attempt === 0 ? '首次执行' : `第 ${retry.attempt} 次重试`;
    const items = [
      {
        key: 'info',
        label: '执行信息',
        children: (
          <Descriptions column={2} bordered size="small" style={{ marginBottom: 12 }}>
            <Descriptions.Item label="开始时间">
              {dayjs(retry.startTime).format('YYYY-MM-DD HH:mm:ss.SSS')}
            </Descriptions.Item>
            <Descriptions.Item label="结束时间">
              {dayjs(retry.endTime).format('YYYY-MM-DD HH:mm:ss.SSS')}
            </Descriptions.Item>
            <Descriptions.Item label="耗时">
              {retry.duration} ms
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Badge
                status={getStatusBadge(retry.status) as any}
                text={getStatusText(retry.status)}
              />
            </Descriptions.Item>
          </Descriptions>
        ),
      },
      {
        key: 'result',
        label: '执行输出',
        children: renderCodeBlock(retry.result),
      },
    ];

    if (retry.error) {
      items.push({
        key: 'error',
        label: '错误信息',
        children: renderCodeBlock(retry.error),
      });
    }

    return (
      <Collapse.Panel
        key={index}
        header={
          <Space>
            <span style={{ fontWeight: 500 }}>{attemptText}</span>
            <Badge
              status={getStatusBadge(retry.status) as any}
              text={getStatusText(retry.status)}
            />
            <Tag color="blue">{retry.duration} ms</Tag>
            <span style={{ color: '#999', fontSize: 12 }}>
              {dayjs(retry.startTime).format('HH:mm:ss')}
            </span>
          </Space>
        }
      >
        <Tabs items={items} size="small" />
      </Collapse.Panel>
    );
  };

  const renderRetryDetails = () => {
    if (!detail?.retryDetails || detail.retryDetails.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>
          无重试明细
        </div>
      );
    }

    const hasMultiple = detail.retryDetails.length > 1;
    const finalStatus = detail.status;
    const finalResult = detail.result;
    const finalError = detail.error;

    const items = [
      {
        key: 'overview',
        label: '执行概览',
        children: (
          <div>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="最终状态">
                <Badge
                  status={getStatusBadge(finalStatus) as any}
                  text={getStatusText(finalStatus)}
                />
              </Descriptions.Item>
              <Descriptions.Item label="重试次数">
                {detail.retryCount} / {detail.maxRetries}
              </Descriptions.Item>
              <Descriptions.Item label="开始时间">
                {dayjs(detail.startTime).format('YYYY-MM-DD HH:mm:ss.SSS')}
              </Descriptions.Item>
              <Descriptions.Item label="结束时间">
                {detail.endTime ? dayjs(detail.endTime).format('YYYY-MM-DD HH:mm:ss.SSS') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="总耗时" span={2}>
                {detail.duration !== undefined ? `${detail.duration} ms` : '-'}
              </Descriptions.Item>
            </Descriptions>

            {hasMultiple && (
              <div style={{ marginBottom: 12, color: '#666' }}>
                本次执行共包含 {detail.retryDetails.length} 次执行（首次执行 + {detail.retryDetails.length - 1} 次重试），展开下方卡片查看每次执行的详细情况：
              </div>
            )}

            <Collapse
              defaultActiveKey={detail.retryDetails.length > 0 ? [detail.retryDetails.length - 1] : []}
              ghost
            >
              {detail.retryDetails.map((retry, index) => renderRetryDetail(retry, index))}
            </Collapse>
          </div>
        ),
      },
      {
        key: 'finalResult',
        label: '最终输出',
        children: renderCodeBlock(finalResult),
      },
    ];

    if (finalError) {
      items.push({
        key: 'finalError',
        label: '最终错误',
        children: renderCodeBlock(finalError),
      });
    }

    return <Tabs items={items} size="small" />;
  };

  const tabItems = [
    {
      key: 'overview',
      label: '执行概览',
      children: (
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="任务ID">{detail?.jobId}</Descriptions.Item>
          <Descriptions.Item label="任务名称">{detail?.jobName}</Descriptions.Item>
          <Descriptions.Item label="任务类型">{detail && getTypeText(detail.type)}</Descriptions.Item>
          <Descriptions.Item label="执行状态">
            {detail && getStatusTag(detail.status)}
            {detail && isRunning(detail) && (
              <SyncOutlined spin style={{ color: '#1890ff', marginLeft: 8 }} />
            )}
          </Descriptions.Item>
          <Descriptions.Item label="触发方式">{detail && getTriggeredByText(detail.triggeredBy)}</Descriptions.Item>
          <Descriptions.Item label="节点ID">{detail?.nodeId}</Descriptions.Item>
          <Descriptions.Item label="开始时间">
            {detail && dayjs(detail.startTime).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="结束时间">
            {detail?.endTime ? dayjs(detail.endTime).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="耗时">
            {detail?.duration !== undefined ? `${detail.duration} ms` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="重试次数">
            {detail?.retryCount} / {detail?.maxRetries}
          </Descriptions.Item>
          <Descriptions.Item label="记录ID" span={2}>
            {detail?._id}
          </Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      key: 'timeline',
      label: '执行过程',
      children: renderTimeline(),
    },
    {
      key: 'retryDetails',
      label: `重试明细${detail?.retryDetails && detail.retryDetails.length > 0 ? ` (${detail.retryDetails.length})` : ''}`,
      children: renderRetryDetails(),
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <span>执行详情</span>
          {detail && isRunning(detail) && (
            <Tag color="processing" icon={<SyncOutlined spin />}>
              执行中
            </Tag>
          )}
        </Space>
      }
      open={visible}
      onCancel={onClose}
      onOk={onClose}
      width={900}
      destroyOnClose
    >
      <Spin spinning={loading}>
        {detail && <Tabs items={tabItems} defaultActiveKey="timeline" />}
      </Spin>
    </Modal>
  );
};

export default ExecutionDetailModal;
