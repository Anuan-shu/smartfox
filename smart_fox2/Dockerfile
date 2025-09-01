# 使用官方的 golang:alpine 镜像作为构建环境
FROM golang:1.24-alpine AS builder

# 设置工作目录
WORKDIR /app

# 拷贝 go.mod 和 go.sum 文件，并下载依赖
COPY go.mod go.sum ./
RUN go mod download

# 拷贝项目所有的源代码到工作目录
COPY . .

# 编译 Go 应用
# CGO_ENABLED=0: 创建静态链接的二进制文件，不依赖 C 库
# -o /main: 指定编译输出的文件名为 main，并放在容器的根目录下
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o /main .

# 使用 alpine 镜像作为基础
FROM alpine:latest

# 设置工作目录
WORKDIR /app

# 从 builder 阶段拷贝编译好的 Go 二进制文件
COPY --from=builder /main .

# 拷贝程序运行时需要的配置文件
COPY settings.yaml .

# 暴露 Gin 应用监听的端口
EXPOSE 3002

# 容器启动时执行的命令
ENTRYPOINT ["./main"]