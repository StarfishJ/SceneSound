// Places365 场景类别和分组
export const places365Categories = {
  // 自然环境
  natural: {
    beach: ['beach', 'coast', 'seashore', 'oceanside']
  }
};

// 场景到音乐风格的映射
export const sceneToMusicMapping = {
  'beach': ['tropical house', 'reggae', 'surf rock', 'chill'],
  'forest': ['ambient', 'folk', 'nature sounds', 'acoustic'],
  'mountain': ['epic orchestral', 'folk rock', 'ambient'],
  'city': ['electronic', 'jazz', 'hip hop', 'indie rock'],
  'desert': ['world music', 'ambient', 'psychedelic'],
  'cafe': ['jazz', 'bossa nova', 'acoustic'],
  'restaurant': ['jazz', 'lounge', 'classical'],
  'concert_hall': ['classical', 'live music', 'orchestral'],
  'bar': ['blues', 'jazz', 'rock'],
  'park': ['acoustic', 'folk', 'indie'],
  'garden': ['classical', 'ambient', 'new age'],
  'library': ['classical', 'ambient', 'minimal'],
  'museum': ['classical', 'ambient', 'experimental'],
  'art_gallery': ['experimental', 'ambient', 'electronic'],
  'night_club': ['electronic', 'dance', 'house'],
  'stadium': ['rock', 'pop', 'electronic'],
  'gym': ['electronic', 'rock', 'hip hop'],
  'shopping_mall': ['pop', 'electronic', 'ambient'],
  'airport': ['ambient', 'electronic', 'minimal'],
  'train_station': ['ambient', 'minimal', 'electronic']
};

// 情感分析配置
export const emotionConfig = {
  positive: {
    genres: ['pop', 'dance', 'happy rock', 'funk'],
    moods: ['upbeat', 'energetic', 'happy', 'cheerful'],
    tempo: 'fast'
  },
  negative: {
    genres: ['blues', 'dark ambient', 'melancholic'],
    moods: ['sad', 'moody', 'emotional'],
    tempo: 'slow'
  },
  neutral: {
    genres: ['ambient', 'instrumental', 'classical'],
    moods: ['calm', 'balanced', 'peaceful'],
    tempo: 'medium'
  },
  energetic: {
    genres: ['edm', 'rock', 'power pop'],
    moods: ['energetic', 'powerful', 'dynamic'],
    tempo: 'very fast'
  },
  calm: {
    genres: ['ambient', 'classical', 'soft rock'],
    moods: ['relaxing', 'peaceful', 'gentle'],
    tempo: 'slow'
  }
}; 