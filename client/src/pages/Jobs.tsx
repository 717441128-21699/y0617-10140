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
  Switch,
  Modal,
  Alert,
  Badge,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { ModalProps } from 'antd';
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
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  DownOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { Job, JobStatus, JobType, ScheduleType, JobListQuery, RunningJobInfo } from '../types';
import { jobApi } from '../services/api';
import JobFormModal from '../components/JobFormModal';

const { Search } = Input;
const { Option } = Select;

interface BatchResult {
  jobId: string;
  jobName: string;
  success: boolean;
  status: 'executed' | 'already_running' | 'skipped' | 'failed';
  message: string;
}

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
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());
  const [batchResultModal, setBatchResultModal] = useState<{
    visible: boolean;
    title: string;
    results: BatchResult[];
  }>({ visible: false, title: '', results: [] });

  const dataTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, setTick] = useState(0);

  const hasRunningJobs = jobs.some(job => !!job.runningInfo);
  const refreshInterval = hasRunningJobs ? 2000 : 5000;

  const fetchJobs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
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
        setLastRefreshTime(new Date());
      } else if (!silent) {
        message.error(res.message || '获取任务列表失败');
      }
    } catch (error: any) {
      if (!silent) {
        message.error(error.message || '获取任务列表失败');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [page, pageSize, keyword, statusFilter, typeFilter]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    if (autoRefresh) {
      dataTimerRef.current = setInterval(() => {
        fetchJobs(true);
      }, refreshInterval);
    }
    return () => {
      if (dataTimerRef.current) {
        clearInterval(dataTimerRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, fetchJobs]);

  useEffect(() => {
    tickTimerRef.current = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => {
      if (tickTimerRef.current) {
        clearInterval(tickTimerRef.current);
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
      const res = await jobApi.triggerJob(job._id);
      if (res.success) {
        message.success('任务已触发');
      }
      setTimeout(() => fetchJobs(true), 500);
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

  const handleBatchOperation = async (
    operation: 'pause' | 'resume' | 'enable' | 'disable' | 'trigger',
    label: string
  ) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要操作的任务');
      return;
    }

    const confirm = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: `确认批量${label}`,
        content: `确定要对选中的 ${selectedRowKeys.length} 个任务执行${label}操作吗？`,
        okText: '确定',
        cancelText: '取消',
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });

    if (!confirm) return;

    const results: BatchResult[] = [];

    for (const key of selectedRowKeys) {
      const job = jobs.find(j => j._id === key);
      if (!job) continue;

      try {
        let result: { success: boolean; reason?: string };
        let status: BatchResult['status'] = 'executed';

        switch (operation) {
          case 'pause':
            await jobApi.pauseJob(job._id);
            result = { success: true };
            break;
          case 'resume':
            await jobApi.resumeJob(job._id);
            result = { success: true };
            break;
          case 'enable':
            await jobApi.enableJob(job._id);
            result = { success: true };
            break;
          case 'disable':
            await jobApi.disableJob(job._id);
            result = { success: true };
            break;
          case 'trigger':
            const triggerRes = await jobApi.triggerJob(job._id);
            result = {
              success: triggerRes.success,
              reason: (triggerRes as any).reason || '',
            };
            if (!triggerRes.success) {
              const reason = (triggerRes as any).reason || '';
              status = reason.includes('正在执行') ? 'already_running' : 'failed';
            }
            break;
          default:
            result = { success: false, reason: '未知操作' };
            status = 'failed';
        }

        results.push({
          jobId: job._id,
          jobName: job.name,
          success: result.success,
          status,
          message: result.success ? '操作成功' : (result.reason || '操作失败'),
        });
      } catch (error: any) {
        results.push({
          jobId: job._id,
          jobName: job.name,
          success: false,
          status: 'failed',
          message: error.message || '操作失败',
        });
      }
    }

    setSelectedRowKeys([]);
    fetchJobs(true);
    setBatchResultModal({
      visible: true,
      title: `批量${label}结果`,
      results,
    });
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
      if (record.scheduleType === ScheduleType.ONCE && record.executeAt) {
        const executeAt = dayjs(record.executeAt);
        const isPast = executeAt.isBefore(dayjs());
        return (
          <Tooltip title={isPast ? '执行时间已过，恢复后也不会执行' : '暂停中，恢复后将按计划执行'}>
            <Space size={4}>
              {isPast ? (
                <ExclamationCircleOutlined style={{ color: '#faad14' }} />
              ) : (
                <ClockCircleOutlined style={{ color: '#faad14' }} />
              )}
              <Tag color={isPast ? 'default' : 'warning'}>
                {isPast ? '已过期' : '已暂停'}
              </Tag>
              {!isPast && (
                <span style={{ color: '#666', fontSize: 12 }}>
                  {executeAt.format('MM-DD HH:mm')}
                </span>
              )}
            </Space>
          </Tooltip>
        );
      }
      return <Tag color="warning">已暂停</Tag>;
    }
    if (record.scheduleType === ScheduleType.ONCE && record.executeAt) {
      const executeAt = dayjs(record.executeAt);
      const isPast = executeAt.isBefore(dayjs());
      return (
        <Tooltip title={isPast ? '执行时间已过' : ''}>
          <Space size={4}>
            {isPast && <ExclamationCircleOutlined style={{ color: '#faad14' }} />}
            <span style={{ color: isPast ? '#999' : undefined }}>
              {executeAt.format('YYYY-MM-DD HH:mm:ss')}
            </span>
          </Space>
        </Tooltip>
      );
    }
    if (time) {
      return <span>{dayjs(time).format('YYYY-MM-DD HH:mm:ss')}</span>;
    }
    return <span style={{ color: '#999' }}>-</span>;
  };

  const renderBatchResultModal = () => {
    const { visible, title, results } = batchResultModal;
    const successCount = results.filter(r => r.success).length;
    const failedCount = results.length - successCount;

    const renderResultStatus = (result: BatchResult) => {
      const statusMap: Record<BatchResult['status'], { color: string; text: string; icon: React.ReactNode }> = {
        executed: { color: 'success', text: '成功', icon: <CheckCircleOutlined /> },
        already_running: { color: 'warning', text: '正在执行', icon: <ExclamationCircleOutlined /> },
        skipped: { color: 'default', text: '已跳过', icon: <CloseCircleOutlined /> },
        failed: { color: 'error', text: '失败', icon: <CloseCircleOutlined /> },
      };
      const config = statusMap[result.status];
      return (
        <Space size={4}>
          <span style={{ color: config.color }}>{config.icon}</span>
          <Tag color={config.color}>{config.text}</Tag>
        </Space>
      );
    };

    const columns: ColumnsType<BatchResult> = [
      {
        title: '任务名称',
        dataIndex: 'jobName',
        key: 'jobName',
        width: 200,
        ellipsis: true,
      },
      {
        title: '结果',
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: (_, record) => renderResultStatus(record),
      },
      {
        title: '说明',
        dataIndex: 'message',
        key: 'message',
        render: (text: string) => text,
      },
    ];

    const modalFooter: ModalProps['footer'] = (_) => [
      <Button key="close" type="primary" onClick={() => setBatchResultModal({ ...batchResultModal, visible: false })}>
        关闭
      </Button>,
    ];

    return (
      <Modal
        title={title}
        open={visible}
        onCancel={() => setBatchResultModal({ ...batchResultModal, visible: false })}
        width={700}
        footer={modalFooter}
        destroyOnClose
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            type={failedCount === 0 ? 'success' : failedCount === results.length ? 'error' : 'warning'}
            message={
              <Space>
                <span>共 {results.length} 个任务</span>
                {successCount > 0 && (
                  <Badge status="success" text={`成功 ${successCount}`} />
                )}
                {failedCount > 0 && (
                  <Badge status="error" text={`失败 ${failedCount}`} />
                )}
              </Space>
            }
            showIcon
          />
          <Table
            size="small"
            rowKey="jobId"
            columns={columns}
            dataSource={results}
            pagination={false}
            scroll={{ y: 400 }}
          />
        </Space>
      </Modal>
    );
  };

  const columns: ColumnsType<Job> = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
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
      width: 80,
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
      width: 320,
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

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
    getCheckboxProps: (record: Job) => ({
      disabled: !!record.runningInfo,
    }),
  };

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
          <Col span={8}>
            <Space wrap>
              <Space size={4}>
                <SyncOutlined spin={autoRefresh} style={{ color: autoRefresh ? '#1890ff' : '#999' }} />
                <span style={{ fontSize: 12, color: '#666' }}>自动刷新</span>
                <Switch
                  size="small"
                  checked={autoRefresh}
                  onChange={setAutoRefresh}
                />
              </Space>
              <Tooltip title={`最后刷新: ${lastRefreshTime.toLocaleTimeString()}，间隔: ${refreshInterval / 1000}秒`}>
                <Button icon={<ReloadOutlined />} onClick={() => fetchJobs()} loading={loading} size="small">
                  刷新
                </Button>
              </Tooltip>
              {selectedRowKeys.length > 0 && (
                <Select<string>
                  placeholder={`批量操作 (${selectedRowKeys.length})`}
                  style={{ width: 160 }}
                  onChange={(value) => {
                    switch (value) {
                      case 'pause':
                        handleBatchOperation('pause', '暂停');
                        break;
                      case 'resume':
                        handleBatchOperation('resume', '恢复');
                        break;
                      case 'enable':
                        handleBatchOperation('enable', '启用');
                        break;
                      case 'disable':
                        handleBatchOperation('disable', '禁用');
                        break;
                      case 'trigger':
                        handleBatchOperation('trigger', '触发');
                        break;
                    }
                  }}
                  suffixIcon={<DownOutlined />}
                >
                  <Option value="pause" icon={<PauseCircleOutlined />}>批量暂停</Option>
                  <Option value="resume" icon={<PlayCircleOutlined />}>批量恢复</Option>
                  <Option value="enable" icon={<PlayCircleOutlined />}>批量启用</Option>
                  <Option value="disable" icon={<StopOutlined />}>批量禁用</Option>
                  <Option value="trigger" icon={<ThunderboltOutlined />}>批量触发</Option>
                </Select>
              )}
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
          rowSelection={rowSelection}
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
          scroll={{ x: 1500 }}
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

      {renderBatchResultModal()}
    </div>
  );
};

export default Jobs;
