// Game Coordinator & View Controller
import { wsClient } from './websocket.js';
import { TriviaTicker } from './trivia.js';
import { soundManager } from './audio.js';
import { AvatarManager } from './avatar.js';
import { TableManager } from './table.js';
import { DeckManager } from './deck.js';
import { RevealManager } from './reveal.js';

class Game {
    constructor() {
        this.playerId = null;
        this.roomCode = null;
        this.isHost = false;
        this.players = [];
        this.gameState = 'waiting';
        this.displayedGameState = null;
        this.cardValues = [];

        // Sub-managers
        this.triviaTicker = new TriviaTicker('triviaTicker');
        this.avatarManager = new AvatarManager();
        this.tableManager = new TableManager(document.getElementById('playersContainer'));
        this.deckManager = new DeckManager(
            document.getElementById('cardDeck'),
            document.getElementById('deckCards'),
            this.tableManager
        );
        this.revealManager = new RevealManager(
            document.getElementById('revealOverlay'),
            document.getElementById('revealCards')
        );

        this.elements = {
            gameView: document.getElementById('game'),
            hostControls: document.getElementById('hostControls'),
            startRoundBtn: document.getElementById('startRoundBtn'),
            revealCardsBtn: document.getElementById('revealCardsBtn'),
            newRoundBtn: document.getElementById('newRoundBtn'),
            tableCenter: document.getElementById('tableCenter'),
            gameStatus: document.getElementById('gameStatus'),
            roomCodeDisplay: document.getElementById('roomCodeDisplay'),
            copyRoomCode: document.getElementById('copyRoomCode'),
            hostModeToggle: document.getElementById('hostModeToggle'),
            triviaBanner: document.getElementById('triviaBanner'),
            soundToggleBtn: document.getElementById('soundToggleBtn')
        };

        this.updateSoundToggleUI();
        soundManager.onMuteChange(() => this.updateSoundToggleUI());

        this.bindEvents();
    }

    bindEvents() {
        this.elements.startRoundBtn.addEventListener('click', () => wsClient.send('start_round'));
        this.elements.revealCardsBtn.addEventListener('click', () => wsClient.send('reveal_cards'));
        this.elements.newRoundBtn.addEventListener('click', () => this.newRound());
        this.elements.copyRoomCode.addEventListener('click', () => this.copyRoomCode());
        this.elements.hostModeToggle.addEventListener('click', () => this.toggleHostMode());

        if (this.elements.soundToggleBtn) {
            this.elements.soundToggleBtn.addEventListener('click', () => this.toggleSound());
        }

        // WebSocket Handlers
        wsClient.on('round_started', (msg) => this.onRoundStarted(msg));
        wsClient.on('player_selected', (msg) => this.onPlayerSelected(msg));
        wsClient.on('cards_revealed', (msg) => this.onCardsRevealed(msg));
        wsClient.on('round_reset', (msg) => this.onRoundReset(msg));
        wsClient.on('player_joined', (msg) => this.onPlayerJoined(msg));
        wsClient.on('player_left', (msg) => this.onPlayerLeft(msg));
        wsClient.on('became_host', () => this.onBecameHost());
        wsClient.on('reveal_closed', () => this.revealManager.closeOverlay());
        wsClient.on('host_transferred', (msg) => this.onHostTransferred(msg));
        wsClient.on('host_mode_toggled', (msg) => this.onHostModeToggled(msg));
        wsClient.on('avatar_updated', (msg) => this.updateState(msg.roomState));
        wsClient.on('player_disconnected', (msg) => this.updateState(msg.roomState));
        wsClient.on('player_reconnected', (msg) => this.updateState(msg.roomState));
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

        if (roomState.ignoreHostVote !== undefined) {
            this.updateHostModeUI(roomState.ignoreHostVote);
        }

        this.updateState(roomState);
        this.deckManager.renderDeck(this.cardValues);
    }

    updateState(roomState) {
        this.players = roomState.players || [];
        this.gameState = roomState.state || 'waiting';

        this.renderPlayers();
        this.updateUI();
    }

    renderPlayers() {
        this.tableManager.renderPlayers({
            players: this.players,
            playerId: this.playerId,
            isHost: this.isHost,
            gameState: this.gameState,
            onOpenAvatarModal: (avatar, color) => this.avatarManager.openAvatarModal(avatar, color),
            onQuickReroll: () => this.avatarManager.quickRerollAvatar(),
            onTransferHost: (targetId) => this.transferHost(targetId)
        });
    }

