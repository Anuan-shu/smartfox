import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { message, Button, Card, Radio, Input, Spin, Tag, List, Modal, Select } from 'antd';
import { DownloadOutlined, PaperClipOutlined, UserOutlined } from '@ant-design/icons';
import axios from '../../utils/axios';
import styles from './ExperimentDetail.module.css';
import Editor from '@monaco-editor/react';

const { TextArea } = Input;
const { Option } = Select;

export default function ExperimentDetail() {
  const { experiment_id } = useParams();
  const navigate = useNavigate();
  const [experiment, setExperiment] = useState(null);
  const [answers, setAnswers] = useState({});
  const [languages, setLanguages] = useState({});
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionModalVisible, setSubmissionModalVisible] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [editorTheme, setEditorTheme] = useState('light');
  const [autoSaveInterval, setAutoSaveInterval] = useState(null);
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Language options
  const languageOptions = [
    { value: 'cpp', label: 'C++' },
    { value: 'python', label: 'Python' },
    { value: 'java', label: 'Java' },
  ];

  // 获取编辑器语言类型
  const getEditorLanguage = (language) => {
    switch (language) {
      case 'cpp': return 'cpp';
      case 'python': return 'python';
      case 'java': return 'java';
      default: return 'plaintext';
    }
  };

  // 自动保存函数
  const autoSave = useCallback(async () => {
    if (!hasUnsavedChanges) return;
    
    try {
      const answersArray = Object.entries(answers).map(([questionId, answer]) => {
        const question = experiment.questions.find(q => q.question_id === questionId);
        return {
          question_id: questionId,
          type: question.type === 'choice' ? 'choice' :
                question.type === 'code' ? 'code' : 'blank',
          answer: question.type === 'code' ? undefined : answer,
          code: question.type === 'code' ? answer : undefined,
          language: question.type === 'code' ? languages[questionId] : undefined
        };
      });

      await axios.post(`/student/experiments/${experiment_id}/save`, {
        answers: answersArray
      });
      
      setLastSavedTime(new Date());
      setHasUnsavedChanges(false);
      console.log('自动保存成功', new Date().toLocaleTimeString());
    } catch (error) {
      console.error('自动保存失败:', error);
    }
  }, [answers, languages, experiment, experiment_id, hasUnsavedChanges]);

  // 设置自动保存定时器
  useEffect(() => {
    const userRole = localStorage.getItem('role');
    const isStudent = userRole === 'student';
    const isSubmitted = experiment?.submission_status === 'submitted' || 
                       experiment?.submission_status === 'graded';

    // 只有学生且未提交时才启用自动保存
    if (isStudent && !isSubmitted && experiment) {
      const interval = setInterval(autoSave, 1000);
      setAutoSaveInterval(interval);
      
      return () => {
        clearInterval(interval);
      };
    }
  }, [autoSave, experiment]);

  useEffect(() => {
    const fetchExperimentDetail = async () => {
      try {
        const userRole = localStorage.getItem('role');
        const endpoint = userRole === 'teacher'
          ? `/teacher/experiments/${experiment_id}`
          : `/student/experiments/${experiment_id}`;

        const experimentResponse = await axios.get(endpoint);
        if (experimentResponse.status === 'success') {
          setExperiment(experimentResponse.data);

          if (userRole === 'student' && experimentResponse.data.questions) {
            const initialAnswers = {};
            const initialLanguages = {};
            
            experimentResponse.data.questions.forEach(q => {
              if (q.student_answer) {
                initialAnswers[q.question_id] = q.student_answer;
              } else if (q.student_code) {
                initialAnswers[q.question_id] = q.student_code;
              }
              if (q.type === 'code' && q.student_language) {
                initialLanguages[q.question_id] = q.student_language;
              } else if (q.type === 'code') {
                initialLanguages[q.question_id] = 'python';
              }
            });
            
            setAnswers(initialAnswers);
            setLanguages(initialLanguages);
          }

          const fileResponse = await axios.get(`/experiments/${experiment_id}/files`);
          if (fileResponse.files) {
            setFiles(fileResponse.files || []);
          } else {
            message.error('获取附件列表失败');
          }
        } else {
          message.error('获取实验详情失败');
        }
      } catch (error) {
        console.error('获取实验详情或附件列表失败:', error);
        message.error(error.response?.data?.message || '获取实验详情失败');
      } finally {
        setLoading(false);
      }
    };

    fetchExperimentDetail();
  }, [experiment_id]);

  // 获取学生提交记录
  const fetchStudentSubmission = async (studentId) => {
    setSubmissionLoading(true);
    setSelectedSubmission(null); // 清空之前的数据
    setSubmissionModalVisible(true);
    try {
      const response = await axios.get(`/teacher/experiments/${experiment_id}/${studentId}/submissions`);
      if (response.data.status === 'submitted' && response.data) {
        setSelectedSubmission(response.data);
      } else {
        setSelectedSubmission({ error: '获取学生提交记录失败：无有效数据' });
      }
    } catch (error) {
      setSelectedSubmission({ 
      error: error.response?.data?.message || '获取学生提交记录失败' 
    });
      setSubmissionLoading(false);
    }
  };

  // 处理文件下载
  const handleDownload = async (filename) => {
    try {
      const response = await axios.get(
        `/experiments/${experiment_id}/files/${filename}/download`,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下载文件失败:', error);
      message.error(`下载文件 ${filename} 失败`);
    }
  };

  // 手动保存答案
  const handleSave = async () => {
    setSaving(true);
    try {
      const answersArray = Object.entries(answers).map(([questionId, answer]) => {
        const question = experiment.questions.find(q => q.question_id === questionId);
        return {
          question_id: questionId,
          type: question.type === 'choice' ? 'choice' :
                question.type === 'code' ? 'code' : 'blank',
          answer: question.type === 'code' ? undefined : answer,
          code: question.type === 'code' ? answer : undefined,
          language: question.type === 'code' ? languages[questionId] : undefined
        };
      });

      const response = await axios.post(`/student/experiments/${experiment_id}/save`, {
        answers: answersArray
      });

      if (response.status === 'success') {
        message.success('保存成功');
        setLastSavedTime(new Date());
        setHasUnsavedChanges(false);
        navigate(`/experiments`);
      }
    } catch (error) {
      console.error('保存失败:', error);
      message.error(error.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 提交实验
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // 先自动保存一次
      await autoSave();
      
      const answersArray = Object.entries(answers).map(([questionId, answer]) => {
        const question = experiment.questions.find(q => q.question_id === questionId);
        return {
          question_id: questionId,
          type: question.type === 'choice' ? 'choice' :
                question.type === 'code' ? 'code' : 'blank',
          answer: question.type === 'code' ? undefined : answer,
          code: question.type === 'code' ? answer : undefined,
          language: question.type === 'code' ? languages[questionId] : undefined
        };
      });

      const response = await axios.post(`/student/experiments/${experiment_id}/submit`, {
        answers: answersArray
      });

      if (response.status === 'success') {
        message.success('提交成功');
        navigate(`/experiments/${experiment_id}/result`);
      }
    } catch (error) {
      console.error('提交失败:', error);
      message.error(error.response?.data?.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 处理答案变化
  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
    setHasUnsavedChanges(true);
  };

  const handleLanguageChange = (questionId, value) => {
    setLanguages(prev => ({
      ...prev,
      [questionId]: value
    }));
    setHasUnsavedChanges(true);
  };

  // 渲染题目
  const renderQuestion = (question, index) => {
    const userRole = localStorage.getItem('role');
    const isStudent = userRole === 'student';
    const isSubmitted = experiment.submission_status === 'submitted' || experiment.submission_status === 'graded';
    const isTeacher = userRole === 'teacher';

    return (
      <Card key={question.question_id} className={styles.questionCard}>
        <div className={styles.questionHeader}>
          <span className={styles.questionNumber}>题目 {index + 1}</span>
          <span className={styles.questionScore}>分值: {question.score}</span>
        </div>

        <div className={styles.questionContent}>
          <p>{question.content}</p>
          {question.image_url && (
            <img
              src={question.image_url}
              alt="题目图片"
              className={styles.questionImage}
              style={{
                maxWidth: '100%',
                maxHeight: 200,
                objectFit: 'contain'
              }}
            />
          )}
        </div>

        {/* 选择题 */}
        {question.type === 'choice' && (
          <div className={styles.choiceOptions}>
            <Radio.Group
              value={answers[question.question_id]}
              onChange={(e) => handleAnswerChange(question.question_id, e.target.value)}
              disabled={!isStudent || isSubmitted}
            >
              {question.options.map((option, idx) => (
                <Radio key={idx} value={option} className={styles.radioOption}>
                  {option}
                  {isTeacher && option === question.correct_answer && (
                    <Tag color="green" style={{ marginLeft: 8 }}>正确答案</Tag>
                  )}
                </Radio>
              ))}
            </Radio.Group>
          </div>
        )}

        {/* 填空题 */}
        {question.type === 'blank' && (
          <div>
            <Input
              placeholder="请输入答案"
              value={answers[question.question_id] || ''}
              onChange={(e) => handleAnswerChange(question.question_id, e.target.value)}
              disabled={!isStudent || isSubmitted}
              className={styles.blankInput}
            />
            {isTeacher && (
              <div style={{ marginTop: 8 }}>
                <Tag color="green">正确答案: {question.correct_answer}</Tag>
              </div>
            )}
          </div>
        )}

        {/* 编程题 */}
        {question.type === 'code' && (
          <div className={styles.programmingSection}>
            {isStudent && !isSubmitted && (
              <div className={styles.languageSelector}>
                <Select
                  placeholder="选择编程语言"
                  value={languages[question.question_id]}
                  onChange={(value) => handleLanguageChange(question.question_id, value)}
                  style={{ width: 120, marginBottom: 16 }}
                >
                  {languageOptions.map(lang => (
                    <Option key={lang.value} value={lang.value}>
                      {lang.label}
                    </Option>
                  ))}
                </Select>
              </div>
            )}
            {isTeacher && question.student_language && (
              <div style={{ marginBottom: 8 }}>
                <Tag color="blue">使用语言: {question.student_language}</Tag>
              </div>
            )}
            
            <div className={styles.codeEditorContainer}>
              <Editor
                height="300px"
                language={getEditorLanguage(languages[question.question_id])}
                theme={editorTheme}
                value={answers[question.question_id] || ''}
                onChange={(value) => handleAnswerChange(question.question_id, value)}
                options={{
                  readOnly: !isStudent || isSubmitted,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 14,
                  wordWrap: 'on',
                  automaticLayout: true,
                }}
              />
            </div>
            
            {question.test_cases && (
              <div className={styles.testCases}>
                <h4>测试用例:</h4>
                {question.test_cases.map((testCase, idx) => (
                  <div key={idx} className={styles.testCase}>
                    <div>输入: {testCase.input}</div>
                    <div>期望输出: {testCase.expected_output}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {(isSubmitted || isTeacher) && question.feedback && (
          <div className={styles.feedback}>
            <div className={styles.feedbackTitle}>反馈:</div>
            <div>{question.feedback}</div>
          </div>
        )}

        {(isSubmitted || isTeacher) && question.explanation && (
          <div className={styles.explanation}>
            <div className={styles.explanationTitle}>解释:</div>
            <div>{question.explanation}</div>
          </div>
        )}
      </Card>
    );
  };

  // 渲染提交详情
  const renderSubmissionDetails = () => {

    if (selectedSubmission?.error) {
      return <div className={styles.error}>{selectedSubmission.error}</div>;
    }

    if (!selectedSubmission) {
      return <div>暂无提交数据</div>;
    }

    return (
      <div>
        <div className={styles.submissionInfo}>
          <p><strong>学生ID:</strong> {selectedSubmission.student_id}</p>
          <p><strong>学生姓名:</strong> {selectedSubmission.student_name}</p>
          <p><strong>提交ID:</strong> {selectedSubmission.submission_id}</p>
          <p><strong>总分:</strong> {selectedSubmission.total_score}</p>
          <p><strong>状态:</strong> {selectedSubmission.status === 'graded' ? '已评分' : '未评分'}</p>
          <p><strong>提交时间:</strong> {new Date(selectedSubmission.submitted_at).toLocaleString()}</p>
        </div>
        <h3>题目详情</h3>
        {selectedSubmission.results.map((result, index) => (
          <Card key={result.question_id} className={styles.questionCard} style={{ marginBottom: 16 }}>
            <div className={styles.questionHeader}>
              <span className={styles.questionNumber}>题目 {index + 1}</span>
              <span className={styles.questionScore}>分值: {result.score}</span>
            </div>
            <div className={styles.questionContent}>
              <p><strong>题目:</strong> {result.content}</p>
              {result.type === 'multiple_choice' && (
                <>
                  <p><strong>选项:</strong> {result.options.join(', ')}</p>
                  <p><strong>学生答案:</strong> {result.student_answer || '未作答'}</p>
                </>
              )}
              {result.type === 'programming' && (
                <>
                  <p><strong>学生代码:</strong></p>
                  <pre className={styles.codeBlock}>{result.student_code || '未作答'}</pre>
                  <p><strong>编程语言:</strong> {result.student_language}</p>
                </>
              )}
              <p><strong>反馈:</strong> {result.feedback}</p>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spin size="large" />
      </div>
    );
  }

  if (!experiment) {
    return <div className={styles.error}>实验不存在</div>;
  }

  const userRole = localStorage.getItem('role');
  const isStudent = userRole === 'student';
  const isSubmitted = experiment.submission_status === 'submitted' || experiment.submission_status === 'graded';

  return (
    <div className={styles.container}>
      {/* 左侧侧边栏 */}
      <div className={styles.sidebar}>
        <div className={styles.header}>
          <h1>{experiment.title}</h1>
          <div className={styles.experimentInfo}>
            <div>截止时间: {new Date(experiment.deadline).toLocaleString()}</div>
            {isStudent && (
              <div>状态: {isSubmitted ? '已提交' : '进行中'}</div>
            )}
            {isStudent && lastSavedTime && (
              <div>最后保存: {lastSavedTime.toLocaleTimeString()}</div>
            )}
            {isStudent && hasUnsavedChanges && (
              <div style={{ color: 'orange' }}>有未保存的更改</div>
            )}
          </div>
        </div>

        <div className={styles.description}>
          <p>{experiment.description}</p>
        </div>

        {/* 附件列表 */}
        <Card title="实验附件" className={styles.attachmentsCard}>
          {files.length > 0 ? (
            <List
              dataSource={files}
              renderItem={(filename) => (
                <List.Item
                  actions={[
                    <Button
                      type="link"
                      icon={<DownloadOutlined />}
                      onClick={() => handleDownload(filename)}
                    >
                      下载
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    avatar={<PaperClipOutlined />}
                    title={filename}
                  />
                </List.Item>
              )}
            />
          ) : (
            <div className={styles.noAttachments}>暂无附件</div>
          )}
        </Card>

        {/* 参与学生列表 */}
        {userRole === 'teacher' && (
          <Card title="参与学生" className={styles.studentsCard}>
            {experiment.student_ids && experiment.student_ids.length > 0 ? (
              <List
                dataSource={experiment.student_ids}
                renderItem={(studentId) => (
                  <List.Item
                    actions={[
                      <Button
                        type="link"
                        onClick={() => fetchStudentSubmission(studentId)}
                        loading={submissionLoading && selectedSubmission?.student_id === studentId}
                      >
                        查看提交
                      </Button>
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<UserOutlined />}
                      title={studentId}
                    />
                  </List.Item>
                )}
              />
            ) : (
              <div className={styles.noStudents}>暂无学生</div>
            )}
          </Card>
        )}

        {userRole === 'teacher' && (
          <Button
            type="primary"
            onClick={() => navigate(`/edit-experiment/${experiment_id}`)}
            className={styles.editButton}
          >
            编辑实验
          </Button>
        )}

        {isSubmitted && (
          <div className={styles.submittedInfo}>
            <div>总分: {experiment.total_score}</div>
            <Button
              type="primary"
              onClick={() => navigate(`/experiments/${experiment_id}/result`)}
              className={styles.resultButton}
            >
              查看详细结果
            </Button>
          </div>
        )}
      </div>

      {/* 右侧主内容区 */}
      <div className={styles.mainContent}>
        <div className={styles.questionsSection}>
          {experiment.questions?.map((question, index) => renderQuestion(question, index))}
        </div>

        {isStudent && !isSubmitted && (new Date() < new Date(experiment.deadline) || experiment.permission === 1) && (
          <div className={styles.actionButtons}>
            <Button
              onClick={handleSave}
              loading={saving}
              className={styles.saveButton}
            >
              保存答案
            </Button>
            <Button
              type="primary"
              onClick={handleSubmit}
              loading={submitting}
              className={styles.submitButton}
            >
              提交实验
            </Button>
          </div>
        )}
      </div>

      {/* 学生提交详情弹窗 */}
      <Modal
        title="学生提交详情"
        open={submissionModalVisible}
        onCancel={() => {
          setSubmissionModalVisible(false);
          setSelectedSubmission(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setSubmissionModalVisible(false);
            setSelectedSubmission(null);
          }}>
            关闭
          </Button>
        ]}
        width={800}
        zIndex={1000}
      >
        {submissionLoading ? (
          <div style={{ textAlign: 'center' }}>
            <Spin size="large" tip="加载提交数据..." />
          </div>
        ) : (
          renderSubmissionDetails()
        )}
      </Modal>
    </div>
  );
}