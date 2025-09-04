package core

import (
	"bytes"
	"fmt"
	"io/ioutil"
	"lh/config"
	"lh/global"
	"os"
	"runtime"
	"testing"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
)

// createTempConfigFile 函数在这个场景下可以不用了，但为了其他测试可能需要，先保留
func createTempConfigFile(t *testing.T, content string) string {
	tmpfile, err := ioutil.TempFile("", "test_config.*.yaml")
	if err != nil {
		t.Fatalf("创建临时配置文件失败: %v", err)
	}

	if _, err := tmpfile.Write([]byte(content)); err != nil {
		t.Fatalf("写入临时配置文件失败: %v", err)
	}

	if err := tmpfile.Close(); err != nil {
		t.Fatalf("关闭临时配置文件失败: %v", err)
	}

	return tmpfile.Name()
}

func TestInitConf(t *testing.T) {
	// 测试正常读取配置
	t.Run("正常读取配置", func(t *testing.T) {
		// 1. 定义测试所需的配置文件内容
		configContent := `
mysql:
  host: "localhost"
  port: 3306
  db: "testdb"
  user: "testuser"
  password: "testpass"
  config: "charset=utf8mb4"
  log_level: "debug"
logger:
  level: "info"
  prefix: "TEST"
  director: "./logs"
  show_Line: true
  log_In_Console: true
system:
  host: "0.0.0.0"
  port: 8080
  env: "test"
`
		// 2. 直接在当前目录（执行测试时的 core/ 目录）创建 settings.yaml
		err := ioutil.WriteFile("settings.yaml", []byte(configContent), 0644)
		if err != nil {
			t.Fatalf("创建 settings.yaml 失败: %v", err)
		}
		// 3. 使用 defer 确保测试结束后文件一定会被删除，即使测试失败或 panic
		defer os.Remove("settings.yaml")

		// 确保全局配置为空
		global.Config = nil

		// 捕获标准输出
		oldStdout := os.Stdout
		_, w, _ := os.Pipe()
		os.Stdout = w

		// 4. 现在可以安全地调用 InitConf，它会找到我们刚刚创建的文件
		InitConf()

		w.Close()
		os.Stdout = oldStdout

		assert.NotNil(t, global.Config)
		assert.Equal(t, "localhost", global.Config.Mysql.Host)
		assert.Equal(t, 3306, global.Config.Mysql.Port)
		assert.Equal(t, "testdb", global.Config.Mysql.DB)
		assert.Equal(t, "testuser", global.Config.Mysql.User)
		assert.Equal(t, "testpass", global.Config.Mysql.Password)
	})

	// 测试配置文件不存在的情况
	t.Run("配置文件不存在", func(t *testing.T) {
		// 为了确保文件不存在，我们先尝试删除一下（即使它不存在也没关系）
		os.Remove("settings.yaml")

		defer func() {
			if r := recover(); r == nil {
				t.Errorf("InitConf应该panic但没有panic")
			}
		}()

		InitConf()
	})

	// 测试无效的YAML配置
	t.Run("无效的YAML配置", func(t *testing.T) {
		// 创建无效的配置文件内容
		invalidContent := `
mysql:
  host: "localhost"
  port: "invalid_port"  # 端口应该是数字，这里是字符串
`
		// 同样，直接创建这个无效文件
		err := ioutil.WriteFile("settings.yaml", []byte(invalidContent), 0644)
		if err != nil {
			t.Fatalf("创建无效的 settings.yaml 失败: %v", err)
		}
		defer os.Remove("settings.yaml")

		defer func() {
			if r := recover(); r == nil {
				t.Errorf("InitConf应该panic但没有panic")
			}
		}()

		InitConf()
	})
}

func TestInitGorm(t *testing.T) {
	// 设置测试配置
	global.Log = &logrus.Logger{}
	global.Config = &config.Config{
		Mysql: config.Mysql{
			Host: "localhost",
			Port: 3306,
			DB:   "testdb",
			User: "user",
		},
		System: config.System{
			Env: "debug",
		},
	}

	// 测试没有配置MySQL主机的情况
	t.Run("没有MySQL配置", func(t *testing.T) {
		// 备份原始配置
		originalConfig := global.Config
		defer func() {
			global.Config = originalConfig
		}()

		// 设置空主机配置
		global.Config.Mysql.Host = ""

		assert.Nil(t, InitGorm())
	})
}

