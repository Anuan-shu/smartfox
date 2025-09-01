// src/utils/axios.js
import axios from 'axios';
import { logout } from '../utils/auth';

const instance = axios.create({
  baseURL: 'http://localhost:3002/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器 - 自动添加token
instance.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 统一处理错误
instance.interceptors.response.use(
  response => response.data,
  error => {
    if (error.response) {
      switch (error.response.status) {
        case 401:
          logout(); // 触发登出
          break;
        case 403:
          console.error('权限不足');
          break;
        default:
          console.error(`API Error: ${error.response.status}`);
      }
    }
    return Promise.reject(error);
  }
);

export default instance;