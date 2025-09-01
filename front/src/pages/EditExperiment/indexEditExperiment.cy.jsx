// EditExperiment/EditExperiment.cy.jsx
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import EditExperiment from './index';
import zhCN from 'antd/es/locale/zh_CN';

describe('EditExperiment Component', () => {
  let mockExperimentAPI, mockUserAPI, mockAxios;
  const mockExperimentId = 'exp123';
  const mockStudents = ['student1', 'student2', 'student3'];
  const mockExperimentData = {
    title: '测试实验',
    description: '这是一个测试实验',
    deadline: '2023-12-31T23:59:59Z',
    student_ids: ['student1', 'student2'],
    questions: [
      {
        question_id: 'q1',
        type: 'choice',
        content: '选择题题目',
        score: 10,
        options: ['选项A', '选项B', '选项C', '选项D'],
        correct_answer: '选项A',
        explanation: '选择题解析',
      },
      {
        question_id: 'q2',
        type: 'blank',
        content: '填空题题目',
        score: 15,
        correct_answer: '填空答案',
        explanation: '填空题解析',
      },
    ],
  };

  beforeEach(() => {
    // 创建模拟的Redux store
    const mockStore = configureStore({
      reducer: {
        auth: () => ({ user: { role: 'teacher' } }),
      },
    });

    // 在测试内部创建模拟对象
    mockExperimentAPI = {
      getExperimentDetail: cy.stub().as('getExperimentDetail'),
      updateExperiment: cy.stub().as('updateExperiment'),
      deleteExperiment: cy.stub().as('deleteExperiment'),
      uploadQuestionImage: cy.stub().as('uploadQuestionImage'),
      uploadExperimentAttachment: cy.stub().as('uploadExperimentAttachment'),
      deleteExperimentAttachment: cy.stub().as('deleteExperimentAttachment'),
    };

    mockUserAPI = {
      getStudentList: cy.stub().as('getStudentList'),
    };

    mockAxios = {
      get: cy.stub().as('axiosGet'),
      post: cy.stub().as('axiosPost'),
      put: cy.stub().as('axiosPut'),
      delete: cy.stub().as('axiosDelete'),
    };

    // 设置模拟实现
    mockUserAPI.getStudentList.resolves({ student_ids: mockStudents });
    mockExperimentAPI.getExperimentDetail.resolves({ data: mockExperimentData });
    mockAxios.get.withArgs(`/experiments/${mockExperimentId}/files`).resolves({ files: ['file1.pdf', 'file2.jpg'] });
    
    // 模拟模块
    cy.window().then((win) => {
      // 保存原始的require函数
      const originalRequire = win.require || require;
      
      // 创建模拟的require函数
      win.require = (path) => {
        if (path.includes('../../src/utils/api')) {
          return {
            experimentAPI: mockExperimentAPI,
            userAPI: mockUserAPI,
            notificationAPI: {},
            submissionAPI: {},
            studentGroupAPI: {},
          };
        }
        if (path.includes('../../src/utils/axios')) {
          return mockAxios;
        }
        return originalRequire(path);
      };
    });
    
    // 设置路由参数
    cy.stub(require('react-router-dom'), 'useParams').returns({ experiment_id: mockExperimentId });
    
    // 渲染组件
    cy.mount(
      <Provider store={mockStore}>
        <ConfigProvider locale={zhCN}>
          <BrowserRouter>
            <EditExperiment />
          </BrowserRouter>
        </ConfigProvider>
      </Provider>
    );
  });

  afterEach(() => {
    // 恢复原始的require函数
    cy.window().then((win) => {
      win.require = require;
    });
  });

  it('应该成功加载实验编辑页面', () => {
    // 检查页面标题
    cy.contains('编辑实验').should('be.visible');
    
    // 检查表单字段已正确填充
    cy.get('input[value="测试实验"]').should('exist');
    cy.contains('这是一个测试实验').should('exist');
    
    // 检查题目已加载
    cy.contains('选择题题目').should('be.visible');
    cy.contains('填空题题目').should('be.visible');
    
    // 验证API调用
    cy.get('@getExperimentDetail').should(
      'have.been.calledWith',
      mockExperimentId,
      'teacher'
    );
    cy.get('@getStudentList').should('have.been.called');
  });

  it('应该显示加载状态然后显示内容', () => {
    // 初始应显示加载状态
    cy.get('.ant-spin').should('exist');
    
    // 加载完成后应显示表单
    cy.get('form').should('exist');
    cy.get('.ant-spin').should('not.exist');
  });

  it('应该成功添加新题目', () => {
    // 点击添加选择题按钮
    cy.contains('选择题').click();
    
    // 检查新题目已添加
    cy.get('.ant-card-head-title').should('contain', '题目 #3 - 选择题');
    
    // 填写新题目内容
    cy.get('input[placeholder="请输入题目内容..."]').last().type('新选择题内容');
    cy.get('input[placeholder="输入选项 A..."]').last().type('选项A内容');
    
    // 验证题目已更新到状态
    cy.contains('新选择题内容').should('exist');
  });

  it('应该成功删除题目', () => {
    // 获取初始题目数量
    cy.get('.ant-card-head-title').should('have.length', 2);
    
    // 点击删除第一个题目
    cy.get('.ant-btn-dangerous').first().click();
    
    // 检查题目已删除
    cy.get('.ant-card-head-title').should('have.length', 1);
    cy.contains('选择题题目').should('not.exist');
  });

  it('应该成功更新实验基本信息', () => {
    // 修改标题
    cy.get('input[value="测试实验"]').clear().type('更新后的实验标题');
    
    // 修改描述
    cy.get('textarea').first().clear().type('更新后的实验描述');
    
    // 验证表单值已更新
    cy.get('input[value="更新后的实验标题"]').should('exist');
    cy.contains('更新后的实验描述').should('exist');
  });

  it('应该处理表单提交成功', () => {
    // 模拟API成功响应
    mockExperimentAPI.updateExperiment.resolves({ status: 'success' });
    
    // 填写必要字段
    cy.get('input[value="测试实验"]').clear().type('新实验标题');
    
    // 提交表单
    cy.contains('保存修改').click();
    
    // 验证API调用
    cy.get('@updateExperiment').should('have.been.called');
  });

  it('应该处理表单提交失败', () => {
    // 模拟API失败响应
    mockExperimentAPI.updateExperiment.rejects({
      response: { data: { message: '更新失败' } }
    });
    
    // 删除所有题目以使表单无效
    cy.get('.ant-btn-dangerous').each(($btn) => {
      cy.wrap($btn).click();
    });
    
    // 尝试提交
    cy.contains('保存修改').click();
    
    // 应该显示错误消息
    cy.contains('请至少添加一道题目').should('be.visible');
    
    // 添加一个题目后再次提交
    cy.contains('选择题').click();
    cy.get('input[placeholder="请输入题目内容..."]').last().type('题目内容');
    cy.contains('保存修改').click();
    
    // 验证API被调用但失败
    cy.get('@updateExperiment').should('have.been.called');
  });

  it('应该处理删除实验操作', () => {
    // 模拟删除成功
    mockExperimentAPI.deleteExperiment.resolves({});
    
    // 点击删除按钮
    cy.contains('删除实验').click();
    
    // 验证API调用
    cy.get('@deleteExperiment').should(
      'have.been.calledWith',
      mockExperimentId
    );
  });

  it('应该处理删除实验失败', () => {
    // 模拟删除失败
    mockExperimentAPI.deleteExperiment.rejects({
      response: { data: { message: '删除失败' } }
    });
    
    // 点击删除按钮
    cy.contains('删除实验').click();
    
    // 验证API调用
    cy.get('@deleteExperiment').should('have.been.called');
  });

  it('应该显示无题目状态', () => {
    // 删除所有题目
    cy.get('.ant-btn-dangerous').each(($btn) => {
      cy.wrap($btn).click();
    });
    
    // 应该显示无题目提示
    cy.contains('暂未添加题目').should('be.visible');
    cy.contains('请点击右上角按钮添加题目').should('be.visible');
  });

  it('应该处理附件上传和删除', () => {
    // 检查初始附件
    cy.contains('file1.pdf').should('be.visible');
    cy.contains('file2.jpg').should('be.visible');
    
    // 模拟文件上传
    cy.get('.ant-upload-drag').selectFile(
      {
        contents: Cypress.Buffer.from('file content'),
        fileName: 'test.txt',
        mimeType: 'text/plain',
      },
      { action: 'drag-drop' }
    );
    
    // 检查新附件显示
    cy.contains('test.txt').should('be.visible');
    
    // 模拟附件删除
    mockExperimentAPI.deleteExperimentAttachment.resolves({});
    
    // 点击删除附件按钮
    cy.get('.deleteIcon').first().click();
    
    // 验证删除API调用
    cy.get('@deleteExperimentAttachment').should('have.been.called');
  });
});