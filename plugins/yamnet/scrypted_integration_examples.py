#!/usr/bin/env python3
"""
Esempi di integrazione del plugin YAMNet con il sistema Scrypted
Questi esempi mostrano come utilizzare l'interfaccia ObjectDetection
"""

import asyncio
from typing import List, Dict, Any

# Esempi di uso del plugin YAMNet in scenari reali

class SecurityMonitor:
    """Monitor di sicurezza che utilizza YAMNet per rilevare eventi pericolosi"""
    
    def __init__(self, yamnet_plugin):
        self.yamnet = yamnet_plugin
        self.security_events = [
            'Gunshot, gunfire', 'Breaking', 'Explosion', 'Glass breaking',
            'Screaming', 'Crying, sobbing', 'Alarm', 'Fire alarm',
            'Smoke detector', 'Emergency vehicle', 'Siren'
        ]
    
    async def monitor_audio_stream(self, audio_source):
        """Monitora uno stream audio per eventi di sicurezza"""
        print("🔒 Avvio monitoraggio sicurezza audio...")
        
        # Simula lo streaming audio
        async for audio_frame in audio_source:
            try:
                # Usa l'interfaccia ObjectDetection
                detection_result = await self.yamnet.detectObjects(audio_frame)
                
                # Controlla eventi di sicurezza
                for detection in detection_result['detections']:
                    if detection['className'] in self.security_events:
                        await self.handle_security_event(detection, audio_frame)
                        
            except Exception as e:
                print(f"❌ Errore nel monitoraggio: {e}")
    
    async def handle_security_event(self, detection: Dict, audio_frame):
        """Gestisce un evento di sicurezza rilevato"""
        event_type = detection['className']
        confidence = detection['score']
        timestamp = detection['boundingBox'][0]  # start time
        
        print(f"🚨 EVENTO DI SICUREZZA RILEVATO!")
        print(f"   Tipo: {event_type}")
        print(f"   Confidenza: {confidence:.1%}")
        print(f"   Timestamp: {timestamp:.2f}s")
        
        # In un sistema reale, qui invieresti notifiche, 
        # attiveresti registrazioni, ecc.
        await self.send_security_alert(event_type, confidence)
    
    async def send_security_alert(self, event_type: str, confidence: float):
        """Invia alert di sicurezza al sistema Scrypted"""
        # Esempio di integrazione con notifiche Scrypted
        alert_data = {
            'type': 'audio_security_event',
            'event': event_type,
            'confidence': confidence,
            'timestamp': asyncio.get_event_loop().time()
        }
        print(f"📢 Invio notifica: {alert_data}")


class SmartHomeAudioAssistant:
    """Assistente domestico che riconosce eventi audio specifici"""
    
    def __init__(self, yamnet_plugin):
        self.yamnet = yamnet_plugin
        self.home_events = {
            'doorbell': ['Doorbell'],
            'baby': ['Baby cry, infant cry', 'Crying, sobbing'],
            'pets': ['Dog', 'Cat', 'Animal'],
            'kitchen': ['Microwave oven', 'Blender', 'Water'],
            'communication': ['Speech', 'Conversation', 'Telephone']
        }
    
    async def process_home_audio(self, audio_buffer: bytes):
        """Processa audio domestico e attiva automazioni"""
        
        # Usa l'interfaccia ObjectDetection
        result = await self.yamnet.detectObjects(
            self.create_audio_media_object(audio_buffer)
        )
        
        for detection in result['detections']:
            await self.handle_home_event(detection)
    
    async def handle_home_event(self, detection: Dict):
        """Gestisce eventi domestici rilevati"""
        event_class = detection['className']
        confidence = detection['score']
        
        # Controlla se è un evento che ci interessa
        for category, events in self.home_events.items():
            if event_class in events and confidence > 0.5:
                await self.trigger_automation(category, event_class, confidence)
    
    async def trigger_automation(self, category: str, event: str, confidence: float):
        """Attiva automazioni basate su eventi audio"""
        print(f"🏠 Automazione domestica attivata:")
        print(f"   Categoria: {category}")
        print(f"   Evento: {event}")
        print(f"   Confidenza: {confidence:.1%}")
        
        # Esempi di automazioni
        if category == 'doorbell':
            print("   → Accendo luci ingresso")
            print("   → Invio notifica al telefono")
            print("   → Avvio registrazione videocitofono")
            
        elif category == 'baby':
            print("   → Invio notifica ai genitori")
            print("   → Attivo monitor video camera")
            print("   → Abbasso volume TV/musica")
            
        elif category == 'pets':
            print("   → Controllo ciotole cibo/acqua")
            print("   → Registro attività animale domestico")
    
    def create_audio_media_object(self, audio_buffer: bytes):
        """Crea un MediaObject da buffer audio (simulato)"""
        # In un sistema reale, questo creerebbe un vero MediaObject
        return {
            'mimeType': 'audio/pcm',
            'data': audio_buffer
        }


