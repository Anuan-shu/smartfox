import React from 'react';
import ProfilePage from './index';
import { render, screen, fireEvent, waitFor } from '../../setupTests';
import axios from '../../utils/axios';
import { message } from 'antd';

jest.mock('../../utils/axios');

describe('ProfilePage', () => {
  const profileData = {
    username: 'olduser',
    email: 'old@example.com',
    telephone: '1234567890',
    role: 'student',
    created_at: '2025-01-01T00:00:00Z',
    avatar_url: 'http://example.com/avatar.png',
  };

  beforeEach(() => {
    jest.spyOn(message, 'error').mockImplementation(() => {});
    jest.spyOn(message, 'success').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    // reset mocked URL.createObjectURL if set
    if (global.URL && global.URL.createObjectURL && global.URL.createObjectURL.mockRestore) {
      global.URL.createObjectURL.mockRestore();
    }
  });

  test('显示基础信息、角色、注册时间和手机号（UI断言）', async () => {
    axios.get.mockResolvedValueOnce(profileData);

    const { container } = render(<ProfilePage />);

    // 用户名输入框被填充
    const usernameInput = await screen.findByPlaceholderText('请输入用户名');
    expect(usernameInput).toHaveValue('olduser');

    // 电话号码为禁用的输入框并显示正确值
    expect(screen.getByDisplayValue('1234567890')).toBeDisabled();

    // 角色显示为学生
    expect(screen.getByDisplayValue('学生')).toBeInTheDocument();

    // 注册时间格式化显示
    const formatted = new Date(profileData.created_at).toLocaleString();
    expect(screen.getByDisplayValue(formatted)).toBeInTheDocument();

    // Avatar 使用远程头像 URL
    const avatarImg = container.querySelector('.ant-avatar img');
    expect(avatarImg).toBeTruthy();
    expect(avatarImg.getAttribute('src')).toBe(profileData.avatar_url);
  });

  test('头像上传：会使用 createObjectURL 预览新文件', async () => {
    axios.get.mockResolvedValueOnce(profileData);

    // mock URL.createObjectURL
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');

    const { container } = render(<ProfilePage />);

    // 等待表单填充
    await screen.findByPlaceholderText('请输入用户名');

    // 找到隐藏的 input[type=file] 并触发 change
    const input = container.querySelector('input[type="file"]');
    expect(input).toBeTruthy();

    const file = new File(['dummy'], 'avatar.png', { type: 'image/png', size: 1024 });
    fireEvent.change(input, { target: { files: [file] } });

    // 头像应该更新为预览的 blob url
    const avatarImg = container.querySelector('.ant-avatar img');
    await waitFor(() => {
      expect(avatarImg.getAttribute('src')).toContain('blob:mock-url');
    });
  });

  test('密码校验：有新密码但无原密码时显示错误', async () => {
    axios.get.mockResolvedValueOnce(profileData);

    render(<ProfilePage />);

    await screen.findByPlaceholderText('请输入用户名');

    const newPassword = screen.getByPlaceholderText('请输入新密码');
    fireEvent.change(newPassword, { target: { value: 'abcdef' } });

    // 提交表单
    const submitButton = screen.getByRole('button', { name: /保存修改/ });
    fireEvent.click(submitButton);

    // 校验错误文案应出现
    await screen.findByText('修改密码时原密码不能为空');
  });

  test('确认密码不一致时显示错误提示', async () => {
    axios.get.mockResolvedValueOnce(profileData);

    render(<ProfilePage />);

    await screen.findByPlaceholderText('请输入用户名');

    const oldPassword = screen.getByPlaceholderText('请输入原密码');
    const newPassword = screen.getByPlaceholderText('请输入新密码');
    const confirm = screen.getByPlaceholderText('请再次输入新密码');

    fireEvent.change(oldPassword, { target: { value: 'oldpass' } });
    fireEvent.change(newPassword, { target: { value: 'newpass1' } });
    fireEvent.change(confirm, { target: { value: 'newpass2' } });

    const submitButton = screen.getByRole('button', { name: /保存修改/ });
    fireEvent.click(submitButton);

    await screen.findByText('两次输入的密码不一致');
  });

  test('更新失败时显示后端返回的错误信息', async () => {
    axios.get.mockResolvedValueOnce(profileData);

    render(<ProfilePage />);

    await screen.findByPlaceholderText('请输入用户名');

    const usernameInput = screen.getByPlaceholderText('请输入用户名');
    fireEvent.change(usernameInput, { target: { value: 'newuser2' } });

    axios.put.mockRejectedValueOnce({ response: { data: { error: '后端错误' } } });

    const submitButton = screen.getByRole('button', { name: /保存修改/ });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('后端错误');
    });
  });

  test('更新成功时更新 localStorage 并清空密码字段', async () => {
    axios.get.mockResolvedValueOnce(profileData);

    render(<ProfilePage />);

    await screen.findByPlaceholderText('请输入用户名');

    const usernameInput = screen.getByPlaceholderText('请输入用户名');
    fireEvent.change(usernameInput, { target: { value: 'newuser' } });

    axios.put.mockResolvedValueOnce({ user_id: 1, username: 'newuser' });
    axios.get.mockResolvedValueOnce({ ...profileData, username: 'newuser' });

    const oldPassword = screen.getByPlaceholderText('请输入原密码');
    const newPassword = screen.getByPlaceholderText('请输入新密码');
    const confirm = screen.getByPlaceholderText('请再次输入新密码');

    fireEvent.change(oldPassword, { target: { value: '' } });
    fireEvent.change(newPassword, { target: { value: '' } });
    fireEvent.change(confirm, { target: { value: '' } });

    const submitButton = screen.getByRole('button', { name: /保存修改/ });
    fireEvent.click(submitButton);

    await waitFor(() => expect(message.success).toHaveBeenCalledWith('个人信息更新成功'));

    // localStorage 应该更新
    expect(localStorage.getItem('username')).toBe('newuser');

    // 密码字段应该被清空（空字符串）
    expect(screen.getByPlaceholderText('请输入原密码')).toHaveValue('');
    expect(screen.getByPlaceholderText('请输入新密码')).toHaveValue('');
    expect(screen.getByPlaceholderText('请再次输入新密码')).toHaveValue('');
  });
});
