package middleware

import (
	"lh/models"
	"net/http"

	"github.com/gin-gonic/gin"
)

func StudentOnly() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		user, exists := ctx.Get("user")
		if !exists {
			ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权访问"})
			ctx.Abort()
			return
		}

		if user.(models.User).Role != "student" {
			ctx.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "仅学生可访问"})
			ctx.Abort()
			return
		}

		ctx.Next()
	}
}
