import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Select,
  Switch,
  Button,
  Typography,
  message,
  Space,
  Divider
} from 'antd';
import {
  BellOutlined,
  SendOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import { notificationAPI, experimentAPI, userAPI } from '../../utils/api';
import styles from './CreateNotification.module.css';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

export default function CreateNotification() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [experiments, setExperiments] = useState([]);
  const [students, setStudents] = useState([]);

  // 获取实验列表和学生列表
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [expResponse, studentResponse] = await Promise.all([
          experimentAPI.getExperiments('teacher'), // 调用 /api/teacher/experiments
          userAPI.getStudentList() // 调用 /api/student_list
        ]);
        setExperiments(expResponse.data || []);
        setStudents(studentResponse.student_ids.map(id => ({ id: Number(id), name: id })) || []); // 将 student_ids 转为 { id, name } 格式
      } catch (error) {
        message.error('获取数据失败');
        console.error('获取数据失败:', error);
      }
    };
    fetchData();
  }, []);

  // 发布公告
  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const payload = {
        title: values.title,
        content: values.content,
        experiment_id: values.experiment_id || '',
        is_important: values.is_important,
        users: values.users, // 学生 ID 列表
      };
      console.log(payload);
      await notificationAPI.createNotification(payload);
      message.success('公告发布成功！');
      navigate('/notifications');
    } catch (error) {
      message.error('发布公告失败，请重试');
      console.error('发布公告失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 返回公告列表
  const handleBack = () => {
    navigate('/notifications');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Space>
          {/* <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={handleBack}
            type="text"
          >
            返回
          </Button> */}
          <Divider type="vertical" />
          <Title level={2} style={{ margin: 'auto' }}>
            <BellOutlined /> 发布公告
          </Title>
        </Space>
      </div>

      <Card className={styles.formCard}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            is_important: false,
            experiment_id: '',
            users: [],
          }}
        >
          <Form.Item
            label="公告标题"
            name="title"
            rules={[
              { required: true, message: '请输入公告标题' },
              { max: 100, message: '标题不能超过100个字符' }
            ]}
          >
            <Input 
              placeholder="请输入公告标题"
              size="large"
            />
          </Form.Item>

          <Form.Item
            label="公告内容"
            name="content"
            rules={[
              { required: true, message: '请输入公告内容' },
              { max: 1000, message: '内容不能超过1000个字符' }
            ]}
          >
            <TextArea
              placeholder="请输入公告内容"
              rows={6}
              showCount
              maxLength={1000}
            />
          </Form.Item>

          <Form.Item
            label="关联实验"
            name="experiment_id"
            help="可选择关联的实验，留空表示通用公告"
          >
            <Select
              placeholder="选择关联的实验（可选）"
              allowClear
              size="large"
            >
              {experiments.map(exp => (
                <Option key={exp.experiment_id} value={exp.experiment_id}>
                  {exp.title}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="目标用户"
            name="users"
            rules={[
              { required: true, message: '请至少选择一个用户' },
              { type: 'array', min: 1, message: '请至少选择一个用户' }
            ]}
          >
            <Select
              mode="multiple"
              placeholder="请选择目标用户"
              size="large"
              optionFilterProp="children"
              showSearch
            >
              {students.map(student => (
                <Option key={student.id} value={student.id}>
                  {student.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="重要公告"
            name="is_important"
            valuePropName="checked"
            help="重要公告将会高亮显示"
          >
            <Switch 
              checkedChildren="重要" 
              unCheckedChildren="普通"
            />
          </Form.Item>

          <Form.Item className={styles.submitSection}>
            <Space size="middle">
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading}
                icon={<SendOutlined />}
                size="large"
              >
                发布公告
              </Button>
              <Button 
                onClick={handleBack}
                size="large"
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card 
        title="预览效果" 
        className={styles.previewCard}
        size="small"
      >
        <Form.Item shouldUpdate>
          {() => {
            const values = form.getFieldsValue(['title', 'content', 'is_important', 'users']);
            const { title = '公告标题', content = '公告内容将在这里显示...', is_important = false, users = [] } = values;
            const selectedUsers = users.length > 0 
              ? users.map(id => students.find(s => s.id === id)?.name || '未知用户').join(', ')
              : '未选择用户';
            return (
              <div className={`${styles.preview} ${is_important ? styles.important : ''}`}>
                <div className={styles.previewHeader}>
                  <Space>
                    <BellOutlined />
                    <Text strong>{title}</Text>
                    {is_important && (
                      <span className={styles.importantBadge}>重要</span>
                    )}
                  </Space>
                  <Text type="secondary" className={styles.previewTime}>
                    刚刚
                  </Text>
                </div>
                <div className={styles.previewContent}>
                  {content}
                </div>
                <div className={styles.previewUsers}>
                  <Text type="secondary">接收人: {selectedUsers}</Text>
                </div>
              </div>
            );
          }}
        </Form.Item>
      </Card>
    </div>
  );
}