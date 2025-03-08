import { useState, useEffect } from 'react';
import Image from 'next/image';

export default function ImageUpload({ onAnalyze }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keywords, setKeywords] = useState([]);
  const [lastApiResponse, setLastApiResponse] = useState(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    console.log('选择的文件:', file);
    if (!file) {
      console.log('没有选择文件');
      return;
    }

    // 检查文件类型
    console.log('文件类型:', file.type);
    if (!file.type.startsWith('image/')) {
      console.log('文件类型不是图片');
      setError('请选择图片文件');
      return;
    }

    // 检查文件大小
    console.log('文件大小:', file.size);
    if (file.size > 5 * 1024 * 1024) {
      console.log('文件太大');
      setError('图片大小不能超过 5MB');
      return;
    }

    try {
      // 创建文件读取器
      const reader = new FileReader();
      
      reader.onloadstart = () => {
        console.log('开始读取图片');
      };
      
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          console.log(`读取进度: ${(e.loaded / e.total * 100).toFixed(2)}%`);
        }
      };
      
      reader.onload = (e) => {
        console.log('图片读取完成，设置预览URL');
        const dataUrl = e.target.result;
        console.log('预览URL开头:', dataUrl.substring(0, 50) + '...');
        console.log('是否为base64格式:', dataUrl.startsWith('data:image/'));
        setPreviewUrl(dataUrl);
      };
      
      reader.onerror = (e) => {
        console.error('图片读取错误:', e);
        setError('图片读取失败');
      };

      console.log('开始读取文件');
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('处理图片时出错:', error);
      setError('处理图片时出错');
    }

    setSelectedImage(file);
    setError('');
    setKeywords([]);
  };

  const handleSubmit = async () => {
    if (!selectedImage) {
      setError('请先选择图片');
      return;
    }

    setLoading(true);
    setError('');
    setKeywords([]); // 清空之前的关键词

    try {
      const formData = new FormData();
      formData.append('image', selectedImage);

      console.log('开始发送请求...');
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      console.log('收到响应:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorData = await response.json().catch(e => {
          console.error('解析错误响应失败:', e);
          return {};
        });
        console.error('HTTP错误:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(errorData.error || `请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json().catch(e => {
        console.error('解析响应数据失败:', e);
        throw new Error('无法解析服务器响应');
      });

      console.log('API返回的完整数据:', JSON.stringify(data, null, 2));

      if (!data.success || !data.data) {
        console.error('API返回错误:', data);
        throw new Error(data.error || '分析失败');
      }

      const { scenes, styles, playlist } = data.data;
      
      // 验证场景数据
      if (!Array.isArray(scenes)) {
        console.error('场景数据不是数组:', scenes);
        throw new Error('场景数据格式错误');
      }

      if (scenes.length === 0) {
        console.warn('没有识别出场景');
        setKeywords([]);
        return;
      }

      // 提取并验证场景数据
      const topScenes = scenes
        .slice(0, 3)
        .map(item => {
          if (!item || typeof item !== 'object') {
            console.warn('无效的场景项:', item);
            return null;
          }
          
          const { scene, probability } = item;
          if (typeof scene !== 'string' || typeof probability !== 'number') {
            console.warn('场景数据格式错误:', item);
            return null;
          }

          return {
            name: scene,
            probability: (probability * 100).toFixed(1)
          };
        })
        .filter(Boolean);

      console.log('处理后的场景数据:', JSON.stringify(topScenes, null, 2));

      if (topScenes.length === 0) {
        console.warn('没有有效的场景数据');
        setKeywords([]);
        return;
      }

      // 更新状态
      setKeywords(topScenes);
      setLastApiResponse(data);

      if (onAnalyze) {
        onAnalyze(data.data);
      }
    } catch (error) {
      console.error('详细错误信息:', error);
      setError(error.message || '上传过程中出错');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {/* 左侧上传和预览区域 */}
      <div className="w-full max-w-xl">
        <label className="block mb-2 text-sm font-medium text-gray-900">
          上传图片
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
        />

        {/* 预览区域 */}
        <div className="mt-4">
          <div className="relative w-full h-64 rounded-lg overflow-hidden shadow-lg bg-gray-100">
            {previewUrl ? (
              <div className="w-full h-full flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt="预览图"
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    console.error('图片加载错误:', e);
                    console.log('加载失败的图片URL开头:', previewUrl.substring(0, 50) + '...');
                    setError('图片加载失败');
                  }}
                  onLoad={() => {
                    console.log('图片加载成功');
                  }}
                />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-gray-400">请选择图片</span>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="text-red-500 text-sm mt-2">{error}</div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!selectedImage || loading}
          className={`mt-4 w-full px-6 py-2 rounded-lg shadow-md transition-all duration-200 ${
            !selectedImage || loading
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white hover:shadow-lg'
          }`}
        >
          {loading ? '分析中...' : '开始分析'}
        </button>
      </div>

      {/* 右侧分析结果区域 */}
      <div className="w-full max-w-xl mt-8">
        {/* 场景关键词卡片 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">场景分析结果</h2>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
            </div>
          ) : keywords.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {keywords.map((keyword, index) => (
                  <div
                    key={index}
                    className="bg-blue-50 rounded-lg p-4 flex flex-col items-center"
                  >
                    <span className="text-lg font-medium text-blue-700">
                      {keyword.name}
                    </span>
                    <span className="text-sm text-blue-500 mt-1">
                      可信度: {keyword.probability}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">暂无场景分析结果</p>
          )}
        </div>

        {/* 推荐音乐卡片 */}
        {lastApiResponse?.data?.playlist && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">推荐音乐</h2>
            <div className="grid grid-cols-1 gap-4">
              {lastApiResponse.data.playlist.map((track, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-4 bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors"
                >
                  {track.albumImage && (
                    <div className="flex-shrink-0">
                      <img
                        src={track.albumImage}
                        alt={track.name}
                        className="w-16 h-16 rounded-md shadow-sm object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <div className="flex-grow min-w-0">
                    <h3 className="text-lg font-medium text-gray-900 truncate">
                      {track.name}
                    </h3>
                    <p className="text-gray-500 truncate">{track.artist}</p>
                  </div>
                  {track.spotifyUrl && (
                    <a
                      href={track.spotifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 p-2 text-green-500 hover:text-green-700 transition-colors"
                    >
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                      </svg>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 调试面板 */}
      <div className="w-full max-w-xl mt-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">调试信息</h2>
          <div className="space-y-4">
            {error && (
              <div className="p-4 bg-red-50 rounded-lg">
                <h4 className="text-sm font-medium text-red-700 mb-2">错误信息：</h4>
                <pre className="text-xs bg-white p-2 rounded text-red-600">
                  {error}
                </pre>
              </div>
            )}
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">组件状态：</h4>
              <pre className="text-xs bg-white p-2 rounded">
                {JSON.stringify({
                  keywords: keywords,
                  loading: loading,
                  error: error,
                  hasImage: !!selectedImage,
                  previewUrl: previewUrl ? '已设置' : '未设置',
                  lastUpdate: new Date().toISOString()
                }, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 