package middleware

import (
	"github.com/gin-gonic/gin"
	"lh/common"
	"lh/models"
	"net/http"
	"strings"
)

func AuthMiddleware() gin.HandlerFunc {

	return func(ctx *gin.Context) {

		// 获取authorization header
		tokenString := ctx.GetHeader("Authorization")

		// validate token formate
		if tokenString == "" || !strings.HasPrefix(tokenString, "Bearer ") {
			ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "1权限不足"})
			ctx.Abort()
			return
		}

		//提取token的有效部分（"Bearer "共占7位)
		tokenString = tokenString[7:]

		token, claims, err := common.ParseToken(tokenString)
		if err != nil || !token.Valid {
			ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "2权限不足"})
			ctx.Abort()
			return
		}

		// 验证通过后获取claim 中的userId
		userId := claims.UserId
		DB := common.GetDB()
		var user models.User
		DB.First(&user, userId)

		// 用户不存在
		if user.ID == 0 {
			ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "用户不存在"})
			ctx.Abort()
			return
		}

		// 用户存在将user的信息写入上下文，方便读取
		ctx.Set("user", user)

		ctx.Next()
	}
}
