package middleware

import (
	"lh/common"
	"lh/global"
	"lh/models"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// 设置测试数据库
func setupTestDB() {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		panic("failed to connect test database")
	}

	// 迁移模型
	db.AutoMigrate(&models.User{})
	global.DB = db
}

// 创建测试用户
func createTestUser(role string) models.User {
	user := models.User{
		Name:      "testuser",
		Telephone: "13800138000",
		Password:  "hashedpassword",
		Role:      role,
	}
	global.DB.Create(&user)
	return user
}

// 生成测试token
func generateTestToken(user models.User) string {
	token, err := common.ReleaseToken(user)
	if err != nil {
		panic("failed to generate test token")
	}
	return token
}

func TestAuthMiddleware(t *testing.T) {
	setupTestDB()

	// 创建测试用户
	testUser := createTestUser("student")
	testToken := generateTestToken(testUser)

	// 测试用例1: 没有Authorization头
	t.Run("没有Authorization头", func(t *testing.T) {
		router := gin.Default()
		router.Use(AuthMiddleware())
		router.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})

		req, _ := http.NewRequest("GET", "/test", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)
		assert.Contains(t, w.Body.String(), "权限不足")
	})

	// 测试用例2: Authorization头格式错误
	t.Run("Authorization头格式错误", func(t *testing.T) {
		router := gin.Default()
		router.Use(AuthMiddleware())
		router.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})

		req, _ := http.NewRequest("GET", "/test", nil)
		req.Header.Set("Authorization", "InvalidToken")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)
		assert.Contains(t, w.Body.String(), "权限不足")
	})

	// 测试用例3: 无效的token
	t.Run("无效的token", func(t *testing.T) {
		router := gin.Default()
		router.Use(AuthMiddleware())
		router.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})

		req, _ := http.NewRequest("GET", "/test", nil)
		req.Header.Set("Authorization", "Bearer invalidtoken")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)
		assert.Contains(t, w.Body.String(), "权限不足")
	})

	// 测试用例4: 用户不存在
	t.Run("用户不存在", func(t *testing.T) {
		// 创建一个不存在的用户token
		nonExistentUser := models.User{
			Model:     gorm.Model{ID: 999},
			Name:      "nonexistent",
			Telephone: "13800138999",
			Password:  "hashedpassword",
			Role:      "student",
		}
		nonExistentToken := generateTestToken(nonExistentUser)

		router := gin.Default()
		router.Use(AuthMiddleware())
		router.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})

		req, _ := http.NewRequest("GET", "/test", nil)
		req.Header.Set("Authorization", "Bearer "+nonExistentToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)
		assert.Contains(t, w.Body.String(), "用户不存在")
	})

	// 测试用例5: 有效的token和用户
	t.Run("有效的token和用户", func(t *testing.T) {
		router := gin.Default()
		router.Use(AuthMiddleware())
		router.GET("/test", func(c *gin.Context) {
			user, exists := c.Get("user")
			assert.True(t, exists)
			assert.IsType(t, models.User{}, user)
			c.JSON(http.StatusOK, gin.H{"message": "success", "user_id": user.(models.User).ID})
		})

		req, _ := http.NewRequest("GET", "/test", nil)
		req.Header.Set("Authorization", "Bearer "+testToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		assert.Contains(t, w.Body.String(), "success")
		assert.Contains(t, w.Body.String(), strconv.FormatUint(uint64(testUser.ID), 10))
	})
}

