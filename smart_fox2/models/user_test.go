// user_test.go
package models

import (
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// 创建模拟数据库连接
func setupMockDB(t *testing.T) (*gorm.DB, sqlmock.Sqlmock) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("An error '%s' was not expected when opening a stub database connection", err)
	}

	gormDB, err := gorm.Open(mysql.New(mysql.Config{
		Conn:                      db,
		SkipInitializeWithVersion: true,
	}), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open gorm database: %v", err)
	}

	return gormDB, mock
}

func TestUserModel(t *testing.T) {
	db, mock := setupMockDB(t)

	t.Run("正向测试: 创建有效用户", func(t *testing.T) {
		// 模拟数据库期望
		mock.ExpectBegin()
		mock.ExpectExec("INSERT INTO `users`").WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()

		user := User{
			Name:      "测试用户",
			Telephone: "13800138000",
			Password:  "hashed_password",
			Role:      "student",
		}

		result := db.Create(&user)
		if result.Error != nil {
			t.Errorf("创建用户失败: %v", result.Error)
		}

		if user.ID == 0 {
			t.Error("用户ID应该被自动生成")
		}
	})

	t.Run("反向测试: 创建用户缺少必需字段", func(t *testing.T) {
		user := User{
			Telephone: "13800138000",
			// 缺少Name和Password字段
		}

		result := db.Create(&user)
		if result.Error == nil {
			t.Error("缺少必需字段时应该报错")
		}
	})
}

func TestGroupModel(t *testing.T) {
	db, mock := setupMockDB(t)

	t.Run("正向测试: 创建有效小组", func(t *testing.T) {
		// 模拟数据库期望
		mock.ExpectBegin()
		mock.ExpectExec("INSERT INTO `groups`").WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()

		group := Group{
			Name: "测试小组",
		}

		result := db.Create(&group)
		if result.Error != nil {
			t.Errorf("创建小组失败: %v", result.Error)
		}

		if group.ID == 0 {
			t.Error("小组ID应该被自动生成")
		}
	})

	t.Run("反向测试: 创建小组缺少名称", func(t *testing.T) {
		group := Group{
			// 缺少Name字段
		}

		result := db.Create(&group)
		if result.Error == nil {
			t.Error("缺少小组名称时应该报错")
		}
	})
}
