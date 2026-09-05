// Card Deck & Flying Card Animation Manager
import { wsClient } from './websocket.js';

export class DeckManager {
    constructor(deckContainer, cardsContainer, tableManager = null) {
        this.deckContainer = deckContainer || document.getElementById('cardDeck');
        this.cardsContainer = cardsContainer || document.getElementById('deckCards');
        this.tableManager = tableManager;
        this.selectedCard = null;
        this.activeFlight = null;
    }

    setTableManager(tableManager) {
        this.tableManager = tableManager;
    }

    renderDeck(cardValues, onCardSelected) {
        if (!this.cardsContainer) return;
        this.cardsContainer.innerHTML = '';

        cardValues.forEach((value, index) => {
            const card = document.createElement('div');
            card.className = 'deck-card';
            card.dataset.value = value;
            card.style.setProperty('--card-index', index);

            card.innerHTML = `
                <div class="card-inner">
                  <div class="card-front">
                    <span class="card-value">${value}</span>
                  </div>
                  <div class="card-back">
                    <span class="back-pattern">🃏</span>
                  </div>
                </div>
            `;

            card.addEventListener('click', () => {
                this.selectCard(value, card, onCardSelected);
            });
            this.cardsContainer.appendChild(card);
        });
    }

    selectCard(value, cardEl, onCardSelected) {
        // Clear previous selected card visuals
        this.cardsContainer?.querySelectorAll('.deck-card').forEach(c => {
            c.classList.remove('selected', 'picked-pop');
        });

        // Set active card with interactive pop feedback
        cardEl.classList.add('selected', 'picked-pop');
        setTimeout(() => cardEl.classList.remove('picked-pop'), 400);

        this.selectedCard = value;

        // Animate card flying to player seat with smooth flip & parabolic arc (Silent)
        this.animateCardSelection(cardEl, value);

        // Send to WebSocket
        wsClient.send('select_card', { card: value });

        onCardSelected?.(value);
    }

    animateCardSelection(cardEl, value) {
        // Cancel any active flight in progress
        if (this.activeFlight) {
            try {
                this.activeFlight.cancel();
            } catch (e) {}
            this.activeFlight = null;
        }

        const rect = cardEl.getBoundingClientRect();

        // Find current player's card slot
        const myPlayerSlot = document.querySelector('.player.is-me .card-placeholder');
        if (!myPlayerSlot) {
            return;
        }

        const targetRect = myPlayerSlot.getBoundingClientRect();
        if (!targetRect || targetRect.width === 0 || targetRect.height === 0) {
            return;
        }

        // Notify TableManager that local flight is starting
        this.tableManager?.onFlightStart?.(value);

        const flyingCard = document.createElement('div');
        flyingCard.className = 'flying-card';
        flyingCard.style.cssText = `
            position: fixed;
            left: ${rect.left}px;
            top: ${rect.top}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
            z-index: 9999;
            pointer-events: none;
            perspective: 800px;
            transform-origin: center center;
            will-change: transform;
        `;

        flyingCard.innerHTML = `
            <div class="flying-card-inner">
                <div class="flying-card-face flying-card-front">
                    <span class="flying-card-value">${value}</span>
                </div>
                <div class="flying-card-face flying-card-back">
                    <span class="flying-card-back-pattern">🃏</span>
                </div>
            </div>
        `;

        document.body.appendChild(flyingCard);

        // Center-to-center delta
        const startCenterX = rect.left + rect.width / 2;
        const startCenterY = rect.top + rect.height / 2;
        const targetCenterX = targetRect.left + targetRect.width / 2;
        const targetCenterY = targetRect.top + targetRect.height / 2;

        const deltaX = targetCenterX - startCenterX;
        const deltaY = targetCenterY - startCenterY;
        const targetScale = targetRect.width / rect.width;

        // Smooth parabolic arc + clean horizontal flip
        const keyframes = [
            {
                transform: 'translate3d(0, 0, 0) scale(1) rotateY(0deg)',
                offset: 0
            },
            {
                // Mid-flight: lift slightly upward into arc, flip to edge-on
                transform: `translate3d(${deltaX * 0.5}px, ${deltaY * 0.5 - 32}px, 0) scale(1.05) rotateY(90deg)`,
                offset: 0.5
            },
            {
                // Touchdown: land in slot, face-down
                transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${targetScale}) rotateY(180deg)`,
                offset: 1
            }
        ];

        const animation = flyingCard.animate(keyframes, {
            duration: 380,
            easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)',
            fill: 'forwards'
        });

        const cleanup = () => {
            if (flyingCard.parentNode) {
                flyingCard.remove();
            }
            if (this.activeFlight?.animation === animation) {
                this.activeFlight = null;
            }
        };

        this.activeFlight = {
            animation,
            cancel: () => {
                try {
                    animation.cancel();
                } catch (e) {}
                cleanup();
            }
        };

        animation.onfinish = () => {
            this.tableManager?.onFlightLand?.(value);
            cleanup();
        };

        animation.oncancel = () => {
            cleanup();
        };
    }

    reset() {
        this.selectedCard = null;
        if (this.activeFlight) {
            this.activeFlight.cancel();
            this.activeFlight = null;
        }
        this.cardsContainer?.querySelectorAll('.deck-card').forEach(c => {
            c.classList.remove('selected', 'picked-pop');
        });
    }

    show() {
        this.deckContainer?.classList.remove('hidden');
    }

    hide() {
        this.deckContainer?.classList.add('hidden');
    }

    animateEnter() {
        this.deckContainer?.classList.add('deck-enter');
        setTimeout(() => this.deckContainer?.classList.remove('deck-enter'), 500);
    }
}
