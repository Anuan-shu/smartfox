package models

import (
	"time"
)

// Experiment 实验模型
type Experiment struct {
	ID          string    `json:"experiment_id" gorm:"primaryKey;type:char(36)"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	FileURL     string    `json:"file_url,omitempty"`
	Permission  int       `json:"permission"`
	Deadline    time.Time `json:"deadline"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time
	Questions   []Question   `json:"questions" gorm:"foreignKey:ExperimentID"`
	Attachments []Attachment `json:"attachments" gorm:"foreignKey:ExperimentID"`
	Users       []User       `json:"student_ids" gorm:"many2many:experiment_users;foreignKey:ID;joinForeignKey:ExperimentID;References:ID;JoinReferences:UserID"`
}

// Question 题目模型
type Question struct {
	ID            string `json:"id" gorm:"primaryKey;type:char(36)"`
	ExperimentID  string `json:"experiment_id"`
	Type          string `json:"type"` // choice, blank, code
	Content       string `json:"content"`
	Options       string `json:"options,omitempty" gorm:"type:text"` // JSON 字符串存储选择题选项
	CorrectAnswer string `json:"correct_answer,omitempty"`
	Score         int    `json:"score"`

	ImageURL    string `json:"image_url,omitempty"`
	TestCases   string `json:"test_cases,omitempty"` // JSON 字符串存储代码题的测试用例
	Explanation string `json:"explanation,omitempty"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// Attachment 附件模型
type Attachment struct {
	ID           uint   `json:"id" gorm:"primaryKey"`
	ExperimentID string `json:"experiment_id"`
	Name         string `json:"name"`
	URL          string `json:"url"`
	CreatedAt    time.Time
	UpdatedAt    time.Time
}
