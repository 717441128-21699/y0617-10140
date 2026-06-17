import React, { useEffect, useState, useCallback } from 'react';
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
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { Job, JobStatus, JobType, ScheduleType, JobListQuery } from '../types';
import { jobApi } from '../services/api';
import JobFormModal from '../components/JobFormModal';

const { Search } = Input;
const { Option } = Select;

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

  const handleReset = () => {
    setKeyword('');
    setStatusFilter(undefined);
    setTypeFilter(undefined);
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

  const handleTrigger = async (job: Job) => {
    try {
      await jobApi.triggerJob(job._id);
      message.success('任务已触发');
      fetchJobs();
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

  const columns: ColumnsType<Job> = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      ellipsis: true,
      render: (text: string, record: Job) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 500 }}>{text}</span>
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
      width: 100,
      render: (status: JobStatus) => (
        <Tag color={status === JobStatus.ENABLED ? 'success' : 'default'}>
          {status === JobStatus.ENABLED ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '调度方式',
      dataIndex: 'scheduleType',
      key: 'scheduleType',
      width: 120,
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
      title: '下次执行时间',
      dataIndex: 'nextExecutionTime',
      key: 'nextExecutionTime',
      width: 180,
      render: (time: string | undefined, record: Job) => {
        if (record.status === JobStatus.DISABLED) {
          return <span style={{ color: '#999' }}>-</span>;
        }
        if (record.scheduleType === ScheduleType.ONCE && record.executeAt) {
          return <span>{dayjs(record.executeAt).format('YYYY-MM-DD HH:mm:ss')}</span>;
        }
        if (time) {
          return <span>{dayjs(time).format('YYYY-MM-DD HH:mm:ss')}</span>;
        }
        return <span style={{ color: '#999' }}>-</span>;
      },
    },
    {
      title: '总执行次数',
      dataIndex: 'totalExecutions',
      key: 'totalExecutions',
      width: 110,
      align: 'center',
      render: (count: number) => <span style={{ fontWeight: 500 }}>{count}</span>,
    },
    {
      title: '成功次数',
      dataIndex: 'successCount',
      key: 'successCount',
      width: 100,
      align: 'center',
      render: (count: number) => <span style={{ color: '#52c41a', fontWeight: 500 }}>{count}</span>,
    },
    {
      title: '失败次数',
      dataIndex: 'failedCount',
      key: 'failedCount',
      width: 100,
      align: 'center',
      render: (count: number) => <span style={{ color: '#ff4d4f', fontWeight: 500 }}>{count}</span>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 240,
      fixed: 'right',
      render: (_, record: Job) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger={record.status === JobStatus.ENABLED}
            icon={record.status === JobStatus.ENABLED ? <StopOutlined /> : <PlayCircleOutlined />}
            onClick={() => handleToggleStatus(record)}
          >
            {record.status === JobStatus.ENABLED ? '禁用' : '启用'}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<ThunderboltOutlined />}
            onClick={() => handleTrigger(record)}
          >
            触发
          </Button>
          <Popconfirm
            title="确定要删除这个任务吗？"
            description="删除后将无法恢复"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
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
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                重置
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
          scroll={{ x: 1200 }}
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
