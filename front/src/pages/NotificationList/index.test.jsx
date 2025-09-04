import React from 'react';
import { render, screen, waitFor, fireEvent } from '../../setupTests';
import NotificationList from './index';
import { notificationAPI, experimentAPI } from '../../utils/api';
import { message } from 'antd';

jest.mock('../../utils/api', () => ({
  notificationAPI: {
    getTeacherNotifications: jest.fn(),
    getStudentNotifications: jest.fn(),
    createNotification: jest.fn(),
  },
  experimentAPI: {
    getExperiments: jest.fn(),
  }
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

const makeNotification = (overrides = {}) => ({
  id: Math.floor(Math.random() * 10000),
  title: 'Title ' + Math.random().toString(36).slice(2, 7),
  content: 'Content text',
  is_important: false,
  created_at: '2025-01-01T00:00:00Z',
  experiment_id: '',
  ...overrides,
});

test('renders notifications for teacher and shows publish button (positive case)', async () => {
  // Arrange
  localStorage.setItem('role', 'teacher');

  experimentAPI.getExperiments.mockResolvedValue({
    data: [{ experiment_id: 'exp1', title: 'Exp 1' }]
  });

  notificationAPI.getTeacherNotifications.mockResolvedValue({
    data: [
      makeNotification({ title: 'Important Update', is_important: true, experiment_id: 'exp1' })
    ],
    pagination: { page: 1, limit: 10, total: 1 }
  });

  // Act
  render(<NotificationList />);

  // Assert
  await waitFor(() => expect(screen.getByText('Important Update')).toBeInTheDocument());
  expect(screen.getByText('发布公告')).toBeInTheDocument();
  expect(screen.getByText(/关联实验: Exp 1/)).toBeInTheDocument();
  // important tag present
  expect(screen.getByText('重要')).toBeInTheDocument();
});

test('handles API failure and shows empty state (negative case)', async () => {
  // Arrange
  localStorage.setItem('role', 'student');
  localStorage.setItem('user_id', 'stu123');

  experimentAPI.getExperiments.mockRejectedValue(new Error('fetch experiments failed'));
  notificationAPI.getStudentNotifications.mockRejectedValue(new Error('fetch notifications failed'));

  const errSpy = jest.spyOn(message, 'error');

  // Act
  render(<NotificationList />);

  // Assert: message.error should be called and Empty shown
  await waitFor(() => expect(errSpy).toHaveBeenCalledWith('获取公告列表失败'));
  expect(screen.getByText('暂无公告')).toBeInTheDocument();
  // Publish button should not be visible for students
  expect(screen.queryByText('发布公告')).not.toBeInTheDocument();
});

test('clicking publish navigates to create page for teacher', async () => {
  localStorage.setItem('role', 'teacher');

  experimentAPI.getExperiments.mockResolvedValue({ data: [] });
  notificationAPI.getTeacherNotifications.mockResolvedValue({ data: [], pagination: { page: 1, limit: 10, total: 0 } });

  render(<NotificationList />);

  await waitFor(() => expect(screen.getByText('发布公告')).toBeInTheDocument());
  fireEvent.click(screen.getByText('发布公告'));
  expect(mockNavigate).toHaveBeenCalledWith('/create-notification');
});

test('clearing filters triggers a new fetch', async () => {
  localStorage.setItem('role', 'teacher');

  experimentAPI.getExperiments.mockResolvedValue({ data: [] });

  // first call resolves with empty list
  notificationAPI.getTeacherNotifications.mockResolvedValue({ data: [], pagination: { page: 1, limit: 10, total: 0 } });

  render(<NotificationList />);

  await waitFor(() => expect(notificationAPI.getTeacherNotifications).toHaveBeenCalledTimes(1));

  // Click clear filters
  const clearButton = screen.getByText('清空筛选');
  fireEvent.click(clearButton);

  // Should trigger another fetch due to filters change
  await waitFor(() => expect(notificationAPI.getTeacherNotifications).toHaveBeenCalledTimes(2));
});

test('renders non-important notification without important tag', async () => {
  localStorage.setItem('role', 'teacher');

  experimentAPI.getExperiments.mockResolvedValue({ data: [] });

  notificationAPI.getTeacherNotifications.mockResolvedValue({
    data: [ makeNotification({ title: 'Normal Notice', is_important: false }) ],
    pagination: { page: 1, limit: 10, total: 1 }
  });

  render(<NotificationList />);

  await waitFor(() => expect(screen.getByText('Normal Notice')).toBeInTheDocument());
  expect(screen.queryByText('重要')).not.toBeInTheDocument();
});

test('shows pagination total text when many notifications', async () => {
  localStorage.setItem('role', 'teacher');

  experimentAPI.getExperiments.mockResolvedValue({ data: [] });

  const many = Array.from({ length: 15 }).map((_, i) => makeNotification({ title: `N${i + 1}` }));
  notificationAPI.getTeacherNotifications.mockResolvedValue({
    data: many.slice(0, 10),
    pagination: { page: 1, limit: 10, total: 15 }
  });

  render(<NotificationList />);

  await waitFor(() => expect(screen.getByText('N1')).toBeInTheDocument());
  // pagination summary
  expect(screen.getByText(/第 1-10 条，共 15 条公告/)).toBeInTheDocument();
});

test('notification with unknown experiment does not show association tag', async () => {
  localStorage.setItem('role', 'teacher');

  experimentAPI.getExperiments.mockResolvedValue({ data: [{ experiment_id: 'expA', title: 'Exp A' }] });

  notificationAPI.getTeacherNotifications.mockResolvedValue({
    data: [ makeNotification({ title: 'Orphan Notice', experiment_id: 'unknown' }) ],
    pagination: { page: 1, limit: 10, total: 1 }
  });

  render(<NotificationList />);

  await waitFor(() => expect(screen.getByText('Orphan Notice')).toBeInTheDocument());
  expect(screen.queryByText(/关联实验/)).not.toBeInTheDocument();
});
