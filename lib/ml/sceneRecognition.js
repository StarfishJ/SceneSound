import * as tf from '@tensorflow/tfjs';
import sharp from 'sharp';
import { places365Categories, sceneToMusicMapping, places365CategoryGroups } from './places365Config';

// 模型路径配置
const MODEL_PATH = process.env.MODEL_PATH || './models/googlenet_places365/model.json';

// 场景识别类
class SceneRecognizer {
  constructor() {
    this.model = null;
    this.categories = places365Categories;
    this.categoryGroups = places365CategoryGroups;
  }

  // 加载模型
  async loadModel() {
    if (!this.model) {
      try {
        this.model = await tf.loadGraphModel(MODEL_PATH);
        console.log('场景识别模型加载成功');
      } catch (error) {
        console.error('加载模型失败:', error);
        throw new Error('模型加载失败');
      }
    }
    return this.model;
  }

  // 预处理图像
  async preprocessImage(imageBuffer) {
    // 调整图像大小为 224x224
    const resizedImage = await sharp(imageBuffer)
      .resize(224, 224)
      .toBuffer();

    // 转换为张量并归一化
    const tensor = tf.tidy(() => {
      const img = tf.node.decodeImage(resizedImage, 3);
      // 归一化到 [0,1] 范围
      const normalized = img.div(255.0);
      // 扩展维度以匹配模型输入
      return normalized.expandDims(0);
    });

    return tensor;
  }

  // 获取场景类别组
  getCategoryGroup(scene) {
    for (const [group, categories] of Object.entries(this.categoryGroups)) {
      for (const [category, keywords] of Object.entries(categories)) {
        if (keywords.includes(scene)) {
          return { group, category };
        }
      }
    }
    return null;
  }

  // 场景识别
  async recognizeScene(imageBuffer) {
    try {
      // 确保模型已加载
      await this.loadModel();

      // 预处理图像
      const inputTensor = await this.preprocessImage(imageBuffer);

      // 进行预测
      const predictions = await tf.tidy(() => {
        const output = this.model.predict(inputTensor);
        return output.squeeze().arraySync();
      });

      // 清理
      inputTensor.dispose();

      // 获取前5个预测结果
      const topPredictions = predictions
        .map((prob, idx) => ({
          scene: this.categories[idx],
          probability: prob
        }))
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 5)
        .map(pred => ({
          ...pred,
          category: this.getCategoryGroup(pred.scene)
        }));

      // 获取音乐映射
      const musicStyles = this.getMusicStyles(topPredictions);

      return {
        scenes: topPredictions,
        musicStyles
      };
    } catch (error) {
      console.error('场景识别失败:', error);
      throw new Error('场景识别处理失败');
    }
  }

  // 获取音乐风格映射
  getMusicStyles(predictions) {
    return predictions.map(pred => {
      const styles = sceneToMusicMapping[pred.scene] || [];
      return {
        scene: pred.scene,
        category: pred.category,
        styles: styles.map(style => ({
          name: style,
          weight: pred.probability
        }))
      };
    });
  }
}

// 导出单例实例
export const sceneRecognizer = new SceneRecognizer(); 