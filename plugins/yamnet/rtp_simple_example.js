/**
 * Esempio semplificato per integrare la funzione RTP originale con YAMNet
 * Basato sulla funzione getDecibelsFromRtp_PCMU8 originale dell'utente
 */

export class SimpleRtpYamnetIntegration {
    constructor(scrypted) {
        this.scrypted = scrypted;
        this.yamnetPlugin = null;
        
        // Buffer per accumulare audio ogni 0.96 secondi
        this.audioSamples = [];
        this.frameTime = 0.96; // secondi (frame duration di YAMNet)
        this.sampleRate = 8000; // PCMU8 a 8kHz
        this.targetSampleRate = 16000; // YAMNet richiede 16kHz
        this.samplesPerFrame = Math.floor(this.sampleRate * this.frameTime); // ~7680 samples
        
        this.lastFrameTime = Date.now();
        
        console.log(`Inizializzazione RTP→YAMNet:`);
        console.log(`  Frame: ${this.frameTime}s (${this.samplesPerFrame} samples @ ${this.sampleRate}Hz)`);
        console.log(`  Target: ${this.targetSampleRate}Hz per YAMNet`);
    }

    async initialize() {
        // Connetti al plugin YAMNet
        this.yamnetPlugin = await this.scrypted.systemManager.getDeviceByName("YAMNet Audio Classification");
        if (!this.yamnetPlugin) {
            throw new Error("Plugin YAMNet non trovato");
        }
        console.log("✅ Connesso al plugin YAMNet");
        return true;
    }

    // Funzione originale completata + conversione per YAMNet
    async processRtpPacket(rtpPacket) {
        // === PARTE 1: Funzione originale ===
        const RTP_HEADER_SIZE = 12;
        if (rtpPacket.length <= RTP_HEADER_SIZE) return null;

        const payload = rtpPacket.slice(RTP_HEADER_SIZE);
        const sampleCount = payload.length;
        if (sampleCount === 0) return null;

        // Converti PCMU8 in samples float32 per YAMNet
        const samples = [];
        let sumSquares = 0;
        
        for (let i = 0; i < payload.length; i++) {
            const sample = payload[i];
            
            // Decodifica µ-law → PCM lineare
            const linearSample = this.muLawDecode(sample);
            
            // Normalizza per YAMNet [-1.0, 1.0]
            const normalizedSample = linearSample / 32768.0;
            samples.push(normalizedSample);
            
            // Calcolo decibel (funzione originale)
            const centered = sample - 128;
            const normalized = centered / 128;
            sumSquares += normalized * normalized;
        }

        // Calcola decibel (completamento funzione originale)
        const rms = Math.sqrt(sumSquares / sampleCount);
        const decibels = rms > 0 ? 20 * Math.log10(rms) : -Infinity;

        // === PARTE 2: Accumula per YAMNet ===
        this.audioSamples.push(...samples);

        // Controlla se abbiamo 0.96s di audio
        const now = Date.now();
        if (now - this.lastFrameTime >= (this.frameTime * 1000) && 
            this.audioSamples.length >= this.samplesPerFrame) {
            
            await this.sendToYamnet();
            this.lastFrameTime = now;
        }

        return {
            decibels: decibels,
            sampleCount: sampleCount,
            timestamp: now
        };
    }

    // Decodifica µ-law (PCMU8) → PCM lineare
    muLawDecode(muLawByte) {
        const BIAS = 0x84;
        const CLIP = 32635;
        
        muLawByte = ~muLawByte;
        const sign = (muLawByte & 0x80);
        const exponent = (muLawByte >> 4) & 0x07;
        const mantissa = muLawByte & 0x0F;
        
        let sample = mantissa << (exponent + 3);
        if (exponent !== 0) {
            sample += BIAS << exponent;
        } else {
            sample += BIAS;
        }
        
        if (sign !== 0) {
            sample = -sample;
        }
        
        return Math.max(-CLIP, Math.min(CLIP, sample));
    }

    // Invia frame audio a YAMNet ogni 0.96 secondi
    async sendToYamnet() {
        try {
            if (!this.yamnetPlugin) {
                console.warn("⚠️ YAMNet non disponibile");
                return;
            }

            // Prendi esattamente 0.96s di audio
            const frameSamples = this.audioSamples.splice(0, this.samplesPerFrame);
            
            if (frameSamples.length < this.samplesPerFrame) {
                console.warn(`⚠️ Frame incompleto: ${frameSamples.length}/${this.samplesPerFrame}`);
                return;
            }

            console.log(`🎵 Invio a YAMNet: ${frameSamples.length} samples (${this.frameTime}s)`);

            // Upsample da 8kHz a 16kHz (YAMNet requirement)
            const resampledAudio = this.upsample8to16khz(frameSamples);
            
            // Crea MediaObject per Scrypted
            const buffer = Buffer.from(new Float32Array(resampledAudio).buffer);
            const mediaObject = {
                mimeType: 'audio/pcm',
                data: buffer
            };

            // Chiamata al plugin YAMNet con interfaccia ObjectDetection
            const detectionResult = await this.yamnetPlugin.detectObjects(mediaObject);
            
            // Processa risultati
            this.handleYamnetResults(detectionResult);

        } catch (error) {
            console.error("❌ Errore invio YAMNet:", error);
        }
    }

