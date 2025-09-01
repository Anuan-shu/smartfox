package controller

import (
	"bytes"
	"encoding/json"
	"fmt"
	"lh/global"
	"lh/models"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// Mock structures for testing
type MockDB struct {
	mock.Mock
}

func setupTestDB() *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		panic("failed to connect to test database")
	}

	// Auto migrate the schema
	db.AutoMigrate(&models.User{}, &models.Experiment{}, &models.Question{},
		&models.Attachment{}, &models.ExperimentSubmission{}, &models.QuestionSubmission{},
		&models.Notification{})

	return db
}

func setupTestUser(db *gorm.DB) models.User {
	user := models.User{
		Model:     gorm.Model{ID: 1},
		Name:      "Test Student",
		Telephone: "1234567890",
		Password:  "password",
		Role:      "student",
		Email:     "test@example.com",
	}
	db.Create(&user)
	return user
}

func setupTestExperiment(db *gorm.DB) models.Experiment {
	exp := models.Experiment{
		ID:          uuid.New().String(),
		Title:       "Test Experiment",
		Description: "Test Description",
		Permission:  1,
		Deadline:    time.Now().Add(24 * time.Hour),
		CreatedAt:   time.Now(),
	}
	db.Create(&exp)
	return exp
}

func setupTestContext(user models.User) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("user", user)
	return c, w
}

// Test GetExperiments_Student function
func TestGetExperimentsStudent_Success(t *testing.T) {
	db := setupTestDB()
	global.DB = db

	user := setupTestUser(db)
	exp := setupTestExperiment(db)

	// Create experiment-user relationship
	db.Exec("INSERT INTO experiment_users (experiment_id, user_id) VALUES (?, ?)", exp.ID, user.ID)

	c, w := setupTestContext(user)
	req, _ := http.NewRequest("GET", "/experiments?page=1&limit=10&status=all", nil)
	c.Request = req

	GetExperiments_Student(c)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "success", response["status"])
	assert.NotNil(t, response["data"])
	assert.NotNil(t, response["pagination"])
}

func TestGetExperimentsStudent_NoExperiments(t *testing.T) {
	db := setupTestDB()
	global.DB = db

	user := setupTestUser(db)

	c, w := setupTestContext(user)
	req, _ := http.NewRequest("GET", "/experiments?page=1&limit=10", nil)
	c.Request = req

	GetExperiments_Student(c)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "success", response["status"])

	data := response["data"].([]interface{})
	assert.Equal(t, 0, len(data))
}

// Test GetExperimentDetail_Student function
func TestGetExperimentDetailStudent_Success(t *testing.T) {
	db := setupTestDB()
	global.DB = db

	user := setupTestUser(db)
	exp := setupTestExperiment(db)

	// Create test question
	question := models.Question{
		ID:            uuid.New().String(),
		ExperimentID:  exp.ID,
		Type:          "choice",
		Content:       "Test Question",
		Options:       `["A", "B", "C", "D"]`,
		CorrectAnswer: "A",
		Score:         10,
	}
	db.Create(&question)

	c, w := setupTestContext(user)
	c.Params = gin.Params{{Key: "experiment_id", Value: exp.ID}}

	GetExperimentDetail_Student(c)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "success", response["status"])
	assert.NotNil(t, response["data"])
}

func TestGetExperimentDetailStudent_NotFound(t *testing.T) {
	db := setupTestDB()
	global.DB = db

	user := setupTestUser(db)

	c, w := setupTestContext(user)
	c.Params = gin.Params{{Key: "experiment_id", Value: "nonexistent-id"}}

	GetExperimentDetail_Student(c)

	assert.Equal(t, http.StatusNotFound, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "error", response["status"])
	assert.Equal(t, "Experiment not found", response["message"])
}

