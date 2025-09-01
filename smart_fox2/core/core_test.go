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

// 创建临时配置文件用于测试
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
	// 创建临时配置文件
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

	configFile := createTempConfigFile(t, configContent)
	defer os.Remove(configFile) // 测试完成后删除临时文件

	// 备份原始配置文件和全局配置
	originalConfigFile := ""
	if _, err := os.Stat("settings.yaml"); err == nil {
		// 如果存在原始配置文件，备份它
		originalConfigFile = "settings.yaml.backup"
		os.Rename("settings.yaml", originalConfigFile)
		defer os.Rename(originalConfigFile, "settings.yaml") // 测试完成后恢复
	}

	// 将临时配置文件重命名为 settings.yaml
	os.Rename(configFile, "settings.yaml")
	defer os.Remove("settings.yaml") // 测试完成后删除

	// 测试正常读取配置
	t.Run("正常读取配置", func(t *testing.T) {
		// 确保全局配置为空
		global.Config = nil

		// 捕获标准输出
		oldStdout := os.Stdout
		_, w, _ := os.Pipe()
		os.Stdout = w

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
		// 确保没有配置文件
		if _, err := os.Stat("settings.yaml"); err == nil {
			os.Remove("settings.yaml")
		}

		// 测试会panic，使用defer恢复
		defer func() {
			if r := recover(); r == nil {
				t.Errorf("InitConf应该panic但没有panic")
			}
		}()

		InitConf()
	})

	// 测试无效的YAML配置
	t.Run("无效的YAML配置", func(t *testing.T) {
		// 创建无效的配置文件
		invalidContent := `
mysql:
  host: "localhost"
  port: "invalid_port"  # 端口应该是数字，这里是字符串
`

		invalidFile := createTempConfigFile(t, invalidContent)
		defer os.Remove(invalidFile)

		// 将无效配置文件重命名为 settings.yaml
		os.Rename(invalidFile, "settings.yaml")
		defer os.Remove("settings.yaml")

		// 测试会panic，使用defer恢复
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
