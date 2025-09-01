import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import 'antd/dist/reset.css';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ExperimentDetail from './pages/ExperimentDetail';
import CreateExperiment from './pages/CreateExperiment';
import EditExperiment from './pages/EditExperiment';
import ExperimentList from './pages/ExperimentList';
import ProfilePage from './pages/ProfilePage';
import PhaseDetail from './pages/PhaseDetail'; // 新增阶段详情组件
import HistoryPage from './pages/HistoryPage'; // 新增历史成绩组件
import ExperimentResult from './pages/ExperimentResult'; // 新增评测结果组件
import NotificationList from './pages/NotificationList'; // 新增公告列表组件
import CreateNotification from './pages/CreateNotification'; // 新增公告发布组件
import StudentGroupManagement from './pages/StudentGroupManagement';

export default function App() {
  return (
    <Router>
      <div className="app-container">
        <Navbar />
        <Routes>
          {/* 默认路由重定向到实验列表 */}
          <Route path="/" element={<Navigate to="/experiments" replace />} />
          
          {/* 登录注册页 */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          
          {/* 实验相关路由 */}
          <Route path="/experiments" element={<ExperimentList />} />
          <Route path="/experiments/:experiment_id" element={<ExperimentDetail />} />
          <Route path="/experiments/:experiment_id/phase/:phase_id" element={<PhaseDetail />} />
          <Route path="/experiments/:experiment_id/result" element={<ExperimentResult />} />
          
          {/* 公告相关路由 */}
          <Route path="/notifications" element={<NotificationList />} />

          {/* 教师专属路由 */}
          <Route path="/create-experiment" element={<CreateExperiment />} />
          <Route path="/edit-experiment/:experiment_id" element={<EditExperiment />} />
          <Route path="/create-notification" element={<CreateNotification />} />
          <Route path='/manage-students' element={<StudentGroupManagement />} />
          
          {/* 用户个人中心 */}
          <Route path="/profile" element={<ProfilePage />} />

          {/* 历史成绩 */}
          <Route path="/history" element={<HistoryPage />} />
          
          {/* 404处理 */}
          <Route path="*" element={<div className="not-found">404 | 页面不存在</div>} />
        </Routes>
      </div>
    </Router>
  );
}