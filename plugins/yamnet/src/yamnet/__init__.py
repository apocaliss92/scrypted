from __future__ import annotations

import asyncio
import concurrent.futures
import csv
import json
import os
import traceback
from typing import Any, Dict, List, Tuple

import numpy as np
import soundfile as sf
import librosa
import scipy.signal
import scrypted_sdk
from scrypted_sdk.other import SettingValue
from scrypted_sdk.types import Setting

try:
    import tensorflow as tf
    tf_available = True
except ImportError:
    tf_available = False


predictExecutor = concurrent.futures.ThreadPoolExecutor(1, "YAMNet-Predict")
prepareExecutor = concurrent.futures.ThreadPoolExecutor(1, "YAMNet-Prepare")


class YAMNetPlugin(scrypted_sdk.ScryptedDeviceBase, scrypted_sdk.Settings, scrypted_sdk.DeviceProvider):
    def __init__(self, nativeId: str | None = None):
        super().__init__(nativeId=nativeId)
        
        self.model_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "yamnet.tflite")
        self.class_map_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "yamnet_class_map.csv")
        
        # Load the TensorFlow Lite model
        if tf_available:
            self.interpreter = tf.lite.Interpreter(model_path=self.model_path)
            self.interpreter.allocate_tensors()
            
            # Get input and output details
            self.input_details = self.interpreter.get_input_details()
            self.output_details = self.interpreter.get_output_details()
            
            print("YAMNet model loaded successfully")
            print(f"Input shape: {self.input_details[0]['shape']}")
            print(f"Input type: {self.input_details[0]['dtype']}")
        else:
            print("TensorFlow not available. Please install tensorflow.")
            self.interpreter = None
        
        # Load class names
        self.class_names = self.load_class_names()
        print(f"Loaded {len(self.class_names)} class names")
        
        # Audio parameters for YAMNet
        self.sample_rate = 16000  # YAMNet expects 16kHz audio
        self.frame_duration = 0.96  # Each frame is 0.96 seconds
        self.hop_duration = 0.48    # Hop every 0.48 seconds

    def load_class_names(self) -> List[str]:
        """Load class names from CSV file"""
        class_names = []
        try:
            with open(self.class_map_path, 'r') as csvfile:
                reader = csv.DictReader(csvfile)
                for row in reader:
                    class_names.append(row['display_name'])
        except Exception as e:
            print(f"Error loading class names: {e}")
            # Fallback to generic class names
            class_names = [f"Class_{i}" for i in range(521)]
        
        return class_names

    def ensure_sample_rate(self, audio_data: np.ndarray, original_sample_rate: int, 
                          desired_sample_rate: int = 16000) -> np.ndarray:
        """Resample audio to the desired sample rate"""
        if original_sample_rate != desired_sample_rate:
            # Calculate target length
            duration = len(audio_data) / original_sample_rate
            target_length = int(duration * desired_sample_rate)
            
            # Resample using scipy
            audio_data = scipy.signal.resample(audio_data, target_length)
            
        return audio_data.astype(np.float32)

    def preprocess_audio(self, audio_buffer: bytes) -> np.ndarray:
        """
        Preprocess audio buffer for YAMNet inference
        YAMNet expects:
        - Single channel (mono) audio
        - 16 kHz sample rate  
        - Float32 values in range [-1.0, 1.0]
        """
        try:
            # Convert bytes to numpy array
            # Assume audio_buffer contains raw audio samples
            audio_data = np.frombuffer(audio_buffer, dtype=np.float32)
            
            # If stereo, convert to mono by averaging channels
            if len(audio_data.shape) > 1:
                audio_data = np.mean(audio_data, axis=1)
            
            # Ensure we have the right sample rate
            # Note: We assume input is already at 16kHz. In a real implementation,
            # you would need to determine the original sample rate
            audio_data = self.ensure_sample_rate(audio_data, 16000, 16000)
            
            # Normalize to [-1.0, 1.0] range
            if audio_data.dtype != np.float32:
                audio_data = audio_data.astype(np.float32)
            
            # Normalize if not already in the correct range
            max_val = np.max(np.abs(audio_data))
            if max_val > 1.0:
                audio_data = audio_data / max_val
                
            return audio_data
            
        except Exception as e:
            print(f"Error preprocessing audio: {e}")
            traceback.print_exc()
            raise

    def run_inference(self, audio_data: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Run YAMNet inference on preprocessed audio data
        Returns: (scores, embeddings, spectrogram)
        """
        if not tf_available or self.interpreter is None:
            raise RuntimeError("TensorFlow Lite interpreter not available")
        
        try:
            # Set input tensor
            self.interpreter.set_tensor(self.input_details[0]['index'], audio_data)
            
            # Run inference
            self.interpreter.invoke()
            
            # Get outputs
            # YAMNet typically has 3 outputs: scores, embeddings, spectrogram
            scores = self.interpreter.get_tensor(self.output_details[0]['index'])
            embeddings = self.interpreter.get_tensor(self.output_details[1]['index']) 
            spectrogram = self.interpreter.get_tensor(self.output_details[2]['index'])
            
            return scores, embeddings, spectrogram
            
        except Exception as e:
            print(f"Error running inference: {e}")
            traceback.print_exc()
            raise

    def classify_audio_buffer(self, audio_buffer: bytes) -> Dict[str, Any]:
        """
        Main method to classify audio buffer
        Returns classification results with confidence scores
        """
        try:
            # Preprocess audio
            audio_data = self.preprocess_audio(audio_buffer)
            
            # Run inference
            scores, embeddings, spectrogram = self.run_inference(audio_data)
            
            # Process results
            # Average scores across all frames for clip-level prediction
            mean_scores = np.mean(scores, axis=0)
            
            # Get top predictions
            top_indices = np.argsort(mean_scores)[::-1][:10]  # Top 10 predictions
            
            predictions = []
            for idx in top_indices:
                predictions.append({
                    'class_name': self.class_names[idx],
                    'confidence': float(mean_scores[idx]),
                    'class_index': int(idx)
                })
            
            # Get the top prediction
            top_prediction = predictions[0]
            
            result = {
                'top_prediction': top_prediction,
                'all_predictions': predictions,
                'embeddings_shape': embeddings.shape,
                'num_frames': scores.shape[0] if len(scores.shape) > 1 else 1
            }
            
            return result
            
        except Exception as e:
            print(f"Error classifying audio: {e}")
            traceback.print_exc()
            raise

    async def classify_audio_async(self, audio_buffer: bytes) -> Dict[str, Any]:
        """Async wrapper for audio classification"""
        def classify():
            return self.classify_audio_buffer(audio_buffer)
        
        return await asyncio.get_event_loop().run_in_executor(
            predictExecutor, classify
        )

    async def getSettings(self) -> List[Setting]:
        """Get plugin settings"""
        return [
            {
                "title": "Model Info",
                "description": f"YAMNet model with {len(self.class_names)} classes",
                "value": f"TensorFlow Lite: {'Available' if tf_available else 'Not Available'}",
                "readonly": True,
                "key": "model_info",
            },
            {
                "title": "Sample Rate",
                "description": "Audio sample rate (Hz)",
                "value": str(self.sample_rate),
                "readonly": True,
                "key": "sample_rate",
            }
        ]

    async def putSetting(self, key: str, value: SettingValue):
        """Handle setting changes"""
        self.storage.setItem(key, value)
        await self.onDeviceEvent(scrypted_sdk.ScryptedInterface.Settings.value, None)

    async def getDevice(self, nativeId: str) -> Any:
        """Get device instance"""
        # For now, just return self as we don't have sub-devices
        return self

    # Public API methods for other plugins to use
    def classify_samples(self, audio_buffer: bytes) -> Dict[str, Any]:
        """
        Public method for classifying audio samples
        This is the main entry point that other parts of Scrypted can call
        """
        return self.classify_audio_buffer(audio_buffer)

    async def classify_samples_async(self, audio_buffer: bytes) -> Dict[str, Any]:
        """
        Async version of classify_samples
        """
        return await self.classify_audio_async(audio_buffer)