// src/pages/PhaseDetail/index.jsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Form, Input, Button, Spin, Alert, message } from 'antd';
import axios from '../../utils/axios';

export default function PhaseDetail() {
  const { experiment_id, phase_id } = useParams();
  const [phaseInfo, setPhaseInfo] = useState(null);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPhaseDetail = async () => {
      try {
        const res = await axios.get(
          `/api/student/experiment/${experiment_id}/phase/${phase_id}/details`
        );
        setPhaseInfo(res.data);
      } catch (err) {
        setError(err.response?.data?.message || '获取阶段详情失败');
      } finally {
        setLoading(false);
      }
    };
    fetchPhaseDetail();
  }, [experiment_id, phase_id]);

  const handleSave = async () => {
    setSubmitting(true);
    try {
      await axios.post(
        `/api/student/experiment/${experiment_id}/phase/${phase_id}/save`,
        { answer }
      );
      message.success('答案保存成功');
    } catch (err) {
      message.error(err.response?.data?.message || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spin tip="加载阶段详情..." />;

  if (error) return <Alert message={error} type="error" showIcon />;

  return (
    <Card
      title={phaseInfo?.title}
      extra={<Button type="primary" onClick={handleSave} loading={submitting}>保存答案</Button>}
    >
      <div style={{ marginBottom: 24 }}>
        <h3>阶段描述</h3>
        <p>{phaseInfo?.description}</p>
      </div>

      <Form layout="vertical">
        <Form.Item label="你的答案">
          <Input.TextArea
            rows={6}
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            placeholder="请输入你的答案..."
          />
        </Form.Item>
      </Form>
    </Card>
  );
}