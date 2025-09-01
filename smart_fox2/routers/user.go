package routers

import (
	"lh/controller"
	"lh/middleware"

	"github.com/gin-gonic/gin"
)

func CollectRoutes(r *gin.Engine) *gin.Engine {
	r.GET("/api/experiments/:experiment_id/files", middleware.AuthMiddleware(), controller.HandleStudentListFiles)
	r.GET("/api/experiments/:experiment_id/files/:filename/download", middleware.AuthMiddleware(), controller.HandleStudentDownloadFile)
	user := r.Group("/api/auth")
	//注册
	user.POST("/register", controller.Register)
	//登录
	user.POST("/login", controller.Login)
	//返回用户信息
	user.GET("/profile", middleware.AuthMiddleware(), controller.Info)
	//修改用户信息
	user.PUT("/update", middleware.AuthMiddleware(), controller.Update)
	r.GET("/api/student_list", middleware.AuthMiddleware(), controller.GetStudentList)
	TeacherGroup := r.Group("/api/teacher")
	{
		ExperimentRoutes_Teacher(TeacherGroup) // 挂载实验路由
	}
	StudentGroup := r.Group("/api/student")
	{
		ExperimentRoutes_Student(StudentGroup)
	}
	return r

}
func ExperimentRoutes_Teacher(r *gin.RouterGroup) {
	r.Use(middleware.AuthMiddleware())
	r.Use(middleware.TeacherOnly())
	r.GET("/students", controller.GetStudentListWithGroup)
	r.POST("/groups", controller.CreateStudentGroup)
	r.GET("/groups", controller.GetStudentGroup)
	r.PUT("/groups/:group_id", controller.UpdateStudentGroup)
	r.DELETE("/groups/:group_id", controller.DeleteStudentGroup)
	r.POST("/experiments", controller.CreateExperiment)
	r.GET("/experiments", controller.GetExperiments_Teacher)
	r.GET("/experiments/:experiment_id", controller.GetExperimentDetail_Teacher)
	r.PUT("/experiments/:experiment_id", controller.UpdateExperiment)
	r.DELETE("/experiments/:experiment_id", controller.DeleteExperiment)
	r.GET("/experiments/:experiment_id/:student_id/submissions", controller.GetStudentSubmissions)
	r.POST("/experiments/:experiment_id/uploadFile", controller.HandleTeacherUpload)
	r.POST("/experiments/notifications", controller.CreateNotification)
	r.GET("/experiments/notifications", controller.GetTeacherNotifications)
	r.DELETE("/experiments/:experiment_id/files/:filename", controller.TeacherDeleteFile)
}

func ExperimentRoutes_Student(r *gin.RouterGroup) {
	r.Use(middleware.AuthMiddleware())
	r.Use(middleware.StudentOnly())
	r.GET("/experiments", controller.GetExperiments_Student)
	r.GET("/experiments/:experiment_id", controller.GetExperimentDetail_Student)
	r.POST("/experiments/:experiment_id/save", controller.SaveAnswer)
	r.POST("/experiments/:experiment_id/submit", controller.SubmitExperiment)
	r.GET("/submissions", controller.GetSubmissions)

	r.GET("/experiments/notifications/:student_id", controller.GetStudentNotifications)
}
