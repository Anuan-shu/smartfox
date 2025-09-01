package common

import (
	"encoding/json"
	"lh/global"
	"strconv"

	"gorm.io/gorm"
)

func GetDB() *gorm.DB {
	return global.DB
}

// 解析JSON数组（用于选择题选项）
func ParseJSONArray(data string) []string {
	var options []string
	if err := json.Unmarshal([]byte(data), &options); err != nil {
		return []string{}
	}
	return options
}

func StrToUint(s string) uint {
	num, _ := strconv.ParseUint(s, 10, 32)
	return uint(num)
}
