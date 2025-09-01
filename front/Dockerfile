# front/Dockerfile

# --- STAGE 1: 构建 React 应用 ---
FROM node:20-alpine AS build

WORKDIR /app

# 切换到淘宝 npm 镜像源
RUN npm config set registry https://registry.npmmirror.com

COPY package.json package-lock.json ./

# 2. 安装项目依赖
RUN npm ci

# 3. 拷贝所有源代码并执行构建
COPY . .
RUN npm run build

# --- STAGE 2: 使用 Nginx 提供静态文件服务 ---
FROM nginx:1.25-alpine

COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]