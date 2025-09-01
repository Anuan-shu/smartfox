package main

import (
	"lh/controller"
	"lh/core"
	"lh/global"
	"lh/routers"
)

func main() {
	// 初始化配置
	core.InitConf()
	// 初始化日志
	global.Log = core.InitLogger()
	//连接数据库
	global.DB = core.InitGorm()
	controller.InitOSS()
	router := routers.InitRouter()

	router.Run(global.Config.System.Addr()) // listen and serve on
}
