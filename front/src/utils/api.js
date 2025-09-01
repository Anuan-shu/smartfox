import axios from './axios';

// 公告相关API
export const notificationAPI = {
  createNotification: async (data) => {
    const response = await axios.post(`teacher/experiments/notifications`, data);
    return response;
  },
  // 发布公告（教师专用）
  getTeacherNotifications: async (params) => {
    const response = await axios.get(`teacher/experiments/notifications`, {
      params,
    });
    return response;
  },
  getStudentNotifications: async (studentId, params) => {
    const response = await axios.get(`student/experiments/notifications/${studentId}`, {
      params,
    });
    return response;
  },
};

// 实验相关API
export const experimentAPI = {
  // 获取实验列表
  getExperiments: (role = 'student') => {
    const endpoint = role === 'teacher' ? '/teacher/experiments' : '/student/experiments';
    return axios.get(endpoint);
  },

  // 获取实验详情
  getExperimentDetail: (experimentId, role = 'student') => {
    const endpoint = role === 'teacher'
      ? `/teacher/experiments/${experimentId}`
      : `/student/experiments/${experimentId}`;
    return axios.get(endpoint);
  },

  // 创建实验（教师）
  createExperiment: (data) => {
    return axios.post('/teacher/experiments', data);
  },

  // 更新实验（教师）
  updateExperiment: (experimentId, data) => {
    return axios.put(`/teacher/experiments/${experimentId}`, data);
  },

  // 删除实验（教师）
  deleteExperiment: (experimentId) => {
    return axios.delete(`/teacher/experiments/${experimentId}`);
  },

  // 保存实验答案
  saveExperiment: (experimentId, answers) => {
    return axios.post(`/student/experiments/${experimentId}/save`, { answers });
  },

  // 提交实验
  submitExperiment: (experimentId, answers) => {
    return axios.post(`/student/experiments/${experimentId}/submit`, { answers });
  },

  uploadExperimentAttachment: (experimentId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    return axios.post(
      `/teacher/experiments/${experimentId}/uploadFile`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          // 处理进度更新
        }
      }
    );
  }
};

// 用户相关API
export const userAPI = {
  // 登录
  login: (credentials) => {
    return axios.post('/auth/login', credentials);
  },

  // 注册
  register: (userData) => {
    return axios.post('/auth/register', userData);
  },

  // 获取用户信息
  getProfile: () => {
    return axios.get('/auth/profile');
  },

  // 获取学生列表
  getStudentList: () => {
    return axios.get('/student_list');
  }
};

// 提交记录相关API
export const submissionAPI = {
  // 获取提交历史
  getSubmissions: (params = {}) => {
    return axios.get('/student/submissions', { params });
  }
};

// 学生分组管理相关API
export const studentGroupAPI = {
  // 获取学生列表
  getStudents: (params = {}) => {
    return axios.get('/teacher/students', { params });
  },

  // 获取分组列表
  getGroups: (params = {}) => {
    return axios.get('/teacher/groups', { params });
  },

  // 创建分组
  createGroup: (data) => {
    return axios.post('/teacher/groups', data);
  },

  // 更新分组
  updateGroup: (groupId, data) => {
    return axios.put(`/teacher/groups/${groupId}`, data);
  },

  // 删除分组
  deleteGroup: (groupId) => {
    return axios.delete(`/teacher/groups/${groupId}`);
  }
};