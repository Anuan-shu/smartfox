package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParseJSONArray(t *testing.T) {
	// 测试正常JSON数组
	t.Run("解析正常JSON数组", func(t *testing.T) {
		jsonArray := `["option1", "option2", "option3"]`
		result := ParseJSONArray(jsonArray)
		assert.Equal(t, []string{"option1", "option2", "option3"}, result)
	})

	// 测试空JSON数组
	t.Run("解析空JSON数组", func(t *testing.T) {
		jsonArray := `[]`
		result := ParseJSONArray(jsonArray)
		assert.Equal(t, []string{}, result)
	})

	// 测试无效JSON
	t.Run("解析无效JSON", func(t *testing.T) {
		invalidJSON := `["option1", "option2", "option3"`
		result := ParseJSONArray(invalidJSON)
		assert.Equal(t, []string{}, result)
	})

	// 测试非数组JSON
	t.Run("解析非数组JSON", func(t *testing.T) {
		nonArrayJSON := `{"key": "value"}`
		result := ParseJSONArray(nonArrayJSON)
		assert.Equal(t, []string{}, result)
	})
}

func TestStrToUint(t *testing.T) {
	// 测试正常数字字符串
	t.Run("转换正常数字字符串", func(t *testing.T) {
		result := StrToUint("123")
		assert.Equal(t, uint(123), result)
	})

	// 测试零
	t.Run("转换零", func(t *testing.T) {
		result := StrToUint("0")
		assert.Equal(t, uint(0), result)
	})

	// 测试大数字
	t.Run("转换大数字", func(t *testing.T) {
		result := StrToUint("4294967295") // uint32最大值
		assert.Equal(t, uint(4294967295), result)
	})

	// 测试无效字符串
	t.Run("转换无效字符串", func(t *testing.T) {
		result := StrToUint("abc")
		assert.Equal(t, uint(0), result)
	})

	// 测试空字符串
	t.Run("转换空字符串", func(t *testing.T) {
		result := StrToUint("")
		assert.Equal(t, uint(0), result)
	})

	// 测试负数
	t.Run("转换负数", func(t *testing.T) {
		result := StrToUint("-123")
		assert.Equal(t, uint(0), result) // 由于是无符号整数，负数会返回0
	})
}
