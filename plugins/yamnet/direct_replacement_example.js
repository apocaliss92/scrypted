/**
 * ESEMPIO DIRETTO: Sostituzione della funzione originale getDecibelsFromRtp_PCMU8
 * Questo file mostra esattamente come modificare il tuo codice esistente
 */

// === LA TUA FUNZIONE ORIGINALE (completata) ===
export const getDecibelsFromRtp_PCMU8 = (rtpPacket) => {
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
    
    // Completamento della funzione
    if (sumSquares === 0) return -Infinity;
    const rms = Math.sqrt(sumSquares / sampleCount);
    const decibels = 20 * Math.log10(rms);
    
    return decibels;
}

// === NUOVA VERSIONE INTEGRATA CON YAMNET ===
export class AudioAnalyzer {
    constructor(scrypted) {
        this.scrypted = scrypted;
        this.yamnetPlugin = null;
        
        // Buffer per accumolare 0.96s di audio
        this.audioBuffer = [];
        this.frameSize = 7680; // 0.96s * 8000 Hz
        this.lastFrameTime = Date.now();
    }

    async initialize() {
        this.yamnetPlugin = await this.scrypted.systemManager.getDeviceByName("YAMNet Audio Classification");
        console.log("🎵 AudioAnalyzer inizializzato con YAMNet");
    }

    // === FUNZIONE SOSTITUTIVA PER LA TUA getDecibelsFromRtp_PCMU8 ===
    async getDecibelsFromRtp_PCMU8_Enhanced(rtpPacket) {
        // Calcola decibel (funzione originale)
        const decibels = this.calculateDecibels(rtpPacket);
        
        // Estrai audio per YAMNet
        const audioSamples = this.extractAudioSamples(rtpPacket);
        if (audioSamples) {
            this.audioBuffer.push(...audioSamples);
            
            // Ogni 0.96 secondi, analizza con YAMNet
            await this.checkAndAnalyze();
        }
        
        return decibels;
    }

    // Calcolo decibel (tua funzione originale)
    calculateDecibels(rtpPacket) {
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
        
        if (sumSquares === 0) return -Infinity;
        const rms = Math.sqrt(sumSquares / sampleCount);
        return 20 * Math.log10(rms);
    }

    // Estrae samples audio per YAMNet
    extractAudioSamples(rtpPacket) {
        const RTP_HEADER_SIZE = 12;
        if (rtpPacket.length <= RTP_HEADER_SIZE) return null;

        const payload = rtpPacket.slice(RTP_HEADER_SIZE);
        const samples = [];

        for (let i = 0; i < payload.length; i++) {
            // Decodifica µ-law → PCM lineare
            const muLawSample = payload[i];
            const linearSample = this.muLawDecode(muLawSample);
            // Normalizza per YAMNet [-1.0, 1.0]
            samples.push(linearSample / 32768.0);
        }

        return samples;
    }

    muLawDecode(muLawByte) {
        const BIAS = 0x84;
        muLawByte = ~muLawByte;
        const sign = (muLawByte & 0x80);
        const exponent = (muLawByte >> 4) & 0x07;
        const mantissa = muLawByte & 0x0F;
        
        let sample = mantissa << (exponent + 3);
        if (exponent !== 0) sample += BIAS << exponent;
        else sample += BIAS;
        
        if (sign !== 0) sample = -sample;
        return Math.max(-32635, Math.min(32635, sample));
    }

    async checkAndAnalyze() {
        const now = Date.now();
        
        // Ogni 0.96 secondi E se abbiamo abbastanza samples
        if (now - this.lastFrameTime >= 960 && this.audioBuffer.length >= this.frameSize) {
            
            // Prendi 0.96s di audio
            const frameSamples = this.audioBuffer.splice(0, this.frameSize);
            
            // Upsample 8kHz → 16kHz per YAMNet
            const upsampled = this.upsample(frameSamples);
            
            // Analizza con YAMNet
            await this.analyzeWithYamnet(upsampled);
            
            this.lastFrameTime = now;
        }
    }

