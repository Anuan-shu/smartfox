import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  List,
  Tag,
  Select,
  Input,
  DatePicker,
  Button,
  Space,
  Typography,
  message,
  Spin,
  Empty
} from 'antd';
import {
  BellOutlined,
  ExclamationCircleOutlined,
  SearchOutlined,
  ClearOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { notificationAPI, experimentAPI } from '../../utils/api';
import styles from './NotificationList.module.css';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

export default function NotificationList() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });

  // 筛选条件
  const [filters, setFilters] = useState({
    experiment_id: '',
    is_important: undefined,
    created_after: '',
    search: ''
  });

  useEffect(() => {
    const role = localStorage.getItem('role');
    setUserRole(role);

    const fetchExperiments = async () => {
      try {
        const response = await experimentAPI.getExperiments(role);
        setExperiments(response.data || []);
      } catch (error) {
        console.error('获取实验列表失败:', error);
      }
    };
    fetchExperiments();
  }, []);

  const fetchNotifications = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const params = {
        page,
        page_size: pageSize,
        ...filters
      };

      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === undefined) {
          delete params[key];
        }
      });

      const studentId = localStorage.getItem('user_id');
      const response =
        userRole === 'student'
          ? await notificationAPI.getStudentNotifications(studentId, params)
          : await notificationAPI.getTeacherNotifications(params);

      setNotifications(response.data || []);
      setPagination({
        current: response.pagination?.page || 1,
        pageSize: response.pagination?.limit || 10,
        total: response.pagination?.total || 0
      });
    } catch (error) {
      message.error('获取公告列表失败');
      console.error('获取公告列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userRole) fetchNotifications();
  }, [filters, userRole]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleClearFilters = () => {
    setFilters({
      experiment_id: '',
      is_important: undefined,
      created_after: '',
      search: ''
    });
  };

  const handlePageChange = (page, pageSize) => {
    fetchNotifications(page, pageSize);
  };

  const renderNotificationItem = (item) => {
    const experiment = experiments.find(exp => exp.experiment_id === item.experiment_id);

    return (
      <List.Item key={item.id}>
        <Card
          className={`${styles.notificationCard} ${item.is_important ? styles.important : ''}`}
          hoverable
        >
          <div className={styles.notificationHeader}>
            <div className={styles.titleSection}>
              <Space>
                {item.is_important && <ExclamationCircleOutlined className={styles.importantIcon} />}
                <BellOutlined />
                <Title level={4} className={styles.title}>{item.title}</Title>
              </Space>
              {item.is_important && <Tag color="red">重要</Tag>}
            </div>
            <Text type="secondary" className={styles.time}>
              {dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}
            </Text>
          </div>

          <Paragraph className={styles.content}>{item.content}</Paragraph>

          {item.experiment_id && experiment && (
            <div className={styles.experimentTag}>
              <Tag color="blue">关联实验: {experiment.title}</Tag>
            </div>
          )}
        </Card>
      </List.Item>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <Title level={2} style={{ margin: 0 }}>
            <BellOutlined /> 公告通知
          </Title>
          {userRole === 'teacher' && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/create-notification')}
            >
              发布公告
            </Button>
          )}
        </div>

        <Card className={styles.filterCard}>
          <Space wrap size="middle">
            <Select
              placeholder="选择实验"
              style={{ width: 200 }}
              value={filters.experiment_id}
              onChange={(value) => handleFilterChange('experiment_id', value)}
              allowClear
            >
              {experiments.map(exp => (
                <Option key={exp.experiment_id} value={exp.experiment_id}>
                  {exp.title}
                </Option>
              ))}
            </Select>

            <Select
              placeholder="重要性"
              style={{ width: 120 }}
              value={filters.is_important}
              onChange={(value) => handleFilterChange('is_important', value)}
              allowClear
            >
              <Option value={true}>重要</Option>
              <Option value={false}>普通</Option>
            </Select>

            <DatePicker
              placeholder="创建时间之后"
              value={filters.created_after ? dayjs(filters.created_after) : null}
              onChange={(date) => handleFilterChange('created_after', date ? date.toISOString() : '')}
            />

            <Button icon={<ClearOutlined />} onClick={handleClearFilters}>清空筛选</Button>
          </Space>
        </Card>
      </div>

      <Spin spinning={loading}>
        {notifications.length > 0 ? (
          <List
            dataSource={notifications}
            renderItem={renderNotificationItem}
            pagination={{
              ...pagination,
              onChange: handlePageChange,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条公告`
            }}
          />
        ) : (
          <Empty description="暂无公告" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Spin>
    </div>
  );
}
