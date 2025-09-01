import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const [credentials, setCredentials] = useState({ name: '', password: '' });
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // 1. 执行登录请求
      const response = await fetch('http://localhost:3002/api/auth/login', {  // 注意接口地址更新
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: credentials.name,
          password: credentials.password
        })
      });
  
      const responseData = await response.json();
      
      // 2. 处理非200状态码
      if (responseData.code !== 200) {
        throw new Error(responseData.message || '登录失败');
      }
  
      // 3. 存储令牌
      const { token } = responseData.data;
      localStorage.setItem('token', token);
  
      // alert(token)
      // 4. 获取用户信息
      const profileResponse = await fetch('http://localhost:3002/api/auth/profile', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `${token}` // 添加 Token
        }
      });
      
      if (!profileResponse.ok) {
        throw new Error('获取用户信息失败');
      }
  
      const profileData = await profileResponse.json();
      
      // 5. 存储用户角色和基本信息
      localStorage.setItem('role', profileData.role);
      localStorage.setItem('username', profileData.username);
      localStorage.setItem('user_id', profileData.user_id);
  
      // 6. 根据角色跳转不同页面
      const redirectPath = profileData.role === 'teacher'
        ? '/experiments'
        : '/experiments';
      
      navigate(redirectPath);
  
    } catch (error) {
      // 7. 统一错误处理
      console.error('登录流程错误:', error);
      
      // 清理可能存在的无效token
      if (error.message.includes('用户信息')) {
        localStorage.removeItem('token');
      }
  
      alert(error.message || '登录流程异常，请稍后重试');
    }
  };

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <h2>用户登录</h2>
        <input
          type="text"
          placeholder="用户名"
          value={credentials.name}
          onChange={(e) => setCredentials({...credentials, name: e.target.value})}
        />
        <input
          type="password"
          placeholder="密码"
          value={credentials.password}
          onChange={(e) => setCredentials({...credentials, password: e.target.value})}
        />
        <button type="submit">登录</button>
        <button type="button" onClick={() => navigate('/register')}>注册</button>

      </form>
    </div>
  );
}