    upsample(samples8k) {
        const samples16k = [];
        for (let i = 0; i < samples8k.length - 1; i++) {
            samples16k.push(samples8k[i]);
            samples16k.push((samples8k[i] + samples8k[i + 1]) / 2);
        }
        samples16k.push(samples8k[samples8k.length - 1]);
        return samples16k;
    }

    async analyzeWithYamnet(audioSamples) {
        if (!this.yamnetPlugin) return;

        try {
            // Crea MediaObject
            const buffer = Buffer.from(new Float32Array(audioSamples).buffer);
            const mediaObject = { mimeType: 'audio/pcm', data: buffer };

            // Analizza con YAMNet
            const result = await this.yamnetPlugin.detectObjects(mediaObject);
            
            if (result?.detections?.length > 0) {
                const top = result.detections[0];
                console.log(`🎯 ${top.className}: ${(top.score * 100).toFixed(1)}%`);
                
                // Eventi importanti
                this.handleEvent(top);
            }
            
        } catch (error) {
            console.error("❌ Errore YAMNet:", error);
        }
    }

    handleEvent(detection) {
        if (detection.score < 0.6) return;

        const event = detection.className;
        
        if (event.includes('Doorbell')) {
            console.log("🚪 Campanello rilevato!");
        } else if (event.includes('Baby cry')) {
            console.log("👶 Pianto bimbo!");
        } else if (event.includes('Dog') || event.includes('Cat')) {
            console.log("🐕 Animale domestico");
        } else if (event.includes('Speech')) {
            console.log("💬 Conversazione");
        } else if (event.includes('Breaking') || event.includes('Gunshot')) {
            console.log("🚨 ALLARME SICUREZZA!");
        }
    }
}

// === COME USARE NEL TUO CODICE ESISTENTE ===

/* 
// PRIMA (il tuo codice attuale):

export const getDecibelsFromRtp_PCMU8 = (rtpPacket) => {
    // ... la tua funzione
}

// In qualche parte del tuo codice:
function handleRtpPacket(packet) {
    const decibels = getDecibelsFromRtp_PCMU8(packet);
    console.log('Decibels:', decibels);
}


// DOPO (nuovo codice con YAMNet):

import { AudioAnalyzer } from './plugins/yamnet/direct_replacement_example.js';

const audioAnalyzer = new AudioAnalyzer(scrypted);
await audioAnalyzer.initialize();

// Sostituisci la tua funzione con:
async function handleRtpPacket(packet) {
    const decibels = await audioAnalyzer.getDecibelsFromRtp_PCMU8_Enhanced(packet);
    console.log('Decibels:', decibels);
    // Ora ogni 0.96s viene anche analizzato con YAMNet automaticamente!
}

*/

// === VERSIONE ANCORA PIÙ SEMPLICE (drop-in replacement) ===
export class DropInAudioAnalyzer {
    constructor(scrypted) {
        this.analyzer = new AudioAnalyzer(scrypted);
        this.initialized = false;
    }

    async init() {
        if (!this.initialized) {
            await this.analyzer.initialize();
            this.initialized = true;
        }
    }

    // Sostituzione DIRETTA della tua funzione originale
    async getDecibelsFromRtp_PCMU8(rtpPacket) {
        await this.init();
        return await this.analyzer.getDecibelsFromRtp_PCMU8_Enhanced(rtpPacket);
    }
}

// Uso semplicissimo:
/*
const analyzer = new DropInAudioAnalyzer(scrypted);

// Sostituisci OVUNQUE nel tuo codice:
// OLD: const db = getDecibelsFromRtp_PCMU8(packet);
// NEW: const db = await analyzer.getDecibelsFromRtp_PCMU8(packet);

// Fatto! Ora hai decibel + analisi YAMNet automatica ogni 0.96s
*/