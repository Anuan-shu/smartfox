package models

import (
	"gorm.io/gorm"
)

type User struct {
	gorm.Model
	Name      string `gorm:"varchar(20);not null"`
	Telephone string `gorm:"varchar(20);not null;unique"`
	Password  string `gorm:"size:255;not null"`
	Role      string `gorm:"varchar(20);not null"`
	AvatarUrl string `gorm:"varchar(255);default:'https://www.gravatar.com/avatar/"`
	Email     string `gorm:"varchar(255);default:''"`
}

type Group struct {
	gorm.Model
	Name    string `gorm:"varchar(20);not null"`
	Student []User `gorm:"many2many:group_students;foreignKey:ID;joinForeignKey:GroupID;References:ID;JoinReferences:UserID"`
}
