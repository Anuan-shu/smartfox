import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './RegisterPage.module.css';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    password: '',
    telephone: '',
    role: 'student'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    console.log('请求体数据:', formData);
    try {
      const response = await fetch('http://localhost:3002/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (response.ok) {
        alert('注册成功');
        navigate('/login');
      } else {
        alert(data.message || '注册失败');
      }
    } catch (error) {
      alert('网络请求失败');
    }
  };

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.form}>
        
        <h2 className={styles.title}>用户注册</h2>

        <input
          type="text"
          placeholder="用户名"
          required
          value={formData.name}
          onChange={e => setFormData({...formData, name: e.target.value})}
        />
        <input
          type="password"
          placeholder="密码"
          required
          value={formData.password}
          onChange={e => setFormData({...formData, password: e.target.value})}
        />
        <input
          type="tel"
          placeholder="手机号"
          pattern="[0-9]{11}"
          required
          value={formData.telephone}
          onChange={e => setFormData({...formData, telephone: e.target.value})}
        />
        <div className={styles.roleSelector}>
          <label>
            <input
              type="radio"
              name="role"
              value="student"
              checked={formData.role === 'student'}
              onChange={e => setFormData({...formData, role: e.target.value})}
            />
            学生
          </label>
          <label>
            <input
              type="radio"
              name="role"
              value="teacher"
              checked={formData.role === 'teacher'}
              onChange={e => setFormData({...formData, role: e.target.value})}
            />
            教师
          </label>
        </div>
        <button type="submit">注册</button>
        <div className={styles.loginLink}>
          已有账号？<Link to="/login">立即登录</Link>
        </div>
      </form>
    </div>
  );
}