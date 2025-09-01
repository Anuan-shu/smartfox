// experiment_test.go
package models

import (
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestExperimentModel(t *testing.T) {
	db, mock := setupMockDB(t)

	t.Run("正向测试: 创建有效实验", func(t *testing.T) {
		// 模拟数据库期望
		mock.ExpectBegin()
		mock.ExpectExec("INSERT INTO `experiments`").WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()

		experiment := Experiment{
			ID:          "exp-123456",
			Title:       "测试实验",
			Description: "这是一个测试实验",
			Permission:  1,
			Deadline:    time.Now().Add(7 * 24 * time.Hour),
			CreatedAt:   time.Now(),
		}

		result := db.Create(&experiment)
		if result.Error != nil {
			t.Errorf("创建实验失败: %v", result.Error)
		}
	})

	t.Run("反向测试: 创建实验缺少必需字段", func(t *testing.T) {
		experiment := Experiment{
			ID: "exp-123456",
			// 缺少Title和Description字段
		}

		result := db.Create(&experiment)
		if result.Error == nil {
			t.Error("缺少必需字段时应该报错")
		}
	})
}

func TestQuestionModel(t *testing.T) {
	db, mock := setupMockDB(t)

	t.Run("正向测试: 创建有效题目", func(t *testing.T) {
		// 模拟数据库期望
		mock.ExpectBegin()
		mock.ExpectExec("INSERT INTO `questions`").WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()

		question := Question{
			ID:           "q-123456",
			ExperimentID: "exp-123456",
			Type:         "choice",
			Content:      "测试问题内容",
			Score:        10,
			CreatedAt:    time.Now(),
		}

		result := db.Create(&question)
		if result.Error != nil {
			t.Errorf("创建题目失败: %v", result.Error)
		}
	})

	t.Run("反向测试: 创建题目缺少必需字段", func(t *testing.T) {
		question := Question{
			ID: "q-123456",
			// 缺少ExperimentID, Type和Content字段
		}

		result := db.Create(&question)
		if result.Error == nil {
			t.Error("缺少必需字段时应该报错")
		}
	})
}

func TestAttachmentModel(t *testing.T) {
	db, mock := setupMockDB(t)

	t.Run("正向测试: 创建有效附件", func(t *testing.T) {
		// 模拟数据库期望
		mock.ExpectBegin()
		mock.ExpectExec("INSERT INTO `attachments`").WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()

		attachment := Attachment{
			ExperimentID: "exp-123456",
			Name:         "测试附件",
			URL:          "http://example.com/file.pdf",
			CreatedAt:    time.Now(),
		}

		result := db.Create(&attachment)
		if result.Error != nil {
			t.Errorf("创建附件失败: %v", result.Error)
		}
	})

	t.Run("反向测试: 创建附件缺少必需字段", func(t *testing.T) {
		attachment := Attachment{
			// 缺少ExperimentID, Name和URL字段
		}

		result := db.Create(&attachment)
		if result.Error == nil {
			t.Error("缺少必需字段时应该报错")
		}
	})
}
