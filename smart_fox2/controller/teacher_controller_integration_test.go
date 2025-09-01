package controller_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"lh/controller"
	"lh/global"
	"lh/models"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// ---------- 初始化测试环境 ----------
func setupTestDB() *gorm.DB {
	db, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	db.AutoMigrate(
		&models.User{},
		&models.Experiment{},
		&models.Question{},
		&models.ExperimentSubmission{},
		&models.QuestionSubmission{},
		&models.Notification{},
		&models.Attachment{},
	)
	global.DB = db
	return db
}

// 创建测试用户
var userCounter = 0

func createTestUser(role string) models.User {
	userCounter++
	u := models.User{
		Name:      "User" + strconv.Itoa(userCounter),
		Role:      role,
		Telephone: "tel" + strconv.Itoa(userCounter),
		Email:     "u" + strconv.Itoa(userCounter) + "@example.com",
		Password:  "pwd",
	}
	global.DB.Create(&u)
	return u
}

// ---------- 集成测试（绕开 SubmitExperiment） ----------
func TestTeacherWorkflow(t *testing.T) {
	db := setupTestDB()

	// 1. 创建教师和学生
	teacher := createTestUser("teacher")
	student := createTestUser("student")

	// 2. 教师创建实验（带题目）
	exp := models.Experiment{
		ID:          "exp1",
		Title:       "集成实验",
		Description: "desc",
		Permission:  1,
		Deadline:    time.Now().Add(24 * time.Hour),
		CreatedAt:   time.Now(),
		Users:       []models.User{student},
		Questions: []models.Question{
			{ID: "q1", Type: "choice", Content: "1+1=?", Options: `["2","3"]`, CorrectAnswer: "2", Score: 5},
		},
	}
	db.Create(&exp)

	// -------- 获取实验详情 --------
	w1 := httptest.NewRecorder()
	c1, _ := gin.CreateTestContext(w1)
	c1.Params = []gin.Param{{Key: "experiment_id", Value: "exp1"}}
	c1.Request = httptest.NewRequest("GET", "/experiments/exp1", nil)
	controller.GetExperimentDetail_Teacher(c1)

	if w1.Code != http.StatusOK {
		t.Fatalf("expected 200 on GetExperimentDetail, got %d", w1.Code)
	}

	// -------- 教师创建通知 --------
	notiBody := map[string]interface{}{
		"title":   "通知标题",
		"content": "通知内容",
		"users":   []uint{student.ID},
	}
	notiJSON, _ := json.Marshal(notiBody)
	w2 := httptest.NewRecorder()
	c2, _ := gin.CreateTestContext(w2)
	c2.Request = httptest.NewRequest("POST", "/notifications", bytes.NewBuffer(notiJSON))
	c2.Request.Header.Set("Content-Type", "application/json")
	c2.Set("user", teacher)
	controller.CreateNotification(c2)

	if w2.Code != http.StatusCreated {
		t.Fatalf("expected 201 on CreateNotification, got %d", w2.Code)
	}

	// -------- 教师查看通知 --------
	w3 := httptest.NewRecorder()
	c3, _ := gin.CreateTestContext(w3)
	c3.Request = httptest.NewRequest("GET", "/notifications?page=1&limit=10", nil)
	controller.GetTeacherNotifications(c3)

	if w3.Code != http.StatusOK {
		t.Fatalf("expected 200 on GetTeacherNotifications, got %d", w3.Code)
	}

	// -------- 获取学生提交（只测试能找到的空记录，不测试提交新实验） --------
	w4 := httptest.NewRecorder()
	c4, _ := gin.CreateTestContext(w4)
	c4.Params = []gin.Param{
		{Key: "experiment_id", Value: "exp1"},
		{Key: "student_id", Value: strconv.Itoa(int(student.ID))},
	}
	c4.Request = httptest.NewRequest("GET", "/experiments/exp1/students/"+strconv.Itoa(int(student.ID)), nil)
	controller.GetStudentSubmissions(c4)

	if w4.Code != http.StatusOK {
		t.Fatalf("expected 200 on GetStudentSubmissions, got %d", w4.Code)
	}
}
