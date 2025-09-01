package controller

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/aliyun/aliyun-oss-go-sdk/oss"
	"lh/common"
	"lh/global"
	"lh/models"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ExperimentResponse 响应结构体
type ExperimentResponse struct {
	Code    int               `json:"code"`
	Data    models.Experiment `json:"data"`
	Message string            `json:"message"`
}

func GetExperiments_Student(c *gin.Context) {
	db := common.GetDB()

	// 解析分页参数
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	status := c.DefaultQuery("status", "all")

	offset := (page - 1) * limit
	user, _ := c.Get("user")
	studentID := user.(models.User).ID
	now := time.Now()

	var experimentIDs []string
	if err := db.Table("experiment_users").
		Where("user_id = ?", studentID).
		Pluck("experiment_id", &experimentIDs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to get assigned experiments",
		})
		return
	}

	// 如果没有分配任何实验，返回空列表
	if len(experimentIDs) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"status": "success",
			"data":   []gin.H{},
			"pagination": gin.H{
				"page":  page,
				"limit": limit,
				"total": 0,
			},
		})
		return
	}
	query := db.Model(&models.Experiment{}).Where("id IN (?)", experimentIDs)

	// 状态筛选逻辑

	switch status {
	case "active":
		query = query.Where("deadline > ?", now)
	case "expired":
		query = query.Where("deadline <= ?", now)
	}

	var experiments []models.Experiment
	var total int64
	query.Count(&total)

	if err := query.Order("created_at DESC").
		Offset(offset).
		Limit(limit).
		Find(&experiments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "数据库查询失败",
		})
		return
	}

	// 构建响应数据
	experimentResponses := make([]gin.H, len(experiments))
	for i, exp := range experiments {
		// 查询学生的提交状态
		var submission models.ExperimentSubmission
		submissionStatus := "not_started"
		if err := db.Where("experiment_id = ? AND student_id = ?", exp.ID, studentID).Order("created_at DESC").
			First(&submission).Error; err == nil {
			submissionStatus = strings.ToLower(submission.Status)
		}

		// 确定实验状态
		expStatus := "active"
		if exp.Deadline.Before(now) {
			expStatus = "expired"
		}

		experimentResponses[i] = gin.H{
			"experiment_id":     exp.ID,
			"title":             exp.Title,
			"description":       exp.Description,
			"deadline":          exp.Deadline.Format(time.RFC3339),
			"status":            expStatus,
			"submission_status": submissionStatus,
		}
	}

	// 返回分页响应
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   experimentResponses,
		"pagination": gin.H{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}

// GetExperiment 获取实验详细信息
func GetExperimentDetail_Student(c *gin.Context) {
	// 获取实验 ID
	db := global.DB
	user, _ := c.Get("user")
	studentID := user.(models.User).ID
	experimentID := c.Param("experiment_id")
	var experiment models.Experiment
	// 查询实验详情，包括关联的阶段和资源
	result := db.Preload("Questions").Preload("Attachments").
		Where("ID = ?", experimentID).
		First(&experiment)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Experiment not found"})
		return
	}

	// 获取学生提交记录
	var submission models.ExperimentSubmission
	submissionStatus := "not_started"
	totalScore := 0
	if err := global.DB.Where("experiment_id = ? AND student_id = ?", experimentID, studentID).Order("created_at DESC").
		First(&submission).Error; err == nil {
		submissionStatus = strings.ToLower(submission.Status)
		totalScore = submission.TotalScore
	}

	// 获取学生答案
	questionResponses := make([]gin.H, len(experiment.Questions))
	for i, q := range experiment.Questions {
		questionData := gin.H{
			"question_id": q.ID,
			"type":        q.Type,
			"content":     q.Content,
			"score":       q.Score,
			"image_url":   q.ImageURL,
		}

		// 选择题添加选项
		if q.Type == "choice" {
			var options []string
			json.Unmarshal([]byte(q.Options), &options)
			questionData["options"] = options
		}
		if experiment.Deadline.Before(time.Now()) {
			if q.Type != "code" {
				questionData["correct_answer"] = q.CorrectAnswer
			}
			questionData["explanation"] = q.Explanation
		}
		// 获取学生答案和反馈
		var qSubmission models.QuestionSubmission
		if err := global.DB.Where("submission_id = ? AND question_id = ?", submission.ID, q.ID).
			First(&qSubmission).Error; err == nil {
			if q.Type == "code" {
				questionData["student_code"] = qSubmission.Code
				questionData["student_language"] = qSubmission.Language
			} else {
				questionData["student_answer"] = qSubmission.Answer
			}
			// if experiment.Deadline.Before(time.Now()) {
			questionData["feedback"] = qSubmission.Feedback
			// }
		}
		questionResponses[i] = questionData
	}
	attachmentResponses := make([]gin.H, len(experiment.Attachments))
	for i, a := range experiment.Attachments {
		attachmentResponses[i] = gin.H{
			"id":   a.ID,
			"name": a.Name,
			"url":  a.URL,
		}
	}
	// 构建响应
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data": gin.H{
			"experiment_id":     experiment.ID,
			"permission":        experiment.Permission,
			"title":             experiment.Title,
			"description":       experiment.Description,
			"deadline":          experiment.Deadline.Format(time.RFC3339),
			"questions":         questionResponses,
			"attachments":       attachmentResponses,
			"submission_status": submissionStatus,
			"total_score":       totalScore,
		},
	})
}

