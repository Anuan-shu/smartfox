import React from 'react';
// 替换原来的BrowserRouter导入
import { MemoryRouter as Router, Route, Routes } from 'react-router-dom';
import PhaseDetail from './index';
import { mount } from 'cypress/react'

describe('<PhaseDetail />', () => {
  const mockExperimentId = 'exp-123';
  const mockPhaseId = 'phase-456';
  const mockPhaseInfo = {
    title: '测试阶段',
    description: '这是一个测试阶段的描述'
  };

  // 创建一个包装组件来处理路由参数
  const PhaseDetailWithParams = () => {
    return (
      <Routes>
        <Route 
          path="/experiment/:experiment_id/phase/:phase_id" 
          element={<PhaseDetail />} 
        />
      </Routes>
    );
  };

  beforeEach(() => {
    // 默认立即返回成功的响应
    cy.intercept('GET', `/student/experiment/${mockExperimentId}/phase/${mockPhaseId}/details`, {
      statusCode: 200,
      body: mockPhaseInfo
    }).as('getPhaseDetails');
  });

  it('成功加载阶段详情并显示内容', () => {
    cy.mount(
      <Router initialEntries={[`/experiment/${mockExperimentId}/phase/${mockPhaseId}`]}>
        <PhaseDetailWithParams />
      </Router>
    );

    // API调用会立即完成，直接验证显示的内容
    cy.contains(mockPhaseInfo.title).should('exist');
    cy.contains(mockPhaseInfo.description).should('exist');
    
    // 验证答案输入框存在
    cy.get('textarea').should('exist');
    
    // 验证保存按钮存在
    cy.contains('button', '保存答案').should('exist');
  });

  // it('成功保存答案', () => {
  //   const mockAnswer = '这是我的测试答案';
    
  //   cy.intercept('POST', `/api/student/experiment/${mockExperimentId}/phase/${mockPhaseId}/save`, {
  //     statusCode: 200,
  //     body: { message: '保存成功' }
  //   }).as('saveAnswer');

  //   cy.mount(
  //     <Router initialEntries={[`/experiment/${mockExperimentId}/phase/${mockPhaseId}`]}>
  //       <PhaseDetailWithParams />
  //     </Router>
  //   );

  //   // 输入答案
  //   cy.get('textarea').type(mockAnswer);
    
  //   // 点击保存按钮
  //   cy.contains('button', '保存答案').click();
    
  //   // 验证保存API被调用
  //   cy.get('@saveAnswer.all').should('have.length', 1);
  //   cy.get('@saveAnswer.last').its('request.body').should('deep.equal', {
  //     answer: mockAnswer
  //   });
    
  //   // 验证成功消息显示
  //   cy.contains('答案保存成功').should('exist');
  // });

  // it('处理阶段详情加载失败的情况', () => {
  //   const errorMessage = '获取阶段详情失败';
    
  //   // 覆盖默认的拦截，返回错误响应
  //   cy.intercept('GET', `/api/student/experiment/${mockExperimentId}/phase/${mockPhaseId}/details`, {
  //     statusCode: 500,
  //     body: { message: errorMessage }
  //   }).as('getPhaseDetailsError');

  //   cy.mount(
  //     <Router initialEntries={[`/experiment/${mockExperimentId}/phase/${mockPhaseId}`]}>
  //       <PhaseDetailWithParams />
  //     </Router>
  //   );

  //   // 验证错误消息显示
  //   cy.get('.ant-alert-error').should('exist');
  //   cy.contains(errorMessage).should('exist');
  // });

  // it('处理答案保存失败的情况', () => {
  //   const mockAnswer = '这是我的测试答案';
  //   const errorMessage = '保存失败';
    
  //   cy.intercept('POST', `/api/student/experiment/${mockExperimentId}/phase/${mockPhaseId}/save`, {
  //     statusCode: 500,
  //     body: { message: errorMessage }
  //   }).as('saveAnswerError');

  //   cy.mount(
  //     <Router initialEntries={[`/experiment/${mockExperimentId}/phase/${mockPhaseId}`]}>
  //       <PhaseDetailWithParams />
  //     </Router>
  //   );

  //   // 输入答案
  //   cy.get('textarea').type(mockAnswer);
    
  //   // 点击保存按钮
  //   cy.contains('button', '保存答案').click();
    
  //   // 验证保存API被调用
  //   cy.get('@saveAnswerError.all').should('have.length', 1);
    
  //   // 验证错误消息显示
  //   cy.contains('保存失败').should('exist');
  // });

  // it('验证输入框的值变化', () => {
  //   const testAnswer = '测试输入内容';
    
  //   cy.mount(
  //     <Router initialEntries={[`/experiment/${mockExperimentId}/phase/${mockPhaseId}`]}>
  //       <PhaseDetailWithParams />
  //     </Router>
  //   );

  //   // 输入文本并验证值变化
  //   cy.get('textarea')
  //     .type(testAnswer)
  //     .should('have.value', testAnswer);
    
  //   // 清空输入并验证
  //   cy.get('textarea')
  //     .clear()
  //     .should('have.value', '');
  // });

  // it('显示加载状态（延迟响应测试）', () => {
  //   // 延迟响应以测试加载状态
  //   cy.intercept('GET', `/api/student/experiment/${mockExperimentId}/phase/${mockPhaseId}/details`, (req) => {
  //     req.reply({
  //       delay: 1000,
  //       statusCode: 200,
  //       body: mockPhaseInfo
  //     });
  //   }).as('getPhaseDetailsDelayed');

  //   cy.mount(
  //     <Router initialEntries={[`/experiment/${mockExperimentId}/phase/${mockPhaseId}`]}>
  //       <PhaseDetailWithParams />
  //     </Router>
  //   );

  //   // 验证加载状态显示
  //   cy.get('.ant-spin').should('exist');
    
  //   // 等待API完成并验证加载状态消失
  //   cy.wait('@getPhaseDetailsDelayed');
  //   cy.get('.ant-spin').should('not.exist');
  // });

  // it('验证组件初始化时调用正确的API', () => {
  //   cy.mount(
  //     <Router initialEntries={[`/experiment/${mockExperimentId}/phase/${mockPhaseId}`]}>
  //       <PhaseDetailWithParams />
  //     </Router>
  //   );

  //   // 验证API被调用且参数正确
  //   cy.get('@getPhaseDetails.all').should('have.length', 1);
  //   cy.get('@getPhaseDetails.last').its('request.url').should('include', mockExperimentId);
  //   cy.get('@getPhaseDetails.last').its('request.url').should('include', mockPhaseId);
  // });
});
