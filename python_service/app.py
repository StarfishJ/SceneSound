from flask import Flask, request, jsonify, render_template_string
from flask_cors import CORS
from PIL import Image
import os
from places365_model import Places365Model
import logging
from dotenv import load_dotenv
import io
import gc

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
            "allow_headers": ["Content-Type", "Accept"],
            "max_age": 3600
        },
        r"/health": {
            "origins": "*",
            "methods": ["GET"],
            "max_age": 3600
        }
    },
    supports_credentials=False
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
    </form>
    <div id="result"></div>

    <script>
        const form = document.getElementById('uploadForm');
        const loading = document.getElementById('loading');
        const result = document.getElementById('result');
        const imageInput = document.getElementById('image');

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
            
            try {
                const response = await fetch('/analyze', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json'
                    },
                    body: formData
                });
                if (!response.ok) {
                    throw new Error(`请求失败: ${response.status}`);
                }
                const data = await response.json();
                result.textContent = JSON.stringify(data, null, 2);
            } catch (error) {
                result.innerHTML = `<div class="error">错误：${error.message}</div>`;
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
def analyze_image():
    image = None
    try:
        scenes = []
        
        # 处理图片输入
        if 'image' in request.files:
            image_file = request.files['image']
            if not image_file.filename:
                logger.warning("收到空的图片文件")
                return jsonify({'error': 'Empty image file'}), 400
                
            logger.info(f"收到图片：{image_file.filename}")
            try:
                # 处理和压缩图片
                image = process_image(image_file)
                logger.info(f"图片处理完成，尺寸: {image.size}")
                
                # 预测场景
                image_scenes = model.predict(image=image)
                scenes.extend(image_scenes)
                logger.info(f"图片分析结果：{image_scenes}")
                
            except ValueError as ve:
                logger.error(f"图片验证错误：{str(ve)}")
                return jsonify({'error': str(ve)}), 400
            except Exception as e:
                logger.error(
                    f"处理图片时出错：{str(e)}", 
                    exc_info=True
                )
                return jsonify(
                    {'error': f'Image processing error: {str(e)}'}
                ), 400
            finally:
                # 清理图片对象
                if image:
                    image.close()
                    del image
                    gc.collect()
            
        # 处理文字输入
        if request.form.get('text'):
            text = request.form.get('text').strip()
            if not text:
                logger.warning("收到空的文本输入")
                return jsonify({'error': 'Empty text input'}), 400
                
            logger.info(f"收到文字：{text}")
            keywords = text.lower().split()
            for keyword in keywords:
                text_scene = {
                    'scene': keyword,
                    'probability': 0.95
                }
                scenes.append(text_scene)
            logger.info(f"文字分析结果：{scenes[-len(keywords):]}")
            
        if not scenes:
            logger.warning("没有提供有效的输入")
            return jsonify({'error': 'No valid input provided'}), 400
            
        # 按概率排序并去重（基于场景名称）
        unique_scenes = {}
        for scene in scenes:
            scene_name = scene['scene']
            if scene_name not in unique_scenes or scene['probability'] > unique_scenes[scene_name]['probability']:
                unique_scenes[scene_name] = scene
                
        scenes = sorted(unique_scenes.values(), key=lambda x: x['probability'], reverse=True)
        logger.info(f"最终分析结果：{scenes}")
            
        return jsonify({
            'success': True,
            'scenes': scenes
        })
        
    except Exception as e:
        logger.error(f"处理请求时发生错误：{str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.after_request
def after_request(response):
    # 获取请求的路径
    path = request.path
    origin = request.headers.get('Origin')
    
    # 为不同的路径设置不同的 CORS 头
    if path == '/analyze' and origin == 'https://scene-sound.vercel.app':
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Accept'
    elif path == '/health':
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET'
    
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