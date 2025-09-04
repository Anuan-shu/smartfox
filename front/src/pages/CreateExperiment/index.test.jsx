// src/pages/CreateExperiment/index.test.jsx
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CreateExperiment from './index.jsx';
import { Form } from 'antd';

// mock navigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// mock api
jest.mock('../../utils/api', () => ({
  experimentAPI: {
    createExperiment: jest.fn(),
    uploadExperimentAttachment: jest.fn(),
  },
  studentGroupAPI: {
    getGroups: jest.fn(),
  },
  userAPI: {
    getStudentList: jest.fn(),
  }
}));

beforeEach(() => {
  jest.clearAllMocks();
  global.alert = jest.fn();
  // provide safe defaults for API calls used in useEffect
  const api = require('../../utils/api');
  api.userAPI.getStudentList.mockResolvedValue({ student_ids: ['s1'] });
  api.studentGroupAPI.getGroups.mockResolvedValue({ data: [{ group_id: 'g1', group_name: 'G1', student_count: 1, student_ids: ['s1'] }], pagination: { page: 1, limit: 10, total: 1 } });
  api.experimentAPI.createExperiment.mockResolvedValue({ status: 'success', data: { experiment_id: 42 } });
});

describe('CreateExperiment 页面单元测试', () => {
  test('渲染基本字段', () => {
    render(
      <MemoryRouter>
        <CreateExperiment />
      </MemoryRouter>
    );

    // 检查页面上关键字段存在
    expect(screen.getByPlaceholderText('如：计算机网络原理实验二')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请在此输入实验要求、目标等描述信息...')).toBeInTheDocument();
    expect(screen.getByText('创建实验')).toBeInTheDocument();
  });
  test('正例: 点击添加选择题后显示题目编辑器', async () => {
    render(
      <MemoryRouter>
        <CreateExperiment />
      </MemoryRouter>
    );

    // 点击添加选择题按钮
    fireEvent.click(screen.getByText('选择题'));

  // 题目编辑器应显示（等待输入框出现）
  const input = await screen.findByPlaceholderText('请输入题目内容...');
  expect(input).toBeInTheDocument();
  });

  test('反例: 未填写必填字段时点击创建 -> 显示表单校验错误', async () => {
    render(
      <MemoryRouter>
        <CreateExperiment />
      </MemoryRouter>
    );

    // 直接点击创建（表单必填项为空）
    fireEvent.click(screen.getByText('创建实验'));

    // 应显示校验错误提示（例如实验标题）
    await waitFor(() => {
      expect(screen.getByText('请输入实验标题')).toBeInTheDocument();
      expect(screen.getByText('请输入实验描述')).toBeInTheDocument();
    });
  });
});
