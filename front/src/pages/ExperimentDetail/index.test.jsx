import React from 'react';
import { render, screen, waitFor, fireEvent } from '../../setupTests';
import * as router from 'react-router-dom';
import axios from '../../utils/axios';

// Mock react-router-dom hooks before importing the component
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn(),
  useNavigate: jest.fn(),
}));

import ExperimentDetail from './index';

// Provide a lightweight Editor substitute to avoid pulling in the real
// external editor during test runs; the substitute mirrors the
// onChange/value contract the component expects.
jest.mock('@monaco-editor/react', () => (props) => {
  const { value, onChange } = props;
  return (
    <textarea
      data-testid="editor-substitute"
      value={value || ''}
      onChange={(e) => onChange && onChange(e.target.value)}
    />
  );
});

jest.mock('../../utils/axios');

describe('ExperimentDetail', () => {
  // useParams and useNavigate are mocked above; reference them here

  beforeEach(() => {
    jest.clearAllMocks();
    // default params
  router.useParams.mockReturnValue({ experiment_id: 'exp1' });
  router.useNavigate.mockReturnValue(() => jest.fn());
    localStorage.clear();
  });

  it('学生视角：展示实验信息、题目与附件，编辑后能触发保存流程', async () => {
    // arrange
    localStorage.setItem('role', 'student');

    const futureDeadline = new Date(Date.now() + 1000 * 60 * 60).toISOString();
    const fakeExperiment = {
      title: 'Test Experiment',
      deadline: futureDeadline,
      description: '实验描述文本',
      submission_status: 'open',
      permission: 1,
      questions: [
        { question_id: 'q1', type: 'blank', content: '请填写姓名', score: 5 },
        { question_id: 'q2', type: 'code', content: '实现函数', score: 10 }
      ]
    };

    axios.get.mockImplementation((endpoint) => {
      if (endpoint === '/student/experiments/exp1') {
        return Promise.resolve({ status: 'success', data: fakeExperiment });
      }
      if (endpoint === '/experiments/exp1/files') {
        return Promise.resolve({ files: ['attachment.pdf'] });
      }
      return Promise.resolve({});
    });

    axios.post.mockResolvedValue({ status: 'success' });

    // helper to render
    const { container } = render(<ExperimentDetail />);

    // act & assert: wait for experiment title and description
    await waitFor(() => expect(screen.getByText('Test Experiment')).toBeInTheDocument());
    expect(screen.getByText('实验描述文本')).toBeInTheDocument();

    // deadline formatting appears in sidebar
    expect(screen.getByText(/截止时间:/)).toBeInTheDocument();

    // attachments shown
    expect(screen.getByText('attachment.pdf')).toBeInTheDocument();

    // blank input exists and can be changed
    const blankInput = screen.getByPlaceholderText('请输入答案');
    expect(blankInput).toBeInTheDocument();
    fireEvent.change(blankInput, { target: { value: '张三' } });
    expect(blankInput.value).toBe('张三');

    // editor substitute exists and can accept code
    const editor = screen.getByTestId('editor-substitute');
    expect(editor).toBeInTheDocument();
    fireEvent.change(editor, { target: { value: 'def f():\n  return 1' } });
    expect(editor.value).toContain('def f()');

    // after edits, UI should indicate unsaved changes
    await waitFor(() => expect(container.querySelector('div[style*="color: orange"]') || screen.queryByText('有未保存的更改')).toBeTruthy());

    // 保存按钮可见且可点击，点击后会触发后端保存请求
    const saveButton = screen.getByText('保存答案');
    expect(saveButton).toBeInTheDocument();
    fireEvent.click(saveButton);

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/student/experiments/exp1/save'), expect.any(Object)));

    // 最后额外断言：组件主要区域仍然渲染题目列表
    expect(screen.getByText('请填写姓名')).toBeInTheDocument();
  });

  it('教师视角：能看到参与学生列表，点击查看提交时能正确处理服务端返回的异常', async () => {
    // arrange
    localStorage.setItem('role', 'teacher');

    const fakeExperiment = {
      title: 'Teacher Exp',
      deadline: new Date().toISOString(),
      description: '教师视角描述',
      submission_status: 'open',
      student_ids: ['stu1'],
      questions: []
    };

    axios.get.mockImplementation((endpoint) => {
      if (endpoint === '/teacher/experiments/exp1') {
        return Promise.resolve({ status: 'success', data: fakeExperiment });
      }
      if (endpoint === '/experiments/exp1/files') {
        return Promise.resolve({ files: [] });
      }
      // Simulate server error when fetching submission
      if (endpoint === '/teacher/experiments/exp1/stu1/submissions') {
        return Promise.reject({ response: { data: { message: 'not found' } } });
      }
      return Promise.resolve({});
    });

    render(<ExperimentDetail />);

    // wait for title and student list to render
    await waitFor(() => expect(screen.getByText('Teacher Exp')).toBeInTheDocument());
    expect(screen.getByText('stu1')).toBeInTheDocument();

    // click the 查看提交 action for the listed student
    const viewButton = screen.getByText('查看提交');
    expect(viewButton).toBeInTheDocument();
    fireEvent.click(viewButton);

    // After the failing request, modal should show an error message (either server message or fallback text)
    await waitFor(() => expect(screen.queryByText(/not found|获取学生提交记录失败/)).toBeTruthy());

  // modal should also show a close button so the teacher can dismiss
  // Antd may insert spacing between characters in some environments,
  // so match flexibly using a regex that allows optional whitespace.
  expect(screen.getByRole('button', { name: /关\s*闭|关闭/ })).toBeInTheDocument();
  });
});