func SaveAnswer(c *gin.Context) {
	db := global.DB
	experimentID := c.Param("experiment_id")
	user, _ := c.Get("user")
	studentID := user.(models.User).ID
	type Answer struct {
		QuestionID string `json:"question_id" binding:"required"`
		Type       string `json:"type" binding:"required,oneof=choice blank code"`
		Answer     string `json:"answer" binding:"required_if=Type choice required_if=Type blank"`
		Code       string `json:"code" binding:"required_if=Type code"`
		Language   string `json:"language" binding:"required_if=Type code,oneof=cpp java python"`
	}
	var req struct {
		Answers []Answer `json:"answers" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid request"})
		return
	}

	now := time.Now()
	tx := db.Begin()
	//验证试验是否存在
	var experiment models.Experiment
	if err := tx.Where("id = ?", experimentID).First(&experiment).Error; err != nil {
		tx.Rollback()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Experiment not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Database error"})
		}
		return
	}
	// 处理实验提交记录（保持不变）
	var submission models.ExperimentSubmission
	result := tx.Where("experiment_id = ? AND student_id = ? AND status != 'submitted'", experimentID, studentID).
		Order("created_at DESC").
		First(&submission)

	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		submission = models.ExperimentSubmission{
			ID:           uuid.New().String(),
			ExperimentID: experimentID,
			StudentID:    studentID,
			Status:       "in_progress",
			SubmittedAt:  now,
			CreatedAt:    now,
			UpdatedAt:    now,
		}
		if err := tx.Create(&submission).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to create submission"})
			return
		}
	} else if result.Error != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Database error"})
		return
	} else {
		submission.UpdatedAt = now
		if err := tx.Save(&submission).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to update submission"})
			return
		}
	}

	// 3. 处理每道题的提交
	validQuestionIDs := make([]string, len(req.Answers))

	for i, ans := range req.Answers {
		validQuestionIDs[i] = ans.QuestionID
	}

	// 验证题目属于当前实验
	var validQuestions []models.Question
	if err := tx.Where("experiment_id = ?", experimentID).
		Where("id IN ?", validQuestionIDs).
		Find(&validQuestions).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to validate questions"})
		return
	}

	validQuestionMap := make(map[string]bool)
	for _, q := range validQuestions {
		validQuestionMap[q.ID] = true
	}

	for _, ans := range req.Answers {
		if _, exists := validQuestionMap[ans.QuestionID]; !exists {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  "error",
				"message": fmt.Sprintf("Question %s does not belong to experiment %s", ans.QuestionID, experimentID),
			})
			return
		}
		var question models.Question
		if err := tx.Where("id = ?", ans.QuestionID).First(&question).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to validate questions"})
			return
		}
		var qSubmission models.QuestionSubmission
		result := tx.Where("submission_id = ? AND question_id = ?", submission.ID, ans.QuestionID).
			First(&qSubmission)

		if result.Error == nil {
			// 更新现有记录
			switch ans.Type {
			case "choice", "blank":
				qSubmission.Answer = ans.Answer
				qSubmission.Code = ""
				qSubmission.Language = ""
			case "code":
				qSubmission.Code = ans.Code
				qSubmission.Language = ans.Language
				qSubmission.Answer = ""
			}
			qSubmission.UpdatedAt = now

			if err := tx.Save(&qSubmission).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{
					"status":  "error",
					"message": fmt.Sprintf("Failed to update answer for question %s", ans.QuestionID),
				})
				return
			}
		} else {
			// 创建新记录
			qSubmission = models.QuestionSubmission{
				ID:           uuid.New().String(),
				SubmissionID: submission.ID,
				QuestionID:   ans.QuestionID,
				Type:         question.Type,
				PerfectScore: question.Score,
				CreatedAt:    now,
				UpdatedAt:    now,
			}

			switch ans.Type {
			case "choice", "blank":
				qSubmission.Answer = ans.Answer
			case "code":
				qSubmission.Code = ans.Code
				qSubmission.Language = ans.Language
			}

			if err := tx.Create(&qSubmission).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{
					"status":  "error",
					"message": fmt.Sprintf("Failed to save answer for question %s", ans.QuestionID),
				})
				return
			}
		}
	}

	// 4. 获取所有已保存题目（包括之前保存的）
	var allSubmissions []models.QuestionSubmission
	if err := tx.Where("submission_id = ?", submission.ID).Find(&allSubmissions).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to fetch saved questions"})
		return
	}

	fullSavedQuestions := make([]gin.H, 0, len(allSubmissions))
	for _, s := range allSubmissions {
		fullSavedQuestions = append(fullSavedQuestions, gin.H{
			"question_id":            s.QuestionID,
			"question_submission_id": s.ID,
			"updated_at":             s.UpdatedAt.Format(time.RFC3339),
		})
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Transaction failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data": gin.H{
			"submission_id":   submission.ID,
			"student_id":      studentID,
			"experiment_id":   experimentID,
			"updated_at":      now,
			"saved_questions": fullSavedQuestions,
		},
	})
}

// 修改后的提交实验函数
func SubmitExperiment(c *gin.Context) {
	db := global.DB
	user, _ := c.Get("user")
	studentID := user.(models.User).ID
	experimentID := c.Param("experiment_id")

	// 1. 检查实验是否已过期
	var experiment models.Experiment
	if err := db.Preload("Questions").First(&experiment, "id = ?", experimentID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Experiment not found"})
		return
	}
	totalPerfectScore := 0
	for _, q := range experiment.Questions {
		totalPerfectScore += q.Score

	}
	if experiment.Permission == 0 && time.Now().After(experiment.Deadline) {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Experiment deadline has passed"})
		return
	}
	// 2. 解析请求体中的答案
	var req struct {
		Answers []struct {
			QuestionID string `json:"question_id"`
			Type       string `json:"type"`
			Answer     string `json:"answer,omitempty"`
			Code       string `json:"code,omitempty"`
			Language   string `json:"language,omitempty"`
		} `json:"answers"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid request body"})
		return
	}
	tx := db.Begin()
	now := time.Now()
	// 处理实验提交记录（保持不变）
	var submission models.ExperimentSubmission
	result := tx.Where("experiment_id = ? AND student_id = ? AND status != 'submitted'", experimentID, studentID).Order("created_at DESC").
		First(&submission)

	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		submission = models.ExperimentSubmission{
			ID:           uuid.New().String(),
			ExperimentID: experimentID,
			StudentID:    studentID,
			Status:       "in_progress",
			CreatedAt:    now,
			UpdatedAt:    now,
			SubmittedAt:  now,
		}
		if err := tx.Create(&submission).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to create submission"})
			return
		}
	} else if result.Error != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Database error"})
		return
	} else {
		submission.UpdatedAt = now
		if err := tx.Save(&submission).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to update submission"})
			return
		}
	}

	// 3. 处理每道题的提交
	totalScore := 0
	results := make([]gin.H, 0, len(req.Answers))
	validQuestionIDs := make([]string, len(req.Answers))
	for i, ans := range req.Answers {
		validQuestionIDs[i] = ans.QuestionID
	}
	// 验证题目属于当前实验
	var validQuestions []models.Question
	if err := tx.Where("experiment_id = ?", experimentID).
		Where("id IN ?", validQuestionIDs).
		Find(&validQuestions).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to validate questions"})
		return
	}

	validQuestionMap := make(map[string]models.Question, len(validQuestions))
	for _, q := range validQuestions {
		validQuestionMap[q.ID] = q
	}

	for _, ans := range req.Answers {

		question := validQuestionMap[ans.QuestionID]
		var qSubmission models.QuestionSubmission
		result := tx.Where("submission_id = ? AND question_id = ?", submission.ID, ans.QuestionID).
			First(&qSubmission)

		if result.Error == nil {
			// 更新现有记录
			switch ans.Type {
			case "choice", "blank":
				qSubmission.Answer = ans.Answer
				qSubmission.Code = ""
				qSubmission.Language = ""
			case "code":
				qSubmission.Code = ans.Code
				qSubmission.Language = ans.Language
				qSubmission.Answer = ""
			}
			qSubmission.UpdatedAt = now
			qSubmission.Score, qSubmission.Feedback = getScore(question, ans)
			totalScore += qSubmission.Score
			results = append(results, gin.H{
				"question_id": ans.QuestionID,
				"type":        question.Type,
				"score":       fmt.Sprintf("%d/%d", qSubmission.Score, question.Score),
				"feedback":    qSubmission.Feedback,
			})
			if err := tx.Save(&qSubmission).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{
					"status":  "error",
					"message": fmt.Sprintf("Failed to update answer for question %s", ans.QuestionID),
				})
				return
			}
		} else {
			// 创建新记录
			qSubmission = models.QuestionSubmission{
				ID:           uuid.New().String(),
				SubmissionID: submission.ID,
				QuestionID:   ans.QuestionID,
				Type:         question.Type,
				PerfectScore: question.Score,
				CreatedAt:    now,
				UpdatedAt:    now,
			}

			switch ans.Type {
			case "choice", "blank":
				qSubmission.Answer = ans.Answer
			case "code":
				qSubmission.Code = ans.Code
				qSubmission.Language = ans.Language
			}
			qSubmission.Score, qSubmission.Feedback = getScore(question, ans)
			totalScore += qSubmission.Score
			results = append(results, gin.H{
				"question_id": ans.QuestionID,
				"type":        question.Type,
				"score":       fmt.Sprintf("%d/%d", qSubmission.Score, question.Score),
				"feedback":    qSubmission.Feedback,
			})
			if err := tx.Create(&qSubmission).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{
					"status":  "error",
					"message": fmt.Sprintf("Failed to save answer for question %s", ans.QuestionID),
				})
				return
			}
		}
	}
	// 5. 更新实验提交记录的总分
	submission.TotalScore = totalScore
	submission.Status = "submitted"
	if err := tx.Save(&submission).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to save submission",
		})
	}
	tx.Commit()
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data": gin.H{
			"submission_id": submission.ID,
			"total_score":   fmt.Sprintf("%d/%d", totalScore, totalPerfectScore),
			"results":       results,
			"submitted_at":  submission.SubmittedAt,
		},
	})
}

