// src/pages/HistoryPage/index.jsx
import React, { useState, useEffect } from 'react';
import { List, Card, Spin, Alert, Pagination, Tag, Button } from 'antd';
import { Link } from 'react-router-dom';
import { EyeOutlined } from '@ant-design/icons';
import axios from '../../utils/axios';
import styles from './HistoryPage.module.css';

export default function HistoryPage() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0
  });

  const fetchSubmissions = async (page = 1) => {
    setLoading(true);
    try {
      const response = await axios.get('/student/submissions', {
        params: {
          page,
          limit: pagination.limit
        }
      });

      if (response.status === 'success') {
        setSubmissions(response.data);
        setPagination(prev => ({
          ...prev,
          page: response.pagination.page,
          total: response.pagination.total
        }));
      }
    } catch (err) {
      setError(err.response?.data?.message || '获取历史记录失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePageChange = (page) => {
    fetchSubmissions(page);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'graded': return 'green';
      case 'submitted': return 'blue';
      default: return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'graded': return '已评分';
      case 'submitted': return '已提交';
      default: return '未知状态';
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spin size="large" tip="加载历史成绩..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <Alert message={error} type="error" showIcon />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Card title="实验提交历史" className={styles.historyCard}>
        {submissions.length === 0 ? (
          <div className={styles.empty}>
            <Alert
              message="暂无提交记录"
              description="您还没有提交过任何实验"
              type="info"
              showIcon
            />
          </div>
        ) : (
          <>
            <List
              itemLayout="horizontal"
              dataSource={submissions}
              renderItem={item => (
                <List.Item
                  actions={[
                    <Link to={`/experiments/${item.experiment_id}/result`}>
                      <Button type="link" icon={<EyeOutlined />}>
                        查看详情
                      </Button>
                    </Link>
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <div className={styles.itemTitle}>
                        <span>{item.experiment_title}</span>
                        <Tag color={getStatusColor(item.status)}>
                          {getStatusText(item.status)}
                        </Tag>
                      </div>
                    }
                    description={
                      <div className={styles.itemDescription}>
                        <div className={styles.scoreInfo}>
                          <span className={styles.score}>
                            得分: {item.total_score} 分
                          </span>
                        </div>
                        <div className={styles.timeInfo}>
                          <span>提交时间: {new Date(item.submitted_at).toLocaleString()}</span>
                        </div>
                        {item.results && item.results.length > 0 && (
                          <div className={styles.resultSummary}>
                            <span>题目完成情况: </span>
                            {item.results.map((result, index) => (
                              <Tag
                                key={index}
                                color={result.score > 0 ? 'green' : 'red'}
                                size="small"
                              >
                                题{index + 1}: {result.score}分
                              </Tag>
                            ))}
                          </div>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />

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
      </Card>
    </div>
  );
}