import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PhaseDetail from './index';
import axios from '../../utils/axios';
import { message } from 'antd';

jest.mock('../../utils/axios');

describe('PhaseDetail（更详细交互测试）', () => {
  const experiment_id = 'exp1';
  const phase_id = 'phase1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderWithRouter = (ui) =>
    render(
      <MemoryRouter initialEntries={[`/experiment/${experiment_id}/phase/${phase_id}`]}>
        <Routes>
          <Route path="/experiment/:experiment_id/phase/:phase_id" element={ui} />
        </Routes>
      </MemoryRouter>
    );

  test('加载态、请求 URL、填写并保存（成功路径）', async () => {
    // 准备返回的数据
    const phaseData = { title: 'Phase 1', description: 'Phase description' };

    // mock axios.get 和 axios.post
    axios.get.mockResolvedValueOnce({ data: phaseData });
    axios.post.mockResolvedValueOnce({});

    // 监控 success 消息
    const successSpy = jest.spyOn(message, 'success').mockImplementation(() => {});

    // 渲染组件

    const { container } = renderWithRouter(<PhaseDetail />);

    // 初始应显示 loading 指示（通过 aria-busy 判断）
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();

    // axios.get 应该被调用到正确的详情接口
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        `/api/student/experiment/${experiment_id}/phase/${phase_id}/details`
      );
    });

    // 等待界面渲染出数据
    expect(await screen.findByText('Phase 1')).toBeInTheDocument();
    expect(screen.getByText('Phase description')).toBeInTheDocument();

    // 填写答案并触发保存
    const textarea = screen.getByPlaceholderText('请输入你的答案...');
    fireEvent.change(textarea, { target: { value: '我的答案' } });
    expect(textarea.value).toBe('我的答案');

    const saveBtn = screen.getByRole('button', { name: /保存答案/i });
    // 点击保存
    fireEvent.click(saveBtn);

    // 等待 axios.post 被正确调用
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        `/api/student/experiment/${experiment_id}/phase/${phase_id}/save`,
        { answer: '我的答案' }
      );
    });

    // success message 被触发
    expect(successSpy).toHaveBeenCalledWith('答案保存成功');
    successSpy.mockRestore();
  });

  test('保存失败时展示错误提示（保存路径异常）', async () => {
    const phaseData = { title: 'Phase 2', description: '另一个阶段' };
    axios.get.mockResolvedValueOnce({ data: phaseData });

    // 模拟保存失败
    axios.post.mockRejectedValueOnce({ response: { data: { message: '保存失败，请重试' } } });

    const errorSpy = jest.spyOn(message, 'error').mockImplementation(() => {});

    const { container } = renderWithRouter(<PhaseDetail />);

    // 等待数据加载
    expect(await screen.findByText('Phase 2')).toBeInTheDocument();

    // 输入并点击保存
    const textarea = screen.getByPlaceholderText('请输入你的答案...');
    fireEvent.change(textarea, { target: { value: '答案2' } });
    fireEvent.click(screen.getByRole('button', { name: /保存答案/i }));

    // 先确认 post 被发起，再断言 error message 被触发
    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith('保存失败，请重试');
    });

    errorSpy.mockRestore();
  });

  test('获取详情失败时显示错误组件（反例）', async () => {
    // 模拟获取详情失败
    axios.get.mockRejectedValueOnce({ response: { data: { message: '获取失败' } } });

    renderWithRouter(<PhaseDetail />);

    // Alert 会显示错误信息
    expect(await screen.findByText('获取失败')).toBeInTheDocument();
  });
});
