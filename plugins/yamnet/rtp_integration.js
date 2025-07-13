/**
 * Integrazione RTP-YAMNet per analisi audio in tempo reale
 * Raccoglie pacchetti RTP PCMU8 e li invia al plugin YAMNet ogni 0.96 secondi
 */

export class RtpYamnetAnalyzer {
    constructor(scrypted) {
        this.scrypted = scrypted;
        this.yamnetPlugin = null;
        
        // Buffer per accumulare audio (0.96 secondi di frame)
        this.audioBuffer = [];
        this.frameTime = 0.96; // secondi
        this.sampleRate = 8000; // PCMU8 tipicamente a 8kHz
        this.targetSampleRate = 16000; // YAMNet richiede 16kHz
        this.samplesPerFrame = Math.floor(this.sampleRate * this.frameTime);
        
        // Timing
        this.lastFrameTime = Date.now();
        this.frameInterval = this.frameTime * 1000; // ms
        
        console.log(`RTP-YAMNet Analyzer inizializzato:`);
        console.log(`  Frame duration: ${this.frameTime}s`);
        console.log(`  Sample rate: ${this.sampleRate}Hz → ${this.targetSampleRate}Hz`);
        console.log(`  Samples per frame: ${this.samplesPerFrame}`);
    }

    async initialize() {
        try {
            // Ottieni il plugin YAMNet
            this.yamnetPlugin = await this.scrypted.systemManager.getDeviceByName("YAMNet Audio Classification");
            if (!this.yamnetPlugin) {
                throw new Error("Plugin YAMNet non trovato");
            }
            console.log("✅ Plugin YAMNet connesso");
            
            // Verifica che supporti ObjectDetection
            const modelInfo = await this.yamnetPlugin.getDetectionModel();
            console.log(`📊 Modello: ${modelInfo.name}`);
            console.log(`🎯 Classi trigger: ${modelInfo.triggerClasses.length}`);
            
            return true;
        } catch (error) {
            console.error("❌ Errore inizializzazione YAMNet:", error);
            return false;
        }
    }

    /**
     * Completa la funzione originale per convertire PCMU8 in PCM float32
     */
    getAudioFromRtp_PCMU8(rtpPacket) {
        const RTP_HEADER_SIZE = 12;
        if (rtpPacket.length <= RTP_HEADER_SIZE) return null;

        const payload = rtpPacket.slice(RTP_HEADER_SIZE);
        const sampleCount = payload.length;
        if (sampleCount === 0) return null;

        // Converti PCMU8 (µ-law) in PCM lineare float32
        const pcmSamples = new Float32Array(sampleCount);
        
        for (let i = 0; i < payload.length; i++) {
            const muLawSample = payload[i];
            // Decodifica µ-law a PCM lineare
            const linearSample = this.muLawDecode(muLawSample);
            // Normalizza a [-1.0, 1.0]
            pcmSamples[i] = linearSample / 32768.0;
        }

        return {
            samples: pcmSamples,
            sampleCount: sampleCount,
            timestamp: Date.now()
        };
    }

    /**
     * Decodifica µ-law (PCMU8) in PCM lineare 16-bit
     */
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

    /**
     * Processa un pacchetto RTP e accumula audio
     */
    async processRtpPacket(rtpPacket) {
        try {
            // Estrai audio dal pacchetto RTP
            const audioData = this.getAudioFromRtp_PCMU8(rtpPacket);
            if (!audioData) return;

            // Aggiungi al buffer
            this.audioBuffer.push(...audioData.samples);

            // Controlla se abbiamo abbastanza campioni per un frame
            const now = Date.now();
            const timeSinceLastFrame = now - this.lastFrameTime;

            if (timeSinceLastFrame >= this.frameInterval && this.audioBuffer.length >= this.samplesPerFrame) {
                await this.processAudioFrame();
                this.lastFrameTime = now;
            }

        } catch (error) {
            console.error("❌ Errore processamento RTP:", error);
        }
    }

