import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Upload, Avatar, message, Divider } from 'antd';
import { UserOutlined, UploadOutlined } from '@ant-design/icons';
import axios from '../../utils/axios';
import styles from './ProfilePage.module.css';

export default function ProfilePage() {
  const [form] = Form.useForm();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await axios.get('/auth/profile');
        setProfile(data);
        form.setFieldsValue({
          username: data.username,
          email: data.email,
          telephone: data.telephone
        });
      } catch (error) {
        console.error('获取个人信息失败:', error);
        message.error('获取个人信息失败');
      }
    };
    fetchProfile();
  }, [form]);

  // 头像上传配置
  const uploadProps = {
    name: 'avatar',
    beforeUpload: (file) => {
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        message.error('只能上传图片文件!');
        return false;
      }
      const isLt2M = file.size / 1024 / 1024 < 2;
      if (!isLt2M) {
        message.error('图片大小不能超过 2MB!');
        return false;
      }
      setAvatarFile(file);
      return false; // 阻止自动上传
    },
    showUploadList: false,
  };

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const formData = new FormData();

      // 添加基本信息
      if (values.username !== profile.username) {
        formData.append('username', values.username);
      }
      if (values.email !== profile.email) {
        formData.append('email', values.email);
      }

      // 添加密码修改
      if (values.old_password && values.new_password) {
        formData.append('old_password', values.old_password);
        formData.append('new_password', values.new_password);
      }

      // 添加头像
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      const response = await axios.put('/auth/update', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.user_id) {
        message.success('个人信息更新成功');
        // 更新本地存储的用户名
        if (response.username) {
          localStorage.setItem('username', response.username);
        }
        // 重新获取个人信息
        const updatedProfile = await axios.get('/auth/profile');
        setProfile(updatedProfile);
        setAvatarFile(null);
        // 清空密码字段
        form.setFieldsValue({
          old_password: '',
          new_password: '',
          confirm_password: ''
        });
      }
    } catch (error) {
      console.error('更新失败:', error);
      message.error(error.response?.data?.error || '更新失败');
    } finally {
      setLoading(false);
    }
  };

  if (!profile) {
    return (
      <div className={styles.loading}>
        <Card loading />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Card title="个人中心" className={styles.profileCard}>
        <div className={styles.avatarSection}>
          <Avatar
            size={100}
            src={avatarFile ? URL.createObjectURL(avatarFile) : profile.avatar_url}
            icon={<UserOutlined />}
          />
          <Upload {...uploadProps}>
            <Button icon={<UploadOutlined />} className={styles.uploadButton}>
              更换头像
            </Button>
          </Upload>
        </div>

        <Divider />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          className={styles.form}
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 2, max: 20, message: '用户名长度为2-20个字符' }
            ]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>

          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { type: 'email', message: '请输入正确的邮箱格式' }
            ]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>

          <Form.Item
            name="telephone"
            label="手机号"
          >
            <Input placeholder="手机号" disabled />
          </Form.Item>

          <Form.Item label="角色">
            <Input value={profile.role === 'student' ? '学生' : '教师'} disabled />
          </Form.Item>

          <Form.Item label="注册时间">
            <Input value={new Date(profile.created_at).toLocaleString()} disabled />
          </Form.Item>

          <Divider>修改密码</Divider>

          <Form.Item
            name="old_password"
            label="原密码"
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (getFieldValue('new_password') && !value) {
                    return Promise.reject(new Error('修改密码时原密码不能为空'));
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <Input.Password placeholder="请输入原密码" />
          </Form.Item>

          <Form.Item
            name="new_password"
            label="新密码"
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (getFieldValue('old_password') && !value) {
                    return Promise.reject(new Error('修改密码时新密码不能为空'));
                  }
                  if (value && value.length < 6) {
                    return Promise.reject(new Error('密码长度至少6位'));
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>

          <Form.Item
            name="confirm_password"
            label="确认新密码"
            dependencies={['new_password']}
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const newPassword = getFieldValue('new_password');
                  if (newPassword && !value) {
                    return Promise.reject(new Error('请确认新密码'));
                  }
                  if (newPassword && value && newPassword !== value) {
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} size="large">
              保存修改
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
