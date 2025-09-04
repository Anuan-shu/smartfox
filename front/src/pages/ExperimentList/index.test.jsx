import React from 'react';
import { render, screen, waitFor, fireEvent } from '../../setupTests';
import axios from '../../utils/axios';
import ExperimentList from './index';

// 模拟 `react-router-dom` 的 `Link`，以隔离路由依赖
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Link: ({ children, to, className }) => {
    const React = require('react');
    return React.createElement('a', { href: to, className }, children);
  }
}));

// 模拟 `antd` 的 message，以隔离 UI 库的副作用
jest.mock('antd', () => {
  const original = jest.requireActual('antd');
  return {
    ...original,
    message: {
      error: jest.fn(),
      success: jest.fn()
    }
  };
});

jest.mock('../../utils/axios');

describe('ExperimentList 页面', () => {
  const originalLocalStorage = global.localStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    // 模拟 `localStorage`（仅用于测试环境）
    let store = {};
    global.localStorage = {
      getItem: (key) => store[key] || null,
      setItem: (key, value) => { store[key] = value + ''; },
      removeItem: (key) => { delete store[key]; },
      clear: () => { store = {}; }
    };
  });

  afterEach(() => {
    global.localStorage = originalLocalStorage;
  });

  test('正例：请求成功时渲染实验卡片并显示分页信息', async () => {
  // 准备：设置 role 为 student
    global.localStorage.setItem('role', 'student');

    const mockData = [
      {
        experiment_id: 1,
        title: '实验一',
        description: '描述一',
        status: 'active',
        submission_status: 'in_progress',
        deadline: '2025-09-01T00:00:00Z'
      },
      {
        experiment_id: 2,
        title: '实验二',
        description: '描述二',
        status: 'expired',
        submission_status: 'submitted',
        deadline: '2025-09-10T00:00:00Z'
      }
    ];

    axios.get.mockResolvedValue({
      status: 'success',
      data: mockData,
      pagination: { page: 1, total: 20 }
    });

    // Act
    render(<ExperimentList />);

    // Assert: 等待两个实验标题出现在页面上
    await waitFor(() => {
      expect(screen.getByText('实验一')).toBeInTheDocument();
      expect(screen.getByText('实验二')).toBeInTheDocument();
    });

    // 检查卡片上的按钮文本（学生视角）
    expect(screen.getAllByRole('link').some(el => /进入实验|查看结果|查看详情/.test(el.textContent))).toBe(true);

    // 检查分页显示总数（应包含“共 20 条”）
    await waitFor(() => {
      expect(screen.getByText(/共\s*20\s*条/)).toBeInTheDocument();
    });
  });

  test('反例：请求失败时触发错误提示并停止加载', async () => {
    global.localStorage.setItem('role', 'student');

  // 模拟 axios 抛出错误
  axios.get.mockRejectedValue(new Error('网络错误'));

  const antd = require('antd');
  const spy = jest.spyOn(antd.message, 'error');

    render(<ExperimentList />);

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith('获取实验列表失败');
    });

  spy.mockRestore();
  });
});
