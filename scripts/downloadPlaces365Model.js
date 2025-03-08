const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');
const tf = require('@tensorflow/tfjs-node');

const MODEL_DIR = path.join(__dirname, '../models/googlenet_places365');
const CLASSES_FILE = path.join(MODEL_DIR, 'categories_places365.txt');
const MODEL_URL = 'http://places2.csail.mit.edu/models_places365/googlenet_places365.caffemodel';
const PROTOTXT_URL = 'http://places2.csail.mit.edu/models_places365/deploy_googlenet_places365.prototxt';

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, response => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', err => {
      fs.unlink(dest);
      reject(err);
    });
  });
}

async function convertModel() {
  // 确保目录存在
  if (!fs.existsSync(MODEL_DIR)) {
    fs.mkdirSync(MODEL_DIR, { recursive: true });
  }

  try {
    console.log('下载 Caffe 模型文件...');
    await downloadFile(MODEL_URL, path.join(MODEL_DIR, 'googlenet_places365.caffemodel'));
    await downloadFile(PROTOTXT_URL, path.join(MODEL_DIR, 'deploy.prototxt'));

    console.log('转换模型为 TensorFlow.js 格式...');
    // 使用 tensorflowjs_converter 转换模型
    const command = `tensorflowjs_converter \
      --input_format=keras \
      --output_format=tfjs_layers_model \
      ${path.join(MODEL_DIR, 'googlenet_places365.caffemodel')} \
      ${path.join(MODEL_DIR, 'web_model')}`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('转换失败:', error);
        return;
      }
      console.log('模型转换完成');
    });

    // 下载类别文件
    console.log('下载类别文件...');
    const categoriesResponse = await fetch('https://raw.githubusercontent.com/CSAILVision/places365/master/categories_places365.txt');
    const categoriesText = await categoriesResponse.text();
    fs.writeFileSync(CLASSES_FILE, categoriesText);

    console.log('模型和类别文件准备完成');
  } catch (error) {
    console.error('下载或转换过程中出错:', error);
  }
}

// 运行转换脚本
convertModel(); 