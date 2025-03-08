const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

export async function getSpotifyToken() {
  try {
    console.log('正在获取 Spotify 访问令牌...');
    console.log('Client ID:', SPOTIFY_CLIENT_ID?.slice(0, 5) + '...');
    console.log('Client Secret:', SPOTIFY_CLIENT_SECRET ? '已设置' : '未设置');

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64')
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('获取令牌失败:', response.status, errorText);
      throw new Error(`获取 Spotify 令牌失败: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('成功获取访问令牌');
    return data.access_token;
  } catch (error) {
    console.error('获取 Spotify 令牌时出错:', error);
    throw error;
  }
}

export async function searchTracks(accessToken, style, limit = 5) {
  try {
    console.log(`正在搜索风格为 "${style}" 的歌曲...`);
    
    const query = encodeURIComponent(`genre:${style}`);
    const url = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=${limit}`;
    
    console.log('发送请求到:', url);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('搜索歌曲失败:', response.status, errorText);
      throw new Error(`搜索歌曲失败: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.tracks || !data.tracks.items) {
      console.log('未找到歌曲:', data);
      return [];
    }

    const tracks = data.tracks.items.map(track => ({
      id: track.id,
      name: track.name,
      artist: track.artists[0].name,
      albumImage: track.album.images[0]?.url,
      previewUrl: track.preview_url,
      spotifyUrl: track.external_urls.spotify
    }));

    console.log(`找到 ${tracks.length} 首歌曲`);
    return tracks;
  } catch (error) {
    console.error('搜索歌曲时出错:', error);
    throw error;
  }
} 