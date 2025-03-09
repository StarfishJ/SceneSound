# SceneSound

A web application that analyzes images and text to recommend music based on the detected scenes.

## Deployment Information

- Frontend: Deployed on Vercel (https://scene-sound.vercel.app)
- Backend: Deployed on Fly.io (https://scenesound-backend.fly.dev)
- Database: None (Stateless application)

## Environment Variables

### Frontend (.env.local)
```
NEXT_PUBLIC_BACKEND_URL=https://scenesound-backend.fly.dev
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

### Backend
The backend service is configured to run on Fly.io with the following specifications:
- Memory: 1GB RAM
- CPU: 1 shared CPU
- Region: Tokyo (nrt)

## Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install  # Frontend dependencies
   cd python_service && pip install -r requirements.txt  # Backend dependencies
   ```
3. Set up environment variables
4. Run the development servers:
   ```bash
   npm run dev  # Frontend
   python python_service/app.py  # Backend
   ```

## Deployment

### Frontend
```bash
npm run build
npm run start
```

### Backend
```bash
fly deploy
```

## Features
- Image scene analysis
- Text-based scene matching
- Music recommendations based on scenes
- Spotify preview playback
- Responsive design for mobile and desktop

## Technologies
- Frontend: Next.js, React
- Backend: Python, Flask
- Deployment: Vercel (Frontend), Fly.io (Backend)
- APIs: Spotify Web API

## 功能特点

- 图片上传和预览
- 使用 Google Cloud Vision API 进行图像分析
- 基于图像内容使用 Spotify API 推荐音乐
- 实时显示推荐的播放列表

## 技术栈

- Frontend: React.js + Next.js
- APIs: Google Cloud Vision API, Spotify Web API
- 文件处理: Multer

## 安装步骤

1. 克隆项目
```bash
git clone [your-repository-url]
cd SceneSound
```

2. 安装依赖
```bash
npm install
```

3. 配置环境变量
- 复制 `.env.example` 文件并重命名为 `.env`
- 填入必要的 API 密钥和配置信息：
  - Google Cloud Vision API 凭证
  - Spotify API 凭证

4. 运行开发服务器
```bash
npm run dev
```

## API 密钥获取方法

### Google Cloud Vision API
1. 访问 Google Cloud Console
2. 创建新项目或选择现有项目
3. 启用 Cloud Vision API
4. 创建服务账号和密钥文件
5. 下载 JSON 格式的凭证文件

### Spotify API
1. 访问 Spotify Developer Dashboard
2. 创建新应用
3. 获取 Client ID 和 Client Secret

## 使用方法

1. 访问网站首页
2. 点击上传按钮选择图片
3. 等待系统分析图片并生成推荐播放列表
4. 查看推荐的音乐列表

## 注意事项

- 上传图片大小限制为 5MB
- 确保所有环境变量都已正确配置
- 需要稳定的网络连接以访问外部 API 