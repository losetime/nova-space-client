# 前端 Dockerfile - 多阶段构建

# 阶段1: 构建应用
FROM node:22-alpine AS builder

WORKDIR /app

# 复制 package 文件
COPY package.json pnpm-lock.yaml ./

# 在构建阶段添加
RUN npm install -g pnpm

# 使用 pnpm 代替 npm
# --ignore-scripts 先跳过脚本
RUN pnpm install --frozen-lockfile --ignore-scripts

# 允许所有包的脚本构建，针对pnpm v11版本
RUN pnpm approve-builds --all

# 重新构建所有被忽略的包
RUN pnpm rebuild

# 复制源代码
COPY . .

# 构建生产版本（跳过类型检查）
RUN pnpm run build-only

# 阶段2: 生产环境 (Nginx 提供静态文件服务)
FROM nginx:alpine AS production

# 复制自定义 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 从构建阶段复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 暴露端口
EXPOSE 80

# 启动 nginx
CMD ["nginx", "-g", "daemon off;"]