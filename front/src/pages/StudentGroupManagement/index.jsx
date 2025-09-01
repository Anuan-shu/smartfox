// export default StudentGroupManagement;
import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Modal, 
  Form, 
  Input, 
  Select, 
  Space, 
  Divider, 
  Card, 
  Tag, 
  message, 
  Popconfirm,
  Tabs,
  Badge
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  TeamOutlined,
  UserOutlined
} from '@ant-design/icons';
import {
 studentGroupAPI
} from '../../utils/api';

const { TabPane } = Tabs;
const { Option } = Select;

const StudentGroupManagement = () => {
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [groupPagination, setGroupPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState('students');

  // 获取学生列表
  const getStudents = async (params = {}) => {
    setLoading(true);
    try {
      const { page = 1, limit = 10, group_id } = params;
      const response = await studentGroupAPI.getStudents({
        page,
        limit,
        group_id
      });
      // 确保student_id是字符串
      const formattedStudents = response.data.map(student => ({
        ...student,
        user_id: String(student.user_id),
        group_ids: student.group_ids ? student.group_ids.map(id => String(id)) : []
      }));
      setStudents(formattedStudents);
      setPagination({
        ...pagination,
        current: response.pagination.page,
        pageSize: response.pagination.limit,
        total: response.pagination.total,
      });
    } catch (error) {
      message.error('获取学生列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取分组列表
  const getGroups = async (params = {}) => {
    setLoading(true);
    try {
      const { page = 1, limit = 10 } = params;
      const response = await studentGroupAPI.getGroups({
        page,
        limit
      });
      // 确保group_id和student_ids是字符串
      const formattedGroups = response.data.map(group => ({
        ...group,
        group_id: String(group.group_id),
        student_ids: group.student_ids ? group.student_ids.map(id => String(id)) : []
      }));
      setGroups(formattedGroups);
      setGroupPagination({
        ...groupPagination,
        current: response.pagination.page,
        pageSize: response.pagination.limit,
        total: response.pagination.total,
      });
    } catch (error) {
      message.error('获取分组列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getStudents();
    getGroups();
  }, []);

  // 处理表格分页变化
  const handleTableChange = (pagination, filters, sorter) => {
    getStudents({
      page: pagination.current,
      limit: pagination.pageSize,
    });
  };

  // 处理分组表格分页变化
  const handleGroupTableChange = (pagination, filters, sorter) => {
    getGroups({
      page: pagination.current,
      limit: pagination.pageSize,
    });
  };

  // 显示创建分组模态框
  const showModal = () => {
    setIsModalVisible(true);
  };

  // 处理创建分组
  const handleCreateGroup = async () => {
    try {
      const values = await form.validateFields();
      // 确保student_ids是字符串数组
      const formattedValues = {
        ...values,
        student_ids: values.student_ids ? values.student_ids.map(id => String(id)) : []
      };
      const response = await studentGroupAPI.createGroup(formattedValues);
      message.success('分组创建成功');
      setIsModalVisible(false);
      form.resetFields();
      getGroups();
    } catch (error) {
      console.error('Error creating group:', error);
    }
  };

  // 显示编辑分组模态框
  const showEditModal = (group) => {
    setCurrentGroup(group);
    editForm.setFieldsValue({
      group_name: group.group_name,
      student_ids: group.student_ids.map(id => String(id)) // 确保是字符串
    });
    setIsEditModalVisible(true);
  };

  // 处理更新分组
  const handleUpdateGroup = async () => {
    try {
      const values = await editForm.validateFields();
      // 确保student_ids是字符串数组
      const formattedValues = {
        ...values,
        student_ids: values.student_ids ? values.student_ids.map(id => String(id)) : []
      };
      const response = await studentGroupAPI.updateGroup(
        String(currentGroup.group_id), // 确保group_id是字符串
        formattedValues
      );
      message.success('分组更新成功');
      setIsEditModalVisible(false);
      editForm.resetFields();
      getGroups();
    } catch (error) {
      console.error('Error updating group:', error);
    }
  };

  // 处理删除分组
  const handleDeleteGroup = async (groupId) => {
    try {
      await studentGroupAPI.deleteGroup(String(groupId)); // 确保group_id是字符串
      message.success('分组删除成功');
      getGroups();
    } catch (error) {
      message.error('删除分组失败');
    }
  };

  // 学生表格列定义
  const studentColumns = [
    {
      title: '学生ID',
      dataIndex: 'user_id',
      key: 'user_id',
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '电话',
      dataIndex: 'telephone',
      key: 'telephone',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '所属分组',
      dataIndex: 'group_ids',
      key: 'group_ids',
      render: (groupIds) => (
        <Space size="small">
          {groupIds.map(id => {
            const group = groups.find(g => g.group_id === String(id)); // 确保比较的是字符串
            return group ? (
              <Tag color="blue" key={id}>{group.group_name}</Tag>
            ) : null;
          })}
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => new Date(date).toLocaleString(),
    },
  ];

  // 分组表格列定义
  const groupColumns = [
    {
      title: '分组名称',
      dataIndex: 'group_name',
      key: 'group_name',
      render: (text, record) => (
        <Badge count={record.student_count} offset={[10, 0]}>
          <span>{text}</span>
        </Badge>
      ),
    },
    {
      title: '学生数量',
      dataIndex: 'student_count',
      key: 'student_count',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button 
            type="text" 
            icon={<EditOutlined />} 
            onClick={() => showEditModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个分组吗?"
            onConfirm={() => handleDeleteGroup(record.group_id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="text" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Card title="学生分组管理系统" bordered={false}>
        <Tabs 
          activeKey={activeTab} 
          onChange={(key) => setActiveTab(key)}
        >
          <TabPane tab={<span><UserOutlined />学生列表</span>} key="students">
            <Table
              columns={studentColumns}
              dataSource={students}
              rowKey="user_id"
              loading={loading}
              pagination={pagination}
              onChange={handleTableChange}
            />
          </TabPane>
          <TabPane tab={<span><TeamOutlined />分组管理</span>} key="groups">
            <div style={{ marginBottom: '16px', textAlign: 'right' }}>
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={showModal}
              >
                创建分组
              </Button>
            </div>
            <Table
              columns={groupColumns}
              dataSource={groups}
              rowKey="group_id"
              loading={loading}
              pagination={groupPagination}
              onChange={handleGroupTableChange}
            />
          </TabPane>
        </Tabs>
      </Card>

      {/* 创建分组模态框 */}
      <Modal
        title="创建新分组"
        visible={isModalVisible}
        onOk={handleCreateGroup}
        onCancel={() => setIsModalVisible(false)}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="group_name"
            label="分组名称"
            rules={[{ required: true, message: '请输入分组名称' }]}
          >
            <Input placeholder="请输入分组名称" />
          </Form.Item>
          <Form.Item
            name="student_ids"
            label="选择学生"
          >
            <Select
              mode="multiple"
              placeholder="请选择学生"
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {students.map(student => (
                <Option key={String(student.user_id)} value={String(student.user_id)}>
                  {student.username} ({student.user_id})
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑分组模态框 */}
      <Modal
        title="编辑分组"
        visible={isEditModalVisible}
        onOk={handleUpdateGroup}
        onCancel={() => setIsEditModalVisible(false)}
        okText="更新"
        cancelText="取消"
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="group_name"
            label="分组名称"
            rules={[{ required: true, message: '请输入分组名称' }]}
          >
            <Input placeholder="请输入分组名称" />
          </Form.Item>
          <Form.Item
            name="student_ids"
            label="选择学生"
          >
            <Select
              mode="multiple"
              placeholder="请选择学生"
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {students.map(student => (
                <Option key={String(student.user_id)} value={String(student.user_id)}>
                  {student.username} ({student.user_id})
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default StudentGroupManagement;