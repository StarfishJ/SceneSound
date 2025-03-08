import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

export default function UploadSection({ onUpload, isLoading }) {
  const [textInput, setTextInput] = useState('');

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const formData = new FormData();
      formData.append('image', file);
      formData.append('text', textInput);
      
      try {
        onUpload(formData);
      } catch (error) {
        console.error('文件上传错误:', error);
      }
    }
  }, [onUpload, textInput]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif']
    },
    maxFiles: 1,
    disabled: isLoading
  });

  return (
    <div className="max-w-2xl mx-auto mb-12 space-y-6">
      <div className="w-full">
        <label htmlFor="text-input" className="block text-sm font-medium text-gray-700 mb-2">
          描述您想要的音乐风格或心情（可选）
        </label>
        <input
          id="text-input"
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="例如：轻松的爵士乐、欢快的流行音乐..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isLoading}
        />
      </div>

      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className="space-y-4">
          <div className="text-4xl text-gray-400">
            📷
          </div>
          {isLoading ? (
            <div className="text-gray-500">
              正在分析图片...
            </div>
          ) : isDragActive ? (
            <div className="text-blue-500">
              放开以上传图片
            </div>
          ) : (
            <div className="text-gray-500">
              拖放图片到这里，或点击选择图片
              <p className="text-sm mt-2">
                支持 JPG、PNG、GIF 格式，最大 5MB
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 