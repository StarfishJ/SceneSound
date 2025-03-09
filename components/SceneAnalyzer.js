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

  const MAX_IMAGE_SIZE = 600;
  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 降低到2MB
  const COMPRESSION_QUALITY = 0.6; // 提高压缩率

  const compressImage = async (file, maxDimension = MAX_IMAGE_SIZE, quality = COMPRESSION_QUALITY) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // 计算新的尺寸，保持宽高比
          let { width, height } = img;
          const maxSize = Math.max(width, height);
          if (maxSize > maxDimension) {
            const ratio = maxDimension / maxSize;
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }

          // 创建canvas进行压缩
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          // 使用双线性插值算法进行缩放
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // 转换为blob，使用渐进式JPEG
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('图片压缩失败'));
                return;
              }
              console.log('原始图片大小:', file.size, 'bytes');
              console.log('压缩后的图片大小:', blob.size, 'bytes');
              console.log('压缩率:', Math.round((1 - blob.size / file.size) * 100) + '%');
              
              // 如果压缩后仍然太大，继续压缩
              if (blob.size > MAX_FILE_SIZE) {
                console.log('尝试进一步压缩...');
                const newQuality = quality * 0.8;
                canvas.toBlob(
                  (finalBlob) => {
                    if (!finalBlob) {
                      reject(new Error('图片二次压缩失败'));
                      return;
                    }
                    console.log('二次压缩后大小:', finalBlob.size, 'bytes');
                    resolve(new File([finalBlob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
                      type: 'image/jpeg',
                      lastModified: Date.now()
                    }));
                  },
                  'image/jpeg',
                  newQuality
                );
              } else {
                resolve(new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                }));
              }
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setError('');
      setLoading(true);

      if (!file.type.startsWith('image/')) {
        throw new Error('请选择图片文件');
      }

      if (file.size > MAX_FILE_SIZE * 3) {
        throw new Error('图片大小不能超过6MB');
      }

      // 处理图片
      let processedFile = file;
      if (file.size > MAX_FILE_SIZE || file.type !== 'image/jpeg') {
        console.log('正在压缩图片...');
        processedFile = await compressImage(file);
        
        if (processedFile.size > MAX_FILE_SIZE) {
          console.log('图片仍然太大，进行二次压缩...');
          processedFile = await compressImage(processedFile, MAX_IMAGE_SIZE * 0.8, 0.5);
        }
      }

      // 创建预览
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          console.log('最终图片尺寸:', img.width, 'x', img.height);
          console.log('最终文件大小:', processedFile.size, 'bytes');
          setImagePreview(reader.result);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(processedFile);
      setSelectedImage(processedFile);
    } catch (err) {
      console.error('处理图片时出错:', err);
      setError(err.message || '处理图片时出错，请重试');
    } finally {
      setLoading(false);
    }
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
    const hasImage = !!selectedImage;
    const hasText = !!textInput.trim();

    if (!hasImage && !hasText) {
      setError('请上传图片或输入文字描述，或两者都提供');
      return;
    }

    setLoading(true);
    setError('');
    setSceneData(null);

    const maxRetries = 2;
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        const baseUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || 'https://scenesound-backend.onrender.com').replace(/\/$/, '');
        
        let response;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        const commonConfig = {
          method: 'POST',
          mode: 'cors',
          credentials: 'omit',
          headers: {
            'Accept': 'application/json'
          },
          signal: controller.signal
        };

        try {
          if (hasImage) {
            // 图片分析（可能包含文本）使用FormData格式
            const formData = new FormData();
            
            // 确保图片大小合适
            let imageToSend = selectedImage;
            if (selectedImage.size > MAX_FILE_SIZE) {
              console.log('压缩图片以优化上传...');
              imageToSend = await compressImage(selectedImage);
            }
            formData.append('image', imageToSend);
            console.log('添加图片到请求:', imageToSend.name, '大小:', imageToSend.size, 'bytes');
            
            if (hasText) {
              formData.append('text', textInput.trim());
              console.log('添加文本到请求:', textInput.trim());
            }

            console.log('发送图片分析请求');
            response = await fetch(`${baseUrl}/analyze`, {
              ...commonConfig,
              body: formData
            });
          } else {
            // 纯文本分析使用JSON格式
            console.log('发送纯文本分析请求');
            response = await fetch(`${baseUrl}/analyze`, {
              ...commonConfig,
              headers: {
                ...commonConfig.headers,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                text: textInput.trim()
              })
            });
          }

          clearTimeout(timeoutId);
          
          console.log('响应状态:', response.status);
          
          if (response.ok) {
            const data = await response.json();
            console.log('返回数据：', data);
            
            if (!data.success && !data.scenes) {
              throw new Error(data.error || '场景分析失败');
            }

            const sceneResults = {
              scenes: data.scenes || [],
              playlist: []
            };

            // 获取音乐推荐
            const recommendations = await Promise.all(
              sceneResults.scenes.map(async (scene) => {
                const tracks = await getSpotifyRecommendations(scene.scene);
                return tracks || [];
              })
            );

            sceneResults.playlist = Array.from(new Set(recommendations.flat()))
              .slice(0, 5);

            setSceneData(sceneResults);
            if (!selectedImage) {
              setTextInput('');
            }
            setRecommendedMusic(sceneResults.playlist);
            return; // 成功后退出
          }

          // 处理错误响应
          const errorText = await response.text();
          console.error('请求失败:', response.status, errorText);
          
          let errorMessage = '';
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error || '未知错误';
          } catch {
            errorMessage = errorText;
          }

          // 判断是否需要重试
          if (response.status === 502 || response.status === 504) {
            if (retryCount < maxRetries) {
              retryCount++;
              console.log(`服务器暂时无响应，${retryCount}秒后重试...`);
              await new Promise(resolve => setTimeout(resolve, retryCount * 1000));
              continue;
            }
          }

          // 其他错误直接抛出
          throw new Error(getErrorMessage(response.status, errorMessage));
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (err) {
        if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
          console.error('CORS错误或网络问题:', err);
          setError('无法连接到服务器，请检查网络连接或稍后重试');
          break;
        }
        
        if (retryCount === maxRetries) {
          console.error('分析错误:', err);
          setError(err.message || '处理过程中出错');
          break;
        }
        retryCount++;
        console.log(`发生错误，${retryCount}秒后重试...`);
        await new Promise(resolve => setTimeout(resolve, retryCount * 1000));
      }
    }

    setLoading(false);
  };

  const getErrorMessage = (status, message) => {
    switch (status) {
      case 400:
        return '请求格式错误：' + message;
      case 502:
        return '服务器暂时无法处理请求，正在重试...';
      case 413:
        return '图片文件太大，请选择更小的图片或等待自动压缩完成。';
      case 415:
        return '不支持的文件类型，请选择jpg、png或gif格式的图片。';
      case 429:
        return '请求过于频繁，请稍后再试。';
      case 504:
        return '服务器处理超时，正在重试...';
      default:
        return `服务器错误 (${status}): ${message}`;
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