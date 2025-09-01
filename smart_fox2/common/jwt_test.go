package common

import (
	"lh/models"
	"testing"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/stretchr/testify/assert"
	"gorm.io/gorm"
)

func TestReleaseToken(t *testing.T) {
	// 创建一个测试用户
	user := models.User{
		Model: gorm.Model{ID: 1},
		Name:  "testuser",
	}

	// 测试正常生成token
	t.Run("正常生成token", func(t *testing.T) {
		token, err := ReleaseToken(user)
		assert.NoError(t, err)
		assert.NotEmpty(t, token)
	})

	// 测试token包含正确的用户ID
	t.Run("token包含正确的用户ID", func(t *testing.T) {
		tokenString, err := ReleaseToken(user)
		assert.NoError(t, err)

		token, claims, err := ParseToken(tokenString)
		assert.NoError(t, err)
		assert.True(t, token.Valid)
		assert.Equal(t, uint(1), claims.UserId)
	})

	// 测试token包含正确的过期时间
	t.Run("token包含正确的过期时间", func(t *testing.T) {
		tokenString, err := ReleaseToken(user)
		assert.NoError(t, err)

		_, claims, err := ParseToken(tokenString)
		assert.NoError(t, err)

		// 检查过期时间是否在7天后
		expectedExpiry := time.Now().Add(7 * 24 * time.Hour).Unix()
		assert.InDelta(t, expectedExpiry, claims.ExpiresAt, 10) // 允许10秒的误差
	})
}

func TestParseToken(t *testing.T) {
	// 创建一个测试用户
	user := models.User{
		Model: gorm.Model{ID: 1},
		Name:  "testuser",
	}

	// 生成一个有效的token
	validToken, err := ReleaseToken(user)
	assert.NoError(t, err)

	// 测试解析有效token
	t.Run("解析有效token", func(t *testing.T) {
		token, claims, err := ParseToken(validToken)
		assert.NoError(t, err)
		assert.True(t, token.Valid)
		assert.Equal(t, uint(1), claims.UserId)
	})

	// 测试解析无效token
	t.Run("解析无效token", func(t *testing.T) {
		invalidToken := "invalid.token.string"
		token, claims, err := ParseToken(invalidToken)
		assert.Error(t, err)
		assert.False(t, token.Valid)
		assert.NotNil(t, claims)
	})

	// 测试解析过期token
	t.Run("解析过期token", func(t *testing.T) {
		// 创建一个已过期的token
		expiredClaims := &Claims{
			UserId: 1,
			StandardClaims: jwt.StandardClaims{
				ExpiresAt: time.Now().Add(-100 * time.Hour).Unix(), // 100小时前过期
				IssuedAt:  time.Now().Add(-200 * time.Hour).Unix(), // 200小时前签发
				Issuer:    "127.0.0.1",
				Subject:   "user token",
			},
		}

		expiredToken := jwt.NewWithClaims(jwt.SigningMethodHS256, expiredClaims)
		expiredTokenString, err := expiredToken.SignedString(jwtKey)
		assert.NoError(t, err)

		token, claims, err := ParseToken(expiredTokenString)
		assert.Error(t, err)
		assert.NotNil(t, token)
		assert.NotNil(t, claims)
		assert.False(t, token.Valid)
	})
}
