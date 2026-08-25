// Synthetic Web Audio API Sound Effects Engine (Zero external dependencies)

class SoundManager {
    constructor() {
        this.ctx = null;
        this.muted = localStorage.getItem('poker_sound_muted') === 'true';
        this.listeners = [];

        // Resume AudioContext on first user interaction
        const unlockAudio = () => {
            this.initContext();
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
            window.removeEventListener('touchstart', unlockAudio);
        };

        window.addEventListener('click', unlockAudio, { passive: true });
        window.addEventListener('keydown', unlockAudio, { passive: true });
        window.addEventListener('touchstart', unlockAudio, { passive: true });
    }

    initContext() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        }
    }

    isMuted() {
        return this.muted;
    }

    toggleMute() {
        this.setMuted(!this.muted);
        return this.muted;
    }

    setMuted(muted) {
        this.muted = muted;
        localStorage.setItem('poker_sound_muted', String(this.muted));
        this.notifyListeners();
    }

    onMuteChange(callback) {
        this.listeners.push(callback);
    }

    notifyListeners() {
        this.listeners.forEach(cb => {
            try { cb(this.muted); } catch (e) { console.error(e); }
        });
    }

    // =========================================================================
    // SYNTHESIS SOUND EFFECTS
    // =========================================================================

    /**
     * Card Selection - Aerodynamic card moving / flight whoosh sound
     */
    playCardSelect() {
        if (this.muted) return;
        this.initContext();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;

        // --- Layer 1: Air Friction / Filtered Whoosh ---
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.25);
        if (!this.noiseBuffer) {
            this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const output = this.noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize); // Natural decaying noise
            }
        }

        const noiseSrc = this.ctx.createBufferSource();
        noiseSrc.buffer = this.noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.setValueAtTime(3.2, now);
        filter.frequency.setValueAtTime(380, now);
        filter.frequency.exponentialRampToValueAtTime(1900, now + 0.07);
        filter.frequency.exponentialRampToValueAtTime(450, now + 0.22);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.001, now);
        noiseGain.gain.linearRampToValueAtTime(0.22, now + 0.05);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        noiseSrc.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);

        noiseSrc.start(now);
        noiseSrc.stop(now + 0.24);

        // --- Layer 2: Card Aero Glide Body ---
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(540, now + 0.07);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.2);

        oscGain.gain.setValueAtTime(0.001, now);
        oscGain.gain.linearRampToValueAtTime(0.08, now + 0.04);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        osc.connect(oscGain);
        oscGain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.21);
    }

    /**
     * Round Start - Ascending melodic deal chime
     */
    playRoundStart() {
        if (this.muted) return;
        this.initContext();
        if (!this.ctx) return;

        const notes = [440, 554.37, 659.25]; // A4, C#5, E5 arpeggio
        notes.forEach((freq, index) => {
            const startTime = this.ctx.currentTime + index * 0.08;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, startTime);

            gain.gain.setValueAtTime(0.001, startTime);
            gain.gain.linearRampToValueAtTime(0.18, startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(startTime);
            osc.stop(startTime + 0.36);
        });
    }

    /**
     * Card Flip / Whoosh during results reveal
     */
    playCardFlip() {
        if (this.muted) return;
        this.initContext();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(580, now + 0.08);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.16);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.18);
    }

    /**
     * Consensus Victory Fanfare - Harmonic Major Chord
     */
    playConsensus() {
        if (this.muted) return;
        this.initContext();
        if (!this.ctx) return;

        // C5, E5, G5, C6 triumphant chord (softened volume)
        const chord = [523.25, 659.25, 783.99, 1046.50];
        chord.forEach((freq, idx) => {
            const startTime = this.ctx.currentTime + idx * 0.05;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, startTime);

            gain.gain.setValueAtTime(0.001, startTime);
            gain.gain.linearRampToValueAtTime(0.07, startTime + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.9);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(startTime);
            osc.stop(startTime + 0.95);
        });
    }

    /**
     * Subtle UI Click / Button Tap
     */
    playClick() {
        if (this.muted) return;
        this.initContext();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.03);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.04);
    }
}

export const soundManager = new SoundManager();
