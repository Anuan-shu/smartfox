package config

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestDsn(t *testing.T) {
	tests := []struct {
		name     string
		mysql    Mysql
		expected string
	}{
		{
			name: "完整配置",
			mysql: Mysql{
				Host:     "localhost",
				Port:     3306,
				User:     "root",
				Password: "password",
				DB:       "testdb",
				Config:   "charset=utf8mb4&parseTime=True&loc=Local",
			},
			expected: "root:password@tcp(localhost:3306)/testdb?charset=utf8mb4&parseTime=True&loc=Local",
		},
		{
			name: "无配置参数",
			mysql: Mysql{
				Host:     "127.0.0.1",
				Port:     3306,
				User:     "user",
				Password: "pass",
				DB:       "database",
				Config:   "",
			},
			expected: "user:pass@tcp(127.0.0.1:3306)/database?",
		},
		{
			name: "特殊字符密码",
			mysql: Mysql{
				Host:     "db.example.com",
				Port:     3306,
				User:     "admin",
				Password: "p@ssw0rd!@#",
				DB:       "appdb",
				Config:   "parseTime=true",
			},
			expected: "admin:p@ssw0rd!@#@tcp(db.example.com:3306)/appdb?parseTime=true",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.mysql.Dsn()
			assert.Equal(t, tt.expected, result)
		})
	}
}