class AudioAnalytics:
    """Sistema di analisi audio per insights domestici"""
    
    def __init__(self, yamnet_plugin):
        self.yamnet = yamnet_plugin
        self.daily_stats = {}
    
    async def analyze_daily_audio(self, audio_samples: List[bytes]):
        """Analizza i samples audio di una giornata"""
        print("📊 Analisi audio giornaliera...")
        
        all_detections = []
        
        for i, audio_sample in enumerate(audio_samples):
            print(f"   Analizzando sample {i+1}/{len(audio_samples)}")
            
            # Ottieni informazioni del modello
            model_info = await self.yamnet.getDetectionModel()
            
            # Simula detection su sample audio
            result = await self.yamnet.run_detection_audio(audio_sample)
            all_detections.extend(result['detections'])
        
        # Genera statistiche
        stats = self.generate_audio_statistics(all_detections)
        self.display_insights(stats, model_info)
        
        return stats
    
    def generate_audio_statistics(self, detections: List[Dict]) -> Dict:
        """Genera statistiche dai rilevamenti audio"""
        stats = {
            'total_detections': len(detections),
            'categories': {},
            'confidence_avg': 0.0,
            'top_events': []
        }
        
        if not detections:
            return stats
        
        # Conta eventi per categoria
        for detection in detections:
            event = detection['className']
            stats['categories'][event] = stats['categories'].get(event, 0) + 1
        
        # Calcola confidenza media
        stats['confidence_avg'] = sum(d['score'] for d in detections) / len(detections)
        
        # Top eventi
        stats['top_events'] = sorted(
            stats['categories'].items(), 
            key=lambda x: x[1], 
            reverse=True
        )[:10]
        
        return stats
    
    def display_insights(self, stats: Dict, model_info: Dict):
        """Mostra insights dell'analisi"""
        print(f"\n📈 Insights Audio Giornalieri")
        print(f"=" * 40)
        print(f"Modello: {model_info['name']}")
        print(f"Classi disponibili: {len(model_info['classes'])}")
        print(f"Trigger classes: {len(model_info['triggerClasses'])}")
        print(f"Formato input: {model_info['inputFormat']}")
        print(f"\nRilevamenti totali: {stats['total_detections']}")
        print(f"Confidenza media: {stats['confidence_avg']:.1%}")
        
        print(f"\n🔥 Top 5 Eventi Audio:")
        for event, count in stats['top_events'][:5]:
            percentage = (count / stats['total_detections']) * 100
            print(f"   {event}: {count} volte ({percentage:.1f}%)")


async def main_example():
    """Esempio principale di utilizzo"""
    from yamnet import YAMNetPlugin
    import numpy as np
    
    # Inizializza il plugin
    yamnet = YAMNetPlugin()
    print("🎵 Plugin YAMNet inizializzato")
    
    # Crea audio di esempio
    duration = 2.0
    sample_rate = 16000
    samples = int(duration * sample_rate)
    audio_buffer = np.random.uniform(-1.0, 1.0, samples).astype(np.float32).tobytes()
    
    # === Esempio 1: Monitor di Sicurezza ===
    print("\n" + "="*50)
    print("ESEMPIO 1: Monitor di Sicurezza")
    print("="*50)
    
    security_monitor = SecurityMonitor(yamnet)
    
    # Simula detection di sicurezza
    result = await yamnet.run_detection_audio(audio_buffer)
    if result['detections']:
        detection = result['detections'][0]
        # Simula che sia un evento di sicurezza
        detection['className'] = 'Breaking'
        detection['score'] = 0.85
        await security_monitor.handle_security_event(detection, None)
    
    # === Esempio 2: Smart Home ===
    print("\n" + "="*50)  
    print("ESEMPIO 2: Smart Home Assistant")
    print("="*50)
    
    smart_home = SmartHomeAudioAssistant(yamnet)
    await smart_home.process_home_audio(audio_buffer)
    
    # === Esempio 3: Analytics ===
    print("\n" + "="*50)
    print("ESEMPIO 3: Audio Analytics")
    print("="*50)
    
    analytics = AudioAnalytics(yamnet)
    
    # Simula analisi di più samples
    audio_samples = [audio_buffer] * 3  # 3 samples di esempio
    stats = await analytics.analyze_daily_audio(audio_samples)


if __name__ == "__main__":
    import sys
    import os
    
    # Add the src directory to the path
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))
    
    asyncio.run(main_example())