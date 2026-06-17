import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Select,
  DatePicker,
  Space,
  Popconfirm,
  message,
  Tag,
  Modal,
  Form,
  InputNumber,
} from 'antd';
import {
  EyeOutlined,
  DeleteOutlined,
  ClearOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { historyApi, jobApi } from '../services/api';
import {
  ExecutionHistory,
  ExecutionStatus,
  JobType,
  ExecutionHistoryQuery,
  Job,
} from '../types';
import ExecutionDetailModal from '../components/ExecutionDetailModal';

const { RangePicker } = DatePicker;
const { Option } = Select;

const History: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ExecutionHistory[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [query, setQuery] = useState<ExecutionHistoryQuery>({});
  const [jobs, setJobs] = useState<Job[]>([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [clearModalVisible, setClearModalVisible] = useState(false);
  const [clearForm] = Form.useForm();

  const fetchJobs = async () => {
    try {
      const response = await jobApi.getJobs({ pageSize: 1000 });
      if (response.success && response.data) {
        setJobs(response.data);
      }
    } catch (error: any) {
      message.error(error.message || '获取任务列表失败');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: ExecutionHistoryQuery = {
        ...query,
        page: pagination.current,
        pageSize: pagination.pageSize,
      };
      const response = await historyApi.getHistory(params);
      if (response.success) {
        setData(response.data || []);
        setPagination({
          ...pagination,
          total: response.pagination?.total || 0,
        });
      } else {
        message.error(response.message || '获取执行历史失败');
      }
    } catch (error: any) {
      message.error(error.message || '获取执行历史失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    fetchData();
  }, [pagination.current, pagination.pageSize, query]);

  const handleSearch = () => {
    setPagination({
      ...pagination,
      current: 1,
    });
  };

  const handleReset = () => {
    setQuery({});
    setPagination({
      current: 1,
      pageSize: 10,
      total: 0,
    });
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await historyApi.deleteHistory(id);
      if (response.success) {
        message.success('删除成功');
        fetchData();
      } else {
        message.error(response.message || '删除失败');
      }
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  const handleClearHistory = async (values: { days: number }) => {
    try {
      const response = await historyApi.clearOldHistory(values.days);
      if (response.success) {
        message.success(`成功清理 ${response.data?.deletedCount || 0} 条历史记录`);
        setClearModalVisible(false);
        clearForm.resetFields();
        fetchData();
      } else {
        message.error(response.message || '清理失败');
      }
    } catch (error: any) {
      message.error(error.message || '清理失败');
    }
  };

  const handleViewDetail = (id: string) => {
    setSelectedHistoryId(id);
    setDetailModalVisible(true);
  };

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

  const columns: ColumnsType<ExecutionHistory> = [
    {
      title: '任务名称',
      dataIndex: 'jobName',
      key: 'jobName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type: JobType) => getTypeText(type),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: ExecutionStatus) => getStatusTag(status),
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 180,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '结束时间',
      dataIndex: 'endTime',
      key: 'endTime',
      width: 180,
      render: (time?: string) =>
        time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '耗时(ms)',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: (duration?: number) => (duration !== undefined ? duration : '-'),
    },
    {
      title: '重试次数',
      dataIndex: 'retryCount',
      key: 'retryCount',
      width: 100,
      render: (count: number, record: ExecutionHistory) =>
        `${count}/${record.maxRetries}`,
    },
    {
      title: '触发方式',
      dataIndex: 'triggeredBy',
      key: 'triggeredBy',
      width: 100,
      render: (triggeredBy: 'scheduler' | 'manual') =>
        getTriggeredByText(triggeredBy),
    },
    {
      title: '节点ID',
      dataIndex: 'nodeId',
      key: 'nodeId',
      width: 150,
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record._id)}
          >
            详情
          </Button>
          <Popconfirm
            title="确定删除这条记录吗？"
            onConfirm={() => handleDelete(record._id)}
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
    <div style={{ padding: 24 }}>
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2 style={{ margin: 0 }}>执行历史</h2>
        <Button
          type="primary"
          danger
          icon={<ClearOutlined />}
          onClick={() => setClearModalVisible(true)}
        >
          清理历史记录
        </Button>
      </div>

      <div
        style={{
          padding: 16,
          background: '#fff',
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <Space wrap size={16}>
          <Select
            placeholder="选择任务"
            style={{ width: 200 }}
            allowClear
            showSearch
            optionFilterProp="label"
            value={query.jobId}
            onChange={(value) => setQuery({ ...query, jobId: value || undefined })}
          >
            {jobs.map((job) => (
              <Option key={job._id} value={job._id} label={job.name}>
                {job.name}
              </Option>
            ))}
          </Select>

          <Select
            placeholder="选择状态"
            style={{ width: 150 }}
            allowClear
            value={query.status}
            onChange={(value) => setQuery({ ...query, status: value || undefined })}
          >
            <Option value={ExecutionStatus.SUCCESS}>成功</Option>
            <Option value={ExecutionStatus.FAILED}>失败</Option>
            <Option value={ExecutionStatus.PENDING}>等待中</Option>
            <Option value={ExecutionStatus.RETRYING}>重试中</Option>
            <Option value={ExecutionStatus.FINAL_FAILED}>最终失败</Option>
          </Select>

          <Select
            placeholder="选择类型"
            style={{ width: 120 }}
            allowClear
            value={query.type}
            onChange={(value) => setQuery({ ...query, type: value || undefined })}
          >
            <Option value={JobType.HTTP}>HTTP</Option>
            <Option value={JobType.SCRIPT}>脚本</Option>
          </Select>

          <Select
            placeholder="触发方式"
            style={{ width: 120 }}
            allowClear
            value={query.triggeredBy}
            onChange={(value) =>
              setQuery({ ...query, triggeredBy: value || undefined })
            }
          >
            <Option value="scheduler">定时</Option>
            <Option value="manual">手动</Option>
          </Select>

          <RangePicker
            showTime
            placeholder={['开始时间', '结束时间']}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setQuery({
                  ...query,
                  startTime: dates[0].toISOString(),
                  endTime: dates[1].toISOString(),
                });
              } else {
                const { startTime, endTime, ...rest } = query;
                setQuery(rest);
              }
            }}
          />

          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>

          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </div>

      <div style={{ padding: 16, background: '#fff', borderRadius: 8 }}>
        <Table
          rowKey="_id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: (page, pageSize) => {
              setPagination({
                ...pagination,
                current: page,
                pageSize,
              });
            },
          }}
          scroll={{ x: 1300 }}
        />
      </div>

      <ExecutionDetailModal
        visible={detailModalVisible}
        historyId={selectedHistoryId}
        onClose={() => {
          setDetailModalVisible(false);
          setSelectedHistoryId(null);
        }}
      />

      <Modal
        title="清理历史记录"
        open={clearModalVisible}
        onCancel={() => {
          setClearModalVisible(false);
          clearForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={clearForm}
          layout="vertical"
          onFinish={handleClearHistory}
        >
          <Form.Item
            name="days"
            label="清理多少天之前的记录"
            rules={[{ required: true, message: '请输入天数' }]}
            initialValue={30}
          >
            <InputNumber
              min={1}
              max={365}
              style={{ width: '100%' }}
              placeholder="请输入天数"
              addonAfter="天"
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit" danger>
                确认清理
              </Button>
              <Button
                onClick={() => {
                  setClearModalVisible(false);
                  clearForm.resetFields();
                }}
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default History;
