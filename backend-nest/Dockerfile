# 后端 Dockerfile - 多阶段构建

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

# 构建 TypeScript
RUN pnpm run build

# 阶段2: 生产环境
FROM node:22-alpine AS production

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 设置 Node 环境
ENV NODE_ENV=production

# 复制 package 文件
COPY package.json pnpm-lock.yaml ./

# 只安装生产依赖
RUN pnpm install --prod --ignore-scripts && pnpm approve-builds --all && pnpm rebuild

# 从构建阶段复制编译后的文件
COPY --from=builder /app/dist ./dist

# 暴露端口
EXPOSE 3001

# 启动应用
CMD ["node", "dist/main.js"]