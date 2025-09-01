// notification_test.go
package models

import (
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestNotificationModel(t *testing.T) {
	db, mock := setupMockDB(t)

	t.Run("正向测试: 创建有效通知", func(t *testing.T) {
		// 模拟数据库期望
		mock.ExpectBegin()
		mock.ExpectExec("INSERT INTO `notifications`").WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()

		notification := Notification{
			ID:          "notif-123456",
			Title:       "测试通知",
			Content:     "这是一个测试通知",
			CreatedAt:   time.Now(),
			IsImportant: false,
		}

		result := db.Create(&notification)
		if result.Error != nil {
			t.Errorf("创建通知失败: %v", result.Error)
		}
	})

	t.Run("反向测试: 创建通知缺少必需字段", func(t *testing.T) {
		notification := Notification{
			ID: "notif-123456",
			// 缺少Title和Content字段
		}

		result := db.Create(&notification)
		if result.Error == nil {
			t.Error("缺少必需字段时应该报错")
		}
	})
}
