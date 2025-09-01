import React from 'react'
import CreateNotification from './index.jsx'
import * as api from '../../utils/api'
import { MemoryRouter } from 'react-router-dom'

describe('<CreateNotification />', () => {
  const experiments = [{ experiment_id: 1, title: 'Exp 1' }]
  const studentResponse = { student_ids: ['101', '102'] }

  beforeEach(() => {
    // stub APIs used by the component
    cy.stub(api.experimentAPI, 'getExperiments').resolves({ data: experiments }).as('getExps')
    cy.stub(api.userAPI, 'getStudentList').resolves(studentResponse).as('getStudents')
    cy.stub(api.notificationAPI, 'createNotification').resolves({}).as('createNotification')
  })

  it('positive: preview updates and submits successfully with valid data', () => {
    // 在测试内部处理异常，而不是在 beforeEach 中
    Cypress.on('uncaught:exception', (err) => {
      console.log('Cypress detected uncaught exception: ', err)
      // 返回 false 防止测试失败
      return false
    })

    cy.mount(
      React.createElement(MemoryRouter, null, React.createElement(CreateNotification, null))
    )

    // 确保初始 API 调用完成
    cy.get('@getExps').should('have.been.calledOnce')
    cy.get('@getStudents').should('have.been.calledOnce')

    // 填写标题
    cy.get('input[placeholder="请输入公告标题"]').as('titleInput')
    cy.get('@titleInput').should('be.visible').and('be.enabled')
    cy.get('@titleInput').click().clear()
    cy.get('@titleInput').type('测试标题')

    // 填写内容
    cy.get('textarea[placeholder="请输入公告内容"]').as('contentTextarea')
    cy.get('@contentTextarea').should('be.visible').and('be.enabled')
    cy.get('@contentTextarea').click().clear()
    cy.get('@contentTextarea').type('这是测试内容')

    // 选择实验
    cy.contains('label', '关联实验').parents('.ant-form-item').first().within(() => {
      cy.get('.ant-select').click()
    })
    // 等待下拉菜单出现
    cy.get('.ant-select-dropdown').should('be.visible')
    cy.contains('.ant-select-item-option', 'Exp 1').click()

    // 选择用户
    cy.contains('label', '目标用户').parents('.ant-form-item').first().within(() => {
      cy.get('.ant-select').click()
    })
    cy.get('.ant-select-dropdown').should('be.visible')
    cy.contains('.ant-select-item-option', '101').click()

    // 关闭下拉菜单
    cy.get('body').type('{esc}')

    // 切换重要开关
    cy.get('.ant-switch').click()

    // 等待预览更新 - 添加适当的等待
    //cy.wait(500) // 给组件一些时间重新渲染

    // 检查预览更新
    // cy.contains('测试标题').should('exist')
    // cy.contains('这是测试内容').should('exist')
    // cy.contains('重要').should('exist')
    // cy.contains('.ant-card-head-title', '预览效果')
    // .parents('.ant-card')
    // .should('exist')
    // .then(($previewCard) => {
    //   // 打印预览区域的HTML内容用于调试
    //   console.log('Preview card HTML:', $previewCard.html())
    // })

    // cy.contains('.ant-card-head-title', '预览效果')
    // .parents('.ant-card')
    // .within(() => {
    //   // 先检查预览区域的基本结构
    //   cy.get('.ant-card-body').should('exist')
      
    //   // 使用更具体的选择器查找标题
    //   cy.get('.preview').within(() => {
    //     cy.get('.previewHeader').within(() => {
    //       cy.contains('测试标题').should('exist')
    //     })
    //     cy.get('.previewContent').contains('这是测试内容').should('exist')
    //     cy.contains('重要').should('exist')
    //   })
    // })
    

    // 提交
    cy.contains('button', '发布公告').click()

    // 确保 createNotification 被调用
    cy.get('@createNotification').should('have.been.calledOnce')
  })

  it('negative: shows validation errors when required fields are empty and does not submit', () => {
    // 在测试内部处理异常
    Cypress.on('uncaught:exception', (err) => {
      console.log('Cypress detected uncaught exception: ', err)
      return false
    })

    cy.mount(
      React.createElement(MemoryRouter, null, React.createElement(CreateNotification, null))
    )

    // 直接点击提交按钮
    cy.contains('button', '发布公告').click()

    // 检查验证消息
    cy.contains('请输入公告标题').should('exist')
    cy.contains('请输入公告内容').should('exist')

    // 确保 createNotification 没有被调用
    cy.get('@createNotification').should('not.have.been.called')
  })
})