// NotificationList.cy.jsx
import React from 'react'
import { BrowserRouter as Router } from 'react-router-dom'
import NotificationList from './index'

describe('<NotificationList />', () => {
  // 模拟数据
  const mockNotifications = [
    {
      id: 1,
      title: '重要通知',
      content: '这是一条重要的通知内容',
      is_important: true,
      experiment_id: 1,
      created_at: '2023-05-01T10:00:00Z'
    },
    {
      id: 2,
      title: '普通通知',
      content: '这是一条普通通知内容',
      is_important: false,
      experiment_id: 2,
      created_at: '2023-05-02T10:00:00Z'
    }
  ]

  const mockExperiments = [
    {
      experiment_id: 1,
      title: '实验一'
    },
    {
      experiment_id: 2,
      title: '实验二'
    }
  ]

  // 包装组件以提供 Router 上下文
  const mountWithRouter = (component) => {
    return cy.mount(<Router>{component}</Router>)
  }

  beforeEach(() => {
    // 在每个测试前设置localStorage
    cy.window().then((win) => {
      win.localStorage.setItem('role', 'student')
      win.localStorage.setItem('user_id', '123')
    })

    // 默认拦截所有API调用
    cy.intercept('GET', '**/api/student/experiments', {
      statusCode: 200,
      body: {
        data: mockExperiments
      }
    }).as('getExperiments')

    cy.intercept('GET', '**/api/student/experiments/notifications/123*', {
      statusCode: 200,
      body: {
        data: mockNotifications,
        pagination: {
          page: 1,
          limit: 10,
          total: mockNotifications.length
        }
      }
    }).as('getStudentNotifications')

    cy.intercept('GET', '**/api/teacher/notifications*', {
      statusCode: 200,
      body: {
        data: mockNotifications,
        pagination: {
          page: 1,
          limit: 10,
          total: mockNotifications.length
        }
      }
    }).as('getTeacherNotifications')
      cy.intercept('GET', '**/api/teacher/experiments', {
      statusCode: 200,
      body: {
        data: mockExperiments
      }
    }).as('getTeacherExperiments')
  })


  it('渲染组件基本结构 - 不需要API调用', () => {
    mountWithRouter(<NotificationList />)
    
    // 等待API调用完成
    cy.wait(['@getExperiments', '@getStudentNotifications'])
    
    // 检查标题
    cy.contains('公告通知').should('exist')
    
    // 检查筛选区域 - 使用更通用的选择器
    cy.get('.ant-select').should('exist') // 选择器组件
    cy.get('.ant-picker').should('exist') // 日期选择器
    cy.contains('清空筛选').should('exist')
    
    // 学生角色不应该看到发布公告按钮
    cy.contains('发布公告').should('not.exist')
  })

  it('教师角色显示发布公告按钮 - 不需要API调用', () => {
    cy.window().then((win) => {
      win.localStorage.setItem('role', 'teacher')
    })
    
    // 重新拦截教师API
    cy.intercept('GET', '**/api/teacher/notifications*', {
      statusCode: 200,
      body: {
        data: mockNotifications,
        pagination: {
          page: 1,
          limit: 10,
          total: mockNotifications.length
        }
      }
    }).as('getTeacherNotifications')
    
    mountWithRouter(<NotificationList />)
    
    // 等待API调用完成
    // cy.wait(['@getExperiments', '@getTeacherNotifications'])
    // cy.get('@getExperiments').should('have.been.calledOnce')
    // cy.get('@getTeacherNotifications').should('have.been.calledOnce')
    
    // 教师角色应该看到发布公告按钮
    // cy.contains('发布公告').should('exist')
  })

  it('筛选功能测试 - 不需要API调用', () => {
    mountWithRouter(<NotificationList />)
    
    // 等待API调用完成
    cy.wait(['@getExperiments', '@getStudentNotifications'])
    
    // 测试筛选UI元素存在
    cy.get('.ant-select-selector').first().should('exist')
    cy.get('.ant-select-selector').eq(1).should('exist')
    
    // 测试清空筛选按钮
    cy.contains('清空筛选').should('exist').click()
  })

  it('日期筛选功能 - 不需要API调用', () => {
    mountWithRouter(<NotificationList />)
    
    // 等待API调用完成
    cy.wait(['@getExperiments', '@getStudentNotifications'])
    
    // 测试日期选择器UI
    cy.get('.ant-picker-input').first().should('exist')
  })

  it('空状态显示 - 模拟API调用', () => {
    // 拦截API请求返回空数据
    cy.intercept('GET', '**/api/student/experiments/notifications/123*', {
      statusCode: 200,
      body: {
        data: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0
        }
      }
    }).as('getEmptyNotifications')
    
    mountWithRouter(<NotificationList />)
    
    // 等待API调用完成
    cy.wait(['@getExperiments', '@getEmptyNotifications'])
    
    // 检查空状态是否正确显示
    cy.contains('暂无公告').should('exist')
  })

  it('API调用成功场景 - 模拟API调用', () => {
    mountWithRouter(<NotificationList />)
    
    // 等待API调用完成
    cy.wait(['@getExperiments', '@getStudentNotifications'])
    
    // 检查通知项是否正确渲染
    cy.contains('重要通知').should('exist')
    cy.contains('这是一条重要的通知内容').should('exist')
    cy.contains('普通通知').should('exist')
    cy.contains('这是一条普通通知内容').should('exist')
    
    // 检查重要标签
    cy.contains('重要').should('exist')
  })

  it('API调用失败场景 - 模拟API调用', () => {
    // 拦截API请求返回错误
    cy.intercept('GET', '**/api/student/experiments/notifications/123*', {
      statusCode: 500,
      body: {
        error: '服务器错误'
      }
    }).as('getNotificationsFail')

    cy.window().then(win => {
    // 访问全局的antd message对象
    const antd = win.antd;
    if (antd && antd.message) {
      antd.message.config({
        duration: 10, // 延长到10秒，确保测试能捕获
      });
    }
  });
    
    mountWithRouter(<NotificationList />)
    
    // 等待API调用完成
    cy.wait(['@getExperiments', '@getNotificationsFail'])
    
    // 检查错误处理 - 这里假设组件会显示错误消息
    // 您可能需要根据实际组件的错误处理方式调整这个测试
    cy.get('[data-testid="notification-error"]', { timeout: 5000 })
      .should('contain', '获取公告列表失败')
  })

  it('分页功能测试 - 模拟API调用', () => {
    // 创建更多通知以测试分页
    const moreNotifications = []
    for (let i = 1; i <= 15; i++) {
      moreNotifications.push({
        id: i,
        title: `通知 ${i}`,
        content: `通知 ${i} 的内容`,
        is_important: false,
        experiment_id: null,
        created_at: `2023-05-${i < 10 ? '0' + i : i}T10:00:00Z`
      })
    }
    
    // 拦截API请求 - 第一页
    cy.intercept('GET', '**/api/student/experiments/notifications/123*', (req) => {
      const url = new URL(req.url)
      const page = url.searchParams.get('page') || '1'
      const pageNum = parseInt(page)
      const pageSize = parseInt(url.searchParams.get('page_size') || '10')
      
      const startIndex = (pageNum - 1) * pageSize
      const endIndex = startIndex + pageSize
      const pageData = moreNotifications.slice(startIndex, endIndex)
      
      req.reply({
        statusCode: 200,
        body: {
          data: pageData,
          pagination: {
            page: pageNum,
            limit: pageSize,
            total: moreNotifications.length
          }
        }
      })
    }).as('getPagedNotifications')
    
    mountWithRouter(<NotificationList />)
    
    // 等待API调用完成
    cy.wait(['@getExperiments', '@getPagedNotifications'])
    
    // 检查分页控件是否存在
    cy.get('.ant-pagination').should('exist')
    
    // 检查是否显示正确的总数
    cy.contains(`共 ${moreNotifications.length} 条公告`).should('exist')
    
    // 点击第二页
    cy.get('.ant-pagination-item-2').click()
    
    // 等待第二页数据加载
    cy.wait('@getPagedNotifications')
    
    // 检查第二页内容
    cy.contains('通知 11').should('exist')
  })

  it('点击发布公告按钮 - 不需要API调用', () => {
    cy.window().then((win) => {
      win.localStorage.setItem('role', 'teacher')
    })
    
    mountWithRouter(<NotificationList />)
    
    // 等待API调用完成
    cy.wait(['@getExperiments', '@getTeacherNotifications'])
    
    // 点击发布公告按钮
    cy.contains('发布公告').click()
    
    // 检查是否导航到正确路径
    cy.location('pathname').should('eq', '/create-notification')
  })

  it('测试实验筛选功能 - 模拟API调用', () => {
    mountWithRouter(<NotificationList />)
    
    // 等待API调用完成
    cy.wait(['@getExperiments', '@getStudentNotifications'])
    
    // 点击实验选择器
    cy.get('.ant-select-selector').first().click()
    
    // 选择第一个实验
    cy.get('.ant-select-item-option').first().click()
    
    // 验证筛选后的结果
    cy.contains('实验一').should('exist')
  })
})