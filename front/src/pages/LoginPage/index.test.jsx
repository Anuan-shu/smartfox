// src/pages/LoginPage/index.test.jsx
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './index.jsx';

// mock navigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// mock alert
global.alert = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
  localStorage.clear();
});

describe('LoginPage', () => {
  test('渲染表单字段', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByPlaceholderText('用户名')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('密码')).toBeInTheDocument();
    expect(screen.getByText('登录')).toBeInTheDocument();
    expect(screen.getByText('注册')).toBeInTheDocument();
  });

  test('正例: 登录成功 -> fetch 调用两次, localStorage 设置, navigate 被调用', async () => {
    // 模拟登录接口返回
    const loginResponse = { ok: true, json: async () => ({ code: 200, data: { token: 'fake-token' } }) };
    const profileResponse = { ok: true, json: async () => ({ role: 'teacher', username: 'Alice', user_id: 1 }) };
    
    global.fetch
      .mockResolvedValueOnce(loginResponse)   // 登录接口
      .mockResolvedValueOnce(profileResponse); // 获取用户信息

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('用户名'), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByPlaceholderText('密码'), { target: { value: '123456' } });
    fireEvent.click(screen.getByText('登录'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(localStorage.getItem('token')).toBe('fake-token');
      expect(localStorage.getItem('role')).toBe('teacher');
      expect(localStorage.getItem('username')).toBe('Alice');
      expect(localStorage.getItem('user_id')).toBe('1');
      expect(mockNavigate).toHaveBeenCalledWith('/experiments');
    });
  });

  test('反例: 登录失败 -> alert 错误信息', async () => {
    const loginResponse = { ok: true, json: async () => ({ code: 400, message: '用户名或密码错误' }) };
    global.fetch.mockResolvedValueOnce(loginResponse);

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('用户名'), { target: { value: 'Bob' } });
    fireEvent.change(screen.getByPlaceholderText('密码'), { target: { value: 'wrongpw' } });
    fireEvent.click(screen.getByText('登录'));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('用户名或密码错误');
      expect(localStorage.getItem('token')).toBeNull();
    });
  });

  test('反例: 网络错误 -> alert 网络请求失败', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network down'));

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('用户名'), { target: { value: 'Carol' } });
    fireEvent.change(screen.getByPlaceholderText('密码'), { target: { value: 'pw2' } });
    fireEvent.click(screen.getByText('登录'));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('network down');
      expect(localStorage.getItem('token')).toBeNull();
    });
  });

  test('点击注册按钮 -> navigate 跳转到 /register', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('注册'));
    expect(mockNavigate).toHaveBeenCalledWith('/register');
  });
});
