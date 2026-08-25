// Card Deck & Flying Card Animation Manager
import { wsClient } from './websocket.js';
import { soundManager } from './audio.js';

export class DeckManager {
    constructor(deckContainer, cardsContainer) {
        this.deckContainer = deckContainer || document.getElementById('cardDeck');
        this.cardsContainer = cardsContainer || document.getElementById('deckCards');
        this.selectedCard = null;
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
        // Clear previous selected card visual
        this.cardsContainer?.querySelectorAll('.deck-card').forEach(c => {
            c.classList.remove('selected');
        });

        // Set active card
        cardEl.classList.add('selected');
        this.selectedCard = value;

        // Play audio FX
        soundManager.playCardSelect();

        // Animate card flying to player seat
        this.animateCardSelection(cardEl);

        // Send to WebSocket
        wsClient.send('select_card', { card: value });

        onCardSelected?.(value);
    }

    animateCardSelection(cardEl) {
        const rect = cardEl.getBoundingClientRect();
        const clone = cardEl.cloneNode(true);
        clone.className = 'flying-card';
        clone.style.cssText = `
            position: fixed;
            left: ${rect.left}px;
            top: ${rect.top}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
            z-index: 1000;
            pointer-events: none;
        `;

        document.body.appendChild(clone);

        // Find current player's card slot
        const myPlayerSlot = document.querySelector('.player.is-me .card-placeholder');
        if (myPlayerSlot) {
            const targetRect = myPlayerSlot.getBoundingClientRect();

            requestAnimationFrame(() => {
                clone.style.transition = 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
                clone.style.left = `${targetRect.left}px`;
                clone.style.top = `${targetRect.top}px`;
                clone.style.transform = 'scale(0.6) rotateY(180deg)';
            });

            setTimeout(() => clone.remove(), 600);
        } else {
            clone.remove();
        }
    }

    reset() {
        this.selectedCard = null;
        this.cardsContainer?.querySelectorAll('.deck-card').forEach(c => {
            c.classList.remove('selected');
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
