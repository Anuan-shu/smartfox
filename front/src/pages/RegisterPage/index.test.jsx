import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from './index.jsx';

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
});

describe('RegisterPage', () => {
  test('正例: 渲染表单字段并默认选中学生', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    expect(screen.getByPlaceholderText('用户名')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('密码')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('手机号')).toBeInTheDocument();
    expect(screen.getByLabelText('学生')).toBeChecked();
  });

  test('反例: 默认情况下教师不应被选中', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );
    expect(screen.getByLabelText('教师')).not.toBeChecked();
  });

  test('正例: 提交表单成功 -> fetch 被调用, alert 成功, 跳转 login', async () => {
    const fakeResponse = { ok: true, json: async () => ({ message: 'ok' }) };
    global.fetch.mockResolvedValue(fakeResponse);

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('用户名'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByPlaceholderText('密码'), { target: { value: 'secret' } });
    fireEvent.change(screen.getByPlaceholderText('手机号'), { target: { value: '12345678901' } });
    fireEvent.click(screen.getByText('注册'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.alert).toHaveBeenCalledWith('注册成功');
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  test('反例: 提交表单失败 -> fetch ok=false, alert 失败信息', async () => {
    const fakeResponse = { ok: false, json: async () => ({ message: '用户名已存在' }) };
    global.fetch.mockResolvedValue(fakeResponse);

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('用户名'), { target: { value: 'bob' } });
    fireEvent.change(screen.getByPlaceholderText('密码'), { target: { value: 'pw' } });
    fireEvent.change(screen.getByPlaceholderText('手机号'), { target: { value: '12345678901' } });
    fireEvent.click(screen.getByText('注册'));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('用户名已存在');
    });
  });

  test('正例: fetch 正常调用一次', async () => {
    const fakeResponse = { ok: true, json: async () => ({}) };
    global.fetch.mockResolvedValue(fakeResponse);

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('用户名'), { target: { value: 'test' } });
    fireEvent.change(screen.getByPlaceholderText('密码'), { target: { value: 'pw' } });
    fireEvent.change(screen.getByPlaceholderText('手机号'), { target: { value: '12345678901' } });
    fireEvent.click(screen.getByText('注册'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  test('反例: 网络错误 -> fetch reject, alert 网络请求失败', async () => {
    global.fetch.mockRejectedValue(new Error('network down'));

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('用户名'), { target: { value: 'carl' } });
    fireEvent.change(screen.getByPlaceholderText('密码'), { target: { value: 'pw2' } });
    fireEvent.change(screen.getByPlaceholderText('手机号'), { target: { value: '12345678901' } });
    fireEvent.click(screen.getByText('注册'));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('网络请求失败');
    });
  });

  test('正例: 切换角色 -> 选择教师后教师被选中', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByLabelText('教师'));
    expect(screen.getByLabelText('教师')).toBeChecked();
  });

  test('反例: 切换角色 -> 选择教师后学生不再选中', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByLabelText('教师'));
    expect(screen.getByLabelText('学生')).not.toBeChecked();
  });
});