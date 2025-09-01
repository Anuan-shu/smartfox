// submissions_test.go
package models

import (
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestExperimentSubmissionModel(t *testing.T) {
	db, mock := setupMockDB(t)

	t.Run("正向测试: 创建有效实验提交", func(t *testing.T) {
		// 模拟数据库期望
		mock.ExpectBegin()
		mock.ExpectExec("INSERT INTO `experiment_submissions`").WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()

		submission := ExperimentSubmission{
			ID:           "sub-123456",
			ExperimentID: "exp-123456",
			StudentID:    1,
			SubmittedAt:  time.Now(),
			TotalScore:   85,
			Status:       "submitted",
			CreatedAt:    time.Now(),
		}

		result := db.Create(&submission)
		if result.Error != nil {
			t.Errorf("创建实验提交失败: %v", result.Error)
		}
	})

	t.Run("反向测试: 创建实验提交缺少必需字段", func(t *testing.T) {
		submission := ExperimentSubmission{
			ID: "sub-123456",
			// 缺少ExperimentID和StudentID字段
		}

		result := db.Create(&submission)
		if result.Error == nil {
			t.Error("缺少必需字段时应该报错")
		}
	})
}

func TestQuestionSubmissionModel(t *testing.T) {
	db, mock := setupMockDB(t)

	t.Run("正向测试: 创建有效题目提交", func(t *testing.T) {
		// 模拟数据库期望
		mock.ExpectBegin()
		mock.ExpectExec("INSERT INTO `question_submissions`").WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()

		questionSubmission := QuestionSubmission{
			ID:           "qsub-123456",
			SubmissionID: "sub-123456",
			QuestionID:   "q-123456",
			Type:         "choice",
			PerfectScore: 10,
			Answer:       "A",
			Score:        8,
			CreatedAt:    time.Now(),
		}

		result := db.Create(&questionSubmission)
		if result.Error != nil {
			t.Errorf("创建题目提交失败: %v", result.Error)
		}
	})

	t.Run("反向测试: 创建题目提交缺少必需字段", func(t *testing.T) {
		questionSubmission := QuestionSubmission{
			ID: "qsub-123456",
			// 缺少SubmissionID和QuestionID字段
		}

		result := db.Create(&questionSubmission)
		if result.Error == nil {
			t.Error("缺少必需字段时应该报错")
		}
	})
}
