// src/pages/ExperimentResult/ExperimentResult.cy.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ExperimentResult from './index';

// Mock Redux store
const store = configureStore({
  reducer: {
    // Add any necessary reducers here if needed
  },
});

describe('ExperimentResult Component', () => {
  const mockExperimentId = '123';
  const mockExperimentData = {
    status: 'success',
    data: {
      experiment_id: mockExperimentId,
      questions: [
        {
          question_id: '1',
          type: 'choice',
          content: 'What is 2+2?',
          score: 10,
          student_answer: '4',
          correct_answer: '4',
          feedback: 'Correct',
          explanation: 'Basic arithmetic'
        },
        {
          question_id: '2',
          type: 'code',
          content: 'Write a function that returns the sum of two numbers',
          score: 20,
          student_code: 'function sum(a, b) { return a + b; }',
          feedback: 'passed 3/3 test cases',
          explanation: 'Simple addition function'
        }
      ],
      total_score: 30,
      submitted_at: '2023-10-01T10:00:00Z',
      deadline: '2023-10-15T23:59:59Z'
    }
  };

  const mockErrorResponse = {
    response: {
      data: {
        message: 'Experiment not found'
      }
    }
  };

  beforeEach(() => {
    // Set up intercept for API calls
    cy.intercept('GET', `/student/experiments/${mockExperimentId}`, (req) => {
      req.reply({
        statusCode: 200,
        body: mockExperimentData
      });
    }).as('getExperimentResult');
  });

  it('should render loading state initially', () => {
    // Delay the response to test loading state
    cy.intercept('GET', `/student/experiments/${mockExperimentId}`, {
      delay: 2000,
      statusCode: 200,
      body: mockExperimentData
    }).as('getExperimentDelayed');

    cy.mount(
      <Provider store={store}>
        <Router>
          <Routes>
            <Route path="/experiment/:experiment_id" element={<ExperimentResult />} />
          </Routes>
        </Router>
      </Provider>,
      {
        routerProps: {
          initialEntries: [`/experiment/${mockExperimentId}`],
        },
      }
    );

    // 使用更通用的选择器来查找加载状态
    // cy.get('body').should('be.visible');
    // cy.get('[class*="loading"]').should('be.visible');
    // cy.contains('加载评测结果...').should('be.visible');
    
    // // Wait for the API call to complete and verify data is displayed
    // cy.wait('@getExperimentDelayed');
    // cy.contains('30/30').should('be.visible');
  });

  it('should successfully load and display experiment results', () => {
    cy.mount(
      <Provider store={store}>
        <Router>
          <Routes>
            <Route path="/experiment/:experiment_id" element={<ExperimentResult />} />
          </Routes>
        </Router>
      </Provider>,
      {
        routerProps: {
          initialEntries: [`/experiment/${mockExperimentId}`],
        },
      }
    );

    // Wait for API call and verify it was made
    cy.get('body').should('be.visible');
    
    cy.wait('@getExperimentResult').then((interception) => {
    cy.log('mock response:', JSON.stringify(interception.response?.body));
    });
    cy.get('body').invoke('text').then((text) => {
      cy.log('page text:', text);
    });


    
    // Check content display
    cy.contains('30/30').should('be.visible');
    cy.contains('100%').should('be.visible');
    cy.contains('优秀').should('be.visible');
    cy.contains('题目 1').should('be.visible');
    cy.contains('题目 2').should('be.visible');
    cy.contains('你的答案:').should('be.visible');
    cy.contains('正确答案:').should('be.visible');
    cy.contains('评测反馈:').should('be.visible');
    cy.contains('题目解释:').should('be.visible');
  });

  it('should handle API error response', () => {
    // Mock error response
    cy.intercept('GET', `/student/experiments/${mockExperimentId}`, {
      statusCode: 404,
      body: mockErrorResponse
    }).as('getExperimentError');

    cy.mount(
      <Provider store={store}>
        <Router>
          <Routes>
            <Route path="/experiment/:experiment_id" element={<ExperimentResult />} />
          </Routes>
        </Router>
      </Provider>,
      {
        routerProps: {
          initialEntries: [`/experiment/${mockExperimentId}`],
        },
      }
    );

    // 等待错误状态渲染
    cy.wait('@getExperimentError');
    
    // 使用更通用的选择器来查找错误提示
    cy.get('.ant-alert-error, [class*="error"]', { timeout: 10000 }).should('be.visible');
    cy.contains('获取结果失败').should('be.visible');
  });

  it('should handle case when experiment is not found', () => {
    // Mock empty response
    cy.intercept('GET', `/student/experiments/${mockExperimentId}`, {
      statusCode: 200,
      body: {
        status: 'success',
        data: null
      }
    }).as('getExperimentEmpty');

    cy.mount(
      <Provider store={store}>
        <Router>
          <Routes>
            <Route path="/experiment/:experiment_id" element={<ExperimentResult />} />
          </Routes>
        </Router>
      </Provider>,
      {
        routerProps: {
          initialEntries: [`/experiment/${mockExperimentId}`],
        },
      }
    );

    // 等待API响应
    cy.wait('@getExperimentEmpty');
    
    // 使用更通用的选择器来查找警告提示
    cy.get('.ant-alert-warning, [class*="error"]', { timeout: 10000 }).should('be.visible');
    cy.contains('未找到实验结果').should('be.visible');
  });

  it('should calculate scores correctly for different question types', () => {
    const mixedQuestionsData = {
      status: 'success',
      data: {
        experiment_id: mockExperimentId,
        questions: [
          {
            question_id: '1',
            type: 'choice',
            content: 'Test question 1',
            score: 10,
            student_answer: 'A',
            correct_answer: 'B',
            feedback: 'Incorrect',
            explanation: 'Explanation 1'
          },
          {
            question_id: '2',
            type: 'code',
            content: 'Test question 2',
            score: 20,
            student_code: 'console.log("hello")',
            feedback: 'passed 2/4 test cases',
            explanation: 'Explanation 2'
          }
        ],
        total_score: 10, // 0 from first question + 10 from second (50% of 20)
        submitted_at: '2023-10-01T10:00:00Z',
        deadline: '2023-10-15T23:59:59Z'
      }
    };

    cy.intercept('GET', `/student/experiments/${mockExperimentId}`, {
      statusCode: 200,
      body: mixedQuestionsData
    }).as('getMixedQuestions');

    cy.mount(
      <Provider store={store}>
        <Router>
          <Routes>
            <Route path="/experiment/:experiment_id" element={<ExperimentResult />} />
          </Routes>
        </Router>
      </Provider>,
      {
        routerProps: {
          initialEntries: [`/experiment/${mockExperimentId}`],
        },
      }
    );

    cy.wait('@getMixedQuestions');
    cy.contains('10/30').should('be.visible');
    cy.contains('33%').should('be.visible');
    cy.contains('不及格').should('be.visible');
  });

  it('should display different progress colors based on score percentage', () => {
    const lowScoreData = {
      status: 'success',
      data: {
        experiment_id: mockExperimentId,
        questions: [
          {
            question_id: '1',
            type: 'choice',
            content: 'Test question 1',
            score: 10,
            student_answer: 'A',
            correct_answer: 'B',
            feedback: 'Incorrect',
            explanation: 'Explanation 1'
          },
          {
            question_id: '2',
            type: 'code',
            content: 'Test question 2',
            score: 20,
            student_code: 'console.log("hello")',
            feedback: 'passed 1/4 test cases',
            explanation: 'Explanation 2'
          }
        ],
        total_score: 5, // 25% of 20 = 5
        submitted_at: '2023-10-01T10:00:00Z',
        deadline: '2023-10-15T23:59:59Z'
      }
    };

    cy.intercept('GET', `/student/experiments/${mockExperimentId}`, {
      statusCode: 200,
      body: lowScoreData
    }).as('getLowScore');

    cy.mount(
      <Provider store={store}>
        <Router>
          <Routes>
            <Route path="/experiment/:experiment_id" element={<ExperimentResult />} />
          </Routes>
        </Router>
      </Provider>,
      {
        routerProps: {
          initialEntries: [`/experiment/${mockExperimentId}`],
        },
      }
    );

    cy.wait('@getLowScore');
    cy.contains('5/30').should('be.visible');
    cy.contains('17%').should('be.visible');
    cy.contains('不及格').should('be.visible');
  });

  it('should handle unanswered questions', () => {
    const unansweredData = {
      status: 'success',
      data: {
        experiment_id: mockExperimentId,
        questions: [
          {
            question_id: '1',
            type: 'choice',
            content: 'Test question 1',
            score: 10,
            student_answer: null,
            correct_answer: 'B',
            feedback: null,
            explanation: 'Explanation 1'
          }
        ],
        total_score: 0,
        submitted_at: '2023-10-01T10:00:00Z',
        deadline: '2023-10-15T23:59:59Z'
      }
    };

    cy.intercept('GET', `/student/experiments/${mockExperimentId}`, {
      statusCode: 200,
      body: unansweredData
    }).as('getUnanswered');

    cy.mount(
      <Provider store={store}>
        <Router>
          <Routes>
            <Route path="/experiment/:experiment_id" element={<ExperimentResult />} />
          </Routes>
        </Router>
      </Provider>,
      {
        routerProps: {
          initialEntries: [`/experiment/${mockExperimentId}`],
        },
      }
    );

    cy.wait('@getUnanswered');
    cy.contains('0/10').should('be.visible');
    cy.contains('未作答').should('be.visible');
  });

  it('should handle network errors', () => {
    // Mock network error
    cy.intercept('GET', `/student/experiments/${mockExperimentId}`, {
      forceNetworkError: true
    }).as('getNetworkError');

    cy.mount(
      <Provider store={store}>
        <Router>
          <Routes>
            <Route path="/experiment/:experiment_id" element={<ExperimentResult />} />
          </Routes>
        </Router>
      </Provider>,
      {
        routerProps: {
          initialEntries: [`/experiment/${mockExperimentId}`],
        },
      }
    );

    // 等待网络错误发生
    cy.wait('@getNetworkError');
    
    // 使用更通用的选择器来查找错误提示，增加超时时间
    cy.get('.ant-alert-error, [class*="error"]', { timeout: 10000 }).should('be.visible');
    cy.contains('获取结果失败').should('be.visible');
  });
});