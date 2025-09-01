# Judger/Dockerfile

# 使用官方的 Python slim 镜像作为基础
# slim-bullseye 是基于 Debian 的，包管理器是 apt-get，比 alpine 更容易安装 g++ 和 openjdk
FROM python:3.10-bullseye

# 设置工作目录
WORKDIR /app

# 安装系统级依赖：g++ (用于 C++) 和 OpenJDK (用于 Java)
# apt-get update: 更新包列表
# -y: 对所有提示自动回答 yes
# --no-install-recommends: 只安装核心包，不安装推荐的附加包，减小镜像体积
RUN apt-get update && \
    apt-get install -y g++ default-jdk --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# 将 Judger 目录下的所有文件拷贝到容器的 /app 目录中
COPY . .

# 安装 Python 依赖 (requirements.txt)
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi

# 暴露 Judge 服务监听的端口
EXPOSE 8080

# 容器启动时运行 Python Web 应用的命令
CMD ["python", "app.py"]