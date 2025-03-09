from flask import Flask, request, jsonify, render_template_string
from flask_cors import CORS
from PIL import Image
import os
from places365_model import Places365Model
import logging
from dotenv import load_dotenv
import io
import gc
import time

# 配置日志
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

load_dotenv()

app = Flask(__name__)

# 获取环境变量
PORT = int(os.getenv('PORT', 5000))
ALLOWED_ORIGINS = os.getenv(
    'ALLOWED_ORIGINS', 
    'https://scene-sound.vercel.app'
)

# 配置CORS
CORS(
    app, 
    resources={
        r"/analyze": {
            "origins": ALLOWED_ORIGINS.split(','),
            "methods": ["POST", "OPTIONS"],
            "allow_headers": ["Content-Type", "Accept", "Origin"],
            "expose_headers": ["Content-Type"],
            "supports_credentials": False,
            "max_age": 3600
        },
        r"/health": {
            "origins": "*",
            "methods": ["GET"],
            "max_age": 3600
        }
    }
)
app.debug = True  # 启用调试模式

# 配置常量
MAX_IMAGE_SIZE = (800, 800)  # 最大图片尺寸
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

# 初始化模型
try:
    model = Places365Model()
    logger.info("模型初始化成功")
except Exception as e:
    logger.error(f"模型初始化失败: {str(e)}")
    raise

# HTML 测试页面
HTML_TEMPLATE = '''
<!DOCTYPE html>
<html>
<head>
    <title>场景分析测试</title>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .form-group { margin-bottom: 20px; }
        #result { margin-top: 20px; white-space: pre-wrap; }
        .loading { display: none; color: #666; }
        .error { color: red; }
        .status { margin-top: 10px; color: #666; }
    </style>
</head>
<body>
    <h1>场景分析测试</h1>
    <form id="uploadForm">
        <div class="form-group">
            <label for="image">选择图片（最大5MB）：</label>
            <input type="file" id="image" name="image" accept="image/*">
        </div>
        <button type="submit">分析</button>
        <div id="loading" class="loading">处理中，请稍候...</div>
        <div id="status" class="status"></div>
    </form>
    <div id="result"></div>

    <script>
        const form = document.getElementById('uploadForm');
        const loading = document.getElementById('loading');
        const result = document.getElementById('result');
        const imageInput = document.getElementById('image');
        const status = document.getElementById('status');

        // 检查服务器状态
        async function checkHealth() {
            try {
                const response = await fetch('/health');
                const data = await response.json();
                status.textContent = `服务器状态: ${data.status}`;
            } catch (error) {
                status.textContent = `服务器状态检查失败: ${error.message}`;
            }
        }

        // 定期检查服务器状态
        checkHealth();
        setInterval(checkHealth, 30000);

        imageInput.onchange = function() {
            const file = this.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) {
                    result.innerHTML = '<div class="error">错误：图片大小不能超过5MB</div>';
                    this.value = '';
                    return;
                }
                if (!file.type.startsWith('image/')) {
                    result.innerHTML = '<div class="error">错误：请选择图片文件</div>';
                    this.value = '';
                    return;
                }
                // 显示图片信息
                status.textContent = `已选择图片: ${file.name}, 大小: ${(file.size/1024).toFixed(2)}KB`;
            }
        };

        form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData();
            const imageFile = imageInput.files[0];
            
            if (!imageFile) {
                result.innerHTML = '<div class="error">错误：请选择一张图片</div>';
                return;
            }
            
            formData.append('image', imageFile);
            loading.style.display = 'block';
            result.textContent = '';
            status.textContent = '正在上传并处理图片...';
            
            try {
                const startTime = Date.now();
                const response = await fetch('/analyze', {
                    method: 'POST',
                    body: formData
                });
                const endTime = Date.now();
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`请求失败: ${response.status} - ${errorText}`);
                }
                
                const data = await response.json();
                result.textContent = JSON.stringify(data, null, 2);
                status.textContent = `处理完成，耗时: ${(endTime - startTime)/1000}秒`;
            } catch (error) {
                result.innerHTML = `<div class="error">错误：${error.message}</div>`;
                status.textContent = '处理失败';
            } finally {
                loading.style.display = 'none';
            }
        };
    </script>
</body>
</html>
'''

@app.route('/', methods=['GET'])
def index():
    logger.info("访问根路由 /")
    try:
        return render_template_string(HTML_TEMPLATE)
    except Exception as e:
        logger.error(f"渲染模板失败: {str(e)}")
        return str(e), 500

@app.route('/test', methods=['GET'])
def test():
    logger.info("访问测试路由 /test")
    return "服务器正在运行"

