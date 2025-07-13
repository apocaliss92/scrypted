#!/usr/bin/env python3
"""
Script di test per il plugin YAMNet
"""

import os
import sys
import numpy as np

# Add the src directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

def test_yamnet_plugin():
    """Test basic functionality of the YAMNet plugin"""
    
    try:
        from yamnet import YAMNetPlugin
        
        print("Initializing YAMNet plugin...")
        plugin = YAMNetPlugin()
        
        print("Plugin initialized successfully!")
        print(f"Number of classes: {len(plugin.class_names)}")
        print(f"Sample rate: {plugin.sample_rate} Hz")
        
        # Create dummy audio data (1 second of random noise)
        duration = 1.0  # seconds
        sample_rate = 16000
        num_samples = int(duration * sample_rate)
        
        # Generate random audio data normalized to [-1, 1]
        dummy_audio = np.random.uniform(-1.0, 1.0, num_samples).astype(np.float32)
        
        # Convert to bytes
        audio_buffer = dummy_audio.tobytes()
        
        print(f"Testing with {len(audio_buffer)} bytes of dummy audio...")
        
        # Test classification
        result = plugin.classify_samples(audio_buffer)
        
        print("Classification successful!")
        print(f"Top prediction: {result['top_prediction']['class_name']} "
              f"(confidence: {result['top_prediction']['confidence']:.3f})")
        
        print(f"Number of frames processed: {result['num_frames']}")
        print(f"Embeddings shape: {result['embeddings_shape']}")
        
        print("\nTop 5 predictions:")
        for i, pred in enumerate(result['all_predictions'][:5]):
            print(f"  {i+1}. {pred['class_name']}: {pred['confidence']:.3f}")
        
        print("\nTest completed successfully!")
        return True
        
    except Exception as e:
        print(f"Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_yamnet_plugin()
    sys.exit(0 if success else 1)