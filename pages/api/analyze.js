import { vision } from '@google-cloud/vision';
import SpotifyWebApi from 'spotify-web-api-node';
import multer from 'multer';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { sceneRecognizer } from '../../lib/ml/sceneRecognition';
import * as tf from '@tensorflow/tfjs';
import sharp from 'sharp';
import { SceneRecognizer } from '../../lib/ml/sceneRecognition';
import fetch from 'node-fetch';
import FormData from 'form-data';

// 配置 multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// 将 multer 中间件转换为 Promise
const runMiddleware = (req, res, fn) => {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
};

// 检查环境变量和凭证文件
const checkCredentials = () => {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  
  if (!credentialsPath) {
    throw new Error('未设置 GOOGLE_APPLICATION_CREDENTIALS 环境变量');
  }

  // 解析相对路径
  const absolutePath = path.resolve(process.cwd(), credentialsPath);
  
  try {
    // 检查凭证文件是否存在
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`找不到 Google Cloud 凭证文件: ${absolutePath}`);
    }

    // 验证凭证文件格式
    const credentials = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
    const missingFields = requiredFields.filter(field => !credentials[field]);

    if (missingFields.length > 0) {
      throw new Error(`凭证文件缺少必要字段: ${missingFields.join(', ')}`);
    }

    // 更新环境变量为绝对路径
    process.env.GOOGLE_APPLICATION_CREDENTIALS = absolutePath;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`找不到 Google Cloud 凭证文件: ${absolutePath}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error('Google Cloud 凭证文件格式无效');
    }
    throw error;
  }

  // 检查 Spotify 凭证
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    throw new Error('未设置 Spotify API 凭证');
  }
};

// 初始化 Google Cloud Vision 客户端
let client = null;
const initializeVisionClient = async () => {
  try {
    checkCredentials();
    client = new vision.ImageAnnotatorClient();
    
    // 测试客户端连接
    await client.labelDetection({
      image: { content: Buffer.from('test') }
    }).catch(() => {}); // 忽略测试错误
    
    return true;
  } catch (error) {
    console.error('Vision API 初始化错误:', error);
    return false;
  }
};

// 初始化 Spotify API
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET
});

// 获取 Spotify 访问令牌
async function getSpotifyToken() {
  try {
    console.log('正在获取 Spotify 访问令牌...');
    console.log('Client ID:', process.env.SPOTIFY_CLIENT_ID);
    console.log('Client Secret:', process.env.SPOTIFY_CLIENT_SECRET?.substring(0, 4) + '...');
    
    const data = await spotifyApi.clientCredentialsGrant();
    const token = data.body['access_token'];
    console.log('成功获取访问令牌');
    spotifyApi.setAccessToken(token);
    return token;
  } catch (error) {
    console.error('获取 Spotify 令牌失败:', error.message);
    if (error.statusCode === 400) {
      console.error('客户端凭证无效，请检查 SPOTIFY_CLIENT_ID 和 SPOTIFY_CLIENT_SECRET');
    }
    throw error;
  }
}

// 搜索音乐
async function searchMusic(styles) {
  try {
    // 确保有访问令牌
    await getSpotifyToken();
    
    const tracks = [];
    for (const style of styles) {
      try {
        console.log(`搜索音乐风格: ${style}`);
        const result = await spotifyApi.searchTracks(`genre:${style}`, { 
          limit: 3,
          market: 'US'  // 指定市场
        });
        
        if (result.body.tracks.items.length > 0) {
          const mappedTracks = result.body.tracks.items.map(track => ({
            name: track.name,
            artist: track.artists[0].name,
            previewUrl: track.preview_url,
            spotifyUrl: track.external_urls.spotify,
            albumImage: track.album.images[0]?.url
          }));
          console.log(`找到 ${mappedTracks.length} 首歌曲`);
          tracks.push(...mappedTracks);
        } else {
          console.log(`没有找到 ${style} 风格的音乐`);
        }
      } catch (error) {
        console.error(`搜索音乐失败 (${style}):`, error.message);
      }
    }
    return tracks;
  } catch (error) {
    console.error('搜索音乐时出错:', error.message);
    return [];
  }
}

// 根据场景和标签生成音乐搜索关键词
const generateMusicKeywords = (scenes, labels) => {
  const keywords = [];

  // 添加场景相关的音乐风格
  const sceneToMusic = {
    beach: ['tropical', 'summer', 'waves', 'chill'],
    forest: ['nature', 'ambient', 'peaceful'],
    city: ['urban', 'busy', 'electronic'],
    mountain: ['epic', 'majestic', 'atmospheric'],
    desert: ['mystical', 'world music', 'meditation'],
    park: ['relaxing', 'acoustic', 'peaceful'],
    indoor: ['lounge', 'jazz', 'ambient'],
    restaurant: ['jazz', 'bossa nova', 'dinner']
  };

  // 从场景预测中获取关键词
  scenes.forEach(scene => {
    const musicStyles = sceneToMusic[scene.scene] || [];
    keywords.push(...musicStyles.map(style => ({
      term: style,
      weight: scene.probability
    })));
  });

  // 从标签中获取关键词
  labels.forEach(label => {
    keywords.push({
      term: label.description,
      weight: label.score
    });
  });

  // 按权重排序并返回前5个关键词
  return keywords
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)
    .map(k => k.term);
};

// API 路由处理器
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: '只支持 POST 请求' 
    });
  }

  try {
    // 处理文件上传
    await runMiddleware(req, res, upload.single('image'));

    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: '没有上传文件' 
      });
    }

    // 将图片数据发送到 Python 服务进行场景分析
    const formData = new FormData();
    formData.append('image', new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname);

    const pythonResponse = await fetch('http://localhost:5000/analyze', {
      method: 'POST',
      body: formData,
    });

    if (!pythonResponse.ok) {
      throw new Error(`场景分析服务返回错误: ${pythonResponse.status}`);
    }

    const sceneAnalysis = await pythonResponse.json();
    
    if (!sceneAnalysis.success) {
      throw new Error(sceneAnalysis.error || '场景分析失败');
    }

    // 根据场景生成音乐风格
    const musicStyles = sceneAnalysis.scenes.map(scene => {
      const style = scene.scene.replace('_', ' ');
      return style;
    }).slice(0, 4);

    // 获取音乐推荐
    const playlist = await searchMusic(musicStyles);

    // 返回结果
    const response = {
      success: true,
      data: {
        scenes: sceneAnalysis.scenes,
        styles: musicStyles,
        playlist: playlist || []
      }
    };

    console.log('返回的响应数据:', JSON.stringify(response, null, 2));
    res.status(200).json(response);
  } catch (error) {
    console.error('处理请求时出错:', error);
    res.status(500).json({
      success: false,
      error: error.message || '处理请求时发生错误'
    });
  }
}

// 配置 API 路由
export const config = {
  api: {
    bodyParser: false,
  },
}; 