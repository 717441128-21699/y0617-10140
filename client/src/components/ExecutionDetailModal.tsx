import React, { useState, useEffect } from 'react';
import { Modal, Descriptions, Tag, Spin, message, Tabs } from 'antd';
import dayjs from 'dayjs';
import { historyApi } from '../services/api';
import { ExecutionHistory, ExecutionStatus, JobType } from '../types';

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

  const tabItems = [
    {
      key: 'result',
      label: '执行结果',
      children: renderCodeBlock(detail?.result),
    },
    {
      key: 'error',
      label: '错误信息',
      children: renderCodeBlock(detail?.error),
    },
  ];

  return (
    <Modal
      title="执行详情"
      open={visible}
      onCancel={onClose}
      onOk={onClose}
      width={800}
      destroyOnClose
    >
      <Spin spinning={loading}>
        {detail && (
          <div>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="任务ID">{detail.jobId}</Descriptions.Item>
              <Descriptions.Item label="任务名称">{detail.jobName}</Descriptions.Item>
              <Descriptions.Item label="任务类型">{getTypeText(detail.type)}</Descriptions.Item>
              <Descriptions.Item label="执行状态">{getStatusTag(detail.status)}</Descriptions.Item>
              <Descriptions.Item label="触发方式">{getTriggeredByText(detail.triggeredBy)}</Descriptions.Item>
              <Descriptions.Item label="节点ID">{detail.nodeId}</Descriptions.Item>
              <Descriptions.Item label="开始时间">
                {dayjs(detail.startTime).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="结束时间">
                {detail.endTime ? dayjs(detail.endTime).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="耗时">
                {detail.duration !== undefined ? `${detail.duration} ms` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="重试次数">
                {detail.retryCount} / {detail.maxRetries}
              </Descriptions.Item>
              <Descriptions.Item label="记录ID" span={2}>
                {detail._id}
              </Descriptions.Item>
            </Descriptions>

            <Tabs items={tabItems} defaultActiveKey="result" />
          </div>
        )}
      </Spin>
    </Modal>
  );
};

export default ExecutionDetailModal;
