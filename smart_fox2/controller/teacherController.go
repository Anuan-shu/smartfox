package controller

import (
	"encoding/json"
	"errors"
	"fmt"
	"lh/common"
	"lh/global"
	"lh/models"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/aliyun/aliyun-oss-go-sdk/oss"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CustomTime time.Time

func (ct *CustomTime) UnmarshalJSON(b []byte) error {
	s := strings.Trim(string(b), `"`)
	layouts := []string{
		"2006-01-02T15:04",
		time.RFC3339,
		"2006-01-02 15:04",
		"2006-01-02",
	}
	var parsed time.Time
	var err error
	for _, layout := range layouts {
		parsed, err = time.Parse(layout, s)
		if err == nil {
			*ct = CustomTime(parsed)
			return nil
		}
	}
	return fmt.Errorf("invalid time format: %s", s)
}

func (ct CustomTime) Time() time.Time {
	return time.Time(ct)
}

// GetStudentList 获取学生列表
func GetStudentList(c *gin.Context) {
	db := global.DB
	var students []models.User
	if err := db.Model(&models.User{}).
		Where("Role = ?", "student").Find(&students).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "数据库查询失败",
		})
		return
	}
	studentResponse := make([]string, len(students))
	for i, student := range students {
		studentResponse[i] = strconv.FormatUint(uint64(student.ID), 10)
	}
	c.JSON(http.StatusOK, gin.H{
		"student_ids": studentResponse,
	})
}

// GetStudentListWithGroup 获取带分组的学生列表
func GetStudentListWithGroup(c *gin.Context) {
	db := common.GetDB()

	// 解析分页参数
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset := (page - 1) * limit
	query := db.Model(&models.User{}).Where("Role = ?", "student")
	var students []models.User
	var total int64
	query.Count(&total)
	if err := query.Order("created_at DESC").
		Offset(offset).
		Limit(limit).
		Find(&students).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "数据库查询失败",
		})
		return
	}
	studentIDs := make([]uint, len(students))
	for i, stu := range students {
		studentIDs[i] = stu.ID
	}
	// 查询学生与小组的关联关系
	type GroupStudent struct {
		UserID  uint
		GroupID uint
	}
	var relations []GroupStudent

	db.Table("group_students").
		Select("user_id, group_id").
		Where("user_id IN ?", studentIDs).
		Scan(&relations)

	// 构建学生ID到小组ID列表的映射
	groupMap := make(map[uint][]string)
	for _, r := range relations {
		groupIDStr := strconv.FormatUint(uint64(r.GroupID), 10)
		groupMap[r.UserID] = append(groupMap[r.UserID], groupIDStr)
	}
	response := make([]gin.H, len(students))
	for i, stu := range students {
		groupIDs, exists := groupMap[stu.ID]
		if !exists {
			groupIDs = []string{} // 确保返回空数组而不是null
		}
		response[i] = gin.H{
			"user_id":    stu.ID,
			"username":   stu.Name,
			"telephone":  stu.Telephone,
			"email":      stu.Email,
			"role":       stu.Role,
			"group_ids":  groupIDs,
			"created_at": stu.CreatedAt,
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"data": response,
		"pagination": gin.H{
			"page":  page,
			"limit": limit,
			"total": total,
		},
		"message": "学生列表获取成功",
	})
}

