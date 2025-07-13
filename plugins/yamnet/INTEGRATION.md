# Integrazione Plugin YAMNet con Scrypted

## Panoramica

Il plugin YAMNet integra il modello di classificazione audio di Google nel framework Scrypted, permettendo la classificazione in tempo reale di eventi audio in 521 categorie diverse.

## Architettura

Il plugin è basato sulla struttura del plugin OpenVINO esistente ma adattato per:

- **TensorFlow Lite**: Utilizza TFLite per inferenza efficiente
- **Audio Processing**: Preprocessing specifico per audio a 16kHz mono
- **YAMNet Model**: Modello pre-addestrato per 521 classi audio

## Interfacce Scrypted

Il plugin implementa le seguenti interfacce:

- `DeviceProvider`: Per esporre dispositivi di classificazione audio  
- `Settings`: Per configurazione del plugin
- `ScryptedDeviceBase`: Funzionalità base del dispositivo

## Metodi Pubblici

### `classify_samples(audio_buffer: bytes) -> Dict[str, Any]`

Classifica un buffer audio e restituisce i risultati.

**Parametri:**
- `audio_buffer`: Buffer contenente samples audio come bytes

**Ritorna:**
```python
{
    'top_prediction': {
        'class_name': str,
        'confidence': float,
        'class_index': int
    },
    'all_predictions': List[Dict],  # Top 10 predictions
    'embeddings_shape': Tuple,
    'num_frames': int
}
```

### `classify_samples_async(audio_buffer: bytes) -> Dict[str, Any]`

Versione asincrona di `classify_samples`.

## Utilizzo da Altri Plugin

```python
# Ottenere il plugin YAMNet
yamnet_plugin = await scrypted.systemManager.getDeviceByName("YAMNet Audio Classification")

# Classificare audio
audio_buffer = get_audio_samples()  # Implementazione specifica
result = await yamnet_plugin.classify_samples_async(audio_buffer)

print(f"Detected: {result['top_prediction']['class_name']}")
```

## Configurazione Audio

### Formato Richiesto

- **Sample Rate**: 16 kHz
- **Channels**: Mono (1 canale)
- **Format**: Float32 normalizzato [-1.0, 1.0]
- **Durata**: Minimo 0.975s per ottenere output

### Preprocessing Automatico

Il plugin gestisce automaticamente:
- Conversione stereo → mono
- Normalizzazione amplitude
- Resampling (se necessario)

## Modello YAMNet

### Specifiche

- **Input**: Waveform audio mono 16kHz
- **Output**: 
  - Scores: Probabilità per 521 classi
  - Embeddings: Features 1024-dimensionali
  - Spectrogram: Log-mel spectrogram

### Frame Processing

- **Frame Duration**: 0.96 secondi
- **Hop Duration**: 0.48 secondi 
- **Overlap**: 50%

## Prestazioni

- **Model Size**: ~4MB (TensorFlow Lite)
- **Inference Time**: <100ms per secondo di audio (CPU)
- **Memory Usage**: ~50MB per istanza

## Classi Audio Supportate

Il modello supporta 521 classi incluse:

- **Speech**: Parlato, conversazione, balbettio
- **Music**: Strumenti, generi musicali
- **Nature**: Animali, vento, pioggia
- **Urban**: Traffico, costruzioni, sirene
- **Home**: Elettrodomestici, campanelli
- E molte altre...

## Esempi di Utilizzo

### Integrazione con Sistema di Sicurezza

```python
# Rilevamento di eventi specifici
result = await yamnet.classify_samples_async(audio_buffer)

security_events = ['Gunshot', 'Breaking', 'Screaming', 'Alarm']
if result['top_prediction']['class_name'] in security_events:
    trigger_security_alert(result)
```

### Monitor Ambientale

```python
# Monitoraggio continuo dell'ambiente
while monitoring:
    audio_buffer = capture_audio_frame()
    result = await yamnet.classify_samples_async(audio_buffer)
    
    log_audio_event(
        timestamp=now(),
        event=result['top_prediction']['class_name'],
        confidence=result['top_prediction']['confidence']
    )
```

## Installazione Dipendenze

Il plugin richiede:

```bash
pip install tensorflow-lite numpy librosa scipy soundfile
```

## Limitazioni

- Richiede audio a 16kHz (resampling automatico disponibile)
- Ottimizzato per eventi audio brevi (< 10 secondi)
- Classificazione limitata alle 521 classi pre-addestrate
- Prestazioni dipendenti dalle risorse CPU disponibili

## Roadmap Future

- Supporto per modelli custom training
- Integrazione con sistemi di notifica Scrypted
- Ottimizzazioni per hardware specifico
- Cache intelligente per eventi ripetuti