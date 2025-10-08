from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import io
from PIL import Image
import os
import requests
from places365_model import Places365Model
import logging
import time
import gc
import hashlib

app = Flask(__name__)

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 配置常量
MAX_IMAGE_SIZE = (400, 400)  # 减小最大图片尺寸以提高处理速度
MAX_FILE_SIZE = 2 * 1024 * 1024  # 2MB

# 初始化模型
try:
    logger.info("正在初始化 Places365 模型...")
    model = Places365Model()
    logger.info("模型初始化成功")
except Exception as e:
    logger.error(f"模型初始化失败: {str(e)}")
    model = None

# 简单的内存缓存
prediction_cache = {}

def process_image_from_base64(image_data):
    """从Base64数据处理图片，包括大小检查和压缩"""
    try:
        # 解码Base64数据
        image_bytes = base64.b64decode(image_data)
        
        # 检查文件大小
        if len(image_bytes) > MAX_FILE_SIZE:
            raise ValueError('Image file too large (max 2MB)')
        
        # 使用 PIL 的高效读取模式
        image = Image.open(io.BytesIO(image_bytes))
        
        # 检查图片格式
        if image.format not in ['JPEG', 'PNG', 'WebP']:
            raise ValueError(
                'Unsupported image format. Please use JPEG, PNG or WebP'
            )
            
        # 转换为RGB模式（如果需要）并立即释放原始图像
        if image.mode != 'RGB':
            new_image = image.convert('RGB')
            image.close()
            image = new_image
            
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
            # 使用更快的缩放算法
            new_image = image.resize(new_size, Image.Resampling.NEAREST)
            image.close()
            image = new_image
            
        # 强制加载图片数据到内存
        image.load()
        
        # 主动进行垃圾回收
        gc.collect()
        
        return image
    except Exception as e:
        logger.error(f"处理图片时出错: {str(e)}")
        if 'image' in locals():
            image.close()
        gc.collect()
        raise

# 明确允许的前端来源（Vercel 和 Azure Static Web Apps）
ALLOWED_ORIGINS = [
    "https://scene-sound.vercel.app",
    "https://lively-hill-05f432c0f.2.azurestaticapps.net",
]

# 启用并限制到特定 origins，允许常用头和方法
CORS(
    app,
    resources={r"/*": {
        "origins": ALLOWED_ORIGINS,
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Accept", "Origin", "Authorization"],
        "expose_headers": ["Content-Type"],
        "supports_credentials": False,
        "max_age": 3600,
    }}
)

@app.after_request
def after_request(response):
    """处理CORS响应头"""
    origin = request.headers.get('Origin')
    
    # 允许本地开发环境和生产环境
    if origin and origin in ALLOWED_ORIGINS:
        response.headers.update({
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Origin, Authorization',
            'Access-Control-Expose-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600',
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        })
    elif origin and origin.startswith('https://scene'):
        # 允许所有scene相关的域名
        response.headers.update({
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Origin, Authorization',
            'Access-Control-Expose-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600',
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        })
    
    # 处理预检请求
    if request.method == 'OPTIONS':
        return response
    
    return response

@app.route('/analyze', methods=['POST', 'OPTIONS'])
def analyze():
    if request.method == 'OPTIONS':
        # 预检请求快速通过，由 Flask-CORS 注入头
        return ("", 204)
    start_time = time.time()
    try:
        data = request.get_json()
        
        if 'image' in data:
            # 处理图片分析
            logger.info("收到图片分析请求")
            
            try:
                # 处理和压缩图片
                image_start = time.time()
                image = process_image_from_base64(data['image'])
                process_time = time.time() - image_start
                logger.info(f"图片处理完成，尺寸: {image.size}，处理时间: {process_time:.2f}秒")
                
                # 预测场景
                predict_start = time.time()
                
                # 生成图片哈希用于缓存
                image_hash = hashlib.md5(image.tobytes()).hexdigest()
                
                # 检查缓存
                if image_hash in prediction_cache:
                    logger.info("使用缓存结果")
                    image_scenes = prediction_cache[image_hash]
                else:
                    if model is not None:
                        logger.info("使用 Places365 模型进行场景分析...")
                        image_scenes = model.predict(image)
                        logger.info(f"模型分析完成，检测到 {len(image_scenes)} 个场景")
                        # 缓存结果（限制缓存大小）
                        if len(prediction_cache) < 100:  # 最多缓存100个结果
                            prediction_cache[image_hash] = image_scenes
                    else:
                        logger.warning("模型未初始化，返回默认场景")
                        image_scenes = [{"scene": "general", "probability": 0.5}]
                
                predict_time = time.time() - predict_start
                logger.info(f"场景预测完成，耗时: {predict_time:.2f}秒")
                
                # 为图片分析结果添加来源标记
                for scene in image_scenes:
                    scene['source'] = 'image'
                scenes = image_scenes
                
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
            
        elif 'text' in data:
            # 处理文本输入
            scenes = [{
                'scene': data['text'],
                'probability': 1.0,
                'source': 'text'
            }]
        else:
            return jsonify({"error": "No image or text provided"}), 400
        
        total_time = time.time() - start_time
        logger.info(f"总处理时间: {total_time:.2f}秒")
        
        return jsonify({
            "success": True,
            "scenes": scenes,
            "processing_time": {
                "total": total_time
            }
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/health', methods=['GET', 'OPTIONS'])
def health():
    if request.method == 'OPTIONS':
        return ("", 204)
    
    return jsonify({
        'status': 'healthy',
        'message': 'Service is running',
        'timestamp': time.time(),
        'cors_origins': ALLOWED_ORIGINS,
        'model_loaded': model is not None
    })

@app.route('/api/spotify-token', methods=['GET', 'OPTIONS'])
def get_spotify_token():
    if request.method == 'OPTIONS':
        return ("", 204)
    """获取Spotify访问令牌"""
    client_id = os.environ.get('SPOTIFY_CLIENT_ID')
    client_secret = os.environ.get('SPOTIFY_CLIENT_SECRET')
    
    if not client_id or not client_secret:
        return jsonify({"error": "Spotify credentials not configured"}), 500
    
    try:
        # 创建认证字符串
        auth_string = f"{client_id}:{client_secret}"
        auth_bytes = auth_string.encode('utf-8')
        auth_base64 = base64.b64encode(auth_bytes).decode('utf-8')
        
        # 请求token
        url = "https://accounts.spotify.com/api/token"
        headers = {
            "Authorization": f"Basic {auth_base64}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        data = {"grant_type": "client_credentials"}
        
        response = requests.post(url, headers=headers, data=data)
        response.raise_for_status()
        
        token_data = response.json()
        return jsonify(token_data)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)