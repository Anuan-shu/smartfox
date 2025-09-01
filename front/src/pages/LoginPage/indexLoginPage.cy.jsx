// LoginPage.cy.jsx
import React from 'react'
import { BrowserRouter as Router } from 'react-router-dom'
import LoginPage from './index'

describe('<LoginPage />', () => {
  // 包装组件以提供Router上下文
  const mountWithRouter = (component) => {
    return cy.mount(<Router>{component}</Router>)
  }

  beforeEach(() => {
    mountWithRouter(<LoginPage />)
  })

  it('should render login form correctly', () => {
    // 检查表单元素是否存在
    cy.get('form').should('exist')
    cy.get('h2').contains('用户登录')
    cy.get('input[type="text"]').should('exist')
    cy.get('input[type="password"]').should('exist')
    cy.get('button[type="submit"]').contains('登录')
    cy.get('button[type="button"]').contains('注册')
  })

  it('should update credentials state on input change', () => {
    // 测试输入框状态更新
    const testName = 'testuser'
    const testPassword = 'testpass123'
    
    cy.get('input[type="text"]').type(testName)
      .should('have.value', testName)
    
    cy.get('input[type="password"]').type(testPassword)
      .should('have.value', testPassword)
  })

  it('should handle successful login with API call (positive test)', () => {
    // 模拟成功的API响应
    const mockToken = 'mock-jwt-token'
    const mockProfile = {
      role: 'teacher',
      username: 'testuser',
      user_id: '123'
    }

    // 拦截登录API
    cy.intercept('POST', 'http://localhost:3002/api/auth/login', {
      statusCode: 200,
      body: {
        code: 200,
        message: '登录成功',
        data: { token: mockToken }
      }
    }).as('loginRequest')

    // 拦截获取用户信息API
    cy.intercept('GET', 'http://localhost:3002/api/auth/profile', {
      statusCode: 200,
      body: mockProfile
    }).as('profileRequest')

    // 输入凭据并提交
    cy.get('input[type="text"]').type('testuser')
    cy.get('input[type="password"]').type('correctpassword')
    cy.get('button[type="submit"]').click()

    // 验证API调用
    cy.wait('@loginRequest').its('request.body').should('deep.equal', {
      name: 'testuser',
      password: 'correctpassword'
    })

    cy.wait('@profileRequest').its('request.headers').should('include', {
      authorization: mockToken
    })

    // 验证本地存储
    cy.window().its('localStorage.token').should('equal', mockToken)
    cy.window().its('localStorage.role').should('equal', mockProfile.role)
    cy.window().its('localStorage.username').should('equal', mockProfile.username)
    cy.window().its('localStorage.user_id').should('equal', mockProfile.user_id)

    // 验证导航 - 通过检查URL变化
    cy.location('pathname').should('eq', '/experiments')
  })

  it('should handle login failure with API call (negative test)', () => {
    // 模拟登录失败的API响应
    cy.intercept('POST', 'http://localhost:3002/api/auth/login', {
      statusCode: 200,
      body: {
        code: 401,
        message: '用户名或密码错误'
      }
    }).as('loginRequest')

    // 监听alert
    const alertStub = cy.stub()
    cy.on('window:alert', alertStub)

    // 输入凭据并提交
    cy.get('input[type="text"]').type('wronguser')
    cy.get('input[type="password"]').type('wrongpassword')
    cy.get('button[type="submit"]').click()

    // 验证API调用
    cy.wait('@loginRequest').its('request.body').should('deep.equal', {
      name: 'wronguser',
      password: 'wrongpassword'
    })

    // 验证错误处理
    cy.wrap(alertStub).should('be.calledWith', '用户名或密码错误')
    
    // 验证token未被存储
    cy.window().then((win) => {
      expect(win.localStorage.getItem('token')).to.be.null
    })
  })

  it('should handle profile fetch failure after successful login', () => {
    // 模拟登录成功但获取用户信息失败
    const mockToken = 'mock-jwt-token'

    cy.intercept('POST', 'http://localhost:3002/api/auth/login', {
      statusCode: 200,
      body: {
        code: 200,
        message: '登录成功',
        data: { token: mockToken }
      }
    }).as('loginRequest')

    cy.intercept('GET', 'http://localhost:3002/api/auth/profile', {
      statusCode: 500,
      body: { message: '服务器错误' }
    }).as('profileRequest')

    // 监听alert
    const alertStub = cy.stub()
    cy.on('window:alert', alertStub)

    // 输入凭据并提交
    cy.get('input[type="text"]').type('testuser')
    cy.get('input[type="password"]').type('correctpassword')
    cy.get('button[type="submit"]').click()

    // 验证API调用
    cy.wait('@loginRequest')
    cy.wait('@profileRequest')

    // 验证错误处理和token清理
    cy.wrap(alertStub).should('be.calledWith', '获取用户信息失败')
    cy.window().then((win) => {
      expect(win.localStorage.getItem('token')).to.be.null
    })
  })

  it('should navigate to register page when register button is clicked', () => {
    // 测试注册按钮导航
    cy.get('button[type="button"]').contains('注册').click()
    // 验证URL变化
    cy.location('pathname').should('eq', '/register')
  })

  it('should handle network errors gracefully', () => {
    // 模拟网络错误
    cy.intercept('POST', 'http://localhost:3002/api/auth/login', {
      forceNetworkError: true
    }).as('loginRequest')

    // 监听alert
    const alertStub = cy.stub()
    cy.on('window:alert', alertStub)

    // 输入凭据并提交
    cy.get('input[type="text"]').type('testuser')
    cy.get('input[type="password"]').type('password')
    cy.get('button[type="submit"]').click()

    // 验证错误处理
    cy.wrap(alertStub).should('be.called')
  })

  // 清理本地存储的afterEach钩子
  afterEach(() => {
    cy.window().then((win) => {
      win.localStorage.clear()
    })
  })
})