func getScore(question models.Question, ans struct {
	QuestionID string "json:\"question_id\""
	Type       string "json:\"type\""
	Answer     string "json:\"answer,omitempty\""
	Code       string "json:\"code,omitempty\""
	Language   string "json:\"language,omitempty\""
}) (int, string) {
	score := 0
	feedback := ""
	switch question.Type {
	case "choice", "blank":
		if ans.Answer == question.CorrectAnswer {
			score = question.Score
			feedback = "Correct"
		} else {
			feedback = "Incorrect"
		}
	case "code":
		// 调用评测服务进行代码评测
		result, err := evaluateCode(ans.Code, ans.Language, question.TestCases)
		if err != nil {
			feedback = fmt.Sprintf("Evaluation error: %v", err)
		} else {
			score = int(float64(question.Score) * result.Summary.PassRate / 100)
			feedback = fmt.Sprintf("Passed %d/%d test cases", result.Summary.PassedCases, result.Summary.TotalCases)
		}
	}
	return score, feedback
}

// 评测服务请求和响应结构
type EvaluationRequest struct {
	Language   string     `json:"language"`
	SourceCode string     `json:"source_code"`
	TestCases  []TestCase `json:"test_cases"`
	TimeLimit  int        `json:"time_limit,omitempty"`
}

