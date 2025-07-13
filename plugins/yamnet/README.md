# YAMNet Audio Classification Plugin

Questo plugin utilizza il modello YAMNet di Google per la classificazione audio in tempo reale.

## Caratteristiche

- Classificazione di 521 classi audio diverse
- Utilizzo del modello pre-addestrato YAMNet di Google
- Supporto per audio mono a 16 kHz
- Interfaccia asincrona per prestazioni ottimali

## Utilizzo

Il plugin espone due metodi principali:

- `classify_samples(audio_buffer: bytes)` - Classificazione sincrona
- `classify_samples_async(audio_buffer: bytes)` - Classificazione asincrona

## Formato Audio

L'audio deve essere:
- Mono (singolo canale)
- 16 kHz sample rate
- Formato float32 normalizzato tra [-1.0, 1.0]

## Output

Il plugin restituisce un dizionario con:
- `top_prediction`: La classificazione con confidence più alta
- `all_predictions`: Le prime 10 classificazioni ordinate per confidence
- `embeddings_shape`: Forma degli embeddings estratti
- `num_frames`: Numero di frame processati