// CreateStudentGroup 创建学生分组
func CreateStudentGroup(c *gin.Context) {
	// 创建分组的请求结构体
	var req struct {
		GroupName  string   `json:"group_name" binding:"required"`
		StudentIDs []string `json:"student_ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "请求参数错误: " + err.Error(),
		})
		return
	}
	db := global.DB
	studentIDs := make([]uint, 0, len(req.StudentIDs))
	for _, idStr := range req.StudentIDs {
		id, err := strconv.ParseUint(idStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    400,
				"message": "无效的学生ID: " + idStr,
			})
			return
		}
		studentIDs = append(studentIDs, uint(id))
	}
	// 验证所有学生是否存在且角色是学生
	var studentCount int64
	if err := db.Model(&models.User{}).
		Where("id IN ? AND role = ?", studentIDs, "student").
		Count(&studentCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "数据库查询失败",
		})
		return
	}

	if int(studentCount) != len(studentIDs) {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "部分学生不存在或不是学生角色",
		})
		return
	}
	// 创建分组
	newGroup := models.Group{
		Name: req.GroupName,
	}

	// 使用事务确保数据一致性
	err := db.Transaction(func(tx *gorm.DB) error {
		// 创建分组记录
		if err := tx.Create(&newGroup).Error; err != nil {
			return err
		}

		// 准备关联关系
		association := tx.Model(&newGroup).Association("Student")
		if err := association.Error; err != nil {
			return err
		}

		// 添加学生到分组
		var students []models.User
		if err := tx.Find(&students, studentIDs).Error; err != nil {
			return err
		}

		if err := association.Append(students); err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "创建分组失败: " + err.Error(),
		})
		return
	}
	// 创建分组的响应结构体
	var GroupResponse struct {
		GroupID    string   `json:"group_id"`
		GroupName  string   `json:"group_name"`
		StudentIDs []string `json:"student_ids"`
	}
	GroupResponse.GroupID = strconv.FormatUint(uint64(newGroup.ID), 10)
	GroupResponse.GroupName = newGroup.Name
	GroupResponse.StudentIDs = req.StudentIDs
	c.JSON(http.StatusCreated, gin.H{
		"code":    201,
		"data":    GroupResponse,
		"message": "创建学生分组成功",
	})
}

// GetStudentGroup 获取分组列表
func GetStudentGroup(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset := (page - 1) * limit

	db := global.DB

	// 查询分组总数
	var total int64
	db.Model(&models.Group{}).Count(&total)

	// 查询分组数据
	var groups []models.Group
	result := db.Offset(offset).Limit(limit).Find(&groups)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "数据库查询失败",
		})
		return
	}

	// 收集分组ID
	groupIDs := make([]uint, len(groups))
	for i, group := range groups {
		groupIDs[i] = group.ID
	}

	// 查询分组与学生的关联关系
	type GroupStudent struct {
		GroupID uint
		UserID  uint
	}
	var relations []GroupStudent

	if len(groupIDs) > 0 {
		db.Table("group_students").
			Select("group_id, user_id").
			Where("group_id IN ?", groupIDs).
			Scan(&relations)
	}

	// 构建分组ID到学生ID列表的映射
	groupStudentMap := make(map[uint][]string)
	for _, r := range relations {
		studentID := strconv.FormatUint(uint64(r.UserID), 10)
		groupStudentMap[r.GroupID] = append(groupStudentMap[r.GroupID], studentID)
	}
	// 分组响应结构体
	type GroupResponse struct {
		GroupID      string   `json:"group_id"`
		GroupName    string   `json:"group_name"`
		StudentCount int      `json:"student_count"`
		StudentIDs   []string `json:"student_ids"`
	}
	response := make([]GroupResponse, len(groups))
	for i, group := range groups {
		studentIDs, exists := groupStudentMap[group.ID]
		if !exists {
			studentIDs = []string{} // 确保返回空数组而不是null
		}

		response[i] = GroupResponse{
			GroupID:      strconv.FormatUint(uint64(group.ID), 10),
			GroupName:    group.Name,
			StudentCount: len(studentIDs),
			StudentIDs:   studentIDs,
		}
	}

	// 返回结果
	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"data": response,
		"pagination": gin.H{
			"page":  page,
			"limit": limit,
			"total": total,
		},
		"message": "分组列表获取成功",
	})
}

// UpdateStudentGroup 更新分组情况
func UpdateStudentGroup(c *gin.Context) {
	var req struct {
		GroupName  string   `json:"group_name"`
		StudentIDs []string `json:"student_ids"`
	}
	db := global.DB
	groupIDstr := c.Param("group_id")
	groupID := common.StrToUint(groupIDstr)
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var group models.Group
	if err := db.First(&group, groupID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "分组不存在"})
		return
	}
	if req.GroupName == "" && req.StudentIDs == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "至少提供一个更新字段(group_name 或 student_ids)",
		})
		return
	}
	err := db.Transaction(func(tx *gorm.DB) error {
		// 更新分组名称（如果提供）
		if req.GroupName != "" {
			group.Name = req.GroupName
			if err := tx.Model(&group).Update("name", req.GroupName).Error; err != nil {
				return err
			}
		}

		// 更新学生列表（如果提供）
		if req.StudentIDs != nil {
			// 将学生ID从字符串转换为uint
			studentIDs := make([]uint, 0, len(req.StudentIDs))
			for _, idStr := range req.StudentIDs {
				id, err := strconv.ParseUint(idStr, 10, 64)
				if err != nil {
					return err
				}
				studentIDs = append(studentIDs, uint(id))
			}

			// 验证所有学生是否存在且角色是学生
			var studentCount int64
			if err := tx.Model(&models.User{}).
				Where("id IN ? AND role = ?", studentIDs, "student").
				Count(&studentCount).Error; err != nil {
				return err
			}

			if int(studentCount) != len(studentIDs) {
				return gorm.ErrRecordNotFound
			}

			// 修正点1: 先清空关联
			if err := tx.Model(&group).Association("Student").Clear(); err != nil {
				return err
			}

			// 修正点2: 使用Append逐个添加学生
			for _, id := range studentIDs {
				if err := tx.Model(&group).Association("Student").Append(&models.User{Model: gorm.Model{ID: id}}); err != nil {
					return err
				}
			}
		}

		// 刷新分组对象以获取最新更新时间
		if err := tx.First(&group, group.ID).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    400,
				"message": "部分学生不存在或不是学生角色",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    500,
				"message": "更新分组失败: " + err.Error(),
			})
		}
		return
	}
	type UpdateGroupResponse struct {
		GroupID    string   `json:"group_id"`
		GroupName  string   `json:"group_name"`
		StudentIDs []string `json:"student_ids"`
		UpdatedAt  string   `json:"updated_at"`
	}
	// 构建响应
	response := UpdateGroupResponse{
		GroupID:    groupIDstr,
		GroupName:  group.Name,
		StudentIDs: req.StudentIDs,
		UpdatedAt:  group.UpdatedAt.Format(time.RFC3339),
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"data":    response,
		"message": "分组更新成功",
	})
}

// DeleteStudentGroup 删除学生分组
func DeleteStudentGroup(c *gin.Context) {
	// 从路径参数获取分组ID
	groupIDStr := c.Param("group_id")
	groupID, err := strconv.ParseUint(groupIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "无效的分组ID",
		})
		return
	}

	db := global.DB

	// 检查分组是否存在
	var group models.Group
	result := db.First(&group, groupID)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"code":    404,
				"message": "分组不存在",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    500,
				"message": "数据库查询失败",
			})
		}
		return
	}

	// 使用事务确保数据一致性
	err = db.Transaction(func(tx *gorm.DB) error {
		// 删除分组与学生之间的关联关系
		if err := tx.Model(&group).Association("Student").Clear(); err != nil {
			return err
		}

		// 删除分组（软删除）
		if err := tx.Delete(&group).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "删除分组失败: " + err.Error(),
		})
		return
	}

	// 返回成功响应
	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "分组删除成功",
	})
}

// TestCase 测试用例结构体
type TestCase struct {
	Input          interface{} `json:"input"`
	ExpectedOutput interface{} `json:"expected_output"`
}

// CreateExperiment 创建实验
func CreateExperiment(c *gin.Context) {

	// QuestionInput 题目输入结构体
	type QuestionInput struct {
		Type          string     `json:"type" binding:"required,oneof=choice blank code"`
		Content       string     `json:"content" binding:"required"`
		Options       []string   `json:"options" binding:"required_if=Type choice"`
		CorrectAnswer string     `json:"correct_answer" binding:"required_if=Type choice required_if=Type blank"`
		Score         int        `json:"score" binding:"required,gt=0"`
		ImageURL      string     `json:"image_url" binding:"omitempty"`
		Explanation   string     `json:"explanation" binding:"omitempty"`
		TestCases     []TestCase `json:"test_cases" binding:"required_if=Type code"`
	}
	// CreateExperimentRequest 请求结构体
	type CreateExperimentRequest struct {
		Title       string          `json:"title" binding:"required"`
		Description string          `json:"description"`
		Permission  *int            `json:"permission" binding:"required,oneof=1 0"`
		Deadline    time.Time       `json:"deadline" binding:"required"`
		StudentIDs  []string        `json:"student_ids" binding:"required"`
		Questions   []QuestionInput `json:"questions" binding:"required,dive"`
	}
	// ExperimentResponseData 响应数据
	type ExperimentResponseData struct {
		ExperimentID string    `json:"experiment_id"`
		Title        string    `json:"title"`
		CreatedAt    time.Time `json:"created_at"`
	}
	// CreateExperimentResponse 响应结构体
	type CreateExperimentResponse struct {
		Status  string                 `json:"status"`
		Data    ExperimentResponseData `json:"data,omitempty"`
		Message string                 `json:"message,omitempty"`
	}

	db := global.DB
	var req CreateExperimentRequest
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, CreateExperimentResponse{
			Status:  "error",
			Message: fmt.Sprintf("Invalid request data: %s. Request Method: %s, Request URL: %s, Request Body: %s", err.Error(), c.Request.Method, c.Request.URL.String(), c.Request.Body),
		})
		return
	}
	// 验证截止日期
	if req.Deadline.Before(time.Now()) {
		c.JSON(http.StatusBadRequest, CreateExperimentResponse{
			Status:  "error",
			Message: "截止日期必须在未来",
		})
		return
	}
	experimentID := uuid.New().String()
	// 处理附件上传
	form, err := c.MultipartForm()
	var attachments []models.Attachment
	if err == nil && form.File["attachments"] != nil {
		for _, file := range form.File["attachments"] {
			// 生成唯一文件名
			fileExt := filepath.Ext(file.Filename)
			fileName := uuid.New().String() + fileExt
			filePath := filepath.Join("uploads", fileName)

			// 确保上传目录存在
			if err := os.MkdirAll("uploads", 0755); err != nil {
				c.JSON(http.StatusInternalServerError, CreateExperimentResponse{
					Status:  "error",
					Message: "无法创建上传目录",
				})
				return
			}
			// 保存文件
			if err := c.SaveUploadedFile(file, filePath); err != nil {
				c.JSON(http.StatusInternalServerError, CreateExperimentResponse{
					Status:  "error",
					Message: "无法保存附件",
				})
				return
			}
			// 生成附件 URL（假设服务器地址为 localhost:8080）
			fileURL := fmt.Sprintf("/uploads/%s", fileName)
			attachments = append(attachments, models.Attachment{
				ExperimentID: experimentID,
				Name:         file.Filename,
				URL:          fileURL,
			})
		}
	}

	// 创建实验
	experiment := models.Experiment{
		ID:          experimentID,
		Title:       req.Title,
		Permission:  *req.Permission,
		Description: req.Description,
		Deadline:    req.Deadline,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		Attachments: attachments,
	}
	// 处理题目
	for _, q := range req.Questions {
		question := models.Question{
			ID:           uuid.NewString(),
			ExperimentID: experimentID,
			Type:         q.Type,
			Content:      q.Content,
			Score:        q.Score,
			ImageURL:     q.ImageURL,
			Explanation:  q.Explanation,
			CreatedAt:    time.Now(),
			UpdatedAt:    time.Now(),
		}
		if q.Type == "choice" {
			// 将选项序列化为 JSON 字符串
			optionsJSON, _ := json.Marshal(q.Options)
			question.Options = string(optionsJSON)
			question.CorrectAnswer = q.CorrectAnswer
		}
		if q.Type == "blank" {
			question.CorrectAnswer = q.CorrectAnswer
		}
		if q.Type == "code" && len(q.TestCases) > 0 {
			testCasesJSON, _ := json.Marshal(q.TestCases)
			question.TestCases = string(testCasesJSON)
		}
		experiment.Questions = append(experiment.Questions, question)
	}
	var users []models.User
	for _, studentID := range req.StudentIDs {
		var user models.User
		if err := db.First(&user, "id = ?", common.StrToUint(studentID)).Error; err != nil {
			c.JSON(http.StatusBadRequest, CreateExperimentResponse{
				Status:  "error",
				Message: fmt.Sprintf("找不到学生ID: %s", studentID),
			})
			return
		}
		users = append(users, user)
	}
	experiment.Users = users
	// 保存到数据库
	if err := db.Create(&experiment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, CreateExperimentResponse{
			Status:  "error",
			Message: err.Error(),
		})
		return
	}

	//下发通知
	notification := models.Notification{
		ID:           uuid.New().String(),
		Title:        fmt.Sprintf("新实验发布：%s", experiment.Title),
		Content:      fmt.Sprintf("您有一个新的实验《%s》，请在 %s 前完成提交。", experiment.Title, experiment.Deadline.Format("2006-01-02 15:04")),
		ExperimentID: experiment.ID,
		IsImportant:  false,
		CreatedAt:    time.Now(),
		Users:        users, // 直接复用前面查到的学生
	}

	if err := db.Create(&notification).Error; err != nil {
		fmt.Printf("创建通知失败: %v\n", err)
	}

	// 返回成功响应
	c.JSON(http.StatusCreated, CreateExperimentResponse{
		Status: "success",
		Data: ExperimentResponseData{
			ExperimentID: experiment.ID,
			Title:        experiment.Title,
			CreatedAt:    experiment.CreatedAt,
		},
	})

}

// 获取实验列表
func GetExperiments_Teacher(c *gin.Context) {
	db := common.GetDB()

	// 解析分页参数
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	status := c.DefaultQuery("status", "all")

	offset := (page - 1) * limit
	query := db.Model(&models.Experiment{})

	// 状态筛选逻辑
	now := time.Now()
	switch status {
	case "active":
		query = query.Where("deadline > ?", now)
	case "expired":
		query = query.Where("deadline <= ?", now)
	}

	var experiments []models.Experiment
	var total int64
	query.Count(&total)

	// 获取分页数据
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

	// 构造响应数据
	response := make([]gin.H, len(experiments))
	for i, exp := range experiments {
		response[i] = gin.H{
			"experiment_id": exp.ID,
			"title":         exp.Title,
			"deadline":      exp.Deadline.Format(time.RFC3339),
			"created_at":    exp.CreatedAt.Format(time.RFC3339),
			"status":        getExperimentStatus(exp.Deadline),
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   response,
		"pagination": gin.H{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}

// 辅助函数：获取实验状态
func getExperimentStatus(deadline time.Time) string {
	if time.Now().Before(deadline) {
		return "active"
	}
	return "expired"
}

// 获取实验详情
func GetExperimentDetail_Teacher(c *gin.Context) {
	db := common.GetDB()
	experimentID := c.Param("experiment_id")

	var experiment models.Experiment
	result := db.Preload("Questions").
		Preload("Users").
		Where("ID = ?", experimentID).
		First(&experiment)

	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "实验不存在",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "数据库查询失败",
			})
		}
		return
	}
	// 新增：提取学生ID列表
	studentIDs := make([]string, len(experiment.Users))
	for i, user := range experiment.Users {

		studentIDs[i] = strconv.FormatUint(uint64(user.ID), 10)
	}
	// 处理题目数据
	questions := make([]gin.H, len(experiment.Questions))
	for i, q := range experiment.Questions {
		questionData := gin.H{
			"question_id": q.ID,
			"type":        q.Type,
			"content":     q.Content,
			"score":       q.Score,
			"image_url":   q.ImageURL,
			"explanation": q.Explanation,
		}

		// 处理不同类型题目特有字段
		switch q.Type {
		case "choice":
			questionData["options"] = common.ParseJSONArray(q.Options)
			fallthrough
		case "blank":
			questionData["correct_answer"] = q.CorrectAnswer
		case "code":
			var testCases []TestCase
			if err := json.Unmarshal([]byte(q.TestCases), &testCases); err == nil {
				questionData["test_cases"] = testCases
			}
		}

		questions[i] = questionData
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data": gin.H{
			"experiment_id": experiment.ID,
			"title":         experiment.Title,
			"description":   experiment.Description,
			"permission":    experiment.Permission,
			"student_ids":   studentIDs,
			"deadline":      experiment.Deadline.Format(time.RFC3339),
			"questions":     questions,
			"created_at":    experiment.CreatedAt.Format(time.RFC3339),
		},
	})
}

// 获取学生提交记录
func GetStudentSubmissions(c *gin.Context) {
	db := common.GetDB()
	experimentID := c.Param("experiment_id")
	studentID := common.StrToUint(c.Param("student_id"))
	var experiment models.Experiment

	result := db.Where("ID = ?", experimentID).
		First(&experiment)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "实验不存在",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "数据库查询失败",
			})
		}
		return
	}
	var student models.User
	result = db.Where("ID = ?", studentID).
		First(&student)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "学生不存在",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "数据库查询失败",
			})
		}
		return
	}
	// 准备响应数据结构
	type QuestionResult struct {
		QuestionID      string   `json:"question_id"`
		Type            string   `json:"type"`
		Content         string   `json:"content"`
		Options         []string `json:"options,omitempty"`
		Score           int      `json:"score"`
		StudentAnswer   string   `json:"student_answer,omitempty"`
		StudentCode     string   `json:"student_code,omitempty"`
		StudentLanguage string   `json:"student_language,omitempty"`
		Feedback        string   `json:"feedback,omitempty"`
	}
	var StudentSubmission struct {
		StudentID    string           `json:"student_id"`
		StudentName  string           `json:"student_name"`
		Status       string           `json:"status"`
		SubmissionID string           `json:"submission_id"`
		TotalScore   int              `json:"total_score"`
		SubmittedAt  time.Time        `json:"submitted_at"`
		Results      []QuestionResult `json:"results"`
	}
	StudentSubmission.StudentID = strconv.FormatUint(uint64(studentID), 10)
	StudentSubmission.StudentName = student.Name
	var results []QuestionResult
	// 获取学生最近一次实验提交
	var latestSubmission models.ExperimentSubmission
	if err := db.Where("experiment_id = ? AND student_id = ?", experimentID, studentID).
		First(&latestSubmission).Error; err != nil {
		// 学生没有提交记录，未开始
		StudentSubmission.Status = "not_started"
	} else if err := db.Where("experiment_id = ? AND student_id = ? AND status = ?", experimentID, studentID, "submitted").
		Order("submitted_at DESC").
		First(&latestSubmission).Error; err != nil {
		StudentSubmission.Status = "in_progress"
	} else {
		// 获取该次提交的所有题目提交
		StudentSubmission.Status = "submitted"
		var questionSubmissions []models.QuestionSubmission
		if err := db.Preload("Question").
			Where("submission_id = ?", latestSubmission.ID).
			Find(&questionSubmissions).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "获取题目提交失败",
			})
			return
		}

		// 处理题目提交结果
		for _, qs := range questionSubmissions {
			// 获取题目信息
			question := qs.Question
			if question.ID == "" {
				// 如果预加载失败，单独查询题目信息
				if err := db.Where("id = ?", qs.QuestionID).First(&question).Error; err != nil {
					continue
				}
			}

			// 解析选择题选项
			var options []string
			if question.Type == "choice" && question.Options != "" {
				if err := json.Unmarshal([]byte(question.Options), &options); err != nil {
					options = []string{}
				}
			}

			result := QuestionResult{
				QuestionID: question.ID,
				Type:       question.Type,
				Content:    question.Content,
				Score:      qs.Score,
				Feedback:   qs.Feedback,
			}

			// 根据题目类型设置不同字段
			if question.Type == "choice" {
				result.Options = options
				result.StudentAnswer = qs.Answer
			} else if question.Type == "blank" {
				result.StudentAnswer = qs.Answer
			} else if question.Type == "code" {
				result.StudentCode = qs.Code
				result.StudentLanguage = qs.Language
			}

			results = append(results, result)
		}
		StudentSubmission.SubmissionID = latestSubmission.ID
		StudentSubmission.TotalScore = latestSubmission.TotalScore
		StudentSubmission.SubmittedAt = latestSubmission.SubmittedAt

	}
	if len(results) == 0 {
		var nullResult QuestionResult
		results = append(results, nullResult)
	}
	StudentSubmission.Results = results
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   StudentSubmission,
	})
}

// UpdateExperiment 更新实验
func UpdateExperiment(c *gin.Context) {
	type UpdateQuestionInput struct {
		QuestionID    string     `json:"question_id" binding:"omitempty,required_if=Type ''"`
		Type          string     `json:"type" binding:"omitempty,oneof=choice blank code"`
		Content       string     `json:"content" binding:"omitempty,min=1"`
		Options       []string   `json:"options" binding:"omitempty,required_if=Type choice"`
		CorrectAnswer string     `json:"correct_answer" binding:"omitempty,required_if=Type choice required_if=Type blank"`
		Score         int        `json:"score" binding:"omitempty,gt=0"`
		ImageURL      string     `json:"image_url" binding:"omitempty"`
		Explanation   string     `json:"explanation" binding:"omitempty"`
		TestCases     []TestCase `json:"test_cases" binding:"omitempty,required_if=Type code"`
	}
	type UpdateExperimentRequest struct {
		Title           string                `json:"title" binding:"omitempty,min=1"`
		Description     string                `json:"description" binding:"omitempty"`
		Deadline        time.Time             `json:"deadline" binding:"omitempty"`
		Questions       []UpdateQuestionInput `json:"questions" binding:"omitempty,dive"`
		RemoveQuestions []string              `json:"remove_questions" binding:"omitempty"`
		Permission      *int                  `json:"permission" binding:"omitempty,oneof=0 1"`
	}
	type UpdateExperimentResponse struct {
		Status       string    `json:"status"`
		ExperimentID string    `json:"experiment_id,omitempty"`
		Title        string    `json:"title,omitempty"`
		UpdatedAt    time.Time `json:"updated_at,omitempty"`
		Message      string    `json:"message,omitempty"`
	}

	db := global.DB
	experimentID := c.Param("experiment_id")

	// 检查实验是否存在
	var experiment models.Experiment
	if err := db.Preload("Questions").Preload("Attachments").
		Where("id = ?", experimentID).First(&experiment).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UpdateExperimentResponse{
				Status:  "error",
				Message: "Experiment not found",
			})
		} else {
			c.JSON(http.StatusInternalServerError, UpdateExperimentResponse{
				Status:  "error",
				Message: "Failed to fetch experiment",
			})
		}
		return
	}

	var req UpdateExperimentRequest
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, UpdateExperimentResponse{
			Status:  "error",
			Message: "Invalid request data: " + err.Error(),
		})
		return
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		// 更新实验基本信息
		if req.Title != "" {
			experiment.Title = req.Title
		}
		if req.Description != "" {
			experiment.Description = req.Description
		}
		if req.Permission != nil {
			experiment.Permission = *req.Permission
		}
		if !req.Deadline.IsZero() {
			if req.Deadline.Before(time.Now()) {
				return errors.New("deadline must be in the future")
			}
			experiment.Deadline = req.Deadline
		}

		// 处理附件上传
		form, err := c.MultipartForm()
		var newAttachments []models.Attachment
		if err == nil && form.File["attachments"] != nil {
			for _, file := range form.File["attachments"] {
				fileExt := filepath.Ext(file.Filename)
				fileName := uuid.New().String() + fileExt
				filePath := filepath.Join("uploads", fileName)

				if err := os.MkdirAll("uploads", 0755); err != nil {
					return err
				}
				if err := c.SaveUploadedFile(file, filePath); err != nil {
					return err
				}
				fileURL := fmt.Sprintf("/uploads/%s", fileName)
				newAttachments = append(newAttachments, models.Attachment{
					ExperimentID: experimentID,
					Name:         file.Filename,
					URL:          fileURL,
					CreatedAt:    time.Now(),
					UpdatedAt:    time.Now(),
				})
			}
			experiment.Attachments = append(experiment.Attachments, newAttachments...)
		}

		// 映射已存在题目
		existingQuestions := make(map[string]*models.Question)
		for i, q := range experiment.Questions {
			existingQuestions[q.ID] = &experiment.Questions[i]
		}

		//var newQuestions []models.Question
		for _, q := range req.Questions {
			if q.QuestionID != "" {
				// 更新现有题目
				if question, exists := existingQuestions[q.QuestionID]; exists {
					updated := false

					if q.Content != "" {
						question.Content = q.Content
						updated = true
					}
					if q.CorrectAnswer != "" {
						question.CorrectAnswer = q.CorrectAnswer
						updated = true
					}
					if q.Score > 0 {
						question.Score = q.Score
						updated = true
					}
					if q.Type != "" {
						question.Type = q.Type
						updated = true
					}
					if q.ImageURL != "" {
						question.ImageURL = q.ImageURL
						updated = true
					}
					if q.Explanation != "" {
						question.Explanation = q.Explanation
						updated = true
					}
					if len(q.Options) > 0 {
						optionsJSON, err := json.Marshal(q.Options)
						if err != nil {
							c.JSON(http.StatusInternalServerError, UpdateExperimentResponse{
								Status:  "error",
								Message: "Unable to serialize options",
							})
							return err
						}
						question.Options = string(optionsJSON)
						updated = true
					}
					if len(q.TestCases) > 0 {
						testCasesJSON, err := json.Marshal(q.TestCases)
						if err != nil {
							c.JSON(http.StatusInternalServerError, UpdateExperimentResponse{
								Status:  "error",
								Message: "Unable to serialize test cases",
							})
							return err
						}
						question.TestCases = string(testCasesJSON)
						updated = true
					}
					// 显式保存更改到数据库
					if updated {
						if err := tx.Save(question).Error; err != nil {
							c.JSON(http.StatusInternalServerError, UpdateExperimentResponse{
								Status:  "error",
								Message: "Failed to update question " + question.ID,
							})
							return err
						}
					}
				} else {
					return fmt.Errorf("question %s not found", q.QuestionID)
				}
			} else {
				// 新增题目
				newQ := models.Question{
					ID:           uuid.NewString(),
					ExperimentID: experimentID,
					Type:         q.Type,
					Content:      q.Content,
					Score:        q.Score,
					ImageURL:     q.ImageURL,
					Explanation:  q.Explanation,
				}
				if q.Type == "choice" {
					optionsJSON, err := json.Marshal(q.Options)
					if err != nil {
						return fmt.Errorf("failed to serialize options: %w", err)
					}
					newQ.Options = string(optionsJSON)
					newQ.CorrectAnswer = q.CorrectAnswer
				}
				if q.Type == "blank" {
					newQ.CorrectAnswer = q.CorrectAnswer
				}
				if q.Type == "code" && len(q.TestCases) > 0 {
					testCasesJSON, _ := json.Marshal(q.TestCases)
					newQ.TestCases = string(testCasesJSON)
				}
				if err := tx.Create(&newQ).Error; err != nil {
					return fmt.Errorf("failed to create new question: %w", err)
				}
				experiment.Questions = append(experiment.Questions, newQ)
			}
		}
		// 删除题目，并从 experiment.Questions 中移除
		var remainingQuestions []models.Question
		for _, question := range experiment.Questions {
			shouldDelete := false
			for _, qID := range req.RemoveQuestions {
				if question.ID == qID {
					shouldDelete = true

					// 1. 先删除与该题目相关的所有提交记录
					if err := tx.Where("question_id = ?", qID).Delete(&models.QuestionSubmission{}).Error; err != nil {
						return fmt.Errorf("failed to delete question submissions for question %s: %w", qID, err)
					}

					// 2. 再删除题目本身
					if err := tx.Delete(&models.Question{}, "id = ? AND experiment_id = ?", qID, experimentID).Error; err != nil {
						return fmt.Errorf("failed to delete question %s: %w", qID, err)
					}

					break
				}
			}
			if !shouldDelete {
				remainingQuestions = append(remainingQuestions, question)
			}
		}
		experiment.Questions = remainingQuestions
		experiment.UpdatedAt = time.Now()
		// 保存实验本体
		if err := tx.Save(&experiment).Error; err != nil {
			return fmt.Errorf("failed to save experiment: %w", err)
		}
		return nil
	})
	//更新experiment_submissions表中对应实验状态为in_progress
	db.Model(&models.ExperimentSubmission{}).Where("experiment_id = ?", experimentID).Update("status", "in_progress")
	if err != nil {
		c.JSON(http.StatusBadRequest, UpdateExperimentResponse{
			Status:  "error",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, UpdateExperimentResponse{
		Status:       "success",
		ExperimentID: experiment.ID,
		Title:        experiment.Title,
		UpdatedAt:    experiment.UpdatedAt,
	})
}

// DeleteExperiment 删除实验及关联数据
func DeleteExperiment(c *gin.Context) {
	db := common.GetDB()

	// 验证用户角色
	user, _ := c.Get("user")
	if user.(models.User).Role != "teacher" {
		c.JSON(http.StatusForbidden, gin.H{
			"status":  "error",
			"message": "仅允许教师操作",
		})
		return
	}

	// 获取实验ID
	experimentID := c.Param("experiment_id")

	// 查询实验是否存在
	var experiment models.Experiment
	result := db.Preload("Questions").Preload("Attachments").First(&experiment, "id = ?", experimentID)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Experiment not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "数据库查询失败",
		})
		return
	}
	tx := db.Begin()
	// 0. 删除关联表中的记录（新增这一步）
	if err := tx.Table("experiment_users").
		Where("experiment_id = ?", experimentID).
		Delete(nil).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "删除实验用户关联失败",
		})
		return
	}
	// 1. 删除关联的题目提交记录
	if err := tx.Where("submission_id IN (SELECT id FROM experiment_submissions WHERE experiment_id = ?)", experimentID).
		Delete(&models.QuestionSubmission{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "删除题目提交记录失败",
		})
		return
	}
	// 2. 删除关联的实验提交记录
	if err := tx.Where("experiment_id = ?", experimentID).
		Delete(&models.ExperimentSubmission{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "删除实验提交记录失败",
		})
		return
	}

	// 3. 删除关联题目
	if err := tx.Where("experiment_id = ?", experimentID).Delete(&models.Question{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "删除题目失败",
		})
		return
	}

	// 4. 删除关联附件
	if err := tx.Where("experiment_id = ?", experimentID).Delete(&models.Attachment{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "删除附件失败",
		})
		return
	}

	// 5. 删除实验本身
	if err := tx.Delete(&experiment).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "删除实验失败",
		})
		return
	}

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Experiment deleted",
	})
}

// 下发实验通知
func CreateNotification(c *gin.Context) {
	var req struct {
		Title        string `json:"title" binding:"required"`
		Content      string `json:"content" binding:"required"`
		ExperimentID string `json:"experiment_id"`
		IsImportant  bool   `json:"is_important"`
		Users        []uint `json:"users"` // 用户 ID 列表
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// ✅ 先查找用户（不是先赋值到 notification）
	var students []models.User
	if len(req.Users) > 0 {
		if err := global.DB.Where("id IN ?", req.Users).Find(&students).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch target students"})
			return
		}
	}

	// ✅ 再构造 notification，赋值 Users 为 []User
	notification := models.Notification{
		ID:           uuid.New().String(),
		Title:        req.Title,
		Content:      req.Content,
		ExperimentID: req.ExperimentID,
		IsImportant:  req.IsImportant,
		CreatedAt:    time.Now(),
		Users:        students, // ✅ 正确类型
	}

	// ✅ 此时才保存到数据库
	if err := global.DB.Create(&notification).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create notification"})
		return
	}

	// 控制台打印通知
	for _, student := range students {
		fmt.Printf("通知学生[%s]: 新公告《%s》：%s\n", student.Name, notification.Title, notification.Content)
	}

	c.JSON(http.StatusCreated, notification)
}

func GetTeacherNotifications(c *gin.Context) {
	// 解析查询参数
	pageStr := c.DefaultQuery("page", "1")
	limitStr := c.DefaultQuery("limit", "10")
	experimentID := c.Query("experiment_id")
	isImportantStr := c.Query("is_important")
	createdAfter := c.Query("created_after")

	page, err := strconv.Atoi(pageStr)
	if err != nil || page <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的页码"})
		return
	}
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的每页数量"})
		return
	}

	// 构建查询
	query := global.DB.Model(&models.Notification{}).Order("created_at DESC")

	// 筛选条件
	if experimentID != "" {
		query = query.Where("experiment_id = ?", experimentID)
	}
	if isImportantStr != "" {
		isImportant, err := strconv.ParseBool(isImportantStr)
		if err == nil {
			query = query.Where("is_important = ?", isImportant)
		}
	}
	if createdAfter != "" {
		if t, err := time.Parse(time.RFC3339, createdAfter); err == nil {
			query = query.Where("created_at >= ?", t)
		}
	}

	// 获取总数
	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法获取通知总数"})
		return
	}

	// 分页查询
	var notifications []models.Notification
	if err := query.
		Offset((page - 1) * limit).
		Limit(limit).
		Find(&notifications).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法获取通知列表"})
		return
	}

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

// OSS 配置 - 建议从环境变量或配置文件读取
var (
	ossEndpoint        string
	ossAccessKeyID     string
	ossAccessKeySecret string
	ossBucketName      string
	ossClient          *oss.Client
	bucket             *oss.Bucket
)

const (
	// OSS中实验文件的前缀
	ossExperimentPrefix = "experiment_uploads/"
	// 签名URL的有效时间（秒）
	signedURLExpiry = 60 * 5 // 5 分钟
)

func InitOSS() {
	//// 从环境变量读取配置
	//ossEndpoint = os.Getenv("OSS_ENDPOINT")
	//ossAccessKeyID = os.Getenv("OSS_ACCESS_KEY_ID")
	//ossAccessKeySecret = os.Getenv("OSS_ACCESS_KEY_SECRET")
	//ossBucketName = os.Getenv("OSS_BUCKET_NAME")
	// 直接在代码中设置配置
	ossEndpoint = "oss-cn-beijing.aliyuncs.com"
	ossAccessKeyID = "LTAI5tQMwimSzeLg5g3Bhtz8"
	ossAccessKeySecret = "oNInCEryrUNOMFcd9wgNDhpc54IXCP"
	ossBucketName = "wechat921"
	// +++ 添加这些日志打印 +++
	log.Println("--- OSS Configuration ---")
	log.Printf("Read OSS_ENDPOINT: [%s]", ossEndpoint)
	log.Printf("Read OSS_BUCKET_NAME: [%s]", ossBucketName)
	// 对于 AccessKey ID 和 Secret，请谨慎打印，确保不在生产环境日志中暴露
	// log.Printf("Read OSS_ACCESS_KEY_ID: [%s]", ossAccessKeyID)
	log.Println("-------------------------")
	// 简单的校验
	if ossEndpoint == "" || ossAccessKeyID == "" || ossAccessKeySecret == "" || ossBucketName == "" {
		log.Fatal("OSS_ENDPOINT, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, and OSS_BUCKET_NAME environment variables must be set.")
	}

	var err error
	// 创建OSSClient实例。
	ossClient, err = oss.New(ossEndpoint, ossAccessKeyID, ossAccessKeySecret)
	if err != nil {
		log.Fatalf("Failed to create OSS client: %v", err)
	}

	// 获取存储空间。
	bucket, err = ossClient.Bucket(ossBucketName)
	if err != nil {
		log.Fatalf("Failed to get OSS bucket: %v", err)
	}
	log.Println("OSS client initialized successfully.")
}

func HandleTeacherUpload(c *gin.Context) {
	experimentID := c.Param("experiment_id")
	if experimentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Experiment ID is required"})
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Error getting file: %v", err)})
		return
	}

	// 打开上传的文件
	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to open uploaded file: %v", err)})
		return
	}
	defer src.Close()

	// 构建 OSS 中的对象键 (Object Key)
	// 使用 filepath.Base 获取安全的文件名
	filename := filepath.Base(file.Filename)
	objectKey := fmt.Sprintf("%s%s/%s", ossExperimentPrefix, experimentID, filename)

	// 上传文件流。
	err = bucket.PutObject(objectKey, src)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to upload file to OSS: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "File uploaded successfully to OSS",
		"experimentId": experimentID,
		"filename":     filename,
		"objectKey":    objectKey,
	})
}

// 处理教师删除指定实验下的文件
func TeacherDeleteFile(c *gin.Context) {
	experimentID := c.Param("experiment_id")
	// Gin 会自动 URL 解码路径参数
	filenameFromParam := c.Param("filename")

	if experimentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Experiment ID is required"})
		return
	}
	if filenameFromParam == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Filename is required"})
		return
	}

	// 使用从参数中获取的、已解码的文件名
	// filepath.Base() 只是为了安全，去除路径部分
	filenameForOSS := filepath.Base(filenameFromParam)

	// 构建 OSS 中的对象键 (Object Key)
	objectKey := fmt.Sprintf("%s%s/%s", ossExperimentPrefix, experimentID, filenameForOSS)
	log.Printf("Attempting to delete OSS object key: %s (original filename: %s)", objectKey, filenameFromParam)

	// 检查对象是否存在 (可选，但删除不存在的对象 OSS 不会报错，所以可以省略这一步以减少API调用)
	isExist, err := bucket.IsObjectExist(objectKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error checking object existence before deletion"})
		log.Printf("Error checking if object %s exists: %v", objectKey, err)
		return
	}
	if !isExist {
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("File '%s' not found in experiment '%s'. Nothing to delete.", filenameForOSS, experimentID)})
		log.Printf("Object %s does not exist, nothing to delete.", objectKey)
		return
	}

	// 删除 OSS 中的对象
	// 如果对象不存在，DeleteObject 不会返回错误
	errr := bucket.DeleteObject(objectKey)
	if errr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to delete file '%s' from OSS: %v", filenameForOSS, err)})
		log.Printf("Failed to delete object %s from OSS: %v", objectKey, err)
		return
	}

	log.Printf("Successfully deleted object %s from OSS.", objectKey)
	c.JSON(http.StatusOK, gin.H{
		"message":      fmt.Sprintf("File '%s' deleted successfully from experiment '%s'", filenameForOSS, experimentID),
		"experimentId": experimentID,
		"filename":     filenameForOSS,
		"objectKey":    objectKey,
	})
}
