// Game rendering and animation control
import { wsClient } from './websocket.js';

class Game {
    constructor() {
        this.playerId = null;
        this.roomCode = null;
        this.isHost = false;
        this.players = [];
        this.selectedCard = null;
        this.gameState = 'waiting';
        this.cardValues = [];
        this.filterActive = false;

        this.elements = {
            playersContainer: document.getElementById('playersContainer'),
            cardDeck: document.getElementById('cardDeck'),
            deckCards: document.getElementById('deckCards'),
            hostControls: document.getElementById('hostControls'),
            startRoundBtn: document.getElementById('startRoundBtn'),
            revealCardsBtn: document.getElementById('revealCardsBtn'),
            newRoundBtn: document.getElementById('newRoundBtn'),
            filterSimilarBtn: document.getElementById('filterSimilarBtn'),
            tableCenter: document.getElementById('tableCenter'),
            gameStatus: document.getElementById('gameStatus'),
            revealOverlay: document.getElementById('revealOverlay'),
            revealCards: document.getElementById('revealCards'),
            roomCodeDisplay: document.getElementById('roomCodeDisplay'),
            copyRoomCode: document.getElementById('copyRoomCode')
        };

        this.bindEvents();
    }

    bindEvents() {
        this.elements.startRoundBtn.addEventListener('click', () => this.startRound());
        this.elements.revealCardsBtn.addEventListener('click', () => this.revealCards());
        this.elements.newRoundBtn.addEventListener('click', () => this.newRound());
        this.elements.filterSimilarBtn.addEventListener('click', () => this.toggleFilter());
        this.elements.copyRoomCode.addEventListener('click', () => this.copyRoomCode());

        // WebSocket handlers
        wsClient.on('round_started', (msg) => this.onRoundStarted(msg));
        wsClient.on('player_selected', (msg) => this.onPlayerSelected(msg));
        wsClient.on('cards_revealed', (msg) => this.onCardsRevealed(msg));
        wsClient.on('round_reset', (msg) => this.onRoundReset(msg));
        wsClient.on('player_joined', (msg) => this.onPlayerJoined(msg));
        wsClient.on('player_left', (msg) => this.onPlayerLeft(msg));
        wsClient.on('became_host', () => this.onBecameHost());
        wsClient.on('reveal_closed', () => this.onRevealClosed());
        wsClient.on('host_transferred', (msg) => this.onHostTransferred(msg));
    }

    initialize(roomCode, playerId, isHost, roomState) {
        this.roomCode = roomCode;
        this.playerId = playerId;
        this.isHost = isHost;
        this.cardValues = roomState.cardValues || [];

        this.elements.roomCodeDisplay.textContent = roomCode;

        if (isHost) {
            this.elements.hostControls.classList.remove('hidden');
        }

        this.updateState(roomState);
        this.renderCardDeck();
    }

    updateState(roomState) {
        this.players = roomState.players || [];
        this.gameState = roomState.state || 'waiting';

        this.renderPlayers();
        this.updateUI();
    }

