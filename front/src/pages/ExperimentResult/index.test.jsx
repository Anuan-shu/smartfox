import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock react-router hooks used by the component
jest.mock('react-router-dom', () => ({
  ...(jest.requireActual('react-router-dom')),
  useParams: () => ({ experiment_id: '123' }),
  useNavigate: () => jest.fn(),
}));

// Mock the axios instance used by the component
jest.mock('../../utils/axios', () => ({
  get: jest.fn(),
}));

import axios from '../../utils/axios';
import ExperimentResult from './index.jsx';

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('ExperimentResult 页面', () => {
  test('成功场景：展示总分、百分比以及题目卡片与正确/错误标签', async () => {
    // Arrange: mock API 返回含有两道题的成功数据
    axios.get.mockResolvedValueOnce({
      data: {
        status: 'success',
        data: {
          submitted_at: '2025-01-01T00:00:00Z',
          deadline: '2025-12-31T00:00:00Z',
          total_score: 8,
          questions: [
            {
              question_id: 1,
              type: 'choice',
              score: 5,
              content: '选择题示例',
              student_answer: 'A',
              correct_answer: 'A',
              feedback: 'Correct',
            },
            {
              question_id: 2,
              type: 'code',
              score: 5,
              content: '编程题示例',
              student_code: 'print(1)',
              feedback: 'passed 3/5 test cases',
              explanation: '简单解释',
            },
          ],
        },
      },
    });

  // Act: render component
  const { container } = render(<ExperimentResult />);

  // Assert: 等待组件完成加载并显示百分比和题目信息
  await waitFor(() => expect(screen.getByText(/80%/)).toBeInTheDocument());

  // 总分/满分 精确定位显示（避免匹配到日期/时间中的数字）
  const earnedEl = container.querySelector('.earned');
  const totalEl = container.querySelector('.total');
  expect(earnedEl).toBeInTheDocument();
  expect(earnedEl).toHaveTextContent('8');
  expect(totalEl).toBeInTheDocument();
  expect(totalEl).toHaveTextContent('10');

    // 题目标题与类型显示
    expect(screen.getByText(/题目 1/)).toBeInTheDocument();
    expect(screen.getByText(/题目 2/)).toBeInTheDocument();

    // 正确/错误 tag 出现（一个正确，一个错误）
    expect(screen.getByText('正确')).toBeInTheDocument();
    expect(screen.getByText('错误')).toBeInTheDocument();

    // 编程题的学生代码和解释显示
    expect(screen.getByText(/print\(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/简单解释/)).toBeInTheDocument();
  });

  test('失败/未找到场景：当接口未返回 success 时，展示“未找到实验结果”', async () => {
    axios.get.mockResolvedValueOnce({ data: { status: 'error', message: 'not found' } });

    render(<ExperimentResult />);

    await waitFor(() => expect(screen.getByText(/未找到实验结果/)).toBeInTheDocument());
  });

  test('加载态：在请求未完成前显示加载 Spinner', async () => {
    // axios.get 返回一个永远不 resolve 的 Promise，组件应保持 loading 状态
    axios.get.mockImplementationOnce(() => new Promise(() => {}));

  const { container } = render(<ExperimentResult />);

  // 存在外层 loading 容器
  expect(container.querySelector('.loading')).toBeInTheDocument();
  // 或者 ant-spin 渲染的元素存在
  expect(container.querySelector('.ant-spin')).toBeInTheDocument();
  });

  test('无反馈或无分数题目应显示 0 分；无题目时总分为 0', async () => {
    // 场景1：题目无 feedback
    axios.get.mockResolvedValueOnce({
      data: {
        status: 'success',
        data: {
          submitted_at: null,
          deadline: '2025-12-31T00:00:00Z',
          total_score: 0,
          questions: [
            {
              question_id: 10,
              type: 'blank',
              score: 5,
              content: '无反馈题目',
              student_answer: '答',
              // feedback: undefined
            },
          ],
        },
      },
    });

    const { container } = render(<ExperimentResult />);

    // 等待渲染完成
    await waitFor(() => expect(container.querySelector('.questionCard')).toBeInTheDocument());

    // 题目分数显示为 0 / 5
    expect(screen.getByText(/0\s*\/\s*5\s*分/)).toBeInTheDocument();

    // 场景2：experiment 没有 questions
    axios.get.mockResolvedValueOnce({
      data: {
        status: 'success',
        data: {
          submitted_at: null,
          deadline: null,
          total_score: 0,
          questions: undefined,
        },
      },
    });

    const { container: c2 } = render(<ExperimentResult />);
    await waitFor(() => expect(c2.querySelector('.summaryCard')).toBeInTheDocument());

    const earnedEl = c2.querySelector('.earned');
    const totalEl = c2.querySelector('.total');
    expect(earnedEl).toHaveTextContent('0');
    expect(totalEl).toHaveTextContent('0');
  });

  test('Incorrect 反馈分支：显示错误标签且得分为 0', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        status: 'success',
        data: {
          submitted_at: null,
          deadline: null,
          total_score: 0,
          questions: [
            {
              question_id: 20,
              type: 'code',
              score: 4,
              content: 'incorrect 示例',
              student_code: 'x=1',
              feedback: 'Incorrect',
            },
          ],
        },
      },
    });

    const { container } = render(<ExperimentResult />);
    await waitFor(() => expect(container.querySelector('.questionCard')).toBeInTheDocument());

    // 得分区域应显示 0 / 4
    expect(screen.getByText(/0\s*\/\s*4\s*分/)).toBeInTheDocument();
    // 错误标签
    expect(screen.getByText('错误')).toBeInTheDocument();
  });
});
