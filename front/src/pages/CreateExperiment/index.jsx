import React, { useState, useEffect, useCallback, useReducer } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form, Input, Button, DatePicker, Select, Card, Space,
  message, InputNumber, Divider, Upload, Progress, Tag, Checkbox, Radio, Tabs
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, UploadOutlined,
  PaperClipOutlined, PictureOutlined, CloudUploadOutlined, TeamOutlined, UserOutlined
} from '@ant-design/icons';
import { experimentAPI, userAPI ,studentGroupAPI} from '../../utils/api';
import styles from './CreateExperiment.module.css';

const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

// 题目状态管理Reducer
const questionReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_QUESTION':
      return [...state, {
        id: Date.now(),
        type: action.payload,
        content: '',
        score: 10,
        image_url: null,
        explanation: '',
        ...(action.payload === 'choice' && { options: ['', '', '', ''], correct_answer: '' }),
        ...(action.payload === 'blank' && { correct_answer: '' }),
        ...(action.payload === 'code' && { test_cases: [{ input: '', expected_output: '' }] })
      }];
      
    case 'REMOVE_QUESTION':
      return state.filter(q => q.id !== action.payload);
      
    case 'UPDATE_QUESTION': {
      const { id, field, value } = action.payload;
      return state.map(q => q.id === id ? { ...q, [field]: value } : q);
    }
      
    case 'ADD_TEST_CASE': {
      const questionId = action.payload;
      return state.map(q => 
        q.id === questionId 
          ? { ...q, test_cases: [...q.test_cases, { input: '', expected_output: '' }] }
          : q
      );
    }
      
    case 'REMOVE_TEST_CASE': {
      const { questionId, index } = action.payload;
      return state.map(q => 
        q.id === questionId 
          ? { 
              ...q, 
              test_cases: q.test_cases.filter((_, i) => i !== index)
            }
          : q
      );
    }
      
    default:
      return state;
  }
};

