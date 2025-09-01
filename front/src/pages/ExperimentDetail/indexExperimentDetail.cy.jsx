// indexExperimentDetail.cy.jsx
import React from 'react';
import ExperimentDetail from './index';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// 模拟实验详情数据
const mockExperiment = {
  experiment_id: 'exp123',
  title: '测试实验',
  description: '这是一个测试实验描述',
  deadline: new Date(Date.now() + 86400000).toISOString(),
  submission_status: 'not_submitted',
  total_score: 100,
  questions: [
    {
      question_id: 'q1',
      content: '1 + 1 = ?',
      type: 'choice',
      score: 20,
      options: ['1', '2', '3', '4'],
      correct_answer: '2'
    },
    {
      question_id: 'q2',
      content: '请填写：计算机的基本组成包括____和____',
      type: 'blank',
      score: 30,
      correct_answer: '硬件,软件'
    },
    {
      question_id: 'q3',
      content: '请编写一个计算斐波那契数列的函数',
      type: 'code',
      score: 50,
      test_cases: [
        { input: '5', expected_output: '5' },
        { input: '10', expected_output: '55' }
      ]
    }
  ],
  files: ['guide.pdf', 'example.py'],
  student_ids: ['stu1', 'stu2']
};

describe('<ExperimentDetail />', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    
    // 使用通配符匹配端点
    cy.intercept('GET', '**/student/experiments/exp123', {
      statusCode: 200,
      body: {
        status: 'success',
        data: mockExperiment
      }
    }).as('getExperiment');

    cy.intercept('GET', '**/teacher/experiments/exp123', {
      statusCode: 200,
      body: {
        status: 'success',
        data: mockExperiment
      }
    }).as('getTeacherExperiment');

    // 修正附件端点
    cy.intercept('GET', '**/experiments/exp123/files', {
      statusCode: 200,
      body: {
        files: mockExperiment.files
      }
    }).as('getFiles');

    cy.intercept('POST', '**/student/experiments/exp123/save', {
      statusCode: 200,
      body: { status: 'success' }
    }).as('saveAnswers');

    cy.intercept('POST', '**/student/experiments/exp123/submit', {
      statusCode: 200,
      body: { status: 'success' }
    }).as('submitAnswers');
  });

  it('学生视角应该正确显示实验详情', () => {
  cy.window().then((win) => {
    win.localStorage.setItem('role', 'student');
    // 启用详细日志
    win.console.debug = win.console.log;
  });

  cy.mount(
    <MemoryRouter initialEntries={['/experiments/exp123']}>
      <Routes>
        <Route path="/experiments/:experiment_id" element={<ExperimentDetail />} />
      </Routes>
    </MemoryRouter>
  );

  // 验证请求被拦截
  cy.wait('@getExperiment').then((interception) => {
    expect(interception.response.statusCode).to.eq(200);
  });

  cy.wait('@getFiles').then((interception) => {
    expect(interception.response.statusCode).to.eq(200);
  });

  // 检查基本元素
  cy.contains('测试实验').should('exist');
  cy.contains('这是一个测试实验描述').should('exist');
  
  // 检查题目内容（不依赖特定类名）
  cy.contains('1 + 1 = ?').should('exist');
  cy.contains('计算机的基本组成包括').should('exist');
  cy.contains('计算斐波那契数列').should('exist');

  // 检查有3个题目区域（通过题目编号）
  cy.contains('题目 1').should('exist');
  cy.contains('题目 2').should('exist');
  cy.contains('题目 3').should('exist');
});

  it('老师视角应该正确显示实验详情', () => {
    cy.window().then((win) => {
      win.localStorage.setItem('role', 'teacher');
    });

    cy.mount(
      <MemoryRouter initialEntries={['/experiments/exp123']}>
        <Routes>
          <Route path="/experiments/:experiment_id" element={<ExperimentDetail />} />
        </Routes>
      </MemoryRouter>
    );

    cy.wait(['@getTeacherExperiment', '@getFiles']);

    // 检查老师特有功能
    cy.contains('button', '编辑实验').should('exist');
    cy.contains('参与学生').should('exist');
  });

  it('应该正确处理保存操作', () => {
  // 屏蔽 Monaco Editor 的错误
  Cypress.on('uncaught:exception', (err) => {
    if (err.message.includes('monaco-editor') || err.message.includes('importScripts')) {
      return false; // 阻止 Cypress 失败测试
    }
    return true;
  });

  cy.window().then((win) => {
    win.localStorage.setItem('role', 'student');
  });

  cy.mount(
    <MemoryRouter initialEntries={['/experiments/exp123']}>
      <Routes>
        <Route path="/experiments/:experiment_id" element={<ExperimentDetail />} />
      </Routes>
    </MemoryRouter>
  );

  cy.wait(['@getExperiment', '@getFiles']);

  // 等待更长时间确保组件完全渲染
  cy.contains('测试实验', { timeout: 15000 }).should('be.visible');
  cy.contains('题目 1', { timeout: 15000 }).should('be.visible');
  
  // 选择选择题答案
  cy.get('.ant-radio-wrapper').first().click();

  // 点击保存按钮
  cy.contains('button', '保存答案').click();
  
  // 等待保存请求完成
  cy.wait('@saveAnswers').then((interception) => {
    expect(interception.response.statusCode).to.eq(200);
    expect(interception.response.body.status).to.eq('success');
  });

  // 检查是否成功保存（不依赖 UI 消息，直接检查请求状态）
  cy.get('@saveAnswers').should('have.property', 'response');
  });

    it('应该处理获取实验详情失败的情况', () => {
    // 模拟获取实验详情失败
    cy.intercept('GET', '**/student/experiments/exp123', {
      statusCode: 500,
      body: {
        status: 'error',
        message: '服务器内部错误'
      }
    }).as('getExperimentError');

    cy.window().then((win) => {
      win.localStorage.setItem('role', 'student');
    });

    cy.mount(
      <MemoryRouter initialEntries={['/experiments/exp123']}>
        <Routes>
          <Route path="/experiments/:experiment_id" element={<ExperimentDetail />} />
        </Routes>
      </MemoryRouter>
    );

    // 检查错误处理
    cy.contains('实验不存在').should('exist');
  });

  // it('应该处理保存答案失败的情况', () => {
  //   // 模拟保存失败
  //   cy.intercept('POST', '**/student/experiments/exp123/save', {
  //     statusCode: 500,
  //     body: {
  //       status: 'error',
  //       message: '保存失败'
  //     }
  //   }).as('saveAnswersError');

  //   cy.window().then((win) => {
  //     win.localStorage.setItem('role', 'student');
  //   });

  //   cy.mount(
  //     <MemoryRouter initialEntries={['/experiments/exp123']}>
  //       <Routes>
  //         <Route path="/experiments/:experiment_id" element={<ExperimentDetail />} />
  //       </Routes>
  //     </MemoryRouter>
  //   );

  //   cy.wait(['@getExperiment', '@getFiles']);

  //   // 选择答案并尝试保存
  //   cy.get('.ant-radio-wrapper').first().click();
  //   cy.contains('button', '保存答案').click();
    
  //   // 检查错误消息
  //   cy.contains('保存失败').should('exist');
  // });

  // it('应该处理提交实验失败的情况', () => {
  //   // 模拟提交失败
  //   cy.intercept('POST', '**/student/experiments/exp123/submit', {
  //     statusCode: 500,
  //     body: {
  //       status: 'error',
  //       message: '提交失败'
  //     }
  //   }).as('submitAnswersError');

  //   cy.window().then((win) => {
  //     win.localStorage.setItem('role', 'student');
  //   });

  //   cy.mount(
  //     <MemoryRouter initialEntries={['/experiments/exp123']}>
  //       <Routes>
  //         <Route path="/experiments/:experiment_id" element={<ExperimentDetail />} />
  //       </Routes>
  //     </MemoryRouter>
  //   );

  //   cy.wait(['@getExperiment', '@getFiles']);

  //   // 尝试提交
  //   cy.contains('button', '提交实验').click();
    
  //   // 检查错误消息
  //   cy.contains('提交失败').should('exist');
  // });

  it('应该处理获取附件列表失败的情况', () => {
    // 模拟获取附件失败
    cy.intercept('GET', '**/experiments/exp123/files', {
      statusCode: 500,
      body: {
        message: '获取附件列表失败'
      }
    }).as('getFilesError');

    cy.window().then((win) => {
      win.localStorage.setItem('role', 'student');
    });

    cy.mount(
      <MemoryRouter initialEntries={['/experiments/exp123']}>
        <Routes>
          <Route path="/experiments/:experiment_id" element={<ExperimentDetail />} />
        </Routes>
      </MemoryRouter>
    );

    // 检查附件区域显示"暂无附件"
    cy.contains('暂无附件').should('exist');
  });

  it('应该处理过期的实验', () => {
    // 模拟已过期的实验
    const expiredExperiment = {
      ...mockExperiment,
      deadline: new Date(Date.now() - 86400000).toISOString() // 昨天过期
    };

    cy.intercept('GET', '**/student/experiments/exp123', {
      statusCode: 200,
      body: {
        status: 'success',
        data: expiredExperiment
      }
    }).as('getExpiredExperiment');

    cy.window().then((win) => {
      win.localStorage.setItem('role', 'student');
    });

    cy.mount(
      <MemoryRouter initialEntries={['/experiments/exp123']}>
        <Routes>
          <Route path="/experiments/:experiment_id" element={<ExperimentDetail />} />
        </Routes>
      </MemoryRouter>
    );

    cy.wait(['@getExpiredExperiment', '@getFiles']);

    // 检查保存和提交按钮不存在（因为已过期）
    cy.contains('button', '保存答案').should('not.exist');
    cy.contains('button', '提交实验').should('not.exist');
  });

  it('应该处理空题目列表的情况', () => {
    // 模拟没有题目的实验
    const emptyExperiment = {
      ...mockExperiment,
      questions: []
    };

    cy.intercept('GET', '**/student/experiments/exp123', {
      statusCode: 200,
      body: {
        status: 'success',
        data: emptyExperiment
      }
    }).as('getEmptyExperiment');

    cy.window().then((win) => {
      win.localStorage.setItem('role', 'student');
    });

    cy.mount(
      <MemoryRouter initialEntries={['/experiments/exp123']}>
        <Routes>
          <Route path="/experiments/:experiment_id" element={<ExperimentDetail />} />
        </Routes>
      </MemoryRouter>
    );

    cy.wait(['@getEmptyExperiment', '@getFiles']);

    // 检查没有题目显示
    cy.contains('题目 1').should('not.exist');
  });

  it('应该处理获取学生提交记录失败的情况', () => {
    cy.window().then((win) => {
      win.localStorage.setItem('role', 'teacher');
    });

    // 模拟获取学生提交记录失败
    cy.intercept('GET', '**/teacher/experiments/exp123/stu1/submissions', {
      statusCode: 500,
      body: {
        message: '获取提交记录失败'
      }
    }).as('getSubmissionError');

    cy.mount(
      <MemoryRouter initialEntries={['/experiments/exp123']}>
        <Routes>
          <Route path="/experiments/:experiment_id" element={<ExperimentDetail />} />
        </Routes>
      </MemoryRouter>
    );

    cy.wait(['@getTeacherExperiment', '@getFiles']);

    // 点击查看提交按钮
    cy.contains('button', '查看提交').first().click();
    
    // 检查错误处理
    cy.contains('获取提交记录失败').should('exist');
  });

  it('应该处理无学生参与的情况', () => {
    // 模拟没有学生的实验
    const noStudentsExperiment = {
      ...mockExperiment,
      student_ids: []
    };

    cy.intercept('GET', '**/teacher/experiments/exp123', {
      statusCode: 200,
      body: {
        status: 'success',
        data: noStudentsExperiment
      }
    }).as('getNoStudentsExperiment');

    cy.window().then((win) => {
      win.localStorage.setItem('role', 'teacher');
    });

    cy.mount(
      <MemoryRouter initialEntries={['/experiments/exp123']}>
        <Routes>
          <Route path="/experiments/:experiment_id" element={<ExperimentDetail />} />
        </Routes>
      </MemoryRouter>
    );

    cy.wait(['@getNoStudentsExperiment', '@getFiles']);

    // 检查显示"暂无学生"
    cy.contains('暂无学生').should('exist');
  });

  it('应该处理无效的用户角色', () => {
    // 设置无效的用户角色
    cy.window().then((win) => {
      win.localStorage.setItem('role', 'invalid_role');
    });

    cy.mount(
      <MemoryRouter initialEntries={['/experiments/exp123']}>
        <Routes>
          <Route path="/experiments/:experiment_id" element={<ExperimentDetail />} />
        </Routes>
      </MemoryRouter>
    );

    // 检查组件能够处理无效角色而不崩溃
    cy.contains('测试实验').should('exist');
  });
});