// Test SaveAnswer function
func TestSaveAnswer_Success(t *testing.T) {
	db := setupTestDB()
	global.DB = db

	user := setupTestUser(db)
	exp := setupTestExperiment(db)

	// Create test question
	question := models.Question{
		ID:            uuid.New().String(),
		ExperimentID:  exp.ID,
		Type:          "choice",
		Content:       "Test Question",
		Options:       `["A", "B", "C", "D"]`,
		CorrectAnswer: "A",
		Score:         10,
	}
	db.Create(&question)

	c, w := setupTestContext(user)
	c.Params = gin.Params{{Key: "experiment_id", Value: exp.ID}}

	requestBody := map[string]interface{}{
		"answers": []map[string]interface{}{
			{
				"question_id": question.ID,
				"type":        "choice",
				"answer":      "A",
			},
		},
	}
	jsonData, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/save-answer", bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req

	SaveAnswer(c)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "success", response["status"])
}

func TestSaveAnswer_InvalidRequest(t *testing.T) {
	db := setupTestDB()
	global.DB = db

	user := setupTestUser(db)
	exp := setupTestExperiment(db)

	c, w := setupTestContext(user)
	c.Params = gin.Params{{Key: "experiment_id", Value: exp.ID}}

	// Invalid request body
	requestBody := map[string]interface{}{
		"invalid": "data",
	}
	jsonData, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/save-answer", bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req

	SaveAnswer(c)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "error", response["status"])
	assert.Equal(t, "Invalid request", response["message"])
}

// Test SubmitExperiment function
func TestSubmitExperiment_Success(t *testing.T) {
	db := setupTestDB()
	global.DB = db

	user := setupTestUser(db)
	exp := setupTestExperiment(db)

	// Create test question
	question := models.Question{
		ID:            uuid.New().String(),
		ExperimentID:  exp.ID,
		Type:          "choice",
		Content:       "Test Question",
		Options:       `["A", "B", "C", "D"]`,
		CorrectAnswer: "A",
		Score:         10,
	}
	db.Create(&question)

	c, w := setupTestContext(user)
	c.Params = gin.Params{{Key: "experiment_id", Value: exp.ID}}

	requestBody := map[string]interface{}{
		"answers": []map[string]interface{}{
			{
				"question_id": question.ID,
				"type":        "choice",
				"answer":      "A",
			},
		},
	}
	jsonData, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/submit", bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req

	SubmitExperiment(c)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "success", response["status"])
	assert.NotNil(t, response["data"])
}

func TestSubmitExperiment_ExperimentNotFound(t *testing.T) {
	db := setupTestDB()
	global.DB = db

	user := setupTestUser(db)

	c, w := setupTestContext(user)
	c.Params = gin.Params{{Key: "experiment_id", Value: "nonexistent-id"}}

	requestBody := map[string]interface{}{
		"answers": []map[string]interface{}{},
	}
	jsonData, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/submit", bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req

	SubmitExperiment(c)

	assert.Equal(t, http.StatusNotFound, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "error", response["status"])
	assert.Equal(t, "Experiment not found", response["message"])
}

func TestSubmitExperiment_DeadlinePassed(t *testing.T) {
	db := setupTestDB()
	global.DB = db

	user := setupTestUser(db)

	// Create experiment with past deadline
	exp := models.Experiment{
		ID:          uuid.New().String(),
		Title:       "Test Experiment",
		Description: "Test Description",
		Permission:  0,                               // No permission to submit after deadline
		Deadline:    time.Now().Add(-24 * time.Hour), // Past deadline
		CreatedAt:   time.Now(),
	}
	db.Create(&exp)

	c, w := setupTestContext(user)
	c.Params = gin.Params{{Key: "experiment_id", Value: exp.ID}}

	requestBody := map[string]interface{}{
		"answers": []map[string]interface{}{},
	}
	jsonData, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/submit", bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req

	SubmitExperiment(c)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "error", response["status"])
	assert.Equal(t, "Experiment deadline has passed", response["message"])
}