    // Upsample semplice 8kHz → 16kHz (interpolazione lineare)
    upsample8to16khz(samples8k) {
        const samples16k = [];
        
        for (let i = 0; i < samples8k.length - 1; i++) {
            // Sample originale
            samples16k.push(samples8k[i]);
            
            // Sample interpolato
            const interpolated = (samples8k[i] + samples8k[i + 1]) / 2;
            samples16k.push(interpolated);
        }
        
        // Ultimo sample
        samples16k.push(samples8k[samples8k.length - 1]);
        
        return samples16k;
    }

    // Gestisce risultati YAMNet
    handleYamnetResults(detectionResult) {
        if (!detectionResult?.detections?.length) {
            console.log("🔇 Nessun evento audio rilevato");
            return;
        }

        console.log(`🎯 YAMNet ha rilevato ${detectionResult.detections.length} eventi:`);

        // Mostra top detection
        const topDetection = detectionResult.detections[0];
        console.log(`  🔊 ${topDetection.className}: ${(topDetection.score * 100).toFixed(1)}%`);

        // Controlla eventi importanti
        this.checkImportantEvents(detectionResult.detections);
    }

    checkImportantEvents(detections) {
        const importantEvents = [
            'Speech', 'Doorbell', 'Baby cry, infant cry', 'Dog', 'Cat',
            'Gunshot, gunfire', 'Breaking', 'Alarm', 'Screaming'
        ];

        for (const detection of detections) {
            if (detection.score > 0.6 && importantEvents.some(event => 
                detection.className.includes(event))) {
                
                console.log(`🚨 EVENTO IMPORTANTE: ${detection.className} (${(detection.score * 100).toFixed(1)}%)`);
                
                // Qui puoi aggiungere logica per notifiche, registrazioni, etc.
                this.triggerAction(detection);
            }
        }
    }

    triggerAction(detection) {
        const className = detection.className;
        
        if (className.includes('Doorbell')) {
            console.log("  → Notifica: Qualcuno al campanello");
        } else if (className.includes('Baby cry')) {
            console.log("  → Notifica: Bimbo che piange");
        } else if (className.includes('Dog') || className.includes('Cat')) {
            console.log("  → Log: Attività animale domestico");
        } else if (className.includes('Gunshot') || className.includes('Breaking')) {
            console.log("  → ALLARME SICUREZZA!");
        } else if (className.includes('Speech')) {
            console.log("  → Rilevata conversazione");
        }
    }

    // Funzione originale dell'utente (completata)
    getDecibelsFromRtp_PCMU8(rtpPacket) {
        const RTP_HEADER_SIZE = 12;
        if (rtpPacket.length <= RTP_HEADER_SIZE) return null;

        const payload = rtpPacket.slice(RTP_HEADER_SIZE);
        const sampleCount = payload.length;
        if (sampleCount === 0) return null;

        let sumSquares = 0;
        for (let i = 0; i < payload.length; i++) {
            const sample = payload[i];
            const centered = sample - 128;
            const normalized = centered / 128;
            sumSquares += normalized * normalized;
        }

        // Completamento della funzione originale
        if (sumSquares === 0) return -Infinity;
        
        const rms = Math.sqrt(sumSquares / sampleCount);
        const decibels = 20 * Math.log10(rms);
        
        return decibels;
    }

    getStats() {
        return {
            bufferSize: this.audioSamples.length,
            targetSamples: this.samplesPerFrame,
            frameDuration: this.frameTime,
            sampleRates: `${this.sampleRate}Hz → ${this.targetSampleRate}Hz`
        };
    }
}

// === ESEMPIO DI UTILIZZO ===
export class RtpToYamnetBridge {
    constructor(scrypted) {
        this.integration = new SimpleRtpYamnetIntegration(scrypted);
        this.packetCount = 0;
    }

    async start() {
        await this.integration.initialize();
        console.log("🚀 RTP→YAMNet Bridge attivo");
    }

    // Chiamare questo metodo per ogni pacchetto RTP ricevuto
    async onRtpPacket(rtpPacket) {
        this.packetCount++;
        
        // Processa il pacchetto (calcola decibel + accumula per YAMNet)
        const result = await this.integration.processRtpPacket(rtpPacket);
        
        if (result) {
            // Opzionale: log decibel ogni 100 pacchetti
            if (this.packetCount % 100 === 0) {
                console.log(`📊 Packet #${this.packetCount}: ${result.decibels.toFixed(1)} dB`);
            }
        }
    }

    getStats() {
        return {
            packetsProcessed: this.packetCount,
            ...this.integration.getStats()
        };
    }
}

// ESEMPIO COMPLETO: Come integrare nel tuo codice esistente
/*

// 1. Inizializza il bridge
const rtpYamnetBridge = new RtpToYamnetBridge(scrypted);
await rtpYamnetBridge.start();

// 2. Per ogni pacchetto RTP che ricevi, chiama:
async function handleIncomingRtpPacket(rtpPacket) {
    // La tua funzione originale (ora integrata)
    await rtpYamnetBridge.onRtpPacket(rtpPacket);
}

// 3. Opzionale: monitora statistiche
setInterval(() => {
    const stats = rtpYamnetBridge.getStats();
    console.log('Stats:', stats);
}, 30000); // ogni 30 secondi

*/