type EvaluationResponse struct {
	CaseResults []struct {
		Status    string  `json:"status"`
		Stdout    string  `json:"stdout"`
		Stderr    string  `json:"stderr"`
		TimeTaken float64 `json:"time_taken"`
	} `json:"case_results"`
	Summary struct {
		TotalCases  int     `json:"total_cases"`
		PassedCases int     `json:"passed_cases"`
		PassRate    float64 `json:"pass_rate_percent"`
		Status      string  `json:"overall_status"`
	} `json:"summary"`
}

// evaluateCode 调用评测服务进行代码评测
func evaluateCode(code, language, testCasesJSON string) (*EvaluationResponse, error) {
	// 解析测试用例
	var testCases []TestCase
	if err := json.Unmarshal([]byte(testCasesJSON), &testCases); err != nil {
		return nil, fmt.Errorf("invalid test cases format")
	}

	// 准备评测请求
	request := EvaluationRequest{
		Language:   language,
		SourceCode: code,
		TestCases:  testCases,
		TimeLimit:  2, // 默认2秒超时
	}

	requestBody, err := json.Marshal(request)
	if err != nil {
		return nil, err
	}

	// 调用评测服务
	judgeBaseURL := os.Getenv("JUDGE_URL")
	if judgeBaseURL == "" {
		// 如果环境变量不存在，则回退到本地开发时的默认值
		judgeBaseURL = "http://localhost:8080"
	}
	judgeURL := judgeBaseURL + "/evaluate"
	resp, err := http.Post(judgeURL, "application/json", bytes.NewBuffer(requestBody))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("evaluation service returned status: %d", resp.StatusCode)
	}

	// 解析响应
	var response EvaluationResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, err
	}
	return &response, nil
}

