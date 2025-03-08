import { IncomingForm } from 'formidable';
import { getSpotifyToken, searchTracks } from '../../utils/spotify';
import { analyzeImage } from '../../utils/imageAnalysis';

export const config = {
  api: {
    bodyParser: false,
  },
};

// 关键词到场景的映射
const KEYWORD_MAPPINGS = {
  // 自然场景
  nature: ['nature', 'forest', 'mountain', 'garden', 'tree', 'flower', 'grass', 'park'],
  beach: ['beach', 'ocean', 'sea', 'wave', 'sand', 'sunset', 'coast', 'tropical'],
  city: ['city', 'urban', 'street', 'building', 'downtown', 'traffic', 'modern'],
  night: ['night', 'dark', 'star', 'moon', 'evening', 'midnight'],
  
  // 情绪/氛围
  party: ['party', 'dance', 'celebration', 'fun', 'festival', 'club'],
  calm: ['calm', 'peaceful', 'quiet', 'relax', 'meditation', 'zen'],
  energetic: ['energetic', 'active', 'workout', 'exercise', 'running', 'gym'],
  romantic: ['romantic', 'love', 'date', 'couple', 'wedding'],
  melancholic: ['sad', 'rain', 'lonely', 'melancholy', 'nostalgic'],
  epic: ['epic', 'grand', 'dramatic', 'powerful', 'intense']
};

// 场景到音乐风格的映射
const STYLE_MAPPINGS = {
  nature: ['ambient', 'acoustic', 'folk'],
  beach: ['tropical house', 'reggae', 'chill'],
  city: ['electronic', 'pop', 'hip-hop'],
  night: ['deep house', 'jazz', 'lofi'],
  party: ['dance', 'pop', 'electronic'],
  calm: ['classical', 'ambient', 'piano'],
  energetic: ['rock', 'electronic', 'pop'],
  romantic: ['r&b', 'soul', 'jazz'],
  melancholic: ['indie', 'alternative', 'acoustic'],
  epic: ['orchestral', 'cinematic', 'rock'],
  general: ['pop', 'rock', 'electronic']
};

function analyzeText(text) {
  if (!text || typeof text !== 'string') {
    console.log('无效的文本输入:', text);
    return [{
      scene: 'general',
      probability: 0.8
    }];
  }

  const scenes = new Set();
  const textLower = text.toLowerCase().trim();
  const words = textLower.split(/[\s,.!?]+/); // 更好的分词
  console.log('分析的单词:', words);

  // 遍历每个关键词映射
  Object.entries(KEYWORD_MAPPINGS).forEach(([scene, keywords]) => {
    // 检查每个关键词
    keywords.forEach(keyword => {
      if (words.some(word => word.includes(keyword) || keyword.includes(word))) {
        scenes.add({
          scene: scene,
          probability: 0.9
        });
      }
    });
  });

  // 如果没有找到任何场景，返回默认场景
  if (scenes.size === 0) {
    scenes.add({
      scene: 'general',
      probability: 0.8
    });
  }

  const result = Array.from(scenes);
  console.log('文字分析结果:', result);
  return result;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    console.log('开始处理请求...');
    const form = new IncomingForm();
    form.multiples = true; // 支持多文件上传
    
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve({ fields, files });
      });
    });

    const imageFile = files.image?.[0] || files.image; // 处理可能的数组情况
    const textInput = Array.isArray(fields.text) ? fields.text[0] : fields.text;

    console.log('接收到的数据:', {
      hasImage: !!imageFile,
      imageFileName: imageFile?.originalFilename || '无',
      textInput: textInput || '无'
    });

    if (!imageFile && !textInput) {
      return res.status(400).json({ success: false, error: 'No image or text provided' });
    }

    // 分析图片和文字
    let scenes = [];
    
    // 分析图片
    if (imageFile) {
      console.log('分析图片:', imageFile.originalFilename);
      const imageScenes = await analyzeImage(imageFile);
      console.log('图片分析结果:', imageScenes);
      scenes.push(...imageScenes);
    }

    // 分析文字
    if (textInput) {
      console.log('分析文字输入:', textInput);
      const textScenes = analyzeText(textInput);
      console.log('文字分析结果:', textScenes);
      scenes.push(...textScenes);
    }

    // 去重场景
    scenes = Array.from(new Set(scenes.map(JSON.stringify))).map(JSON.parse);
    console.log('合并后的场景:', scenes);

    // 如果没有识别出任何场景，使用默认场景
    if (scenes.length === 0) {
      console.log('使用默认场景');
      scenes.push({
        scene: 'general',
        probability: 0.8
      });
    }

    // 获取音乐风格
    const styles = new Set();
    scenes.forEach(scene => {
      const mappedStyles = STYLE_MAPPINGS[scene.scene] || STYLE_MAPPINGS.general;
      mappedStyles.forEach(style => styles.add(style));
    });

    const uniqueStyles = Array.from(styles);
    console.log('选择的音乐风格:', uniqueStyles);

    // 获取Spotify访问令牌
    console.log('正在获取 Spotify 访问令牌...');
    const accessToken = await getSpotifyToken();
    console.log('成功获取访问令牌');

    // 获取推荐歌曲
    console.log('开始获取推荐歌曲...');
    const playlist = [];
    for (const style of uniqueStyles) {
      const tracks = await searchTracks(accessToken, style);
      console.log(`风格 "${style}" 找到 ${tracks.length} 首歌曲`);
      playlist.push(...tracks);
    }

    // 去重歌曲（基于歌曲ID）
    const uniquePlaylist = Array.from(new Set(playlist.map(track => track.id)))
      .map(id => playlist.find(track => track.id === id));

    console.log(`总共找到 ${uniquePlaylist.length} 首不重复歌曲`);

    // 随机打乱并限制歌曲数量
    const shuffledPlaylist = uniquePlaylist
      .sort(() => Math.random() - 0.5)
      .slice(0, 12);

    console.log(`最终选择 ${shuffledPlaylist.length} 首歌曲`);

    return res.status(200).json({
      success: true,
      data: {
        scenes,
        styles: uniqueStyles,
        playlist: shuffledPlaylist
      }
    });

  } catch (error) {
    console.error('处理请求时出错:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze image and text'
    });
  }
} 