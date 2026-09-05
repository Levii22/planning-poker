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
