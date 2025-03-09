import torch
import torchvision.models as models
import torchvision.transforms as transforms
from PIL import Image
import numpy as np
import re
from typing import List, Dict, Tuple, Union
import os
import requests
from urllib.parse import urlparse


class Places365Model:
    def __init__(self):
        """初始化 Places365 模型"""
        # 预定义场景和置信度
        self.custom_scenes = {
            'beach': 0.85,
            'ocean': 0.75,
            'coast': 0.65,
            'sunset': 0.55
        }
        
        # 设置设备
        self.device = torch.device('cpu')  # 强制使用CPU以避免CUDA内存问题
        
        # 初始化模型
        self.model = models.resnet18(weights=None)
        num_ftrs = self.model.fc.in_features
        self.model.fc = torch.nn.Linear(num_ftrs, 365)
        
        # 加载预训练权重
        weights_path = 'resnet18_places365.pth.tar'
        if not os.path.exists(weights_path):
            url = 'http://places2.csail.mit.edu/models_places365/resnet18_places365.pth.tar'
            print(f"下载预训练模型权重从 {url}")
            response = requests.get(url)
            with open(weights_path, 'wb') as f:
                f.write(response.content)
        
        # 优化权重加载过程
        checkpoint = torch.load(weights_path, map_location='cpu')
        state_dict = {str.replace(k, 'module.', ''): v 
                     for k, v in checkpoint['state_dict'].items()}
        self.model.load_state_dict(state_dict)
        del checkpoint  # 立即释放checkpoint内存
        torch.cuda.empty_cache() if torch.cuda.is_available() else None
        
        self.model.eval()  # 设置为评估模式
        
        # 优化图像预处理
        self.preprocess = transforms.Compose([
            transforms.Resize((224, 224)),  # 直接调整到目标大小
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            )
        ])
        
        # 加载 Places365 类别标签
        self.places365_labels = self._load_places365_labels()

    def _load_places365_labels(self) -> List[str]:
        """加载 Places365 类别标签"""
        if not os.path.exists('categories_places365.txt'):
            url = 'https://raw.githubusercontent.com/CSAILVision/places365/master/categories_places365.txt'
            print(f"下载类别标签从 {url}")
            response = requests.get(url)
            with open('categories_places365.txt', 'wb') as f:
                f.write(response.content)
        
        labels = []
        with open('categories_places365.txt', 'r') as f:
            for line in f:
                # 移除前缀 'a/' 或 '/a'
                label = line.strip().split(' ')[0][3:]
                # 将标签中的'/'替换为'_'以保持一致性
                label = label.replace('/', '_')
                labels.append(label)
        return labels

    def predict(
        self, 
        image: Union[str, Image.Image, None] = None
    ) -> List[Dict[str, Union[str, float]]]:
        """预测场景，返回前5个最可能的Places365场景"""
        try:
            if image is None:
                return []

            # 加载和预处理图像
            if isinstance(image, str):
                img = Image.open(image).convert('RGB')
            elif isinstance(image, Image.Image):
                img = image.convert('RGB')
            else:
                raise ValueError("不支持的图片格式")

            # 预处理图像并确保释放内存
            input_tensor = self.preprocess(img)
            input_batch = input_tensor.unsqueeze(0)
            
            # 进行预测
            with torch.no_grad():
                output = self.model(input_batch)
                probabilities = torch.nn.functional.softmax(output[0], dim=0)
            
            # 获取前5个预测结果
            top5_prob, top5_idx = torch.topk(probabilities, 5)
            
            # 构建预测结果
            predictions = []
            for prob, idx in zip(top5_prob, top5_idx):
                predictions.append({
                    'scene': self.places365_labels[idx],
                    'probability': float(prob)
                })
            
            # 清理内存
            del input_tensor, input_batch, output, probabilities
            torch.cuda.empty_cache() if torch.cuda.is_available() else None
            
            return predictions
            
        except Exception as e:
            print(f"预测过程中出错: {str(e)}")
            return [] 