import torch
import torchvision.models as models
import torchvision.transforms as transforms
from PIL import Image
from typing import List, Dict, Union
import os
import requests
from azure.storage.blob import BlobServiceClient
import logging
from dotenv import load_dotenv

# 加载 .env 文件
load_dotenv()


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
        self.device = torch.device('cpu')

        # 设置日志
        self.logger = logging.getLogger(__name__)

        try:
            # 初始化模型
            self.model = models.resnet18(weights=None)
            self.model.fc = torch.nn.Linear(self.model.fc.in_features, 365)

            # 从Azure Blob Storage下载模型权重
            weights_path = self._download_model_from_blob()

            # 优化权重加载过程
            checkpoint = torch.load(weights_path, map_location='cpu')
            state_dict = {str.replace(k, 'module.', ''): v
                          for k, v in checkpoint['state_dict'].items()}
            self.model.load_state_dict(state_dict)
            del checkpoint, state_dict
            torch.cuda.empty_cache() if torch.cuda.is_available() else None

            self.model.eval()  # 设置为评估模式

            # 优化图像预处理
            self.preprocess = transforms.Compose([
                transforms.Resize(256),
                transforms.CenterCrop(224),
                transforms.ToTensor(),
                transforms.Normalize(
                    mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225]
                )
            ])

            # 加载 Places365 类别标签
            self.places365_labels = self._load_places365_labels()

            # 使用TorchScript优化模型
            example = torch.randn(1, 3, 224, 224)
            self.model = torch.jit.trace(self.model, example)
            del example
            torch.cuda.empty_cache() if torch.cuda.is_available() else None

        except Exception as e:
            self.logger.error(f"模型初始化失败: {str(e)}")
            raise

    def _download_model_from_blob(self) -> str:
        """从Azure Blob Storage下载模型文件"""
        weights_path = 'resnet18_places365.pth.tar'

        # 如果本地已有文件，直接返回
        if os.path.exists(weights_path):
            self.logger.info("本地模型文件已存在，跳过下载")
            return weights_path

        try:
            # 获取Azure存储连接字符串
            connection_string = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
            container_name = os.getenv('AZURE_STORAGE_CONTAINER', 'models')
            blob_name = 'resnet18_places365.pth.tar'

            if not connection_string:
                self.logger.warning("未找到Azure存储连接字符串，尝试从原始URL下载")
                return self._download_from_original_url()

            # 创建Blob服务客户端
            blob_service_client = BlobServiceClient.from_connection_string(
                connection_string)
            blob_client = blob_service_client.get_blob_client(
                container=container_name, blob=blob_name)

            self.logger.info(f"从Azure Blob Storage下载模型: {blob_name}")

            # 下载文件
            with open(weights_path, 'wb') as download_file:
                download_file.write(blob_client.download_blob().readall())

            self.logger.info("模型文件下载完成")
            return weights_path

        except Exception as e:
            self.logger.error(f"从Blob Storage下载失败: {str(e)}")
            self.logger.info("尝试从原始URL下载")
            return self._download_from_original_url()

    def _download_from_original_url(self) -> str:
        """从原始URL下载模型文件（备用方案）"""
        weights_path = 'resnet18_places365.pth.tar'

        if os.path.exists(weights_path):
            return weights_path

        url = ('http://places2.csail.mit.edu/models_places365/'
               'resnet18_places365.pth.tar')
        self.logger.info(f"从原始URL下载模型: {url}")

        response = requests.get(url)
        response.raise_for_status()

        with open(weights_path, 'wb') as f:
            f.write(response.content)

        self.logger.info("模型文件下载完成")
        return weights_path

    def _load_places365_labels(self) -> List[str]:
        """加载 Places365 类别标签"""
        if not os.path.exists('categories_places365.txt'):
            url = ('https://raw.githubusercontent.com/CSAILVision/'
                   'places365/master/categories_places365.txt')
            print(f"下载类别标签从 {url}")
            response = requests.get(url)
            with open('categories_places365.txt', 'wb') as f:
                f.write(response.content)

        labels = []
        with open('categories_places365.txt', 'r') as f:
            for line in f:
                label = line.strip().split(' ')[0][3:]
                label = label.replace('/', '_')
                labels.append(label)
        return labels

    @torch.no_grad()
    def predict(self, image: Image.Image) -> List[Dict[str, Union[str, float]]]:
        """预测场景，返回前5个最可能的Places365场景"""
        try:
            if image is None:
                return []

            # 预处理图像
            input_tensor = self.preprocess(image)
            input_batch = input_tensor.unsqueeze(0)

            # 进行预测
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
