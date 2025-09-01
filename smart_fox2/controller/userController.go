package controller

import (
	"lh/common"
	"lh/global"
	"lh/models"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

func Register(ctx *gin.Context) {

	db := global.DB

	//获取参数
	//此处使用Bind()函数，可以处理不同格式的前端数据
	var requestUser models.User
	err := ctx.Bind(&requestUser)
	if err != nil {
		return
	}
	name := requestUser.Name
	telephone := requestUser.Telephone
	password := requestUser.Password
	role := requestUser.Role
	//数据验证
	if len(name) == 0 {
		ctx.JSON(http.StatusUnprocessableEntity, gin.H{
			"code":    422,
			"message": "用户名不能为空",
		})
		return
	}
	if len(telephone) != 11 {
		ctx.JSON(http.StatusUnprocessableEntity, gin.H{
			"code":    422,
			"message": "手机号必须为11位",
		})
		return
	}
	if len(password) < 6 {
		ctx.JSON(http.StatusUnprocessableEntity, gin.H{
			"code":    422,
			"message": "密码不能少于6位",
		})
		return
	}
	if role != "student" && role != "teacher" {
		ctx.JSON(http.StatusUnprocessableEntity, gin.H{
			"code":    422,
			"message": "用户类型不合法",
		})
		return
	}
	//判断手机号是否存在
	var user models.User
	db.Where("telephone = ?", telephone).First(&user)
	if user.ID != 0 {
		ctx.JSON(http.StatusUnprocessableEntity, gin.H{
			"code":    422,
			"message": "手机号已注册",
		})
		return
	}
	//判断用户名是否存在
	db.Where("name = ?", name).First(&user)
	if user.ID != 0 {
		ctx.JSON(http.StatusUnprocessableEntity, gin.H{
			"code":    422,
			"message": "用户名已注册",
		})
		return
	}

	//创建用户
	hasedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		ctx.JSON(http.StatusUnprocessableEntity, gin.H{
			"code":    500,
			"message": "密码加密错误",
		})
		return
	}
	newUser := models.User{
		Name:      name,
		Telephone: telephone,
		Password:  string(hasedPassword),
		Role:      role,
	}
	db.Create(&newUser)

	//返回结果
	ctx.JSON(http.StatusOK, gin.H{
		"code":     200,
		"user_id":  newUser.ID,
		"username": newUser.Name,
		"role":     newUser.Role,
		"message":  "注册成功",
	})
}

// 登录
func Login(ctx *gin.Context) {

	db := common.GetDB()

	//获取参数
	//此处使用Bind()函数，可以处理不同格式的前端数据
	var requestUser models.User
	err := ctx.Bind(&requestUser)
	if err != nil {
		return
	}
	telephone := requestUser.Telephone
	name := requestUser.Name
	password := requestUser.Password
	var user models.User
	if telephone == "" && name == "" {
		ctx.JSON(http.StatusUnprocessableEntity, gin.H{
			"code":    422,
			"message": "手机号和用户名不能同时为空",
		})
		return
	}
	if name == "" {
		//数据验证
		if len(telephone) != 11 {
			ctx.JSON(http.StatusUnprocessableEntity, gin.H{
				"code":    422,
				"message": "手机号必须为11位",
			})
			return
		}
		//判断手机号是否存在
		db.Where("telephone = ?", telephone).First(&user)
		if user.ID == 0 {
			ctx.JSON(http.StatusUnprocessableEntity, gin.H{
				"code":    422,
				"message": "用户不存在",
			})
			return
		}
	} else if telephone == "" {
		//判断用户名是否存在
		db.Where("name = ?", name).First(&user)
		if user.ID == 0 {
			ctx.JSON(http.StatusUnprocessableEntity, gin.H{
				"code":    422,
				"message": "用户不存在",
			})
			return
		}
	}

	//判断密码是否正确
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		ctx.JSON(http.StatusUnprocessableEntity, gin.H{
			"code":    422,
			"message": "密码错误",
		})
		return
	}
	//发放token
	token, err := common.ReleaseToken(user)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "系统异常",
		})
		//记录下错误
		log.Printf("token generate error: %v", err)
		return
	}
	//返回结果
	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"data":    gin.H{"token": "Bearer " + token},
		"message": "登录成功",
	})
}

func Info(ctx *gin.Context) {
	user, _ := ctx.Get("user")
	//将用户信息返回
	ctx.JSON(http.StatusOK, gin.H{
		"user_id":    user.(models.User).ID,
		"username":   user.(models.User).Name,
		"email":      user.(models.User).Email,
		"telephone":  user.(models.User).Telephone,
		"role":       user.(models.User).Role,
		"avatar_url": user.(models.User).AvatarUrl,
		"created_at": user.(models.User).CreatedAt,
	})
}

