import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  Popconfirm,
  message,
  Space,
  Tag,
  Card,
  Row,
  Col,
  Tooltip,
  Progress,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  EditOutlined,
  PlayCircleOutlined,
  StopOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  SearchOutlined,
  ReloadOutlined,
  PauseCircleOutlined,
  SyncOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { Job, JobStatus, JobType, ScheduleType, JobListQuery, RunningJobInfo } from '../types';
import { jobApi } from '../services/api';
import JobFormModal from '../components/JobFormModal';

const { Search } = Input;
const { Option } = Select;

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
};

const Jobs: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatus | undefined>();
  const [typeFilter, setTypeFilter] = useState<JobType | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const query: JobListQuery = {
        page,
        pageSize,
        keyword: keyword || undefined,
        status: statusFilter,
        type: typeFilter,
      };
      const res = await jobApi.getJobs(query);
      if (res.success) {
        setJobs(res.data || []);
        setTotal(res.pagination?.total || 0);
      } else {
        message.error(res.message || '获取任务列表失败');
      }
    } catch (error: any) {
      message.error(error.message || '获取任务列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, statusFilter, typeFilter]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const handleSearch = (value: string) => {
    setKeyword(value);
    setPage(1);
  };

  const handleStatusChange = (value: JobStatus | undefined) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleTypeChange = (value: JobType | undefined) => {
    setTypeFilter(value);
    setPage(1);
  };

  const handleAdd = () => {
    setEditingJob(null);
    setModalOpen(true);
  };

  const handleEdit = (job: Job) => {
    setEditingJob(job);
    setModalOpen(true);
  };

  const handleToggleStatus = async (job: Job) => {
    try {
      if (job.status === JobStatus.ENABLED) {
        await jobApi.disableJob(job._id);
        message.success('任务已禁用');
      } else {
        await jobApi.enableJob(job._id);
        message.success('任务已启用');
      }
      fetchJobs();
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  const handlePause = async (job: Job) => {
    try {
      await jobApi.pauseJob(job._id);
      message.success('任务已暂停，将不再自动调度，但仍可手动触发');
      fetchJobs();
    } catch (error: any) {
      message.error(error.message || '暂停失败');
    }
  };

  const handleResume = async (job: Job) => {
    try {
      await jobApi.resumeJob(job._id);
      message.success('任务已恢复调度');
      fetchJobs();
    } catch (error: any) {
      message.error(error.message || '恢复失败');
    }
  };

  const handleTrigger = async (job: Job) => {
    try {
      await jobApi.triggerJob(job._id);
      message.success('任务已触发');
      setTimeout(fetchJobs, 500);
    } catch (error: any) {
      message.error(error.message || '触发失败');
    }
  };

  const handleDelete = async (job: Job) => {
    try {
      await jobApi.deleteJob(job._id);
      message.success('任务已删除');
      fetchJobs();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  const renderRunningInfo = (runningInfo: RunningJobInfo) => {
    const elapsed = Date.now() - runningInfo.startTime;
    return (
      <Tooltip
        title={
          <div style={{ fontSize: 12 }}>
            <div>节点: {runningInfo.nodeId}</div>
            <div>触发方式: {runningInfo.triggeredBy === 'scheduler' ? '定时调度' : '手动触发'}</div>
            <div>已执行: {formatDuration(elapsed)}</div>
          </div>
        }
      >
        <Space size={4}>
          <SyncOutlined spin style={{ color: '#1890ff' }} />
          <Tag color="processing" style={{ margin: 0 }}>
            运行中 · {formatDuration(elapsed)}
          </Tag>
        </Space>
      </Tooltip>
    );
  };

  const renderStatus = (status: JobStatus, runningInfo?: RunningJobInfo | null) => {
    if (runningInfo) {
      return renderRunningInfo(runningInfo);
    }
    const statusMap: Record<JobStatus, { color: string; text: string }> = {
      [JobStatus.ENABLED]: { color: 'success', text: '启用' },
      [JobStatus.DISABLED]: { color: 'default', text: '禁用' },
      [JobStatus.PAUSED]: { color: 'warning', text: '暂停' },
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const renderNextExecutionTime = (time: string | undefined, record: Job) => {
    if (record.runningInfo) {
      return (
        <Tooltip title={`节点: ${record.runningInfo.nodeId}`}>
          <Space size={4}>
            <RobotOutlined style={{ color: '#1890ff' }} />
            <span style={{ color: '#1890ff' }}>
              {record.runningInfo.nodeId}
            </span>
          </Space>
        </Tooltip>
      );
    }
    if (record.status === JobStatus.DISABLED) {
      return <span style={{ color: '#999' }}>-</span>;
    }
    if (record.status === JobStatus.PAUSED) {
      return <Tag color="warning">已暂停</Tag>;
    }
    if (record.scheduleType === ScheduleType.ONCE && record.executeAt) {
      return <span>{dayjs(record.executeAt).format('YYYY-MM-DD HH:mm:ss')}</span>;
    }
    if (time) {
      return <span>{dayjs(time).format('YYYY-MM-DD HH:mm:ss')}</span>;
    }
    return <span style={{ color: '#999' }}>-</span>;
  };

  const columns: ColumnsType<Job> = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      ellipsis: true,
      render: (text: string, record: Job) => (
        <Space direction="vertical" size={0}>
          <Space size={4}>
            <span style={{ fontWeight: 500 }}>{text}</span>
            {record.runningInfo && (
              <SyncOutlined spin style={{ color: '#1890ff', fontSize: 12 }} />
            )}
          </Space>
          {record.description && (
            <span style={{ color: '#999', fontSize: 12 }}>{record.description}</span>
          )}
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: JobType) => (
        <Tag color={type === JobType.HTTP ? 'blue' : 'green'}>
          {type === JobType.HTTP ? 'HTTP' : '脚本'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: JobStatus, record: Job) => renderStatus(status, record.runningInfo),
    },
    {
      title: '调度方式',
      dataIndex: 'scheduleType',
      key: 'scheduleType',
      width: 140,
      render: (type: ScheduleType, record: Job) => (
        <Space direction="vertical" size={0}>
          <Tag color={type === ScheduleType.CRON ? 'geekblue' : 'purple'}>
            {type === ScheduleType.CRON ? 'Cron' : '一次性'}
          </Tag>
          {type === ScheduleType.CRON && record.cronExpression && (
            <span style={{ fontSize: 12, color: '#999', fontFamily: 'monospace' }}>
              {record.cronExpression}
            </span>
          )}
        </Space>
      ),
    },
    {
      title: '运行节点 / 下次执行',
      dataIndex: 'nextExecutionTime',
      key: 'nextExecutionTime',
      width: 200,
      render: (time: string | undefined, record: Job) => renderNextExecutionTime(time, record),
    },
    {
      title: '执行统计',
      key: 'stats',
      width: 180,
      render: (_, record: Job) => {
        const total = record.totalExecutions || 0;
        const success = record.successCount || 0;
        const rate = total > 0 ? Math.round((success / total) * 100) : 0;
        return (
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <div style={{ fontSize: 12, color: '#666' }}>
              成功 <span style={{ color: '#52c41a', fontWeight: 500 }}>{success}</span>
              {' / '}
              失败 <span style={{ color: '#ff4d4f', fontWeight: 500 }}>{record.failedCount || 0}</span>
              {' / '}
              共 <span style={{ fontWeight: 500 }}>{total}</span>
            </div>
            <Progress
              percent={rate}
              size="small"
              showInfo={false}
              strokeColor={rate >= 80 ? '#52c41a' : rate >= 50 ? '#faad14' : '#ff4d4f'}
              style={{ margin: 0 }}
            />
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 300,
      fixed: 'right',
      render: (_, record: Job) => {
        const isRunning = !!record.runningInfo;
        return (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
            {record.status === JobStatus.ENABLED && (
              <Button
                type="link"
                size="small"
                icon={<PauseCircleOutlined />}
                onClick={() => handlePause(record)}
                disabled={isRunning}
              >
                暂停
              </Button>
            )}
            {record.status === JobStatus.PAUSED && (
              <Button
                type="link"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => handleResume(record)}
              >
                恢复
              </Button>
            )}
            {record.status !== JobStatus.PAUSED && (
              <Button
                type="link"
                size="small"
                danger={record.status === JobStatus.ENABLED}
                icon={record.status === JobStatus.ENABLED ? <StopOutlined /> : <PlayCircleOutlined />}
                onClick={() => handleToggleStatus(record)}
                disabled={isRunning}
              >
                {record.status === JobStatus.ENABLED ? '禁用' : '启用'}
              </Button>
            )}
            <Button
              type="link"
              size="small"
              icon={<ThunderboltOutlined />}
              onClick={() => handleTrigger(record)}
              disabled={isRunning}
            >
              触发
            </Button>
            <Popconfirm
              title="确定要删除这个任务吗？"
              description="删除后将无法恢复"
              onConfirm={() => handleDelete(record)}
              okText="确定"
              cancelText="取消"
              disabled={isRunning}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={isRunning}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <Card>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Search
              placeholder="搜索任务名称或描述"
              allowClear
              enterButton={<SearchOutlined />}
              size="middle"
              value={keyword}
              onSearch={handleSearch}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </Col>
          <Col span={4}>
            <Select
              placeholder="状态筛选"
              allowClear
              style={{ width: '100%' }}
              value={statusFilter}
              onChange={handleStatusChange}
            >
              <Option value={JobStatus.ENABLED}>启用</Option>
              <Option value={JobStatus.PAUSED}>暂停</Option>
              <Option value={JobStatus.DISABLED}>禁用</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Select
              placeholder="类型筛选"
              allowClear
              style={{ width: '100%' }}
              value={typeFilter}
              onChange={handleTypeChange}
            >
              <Option value={JobType.HTTP}>HTTP</Option>
              <Option value={JobType.SCRIPT}>脚本</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={fetchJobs} loading={loading}>
                刷新
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                新增任务
              </Button>
            </Space>
          </Col>
        </Row>

        <Table
          rowKey="_id"
          columns={columns}
          dataSource={jobs}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 条`,
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          scroll={{ x: 1400 }}
          rowClassName={(record) => record.runningInfo ? 'ant-table-row-selected' : ''}
        />
      </Card>

      <JobFormModal
        open={modalOpen}
        job={editingJob}
        onCancel={() => setModalOpen(false)}
        onSuccess={() => {
          fetchJobs();
        }}
      />
    </div>
  );
};

export default Jobs;
