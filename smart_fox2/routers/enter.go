package routers

import (
	"lh/global"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func InitRouter() *gin.Engine {
	gin.SetMode(global.Config.System.Env)
	router := gin.Default()
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"},                   // 允许前端源
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE"},            // 允许的 HTTP 方法
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"}, // 允许的请求头
		ExposeHeaders:    []string{"Content-Length"},                          // 暴露的响应头
		AllowCredentials: true,                                                // 允许发送 cookie 或认证信息
		MaxAge:           12 * 60 * 60,                                        // 预检请求缓存时间（秒）
	}))
	CollectRoutes(router)
	return router
}
