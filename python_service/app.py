from flask import Flask, request, jsonify, render_template_string
from flask_cors import CORS
import torch
from torchvision import transforms
from PIL import Image
import os
from places365_model import Places365Model
import logging
from dotenv import load_dotenv

# 配置日志
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

load_dotenv()

app = Flask(__name__)

# 获取环境变量
PORT = int(os.getenv('PORT', 5000))
ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', '*')

# 配置CORS
CORS(app, resources={r"/*": {"origins": ALLOWED_ORIGINS}})
app.debug = True  # 启用调试模式

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
    </style>
</head>
<body>
    <h1>场景分析测试</h1>
    <form id="uploadForm">
        <div class="form-group">
            <label for="image">选择图片：</label>
            <input type="file" id="image" name="image" accept="image/*">
        </div>
        <button type="submit">分析</button>
    </form>
    <div id="result"></div>

    <script>
        document.getElementById('uploadForm').onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData();
            const imageFile = document.getElementById('image').files[0];
            
            if (!imageFile) {
                document.getElementById('result').textContent = '错误：请选择一张图片';
                return;
            }
            
            formData.append('image', imageFile);
            
            try {
                const response = await fetch('http://localhost:5000/analyze', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                document.getElementById('result').textContent = JSON.stringify(data, null, 2);
            } catch (error) {
                document.getElementById('result').textContent = '错误：' + error.message;
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

@app.route('/analyze', methods=['POST'])
def analyze_image():
    logger.info("收到分析请求")
    try:
        scenes = []
        
        # 处理图片输入
        if 'image' in request.files:
            image_file = request.files['image']
            logger.info(f"收到图片：{image_file.filename}")
            image = Image.open(image_file).convert('RGB')
            image_scenes = model.predict(image=image)
            scenes.extend(image_scenes)
            logger.info(f"图片分析结果：{image_scenes}")
            
        # 处理文字输入
        if request.form.get('text'):
            text = request.form.get('text').strip()
            logger.info(f"收到文字：{text}")
            # 将文字分割成关键词
            keywords = text.lower().split()
            # 为每个关键词创建一个场景
            for keyword in keywords:
                text_scene = {
                    'scene': keyword,
                    'probability': 0.95
                }
                scenes.append(text_scene)
            logger.info(f"文字分析结果：{scenes[-len(keywords):]}")
            
        if not scenes:
            return jsonify({'error': 'No input provided'}), 400
            
        # 按概率排序并去重（基于场景名称）
        unique_scenes = {}
        for scene in scenes:
            scene_name = scene['scene']
            if scene_name not in unique_scenes or scene['probability'] > unique_scenes[scene_name]['probability']:
                unique_scenes[scene_name] = scene
                
        scenes = sorted(unique_scenes.values(), key=lambda x: x['probability'], reverse=True)
            
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

if __name__ == '__main__':
    logger.info("启动服务器...")
    app.run(host='0.0.0.0', port=PORT) 