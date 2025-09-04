import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import HistoryPage from './index';
import axios from '../../utils/axios';

jest.mock('../../utils/axios');

const renderWithProviders = (ui) =>
  render(
    <ConfigProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </ConfigProvider>
  );

describe('HistoryPage', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('正例：成功获取并展示提交记录（graded）并检查链接与时间显示', async () => {
    const mockData = [
      {
        experiment_id: 1,
        experiment_title: '实验 A',
        total_score: 95,
        submitted_at: '2025-01-01T10:00:00.000Z',
        status: 'graded',
        results: [{ score: 50 }, { score: 45 }]
      }
    ];

    axios.get.mockResolvedValueOnce({
      status: 'success',
      data: mockData,
      pagination: { page: 1, total: 1 }
    });

    const { container } = renderWithProviders(<HistoryPage />);

    // 等待并断言页面展示提交记录标题和具体条目内容
    expect(await screen.findByText(/实验 A/)).toBeInTheDocument();
    expect(screen.getByText(/得分: 95 分/)).toBeInTheDocument();
    expect(screen.getByText(/已评分/)).toBeInTheDocument();

    // 时间显示使用 toLocaleString，断言包含年数字（简单且稳定）
    const expectedTimeFragment = new Date(mockData[0].submitted_at).getFullYear().toString();
    expect(screen.getByText(new RegExp(expectedTimeFragment))).toBeInTheDocument();

    // 每道题目的分数标签存在
    expect(screen.getByText(/题1: 50分/)).toBeInTheDocument();
    expect(screen.getByText(/题2: 45分/)).toBeInTheDocument();

    // 链接渲染为正确 href
    const viewLink = screen.getByRole('link', { name: /查看详情/ });
    expect(viewLink).toBeInTheDocument();
    expect(viewLink.getAttribute('href')).toBe('/experiments/1/result');

    // antd Pagination not expected for single item (total == 1)
    expect(container.querySelector('.ant-pagination')).toBeNull();
  });

  test('正例：空提交列表展示提示（暂无提交记录）', async () => {
    axios.get.mockResolvedValueOnce({ status: 'success', data: [], pagination: { page: 1, total: 0 } });

    renderWithProviders(<HistoryPage />);

    expect(await screen.findByText(/暂无提交记录/)).toBeInTheDocument();
    expect(screen.getByText(/您还没有提交过任何实验/)).toBeInTheDocument();
  });

  test('正例：分页出现（total 大于 limit）与 submitted 状态渲染', async () => {
    const many = [
      { experiment_id: 2, experiment_title: '实验 B', total_score: 0, submitted_at: '2025-02-01T08:00:00.000Z', status: 'submitted', results: [] }
    ];

    axios.get.mockResolvedValueOnce({ status: 'success', data: many, pagination: { page: 1, total: 25 } });

    const { container } = renderWithProviders(<HistoryPage />);

    // 实验标题与已提交状态
    expect(await screen.findByText(/实验 B/)).toBeInTheDocument();
    expect(screen.getByText(/已提交/)).toBeInTheDocument();

    // 由于 results 为空，不应展示题目完成情况的标签（不包含 '题1'）
    expect(screen.queryByText(/题1:/)).toBeNull();

    // 分页组件应该存在（ant 的类名）
    expect(container.querySelector('.ant-pagination')).not.toBeNull();
  });

  test('反例：请求出错时展示错误提示', async () => {
    axios.get.mockRejectedValueOnce({ response: { data: { message: '获取历史失败' } } });

    renderWithProviders(<HistoryPage />);

    // 等待并断言错误提示出现
    expect(await screen.findByText(/获取历史失败/)).toBeInTheDocument();
  });
});