export default function CreateExperiment() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [questions, dispatchQuestion] = useReducer(questionReducer, []);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [studentSelectionMode, setStudentSelectionMode] = useState('individual');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0
  });

  // 获取学生列表
  const fetchStudents = useCallback(async (page = 1, limit = 10) => {
    try {
      const response = await userAPI.getStudentList({ page, limit });
      setStudents(response.student_ids || []);
    } catch (error) {
      console.error('获取学生列表失败:', error);
      message.error('获取学生列表失败');
    }
  }, []);

  // 获取分组列表
  const fetchGroups = useCallback(async (page = 1, limit = 10) => {
    try {
      const response = await studentGroupAPI.getGroups({ page, limit });
      setGroups(response.data || []);
      setPagination(response.pagination || { page, limit, total: 0 });
    } catch (error) {
      console.error('获取分组列表失败:', error);
      message.error('获取分组列表失败');
    }
  }, []);

  useEffect(() => {
    fetchStudents();
    fetchGroups();
  }, [fetchStudents, fetchGroups]);

  // 添加题目
  const addQuestion = useCallback((type) => {
    dispatchQuestion({ type: 'ADD_QUESTION', payload: type });
  }, []);

  // 删除题目
  const removeQuestion = useCallback((id) => {
    dispatchQuestion({ type: 'REMOVE_QUESTION', payload: id });
  }, []);

  // 更新题目
  const updateQuestion = useCallback((id, field, value) => {
    dispatchQuestion({ 
      type: 'UPDATE_QUESTION', 
      payload: { id, field, value } 
    });
  }, []);

  // 题目图片上传处理
  const handleImageUpload = useCallback((file, id) => {
    if (typeof window === 'undefined' || !window.FileReader) {
      return false;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      updateQuestion(id, 'image_url', e.target.result);
    };
    reader.readAsDataURL(file);
    return false;
  }, [updateQuestion]);

  // 添加测试用例
  const addTestCase = useCallback((questionId) => {
    dispatchQuestion({ type: 'ADD_TEST_CASE', payload: questionId });
  }, []);

  // 删除测试用例
  const removeTestCase = useCallback((questionId, index) => {
    dispatchQuestion({ 
      type: 'REMOVE_TEST_CASE', 
      payload: { questionId, index } 
    });
  }, []);

  // 处理附件上传
  const handleAttachmentChange = useCallback(({ file, fileList }) => {
    const updatedFiles = fileList.map(f => {
      if (f.preview) return f;
      if (f.type?.startsWith('image/')) {
        const preview = URL.createObjectURL(f.originFileObj);
        return { ...f, preview };
      }
      return f;
    });
    setAttachments(updatedFiles);
  }, []);

  // 清理URL对象，防止内存泄漏
  useEffect(() => {
    return () => {
      if (typeof window === 'undefined') {
        return;
      }
      // 清理附件预览URL
      attachments.forEach(file => {
        if (file.preview) {
          window.URL.revokeObjectURL(file.preview);
        }
      });
      
      // 清理题目图片URL
      questions.forEach(question => {
        if (question.image_url?.startsWith('blob:')) {
          window.URL.revokeObjectURL(question.image_url); // 使用window.URL明确调用
        }
      });
    };
  }, [attachments, questions]);

  // 创建实验
  const handleCreateExperiment = async (values) => {
    try {
      setLoading(true);
      
      // 根据选择模式确定学生ID列表
      let studentIds = [];
      if (studentSelectionMode === 'individual') {
        studentIds = values.student_ids || [];
      } else {
        // 从选中的分组中获取学生ID
        const selectedGroup = groups.find(g => g.group_id === values.group_id);
        studentIds = selectedGroup ? selectedGroup.student_ids : [];
      }

      const requestBody = {
        title: values.title,
        description: values.description,
        deadline: values.deadline.toISOString(),
        permission: values.permission ? 1 : 0,
        student_ids: studentIds,
        questions: questions.map(q => ({
          type: q.type,
          content: q.content,
          score: q.score,
          image_url: q.image_url,
          explanation: q.explanation,
          ...(q.type === 'choice' && { 
            options: q.options, 
            correct_answer: q.correct_answer 
          }),
          ...(q.type === 'blank' && { 
            correct_answer: q.correct_answer 
          }),
          ...(q.type === 'code' && { 
            test_cases: q.test_cases 
          })
        }))
      };
      
      const response = await experimentAPI.createExperiment(requestBody);
      if (response.status === 'success') {
        return response.data.experiment_id;
      }
      throw new Error('创建实验失败');
    } catch (error) {
      message.error('创建实验失败: ' + error.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // 上传附件
  const uploadAttachments = async (experimentId) => {
    try {
      setUploading(true);
      const filesToUpload = attachments.filter(f => f.originFileObj);
      
      for (const file of filesToUpload) {
        try {
          setAttachments(prev => prev.map(f => 
            f.uid === file.uid ? { ...f, status: 'uploading' } : f
          ));
          
          await experimentAPI.uploadExperimentAttachment(
            experimentId,
            file.originFileObj
          );
          
          setAttachments(prev => prev.map(f => 
            f.uid === file.uid ? { ...f, status: 'done' } : f
          ));
        } catch (error) {
          setAttachments(prev => prev.map(f => 
            f.uid === file.uid ? { ...f, status: 'error' } : f
          ));
        }
      }
    } finally {
      setUploading(false);
    }
  };

  // 表单提交
  const handleSubmit = async (values) => {
    if (questions.length === 0) {
      message.error('请至少添加一道题目');
      return;
    }

    // 增强验证：检查题目内容
    const hasInvalidQuestion = questions.some(q => !q.content.trim());
    if (hasInvalidQuestion) {
      message.error('请完善所有题目的内容');
      return;
    }

    try {
      // 1. 创建实验
      const experimentId = await handleCreateExperiment(values);
      if (!experimentId) return;
      
      // 2. 上传附件
      if (attachments.length > 0) {
        await uploadAttachments(experimentId);
      }
      
      message.success('实验创建成功！');
      navigate(`/experiments/${experimentId}`);
    } catch (error) {
      console.error('创建实验失败:', error);
      message.error('创建实验失败');
    }
  };

  // 渲染附件列表
  const renderAttachments = () => {
    if (attachments.length === 0) {
      return <div className={styles.noAttachments}>暂无附件</div>;
    }

    return (
      <div className={styles.attachmentsList}>
        {attachments.map(file => (
          <div key={file.uid} className={styles.fileItem}>
            {file.preview ? (
              <img 
                src={file.preview} 
                alt="文件预览" 
                className={styles.filePreview}
                onLoad={() => {// 确保在浏览器环境中执行
                  if (typeof window !== 'undefined') {
                    window.URL.revokeObjectURL(file.preview);
                  }
                }}
              />
            ) : (
              <PaperClipOutlined className={styles.fileIcon} />
            )}
            
            <div className={styles.fileInfo}>
              <div className={styles.fileName} title={file.name}>
                {file.name}
              </div>
              <div className={styles.fileStatus}>
                {file.status === 'uploading' && (
                  <Progress 
                    percent={file.percent || 0} 
                    size="small" 
                    status="active" 
                    showInfo={false}
                  />
                )}
                {file.status === 'done' && <Tag color="green">上传成功</Tag>}
                {file.status === 'error' && <Tag color="red">上传失败</Tag>}
              </div>
            </div>
            <DeleteOutlined 
              className={styles.deleteIcon} 
              onClick={() => {
                if (file.preview) URL.revokeObjectURL(file.preview);
                setAttachments(prev => prev.filter(f => f.uid !== file.uid));
              }}
            />
          </div>
        ))}
      </div>
    );
  };

  // 渲染题目编辑器
  const renderQuestionEditor = (q) => {
    const getQuestionType = () => {
      const types = {
        choice: '选择题',
        blank: '填空题',
        code: '编程题'
      };
      return types[q.type] || '未知题型';
    };

    return (
      <Card
        key={q.id}
        title={`题目 #${questions.indexOf(q) + 1} - ${getQuestionType()}`}
        className={styles.questionCard}
        extra={
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => removeQuestion(q.id)}
          />
        }
      >
        <div className={styles.questionContent}>
          <div className={styles.formRow}>
            <span>题目内容：</span>
            <Input
              value={q.content}
              placeholder="请输入题目内容..."
              onChange={e => updateQuestion(q.id, 'content', e.target.value)}
            />
          </div>
          
          <div className={styles.formRow}>
            <span>分值：</span>
            <InputNumber
              min={1}
              max={100}
              value={q.score}
              onChange={value => updateQuestion(q.id, 'score', value)}
            />
          </div>
          
          <div className={styles.formRow}>
            <span>题目解释：</span>
            <Input
              value={q.explanation}
              placeholder="题目解析（可选）..."
              onChange={e => updateQuestion(q.id, 'explanation', e.target.value)}
            />
          </div>
          
          <div className={styles.formRow}>
            <span>题目图片：</span>
            <Upload
              beforeUpload={(file) => handleImageUpload(file, q.id)}
              showUploadList={false}
            >
              <Button icon={<PictureOutlined />}>选择图片</Button>
            </Upload>
            {q.image_url && (
              <div className={styles.imagePreviewContainer}>
                <img 
                  src={q.image_url} 
                  alt="题目预览" 
                  className={styles.previewImage}
                  style={{ 
                    maxWidth: '100%',
                    maxHeight: 200,
                    objectFit: 'contain'
                  }}
                />
              </div>
            )}
          </div>
          
          {/* 选择题选项 */}
          {q.type === 'choice' && (
            <div className={styles.choiceOptions}>
              <div className={styles.sectionTitle}>选项设置：</div>
              {q.options.map((option, index) => (
                <div key={index} className={styles.optionRow}>
                  <span>选项 {index + 1}:</span>
                  <Input
                    value={option}
                    onChange={e => {
                      const newOptions = [...q.options];
                      newOptions[index] = e.target.value;
                      updateQuestion(q.id, 'options', newOptions);
                    }}
                    placeholder={`输入选项 ${String.fromCharCode(65 + index)}...`}
                  />
                </div>
              ))}
              <div className={styles.correctAnswer}>
                <span>正确答案：</span>
                <Select
                  value={q.correct_answer}
                  onChange={value => updateQuestion(q.id, 'correct_answer', value)}
                  placeholder="请选择正确答案"
                >
                  {q.options.map((opt, idx) => (
                    <Option key={idx} value={opt}>
                      {String.fromCharCode(65 + idx)}
                    </Option>
                  ))}
                </Select>
              </div>
            </div>
          )}
          
          {/* 填空题答案 */}
          {q.type === 'blank' && (
            <div className={styles.blankAnswer}>
              <div className={styles.sectionTitle}>正确答案：</div>
              <Input
                value={q.correct_answer}
                onChange={e => updateQuestion(q.id, 'correct_answer', e.target.value)}
                placeholder="请输入正确答案..."
              />
            </div>
          )}
          
          {/* 编程题测试用例 */}
          {q.type === 'code' && (
            <div className={styles.testCases}>
              <div className={styles.sectionTitle}>测试用例：</div>
              {q.test_cases.map((testCase, index) => (
                <div key={index} className={styles.testCase}>
                  <div className={styles.caseHeader}>
                    <span>用例 #{index + 1}</span>
                    {index > 0 && (
                      <DeleteOutlined 
                        onClick={() => {
                          const newCases = [...q.test_cases];
                          newCases.splice(index, 1);
                          updateQuestion(q.id, 'test_cases', newCases);
                        }}
                      />
                    )}
                  </div>
                  <div className={styles.caseInput}>
                    <span>输入:</span>
                    <Input
                      value={testCase.input}
                      onChange={e => {
                        const newCases = [...q.test_cases];
                        newCases[index].input = e.target.value;
                        updateQuestion(q.id, 'test_cases', newCases);
                      }}
                    />
                  </div>
                  <div className={styles.caseOutput}>
                    <span>输出:</span>
                    <Input
                      value={testCase.expected_output}
                      onChange={e => {
                        const newCases = [...q.test_cases];
                        newCases[index].expected_output = e.target.value;
                        updateQuestion(q.id, 'test_cases', newCases);
                      }}
                    />
                  </div>
                </div>
              ))}
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => {
                  const newCases = [...q.test_cases, { input: '', expected_output: '' }];
                  updateQuestion(q.id, 'test_cases', newCases);
                }}
                className={styles.addCaseButton}
              >
                添加测试用例
              </Button>
            </div>
          )}
        </div>
      </Card>
    );
  };


  if (typeof document === 'undefined') {
    return null; // 非浏览器环境不渲染
  }
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>创建新实验</h1>
        <p>设计实验内容并分配给指定学生</p>
      </div>

      <Form form={form} onFinish={handleSubmit} className={styles.form}>
        <Card title="基本信息" className={styles.sectionCard}>
          <Form.Item
            name="title"
            label="实验标题"
            rules={[{ required: true, message: '请输入实验标题' }]}
          >
            <Input placeholder="如：计算机网络原理实验二" />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="实验描述"
            rules={[{ required: true, message: '请输入实验描述' }]}
          >
            <TextArea 
              rows={3} 
              placeholder="请在此输入实验要求、目标等描述信息..."
            />
          </Form.Item>
          
          <Form.Item
            name="deadline"
            label="截止时间"
            rules={[{ required: true, message: '请选择截止时间' }]}
          >
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="permission"
            label="权限设置"
            valuePropName="checked"
          >
            <Checkbox>允许学生在截止日期之后提交</Checkbox>
          </Form.Item>
          
          <Form.Item
            label="分配方式"
            name="selection_mode"
            initialValue="individual"
          >
            <Radio.Group 
              onChange={(e) => setStudentSelectionMode(e.target.value)}
              value={studentSelectionMode}
            >
              <Radio.Button value="individual">
                <UserOutlined /> 选择学生
              </Radio.Button>
              <Radio.Button value="group">
                <TeamOutlined /> 选择分组
              </Radio.Button>
            </Radio.Group>
          </Form.Item>
          
          {studentSelectionMode === 'individual' ? (
            <Form.Item
              name="student_ids"
              label="选择学生"
              rules={[{ required: true, message: '请选择参与学生' }]}
            >
              <Select 
                mode="multiple" 
                placeholder="选择参与的学生"
                optionLabelProp="label"
                filterOption={(input, option) =>
                  option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
                }
              >
                {students.map(studentId => (
                    <Option key={studentId} value={studentId}>
                      {studentId}
                    </Option>
                  ))}
              </Select>
            </Form.Item>
          ) : (
            <Form.Item
              name="group_id"
              label="选择分组"
              rules={[{ required: true, message: '请选择分组' }]}
            >
              <Select 
                placeholder="选择分组"
                optionLabelProp="label"
              >
                {groups.map(group => (
                  <Option 
                    key={group.group_id} 
                    value={group.group_id}
                    label={`${group.group_name} (${group.student_count}人)`}
                  >
                    <div>
                      <strong>{group.group_name}</strong>
                      <div style={{ fontSize: '12px', color: '#888' }}>
                        学生数: {group.student_count} | 学生ID: {group.student_ids.join(', ')}
                      </div>
                    </div>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}
        </Card>
        
        <Card 
          title="实验附件" 
          className={styles.sectionCard}
          extra={
            <span className={styles.attachmentCount}>
              已添加 {attachments.length} 个附件
            </span>
          }
        >
          <Upload.Dragger
              name="file"
              multiple
              fileList={attachments}
              onChange={handleAttachmentChange}
              beforeUpload={(file) => {
                return false;
              }}
              className={styles.uploadDragger}
              showUploadList={false}
            >
              <p className="ant-upload-drag-icon">
                <CloudUploadOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此处上传</p>
              <p className="ant-upload-hint">
                支持上传图片、文档等附件，单个文件不超过10MB
              </p>
            </Upload.Dragger>
          
          {renderAttachments()}
        </Card>
        
        <Card 
          title="实验题目" 
          className={styles.sectionCard}
          extra={
            <Space>
              <Button onClick={() => addQuestion('choice')} icon={<PlusOutlined />}>
                选择题
              </Button>
              <Button onClick={() => addQuestion('blank')} icon={<PlusOutlined />}>
                填空题
              </Button>
              <Button onClick={() => addQuestion('code')} icon={<PlusOutlined />}>
                编程题
              </Button>
            </Space>
          }
        >
          <div className={styles.questionsList}>
            {questions.length > 0 ? (
              questions.map(renderQuestionEditor)
            ) : (
              <div className={styles.noQuestions}>
                <p>暂未添加题目</p>
                <p>请点击右上角按钮添加题目</p>
              </div>
            )}
          </div>
        </Card>
        
        <div className={styles.actionBar}>
          <Button 
            type="default" 
            onClick={() => navigate('/experiments')}
            disabled={loading || uploading}
          >
            取消
          </Button>
          <Button 
            type="primary" 
            htmlType="submit"
            loading={loading || uploading}
            icon={<CloudUploadOutlined />}
            className={styles.submitButton}
          >
            {uploading ? '正在上传...' : '创建实验'}
          </Button>
        </div>
      </Form>
    </div>
  );
}