import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Form, Input, Button, DatePicker, Select, Card, Space,
  message, InputNumber, Divider, Spin, Upload, Progress, Tag
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, ArrowLeftOutlined,
  UploadOutlined, PaperClipOutlined, CloudUploadOutlined
} from '@ant-design/icons';
import { experimentAPI, userAPI } from '../../utils/api';
import styles from './EditExperiment.module.css';
import dayjs from 'dayjs';
import axios from '../../utils/axios';

const { TextArea } = Input;
const { Option } = Select;

export default function EditExperiment() {
  const { experiment_id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [originalQuestions, setOriginalQuestions] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [originalAttachments, setOriginalAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);

  // 获取学生列表
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const response = await userAPI.getStudentList();
        setStudents(response.student_ids || []);
      } catch (error) {
        console.error('获取学生列表失败:', error);
        message.error('获取学生列表失败');
      }
    };
    fetchStudents();
  }, []);

  // 获取实验详情
  useEffect(() => {
    const fetchExperimentDetail = async () => {
      try {
        const response = await experimentAPI.getExperimentDetail(experiment_id, 'teacher');
        const experiment = response.data;

        // 设置表单初始值
        form.setFieldsValue({
          title: experiment.title,
          description: experiment.description,
          deadline: dayjs(experiment.deadline),
          student_ids: experiment.student_ids || []
        });

        // 设置题目
        const formattedQuestions = (experiment.questions || []).map(q => ({
          ...q,
          id: q.question_id // Ensure compatibility with question_id
        }));
        setQuestions(formattedQuestions);
        setOriginalQuestions(formattedQuestions);

        // 设置附件（假设API返回attachment数组，包含url和name）
        // 获取附件列表
        const fileResponseEdit = await axios.get(`/experiments/${experiment_id}/files`);
        console.log('附件列表:', fileResponseEdit.files);
        if (fileResponseEdit.files) {
        } else {
          message.error('获取附件列表失败');
        }
        const formattedAttachments = (fileResponseEdit.files || [])
            .filter(attachmentString => typeof attachmentString === 'string' && attachmentString.trim() !== '') // 过滤掉非字符串或空字符串
            .map((attachmentString, index) => {
              const fileUrl = null;
              return {
                uid: `existing-${index}`,
                name: attachmentString,
                status: 'done',
                url: fileUrl,
                preview: fileUrl && typeof fileUrl === 'string' && fileUrl.match(/\.(jpeg|jpg|png|gif)$/i) ? fileUrl :
                    (typeof attachmentString === 'string' && attachmentString.match(/\.(jpeg|jpg|png|gif)$/i) ? attachmentString : null)
              };
            });
        setAttachments(formattedAttachments);
        setOriginalAttachments(formattedAttachments);
      } catch (error) {
        console.error('获取实验详情失败:', error);
        message.error('获取实验详情失败');
        navigate('/experiments');
      } finally {
        setPageLoading(false);
      }
    };

    if (experiment_id) {
      fetchExperimentDetail();
    }
  }, [experiment_id, form, navigate]);

  // 添加题目
  const addQuestion = (type) => {
    const newQuestion = {
      id: Date.now(),
      type,
      content: '',
      score: 10,
      image_url: null,
      image_file: null, // Store file object for new uploads
      explanation: '',
      ...(type === 'choice' && {
        options: ['', '', '', ''],
        correct_answer: ''
      }),
      ...(type === 'blank' && {
        correct_answer: ''
      }),
      ...(type === 'code' && {
        test_cases: [{ input: '', expected_output: '' }]
      })
    };
    setQuestions([...questions, newQuestion]);
  };

  // 删除题目
  const removeQuestion = (id) => {
    setQuestions(questions.filter(q => q.id !== id && q.question_id !== id));
  };

  // 更新题目
  const updateQuestion = (id, field, value) => {
    setQuestions(questions.map(q =>
      (q.id === id || q.question_id === id) ? { ...q, [field]: value } : q
    ));
  };

  // 处理题目图片上传
  const handleImageUpload = (file, questionId) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      updateQuestion(questionId, 'image_url', e.target.result);
      updateQuestion(questionId, 'image_file', file); // Store file object for upload
    };
    reader.readAsDataURL(file);
    return false; // Prevent default upload
  };

  // 添加测试用例（编程题）
  const addTestCase = (questionId) => {
    const question = questions.find(q => q.id === questionId || q.question_id === questionId);
    if (question) {
      updateQuestion(questionId, 'test_cases', [
        ...(question.test_cases || []),
        { input: '', expected_output: '' }
      ]);
    }
  };

  // 删除测试用例
  const removeTestCase = (questionId, testCaseIndex) => {
    const question = questions.find(q => q.id === questionId || q.question_id === questionId);
    if (question && question.test_cases) {
      const newTestCases = question.test_cases.filter((_, index) => index !== testCaseIndex);
      updateQuestion(questionId, 'test_cases', newTestCases);
    }
  };

  // 更新测试用例
  const updateTestCase = (questionId, testCaseIndex, field, value) => {
    const question = questions.find(q => q.id === questionId || q.question_id === questionId);
    if (question && question.test_cases) {
      const newTestCases = question.test_cases.map((testCase, index) =>
        index === testCaseIndex ? { ...testCase, [field]: value } : testCase
      );
      updateQuestion(questionId, 'test_cases', newTestCases);
    }
  };

  // 处理附件上传
  const handleAttachmentChange = ({ file, fileList }) => {
    const updatedFiles = fileList.map(f => {
      if (f.preview || f.url) return f; // Keep existing previews/URLs
      if (f.type?.startsWith('image/')) {
        return { ...f, preview: URL.createObjectURL(f.originFileObj) };
      }
      return f;
    });
    setAttachments(updatedFiles);
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
            {file.preview || file.url ? (
              <img
                src={file.preview || file.url}
                alt="文件预览"
                className={styles.filePreview}
                onLoad={() => {
                  if (file.preview && !file.url) URL.revokeObjectURL(file.preview);
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
                if (file.preview && !file.url) URL.revokeObjectURL(file.preview);
                setAttachments(prev => prev.filter(f => f.uid !== file.uid));
                axios.delete(`/teacher/experiments/${experiment_id}/files/${file.name}`)
              }}
            />
          </div>
        ))}
      </div>
    );
  };

  // 上传题目图片和附件
  const uploadFiles = async (experimentId) => {
    try {
      setUploading(true);

      // 上传题目图片
      for (const question of questions) {
        if (question.image_file) {
          try {
            const response = await experimentAPI.uploadQuestionImage(experimentId, question.image_file);
            updateQuestion(question.id || question.question_id, 'image_url', response.data.url);
            updateQuestion(question.id || question.question_id, 'image_file', null); // Clear file after upload
          } catch (error) {
            message.error(`上传题目${questions.indexOf(question) + 1}图片失败`);
          }
        }
      }

      // 上传实验附件
      const filesToUpload = attachments.filter(f => f.originFileObj && f.status !== 'done');
      for (const file of filesToUpload) {
        try {
          setAttachments(prev => prev.map(f =>
            f.uid === file.uid ? { ...f, status: 'uploading', percent: 0 } : f
          ));
          await experimentAPI.uploadExperimentAttachment(experimentId, file.originFileObj);
          setAttachments(prev => prev.map(f =>
            f.uid === file.uid ? { ...f, status: 'done', percent: 100 } : f
          ));
        } catch (error) {
          setAttachments(prev => prev.map(f =>
            f.uid === file.uid ? { ...f, status: 'error' } : f
          ));
          message.error(`上传附件 ${file.name} 失败`);
        }
      }
    } finally {
      setUploading(false);
    }
  };

  // 删除已移除的附件
  const deleteRemovedAttachments = async () => {
    const removedAttachments = originalAttachments
      .filter(oa => !attachments.find(a => a.url === oa.url))
      .map(oa => oa.url);
    for (const url of removedAttachments) {
      try {
        await experimentAPI.deleteExperimentAttachment(experiment_id, url);
      } catch (error) {
        console.error(`删除附件 ${url} 失败:`, error);
        message.error(`删除附件失败`);
      }
    }
  };

  // 提交表单
  const handleSubmit = async (values) => {
    if (questions.length === 0) {
      message.error('请至少添加一道题目');
      return;
    }

    setLoading(true);
    try {
      // 准备更新数据
      const updateData = {
        title: values.title,
        description: values.description,
        deadline: values.deadline.toISOString(),
        student_ids: values.student_ids,
        questions: questions.map(q => ({
          ...(q.question_id && { question_id: q.question_id }),
          type: q.type,
          content: q.content,
          score: q.score,
          image_url: q.image_url || '',
          explanation: q.explanation || '',
          ...(q.type === 'choice' && {
            options: q.options,
            correct_answer: q.correct_answer
          }),
          ...(q.type === 'blank' && {
            correct_answer: q.correct_answer
          }),
          ...(q.type === 'code' && {
            test_cases: q.test_cases || []
          })
        })),
        remove_questions: originalQuestions
          .filter(oq => !questions.find(q => q.question_id === oq.question_id))
          .map(oq => oq.question_id)
      };

      // 更新实验
      const response = await experimentAPI.updateExperiment(experiment_id, updateData);
      if (response.status !== 'success') {
        throw new Error('更新实验失败');
      }

      // 删除已移除的附件
      await deleteRemovedAttachments();

      // 上传新图片和附件
      await uploadFiles(experiment_id);

      message.success('实验更新成功');
      navigate('/experiments');
    } catch (error) {
      console.error('更新实验失败:', error);
      message.error(error.response?.data?.message || '更新实验失败');
    } finally {
      setLoading(false);
    }
  };

  // 删除实验
  const handleDelete = async () => {
    try {
      setLoading(true); // 显示加载状态
      await experimentAPI.deleteExperiment(experiment_id);
      message.success('实验已删除');
      navigate('/experiments');
    } catch (error) {
      console.error('删除实验失败:', error);
      message.error(error.response?.data?.message || '删除实验失败');
    } finally {
      setLoading(false);
    }
  };

  // 渲染题目编辑器
  const renderQuestionEditor = (question) => {
    console.log(question);
    const questionId = question.id || question.question_id;
    const getQuestionType = () => {
      const types = {
        choice: '选择题',
        blank: '填空题',
        code: '编程题'
      };
      return types[question.type] || '未知题型';
    };

    return (
      <Card
        key={questionId}
        title={`题目 #${questions.indexOf(question) + 1} - ${getQuestionType()}`}
        className={styles.questionCard}
        extra={
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => removeQuestion(questionId)}
          />
        }
      >
        <div className={styles.questionContent}>
          <div className={styles.formRow}>
            <span>题目内容：</span>
            <Input
              value={question.content}
              placeholder="请输入题目内容..."
              onChange={e => updateQuestion(questionId, 'content', e.target.value)}
            />
          </div>

          <div className={styles.formRow}>
            <span>分值：</span>
            <InputNumber
              min={1}
              max={100}
              value={question.score}
              onChange={value => updateQuestion(questionId, 'score', value)}
            />
          </div>

          <div className={styles.formRow}>
            <span>题目解释：</span>
            <TextArea
              value={question.explanation}
              placeholder="题目解析（可选）..."
              onChange={e => updateQuestion(questionId, 'explanation', e.target.value)}
              rows={2}
            />
          </div>

          <div className={styles.formRow}>
            <span>题目图片：</span>
            <Upload
              beforeUpload={(file) => handleImageUpload(file, questionId)}
              showUploadList={false}
            >
              <Button icon={<UploadOutlined />}>选择图片</Button>
            </Upload>
            {question.image_url && (
              <div className={styles.imagePreviewContainer}>
                <img
                  src={question.image_url}
                  alt="题目预览"
                  className={styles.previewImage}
                  style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain' }}
                />
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => {
                    updateQuestion(questionId, 'image_url', null);
                    updateQuestion(questionId, 'image_file', null);
                  }}
                >
                  删除图片
                </Button>
              </div>
            )}
          </div>

          {question.type === 'choice' && (
            <div className={styles.choiceOptions}>
              <div className={styles.sectionTitle}>选项设置：</div>
              {question.options?.map((option, index) => (
                <div key={index} className={styles.optionRow}>
                  <span>选项 {index + 1}:</span>
                  <Input
                    value={option}
                    onChange={e => {
                      const newOptions = [...question.options];
                      newOptions[index] = e.target.value;
                      updateQuestion(questionId, 'options', newOptions);
                    }}
                    placeholder={`输入选项 ${String.fromCharCode(65 + index)}...`}
                  />
                </div>
              ))}
              <div className={styles.correctAnswer}>
                <span>正确答案：</span>
                <Select
                  value={question.correct_answer}
                  onChange={value => updateQuestion(questionId, 'correct_answer', value)}
                  placeholder="请选择正确答案"
                >
                  {question.options.map((opt, idx) => (
                    <Option key={idx} value={opt}>
                      {String.fromCharCode(65 + idx)}
                    </Option>
                  ))}
                </Select>
              </div>
            </div>
          )}

          {question.type === 'blank' && (
            <div className={styles.blankAnswer}>
              <div className={styles.sectionTitle}>正确答案：</div>
              <Input
                value={question.correct_answer}
                onChange={e => updateQuestion(questionId, 'correct_answer', e.target.value)}
                placeholder="请输入正确答案..."
              />
            </div>
          )}

          {question.type === 'code' && (
            <div className={styles.testCases}>
              <div className={styles.sectionTitle}>测试用例：</div>
              {question.test_cases?.map((testCase, index) => (
                <div key={index} className={styles.testCase}>
                  <div className={styles.caseHeader}>
                    <span>用例 #{index + 1}</span>
                    {index > 0 && (
                      <DeleteOutlined
                        onClick={() => removeTestCase(questionId, index)}
                      />
                    )}
                  </div>
                  <div className={styles.caseInput}>
                    <span>输入:</span>
                    <Input
                      value={testCase.input}
                      onChange={e => updateTestCase(questionId, index, 'input', e.target.value)}
                    />
                  </div>
                  <div className={styles.caseOutput}>
                    <span>输出:</span>
                    <Input
                      value={testCase.expected_output}
                      onChange={e => updateTestCase(questionId, index, 'expected_output', e.target.value)}
                    />
                  </div>
                </div>
              ))}
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => addTestCase(questionId)}
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

  if (pageLoading) {
    return (
      <div className={styles.loading}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 style={{ margin: 0, whiteSpace: 'nowrap' }}>编辑实验</h1>
        <Button
          danger
          onClick={handleDelete}
          loading={loading}
          icon={<DeleteOutlined />}
          style={{ minWidth: 'auto', padding: '0 12px' }}
        >
          删除实验
        </Button>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        className={styles.form}
      >
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
            name="student_ids"
            label="选择学生"
            rules={[{ required: true, message: '请选择参与的学生' }]}
          >
            <Select
              mode="multiple"
              placeholder="选择参与实验的学生"
              style={{ width: '100%' }}
            >
              {students.map(student => (
                <Option key={student} value={student}>
                  {student}
                </Option>
              ))}
            </Select>
          </Form.Item>
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
            beforeUpload={() => false} // Prevent automatic upload
            className={styles.uploadDragger}
            showUploadList={false}
          >
            <p className="ant-upload-drag-icon">
              <CloudUploadOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此处上传</p>
            <p className="ant-upload-hint">支持多文件上传，单个文件不超过50MB</p>
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
            {uploading ? '正在上传...' : '保存修改'}
          </Button>
        </div>
      </Form>
    </div>
  );
}