def process_image(image_file):
    """处理上传的图片，包括大小检查和压缩"""
    try:
        # 检查文件大小
        image_file.seek(0, io.SEEK_END)
        file_size = image_file.tell()
        image_file.seek(0)
        
        if file_size > MAX_FILE_SIZE:
            raise ValueError('Image file too large (max 5MB)')
        
        # 使用 PIL 的高效读取模式
        image = Image.open(image_file)
        
        # 检查图片格式
        if image.format not in ['JPEG', 'PNG', 'WebP']:
            raise ValueError(
                'Unsupported image format. Please use JPEG, PNG or WebP'
            )
            
        # 转换为RGB模式（如果需要）
        if image.mode != 'RGB':
            image = image.convert('RGB')
            
        # 如果图片太大，进行缩放
        if (image.size[0] > MAX_IMAGE_SIZE[0] or 
            image.size[1] > MAX_IMAGE_SIZE[1]):
            # 计算缩放比例
            ratio = min(
                MAX_IMAGE_SIZE[0] / image.size[0],
                MAX_IMAGE_SIZE[1] / image.size[1]
            )
            new_size = (
                int(image.size[0] * ratio),
                int(image.size[1] * ratio)
            )
            image = image.resize(new_size, Image.Resampling.LANCZOS)
            
        # 强制加载图片数据到内存并释放文件句柄
        image.load()
        image_file.close()
        
        # 主动进行垃圾回收
        gc.collect()
        
        return image
    except Exception as e:
        logger.error(f"处理图片时出错: {str(e)}")
        if image_file:
            image_file.close()
        raise

@app.route('/analyze', methods=['POST'])
def analyze():
    """处理分析请求，支持图片和文本，或两者组合"""
    try:
        logger.info("开始处理分析请求")
        logger.info(f"请求头: {dict(request.headers)}")
        
        # 初始化场景列表
        scenes = []
        start_time = time.time()
        
        # 检查是否是JSON格式的纯文本请求
        if request.is_json:
            data = request.get_json()
            if not data or 'text' not in data:
                logger.error("JSON请求中没有文本内容")
                return jsonify({'error': 'No text in request'}), 400
                
            text = data['text'].strip()
            if not text:
                logger.error("文本内容为空")
                return jsonify({'error': 'Empty text'}), 400
                
            logger.info(f"收到文本：{text}")
            
            # 直接使用文本作为场景关键词
            scenes.append({
                'scene': text,
                'probability': 1.0,
                'source': 'text'
            })
            
            total_time = time.time() - start_time
            logger.info(f"文本处理完成，总时间: {total_time:.2f}秒")
            
            return jsonify({
                'success': True,
                'scenes': scenes,
                'processing_time': {
                    'total': total_time
                }
            })
        
        # 处理文本输入（如果有）
        text = request.form.get('text', '').strip()
        if text:
            logger.info(f"收到文本：{text}")
            scenes.append({
                'scene': text,
                'probability': 1.0,
                'source': 'text'
            })
        
        # 处理图片请求（如果有）
        if 'image' in request.files:
            image_file = request.files['image']
            if image_file.filename:
                logger.info(f"收到图片：{image_file.filename}")
                
                try:
                    # 处理和压缩图片
                    image_start = time.time()
                    image = process_image(image_file)
                    process_time = time.time() - image_start
                    logger.info(f"图片处理完成，尺寸: {image.size}，处理时间: {process_time:.2f}秒")
                    
                    # 预测场景
                    predict_start = time.time()
                    image_scenes = model.predict(image)
                    predict_time = time.time() - predict_start
                    logger.info(f"场景预测完成，耗时: {predict_time:.2f}秒")
                    
                    # 为图片分析结果添加来源标记
                    for scene in image_scenes:
                        scene['source'] = 'image'
                    scenes.extend(image_scenes)
                    
                except ValueError as ve:
                    logger.error(f"图片验证错误：{str(ve)}")
                    return jsonify({'error': str(ve)}), 400
                except Exception as e:
                    logger.error(f"处理图片时出错：{str(e)}", exc_info=True)
                    return jsonify({'error': f'Image processing error: {str(e)}'}), 500
                finally:
                    if 'image' in locals():
                        image.close()
                        del image
                        gc.collect()
        
        # 如果既没有文本也没有图片，返回错误
        if not scenes:
            logger.error("请求中既没有文本也没有图片")
            return jsonify({'error': 'No text or image in request'}), 400
        
        total_time = time.time() - start_time
        logger.info(f"总处理时间: {total_time:.2f}秒")
        
        return jsonify({
            'success': True,
            'scenes': scenes,
            'processing_time': {
                'total': total_time
            }
        })
                
    except Exception as e:
        logger.error(f"处理请求时发生错误：{str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.after_request
def after_request(response):
    """处理CORS响应头"""
    origin = request.headers.get('Origin')
    
    if origin in ALLOWED_ORIGINS.split(','):
        # 设置CORS响应头
        response.headers.update({
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Origin',
            'Access-Control-Expose-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600',
            'Vary': 'Origin'
        })
        
        # 对于预检请求，返回200状态码
        if request.method == 'OPTIONS':
            return response
    elif request.path == '/health':
        response.headers.update({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET'
        })
    
    # 添加缓存控制头
    response.headers.update({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    })
    
    return response

# 添加健康检查端点
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'message': 'Service is running'
    })

if __name__ == '__main__':
    logger.info("启动服务器...")
    app.run(host='0.0.0.0', port=PORT) 