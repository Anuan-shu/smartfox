package core

import (
	"fmt"
	"io/ioutil"
	"lh/config"
	"lh/global"
	"log"

	"gopkg.in/yaml.v2"
)

// InitConf 读取配置文件
func InitConf() {
	const ConfigFile = "settings.yaml"
	c := &config.Config{}
	yamlConf, err := ioutil.ReadFile(ConfigFile)
	if err != nil {
		panic(fmt.Errorf("获取配置文件失败: %s", err))
	}
	err = yaml.Unmarshal(yamlConf, c)
	if err != nil {
		panic(fmt.Errorf("解析配置文件失败: %s", err))
	}
	log.Println("配置文件读取成功")
	fmt.Println(c)
	// 将配置文件内容赋值给全局变量
	global.Config = c
}
