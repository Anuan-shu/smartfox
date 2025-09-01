// src/utils/auth.js
export const logout = () => {
    // 清除所有认证相关存储
    localStorage.removeItem('token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_id');
    
    // 强制刷新页面清除状态
    window.location.reload();
    window.location.href = '/login';
  };
  
  // 可选：获取当前用户信息
  export const getCurrentUser = () => {
    return {
      id: localStorage.getItem('user_id'),
      role: localStorage.getItem('user_role'),
      token: localStorage.getItem('token')
    };
  };