package models

import "time"

// ExperimentSubmission 模型
type ExperimentSubmission struct {
	ID           string     `json:"submission_id" gorm:"primaryKey;type:char(36)"`
	ExperimentID string     `json:"experiment_id" gorm:"type:char(36);index"`
	Experiment   Experiment `json:"experiment" gorm:"foreignKey:ExperimentID"`

	StudentID uint `json:"student_id" gorm:"index"`
	Student   User `json:"student" gorm:"foreignKey:StudentID"`

	SubmittedAt time.Time `json:"submitted_at"`
	TotalScore  int       `json:"total_score"`
	Status      string    `json:"status" gorm:"type:varchar(20);"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// QuestionSubmission 模型
type QuestionSubmission struct {
	ID string `json:"question_submission_id" gorm:"primaryKey;type:char(36)"`

	SubmissionID         string               `json:"submission_id" gorm:"type:char(36);index"`
	ExperimentSubmission ExperimentSubmission `json:"experiment_submission" gorm:"foreignKey:SubmissionID"`

	QuestionID   string    `json:"question_id" gorm:"type:char(36);index"`
	Question     Question  `json:"question" gorm:"foreignKey:QuestionID"`
	Type         string    `json:"type" gorm:"type:text"`
	PerfectScore int       `json:"PerfectScore" gorm:"default:0"`
	Answer       string    `json:"answer" gorm:"type:text"`
	Code         string    `json:"code" gorm:"type:text"`
	Language     string    `json:"Language" gorm:"type:text"` //only for code
	Score        int       `json:"score" gorm:"default:0"`
	Feedback     string    `json:"feedback" gorm:"type:text"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
