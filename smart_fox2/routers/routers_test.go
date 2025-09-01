package routers

import (
	"lh/config"
	"lh/global"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"gopkg.in/yaml.v2"
)

// 设置测试配置
func setupTestConfig() {
	configContent := `
system:
  env: "test"
  host: "localhost"
  port: 8080
mysql:
  host: "localhost"
  port: 3306
  db: "testdb"
  user: "testuser"
  password: "testpass"
  config: "charset=utf8mb4"
  log_level: "debug"
logger:
  level: "info"
  prefix: "TEST"
  director: "./logs"
  show_Line: true
  log_In_Console: true
`

	var config config.Config
	err := yaml.Unmarshal([]byte(configContent), &config)
	if err != nil {
		panic("failed to parse test config")
	}

	global.Config = &config
}

func TestInitRouter(t *testing.T) {
	setupTestConfig()

	t.Run("初始化路由不应panic", func(t *testing.T) {
		assert.NotPanics(t, func() {
			router := InitRouter()
			assert.NotNil(t, router)
		})
	})

	t.Run("路由应配置CORS", func(t *testing.T) {
		router := InitRouter()

		// 添加一个测试路由
		router.GET("/test-cors", func(c *gin.Context) {
			c.JSON(200, gin.H{"message": "test"})
		})

		// 测试CORS预检请求
		req, _ := http.NewRequest("OPTIONS", "/test-cors", nil)
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("Access-Control-Request-Method", "GET")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// 应返回204而不是404或500
		assert.Contains(t, []int{http.StatusOK, http.StatusNoContent}, w.Code)
	})
}

func TestCollectRoutes(t *testing.T) {
	setupTestConfig()

	t.Run("应收集所有路由", func(t *testing.T) {
		router := gin.New()
		result := CollectRoutes(router)

		assert.Equal(t, router, result, "应返回相同的路由器实例")
	})

	t.Run("应注册认证路由", func(t *testing.T) {
		router := gin.New()
		CollectRoutes(router)

		// 测试认证路由是否存在
		testRoutes := []struct {
			method string
			path   string
		}{
			{"POST", "/api/auth/register"},
			{"POST", "/api/auth/login"},
			{"GET", "/api/auth/profile"},
			{"PUT", "/api/auth/update"},
		}

		for _, route := range testRoutes {
			req, _ := http.NewRequest(route.method, route.path, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// 路由应存在（不返回404）
			// 注意：由于需要认证，可能返回401而不是200
			assert.NotEqual(t, http.StatusNotFound, w.Code,
				"路由 %s %s 应已注册", route.method, route.path)
		}
	})

	t.Run("应注册学生列表路由", func(t *testing.T) {
		router := gin.New()
		CollectRoutes(router)

		req, _ := http.NewRequest("GET", "/api/student_list", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.NotEqual(t, http.StatusNotFound, w.Code,
			"路由 GET /api/student_list 应已注册")
	})
}

func TestExperimentRoutes_Teacher(t *testing.T) {
	setupTestConfig()

	t.Run("教师路由组应包含所有教师路由", func(t *testing.T) {
		router := gin.New()
		teacherGroup := router.Group("/api/teacher")
		ExperimentRoutes_Teacher(teacherGroup)

		// 测试教师路由是否存在
		teacherRoutes := []struct {
			method string
			path   string
		}{
			{"GET", "/api/teacher/students"},
			{"POST", "/api/teacher/groups"},
			{"GET", "/api/teacher/groups"},
			{"PUT", "/api/teacher/groups/:group_id"},
			{"DELETE", "/api/teacher/groups/:group_id"},
			{"POST", "/api/teacher/experiments"},
			{"GET", "/api/teacher/experiments"},
			{"GET", "/api/teacher/experiments/:experiment_id"},
			{"PUT", "/api/teacher/experiments/:experiment_id"},
			{"DELETE", "/api/teacher/experiments/:experiment_id"},
			{"GET", "/api/teacher/experiments/:experiment_id/:student_id/submissions"},
			{"POST", "/api/teacher/experiments/:experiment_id/uploadFile"},
			{"POST", "/api/teacher/experiments/notifications"},
			{"GET", "/api/teacher/experiments/notifications"},
			{"DELETE", "/api/teacher/experiments/:experiment_id/files/:filename"},
		}

		for _, route := range teacherRoutes {
			req, _ := http.NewRequest(route.method, route.path, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// 路由应存在（不返回404）
			assert.NotEqual(t, http.StatusNotFound, w.Code,
				"路由 %s %s 应已注册", route.method, route.path)
		}
	})
}

func TestExperimentRoutes_Student(t *testing.T) {
	setupTestConfig()

	t.Run("学生路由组应包含所有学生路由", func(t *testing.T) {
		router := gin.New()
		studentGroup := router.Group("/api/student")
		ExperimentRoutes_Student(studentGroup)

		// 测试学生路由是否存在
		studentRoutes := []struct {
			method string
			path   string
		}{
			{"GET", "/api/student/experiments"},
			{"GET", "/api/student/experiments/:experiment_id"},
			{"POST", "/api/student/experiments/:experiment_id/save"},
			{"POST", "/api/student/experiments/:experiment_id/submit"},
			{"GET", "/api/student/submissions"},
			{"GET", "/api/student/experiments/notifications/:student_id"},
		}

		for _, route := range studentRoutes {
			req, _ := http.NewRequest(route.method, route.path, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// 路由应存在（不返回404）
			assert.NotEqual(t, http.StatusNotFound, w.Code,
				"路由 %s %s 应已注册", route.method, route.path)
		}
	})
}

func TestFileRoutes(t *testing.T) {
	setupTestConfig()

	t.Run("文件路由应已注册", func(t *testing.T) {
		router := gin.New()
		CollectRoutes(router)

		// 测试文件路由是否存在
		fileRoutes := []struct {
			method string
			path   string
		}{
			{"GET", "/api/experiments/:experiment_id/files"},
			{"GET", "/api/experiments/:experiment_id/files/:filename/download"},
		}

		for _, route := range fileRoutes {
			req, _ := http.NewRequest(route.method, route.path, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// 路由应存在（不返回404）
			assert.NotEqual(t, http.StatusNotFound, w.Code,
				"路由 %s %s 应已注册", route.method, route.path)
		}
	})
}
