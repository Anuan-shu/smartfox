// src/pages/HistoryPage/indexHistoryPage.cy.jsx
import React from 'react';
import HistoryPage from './index';
import { ConfigProvider } from 'antd';

describe('<HistoryPage />', () => {
  const mockSubmissions = [
    {
      id: 1,
      experiment_id: 101,
      experiment_title: '实验一：基础编程',
      status: 'graded',
      total_score: 85,
      submitted_at: '2023-10-01T10:00:00Z',
      results: [
        { score: 30 },
        { score: 25 },
        { score: 30 }
      ]
    },
    {
      id: 2,
      experiment_id: 102,
      experiment_title: '实验二：数据结构',
      status: 'submitted',
      total_score: 0,
      submitted_at: '2023-10-05T14:30:00Z',
      results: []
    }
  ];

  const mockPagination = {
    page: 1,
    limit: 10,
    total: 2
  };

  beforeEach(() => {
    // 模拟 axios
    cy.stub(window, 'fetch').callsFake((url, options) => {
      if (url.includes('**/student/submissions')) {
        const params = new URLSearchParams(url.split('?')[1]);
        const page = parseInt(params.get('page')) || 1;
        
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            status: 'success',
            data: mockSubmissions,
            pagination: {
              ...mockPagination,
              page
            }
          })
        });
      }
      return Promise.reject(new Error('Not found'));
    });
  });

  afterEach(() => {
    cy.window().then((win) => {
      win.fetch.restore();
    });
  });

  it('成功加载历史记录 - 正向测试', () => {
    cy.mount(
      <ConfigProvider>
        <HistoryPage />
      </ConfigProvider>
    );

    // 检查加载状态
    cy.get('.ant-spin').should('exist');
    cy.contains('.ant-spin-text', '加载历史成绩...').should('be.visible');


    // 等待数据加载完成
    cy.get('.ant-card-head-title').should('contain', '实验提交历史');

    // 检查列表项
    cy.get('.ant-list-item').should('have.length', 2);
    
    // 检查第一个实验项
    cy.get('.ant-list-item:first')
      .should('contain', '实验一：基础编程')
      .and('contain', '已评分')
      .and('contain', '得分: 85 分');

    // 检查状态标签颜色
    cy.get('.ant-list-item:first .ant-tag')
      .should('have.class', 'ant-tag-green');

    // 检查题目完成情况
    cy.get('.ant-list-item:first .ant-tag-sm')
      .should('have.length', 3)
      .first()
      .should('contain', '题1: 30分');

    // 检查查看详情按钮
    cy.get('.ant-list-item:first a')
      .should('have.attr', 'href', '/experiments/101/result')
      .and('contain', '查看详情');

    // 检查提交时间
    cy.contains('提交时间:').should('exist');
  });

  // it('显示空状态 - 正向测试', () => {
  //   // 模拟空数据响应
  //   cy.stub(window, 'fetch').callsFake((url) => {
  //     if (url.includes('/student/submissions')) {
  //       return Promise.resolve({
  //         ok: true,
  //         json: () => Promise.resolve({
  //           status: 'success',
  //           data: [],
  //           pagination: {
  //             page: 1,
  //             limit: 10,
  //             total: 0
  //           }
  //         })
  //       });
  //     }
  //     return Promise.reject(new Error('Not found'));
  //   });

  //   cy.mount(
  //     <ConfigProvider>
  //       <HistoryPage />
  //     </ConfigProvider>
  //   );

  //   检查空状态提示
  //   cy.get('.ant-alert-info').should('exist');
  //   cy.contains('暂无提交记录').should('exist');
  //   cy.contains('您还没有提交过任何实验').should('exist');
  // });

  // it('API 调用失败 - 反向测试', () => {
  //   // 模拟 API 失败
  //   cy.stub(window, 'fetch').callsFake((url) => {
  //     if (url.includes('/student/submissions')) {
  //       return Promise.resolve({
  //         ok: false,
  //         json: () => Promise.resolve({
  //           message: '服务器内部错误'
  //         })
  //       });
  //     }
  //     return Promise.reject(new Error('Not found'));
  //   });

  //   cy.mount(
  //     <ConfigProvider>
  //       <HistoryPage />
  //     </ConfigProvider>
  //   );

  //   // 检查错误提示
  //   cy.get('.ant-alert-error').should('exist');
  //   cy.contains('获取历史记录失败').should('exist');
  // });

  // it('分页功能测试', () => {
  //   let callCount = 0;
    
  //   cy.stub(window, 'fetch').callsFake((url) => {
  //     if (url.includes('/student/submissions')) {
  //       callCount++;
  //       const page = callCount === 1 ? 1 : 2;
        
  //       return Promise.resolve({
  //         ok: true,
  //         json: () => Promise.resolve({
  //           status: 'success',
  //           data: mockSubmissions,
  //           pagination: {
  //             ...mockPagination,
  //             page,
  //             total: 15 // 测试多页情况
  //           }
  //         })
  //       });
  //     }
  //     return Promise.reject(new Error('Not found'));
  //   });

  //   cy.mount(
  //     <ConfigProvider>
  //       <HistoryPage />
  //     </ConfigProvider>
  //   );

  //   // 检查分页器存在
  //   cy.get('.ant-pagination').should('exist');
    
  //   // 点击第二页
  //   cy.get('.ant-pagination-item-2').click();

  //   // 验证分页请求被触发
  //   cy.wrap(null).then(() => {
  //     expect(callCount).to.be.greaterThan(1);
  //   });
  // });

  // it('状态标签显示正确', () => {
  //   cy.mount(
  //     <ConfigProvider>
  //       <HistoryPage />
  //     </ConfigProvider>
  //   );

  //   // 等待数据加载
  //   cy.get('.ant-list-item').should('have.length', 2);

  //   // 检查不同状态的颜色
  //   cy.get('.ant-list-item:first .ant-tag')
  //     .should('have.class', 'ant-tag-green'); // graded - green

  //   cy.get('.ant-list-item:last .ant-tag')
  //     .should('have.class', 'ant-tag-blue'); // submitted - blue
  // });

  // it('时间格式显示正确', () => {
  //   cy.mount(
  //     <ConfigProvider>
  //       <HistoryPage />
  //     </ConfigProvider>
  //   );

  //   // 检查时间格式化
  //   cy.contains('2023/10/1').should('exist');
  //   cy.contains('10:00:00').should('exist');
  // });
});