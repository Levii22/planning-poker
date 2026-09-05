// Poker Table & Player Seat Layout Manager

export class TableManager {
    constructor(containerElement) {
        this.container = containerElement || document.getElementById('playersContainer');
        this.isLocalFlightActive = false;
        this.localSelectedValue = null;
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

    renderPlayers({ players, playerId, isHost, gameState, onOpenAvatarModal, onQuickReroll, onTransferHost }) {
        if (!this.container) return;

        const positions = this.calculatePositions(players.length);
        const existingPlayerEls = new Map();

        // Index existing player DOM elements by player ID
        this.container.querySelectorAll('.player[data-player-id]').forEach(el => {
            existingPlayerEls.set(el.dataset.playerId, el);
        });

        const activeIds = new Set(players.map(p => p.id));

        // Remove any players that left
        existingPlayerEls.forEach((el, id) => {
            if (!activeIds.has(id)) {
                el.remove();
                existingPlayerEls.delete(id);
            }
        });

        players.forEach((player, index) => {
            const pos = positions[index];
            const isMe = player.id === playerId;
            const canTransferHost = isHost && !isMe && !player.isHost;
            const isFlightIncoming = isMe && this.isLocalFlightActive;
            const hasSelected = player.hasSelected || (isMe && this.localSelectedValue !== null && gameState === 'voting');

            let playerEl = existingPlayerEls.get(player.id);

            if (!playerEl) {
                // First-time creation of player container
                playerEl = document.createElement('div');
                playerEl.dataset.playerId = player.id;
                this.container.appendChild(playerEl);
            }

            // In-place update container classes & CSS position variables (No innerHTML wipe!)
            playerEl.className = `player ${isMe ? 'is-me' : ''} ${hasSelected ? 'has-selected' : ''} ${player.isHost ? 'is-host' : ''} ${canTransferHost ? 'can-make-host' : ''} ${!player.active ? 'is-offline' : ''}`;
            playerEl.style.setProperty('--pos-x', `${pos.x}%`);
            playerEl.style.setProperty('--pos-y', `${pos.y}%`);
            playerEl.style.setProperty('--angle', `${pos.angle}deg`);

            // If DOM structure not built yet, create initial HTML once
            if (!playerEl.querySelector('.player-avatar')) {
                playerEl.innerHTML = `
                    <div class="player-avatar" style="background: ${player.color || 'var(--color-primary)'}">
                      <span class="avatar-emoji">${player.avatar || '👤'}</span>
                      <span class="host-badge ${player.isHost ? '' : 'hidden'}">👑</span>
                      <button class="make-host-btn ${canTransferHost ? '' : 'hidden'}" title="Make host">👑</button>
                      ${isMe ? `
                        <div class="avatar-actions">
                          <button class="avatar-action-btn quick-reroll-btn" title="Quick Reroll (🎲)">🎲</button>
                          <button class="avatar-action-btn quick-edit-btn" title="Customize Avatar (✏️)">✏️</button>
                        </div>
                      ` : ''}
                    </div>
                    <div class="player-name">${player.name}${isMe ? ' (You)' : ''}</div>
                    <div class="player-card-slot">
                      <div class="card-placeholder"></div>
                    </div>
                    <div class="selected-indicator hidden">✓</div>
                `;

                if (isMe) {
                    const avatarEl = playerEl.querySelector('.player-avatar');
                    const quickRerollBtn = playerEl.querySelector('.quick-reroll-btn');
                    const quickEditBtn = playerEl.querySelector('.quick-edit-btn');

                    quickRerollBtn?.addEventListener('click', (e) => {
                        e.stopPropagation();
                        onQuickReroll?.();
                    });

                    quickEditBtn?.addEventListener('click', (e) => {
                        e.stopPropagation();
                        onOpenAvatarModal?.(player.avatar, player.color);
                    });

                    avatarEl?.addEventListener('click', (e) => {
                        if (e.target.closest('.avatar-action-btn')) return;
                        onOpenAvatarModal?.(player.avatar, player.color);
                    });
                }

                const makeHostBtn = playerEl.querySelector('.make-host-btn');
                makeHostBtn?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    onTransferHost?.(player.id);
                });
            } else {
                // In-place update: only modify avatar if color or emoji changed
                const avatarEl = playerEl.querySelector('.player-avatar');
                if (avatarEl) {
                    const targetBg = player.color || 'var(--color-primary)';
                    if (avatarEl.style.background !== targetBg) {
                        avatarEl.style.background = targetBg;
                    }
                    const emojiEl = avatarEl.querySelector('.avatar-emoji');
                    if (emojiEl && emojiEl.textContent !== (player.avatar || '👤')) {
                        emojiEl.textContent = player.avatar || '👤';
                    }
                    const hostBadge = avatarEl.querySelector('.host-badge');
                    if (hostBadge) {
                        hostBadge.classList.toggle('hidden', !player.isHost);
                    }
                    const makeHostBtn = avatarEl.querySelector('.make-host-btn');
                    if (makeHostBtn) {
                        makeHostBtn.classList.toggle('hidden', !canTransferHost);
                    }
                }

                // In-place update player name if changed
                const nameEl = playerEl.querySelector('.player-name');
                const expectedName = `${player.name}${isMe ? ' (You)' : ''}`;
                if (nameEl && nameEl.textContent !== expectedName) {
                    nameEl.textContent = expectedName;
                }
            }

            // In-place update card slot & indicator without touching the rest of the avatar
            this.updatePlayerCardSlot(playerEl, {
                player,
                isMe,
                gameState,
                hasSelected,
                isFlightIncoming
            });
        });
    }

    static getFaceDownCardHTML() {
        return `
            <div class="card face-down">
              <div class="card-inner">
                <div class="card-back">
                  <span class="back-pattern">🃏</span>
                </div>
              </div>
            </div>
        `;
    }

    updatePlayerCardSlot(playerEl, { player, isMe, gameState, hasSelected, isFlightIncoming }) {
        const slotEl = playerEl.querySelector('.card-placeholder');
        const indicatorEl = playerEl.querySelector('.selected-indicator');
        if (!slotEl) return;

        // If local flight is mid-air, hold the landing target open without duplicate card
        if (isFlightIncoming) {
            slotEl.className = 'card-placeholder card-landing-target';
            if (indicatorEl) indicatorEl.classList.add('hidden');
            return;
        }

        slotEl.classList.remove('card-landing-target');

        if (gameState === 'revealed' && player.card !== null) {
            slotEl.className = 'card-placeholder card-placed';
            const existingRevealed = slotEl.querySelector('.card.revealed');
            if (!existingRevealed || existingRevealed.dataset.value !== String(player.card)) {
                slotEl.innerHTML = `
                  <div class="card revealed" data-value="${player.card}">
                    <div class="card-inner">
                      <div class="card-front">
                        <span class="card-value">${player.card}</span>
                      </div>
                      <div class="card-back"></div>
                    </div>
                  </div>
                `;
            }
            if (indicatorEl) indicatorEl.classList.remove('hidden');
        } else if (hasSelected) {
            slotEl.className = 'card-placeholder card-placed';
            // If already has face-down card, keep it intact (no re-render or flash)
            if (!slotEl.querySelector('.card.face-down')) {
                slotEl.innerHTML = TableManager.getFaceDownCardHTML();
            }
            if (indicatorEl) indicatorEl.classList.remove('hidden');
        } else {
            slotEl.className = 'card-placeholder';
            slotEl.innerHTML = '';
            if (indicatorEl) indicatorEl.classList.add('hidden');
        }
    }

    onFlightStart(value) {
        this.isLocalFlightActive = true;
        this.localSelectedValue = value;

        const mySlot = this.container?.querySelector('.player.is-me .card-placeholder');
        if (mySlot) {
            mySlot.classList.add('card-landing-target');
        }
    }

    onFlightLand(value) {
        this.isLocalFlightActive = false;
        this.localSelectedValue = value;

        const mySlot = this.container?.querySelector('.player.is-me .card-placeholder');
        const myPlayerEl = this.container?.querySelector('.player.is-me');

        if (mySlot) {
            mySlot.classList.remove('card-landing-target');
            mySlot.classList.add('card-placed');

            if (!mySlot.querySelector('.card.face-down')) {
                mySlot.innerHTML = TableManager.getFaceDownCardHTML();
            }

            const indicatorEl = myPlayerEl?.querySelector('.selected-indicator');
            if (indicatorEl) {
                indicatorEl.classList.remove('hidden');
            }
        }
    }

    reset() {
        this.isLocalFlightActive = false;
        this.localSelectedValue = null;
    }

    clear() {
        this.reset();
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    animatePlayerSelect(playerId) {
        const playerEl = this.container?.querySelector(`[data-player-id="${playerId}"]`);
        if (playerEl) {
            playerEl.classList.add('just-selected');
            setTimeout(() => playerEl.classList.remove('just-selected'), 800);
        }
    }

    animatePlayerJoin(playerId) {
        const playerEl = this.container?.querySelector(`[data-player-id="${playerId}"]`);
        if (playerEl) {
            playerEl.classList.add('player-enter');
            setTimeout(() => playerEl.classList.remove('player-enter'), 600);
        }
    }

    animatePlayerExit(playerId, onFinish) {
        const playerEl = this.container?.querySelector(`[data-player-id="${playerId}"]`);
        if (playerEl) {
            playerEl.classList.add('player-exit');
            setTimeout(() => onFinish?.(), 400);
        } else {
            onFinish?.();
        }
    }
}