// Test GetSubmissions function
func TestGetSubmissions_Success(t *testing.T) {
	db := setupTestDB()
	global.DB = db

	user := setupTestUser(db)
	exp := setupTestExperiment(db)

	// Create test submission
	submission := models.ExperimentSubmission{
		ID:           uuid.New().String(),
		ExperimentID: exp.ID,
		StudentID:    user.ID,
		Status:       "submitted",
		TotalScore:   85,
		SubmittedAt:  time.Now(),
		CreatedAt:    time.Now(),
	}
	db.Create(&submission)

	c, w := setupTestContext(user)
	req, _ := http.NewRequest("GET", "/submissions?page=1&limit=10", nil)
	c.Request = req

	GetSubmissions(c)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "success", response["status"])
	assert.NotNil(t, response["data"])
	assert.NotNil(t, response["pagination"])
}

func TestGetSubmissions_WithExperimentFilter(t *testing.T) {
	db := setupTestDB()
	global.DB = db

	user := setupTestUser(db)
	exp := setupTestExperiment(db)

	// Create test submission
	submission := models.ExperimentSubmission{
		ID:           uuid.New().String(),
		ExperimentID: exp.ID,
		StudentID:    user.ID,
		Status:       "submitted",
		TotalScore:   85,
		SubmittedAt:  time.Now(),
		CreatedAt:    time.Now(),
	}
	db.Create(&submission)

	c, w := setupTestContext(user)
	req, _ := http.NewRequest("GET", "/submissions?page=1&limit=10&experiment_id="+exp.ID, nil)
	c.Request = req

	GetSubmissions(c)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "success", response["status"])

	data := response["data"].([]interface{})
	assert.Equal(t, 1, len(data))
}

// Test GetStudentNotifications function
func TestGetStudentNotifications_Success(t *testing.T) {
	db := setupTestDB()
	global.DB = db

	user := setupTestUser(db)

	// Create notification_users table
	db.Exec(`CREATE TABLE IF NOT EXISTS notification_users (
		notification_id TEXT,
		user_id INTEGER
	)`)

	// Create test notification
	notification := models.Notification{
		ID:          uuid.New().String(),
		Title:       "Test Notification",
		Content:     "Test Content",
		IsImportant: false,
		CreatedAt:   time.Now(),
	}
	db.Create(&notification)

	// Create notification-user relationship
	db.Exec("INSERT INTO notification_users (notification_id, user_id) VALUES (?, ?)",
		notification.ID, strconv.Itoa(int(user.ID)))

	c, w := setupTestContext(user)
	c.Params = gin.Params{{Key: "student_id", Value: strconv.Itoa(int(user.ID))}}
	req, _ := http.NewRequest("GET", "/notifications?page=1&limit=10", nil)
	c.Request = req

	GetStudentNotifications(c)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "success", response["status"])
	assert.NotNil(t, response["data"])
	assert.NotNil(t, response["pagination"])
}

func TestGetStudentNotifications_MissingStudentID(t *testing.T) {
	db := setupTestDB()
	global.DB = db

	user := setupTestUser(db)

	c, w := setupTestContext(user)
	c.Params = gin.Params{{Key: "student_id", Value: ""}}
	req, _ := http.NewRequest("GET", "/notifications", nil)
	c.Request = req

	GetStudentNotifications(c)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "student_id is required", response["error"])
}

func TestGetStudentNotifications_InvalidPageNumber(t *testing.T) {
	db := setupTestDB()
	global.DB = db

	user := setupTestUser(db)

	c, w := setupTestContext(user)
	c.Params = gin.Params{{Key: "student_id", Value: strconv.Itoa(int(user.ID))}}
	req, _ := http.NewRequest("GET", "/notifications?page=invalid", nil)
	c.Request = req

	GetStudentNotifications(c)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "invalid page number", response["error"])
}

// Test HandleStudentListFiles function
func TestHandleStudentListFiles_Success(t *testing.T) {
	// Note: This test would require mocking OSS client
	// Since OSS is not initialized in test environment, this will panic
	// We skip this test for now
	t.Skip("Skipping test that requires OSS initialization")
}

func TestHandleStudentListFiles_MissingExperimentID(t *testing.T) {
	c, w := setupTestContext(models.User{})
	c.Params = gin.Params{{Key: "experiment_id", Value: ""}}

	HandleStudentListFiles(c)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "Experiment ID is required", response["error"])
}

