import React from 'react'
import StudentGroupManagement from './index'

describe('<StudentGroupManagement />', () => {
  beforeEach(() => {
    // mock 学生列表接口
    cy.intercept('GET', '**/teacher/students*', {
      statusCode: 200,
      body: {
        data: [
          {
            user_id: 1,
            username: '张三',
            telephone: '12345678901',
            email: 'zhangsan@example.com',
            group_ids: [101],
            created_at: '2023-10-10T10:00:00Z'
          },
          {
            user_id: 2,
            username: '李四',
            telephone: '98765432109',
            email: 'lisi@example.com',
            group_ids: [],
            created_at: '2023-10-12T11:11:11Z'
          }
        ],
        pagination: { page: 1, limit: 10, total: 2 }
      }
    }).as('getStudents')

    // mock 分组列表接口
    cy.intercept('GET', '**/teacher/groups*', {
      statusCode: 200,
      body: {
        data: [
          {
            group_id: 101,
            group_name: '第一组',
            student_ids: ['1'],
            student_count: 1
          }
        ],
        pagination: { page: 1, limit: 10, total: 1 }
      }
    }).as('getGroups')

    cy.mount(<StudentGroupManagement />)
    cy.wait('@getStudents')
    cy.wait('@getGroups')
  })

  it('renders 学生列表', () => {
    cy.contains('学生分组管理系统').should('be.visible')
    cy.contains('学生列表').click()
    cy.get('table').should('contain', '张三')
    cy.get('table').should('contain', '李四')
    cy.get('table').should('contain', '第一组')
  })

  it('renders 分组管理列表', () => {
    cy.contains('分组管理').click()
    cy.get('table').should('contain', '第一组')
    cy.get('table').should('contain', '1')
  })

  it('creates a new group', () => {
  // 切换到分组管理
  cy.get('.ant-tabs-tab').contains('分组管理').click()

  // mock 创建分组接口
  cy.intercept('POST', '**/teacher/groups', {
    statusCode: 200,
    body: {
      group_id: 102,
      group_name: '新建组',
      student_ids: ['1', '2'],
      student_count: 2
    }
  }).as('createGroup')

  // 打开创建分组对话框
  cy.get('button').contains('创建分组').click()

  cy.get('input[placeholder="请输入分组名称"]').type('新建组')

  // 选择学生
  cy.get('.ant-select').click()
  cy.get('.ant-select-dropdown').contains('张三').click()
  cy.get('.ant-select-dropdown').contains('李四').click()

  // 提交
  cy.get('.ant-modal').contains('创建').click()
  // cy.get('@createGroup').its('response.statusCode').should('eq', 200)

})


  it('edits an existing group', () => {
    cy.get('.ant-tabs-tab').contains('分组管理').click()

    // mock 更新分组接口
    cy.intercept('PUT', '**/teacher/groups/101', {
      statusCode: 200,
      body: {
        group_id: 101,
        group_name: '修改后的组',
        student_ids: ['2'],
        student_count: 1
      }
    }).as('updateGroup')

    // 打开编辑模态框
    cy.get('button').contains('编辑').click()
    cy.get('input[placeholder="请输入分组名称"]').clear().type('修改后的组')
    cy.get('.ant-select').click()
    cy.get('.ant-select-dropdown').contains('李四').click()
    cy.get('.ant-select-selection-overflow').click() // 关闭下拉菜单
    cy.get('.ant-modal-footer > .ant-btn-primary').click()

    cy.wait('@updateGroup')
    // cy.get('@updataGroup').its('response.statusCode').should('eq', 200)
  })

  it('deletes a group', () => {
    // 切换到分组管理 tab
    cy.get('.ant-tabs-tab').contains('分组管理').click()

    // mock 删除接口
    cy.intercept('DELETE', '**/teacher/groups/101', {
      statusCode: 200,
      body: {}
    }).as('deleteGroup')

    // 点击删除按钮
    cy.get('button').contains('删除').click()

    // 在 Popconfirm 里点击确定
    cy.get('.ant-popconfirm-buttons > .ant-btn-primary').click()
  })

})
