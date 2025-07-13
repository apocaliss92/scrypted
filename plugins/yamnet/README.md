# YAMNet Audio Classification Plugin

Questo plugin utilizza il modello YAMNet di Google per la classificazione audio in tempo reale e implementa l'interfaccia **ObjectDetection** di Scrypted per compatibilità con il framework.

## Caratteristiche

- **521 Classi Audio**: Speech, musica, natura, urbano, casa, sicurezza
- **Interfaccia ObjectDetection**: Compatibile con il sistema di detection di Scrypted
- **Classi Trigger**: Eventi audio che possono attivare notifiche e automazioni
- **Audio Processing**: Preprocessing automatico per audio mono 16 kHz
- **Prestazioni**: Inferenza veloce con TensorFlow Lite

## Interfacce Scrypted

- `ObjectDetection`: Detection di eventi audio come oggetti temporali
- `DeviceProvider`: Gestione dispositivi audio  
- `Settings`: Configurazione plugin

## Utilizzo

### Interfaccia ObjectDetection (Principale)

```python
# Ottenere il plugin
yamnet = await scrypted.systemManager.getDeviceByName("YAMNet Audio Classification")

# Rilevare eventi audio da MediaObject
detection_result = await yamnet.detectObjects(audio_media_object)

# Controllare eventi trigger
for detection in detection_result['detections']:
    if detection['className'] in ['Gunshot', 'Breaking', 'Screaming']:
        trigger_security_alert(detection)
```

### Interfaccia Classificazione Diretta

```python
# Classificazione da buffer audio
result = await yamnet.classify_samples_async(audio_buffer)
top_class = result['top_prediction']['class_name']
confidence = result['top_prediction']['confidence']
```

## Classi Trigger

Eventi audio importanti che possono attivare automazioni:

- **Sicurezza**: Gunshot, Breaking, Explosion, Screaming, Alarm
- **Casa**: Doorbell, Baby cry, Dog, Cat, Fire alarm  
- **Comunicazione**: Speech, Conversation, Laughter
- **Veicoli**: Car, Siren, Emergency vehicle

## Formato Audio

- **Sample Rate**: 16 kHz (resampling automatico)
- **Channels**: Mono (conversione stereo→mono automatica)
- **Format**: Float32 normalizzato [-1.0, 1.0]
- **Durata**: Ottimale 0.96-10 secondi

## Output ObjectDetection

```python
{
    'detections': [
        {
            'className': 'Speech',
            'score': 0.85,
            'boundingBox': (0.0, 0, 1.5, 1.0)  # (start_time, 0, duration, 1)
        }
    ],
    'inputDimensions': (16000, 1, 24000)  # (sample_rate, channels, samples)
}
```

## Integrazione

Il plugin può essere utilizzato con:
- Sistemi di sicurezza per rilevare eventi pericolosi
- Automazioni domestiche per riconoscere campanelli, pianti, ecc.
- Monitoraggio ambientale per classificare suoni urbani/naturali
- Analisi audio in pipeline Scrypted esistenti

## Installazione

Il plugin richiede le dipendenze specificate in `requirements.txt`:
- TensorFlow Lite
- NumPy, SciPy, Librosa
- Scrypted SDK