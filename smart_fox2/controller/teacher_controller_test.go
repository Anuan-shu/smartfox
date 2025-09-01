package controller

import (
	"bytes"
	//"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"lh/global"
	"lh/models"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// ---------- 初始化测试环境 ----------
func setupTestDBTeacher(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("init db failed: %v", err)
	}
	// migrate 使用真实 models
	err = db.AutoMigrate(
		&models.User{},
		&models.Experiment{},
		&models.Question{},
		&models.ExperimentSubmission{},
		&models.QuestionSubmission{},
		&models.Notification{},
		&models.Attachment{},
	)
	if err != nil {
		t.Fatalf("migrate failed: %v", err)
	}
	global.DB = db
}

// 创建一个测试用户（自动生成唯一 telephone）
var userCounter = 0

func createTestUser(t *testing.T, role string) models.User {
	userCounter++
	u := models.User{
		Name:      "User" + strconv.Itoa(userCounter),
		Role:      role,
		Telephone: "tel" + strconv.Itoa(userCounter), // 保证唯一
		Email:     "u" + strconv.Itoa(userCounter) + "@example.com",
		Password:  "pwd",
	}
	if err := global.DB.Create(&u).Error; err != nil {
		t.Fatalf("create user failed: %v", err)
	}
	return u
}

//
// ---------- 单元测试 ----------
//

// getExperimentStatus
func TestGetExperimentStatus(t *testing.T) {
	future := time.Now().Add(time.Hour)
	past := time.Now().Add(-time.Hour)

	if got := getExperimentStatus(future); got != "active" {
		t.Errorf("expected active, got %s", got)
	}
	if got := getExperimentStatus(past); got != "expired" {
		t.Errorf("expected expired, got %s", got)
	}
}

// GetExperimentDetail_Teacher
func TestGetExperimentDetail_Teacher(t *testing.T) {
	setupTestDBTeacher(t)

	stu := createTestUser(t, "student")

	exp := models.Experiment{
		ID:          "exp1",
		Title:       "实验一",
		Description: "desc",
		Permission:  1,
		Deadline:    time.Now().Add(24 * time.Hour),
		CreatedAt:   time.Now(),
		Users:       []models.User{stu},
		Questions: []models.Question{
			{ID: "q1", Type: "choice", Content: "2+2=?", Options: `["4","5"]`, CorrectAnswer: "4", Score: 5},
		},
	}
	global.DB.Create(&exp)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = []gin.Param{{Key: "experiment_id", Value: "exp1"}}
	c.Request = httptest.NewRequest("GET", "/experiments/exp1", nil)

	GetExperimentDetail_Teacher(c)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

// GetStudentSubmissions
func TestGetStudentSubmissions_NotStarted(t *testing.T) {
	setupTestDBTeacher(t)
	stu := createTestUser(t, "student")

	exp := models.Experiment{ID: "exp2", Title: "实验二"}
	global.DB.Create(&exp)
	global.DB.Model(&exp).Association("Users").Append(&stu)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = []gin.Param{
		{Key: "experiment_id", Value: "exp2"},
		{Key: "student_id", Value: strconv.Itoa(int(stu.ID))},
	}
	c.Request = httptest.NewRequest("GET", "/experiments/exp2/students/1", nil)

	GetStudentSubmissions(c)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

// UpdateExperiment
func TestUpdateExperiment_BadRequest(t *testing.T) {
	setupTestDBTeacher(t)
	// 不存在的实验
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = []gin.Param{{Key: "experiment_id", Value: "exp404"}}
	c.Request = httptest.NewRequest("PUT", "/experiments/exp404", bytes.NewBuffer([]byte("{}")))

	UpdateExperiment(c)
	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

// DeleteExperiment
func TestDeleteExperiment_Forbidden(t *testing.T) {
	setupTestDBTeacher(t)
	stu := createTestUser(t, "student")

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("user", stu) // 传 models.User
	c.Params = []gin.Param{{Key: "experiment_id", Value: "exp1"}}
	c.Request = httptest.NewRequest("DELETE", "/experiments/exp1", nil)

	DeleteExperiment(c)
	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", w.Code)
	}
}

// CreateNotification
func TestCreateNotification(t *testing.T) {
	setupTestDBTeacher(t)
	stu := createTestUser(t, "student")

	body := `{"title":"公告","content":"内容","users":[` + strconv.Itoa(int(stu.ID)) + `]}`
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/notifications", bytes.NewBufferString(body))
	c.Request.Header.Set("Content-Type", "application/json")

	CreateNotification(c)
	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d", w.Code)
	}
}

// GetTeacherNotifications
func TestGetTeacherNotifications(t *testing.T) {
	setupTestDBTeacher(t)
	n := models.Notification{ID: "n1", Title: "通知", Content: "内容", CreatedAt: time.Now()}
	global.DB.Create(&n)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/notifications?page=1&limit=10", nil)

	GetTeacherNotifications(c)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}
