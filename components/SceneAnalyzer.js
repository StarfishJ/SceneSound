import { useState, useRef, useEffect } from 'react';
import styles from '../styles/SceneAnalyzer.module.css';

export default function SceneAnalyzer() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sceneData, setSceneData] = useState(null);
  const [textInput, setTextInput] = useState('');
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [spotifyToken, setSpotifyToken] = useState('');
  const [recommendedMusic, setRecommendedMusic] = useState([]);
  const [playingTrack, setPlayingTrack] = useState(null);
  const audioRef = useRef(null);
  const [previewError, setPreviewError] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size cannot exceed 5MB');
      return;
    }

    // 创建图片预览
    const reader = new FileReader();
    reader.onload = () => {
      // 创建图片元素来检查尺寸
      const img = new Image();
      img.onload = () => {
        // 如果图片太大，显示警告
        if (img.width > 800 || img.height > 800) {
          console.log('图片将被自动调整大小以优化性能');
        }
        setImagePreview(reader.result);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    setSelectedImage(file);
    setError('');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
      setSelectedImage(file);
      setError('');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleCameraClick = (e) => {
    e.stopPropagation();
    if (isMobile) {
      cameraInputRef.current?.click();
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileClick = (e) => {
    e.stopPropagation(); // 防止触发dropZone的点击事件
    fileInputRef.current?.click();
  };

  // 获取Spotify访问令牌
  const getSpotifyToken = async () => {
    try {
      const response = await fetch('/api/spotify-token');
      if (!response.ok) {
        throw new Error(`Token request failed: ${response.status}`);
      }
      const data = await response.json();
      if (!data.access_token) {
        throw new Error('No access_token in response');
      }
      console.log('Successfully got Spotify token');
      setSpotifyToken(data.access_token);
    } catch (err) {
      console.error('Failed to get Spotify token:', err);
    }
  };

  // 根据场景获取Spotify推荐
  const getSpotifyRecommendations = async (scene) => {
    if (!spotifyToken) return null;
    
    const searchQuery = encodeURIComponent(`${scene} music`);
    try {
      const response = await fetch(`https://api.spotify.com/v1/search?q=${searchQuery}&type=track&limit=5`, {
        headers: {
          'Authorization': `Bearer ${spotifyToken}`
        }
      });
      const data = await response.json();
      return data.tracks.items.map(track => ({
        name: track.name,
        artist: track.artists[0].name,
        albumImageUrl: track.album.images[0].url,
        spotifyUrl: track.external_urls.spotify,
        previewUrl: track.preview_url
      }));
    } catch (err) {
      console.error('获取Spotify推荐失败:', err);
      return null;
    }
  };

  const analyzeImage = async () => {
    if (!selectedImage && !textInput.trim()) {
      setError('Please upload an image or enter text description');
      return;
    }

    setLoading(true);
    setError('');
    setSceneData(null);

    try {
      const formData = new FormData();
      if (selectedImage) {
        formData.append('image', selectedImage);
        console.log('添加图片到请求:', selectedImage.name);
      }
      if (textInput.trim()) {
        formData.append('text', textInput.trim());
        console.log('添加文本到请求:', textInput.trim());
      }
      
      // 移除URL末尾可能的斜杠
      const baseUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || 'https://scenesound-backend.onrender.com').replace(/\/$/, '');
      console.log('发送请求到:', `${baseUrl}/analyze`);
      
      const response = await fetch(`${baseUrl}/analyze`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Accept': 'application/json'
        },
        body: formData
      });

      console.log('响应状态:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('请求失败:', response.status, errorText);
        throw new Error(`Request failed with status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('返回数据：', data);
      
      if (!data.success && !data.scenes) {
        throw new Error(data.error || 'Analysis failed');
      }

      const sceneResults = {
        scenes: data.scenes || [],
        playlist: []
      };

      // 获取每个场景的音乐推荐
      const recommendations = await Promise.all(
        sceneResults.scenes.map(async (scene) => {
          const tracks = await getSpotifyRecommendations(scene.scene);
          return tracks || [];
        })
      );

      // 合并所有推荐并去重
      sceneResults.playlist = Array.from(new Set(recommendations.flat()))
        .slice(0, 5);

      setSceneData(sceneResults);
      // 只有在没有图片输入时才清空文本
      if (!selectedImage) {
        setTextInput('');
      }

      setRecommendedMusic(sceneResults.playlist);
    } catch (err) {
      console.error('分析错误:', err);
      setError(err.message || '处理过程中出错');
    } finally {
      setLoading(false);
    }
  };

  const handleTextChange = (e) => {
    setTextInput(e.target.value);
  };

  const handlePlay = async (track) => {
    try {
      setPreviewError(null);
      if (playingTrack?.name === track.name) {
        // 如果点击的是当前播放的歌曲，则暂停
        audioRef.current?.pause();
        setPlayingTrack(null);
      } else {
        // 如果之前有播放的歌曲，先停止
        if (audioRef.current) {
          audioRef.current.pause();
        }

        // 检查是否有预览URL
        if (!track.previewUrl) {
          setPreviewError(track.name);
          console.log('该歌曲没有预览音频');
          return;
        }

        // 创建新的音频实例
        audioRef.current = new Audio(track.previewUrl);
        audioRef.current.play().catch(err => {
          console.error('播放音频失败:', err);
          setPreviewError(track.name);
        });
        setPlayingTrack(track);
      }
    } catch (err) {
      console.error('处理播放时出错:', err);
      setPreviewError(track.name);
    }
  };

  // 检测是否为移动设备
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      setIsMobile(isMobileDevice);
    };
    checkMobile();
  }, []);

  // 在组件加载时获取Spotify令牌
  useEffect(() => {
    getSpotifyToken();
  }, []);

  // 在组件卸载时清理音频
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>SceneSound</h1>
        
        <div className={styles.uploadSection}>
          <div className={styles.imageUpload}>
            {imagePreview ? (
              <div className={styles.previewContainer}>
                <img src={imagePreview} alt="Preview" className={styles.preview} />
                <button onClick={() => {
                  setImagePreview(null);
                  setSelectedImage(null);
                }} className={styles.clearButton}>
                  <span className={styles.clearIcon}>×</span>
                </button>
              </div>
            ) : (
              <div className={styles.dropZone} onDrop={handleDrop} onDragOver={handleDragOver}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                  accept="image/*"
                  className={styles.fileInput}
                />
                {isMobile && (
                  <input
                    type="file"
                    ref={cameraInputRef}
                    onChange={handleImageSelect}
                    accept="image/*"
                    capture="environment"
                    className={styles.fileInput}
                  />
                )}
                <div className={styles.uploadOptions}>
                  <div className={styles.uploadIcon} onClick={handleFileClick}>
                    <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span className={styles.iconText}>Choose File</span>
                  </div>
                  <div className={styles.cameraIcon} onClick={handleCameraClick}>
                    <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    <span className={styles.iconText}>{isMobile ? 'Take Photo' : 'Choose File'}</span>
                  </div>
                </div>
                <p>Upload a photo or take a picture</p>
              </div>
            )}
          </div>

          <textarea
            className={styles.textInput}
            value={textInput}
            onChange={handleTextChange}
            placeholder="Enter text description here..."
          />

          <button onClick={analyzeImage} className={styles.analyzeButton}>
            Analyze
          </button>
        </div>

        {sceneData?.playlist && (
          <div className={styles.musicSection}>
            <h2 className={styles.sectionTitle}>Recommended Music</h2>
            <div className={styles.trackGrid}>
              {sceneData.playlist.map((track, index) => (
                <div key={index} className={styles.trackCard}>
                  <div className={styles.albumCover} onClick={() => handlePlay(track)}>
                    <img src={track.albumImageUrl} alt={track.name} />
                    <div className={styles.playButton}>
                      {playingTrack?.name === track.name ? (
                        <span className={styles.pauseIcon}>❚❚</span>
                      ) : (
                        <span className={styles.playIcon}>▶</span>
                      )}
                    </div>
                  </div>
                  <div className={styles.trackInfo}>
                    <h3>{track.name}</h3>
                    <p>{track.artist}</p>
                    {previewError === track.name && (
                      <p className={styles.previewError}>Preview Unavailable</p>
                    )}
                    <a href={track.spotifyUrl} target="_blank" rel="noopener noreferrer" className={styles.spotifyLink}>
                      <svg className={styles.spotifyIcon} viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                      </svg>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 