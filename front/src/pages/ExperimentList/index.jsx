import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { message, Spin, Pagination } from 'antd';
import axios from '../../utils/axios';
import styles from './ExperimentList.module.css';

export default function ExperimentList() {
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0
  });
  const [status, setStatus] = useState('all');

  const fetchExperiments = async (page = 1, statusFilter = 'all') => {
    setLoading(true);
    try {
      const userRole = localStorage.getItem('role');
      const endpoint = userRole === 'teacher' ? '/teacher/experiments' : '/student/experiments';

      const response = await axios.get(endpoint, {
        params: {
          page,
          limit: pagination.limit,
          status: statusFilter
        }
      });

      if (response.status === 'success') {
        setExperiments(response.data);
        setPagination(prev => ({
          ...prev,
          page: response.pagination.page,
          total: response.pagination.total
        }));
      }
    } catch (error) {
      console.error('获取实验列表失败:', error);
      message.error('获取实验列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExperiments(1, 'all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatusStyle = (status) => {
    switch(status) {
      case 'active': return styles.active;
      case 'expired': return styles.expired;
      default: return styles.notStarted;
    }
  };

  const getStatusText = (status, submissionStatus) => {
    if (status === 'expired') return '已过期';
    if (submissionStatus === 'submitted') return '已提交';
    if (submissionStatus === 'graded') return '已评分';
    if (submissionStatus === 'in_progress') return '进行中';
    return '未开始';
  };

  const handlePageChange = (page) => {
    fetchExperiments(page, status);
  };

  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);
    fetchExperiments(1, newStatus);
  };

  const userRole = localStorage.getItem('role');

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.header}>
          <h1>实验列表</h1>
          {/* {userRole === 'teacher' && (
            <Link to="/create-experiment" className={styles.createButton}>
              创建实验
            </Link>
          )} */}
        </div>
        <div className={styles.filters}>
          <button
            className={status === 'all' ? styles.activeFilter : ''}
            onClick={() => handleStatusChange('all')}
          >
            全部
          </button>
          <button
            className={status === 'active' ? styles.activeFilter : ''}
            onClick={() => handleStatusChange('active')}
          >
            进行中
          </button>
          <button
            className={status === 'expired' ? styles.activeFilter : ''}
            onClick={() => handleStatusChange('expired')}
          >
            已过期
          </button>
        </div>
      </div>
      <div className={styles.mainContent}>
        {loading ? (
          <div className={styles.loading}>
            <Spin size="large" />
          </div>
        ) : (
          <>
            <div className={styles.grid}>
              {experiments.map(exp => (
                <div key={exp.experiment_id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={getStatusStyle(exp.status)}>
                      {getStatusText(exp.status, exp.submission_status)}
                    </span>
                    <span>{new Date(exp.deadline).toLocaleDateString()}</span>
                  </div>
                  <h3>{exp.title}</h3>
                  <p>{exp.description}</p>
                  <div className={styles.footer}>
                    <Link
                      to={`/experiments/${exp.experiment_id}`}
                      className={styles.button}
                    >
                      {userRole === 'teacher' ? '查看详情' :
                       exp.submission_status === 'graded' ? '查看结果' : '进入实验'}
                    </Link>
                    {userRole === 'teacher' && (
                      <Link
                        to={`/edit-experiment/${exp.experiment_id}`}
                        className={`${styles.button} ${styles.editButton}`}
                      >
                        编辑
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {pagination.total > pagination.limit && (
              <div className={styles.pagination}>
                <Pagination
                  current={pagination.page}
                  total={pagination.total}
                  pageSize={pagination.limit}
                  onChange={handlePageChange}
                  showSizeChanger={false}
                  showQuickJumper
                  showTotal={(total, range) =>
                    `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
                  }
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}