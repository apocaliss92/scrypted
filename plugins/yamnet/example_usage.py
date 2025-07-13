#!/usr/bin/env python3
"""
Esempio di utilizzo del plugin YAMNet per la classificazione audio
"""

import asyncio
import numpy as np
from yamnet import YAMNetPlugin

async def main():
    """Esempio di utilizzo del plugin YAMNet"""
    
    # Inizializza il plugin
    yamnet = YAMNetPlugin()
    
    # Simula un buffer audio (1 secondo di audio a 16kHz)
    # In un caso reale, questo verrebbe da un microfono o file audio
    sample_rate = 16000
    duration = 1.0
    samples = int(sample_rate * duration)
    
    # Genera audio di esempio (rumore bianco)
    audio_data = np.random.uniform(-1.0, 1.0, samples).astype(np.float32)
    audio_buffer = audio_data.tobytes()
    
    print(f"Classificando {len(audio_buffer)} bytes di audio...")
    
    # Classificazione sincrona
    print("\n=== Classificazione Sincrona ===")
    result = yamnet.classify_samples(audio_buffer)
    
    print(f"Classe principale: {result['top_prediction']['class_name']}")
    print(f"Confidenza: {result['top_prediction']['confidence']:.3f}")
    
    print("\nPrime 5 classificazioni:")
    for i, pred in enumerate(result['all_predictions'][:5]):
        print(f"  {i+1}. {pred['class_name']}: {pred['confidence']:.3f}")
    
    # Classificazione asincrona
    print("\n=== Classificazione Asincrona ===")
    result_async = await yamnet.classify_samples_async(audio_buffer)
    
    print(f"Classe principale: {result_async['top_prediction']['class_name']}")
    print(f"Confidenza: {result_async['top_prediction']['confidence']:.3f}")
    
    print(f"\nFrames processati: {result_async['num_frames']}")
    print(f"Forma embeddings: {result_async['embeddings_shape']}")

if __name__ == "__main__":
    # Esempio di caricamento da file audio (commentato)
    """
    import soundfile as sf
    
    # Carica file audio
    audio_data, original_sr = sf.read("audio_file.wav")
    
    # Ricampiona a 16kHz se necessario
    if original_sr != 16000:
        import scipy.signal
        target_length = int(len(audio_data) * 16000 / original_sr)
        audio_data = scipy.signal.resample(audio_data, target_length)
    
    # Normalizza
    audio_data = audio_data.astype(np.float32)
    if audio_data.max() > 1.0:
        audio_data = audio_data / audio_data.max()
    
    audio_buffer = audio_data.tobytes()
    """
    
    asyncio.run(main())