func GetSubmissions(c *gin.Context) {
	db := global.DB
	user, _ := c.Get("user")
	studentID := user.(models.User).ID

	// 分页参数
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	experimentID := c.Query("experiment_id")
	offset := (page - 1) * limit

	// 查询条件
	query := db.Model(&models.ExperimentSubmission{}).Where("student_id = ?", studentID)
	if experimentID != "" {
		query = query.Where("experiment_id = ?", experimentID)
	}

	// 获取总数
	var total int64
	query.Count(&total)

	// 获取提交记录
	var submissions []models.ExperimentSubmission
	err := query.Preload("Experiment").
		Offset(offset).
		Limit(limit).
		Order("submitted_at DESC").
		Find(&submissions).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Database query failed"})
		return
	}

	// 获取所有相关的问题提交
	submissionIDs := make([]string, len(submissions))
	for i, sub := range submissions {
		submissionIDs[i] = sub.ID
	}

	var questionSubmissions []models.QuestionSubmission
	if len(submissionIDs) > 0 {
		if err := db.Where("submission_id IN ?", submissionIDs).
			Preload("Question").
			Find(&questionSubmissions).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to get question submissions"})
			return
		}
	}

	// 按提交ID分组问题提交
	questionSubMap := make(map[string][]models.QuestionSubmission)
	for _, qs := range questionSubmissions {
		questionSubMap[qs.SubmissionID] = append(questionSubMap[qs.SubmissionID], qs)
	}
	now := time.Now()
	// 构建响应
	submissionResponses := make([]gin.H, len(submissions))
	for i, sub := range submissions {
		// 获取该提交的问题结果
		results := make([]gin.H, 0)
		if qSubs, ok := questionSubMap[sub.ID]; ok {
			for _, qs := range qSubs {
				explanation := ""
				if now.After(sub.Experiment.Deadline) {
					explanation = qs.Question.Explanation
				}
				result := gin.H{
					"question_id": qs.QuestionID,
					"type":        qs.Question.Type,
					"score":       qs.Score,
					"feedback":    qs.Feedback,
					"explanation": explanation,
				}
				results = append(results, result)
			}
		}

		submissionResponses[i] = gin.H{
			"submission_id":    sub.ID,
			"experiment_id":    sub.ExperimentID,
			"experiment_title": sub.Experiment.Title,
			"total_score":      sub.TotalScore,
			"status":           sub.Status,
			"submitted_at":     sub.SubmittedAt.Format(time.RFC3339),
			"results":          results,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   submissionResponses,
		"pagination": gin.H{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}

//// HandleStudentListFiles 列出指定实验下的所有文件
//func HandleStudentListFiles(c *gin.Context) {
//	experimentID := c.Param("experiment_id")
//	if experimentID == "" {
//		c.JSON(http.StatusBadRequest, gin.H{"error": "Experiment ID is required"})
//		return
//	}
//
//	experimentDir := filepath.Join(uploadBaseDir, experimentID)
//
//	// 检查目录是否存在
//	if _, err := os.Stat(experimentDir); os.IsNotExist(err) {
//		c.JSON(http.StatusNotFound, gin.H{"error": "Experiment or files not found"})
//		return
//	}
//
//	files, err := os.ReadDir(experimentDir)
//	if err != nil {
//		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to read experiment directory: %v", err)})
//		return
//	}
//
//	var filenames []string
//	for _, file := range files {
//		if !file.IsDir() { // 只列出文件，不列出子目录
//			filenames = append(filenames, file.Name())
//		}
//	}
//
//	c.JSON(http.StatusOK, gin.H{
//		"experimentId": experimentID,
//		"files":        filenames,
//	})
//}
//
//// 处理学生下载文件
//func HandleStudentDownloadFile(c *gin.Context) {
//	experimentID := c.Param("experiment_id")
//	filename := c.Param("filename") // 获取原始文件名
//
//	if experimentID == "" || filename == "" {
//		c.JSON(http.StatusBadRequest, gin.H{"error": "Experiment ID and filename are required"})
//		return
//	}
//
//	// 构建完整的文件路径
//	// 使用 filepath.Base 清理 filename，防止路径遍历
//	filePath := filepath.Join(uploadBaseDir, experimentID, filepath.Base(filename))
//
//	// 检查文件是否存在
//	if _, err := os.Stat(filePath); os.IsNotExist(err) {
//		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
//		return
//	}
//
//	// 设置响应头，告诉浏览器这是一个文件下载
//	// Content-Disposition 会让浏览器弹出下载对话框，而不是试图直接显示文件
//	c.Header("Content-Description", "File Transfer")
//	c.Header("Content-Transfer-Encoding", "binary")
//	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename)) // 使用原始文件名
//	c.Header("Content-Type", "application/octet-stream")                              // 通用二进制流类型
//
//	c.File(filePath) // Gin 会自动处理文件发送
//}

// func GetStudentNotifications(c *gin.Context) {
// 	studentID := c.Param("student_id")
// 	if studentID == "" {
// 		c.JSON(http.StatusBadRequest, gin.H{"error": "student_id is required"})
// 		return
// 	}

// 	// 解析 query 参数 page_limit
// 	pageLimitStr := c.DefaultQuery("page_limit", "1")
// 	pageLimit, err := strconv.Atoi(pageLimitStr)
// 	if err != nil || pageLimit <= 0 {
// 		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid page_limit"})
// 		return
// 	}

// 	// 查找通知（users 字段中包含该 student_id）
// 	var notifications []models.Notification
// 	if err := global.DB.
// 		Where("? = ANY (users)", studentID).
// 		Order("created_at DESC").
// 		Find(&notifications).Error; err != nil {
// 		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch notifications"})
// 		return
// 	}

// 	total := len(notifications)
// 	if total == 0 {
// 		c.JSON(http.StatusOK, gin.H{"notification": gin.H{}})
// 		return
// 	}

// 	// 计算每页数量（尽可能平均）
// 	pageSize := (total + pageLimit - 1) / pageLimit // 向上取整
// 	pagedResult := make(map[string][]models.Notification)

// 	for i := 0; i < pageLimit; i++ {
// 		start := i * pageSize
// 		end := start + pageSize
// 		if start >= total {
// 			break
// 		}
// 		if end > total {
// 			end = total
// 		}
// 		pageKey := fmt.Sprintf("page%d", i+1)
// 		pagedResult[pageKey] = notifications[start:end]
// 	}

//		c.JSON(http.StatusOK, gin.H{
//			"notification": pagedResult,
//		})
//	}
// func GetStudentNotifications(c *gin.Context) {
// 	studentID := c.Param("student_id")
// 	if studentID == "" {
// 		c.JSON(http.StatusBadRequest, gin.H{"error": "学生ID不能为空"})
// 		return
// 	}

// 	// 解析查询参数
// 	pageStr := c.DefaultQuery("page", "1")
// 	limitStr := c.DefaultQuery("limit", "10")
// 	experimentID := c.Query("experiment_id")
// 	isImportantStr := c.Query("is_important")
// 	createdAfter := c.Query("created_after")

// 	page, err := strconv.Atoi(pageStr)
// 	if err != nil || page <= 0 {
// 		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的页码"})
// 		return
// 	}
// 	limit, err := strconv.Atoi(limitStr)
// 	if err != nil || limit <= 0 {
// 		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的每页数量"})
// 		return
// 	}

// 	// 构建查询（假设 users 是 []string）
// 	query := global.DB.Model(&models.Notification{}).
// 		Where("user_id = ?", studentID).
// 		Order("created_at DESC")

// 	// 筛选条件
// 	if experimentID != "" {
// 		query = query.Where("experiment_id = ?", experimentID)
// 	}
// 	if isImportantStr != "" {
// 		isImportant, err := strconv.ParseBool(isImportantStr)
// 		if err == nil {
// 			query = query.Where("is_important = ?", isImportant)
// 		}
// 	}
// 	if createdAfter != "" {
// 		if t, err := time.Parse(time.RFC3339, createdAfter); err == nil {
// 			query = query.Where("created_at >= ?", t)
// 		}
// 	}

// 	// 获取总数
// 	var total int64
// 	if err := query.Count(&total).Error; err != nil {
// 		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法获取通知总数"})
// 		return
// 	}

// 	// 分页查询
// 	var notifications []models.Notification
// 	if err := query.
// 		Offset((page - 1) * limit).
// 		Limit(limit).
// 		Find(&notifications).Error; err != nil {
// 		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法获取通知列表"})
// 		return
// 	}

//		c.JSON(http.StatusOK, gin.H{
//			"status": "success",
//			"data":   notifications,
//			"pagination": gin.H{
//				"page":  page,
//				"limit": limit,
//				"total": total,
//			},
//		})
//	}
func GetStudentNotifications(c *gin.Context) {
	studentID := c.Param("student_id")
	if studentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "student_id is required"})
		return
	}

	// Parse query parameters
	pageStr := c.DefaultQuery("page", "1")
	limitStr := c.DefaultQuery("limit", "10")
	experimentID := c.Query("experiment_id")
	isImportantStr := c.Query("is_important")
	createdAfter := c.Query("created_after")

	page, err := strconv.Atoi(pageStr)
	if err != nil || page <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid page number"})
		return
	}
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid limit"})
		return
	}

	// Build query with join table
	query := global.DB.
		Joins("JOIN notification_users ON notification_users.notification_id = notifications.id").
		Where("notification_users.user_id = ?", studentID).
		Order("notifications.created_at DESC")

	// Apply filters
	if experimentID != "" {
		query = query.Where("notifications.experiment_id = ?", experimentID)
	}
	if isImportantStr != "" {
		isImportant, err := strconv.ParseBool(isImportantStr)
		if err == nil {
			query = query.Where("notifications.is_important = ?", isImportant)
		}
	}
	if createdAfter != "" {
		if t, err := time.Parse(time.RFC3339, createdAfter); err == nil {
			query = query.Where("notifications.created_at >= ?", t)
		}
	}

	// Get total count
	var total int64
	if err := query.Model(&models.Notification{}).Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to count notifications"})
		return
	}

	// Paginated query
	var notifications []models.Notification
	if err := query.
		Select("notifications.*").
		Offset((page - 1) * limit).
		Limit(limit).
		Find(&notifications).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch notifications"})
		return
	}

	// Return response in the same format as the previous version
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   notifications,
		"pagination": gin.H{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}

