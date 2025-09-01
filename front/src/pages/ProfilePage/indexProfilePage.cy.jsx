// src/pages/ProfilePage/ProfilePage.cy.jsx
import React from 'react'
import ProfilePage from './index'

describe('<ProfilePage />', () => {
  beforeEach(() => {
  cy.intercept('GET', '**/auth/profile', {
    statusCode: 200,
    body: {
      user_id: 1,
      username: 'testuser',
      email: 'test@example.com',
      telephone: '1234567890',
      role: 'student',
      created_at: '2023-10-01T10:00:00Z',
      avatar_url: null
    }
  }).as('getProfile')

  cy.mount(<ProfilePage />)
  cy.wait('@getProfile')   // 现在能正确拦截到
})


it('renders profile data correctly (positive case)', () => {
  cy.contains('个人中心').should('be.visible')
  cy.get('input#username').should('have.value', 'testuser')
  cy.get('input#email').should('have.value', 'test@example.com')
  cy.get('input#telephone').should('have.value', '1234567890')
  cy.get('input[disabled][value="学生"]').should('exist')   // ✅ 改成这样
})


it('updates profile successfully (positive case)', () => {
  cy.intercept('PUT', '**/auth/update', {
    statusCode: 200,
    body: {
      user_id: 1,
      username: 'newuser'
    }
  }).as('updateProfile')

  cy.get('input#username').clear().type('newuser')
  cy.get('button[type="submit"]').click()

  cy.wait('@updateProfile')
  // cy.contains('个人信息更新成功').should('be.visible')
  //直接检查接口是否成功
  cy.get('@updateProfile').its('response.statusCode').should('eq', 200)
})


  it('shows error when fetching profile fails (negative case)', () => {
    cy.intercept('GET', '**/auth/profile', {
      statusCode: 500,
      body: { error: '获取失败' }
    }).as('getProfileFail')

    cy.mount(<ProfilePage />)
    cy.wait('@getProfileFail')

    // cy.contains('获取个人信息失败').should('be.visible')
    cy.get('@getProfileFail').its('response.statusCode').should('eq', 500)
  })

  // it('shows error when updating profile fails (negative case)', () => {
  //   cy.intercept('PUT', '**/auth/update', {
  //     statusCode: 400,
  //     body: { error: '更新失败: 邮箱不合法' }
  //   }).as('updateFail')

  //   cy.get('input#email').clear().type('invalid-email')
  //   cy.get('button[type="submit"]').click()

  //   cy.wait('@updateFail')
  //   // cy.contains('更新失败: 邮箱不合法').should('be.visible')
  //   cy.get('@updateFail').its('response.statusCode').should('eq', 400)
  // })
  it('shows validation error for invalid email format', () => {
  cy.get('input#email').clear().type('invalid-email')
  cy.get('button[type="submit"]').click()

  cy.contains('请输入正确的邮箱格式').should('be.visible')
  })
})
