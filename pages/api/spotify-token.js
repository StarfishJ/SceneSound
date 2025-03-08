import fetch from 'node-fetch';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: '只允许GET请求' });
  }

  try {
    const authString = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
    
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials'
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || '获取Spotify令牌失败');
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('Spotify令牌错误:', error);
    res.status(500).json({ error: '获取Spotify令牌失败' });
  }
} 