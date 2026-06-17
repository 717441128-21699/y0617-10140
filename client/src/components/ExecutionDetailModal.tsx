import React, { useState, useEffect } from 'react';
import { Modal, Descriptions, Tag, Spin, message, Tabs, Collapse, Space, Badge } from 'antd';
import dayjs from 'dayjs';
import { historyApi } from '../services/api';
import { ExecutionHistory, ExecutionStatus, JobType, RetryDetail } from '../types';

interface ExecutionDetailModalProps {
  visible: boolean;
  historyId: string | null;
  onClose: () => void;
}

const ExecutionDetailModal: React.FC<ExecutionDetailModalProps> = ({
  visible,
  historyId,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<ExecutionHistory | null>(null);

  const fetchDetail = async () => {
    if (!historyId) return;

    setLoading(true);
    try {
      const response = await historyApi.getHistoryById(historyId);
      if (response.success && response.data) {
        setDetail(response.data);
      } else {
        message.error(response.message || '获取执行详情失败');
      }
    } catch (error: any) {
      message.error(error.message || '获取执行详情失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && historyId) {
      fetchDetail();
    }
  }, [visible, historyId]);

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
          <Descriptions.Item label="执行状态">{detail && getStatusTag(detail.status)}</Descriptions.Item>
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
      key: 'retryDetails',
      label: `重试明细${detail?.retryDetails && detail.retryDetails.length > 0 ? ` (${detail.retryDetails.length})` : ''}`,
      children: renderRetryDetails(),
    },
  ];

  return (
    <Modal
      title="执行详情"
      open={visible}
      onCancel={onClose}
      onOk={onClose}
      width={900}
      destroyOnClose
    >
      <Spin spinning={loading}>
        {detail && <Tabs items={tabItems} defaultActiveKey="overview" />}
      </Spin>
    </Modal>
  );
};

export default ExecutionDetailModal;
