import { Configuration, OpenAIApi } from 'openai';
import { getSpotifyToken, searchTracks } from '../../utils/spotify';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, error: 'No text provided' });
    }

    // 模拟场景分析结果
    const scenes = [
      { scene: text, probability: 0.95 }
    ];

    // 根据场景推荐音乐风格
    const styles = ['chill', 'ambient', 'relaxing'];

    // 获取Spotify访问令牌
    const accessToken = await getSpotifyToken();

    // 获取推荐歌曲
    const playlist = [];
    for (const style of styles) {
      const tracks = await searchTracks(accessToken, style);
      playlist.push(...tracks);
    }

    // 返回分析结果
    return res.status(200).json({
      success: true,
      data: {
        scenes,
        styles,
        playlist: playlist.slice(0, 12) // 限制返回12首歌
      }
    });

  } catch (error) {
    console.error('Text analysis error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to analyze text'
    });
  }
} 