package controller

import (
	"bytes"
	"encoding/json"
	"lh/global"
	"lh/models"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestDB_user() {
	// 使用内存SQLite数据库进行测试
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		panic("failed to connect test database")
	}

	// 迁移模型
	db.AutoMigrate(&models.User{})
	global.DB = db
}

func TestRegister(t *testing.T) {
	setupTestDB_user()

	// 测试用例1: 正常注册
	t.Run("正常注册", func(t *testing.T) {
		router := gin.Default()
		router.POST("/register", Register)

		user := models.User{
			Name:      "testuser",
			Telephone: "13800138000",
			Password:  "password123",
			Role:      "student",
		}

		body, _ := json.Marshal(user)
		req, _ := http.NewRequest("POST", "/register", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		assert.Contains(t, w.Body.String(), "注册成功")
	})

	// 测试用例2: 手机号已存在
	t.Run("手机号已存在", func(t *testing.T) {
		router := gin.Default()
		router.POST("/register", Register)

		// 先创建一个用户
		global.DB.Create(&models.User{
			Name:      "existinguser",
			Telephone: "13800138001",
			Password:  "password123",
			Role:      "student",
		})

		user := models.User{
			Name:      "newuser",
			Telephone: "13800138001", // 相同的手机号
			Password:  "password123",
			Role:      "student",
		}

		body, _ := json.Marshal(user)
		req, _ := http.NewRequest("POST", "/register", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
		assert.Contains(t, w.Body.String(), "手机号已注册")
	})

	// 测试用例3: 用户名已存在
	t.Run("用户名已存在", func(t *testing.T) {
		router := gin.Default()
		router.POST("/register", Register)

		// 先创建一个用户
		global.DB.Create(&models.User{
			Name:      "existinguser",
			Telephone: "13800138002",
			Password:  "password123",
			Role:      "student",
		})

		user := models.User{
			Name:      "existinguser", // 相同的用户名
			Telephone: "13800138003",
			Password:  "password123",
			Role:      "student",
		}

		body, _ := json.Marshal(user)
		req, _ := http.NewRequest("POST", "/register", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
		assert.Contains(t, w.Body.String(), "用户名已注册")
	})

	// 测试用例4: 密码太短
	t.Run("密码太短", func(t *testing.T) {
		router := gin.Default()
		router.POST("/register", Register)

		user := models.User{
			Name:      "testuser2",
			Telephone: "13800138004",
			Password:  "123", // 密码太短
			Role:      "student",
		}

		body, _ := json.Marshal(user)
		req, _ := http.NewRequest("POST", "/register", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
		assert.Contains(t, w.Body.String(), "密码不能少于6位")
	})

	// 测试用例5: 角色不合法
	t.Run("角色不合法", func(t *testing.T) {
		router := gin.Default()
		router.POST("/register", Register)

		user := models.User{
			Name:      "testuser3",
			Telephone: "13800138005",
			Password:  "password123",
			Role:      "admin", // 不合法的角色
		}

		body, _ := json.Marshal(user)
		req, _ := http.NewRequest("POST", "/register", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
		assert.Contains(t, w.Body.String(), "用户类型不合法")
	})
}

func TestLogin(t *testing.T) {
	setupTestDB_user()

	// 先创建一个测试用户
	hashedPassword, _ := HashPassword("password123")
	global.DB.Create(&models.User{
		Name:      "testuser",
		Telephone: "13800138000",
		Password:  hashedPassword,
		Role:      "student",
	})

	// 测试用例1: 使用手机号正常登录
	t.Run("使用手机号正常登录", func(t *testing.T) {
		router := gin.Default()
		router.POST("/login", Login)

		user := models.User{
			Telephone: "13800138000",
			Password:  "password123",
		}

		body, _ := json.Marshal(user)
		req, _ := http.NewRequest("POST", "/login", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		assert.Contains(t, w.Body.String(), "登录成功")
		assert.Contains(t, w.Body.String(), "token")
	})

	// 测试用例2: 使用用户名正常登录
	t.Run("使用用户名正常登录", func(t *testing.T) {
		router := gin.Default()
		router.POST("/login", Login)

		user := models.User{
			Name:     "testuser",
			Password: "password123",
		}

		body, _ := json.Marshal(user)
		req, _ := http.NewRequest("POST", "/login", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		assert.Contains(t, w.Body.String(), "登录成功")
		assert.Contains(t, w.Body.String(), "token")
	})

	// 测试用例3: 密码错误
	t.Run("密码错误", func(t *testing.T) {
		router := gin.Default()
		router.POST("/login", Login)

		user := models.User{
			Telephone: "13800138000",
			Password:  "wrongpassword",
		}

		body, _ := json.Marshal(user)
		req, _ := http.NewRequest("POST", "/login", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
		assert.Contains(t, w.Body.String(), "密码错误")
	})

	// 测试用例4: 用户不存在
	t.Run("用户不存在", func(t *testing.T) {
		router := gin.Default()
		router.POST("/login", Login)

		user := models.User{
			Telephone: "13800138001", // 不存在的手机号
			Password:  "password123",
		}

		body, _ := json.Marshal(user)
		req, _ := http.NewRequest("POST", "/login", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
		assert.Contains(t, w.Body.String(), "用户不存在")
	})

	// 测试用例5: 手机号和用户名为空
	t.Run("手机号和用户名为空", func(t *testing.T) {
		router := gin.Default()
		router.POST("/login", Login)

		user := models.User{
			Password: "password123",
		}

		body, _ := json.Marshal(user)
		req, _ := http.NewRequest("POST", "/login", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
		assert.Contains(t, w.Body.String(), "手机号和用户名不能同时为空")
	})
}

func TestInfo(t *testing.T) {
	setupTestDB_user()

	// 创建一个测试用户
	testUser := models.User{
		Name:      "testuser",
		Telephone: "13800138000",
		Password:  "hashedpassword",
		Role:      "student",
		Email:     "test@example.com",
	}
	global.DB.Create(&testUser)

	// 测试用例1: 正常获取用户信息
	t.Run("正常获取用户信息", func(t *testing.T) {
		router := gin.Default()
		router.GET("/info", Info)

		req, _ := http.NewRequest("GET", "/info", nil)
		w := httptest.NewRecorder()

		// 创建一个带有用户信息的上下文
		c, _ := gin.CreateTestContext(w)
		c.Set("user", testUser)
		c.Request = req

		Info(c)

		assert.Equal(t, http.StatusOK, w.Code)
		assert.Contains(t, w.Body.String(), "testuser")
		assert.Contains(t, w.Body.String(), "13800138000")
		assert.Contains(t, w.Body.String(), "student")
		assert.Contains(t, w.Body.String(), "test@example.com")
	})
}

func TestUpdate(t *testing.T) {
	setupTestDB_user()

	// 创建一个测试用户
	hashedPassword, _ := HashPassword("oldpassword")
	testUser := models.User{
		Name:      "olduser",
		Telephone: "13800138000",
		Password:  hashedPassword,
		Role:      "student",
		Email:     "old@example.com",
	}
	global.DB.Create(&testUser)

	// 测试用例1: 正常更新用户信息
	t.Run("正常更新用户信息", func(t *testing.T) {
		router := gin.Default()
		router.PUT("/update", Update)

		updateData := UserUpdate{
			Name:        "newuser",
			Telephone:   "13800138001",
			OldPassword: "oldpassword",
			Password:    "newpassword",
			Email:       "new@example.com",
			AvatarUrl:   "https://example.com/avatar.jpg",
		}

		body, _ := json.Marshal(updateData)
		req, _ := http.NewRequest("PUT", "/update", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()

		// 创建一个带有用户信息的上下文
		c, _ := gin.CreateTestContext(w)
		c.Set("user", testUser)
		c.Request = req

		Update(c)

		assert.Equal(t, http.StatusOK, w.Code)
		assert.Contains(t, w.Body.String(), "修改成功")
	})

	// 测试用例2: 旧密码错误
	t.Run("旧密码错误", func(t *testing.T) {
		router := gin.Default()
		router.PUT("/update", Update)

		updateData := UserUpdate{
			Name:        "newlyuser",
			Telephone:   "13800138002",
			OldPassword: "wrongoldpassword", // 错误的旧密码
			Password:    "newpassword",
		}

		body, _ := json.Marshal(updateData)
		req, _ := http.NewRequest("PUT", "/update", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()

		// 创建一个带有用户信息的上下文
		c, _ := gin.CreateTestContext(w)
		c.Set("user", testUser)
		c.Request = req

		Update(c)

		assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
		assert.Contains(t, w.Body.String(), "旧密码错误")
	})

	// 测试用例3: 新密码太短
	t.Run("新密码太短", func(t *testing.T) {
		router := gin.Default()
		router.PUT("/update", Update)

		updateData := UserUpdate{
			OldPassword: "oldpassword",
			Password:    "short", // 太短的密码
		}

		body, _ := json.Marshal(updateData)
		req, _ := http.NewRequest("PUT", "/update", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()

		// 创建一个带有用户信息的上下文
		c, _ := gin.CreateTestContext(w)
		c.Set("user", testUser)
		c.Request = req

		Update(c)

		assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
		assert.Contains(t, w.Body.String(), "密码不能少于6位")
	})

	// 测试用例4: 手机号已存在
	t.Run("手机号已存在", func(t *testing.T) {
		// 先创建另一个用户
		global.DB.Create(&models.User{
			Name:      "otheruser",
			Telephone: "13800138003",
			Password:  "password123",
			Role:      "student",
		})

		router := gin.Default()
		router.PUT("/update", Update)

		updateData := UserUpdate{
			Telephone: "13800138003", // 已存在的手机号
		}

		body, _ := json.Marshal(updateData)
		req, _ := http.NewRequest("PUT", "/update", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()

		// 创建一个带有用户信息的上下文
		c, _ := gin.CreateTestContext(w)
		c.Set("user", testUser)
		c.Request = req

		Update(c)

		assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
		assert.Contains(t, w.Body.String(), "手机号已注册")
	})
}

// 辅助函数：密码哈希
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}