// Test HandleStudentDownloadFile function
func TestHandleStudentDownloadFile_MissingParameters(t *testing.T) {
	c, w := setupTestContext(models.User{})
	c.Params = gin.Params{
		{Key: "experiment_id", Value: ""},
		{Key: "filename", Value: ""},
	}

	HandleStudentDownloadFile(c)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "Experiment ID and filename are required", response["error"])
}

func TestHandleStudentDownloadFile_ValidParameters(t *testing.T) {
	// Note: This test would require mocking OSS client
	// Since OSS is not initialized in test environment, this will panic
	// We skip this test for now
	t.Skip("Skipping test that requires OSS initialization")
}

// Test getScore function
func TestGetScore_ChoiceQuestion_Correct(t *testing.T) {
	question := models.Question{
		Type:          "choice",
		CorrectAnswer: "A",
		Score:         10,
	}

	answer := struct {
		QuestionID string "json:\"question_id\""
		Type       string "json:\"type\""
		Answer     string "json:\"answer,omitempty\""
		Code       string "json:\"code,omitempty\""
		Language   string "json:\"language,omitempty\""
	}{
		Type:   "choice",
		Answer: "A",
	}

	score, feedback := getScore(question, answer)

	assert.Equal(t, 10, score)
	assert.Equal(t, "Correct", feedback)
}

func TestGetScore_ChoiceQuestion_Incorrect(t *testing.T) {
	question := models.Question{
		Type:          "choice",
		CorrectAnswer: "A",
		Score:         10,
	}

	answer := struct {
		QuestionID string "json:\"question_id\""
		Type       string "json:\"type\""
		Answer     string "json:\"answer,omitempty\""
		Code       string "json:\"code,omitempty\""
		Language   string "json:\"language,omitempty\""
	}{
		Type:   "choice",
		Answer: "B",
	}

	score, feedback := getScore(question, answer)

	assert.Equal(t, 0, score)
	assert.Equal(t, "Incorrect", feedback)
}

func TestGetScore_BlankQuestion_Correct(t *testing.T) {
	question := models.Question{
		Type:          "blank",
		CorrectAnswer: "correct answer",
		Score:         15,
	}

	answer := struct {
		QuestionID string "json:\"question_id\""
		Type       string "json:\"type\""
		Answer     string "json:\"answer,omitempty\""
		Code       string "json:\"code,omitempty\""
		Language   string "json:\"language,omitempty\""
	}{
		Type:   "blank",
		Answer: "correct answer",
	}

	score, feedback := getScore(question, answer)

	assert.Equal(t, 15, score)
	assert.Equal(t, "Correct", feedback)
}

func TestGetScore_BlankQuestion_Incorrect(t *testing.T) {
	question := models.Question{
		Type:          "blank",
		CorrectAnswer: "correct answer",
		Score:         15,
	}

	answer := struct {
		QuestionID string "json:\"question_id\""
		Type       string "json:\"type\""
		Answer     string "json:\"answer,omitempty\""
		Code       string "json:\"code,omitempty\""
		Language   string "json:\"language,omitempty\""
	}{
		Type:   "blank",
		Answer: "wrong answer",
	}

	score, feedback := getScore(question, answer)

	assert.Equal(t, 0, score)
	assert.Equal(t, "Incorrect", feedback)
}

func TestGetScore_CodeQuestion_EvaluationError(t *testing.T) {
	question := models.Question{
		Type:      "code",
		TestCases: "invalid json",
		Score:     20,
	}

	answer := struct {
		QuestionID string "json:\"question_id\""
		Type       string "json:\"type\""
		Answer     string "json:\"answer,omitempty\""
		Code       string "json:\"code,omitempty\""
		Language   string "json:\"language,omitempty\""
	}{
		Type:     "code",
		Code:     "print('hello')",
		Language: "python",
	}

	score, feedback := getScore(question, answer)

	assert.Equal(t, 0, score)
	assert.Contains(t, feedback, "Evaluation error")
}