    /**
     * Processa un frame completo di audio (0.96s)
     */
    async processAudioFrame() {
        try {
            if (!this.yamnetPlugin) {
                console.warn("⚠️ Plugin YAMNet non disponibile");
                return;
            }

            // Prendi esattamente 0.96s di audio
            const frameSamples = this.audioBuffer.splice(0, this.samplesPerFrame);
            
            if (frameSamples.length < this.samplesPerFrame) {
                console.warn(`⚠️ Frame incompleto: ${frameSamples.length}/${this.samplesPerFrame} samples`);
                return;
            }

            console.log(`🎵 Processando frame audio: ${frameSamples.length} samples`);

            // Converti a 16kHz se necessario
            const resampledAudio = await this.resampleAudio(frameSamples, this.sampleRate, this.targetSampleRate);
            
            // Crea MediaObject
            const mediaObject = this.createAudioMediaObject(resampledAudio);
            
            // Rileva eventi audio con YAMNet
            const detectionResult = await this.yamnetPlugin.detectObjects(mediaObject);
            
            // Processa risultati
            await this.handleDetectionResults(detectionResult);

        } catch (error) {
            console.error("❌ Errore processamento frame:", error);
        }
    }

    /**
     * Resample audio da 8kHz a 16kHz (semplice interpolazione lineare)
     */
    async resampleAudio(samples, fromRate, toRate) {
        if (fromRate === toRate) {
            return new Float32Array(samples);
        }

        const ratio = toRate / fromRate;
        const outputLength = Math.floor(samples.length * ratio);
        const resampled = new Float32Array(outputLength);

        for (let i = 0; i < outputLength; i++) {
            const srcIndex = i / ratio;
            const srcIndexFloor = Math.floor(srcIndex);
            const srcIndexCeil = Math.min(srcIndexFloor + 1, samples.length - 1);
            const fraction = srcIndex - srcIndexFloor;

            // Interpolazione lineare
            resampled[i] = samples[srcIndexFloor] * (1 - fraction) + samples[srcIndexCeil] * fraction;
        }

        return resampled;
    }

    /**
     * Crea MediaObject per Scrypted
     */
    createAudioMediaObject(audioSamples) {
        // Converti Float32Array in Buffer
        const buffer = Buffer.from(audioSamples.buffer);
        
        return {
            mimeType: 'audio/pcm',
            data: buffer,
            metadata: {
                sampleRate: this.targetSampleRate,
                channels: 1,
                format: 'float32',
                duration: this.frameTime
            }
        };
    }

    /**
     * Gestisce i risultati della detection YAMNet
     */
    async handleDetectionResults(detectionResult) {
        if (!detectionResult || !detectionResult.detections) {
            console.log("🔇 Nessun evento audio rilevato");
            return;
        }

        console.log(`🎯 Rilevati ${detectionResult.detections.length} eventi audio:`);

        // Processa ogni detection
        for (const detection of detectionResult.detections) {
            const className = detection.className;
            const score = detection.score;
            const boundingBox = detection.boundingBox;

            console.log(`  📢 ${className}: ${(score * 100).toFixed(1)}% (${boundingBox[0].toFixed(2)}s-${boundingBox[2].toFixed(2)}s)`);

            // Controlla se è un evento importante
            await this.checkTriggerEvents(detection);
        }
    }

    /**
     * Controlla e gestisce eventi trigger
     */
    async checkTriggerEvents(detection) {
        const className = detection.className;
        const score = detection.score;
        const threshold = 0.6; // Soglia di confidenza

        if (score < threshold) return;

        // Eventi di sicurezza
        const securityEvents = ['Gunshot, gunfire', 'Breaking', 'Explosion', 'Screaming', 'Alarm'];
        if (securityEvents.some(event => className.includes(event))) {
            await this.handleSecurityEvent(detection);
            return;
        }

        // Eventi domestici
        const homeEvents = ['Doorbell', 'Baby cry, infant cry', 'Dog', 'Cat'];
        if (homeEvents.some(event => className.includes(event))) {
            await this.handleHomeEvent(detection);
            return;
        }

        // Eventi di comunicazione
        const commEvents = ['Speech', 'Conversation'];
        if (commEvents.some(event => className.includes(event))) {
            await this.handleCommunicationEvent(detection);
            return;
        }
    }