    updateUI() {
        // Table Center Message & Status Badge - Only update when gameState actually changes!
        if (this.displayedGameState !== this.gameState) {
            this.displayedGameState = this.gameState;

            const statusText = {
                'waiting': 'Waiting to Start',
                'voting': 'Vote Now!',
                'revealed': 'Cards Revealed'
            };
            this.elements.gameStatus.textContent = statusText[this.gameState] || 'Unknown';
            this.elements.gameStatus.className = `status-badge status-${this.gameState}`;

            const centerMessages = {
                'waiting': '<div class="waiting-text">Waiting to start...</div>',
                'voting': '<div class="voting-text">🗳️ Select your card!</div>',
                'revealed': '<div class="revealed-text">📊 Results are in!</div>'
            };
            this.elements.tableCenter.innerHTML = centerMessages[this.gameState] || '';
        }

        // Ticker Banner
        if (this.elements.triviaBanner) {
            const existingTicker = document.getElementById('triviaTicker');
            if (existingTicker && !existingTicker.textContent) {
                existingTicker.textContent = this.triviaTicker.getCurrentJoke();
            }
            this.elements.triviaBanner.classList.remove('hidden');
            this.triviaTicker.start();
        }

        // Card Deck
        if (this.gameState === 'voting') {
            this.deckManager.show();
        } else {
            this.deckManager.hide();
        }

        // Host Controls
        if (this.isHost) {
            this.elements.startRoundBtn.classList.toggle('hidden', this.gameState !== 'waiting');
            this.elements.revealCardsBtn.classList.toggle('hidden', this.gameState !== 'voting');
            this.elements.newRoundBtn.classList.toggle('hidden', this.gameState !== 'revealed');
            this.elements.hostModeToggle.classList.remove('hidden');
        } else {
            this.elements.hostModeToggle.classList.add('hidden');
        }

        // Sync reveal host close button if open
        this.revealManager.syncHostCloseButton(this.isHost);
    }

    newRound() {
        this.revealManager.closeOverlay();
        this.deckManager.reset();
        this.tableManager.reset();
        wsClient.send('reset_round');
    }

    cleanup() {
        this.triviaTicker.stop();
        this.deckManager.reset();
        this.tableManager.clear();
        this.revealManager.closeOverlay();
        this.avatarManager.closeAvatarModal();

        this.playerId = null;
        this.roomCode = null;
        this.isHost = false;
        this.players = [];
        this.gameState = 'waiting';
        this.displayedGameState = null;
        this.cardValues = [];

        if (this.elements.hostControls) {
            this.elements.hostControls.classList.add('hidden');
        }
        if (this.elements.triviaBanner) {
            this.elements.triviaBanner.classList.add('hidden');
        }
    }

    toggleHostMode() {
        if (!this.isHost) return;
        wsClient.send('toggle_host_mode');
    }

    onHostModeToggled(msg) {
        this.updateHostModeUI(msg.ignoreHostVote);
        this.updateState(msg.roomState);
    }

    updateHostModeUI(isIgnoring) {
        if (isIgnoring) {
            this.elements.hostModeToggle.classList.add('mode-active');
            this.elements.hostModeToggle.querySelector('.btn-text').textContent = 'Ignore my vote (ON)';
        } else {
            this.elements.hostModeToggle.classList.remove('mode-active');
            this.elements.hostModeToggle.querySelector('.btn-text').textContent = 'Ignore my vote';
        }
    }

    toggleSound() {
        const isMuted = soundManager.toggleMute();
        if (!isMuted) {
            soundManager.playClick();
        }
        this.updateSoundToggleUI();
    }

    updateSoundToggleUI() {
        if (!this.elements.soundToggleBtn) return;
        const isMuted = soundManager.isMuted();
        this.elements.soundToggleBtn.classList.toggle('muted', isMuted);
        const icon = this.elements.soundToggleBtn.querySelector('.sound-icon');
        if (icon) {
            icon.textContent = isMuted ? '🔇' : '🔊';
        }
        this.elements.soundToggleBtn.title = isMuted ? 'Unmute Sound FX (Muted)' : 'Mute Sound FX (Enabled)';
    }

    copyRoomCode() {
        const url = new URL(window.location.href);
        url.searchParams.set('room', this.roomCode);
        navigator.clipboard.writeText(url.toString()).then(() => {
            this.elements.copyRoomCode.textContent = '✓';
            setTimeout(() => {
                this.elements.copyRoomCode.textContent = '📋';
            }, 2000);
        });
    }

    transferHost(playerId) {
        if (!this.isHost) return;
        wsClient.send('transfer_host', { playerId });
    }

    // WebSocket Event Handlers
    onRoundStarted(msg) {
        soundManager.playRoundStart();
        this.deckManager.reset();
        this.tableManager.reset();
        this.updateState(msg.roomState);
        this.deckManager.animateEnter();
    }

    onPlayerSelected(msg) {
        this.updateState(msg.roomState);
        this.tableManager.animatePlayerSelect(msg.playerId);
    }

    onCardsRevealed(msg) {
        this.updateState(msg.roomState);
        this.revealManager.playRevealAnimation(msg.revealOrder, this.isHost);
    }

    onRoundReset(msg) {
        this.deckManager.reset();
        this.tableManager.reset();
        this.updateState(msg.roomState);
    }

    onPlayerJoined(msg) {
        this.updateState(msg.roomState);
        this.tableManager.animatePlayerJoin(msg.player.id);
    }

    onPlayerLeft(msg) {
        this.tableManager.animatePlayerExit(msg.playerId, () => {
            this.updateState(msg.roomState);
        });
    }

    onBecameHost() {
        this.isHost = true;
        this.elements.hostControls.classList.remove('hidden');
        this.updateUI();
        this.renderPlayers();
    }

    onHostTransferred(msg) {
        if (msg.newHostId === this.playerId) {
            this.isHost = true;
            this.elements.hostControls.classList.remove('hidden');
        } else if (this.isHost) {
            this.isHost = false;
            this.elements.hostControls.classList.add('hidden');
        }
        this.updateState(msg.roomState);
    }
}

export const game = new Game();