// Test evaluateCode function
func TestEvaluateCode_InvalidTestCases(t *testing.T) {
	code := "print('hello')"
	language := "python"
	testCasesJSON := "invalid json"

	result, err := evaluateCode(code, language, testCasesJSON)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "invalid test cases format")
}

func TestEvaluateCode_ValidTestCases_ServiceUnavailable(t *testing.T) {
	code := "print('hello')"
	language := "python"
	testCasesJSON := `[{"input": "test", "expected_output": "test"}]`

	result, err := evaluateCode(code, language, testCasesJSON)

	// Since the evaluation service is not running in test, we expect an error
	assert.Error(t, err)
	assert.Nil(t, result)
}

// Additional edge case tests
func TestSaveAnswer_ExperimentNotFound(t *testing.T) {
	db := setupTestDB()
	global.DB = db

	user := setupTestUser(db)

	c, w := setupTestContext(user)
	c.Params = gin.Params{{Key: "experiment_id", Value: "nonexistent-id"}}

	requestBody := map[string]interface{}{
		"answers": []map[string]interface{}{
			{
				"question_id": "some-id",
				"type":        "choice",
				"answer":      "A",
			},
		},
	}
	jsonData, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/save-answer", bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req

	SaveAnswer(c)

	assert.Equal(t, http.StatusNotFound, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "error", response["status"])
	assert.Equal(t, "Experiment not found", response["message"])
}

func TestSaveAnswer_QuestionNotBelongToExperiment(t *testing.T) {
	db := setupTestDB()
	global.DB = db

	user := setupTestUser(db)
	exp := setupTestExperiment(db)

	c, w := setupTestContext(user)
	c.Params = gin.Params{{Key: "experiment_id", Value: exp.ID}}

	requestBody := map[string]interface{}{
		"answers": []map[string]interface{}{
			{
				"question_id": "invalid-question-id",
				"type":        "choice",
				"answer":      "A",
			},
		},
	}
	jsonData, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/save-answer", bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req

	SaveAnswer(c)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "error", response["status"])
	assert.Contains(t, response["message"].(string), "does not belong to experiment")
}

func TestGetStudentNotifications_WithFilters(t *testing.T) {
	db := setupTestDB()
	global.DB = db

	user := setupTestUser(db)
	exp := setupTestExperiment(db)

	// Create notification_users table
	db.Exec(`CREATE TABLE IF NOT EXISTS notification_users (
		notification_id TEXT,
		user_id INTEGER
	)`)

	// Create test notification with experiment
	notification := models.Notification{
		ID:           uuid.New().String(),
		Title:        "Test Notification",
		Content:      "Test Content",
		IsImportant:  true,
		ExperimentID: exp.ID,
		CreatedAt:    time.Now(),
	}
	db.Create(&notification)

	// Create notification-user relationship
	db.Exec("INSERT INTO notification_users (notification_id, user_id) VALUES (?, ?)",
		notification.ID, strconv.Itoa(int(user.ID)))

	c, w := setupTestContext(user)
	c.Params = gin.Params{{Key: "student_id", Value: strconv.Itoa(int(user.ID))}}
	req, _ := http.NewRequest("GET",
		fmt.Sprintf("/notifications?page=1&limit=10&experiment_id=%s&is_important=true", exp.ID), nil)
	c.Request = req

	GetStudentNotifications(c)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "success", response["status"])
}

func TestSubmitExperiment_InvalidRequestBody(t *testing.T) {
	db := setupTestDB()
	global.DB = db

	user := setupTestUser(db)
	exp := setupTestExperiment(db)

	c, w := setupTestContext(user)
	c.Params = gin.Params{{Key: "experiment_id", Value: exp.ID}}

	// Invalid JSON body
	jsonData := []byte(`{"invalid": "json"`) // Missing closing brace - truly invalid JSON
	req, _ := http.NewRequest("POST", "/submit", bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req

	SubmitExperiment(c)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "error", response["status"])
	assert.Equal(t, "Invalid request body", response["message"])
}
