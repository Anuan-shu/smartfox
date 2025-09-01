package config

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAddr(t *testing.T) {
	tests := []struct {
		name     string
		system   System
		expected string
	}{
		{
			name: "标准IP和端口",
			system: System{
				Host: "127.0.0.1",
				Port: 8080,
			},
			expected: "127.0.0.1:8080",
		},
		{
			name: "域名和端口",
			system: System{
				Host: "api.example.com",
				Port: 443,
			},
			expected: "api.example.com:443",
		},
		{
			name: "IPv6地址",
			system: System{
				Host: "::1",
				Port: 8000,
			},
			expected: "::1:8000",
		},
		{
			name: "零端口",
			system: System{
				Host: "localhost",
				Port: 0,
			},
			expected: "localhost:0",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.system.Addr()
			assert.Equal(t, tt.expected, result)
		})
	}
}
