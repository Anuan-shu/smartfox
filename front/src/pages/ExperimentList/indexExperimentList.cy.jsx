import React from 'react'
import ExperimentList from './index'
import { experimentAPI } from '../../utils/api' // 导入API模块

// 辅助函数：获取API路径
const getApiEndpoint = (role) => {
  // 从API模块获取对应的路径（移除开头的斜杠，因为cy.intercept需要）
  return experimentAPI.getExperiments.toString().match(/'(\/[^']+)'/)[1].slice(1)
}

describe('<ExperimentList />', () => {
  const mockExperiments = [
    {
      experiment_id: 1,
      title: '实验1',
      description: '描述1',
      deadline: '2024-12-31',
      status: 'active',
      submission_status: 'in_progress'
    },
    {
      experiment_id: 2,
      title: '实验2',
      description: '描述2',
      deadline: '2024-11-30',
      status: 'expired',
      submission_status: 'submitted'
    },
    {
      experiment_id: 3,
      title: '实验3',
      description: '描述3',
      deadline: '2025-01-15',
      status: 'not_started',
      submission_status: null
    }
  ]

  const mockPagination = {
    page: 1,
    limit: 10,
    total: 3
  }

  // 获取学生和教师的API路径
  const studentEndpoint = getApiEndpoint('student')
  const teacherEndpoint = getApiEndpoint('teacher')

  beforeEach(() => {
    // 设置 localStorage
    cy.window().then((win) => {
      win.localStorage.setItem('role', 'student')
    })

    // 在测试用例开头或beforeEach中配置拦截
    cy.intercept(
      'GET', 
      '/api/student/experiments*'  // 注意用通配符*匹配带参数的URL
    ).as('getExperiments');  // 别名必须和cy.wait中使用的一致

    // 拦截 API 请求 - 使用从API模块获取的路径
    cy.intercept('GET', `${studentEndpoint}*`, {
      statusCode: 200,
      body: {
        status: 'success',
        data: mockExperiments,
        pagination: mockPagination
      }
    }).as('getExperiments')
  })

  it('正常渲染组件 - 学生角色', () => {
    cy.mount(<ExperimentList />)
    
    // 等待 API 调用完成
    cy.wait('@getExperiments')
    
    // 检查加载状态消失
    cy.get('.ant-spin').should('not.exist')
    
    // 检查实验卡片渲染
    cy.get('[class*="card"]').should('have.length', 3)
    cy.contains('实验1').should('exist')
    cy.contains('实验2').should('exist')
    cy.contains('实验3').should('exist')
    
    // 检查状态标签
    cy.contains('进行中').should('exist')
    cy.contains('已过期').should('exist')
    cy.contains('未开始').should('exist')
    
    // 检查分页组件
    cy.get('.ant-pagination').should('exist')
  })

  it('正常渲染组件 - 教师角色', () => {
    cy.window().then((win) => {
      win.localStorage.setItem('role', 'teacher')
    })

    // 使用教师API路径
    cy.intercept('GET', `${teacherEndpoint}*`, {
      statusCode: 200,
      body: {
        status: 'success',
        data: mockExperiments,
        pagination: mockPagination
      }
    }).as('getTeacherExperiments')

    cy.mount(<ExperimentList />)
    
    cy.wait('@getTeacherExperiments')
    cy.get('.ant-spin').should('not.exist')
    
    // 检查教师专属功能
    cy.contains('查看详情').should('exist')
    cy.contains('编辑').should('exist')
  })

  it('处理API请求失败', () => {
    // 使用学生API路径
    cy.intercept('GET', `${studentEndpoint}*`, {
      statusCode: 500,
      body: { error: '服务器错误' }
    }).as('getExperimentsError')

    cy.mount(<ExperimentList />)
    
    cy.wait('@getExperimentsError')
    cy.get('.ant-spin').should('not.exist')
    
    // 检查错误处理
    cy.get('[class*="container"]').should('exist')
  })

  it('过滤功能测试 - 进行中', () => {
    const activeExperiments = [mockExperiments[0]]
    
    // 使用学生API路径并添加过滤参数
    cy.intercept('GET', `${studentEndpoint}?status=active*`, {
      statusCode: 200,
      body: {
        status: 'success',
        data: activeExperiments,
        pagination: { ...mockPagination, total: 1 }
      }
    }).as('getActiveExperiments')

    cy.mount(<ExperimentList />)
    cy.wait('@getExperiments')
    
    // 点击进行中过滤器
    cy.contains('进行中').click()
    
    cy.wait('@getActiveExperiments')
    
    // 检查过滤后的结果
    cy.get('[class*="card"]').should('have.length', 1)
    cy.contains('实验1').should('exist')
    cy.contains('实验2').should('not.exist')
  })

  it('过滤功能测试 - 已过期', () => {
    const expiredExperiments = [mockExperiments[1]]
    
    // 使用学生API路径并添加过滤参数
    cy.intercept('GET', `${studentEndpoint}?status=expired*`, {
      statusCode: 200,
      body: {
        status: 'success',
        data: expiredExperiments,
        pagination: { ...mockPagination, total: 1 }
      }
    }).as('getExpiredExperiments')

    cy.mount(<ExperimentList />)
    cy.wait('@getExperiments')
    
    // 点击已过期过滤器
    cy.contains('已过期').click()
    
    cy.wait('@getExpiredExperiments')
    
    // 检查过滤后的结果
    cy.get('[class*="card"]').should('have.length', 1)
    cy.contains('实验2').should('exist')
  })

  it('分页功能测试', () => {
    // 使用学生API路径并添加分页参数
    cy.intercept('GET', `${studentEndpoint}?page=2*`, {
      statusCode: 200,
      body: {
        status: 'success',
        data: mockExperiments,
        pagination: { ...mockPagination, page: 2 }
      }
    }).as('getPage2Experiments')

    cy.mount(<ExperimentList />)
    cy.wait('@getExperiments')
    
    // 点击分页的第二页
    cy.get('.ant-pagination-item-2').click()
    
    cy.wait('@getPage2Experiments')
    
    // 验证分页功能正常工作
    cy.get('.ant-pagination-item-2').should('have.class', 'ant-pagination-item-active')
  })

  // 其他测试用例保持不变...
  
  it('空状态处理', () => {
    // 使用学生API路径
    cy.intercept('GET', `${studentEndpoint}*`, {
      statusCode: 200,
      body: {
        status: 'success',
        data: [],
        pagination: { ...mockPagination, total: 0 }
      }
    }).as('getEmptyExperiments')

    cy.mount(<ExperimentList />)
    cy.wait('@getEmptyExperiments')
    cy.get('.ant-spin').should('not.exist')
    
    // 检查没有实验卡片
    cy.get('[class*="card"]').should('not.exist')
    
    // 检查分页组件隐藏
    cy.get('.ant-pagination').should('not.exist')
  })

  it('教师角色的编辑链接显示正确', () => {
    cy.window().then((win) => {
      win.localStorage.setItem('role', 'teacher')
    })

    // 使用教师API路径
    cy.intercept('GET', `${teacherEndpoint}*`, {
      statusCode: 200,
      body: {
        status: 'success',
        data: mockExperiments,
        pagination: mockPagination
      }
    }).as('getTeacherExperiments')

    cy.mount(<ExperimentList />)
    cy.wait('@getTeacherExperiments')
    cy.get('.ant-spin').should('not.exist')
    
    // 检查编辑链接
    cy.get('a[href*="/edit-experiment/1"]').should('exist')
    cy.get('a[href*="/edit-experiment/2"]').should('exist')
    cy.get('a[href*="/edit-experiment/3"]').should('exist')
  })
})