#!/usr/bin/env python3
"""
Script di test per il plugin YAMNet
"""

import os
import sys
import numpy as np

# Add the src directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

async def test_yamnet_plugin():
    """Test basic functionality of the YAMNet plugin"""
    
    try:
        from yamnet import YAMNetPlugin
        
        print("Initializing YAMNet plugin...")
        plugin = YAMNetPlugin()
        
        print("Plugin initialized successfully!")
        print(f"Number of classes: {len(plugin.class_names)}")
        print(f"Sample rate: {plugin.sample_rate} Hz")
        print(f"Trigger classes: {len(plugin.getTriggerClasses())}")
        
        # Create dummy audio data (1 second of random noise)
        duration = 1.0  # seconds
        sample_rate = 16000
        num_samples = int(duration * sample_rate)
        
        # Generate random audio data normalized to [-1, 1]
        dummy_audio = np.random.uniform(-1.0, 1.0, num_samples).astype(np.float32)
        
        # Convert to bytes
        audio_buffer = dummy_audio.tobytes()
        
        print(f"Testing with {len(audio_buffer)} bytes of dummy audio...")
        
        # Test 1: Original classification interface
        print("\n=== Testing Classification Interface ===")
        result = plugin.classify_samples(audio_buffer)
        
        print("Classification successful!")
        print(f"Top prediction: {result['top_prediction']['class_name']} "
              f"(confidence: {result['top_prediction']['confidence']:.3f})")
        
        print(f"Number of frames processed: {result['num_frames']}")
        print(f"Embeddings shape: {result['embeddings_shape']}")
        
        print("\nTop 5 predictions:")
        for i, pred in enumerate(result['all_predictions'][:5]):
            print(f"  {i+1}. {pred['class_name']}: {pred['confidence']:.3f}")
        
        # Test 2: ObjectDetection interface
        print("\n=== Testing ObjectDetection Interface ===")
        
        # Test getDetectionModel
        model_info = await plugin.getDetectionModel()
        print(f"Model name: {model_info['name']}")
        print(f"Input format: {model_info['inputFormat']}")
        print(f"Input size: {model_info['inputSize']}")
        print(f"Total classes: {len(model_info['classes'])}")
        print(f"Trigger classes: {len(model_info['triggerClasses'])}")
        
        # Test run_detection_audio
        detection_result = await plugin.run_detection_audio(audio_buffer)
        print(f"\nDetection result input dimensions: {detection_result['inputDimensions']}")
        print(f"Number of detections: {len(detection_result['detections'])}")
        
        if detection_result['detections']:
            top_detection = detection_result['detections'][0]
            print(f"Top detection: {top_detection['className']} "
                  f"(score: {top_detection['score']:.3f})")
            print(f"Temporal bounding box: {top_detection['boundingBox']}")
        
        # Test some trigger classes
        trigger_classes = plugin.getTriggerClasses()
        print(f"\nSample trigger classes:")
        for cls in trigger_classes[:10]:
            print(f"  - {cls}")
        
        print("\n=== All tests completed successfully! ===")
        return True
        
    except Exception as e:
        print(f"Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    import asyncio
    success = asyncio.run(test_yamnet_plugin())
    sys.exit(0 if success else 1)