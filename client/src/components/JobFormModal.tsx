import React, { useEffect, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Radio,
  Select,
  DatePicker,
  InputNumber,
  Row,
  Col,
  Button,
  Card,
  Space,
  Alert,
  message,
  Tag,
} from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import {
  Job,
  JobType,
  ScheduleType,
  CreateJobRequest,
  UpdateJobRequest,
  HttpJobConfig,
  ScriptJobConfig,
  RetryConfig,
} from '../types';
import { jobApi } from '../services/api';

const { TextArea } = Input;
const { Option } = Select;
const { Group: RadioGroup } = Radio;

interface JobFormModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  job?: Job | null;
}

const JobFormModal: React.FC<JobFormModalProps> = ({ open, onCancel, onSuccess, job }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [cronValidating, setCronValidating] = useState(false);
  const [cronDescription, setCronDescription] = useState<string>('');
  const [cronValid, setCronValid] = useState<boolean | null>(null);
  const [previewExecutions, setPreviewExecutions] = useState<Array<{ timestamp: number; iso: string; local: string }>>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const jobType = Form.useWatch('type', form);
  const scheduleType = Form.useWatch('scheduleType', form);
  const cronExpression = Form.useWatch('cronExpression', form);
  const executeAt = Form.useWatch('executeAt', form);

  const isEdit = !!job;

  useEffect(() => {
    if (open) {
      form.resetFields();
      setCronDescription('');
      setCronValid(null);
      setPreviewExecutions([]);
      if (job) {
        const formData = {
          name: job.name,
          description: job.description || '',
          type: job.type,
          scheduleType: job.scheduleType,
          cronExpression: job.cronExpression || '',
          executeAt: job.executeAt ? dayjs(job.executeAt) : null,
          httpConfig: job.httpConfig
            ? {
                ...job.httpConfig,
                headers: job.httpConfig.headers ? JSON.stringify(job.httpConfig.headers, null, 2) : '',
                params: job.httpConfig.params ? JSON.stringify(job.httpConfig.params, null, 2) : '',
                body: job.httpConfig.body ? JSON.stringify(job.httpConfig.body, null, 2) : '',
              }
            : undefined,
          scriptConfig: job.scriptConfig,
          retryConfig: job.retryConfig,
        };
        form.setFieldsValue(formData);
      } else {
        form.setFieldsValue({
          type: JobType.HTTP,
          scheduleType: ScheduleType.CRON,
          cronExpression: '0 0 * * * *',
          httpConfig: {
            method: 'GET',
            url: '',
            headers: '',
            params: '',
            body: '',
          },
          retryConfig: {
            maxRetries: 3,
            retryInterval: 1000,
          },
        });
      }
    }
  }, [open, job, form]);

  useEffect(() => {
    if (scheduleType === ScheduleType.CRON && cronExpression) {
      const timer = setTimeout(() => {
        validateCron(cronExpression);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setCronDescription('');
      setCronValid(null);
    }
  }, [cronExpression, scheduleType]);

  const validateCron = async (expression: string) => {
    setCronValidating(true);
    try {
      const res = await jobApi.validateCron(expression);
      if (res.success && res.data) {
        setCronValid(res.data.valid);
        setCronDescription(res.data.description);
      } else {
        setCronValid(false);
        setCronDescription('Cron表达式无效');
      }
    } catch (error: any) {
      setCronValid(false);
      setCronDescription(error.message || 'Cron验证失败');
    } finally {
      setCronValidating(false);
    }
  };

  const handlePreview = async () => {
    if (scheduleType === ScheduleType.CRON && (!cronValid || !cronExpression)) {
      message.warning('请先输入有效的Cron表达式');
      return;
    }
    if (scheduleType === ScheduleType.ONCE && !executeAt) {
      message.warning('请先选择执行时间');
      return;
    }

    setPreviewLoading(true);
    try {
      const params = {
        scheduleType,
        cronExpression: scheduleType === ScheduleType.CRON ? cronExpression : undefined,
        executeAt: scheduleType === ScheduleType.ONCE && executeAt ? (executeAt as Dayjs).toISOString() : undefined,
        count: 5,
      };
      const res = await jobApi.previewExecutions(params);
      if (res.success && res.data) {
        setPreviewExecutions(res.data.nextExecutions);
      }
    } catch (error: any) {
      message.error(error.message || '预览失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  const validateJson = (value: string): Promise<void> => {
    if (!value) return Promise.resolve();
    try {
      JSON.parse(value);
      return Promise.resolve();
    } catch {
      return Promise.reject(new Error('JSON格式不正确'));
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const retryConfig: RetryConfig = {
        maxRetries: values.retryConfig.maxRetries,
        retryInterval: values.retryConfig.retryInterval,
      };

      let httpConfig: HttpJobConfig | undefined;
      let scriptConfig: ScriptJobConfig | undefined;

      if (values.type === JobType.HTTP) {
        httpConfig = {
          url: values.httpConfig.url,
          method: values.httpConfig.method,
          headers: values.httpConfig.headers ? JSON.parse(values.httpConfig.headers) : undefined,
          params: values.httpConfig.params ? JSON.parse(values.httpConfig.params) : undefined,
          body: values.httpConfig.body ? JSON.parse(values.httpConfig.body) : undefined,
        };
      } else {
        scriptConfig = {
          script: values.scriptConfig.script,
          interpreter: values.scriptConfig.interpreter,
        };
      }

      const requestData: CreateJobRequest | UpdateJobRequest = {
        name: values.name,
        description: values.description,
        type: values.type,
        scheduleType: values.scheduleType,
        cronExpression: values.scheduleType === ScheduleType.CRON ? values.cronExpression : undefined,
        executeAt: values.scheduleType === ScheduleType.ONCE && values.executeAt ? values.executeAt.toISOString() : undefined,
        httpConfig,
        scriptConfig,
        retryConfig,
      };

      if (isEdit && job) {
        await jobApi.updateJob(job._id, requestData);
        message.success('任务更新成功');
      } else {
        await jobApi.createJob(requestData as CreateJobRequest);
        message.success('任务创建成功');
      }

      onSuccess();
      onCancel();
    } catch (error: any) {
      if (error.errorFields) {
        message.error('表单验证失败，请检查填写内容');
      } else {
        message.error(error.message || (isEdit ? '任务更新失败' : '任务创建失败'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={isEdit ? '编辑任务' : '新增任务'}
      open={open}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="submit" type="primary" loading={loading} onClick={handleSubmit}>
          {isEdit ? '更新' : '创建'}
        </Button>,
      ]}
      width={800}
      destroyOnClose
      maskClosable={false}
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="name"
              label="任务名称"
              rules={[{ required: true, message: '请输入任务名称' }, { max: 100, message: '最多100个字符' }]}
            >
              <Input placeholder="请输入任务名称" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="description" label="任务描述">
              <Input placeholder="请输入任务描述" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="type" label="任务类型" rules={[{ required: true, message: '请选择任务类型' }]}>
              <RadioGroup>
                <Radio value={JobType.HTTP}>HTTP 请求</Radio>
                <Radio value={JobType.SCRIPT}>脚本执行</Radio>
              </RadioGroup>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="scheduleType" label="调度方式" rules={[{ required: true, message: '请选择调度方式' }]}>
              <RadioGroup>
                <Radio value={ScheduleType.CRON}>Cron 调度</Radio>
                <Radio value={ScheduleType.ONCE}>一次性执行</Radio>
              </RadioGroup>
            </Form.Item>
          </Col>
        </Row>

        {jobType === JobType.HTTP && (
          <Card title="HTTP 配置" size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={16}>
                <Form.Item
                  name={['httpConfig', 'url']}
                  label="请求URL"
                  rules={[{ required: true, message: '请输入请求URL' }]}
                >
                  <Input placeholder="https://example.com/api" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name={['httpConfig', 'method']}
                  label="请求方法"
                  rules={[{ required: true, message: '请选择请求方法' }]}
                >
                  <Select>
                    <Option value="GET">GET</Option>
                    <Option value="POST">POST</Option>
                    <Option value="PUT">PUT</Option>
                    <Option value="DELETE">DELETE</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name={['httpConfig', 'headers']} label="请求头 (JSON)" rules={[{ validator: (_, v) => validateJson(v) }]}>
              <TextArea rows={3} placeholder='{"Authorization": "Bearer xxx"}' />
            </Form.Item>
            <Form.Item name={['httpConfig', 'params']} label="URL参数 (JSON)" rules={[{ validator: (_, v) => validateJson(v) }]}>
              <TextArea rows={3} placeholder='{"page": 1, "size": 10}' />
            </Form.Item>
            <Form.Item name={['httpConfig', 'body']} label="请求体 (JSON)" rules={[{ validator: (_, v) => validateJson(v) }]}>
              <TextArea rows={3} placeholder='{"key": "value"}' />
            </Form.Item>
          </Card>
        )}

        {jobType === JobType.SCRIPT && (
          <Card title="脚本配置" size="small" style={{ marginBottom: 16 }}>
            <Form.Item
              name={['scriptConfig', 'interpreter']}
              label="脚本解释器"
              rules={[{ required: true, message: '请选择脚本解释器' }]}
            >
              <Select>
                <Option value="node">Node.js</Option>
                <Option value="python">Python</Option>
                <Option value="bash">Bash</Option>
                <Option value="powershell">PowerShell</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name={['scriptConfig', 'script']}
              label="脚本内容"
              rules={[{ required: true, message: '请输入脚本内容' }]}
            >
              <TextArea rows={8} placeholder="console.log('Hello World');" />
            </Form.Item>
          </Card>
        )}

        {scheduleType === ScheduleType.CRON && (
          <Card title="Cron 调度配置" size="small" style={{ marginBottom: 16 }}>
            <Form.Item
              name="cronExpression"
              label="Cron 表达式"
              rules={[{ required: true, message: '请输入Cron表达式' }]}
              help={
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  {cronValidating && <span>验证中...</span>}
                  {cronValid === true && (
                    <Alert type="success" showIcon message={cronDescription} />
                  )}
                  {cronValid === false && (
                    <Alert type="error" showIcon message={cronDescription || 'Cron表达式无效'} />
                  )}
                  <span style={{ color: '#999', fontSize: 12 }}>
                    格式: 秒 分 时 日 月 周 | 示例: 0 0 12 * * * (每天12点)
                  </span>
                </Space>
              }
            >
              <Input placeholder="0 0 * * * *" />
            </Form.Item>
            <Form.Item label="执行预览">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button type="dashed" onClick={handlePreview} loading={previewLoading} block>
                  预览接下来5次执行时间
                </Button>
                {previewExecutions.length > 0 && (
                  <Space wrap>
                    {previewExecutions.map((exec, index) => (
                      <Tag key={index} color="blue">
                        {exec.local}
                      </Tag>
                    ))}
                  </Space>
                )}
              </Space>
            </Form.Item>
          </Card>
        )}

        {scheduleType === ScheduleType.ONCE && (
          <Card title="一次性执行配置" size="small" style={{ marginBottom: 16 }}>
            <Form.Item
              name="executeAt"
              label="执行时间"
              rules={[{ required: true, message: '请选择执行时间' }]}
            >
              <DatePicker showTime style={{ width: '100%' }} disabledDate={(d) => d && d.isBefore(dayjs())} />
            </Form.Item>
            <Form.Item label="执行预览">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button type="dashed" onClick={handlePreview} loading={previewLoading} block>
                  预览执行时间
                </Button>
                {previewExecutions.length > 0 && (
                  <Space wrap>
                    {previewExecutions.map((exec, index) => (
                      <Tag key={index} color="blue">
                        {exec.local}
                      </Tag>
                    ))}
                  </Space>
                )}
              </Space>
            </Form.Item>
          </Card>
        )}

        <Card title="重试配置" size="small">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name={['retryConfig', 'maxRetries']}
                label="最大重试次数"
                rules={[{ required: true, message: '请输入最大重试次数' }]}
              >
                <InputNumber min={0} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name={['retryConfig', 'retryInterval']}
                label="重试间隔 (毫秒)"
                rules={[{ required: true, message: '请输入重试间隔' }]}
              >
                <InputNumber min={0} max={60000} step={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      </Form>
    </Modal>
  );
};

export default JobFormModal;