// handleStudentListFilesOSS 列出指定实验下 OSS 中的所有文件
func HandleStudentListFiles(c *gin.Context) {
	experimentID := c.Param("experiment_id")
	if experimentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Experiment ID is required"})
		return
	}

	// 构造OSS对象前缀，用于列举
	prefixToList := fmt.Sprintf("%s%s/", ossExperimentPrefix, experimentID)

	var files []string
	// oss.Prefix 指定只列举该前缀下的对象
	// oss.Delimiter("/") 可以模拟文件夹结构，但这里我们直接列出所有文件
	marker := "" // 用于分页，如果文件很多的话
	for {
		lsRes, err := bucket.ListObjects(oss.Marker(marker), oss.Prefix(prefixToList))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to list objects from OSS: %v", err)})
			return
		}

		for _, object := range lsRes.Objects {
			// object.Key 是完整的 "experiments/exp001/report.pdf"
			// 我们需要提取文件名 "report.pdf"
			// 确保对象不是 "目录" 本身 (如果以 / 结尾且大小为0，通常是目录占位符)
			if !strings.HasSuffix(object.Key, "/") || object.Size > 0 {
				fileName := strings.TrimPrefix(object.Key, prefixToList)
				if fileName != "" { // 避免空文件名 (例如前缀本身)
					files = append(files, fileName)
				}
			}
		}

		if !lsRes.IsTruncated {
			break
		}
		marker = lsRes.NextMarker
	}

	c.JSON(http.StatusOK, gin.H{
		"experimentId": experimentID,
		"files":        files,
	})
}

// handleStudentDownloadFileOSS 生成预签名URL供学生下载文件
func HandleStudentDownloadFile(c *gin.Context) {
	experimentID := c.Param("experiment_id")
	filename := c.Param("filename") // 获取原始文件名

	if experimentID == "" || filename == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Experiment ID and filename are required"})
		return
	}

	// 构建完整的OSS对象键
	// 使用 filepath.Base 清理 filename，增加一层保护
	objectKey := fmt.Sprintf("%s%s/%s", ossExperimentPrefix, experimentID, filepath.Base(filename))

	// 检查对象是否存在 (可选，但推荐)
	// SignURL 本身不检查对象是否存在，它只是签名一个访问该对象的请求
	// 如果对象不存在，用户访问签名URL时会收到OSS的404错误
	isExist, err := bucket.IsObjectExist(objectKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error checking object existence"})
		return
	}
	if !isExist {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found in OSS"})
		return
	}

	// 生成带签名的URL以下载文件
	// 第三个参数是过期时间（秒）
	signedURL, err := bucket.SignURL(objectKey, oss.HTTPGet, signedURLExpiry)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to sign URL: %v", err)})
		return
	}
	c.Redirect(http.StatusFound, signedURL)

}