    renderPlayers() {
        const container = this.elements.playersContainer;
        container.innerHTML = '';

        const positions = this.calculatePositions(this.players.length);

        this.players.forEach((player, index) => {
            const pos = positions[index];
            const isMe = player.id === this.playerId;
            const canTransferHost = this.isHost && !isMe && !player.isHost;

            const playerEl = document.createElement('div');
            playerEl.className = `player ${isMe ? 'is-me' : ''} ${player.hasSelected ? 'has-selected' : ''} ${player.isHost ? 'is-host' : ''} ${canTransferHost ? 'can-make-host' : ''}`;
            playerEl.dataset.playerId = player.id;
            playerEl.style.setProperty('--pos-x', `${pos.x}%`);
            playerEl.style.setProperty('--pos-y', `${pos.y}%`);
            playerEl.style.setProperty('--angle', `${pos.angle}deg`);

            playerEl.innerHTML = `
        <div class="player-avatar">
          <span class="avatar-letter">${player.name.charAt(0).toUpperCase()}</span>
          ${player.isHost ? '<span class="host-badge">👑</span>' : ''}
          ${canTransferHost ? '<button class="make-host-btn" title="Make host">👑</button>' : ''}
        </div>
        <div class="player-name">${player.name}${isMe ? ' (You)' : ''}</div>
        <div class="player-card-slot">
          <div class="card-placeholder ${player.hasSelected ? 'card-placed' : ''}">
            ${this.gameState === 'revealed' && player.card !== null ? `
              <div class="card revealed" data-value="${player.card}">
                <div class="card-inner">
                  <div class="card-front">
                    <span class="card-value">${player.card}</span>
                  </div>
                  <div class="card-back"></div>
                </div>
              </div>
            ` : player.hasSelected ? `
              <div class="card face-down">
                <div class="card-inner">
                  <div class="card-front"></div>
                  <div class="card-back">
                    <span class="back-pattern">🃏</span>
                  </div>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
        ${player.hasSelected ? '<div class="selected-indicator">✓</div>' : ''}
      `;

            // Add click handler for transfer host button
            if (canTransferHost) {
                const makeHostBtn = playerEl.querySelector('.make-host-btn');
                makeHostBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.transferHost(player.id);
                });
            }

            container.appendChild(playerEl);
        });
    }

    calculatePositions(count) {
        const positions = [];
        const tableWidth = 80; // percentage
        const tableHeight = 60;
        const centerX = 50;
        const centerY = 45;

        for (let i = 0; i < count; i++) {
            // Distribute around an ellipse
            const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
            const x = centerX + (tableWidth / 2) * Math.cos(angle);
            const y = centerY + (tableHeight / 2) * Math.sin(angle);

            positions.push({
                x,
                y,
                angle: (angle * 180 / Math.PI) + 90
            });
        }

        return positions;
    }

    renderCardDeck() {
        const container = this.elements.deckCards;
        container.innerHTML = '';

        this.cardValues.forEach((value, index) => {
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

            card.addEventListener('click', () => this.selectCard(value, card));
            container.appendChild(card);
        });
    }

    selectCard(value, cardEl) {
        if (this.gameState !== 'voting') return;

        // Remove previous selection
        this.elements.deckCards.querySelectorAll('.deck-card').forEach(c => {
            c.classList.remove('selected');
        });

        // Select new card
        cardEl.classList.add('selected');
        this.selectedCard = value;

        // Animate card flying to table
        this.animateCardSelection(cardEl);

        // Send to server
        wsClient.send('select_card', { card: value });
    }

    animateCardSelection(cardEl) {
        // Create flying card clone
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

        // Find my player's card slot
        const myPlayer = this.elements.playersContainer.querySelector('.player.is-me .card-placeholder');
        if (myPlayer) {
            const targetRect = myPlayer.getBoundingClientRect();

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

    updateUI() {
        // Update status badge
        const statusText = {
            'waiting': 'Waiting to Start',
            'voting': 'Vote Now!',
            'revealed': 'Cards Revealed'
        };
        this.elements.gameStatus.textContent = statusText[this.gameState] || 'Unknown';
        this.elements.gameStatus.className = `status-badge status-${this.gameState}`;

        // Update table center message
        const centerMessages = {
            'waiting': '<div class="waiting-text">Waiting to start...</div>',
            'voting': '<div class="voting-text">🗳️ Select your card!</div>',
            'revealed': '<div class="revealed-text">📊 Results are in!</div>'
        };
        this.elements.tableCenter.innerHTML = centerMessages[this.gameState] || '';

        // Card deck visibility
        if (this.gameState === 'voting') {
            this.elements.cardDeck.classList.remove('hidden');
        } else {
            this.elements.cardDeck.classList.add('hidden');
        }

        // Host controls
        if (this.isHost) {
            this.elements.startRoundBtn.classList.toggle('hidden', this.gameState !== 'waiting');
            this.elements.revealCardsBtn.classList.toggle('hidden', this.gameState !== 'voting');
            this.elements.newRoundBtn.classList.toggle('hidden', this.gameState !== 'revealed');
            this.elements.filterSimilarBtn.classList.toggle('hidden', this.gameState !== 'revealed');
        }
    }

    // Host actions
    startRound() {
        wsClient.send('start_round');
    }

    revealCards() {
        wsClient.send('reveal_cards');
    }

    newRound() {
        this.filterActive = false;
        this.selectedCard = null;
        this.elements.deckCards.querySelectorAll('.deck-card').forEach(c => {
            c.classList.remove('selected');
        });
        wsClient.send('reset_round');
    }

    toggleFilter() {
        this.filterActive = !this.filterActive;
        this.elements.filterSimilarBtn.classList.toggle('active', this.filterActive);

        if (this.filterActive) {
            this.highlightDifferences();
        } else {
            this.clearHighlights();
        }
    }

    highlightDifferences() {
        // Find the most common value
        const valueCounts = {};
        this.players.forEach(p => {
            if (p.card !== null && p.card !== '?' && p.card !== '☕') {
                valueCounts[p.card] = (valueCounts[p.card] || 0) + 1;
            }
        });

        const mostCommon = Object.entries(valueCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

        // Highlight players with different values
        this.elements.playersContainer.querySelectorAll('.player').forEach(playerEl => {
            const playerId = playerEl.dataset.playerId;
            const player = this.players.find(p => p.id === playerId);

            if (player && player.card !== null) {
                if (player.card === mostCommon) {
                    playerEl.classList.add('faded');
                    playerEl.classList.remove('highlighted');
                } else {
                    playerEl.classList.add('highlighted');
                    playerEl.classList.remove('faded');
                }
            }
        });
    }

    clearHighlights() {
        this.elements.playersContainer.querySelectorAll('.player').forEach(playerEl => {
            playerEl.classList.remove('faded', 'highlighted');
        });
    }

    copyRoomCode() {
        navigator.clipboard.writeText(this.roomCode).then(() => {
            this.elements.copyRoomCode.textContent = '✓';
            setTimeout(() => {
                this.elements.copyRoomCode.textContent = '📋';
            }, 2000);
        });
    }

    // WebSocket event handlers
    onRoundStarted(msg) {
        this.selectedCard = null;
        this.filterActive = false;

        // Clear any previously selected cards in the deck
        this.elements.deckCards.querySelectorAll('.deck-card').forEach(c => {
            c.classList.remove('selected');
        });

        this.updateState(msg.roomState);

        // Animate deck appearing
        this.elements.cardDeck.classList.add('deck-enter');
        setTimeout(() => this.elements.cardDeck.classList.remove('deck-enter'), 500);
    }

    onPlayerSelected(msg) {
        this.updateState(msg.roomState);

        // Add selection animation to the player
        const playerEl = this.elements.playersContainer.querySelector(`[data-player-id="${msg.playerId}"]`);
        if (playerEl) {
            playerEl.classList.add('just-selected');
            setTimeout(() => playerEl.classList.remove('just-selected'), 1000);
        }
    }

    onCardsRevealed(msg) {
        this.updateState(msg.roomState);
        this.playRevealAnimation(msg.revealOrder);
    }

    onRoundReset(msg) {
        this.selectedCard = null;
        this.filterActive = false;
        this.clearHighlights();
        this.updateState(msg.roomState);
    }

    onPlayerJoined(msg) {
        this.updateState(msg.roomState);

        // Find the new player and animate
        const playerEl = this.elements.playersContainer.querySelector(`[data-player-id="${msg.player.id}"]`);
        if (playerEl) {
            playerEl.classList.add('player-enter');
            setTimeout(() => playerEl.classList.remove('player-enter'), 600);
        }
    }

    onPlayerLeft(msg) {
        // Animate player leaving
        const playerEl = this.elements.playersContainer.querySelector(`[data-player-id="${msg.playerId}"]`);
        if (playerEl) {
            playerEl.classList.add('player-exit');
            setTimeout(() => {
                this.updateState(msg.roomState);
            }, 400);
        } else {
            this.updateState(msg.roomState);
        }
    }

    onBecameHost() {
        this.isHost = true;
        this.elements.hostControls.classList.remove('hidden');
        this.updateUI();
        this.renderPlayers(); // Re-render to show make host buttons
    }

    transferHost(playerId) {
        if (!this.isHost) return;
        wsClient.send('transfer_host', { playerId });
    }

    onHostTransferred(msg) {
        // Check if I'm the new host
        if (msg.newHostId === this.playerId) {
            this.isHost = true;
            this.elements.hostControls.classList.remove('hidden');
        } else if (this.isHost) {
            // I was the host but no longer am
            this.isHost = false;
            this.elements.hostControls.classList.add('hidden');
        }
        this.updateState(msg.roomState);
    }

    playRevealAnimation(revealOrder) {
        const overlay = this.elements.revealOverlay;
        const container = this.elements.revealCards;

        overlay.classList.remove('hidden');
        overlay.classList.add('active');
        container.innerHTML = '';

        // Phase 1: Dramatic countdown
        const countdownEl = document.createElement('div');
        countdownEl.className = 'reveal-countdown';
        countdownEl.innerHTML = '<span class="countdown-text">REVEALING...</span>';
        container.appendChild(countdownEl);

        // Phase 2: After countdown, show cards
        setTimeout(() => {
            container.innerHTML = '';

            // Add dramatic title
            const titleEl = document.createElement('div');
            titleEl.className = 'reveal-title';
            titleEl.innerHTML = '🃏 THE RESULTS 🃏';
            container.appendChild(titleEl);

            // Create card container
            const cardsWrapper = document.createElement('div');
            cardsWrapper.className = 'reveal-cards-wrapper';
            container.appendChild(cardsWrapper);

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

            // Trigger staggered flip animation with dramatic timing
            const cards = cardsWrapper.querySelectorAll('.reveal-card');
            cards.forEach((card, i) => {
                // Spotlight on each card before flip
                setTimeout(() => {
                    card.classList.add('spotlight');
                }, 400 + i * 700);

                // Flip the card
                setTimeout(() => {
                    card.classList.add('revealed');
                    card.classList.add('flip-now');
                    // Add impact effect
                    setTimeout(() => card.classList.add('impact'), 300);
                }, 700 + i * 700);
            });

            // Show summary and close button after all cards revealed
            const summaryDelay = 700 + (revealOrder.length * 700) + 500;
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
                container.appendChild(summaryEl);

                // Add close button (only visible to host)
                if (this.isHost) {
                    const closeBtn = document.createElement('button');
                    closeBtn.className = 'reveal-close-btn';
                    closeBtn.innerHTML = '✓ Continue to Discussion';
                    closeBtn.addEventListener('click', () => this.hostCloseReveal());
                    container.appendChild(closeBtn);
                }

            }, summaryDelay);

        }, 1200);

        // NO auto-close - host must click to close
    }

    hostCloseReveal() {
        // Host sends close message to all players
        wsClient.send('close_reveal');
        this.closeRevealOverlay();
    }

    onRevealClosed() {
        // Called when host closes reveal - close overlay for everyone
        this.closeRevealOverlay();
    }

    closeRevealOverlay() {
        const overlay = this.elements.revealOverlay;
        overlay.classList.add('fade-out');
        setTimeout(() => {
            overlay.classList.add('hidden');
            overlay.classList.remove('fade-out', 'active');
        }, 600);
    }
}

export const game = new Game();
