// Stealth Mode Manager for Peeking Protection & Auto-Hide Choice
export class StealthManager {
    constructor() {
        this.autoHideChoice = localStorage.getItem('autoHideChoice') === 'true';
        this.toggleBtn = document.getElementById('hideChoiceToggle');
        this.deck = document.getElementById('cardDeck');
        this.lockedView = document.getElementById('stealthLockedView');

        this.bindEvents();
    }

    bindEvents() {
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => {
                if (this.onToggleCallback) {
                    this.onToggleCallback();
                } else {
                    this.toggle();
                }
            });
        }

        if (this.lockedView) {
            this.lockedView.addEventListener('click', () => {
                if (this.onToggleCallback) {
                    this.onToggleCallback();
                }
            });
        }
    }

    onToggle(callback) {
        this.onToggleCallback = callback;
    }

    toggle(hasSelectedCard = false) {
        this.autoHideChoice = !this.autoHideChoice;
        localStorage.setItem('autoHideChoice', this.autoHideChoice ? 'true' : 'false');
        this.updateDeckStealthState(hasSelectedCard);
    }

    updateDeckStealthState(hasSelectedCard) {
        if (!this.toggleBtn || !this.deck) return;

        if (this.autoHideChoice && hasSelectedCard) {
            // Completely hide the multi-card deck layout to prevent positional guessing
            this.deck.classList.add('stealth-locked');
            if (this.lockedView) this.lockedView.classList.remove('hidden');

            this.toggleBtn.classList.add('active', 'stealth-locked-btn');
            const icon = this.toggleBtn.querySelector('.stealth-icon');
            const text = this.toggleBtn.querySelector('.stealth-text');
            if (icon) icon.textContent = '🙈';
            if (text) text.textContent = 'Choice Hidden (Locked)';
        } else {
            // Restore full deck view for selection/viewing
            this.deck.classList.remove('stealth-locked');
            if (this.lockedView) this.lockedView.classList.add('hidden');

            this.toggleBtn.classList.remove('stealth-locked-btn');
            const icon = this.toggleBtn.querySelector('.stealth-icon');
            const text = this.toggleBtn.querySelector('.stealth-text');

            if (this.autoHideChoice) {
                this.toggleBtn.classList.add('active');
                if (icon) icon.textContent = '🙈';
                if (text) text.textContent = 'Auto-Hide: ON';
            } else {
                this.toggleBtn.classList.remove('active');
                if (icon) icon.textContent = '👁️';
                if (text) text.textContent = 'Auto-Hide Choice';
            }
        }
    }

    canSelectCard(hasSelectedCard) {
        if (this.autoHideChoice && hasSelectedCard && this.deck && this.deck.classList.contains('stealth-locked')) {
            return false;
        }
        return true;
    }

    maskFlyingCard(clone) {
        if (this.autoHideChoice) {
            const cardValueEl = clone.querySelector('.card-value');
            if (cardValueEl) {
                cardValueEl.textContent = '🙈';
            }
        }
    }
}
