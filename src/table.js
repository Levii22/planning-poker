// Poker Table & Player Seat Layout Manager

export class TableManager {
    constructor(containerElement) {
        this.container = containerElement || document.getElementById('playersContainer');
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
        this.container.innerHTML = '';

        const positions = this.calculatePositions(players.length);

        players.forEach((player, index) => {
            const pos = positions[index];
            const isMe = player.id === playerId;
            const canTransferHost = isHost && !isMe && !player.isHost;

            const playerEl = document.createElement('div');
            playerEl.className = `player ${isMe ? 'is-me' : ''} ${player.hasSelected ? 'has-selected' : ''} ${player.isHost ? 'is-host' : ''} ${canTransferHost ? 'can-make-host' : ''} ${!player.active ? 'is-offline' : ''}`;
            playerEl.dataset.playerId = player.id;
            playerEl.style.setProperty('--pos-x', `${pos.x}%`);
            playerEl.style.setProperty('--pos-y', `${pos.y}%`);
            playerEl.style.setProperty('--angle', `${pos.angle}deg`);

            playerEl.innerHTML = `
                <div class="player-avatar" style="background: ${player.color || 'var(--color-primary)'}">
                  <span class="avatar-emoji">${player.avatar || '👤'}</span>
                  ${player.isHost ? '<span class="host-badge">👑</span>' : ''}
                  ${canTransferHost ? '<button class="make-host-btn" title="Make host">👑</button>' : ''}
                  ${isMe ? `
                    <div class="avatar-actions">
                      <button class="avatar-action-btn quick-reroll-btn" title="Quick Reroll (🎲)">🎲</button>
                      <button class="avatar-action-btn quick-edit-btn" title="Customize Avatar (✏️)">✏️</button>
                    </div>
                  ` : ''}
                </div>
                <div class="player-name">${player.name}${isMe ? ' (You)' : ''}</div>
                <div class="player-card-slot">
                  <div class="card-placeholder ${player.hasSelected ? 'card-placed' : ''}">
                    ${gameState === 'revealed' && player.card !== null ? `
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

            // Avatar click handlers for current player
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

            // Transfer host button
            if (canTransferHost) {
                const makeHostBtn = playerEl.querySelector('.make-host-btn');
                makeHostBtn?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    onTransferHost?.(player.id);
                });
            }

            this.container.appendChild(playerEl);
        });
    }

    animatePlayerSelect(playerId) {
        const playerEl = this.container?.querySelector(`[data-player-id="${playerId}"]`);
        if (playerEl) {
            playerEl.classList.add('just-selected');
            setTimeout(() => playerEl.classList.remove('just-selected'), 1000);
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