func TestStudentOnly(t *testing.T) {
	setupTestDB()

	// 测试用例1: 上下文中没有用户信息
	t.Run("上下文中没有用户信息", func(t *testing.T) {
		router := gin.Default()
		router.Use(StudentOnly())
		router.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})

		req, _ := http.NewRequest("GET", "/test", nil)
		w := httptest.NewRecorder()

		// 创建一个没有用户信息的上下文
		c, _ := gin.CreateTestContext(w)
		c.Request = req

		StudentOnly()(c)

		if w.Code != 0 { // 如果中间件调用了Abort，状态码会被设置
			assert.Equal(t, http.StatusUnauthorized, w.Code)
			assert.Contains(t, w.Body.String(), "未授权访问")
		}
	})

	// 测试用例2: 非学生用户访问
	t.Run("非学生用户访问", func(t *testing.T) {
		router := gin.Default()
		router.Use(StudentOnly())
		router.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})

		req, _ := http.NewRequest("GET", "/test", nil)
		w := httptest.NewRecorder()

		// 创建一个有教师用户信息的上下文
		c, _ := gin.CreateTestContext(w)
		c.Request = req
		teacherUser := createTestUser("teacher")
		c.Set("user", teacherUser)

		StudentOnly()(c)

		if w.Code != 0 { // 如果中间件调用了Abort，状态码会被设置
			assert.Equal(t, http.StatusForbidden, w.Code)
			assert.Contains(t, w.Body.String(), "仅学生可访问")
		}
	})

	// 测试用例3: 学生用户访问
	t.Run("学生用户访问", func(t *testing.T) {
		router := gin.Default()
		// 添加一个设置用户的中间件，确保上下文中有用户信息
		router.Use(func(c *gin.Context) {
			studentUser := createTestUser("student")
			c.Set("user", studentUser)
		})
		router.Use(StudentOnly())
		router.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})

		req, _ := http.NewRequest("GET", "/test", nil)
		w := httptest.NewRecorder()

		// 直接通过路由器处理请求
		router.ServeHTTP(w, req)

		// 学生用户应成功访问，返回 HTTP 200
		assert.Equal(t, http.StatusOK, w.Code)
		assert.Contains(t, w.Body.String(), "success")
	})
}

func TestTeacherOnly(t *testing.T) {
	setupTestDB()

	// 测试用例1: 上下文中没有用户信息
	t.Run("上下文中没有用户信息", func(t *testing.T) {
		router := gin.Default()
		router.Use(TeacherOnly())
		router.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})

		req, _ := http.NewRequest("GET", "/test", nil)
		w := httptest.NewRecorder()

		// 创建一个没有用户信息的上下文
		c, _ := gin.CreateTestContext(w)
		c.Request = req

		TeacherOnly()(c)

		if w.Code != 0 { // 如果中间件调用了Abort，状态码会被设置
			assert.Equal(t, http.StatusUnauthorized, w.Code)
			assert.Contains(t, w.Body.String(), "未授权访问")
		}
	})

	// 测试用例2: 非教师用户访问
	t.Run("非教师用户访问", func(t *testing.T) {
		router := gin.Default()
		router.Use(TeacherOnly())
		router.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})

		req, _ := http.NewRequest("GET", "/test", nil)
		w := httptest.NewRecorder()

		// 创建一个有学生用户信息的上下文
		c, _ := gin.CreateTestContext(w)
		c.Request = req
		studentUser := createTestUser("student")
		c.Set("user", studentUser)

		TeacherOnly()(c)

		if w.Code != 0 { // 如果中间件调用了Abort，状态码会被设置
			assert.Equal(t, http.StatusForbidden, w.Code)
			assert.Contains(t, w.Body.String(), "仅教师可访问")
		}
	})

	// 测试用例3: 教师用户访问
	t.Run("教师用户访问", func(t *testing.T) {
		router := gin.Default()
		router.Use(func(c *gin.Context) {
			teacherUser := createTestUser("teacher")
			c.Set("user", teacherUser)
		})
		router.Use(TeacherOnly())
		router.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})

		req, _ := http.NewRequest("GET", "/test", nil)
		w := httptest.NewRecorder()

		// 直接通过路由器处理请求
		router.ServeHTTP(w, req)

		// 教师用户应成功访问，返回 HTTP 200
		assert.Equal(t, http.StatusOK, w.Code)
		assert.Contains(t, w.Body.String(), "success")
	})
}
