import React from 'react'
import { BrowserRouter as Router } from 'react-router-dom'
import RegisterPage from './index'

describe('<RegisterPage />', () => {
  beforeEach(() => {
    // 包装组件在 Router 中
    cy.mount(
      <Router>
        <RegisterPage />
      </Router>
    )
  })

  it('should render the registration form correctly', () => {
    cy.get('form').should('exist')
    cy.get('h2').should('contain', '用户注册')
    cy.get('input[placeholder="用户名"]').should('exist')
    cy.get('input[placeholder="密码"]').should('exist')
    cy.get('input[placeholder="手机号"]').should('exist')
    cy.get('button[type="submit"]').should('contain', '注册')
    cy.contains('已有账号？').should('exist')
    cy.contains('立即登录').should('exist')
  })

  it('should update form data when input values change', () => {
    cy.get('input[placeholder="用户名"]')
      .type('testuser')
      .should('have.value', 'testuser')
    
    cy.get('input[placeholder="密码"]')
      .type('password123')
      .should('have.value', 'password123')
    
    cy.get('input[placeholder="手机号"]')
      .type('13800138000')
      .should('have.value', '13800138000')
    
    cy.get('input[value="teacher"]').check()
    cy.get('input[value="teacher"]').should('be.checked')
  })

  it('should show validation error for invalid telephone format', () => {
    cy.get('input[placeholder="手机号"]')
      .type('123')
      .blur()
    
    cy.get('input[placeholder="手机号"]')
      .then(($input) => {
        expect($input[0].checkValidity()).to.be.false
      })
  })

  it('should successfully register with valid data (positive case)', () => {
    // Mock successful API response and navigation
    cy.intercept('POST', 'http://localhost:3002/api/auth/register', {
      statusCode: 200,
      body: { message: '注册成功' }
    }).as('registerRequest')

    // Stub the alert function
    cy.window().then((win) => {
      cy.stub(win, 'alert').as('alert')
    })

    // Fill out the form
    cy.get('input[placeholder="用户名"]').type('testuser')
    cy.get('input[placeholder="密码"]').type('password123')
    cy.get('input[placeholder="手机号"]').type('13800138000')
    cy.get('input[value="student"]').check()

    // Submit the form
    cy.get('button[type="submit"]').click()

    // Verify API call was made with correct data
    cy.wait('@registerRequest').its('request.body').should('deep.equal', {
      name: 'testuser',
      password: 'password123',
      telephone: '13800138000',
      role: 'student'
    })

    // Verify success behavior
    cy.get('@alert').should('be.calledWith', '注册成功')
  })

  it('should show error message when registration fails (negative case)', () => {
    // Mock failed API response
    cy.intercept('POST', 'http://localhost:3002/api/auth/register', {
      statusCode: 400,
      body: { message: '用户已存在' }
    }).as('registerRequest')

    // Stub the alert function
    cy.window().then((win) => {
      cy.stub(win, 'alert').as('alert')
    })

    // Fill out the form
    cy.get('input[placeholder="用户名"]').type('existinguser')
    cy.get('input[placeholder="密码"]').type('password123')
    cy.get('input[placeholder="手机号"]').type('13800138000')
    cy.get('input[value="student"]').check()

    // Submit the form
    cy.get('button[type="submit"]').click()

    // Verify error message is displayed
    cy.get('@alert').should('be.calledWith', '用户已存在')
  })

  it('should show network error message when request fails', () => {
    // Mock network error
    cy.intercept('POST', 'http://localhost:3002/api/auth/register', {
      forceNetworkError: true
    }).as('registerRequest')

    // Stub the alert function
    cy.window().then((win) => {
      cy.stub(win, 'alert').as('alert')
    })

    // Fill out the form
    cy.get('input[placeholder="用户名"]').type('testuser')
    cy.get('input[placeholder="密码"]').type('password123')
    cy.get('input[placeholder="手机号"]').type('13800138000')

    // Submit the form
    cy.get('button[type="submit"]').click()

    // Verify network error message is displayed
    cy.get('@alert').should('be.calledWith', '网络请求失败')
  })

  it('should navigate to login page when clicking login link', () => {
    // 验证登录链接存在且指向正确的路径
    cy.get('a[href="/login"]')
      .should('exist')
      .and('contain', '立即登录')
  })

  it('should require all fields to be filled', () => {
    // 测试表单验证 - 尝试提交空表单
    cy.get('button[type="submit"]').click()
    
    // 验证表单仍然存在（没有提交成功）
    cy.get('form').should('exist')
    
    // 验证必填字段的验证状态
    cy.get('input[placeholder="用户名"]').then(($input) => {
      expect($input[0].checkValidity()).to.be.false
    })
    
    cy.get('input[placeholder="密码"]').then(($input) => {
      expect($input[0].checkValidity()).to.be.false
    })
    
    cy.get('input[placeholder="手机号"]').then(($input) => {
      expect($input[0].checkValidity()).to.be.false
    })
  })
})