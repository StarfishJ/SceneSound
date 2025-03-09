FROM python:3.9-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY python_service/requirements.txt .

# 安装Python依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY python_service/ .

# 设置环境变量
ENV PORT=8080

# 暴露端口
EXPOSE 8080

# 启动应用
CMD ["python", "app.py"] 