func TestFormat(t *testing.T) {
	formatter := &LogFormatter{}

	// 设置测试配置
	global.Config = &config.Config{
		Logger: config.Logger{
			Prefix: "TEST",
		},
	}

	// 测试不同日志级别
	levels := []logrus.Level{
		logrus.DebugLevel,
		logrus.InfoLevel,
		logrus.WarnLevel,
		logrus.ErrorLevel,
		logrus.FatalLevel,
		logrus.PanicLevel,
	}

	for _, level := range levels {
		t.Run(fmt.Sprintf("日志级别-%s", level.String()), func(t *testing.T) {
			entry := &logrus.Entry{
				Level:   level,
				Message: "Test message",
				Time:    time.Now(),
			}

			result, err := formatter.Format(entry)
			assert.NoError(t, err)
			assert.Contains(t, string(result), "Test message")
			assert.Contains(t, string(result), level.String())
		})
	}

	// 测试带调用者信息的日志
	t.Run("带调用者信息的日志", func(t *testing.T) {
		logger := logrus.New()
		logger.SetReportCaller(true)
		entry := logger.WithFields(logrus.Fields{})
		entry.Time = time.Now()
		entry.Level = logrus.InfoLevel
		entry.Message = "Test with caller"
		entry.Caller = &runtime.Frame{
			Function: "testFunction",
			File:     "/path/to/file.go",
			Line:     123,
		}
		result, err := formatter.Format(entry)
		assert.NoError(t, err)
		assert.Contains(t, string(result), "Test with caller")
		assert.Contains(t, string(result), "testFunction")
		assert.Contains(t, string(result), "file.go:123")
	})
}

func TestInitLogger(t *testing.T) {
	// 设置测试配置
	global.Config = &config.Config{
		Logger: config.Logger{
			Level:        "info",
			Prefix:       "TEST",
			Director:     "./logs",
			ShowLine:     true,
			LogInConsole: true,
		},
	}

	// 测试正常初始化
	t.Run("正常初始化日志", func(t *testing.T) {
		logger := InitLogger()
		assert.NotNil(t, logger)
		assert.Equal(t, logrus.InfoLevel, logger.GetLevel())
	})

	// 测试无效日志级别
	t.Run("无效日志级别", func(t *testing.T) {
		// 备份原始配置
		originalLevel := global.Config.Logger.Level
		defer func() {
			global.Config.Logger.Level = originalLevel
		}()

		// 设置无效级别
		global.Config.Logger.Level = "invalid_level"

		// 捕获标准输出
		oldStdout := os.Stdout
		r, w, _ := os.Pipe()
		os.Stdout = w

		logger := InitLogger()

		w.Close()
		os.Stdout = oldStdout

		// 读取捕获的输出
		var buf bytes.Buffer
		buf.ReadFrom(r)
		output := buf.String()

		assert.NotNil(t, logger)
		assert.Contains(t, output, "日志级别错误，使用默认级别")
		assert.Equal(t, logrus.DebugLevel, logger.GetLevel()) // 应该使用默认级别
	})
}

func TestInitDefaultLogger(t *testing.T) {
	// 设置测试配置
	global.Config = &config.Config{
		Logger: config.Logger{
			Level:    "warn",
			ShowLine: true,
		},
	}

	// 测试默认日志器初始化
	t.Run("初始化默认日志器", func(t *testing.T) {
		InitDefaultLogger()

		// 检查全局日志器配置
		assert.Equal(t, logrus.WarnLevel, logrus.GetLevel())
		assert.True(t, logrus.StandardLogger().ReportCaller)
	})

	// 测试无效日志级别
	t.Run("默认日志器无效级别", func(t *testing.T) {
		// 备份原始配置
		originalLevel := global.Config.Logger.Level
		defer func() {
			global.Config.Logger.Level = originalLevel
		}()

		// 设置无效级别
		global.Config.Logger.Level = "invalid_level"

		// 捕获标准输出
		oldStdout := os.Stdout
		r, w, _ := os.Pipe()
		os.Stdout = w

		InitDefaultLogger()

		w.Close()
		os.Stdout = oldStdout

		// 读取捕获的输出
		var buf bytes.Buffer
		buf.ReadFrom(r)
		output := buf.String()

		assert.Contains(t, output, "日志级别错误，使用默认级别")
		assert.Equal(t, logrus.DebugLevel, logrus.GetLevel()) // 应该使用默认级别
	})
}
