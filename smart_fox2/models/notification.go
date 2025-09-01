package models

import "time"

type Notification struct {
	ID           string    `json:"id" gorm:"primaryKey"`
	Title        string    `json:"title"`
	Content      string    `json:"content"`
	ExperimentID string    `json:"experiment_id"` // 可选关联
	CreatedAt    time.Time `json:"created_at"`
	IsImportant  bool      `json:"is_important"` // 是否为公告（高亮）
	//Users        []string  `json:"users" gorm:"type:json"`
	Users []User `gorm:"many2many:notification_users"`
}

// 学生是否已读公告
// type UserNotification struct {
// 	ID             string    `gorm:"primaryKey"`
// 	UserID         string
// 	NotificationID string
// 	IsRead         bool
// 	CreatedAt      time.Time
// }
