import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Avatar, Dropdown, Button } from 'antd';
import { UserOutlined, LogoutOutlined, HistoryOutlined, SettingOutlined, BellOutlined } from '@ant-design/icons';
import { logout } from '../../utils/auth';
import styles from './Navbar.module.css';

export default function Navbar() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const role = localStorage.getItem('role');

    setIsLoggedIn(!!token);
    if (token && username && role) {
      setUserInfo({ username, role });
    }
  }, [location]);

  const handleLogout = () => {
    logout();
  };

  // 用户下拉菜单
  const userMenu = (
    <Menu>
      <Menu.Item key="profile" icon={<SettingOutlined />}>
        <Link to="/profile">个人中心</Link>
      </Menu.Item>
      {userInfo?.role === 'student' && (
        <Menu.Item key="history" icon={<HistoryOutlined />}>
          <Link to="/history">历史记录</Link>
        </Menu.Item>
      )}
      <Menu.Divider />
      <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={handleLogout}>
        退出登录
      </Menu.Item>
    </Menu>
  );

  return (
    <nav className={styles.navbar}>
      <Link to="/" className={styles.logo} style={{textDecoration: 'none'}}>
        <span className={styles.logoText}>SmartFox 实验平台</span>
      </Link>

      <div className={styles.navContent}>
        {isLoggedIn && (
          <div className={styles.navLinks}>
            
            <Link
              to="/notifications"
              className={`${styles.navLink} ${location.pathname.startsWith('/notification') ? styles.active : ''}`}
            >
              <BellOutlined /> 公告通知
            </Link>
            <Link
              to="/experiments"
              className={`${styles.navLink} ${location.pathname === '/experiments' ? styles.active : ''}`}
            >
              实验列表
            </Link>
            {userInfo?.role === 'teacher' && (
              <Link
                to="/create-experiment"
                className={`${styles.navLink} ${location.pathname === '/create-experiment' ? styles.active : ''}`}
              >
                创建实验
              </Link>
              
            )}
            {userInfo?.role === 'teacher' && (
              <Link
                to="/manage-students"
                className={`${styles.navLink} ${location.pathname === '/manage-student' ? styles.active : ''}`}
              >
                管理学生
              </Link>
              
            )}
          </div>
        )}

        <div className={styles.rightSection}>
          {isLoggedIn ? (
            <div className={styles.userSection}>
              <span className={styles.userRole}>
                {userInfo?.role === 'teacher' ? '教师' : '学生'}
              </span>
              <Dropdown overlay={userMenu} placement="bottomRight">
                <div className={styles.userInfo}>
                  <Avatar size="small" icon={<UserOutlined />} />
                  <span className={styles.username}>{userInfo?.username}</span>
                </div>
              </Dropdown>
            </div>
          ) : (
            <div className={styles.authButtons}>
              <Link to="/login">
                <Button>登录</Button>
              </Link>
              <Link to="/register">
                <Button>注册</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}