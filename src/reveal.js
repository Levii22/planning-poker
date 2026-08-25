// Results Reveal & Consensus Animation Manager
import { triggerConfetti } from './confetti.js';
import { soundManager } from './audio.js';
import { wsClient } from './websocket.js';

export class RevealManager {
    constructor(overlayElement, containerElement) {
        this.overlay = overlayElement || document.getElementById('revealOverlay');
        this.container = containerElement || document.getElementById('revealCards');
    }

    checkConsensus(revealOrder) {
        const activeVotes = revealOrder.filter(p => p.card !== null && p.card !== '?' && p.card !== '☕');
        if (activeVotes.length <= 1) return false;

        const firstVote = activeVotes[0].card;
        return activeVotes.every(p => p.card === firstVote);
    }

    playRevealAnimation(revealOrder, isHost) {
        if (!this.overlay || !this.container) return;

        this.overlay.classList.remove('hidden');
        this.overlay.classList.add('active');
        this.container.innerHTML = '';

        // Phase 1: Dramatic countdown
        const countdownEl = document.createElement('div');
        countdownEl.className = 'reveal-countdown';
        countdownEl.innerHTML = '<span class="countdown-text">REVEALING...</span>';
        this.container.appendChild(countdownEl);

        // Phase 2: After countdown, show cards
        setTimeout(() => {
            this.container.innerHTML = '';

            // Add dramatic title
            const titleEl = document.createElement('div');
            titleEl.className = 'reveal-title';
            titleEl.innerHTML = '🃏 THE RESULTS 🃏';
            this.container.appendChild(titleEl);

            // Create card container
            const cardsWrapper = document.createElement('div');
            cardsWrapper.className = 'reveal-cards-wrapper';
            this.container.appendChild(cardsWrapper);

            // Create cards for reveal animation
            revealOrder.forEach((player, index) => {
                const cardEl = document.createElement('div');
                cardEl.className = 'reveal-card';
                cardEl.style.setProperty('--reveal-index', index);
                cardEl.style.setProperty('--total-cards', revealOrder.length);

                cardEl.innerHTML = `
                    <div class="reveal-player-name">${player.name}</div>
                    <div class="card flip-reveal">
                        <div class="card-inner">
                            <div class="card-front">
                                <span class="card-value">${player.card !== null ? player.card : '?'}</span>
                            </div>
                            <div class="card-back">
                                <span class="back-pattern">🃏</span>
                            </div>
                        </div>
                    </div>
                    <div class="reveal-spark"></div>
                `;

                cardsWrapper.appendChild(cardEl);
            });

            const cards = cardsWrapper.querySelectorAll('.reveal-card');
            cards.forEach((card, i) => {
                // Spotlight on each card before flip
                setTimeout(() => {
                    card.classList.add('spotlight');
                }, 100 + i * 250);

                // Flip the card
                setTimeout(() => {
                    card.classList.add('revealed');
                    card.classList.add('flip-now');
                    soundManager.playCardFlip();
                    // Add impact effect
                    setTimeout(() => card.classList.add('impact'), 200);
                }, 250 + i * 250);
            });

            const summaryDelay = 250 + (revealOrder.length * 250) + 500;

            setTimeout(() => {
                // Calculate stats
                const votes = revealOrder.filter(p => p.card !== null && p.card !== '?' && p.card !== '☕');

                const summaryEl = document.createElement('div');
                summaryEl.className = 'reveal-summary';
                summaryEl.innerHTML = `
                    <div class="summary-stat">
                        <span class="stat-value">${votes.length}</span>
                        <span class="stat-label">Votes</span>
                    </div>
                `;

                // Check if all players reached a consensus
                if (this.checkConsensus(revealOrder)) {
                    const consensusBadge = document.createElement('div');
                    consensusBadge.className = 'summary-stat';
                    consensusBadge.style.borderColor = 'var(--success)';
                    consensusBadge.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.3)';
                    consensusBadge.innerHTML = `
                        <span class="stat-value">🎉</span>
                        <span class="stat-label" style="color: var(--success); font-weight: 700;">Consensus!</span>
                    `;
                    summaryEl.appendChild(consensusBadge);
                    
                    // Trigger confetti & fanfare audio
                    triggerConfetti();
                    soundManager.playConsensus();
                }

                this.container.appendChild(summaryEl);

                // Add host close button
                if (isHost) {
                    const closeBtn = document.createElement('button');
                    closeBtn.className = 'reveal-close-btn';
                    closeBtn.innerHTML = '✓ Continue to Discussion';
                    closeBtn.addEventListener('click', () => {
                        wsClient.send('close_reveal');
                        this.closeOverlay();
                    });
                    this.container.appendChild(closeBtn);
                }

            }, summaryDelay);

        }, 300);
    }

    closeOverlay() {
        if (!this.overlay) return;
        this.overlay.classList.add('fade-out');
        setTimeout(() => {
            this.overlay.classList.add('hidden');
            this.overlay.classList.remove('fade-out', 'active');
        }, 600);
    }

    syncHostCloseButton(isHost) {
        if (!this.overlay?.classList.contains('active')) return;
        const existingBtn = this.container?.querySelector('.reveal-close-btn');

        if (isHost && !existingBtn) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'reveal-close-btn';
            closeBtn.innerHTML = '✓ Continue to Discussion';
            closeBtn.addEventListener('click', () => {
                wsClient.send('close_reveal');
                this.closeOverlay();
            });
            this.container?.appendChild(closeBtn);
        } else if (!isHost && existingBtn) {
            existingBtn.remove();
        }
    }
}