type UserUpdate struct {
	Name        string `json:"username" binding:"-"`
	Telephone   string `json:"telephone" binding:"-"`
	OldPassword string `json:"old_password" binding:"-"`
	Password    string `json:"new_password" binding:"-"`
	Role        string `json:"role" binding:"-"`
	AvatarUrl   string `json:"avatar" binding:"-"`
	Email       string `json:"email" binding:"-"`
}

func Update(ctx *gin.Context) {
	//修改用户信息
	db := common.GetDB()
	//绑定User模型并添加额外的字段
	var requestUser UserUpdate
	err := ctx.Bind(&requestUser)
	if err != nil {
		return
	}

	//获取用户信息
	userr, _ := ctx.Get("user")
	userId := userr.(models.User).ID
	var user models.User
	if len(requestUser.Name) == 0 {
		requestUser.Name = userr.(models.User).Name
	} else {
		//判断用户名是否存在
		db.Where("name = ?", requestUser.Name).First(&user)
		if user.ID != 0 {
			ctx.JSON(http.StatusUnprocessableEntity, gin.H{
				"code":    422,
				"message": "用户名已注册",
			})
			return
		}
		if user.ID == userId {
			ctx.JSON(http.StatusUnprocessableEntity, gin.H{
				"code":    422,
				"message": "用户名不能和旧用户名相同",
			})
			return
		}
	}
	if len(requestUser.Telephone) == 0 {
		requestUser.Telephone = userr.(models.User).Telephone
	} else {
		//判断手机号是否存在

		db.Where("telephone = ?", requestUser.Telephone).First(&user)
		if user.ID != 0 {
			ctx.JSON(http.StatusUnprocessableEntity, gin.H{
				"code":    422,
				"message": "手机号已注册",
			})
			return
		}
		if user.ID == userId {
			ctx.JSON(http.StatusUnprocessableEntity, gin.H{
				"code":    422,
				"message": "手机号不能和旧手机号相同",
			})
			return
		}
	}
	if len(requestUser.Email) == 0 {
		requestUser.Email = userr.(models.User).Email
	}
	if len(requestUser.AvatarUrl) == 0 {
		requestUser.AvatarUrl = userr.(models.User).AvatarUrl
	}
	if len(requestUser.Role) == 0 {
		requestUser.Role = userr.(models.User).Role
	}
	if len(requestUser.OldPassword) == 0 {
		requestUser.OldPassword = userr.(models.User).Password
	}
	if len(requestUser.Password) == 0 {
		requestUser.Password = userr.(models.User).Password
	} else {
		if len(requestUser.Password) < 6 {
			ctx.JSON(http.StatusUnprocessableEntity, gin.H{
				"code":    422,
				"message": "密码不能少于6位",
			})
			return
		}
		//判断旧密码是否正确
		if err := bcrypt.CompareHashAndPassword([]byte(userr.(models.User).Password), []byte(requestUser.OldPassword)); err != nil {
			ctx.JSON(http.StatusUnprocessableEntity, gin.H{
				"code":    422,
				"message": "旧密码错误",
			})
			return
		}
		//判断新密码是否和旧密码相同
		if requestUser.OldPassword == requestUser.Password {
			ctx.JSON(http.StatusUnprocessableEntity, gin.H{
				"code":    422,
				"message": "新密码不能和旧密码相同",
			})
			return
		}
		//加密新密码
		hasedPassword, err := bcrypt.GenerateFromPassword([]byte(requestUser.Password), bcrypt.DefaultCost)
		if err != nil {
			ctx.JSON(http.StatusUnprocessableEntity, gin.H{
				"code":    500,
				"message": "密码加密错误",
			})
			return
		}
		requestUser.Password = string(hasedPassword)
	}

	//数据验证
	if len(requestUser.Telephone) != 11 {
		ctx.JSON(http.StatusUnprocessableEntity, gin.H{
			"code":    422,
			"message": "手机号必须为11位",
		})
		return
	}
	if requestUser.Role != "student" && requestUser.Role != "teacher" {
		ctx.JSON(http.StatusUnprocessableEntity, gin.H{
			"code":    422,
			"message": "用户类型不合法",
		})
		return
	}

	//修改用户信息
	//将用户信息更新到数据库
	db.Model(&user).Where("id = ?", userId).Updates(models.User{
		Name:      requestUser.Name,
		Telephone: requestUser.Telephone,
		Password:  requestUser.Password,
		Role:      requestUser.Role,
		AvatarUrl: requestUser.AvatarUrl,
		Email:     requestUser.Email,
	})
	//返回结果
	ctx.JSON(http.StatusOK, gin.H{
		"code":     200,
		"user_id":  userId,
		"username": requestUser.Name,
		"role":     requestUser.Role,
		"message":  "修改成功",
	})
}
