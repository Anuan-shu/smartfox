package core

import (
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"lh/global"
	"lh/models"
	"os"
	"time"
)

func InitGorm() *gorm.DB {
	if envHost := os.Getenv("MYSQL_HOST"); envHost != "" {
		global.Config.Mysql.Host = envHost
	}
	if envUser := os.Getenv("MYSQL_USER"); envUser != "" {
		global.Config.Mysql.User = envUser
	}
	if envPassword := os.Getenv("MYSQL_PASSWORD"); envPassword != "" {
		global.Config.Mysql.Password = envPassword
	}
	if envDb := os.Getenv("MYSQL_DB"); envDb != "" {
		global.Config.Mysql.DB = envDb
	}
	if global.Config.Mysql.Host == "" {
		global.Log.Warnln("没有配置mysql数据库连接信息")
		return nil
	}
	dsn := global.Config.Mysql.Dsn()

	var mysqlLogger logger.Interface
	if global.Config.System.Env == "debug" {
		//显示所有sql
		mysqlLogger = logger.Default.LogMode(logger.Info)
	} else if global.Config.System.Env == "release" {
		//只显示错误sql
		mysqlLogger = logger.Default.LogMode(logger.Error)
	}
	var db *gorm.DB
	var err error
	maxRetries := 10
	retryInterval := time.Second * 3 // 每 3 秒重试一次

	for i := 0; i < maxRetries; i++ {
		db, err = gorm.Open(mysql.Open(dsn), &gorm.Config{
			Logger: mysqlLogger,
		})
		if err == nil {
			// 连接成功，跳出循环
			global.Log.Infof("成功连接到数据库. (尝试 %d/%d)", i+1, maxRetries)
			break
		}
		// 连接失败，打印日志并等待后重试
		global.Log.Warnf("连接数据库失败 (尝试 %d/%d): %v. 将在 %v 后重试...", i+1, maxRetries, err, retryInterval)
		time.Sleep(retryInterval)
	}

	// 如果重试多次后仍然失败，则程序崩溃
	if err != nil {
		global.Log.Fatalf("无法连接到数据库，已达到最大重试次数: %v", err)
	}
	//db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
	//	Logger: mysqlLogger,
	//})
	//if err != nil {
	//	global.Log.Fatalf("%s", fmt.Sprintf("连接mysql数据库失败: %s", dsn))
	//}
	sqlDB, _ := db.DB()
	sqlDB.SetMaxIdleConns(10)               //设置连接池的空闲连接数
	sqlDB.SetMaxOpenConns(100)              //设置连接池的最大连接数
	sqlDB.SetConnMaxLifetime(time.Hour * 4) //设置连接的最大生存时间
	db.AutoMigrate(
		&models.User{},
		&models.Experiment{},
		&models.Question{},
		&models.Attachment{},
		&models.ExperimentSubmission{},
		&models.QuestionSubmission{},
		&models.User{},
		&models.Notification{},
		&models.Group{},
	)

	return db
}