    async handleSecurityEvent(detection) {
        console.log(`🚨 EVENTO DI SICUREZZA: ${detection.className} (${(detection.score * 100).toFixed(1)}%)`);
        
        // Qui puoi integrare con notifiche Scrypted, registrazioni, ecc.
        try {
            // Esempio: invia notifica
            await this.scrypted.systemManager.notify({
                title: "Evento Audio di Sicurezza",
                body: `Rilevato: ${detection.className} (${(detection.score * 100).toFixed(1)}%)`,
                data: {
                    type: 'audio_security',
                    event: detection.className,
                    confidence: detection.score,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error("❌ Errore invio notifica sicurezza:", error);
        }
    }

    async handleHomeEvent(detection) {
        console.log(`🏠 EVENTO DOMESTICO: ${detection.className} (${(detection.score * 100).toFixed(1)}%)`);
        
        // Logica per automazioni domestiche
        const className = detection.className;
        
        if (className.includes('Doorbell')) {
            console.log("  → Attivazione luci ingresso");
            console.log("  → Notifica arrivo ospite");
        } else if (className.includes('Baby cry')) {
            console.log("  → Notifica genitori");
            console.log("  → Attivazione monitor video");
        } else if (className.includes('Dog') || className.includes('Cat')) {
            console.log("  → Log attività animale domestico");
        }
    }

    async handleCommunicationEvent(detection) {
        console.log(`💬 EVENTO COMUNICAZIONE: ${detection.className} (${(detection.score * 100).toFixed(1)}%)`);
        // Gestione eventi di conversazione/parlato
    }

    /**
     * Calcola decibel dal pacchetto RTP (funzione originale completata)
     */
    getDecibelsFromRtp_PCMU8(rtpPacket) {
        const audioData = this.getAudioFromRtp_PCMU8(rtpPacket);
        if (!audioData) return null;

        let sumSquares = 0;
        for (const sample of audioData.samples) {
            sumSquares += sample * sample;
        }

        if (sumSquares === 0) return -Infinity;

        const rms = Math.sqrt(sumSquares / audioData.samples.length);
        const decibels = 20 * Math.log10(rms);
        
        return decibels;
    }

    /**
     * Statistiche e monitoraggio
     */
    getStats() {
        return {
            bufferSize: this.audioBuffer.length,
            expectedSamples: this.samplesPerFrame,
            lastFrameTime: new Date(this.lastFrameTime),
            frameInterval: this.frameInterval,
            sampleRates: `${this.sampleRate}Hz → ${this.targetSampleRate}Hz`
        };
    }
}

// Esempio di utilizzo
export class RtpStreamAnalyzer {
    constructor(scrypted) {
        this.analyzer = new RtpYamnetAnalyzer(scrypted);
        this.isRunning = false;
    }

    async start() {
        const initialized = await this.analyzer.initialize();
        if (!initialized) {
            throw new Error("Impossibile inizializzare RTP-YAMNet Analyzer");
        }

        this.isRunning = true;
        console.log("🚀 RTP Stream Analyzer avviato");
    }

    async stop() {
        this.isRunning = false;
        console.log("⏹️ RTP Stream Analyzer fermato");
    }

    async onRtpPacket(rtpPacket) {
        if (!this.isRunning) return;
        
        await this.analyzer.processRtpPacket(rtpPacket);
    }

    getStats() {
        return this.analyzer.getStats();
    }
}

// Esempio di integrazione in un plugin Scrypted
export default class AudioStreamPlugin {
    constructor() {
        this.rtpAnalyzer = null;
    }

    async initialize() {
        this.rtpAnalyzer = new RtpStreamAnalyzer(scrypted);
        await this.rtpAnalyzer.start();
    }

    // Metodo chiamato quando arriva un pacchetto RTP
    async handleRtpPacket(rtpPacket) {
        if (this.rtpAnalyzer) {
            await this.rtpAnalyzer.onRtpPacket(rtpPacket);
        }
    }

    async getSettings() {
        const stats = this.rtpAnalyzer?.getStats() || {};
        return [
            {
                title: "RTP-YAMNet Status",
                description: "Stato dell'analizzatore audio",
                value: this.rtpAnalyzer?.isRunning ? "Attivo" : "Inattivo",
                readonly: true,
                key: "status"
            },
            {
                title: "Buffer Audio",
                description: "Samples nel buffer",
                value: `${stats.bufferSize || 0}/${stats.expectedSamples || 0}`,
                readonly: true,
                key: "buffer"
            },
            {
                title: "Sample Rate",
                description: "Conversione sample rate",
                value: stats.sampleRates || "N/A",
                readonly: true,
                key: "samplerate"
            }
        ];
    }
}