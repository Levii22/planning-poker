// Avatar Customization & Reroll Manager
import { wsClient } from './websocket.js';

export const EMOJI_CATEGORIES = {
    animals: ['🐱', '🐶', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐸', '🐵', '🦄', '🦖', '🐙', '🐳', '🦥', '🦘', '🦉', '🦔', '🐝', '🐧', '🦭'],
    tech: ['🤖', '👽', '🥷', '🧙', '👻', '🚀', '💻', '🎮', '⚡', '👾', '🛸', '🛰️'],
    food: ['🍕', '🌮', '🥑', '🍔', '🍩', '🍿', '☕', '🧋', '🍣', '🥞', '🍦'],
    fun: ['😎', '🤯', '🧐', '🤠', '🥳', '👑', '🤩', '😈', '🦸', '🎯', '💎', '🔥']
};

export const GRADIENT_PALETTE = [
    'linear-gradient(135deg, #4f46e5, #312e81)',
    'linear-gradient(135deg, #ea580c, #991b1b)',
    'linear-gradient(135deg, #059669, #0f766e)',
    'linear-gradient(135deg, #db2777, #9f1239)',
    'linear-gradient(135deg, #0891b2, #0284c7)',
    'linear-gradient(135deg, #7c3aed, #5b21b6)',
    'linear-gradient(135deg, #d97706, #9a3412)',
    'linear-gradient(135deg, #ec4899, #8b5cf6)',
    'linear-gradient(135deg, #eab308, #ca8a04)',
    'linear-gradient(135deg, #84cc16, #15803d)'
];

export class AvatarManager {
    constructor() {
        this.selectedAvatarEmoji = '🐱';
        this.selectedAvatarGradient = GRADIENT_PALETTE[0];
        this.activeEmojiTab = 'animals';

        this.elements = {
            avatarModal: document.getElementById('avatarModal'),
            closeAvatarModal: document.getElementById('closeAvatarModal'),
            avatarPreview: document.getElementById('avatarPreview'),
            avatarPreviewEmoji: document.getElementById('avatarPreviewEmoji'),
            modalRerollBtn: document.getElementById('modalRerollBtn'),
            emojiGrid: document.getElementById('emojiGrid'),
            gradientPalette: document.getElementById('gradientPalette'),
            saveAvatarBtn: document.getElementById('saveAvatarBtn')
        };

        this.bindEvents();
    }

    bindEvents() {
        if (!this.elements.avatarModal) return;

        this.elements.closeAvatarModal?.addEventListener('click', () => this.closeAvatarModal());
        this.elements.saveAvatarBtn?.addEventListener('click', () => this.saveAvatar());
        this.elements.modalRerollBtn?.addEventListener('click', () => this.rerollAvatarModal());

        // Category Tab Switching
        this.elements.avatarModal.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.elements.avatarModal.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.activeEmojiTab = btn.dataset.tab;
                this.renderEmojiGrid();
            });
        });
    }

    quickRerollAvatar() {
        const allEmojis = Object.values(EMOJI_CATEGORIES).flat();
        const randomEmoji = allEmojis[Math.floor(Math.random() * allEmojis.length)];
        const randomGradient = GRADIENT_PALETTE[Math.floor(Math.random() * GRADIENT_PALETTE.length)];

        wsClient.send('update_avatar', {
            avatar: randomEmoji,
            color: randomGradient
        });
    }

    openAvatarModal(currentAvatar, currentColor) {
        this.selectedAvatarEmoji = currentAvatar || '🐱';
        this.selectedAvatarGradient = currentColor || GRADIENT_PALETTE[0];

        this.updateAvatarPreview();
        this.renderEmojiGrid();
        this.renderGradientPalette();

        if (this.elements.avatarModal) {
            this.elements.avatarModal.classList.remove('hidden');
        }
    }

    closeAvatarModal() {
        if (this.elements.avatarModal) {
            this.elements.avatarModal.classList.add('hidden');
        }
    }

    updateAvatarPreview() {
        if (this.elements.avatarPreviewEmoji) {
            this.elements.avatarPreviewEmoji.textContent = this.selectedAvatarEmoji;
        }
        if (this.elements.avatarPreview) {
            this.elements.avatarPreview.style.background = this.selectedAvatarGradient;
        }
    }

    renderEmojiGrid() {
        const container = this.elements.emojiGrid;
        if (!container) return;

        container.innerHTML = '';
        const list = EMOJI_CATEGORIES[this.activeEmojiTab] || EMOJI_CATEGORIES.animals;

        list.forEach(emoji => {
            const btn = document.createElement('button');
            btn.className = `emoji-option ${this.selectedAvatarEmoji === emoji ? 'selected' : ''}`;
            btn.textContent = emoji;
            btn.addEventListener('click', () => {
                this.selectedAvatarEmoji = emoji;
                container.querySelectorAll('.emoji-option').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.updateAvatarPreview();
            });
            container.appendChild(btn);
        });
    }

    renderGradientPalette() {
        const container = this.elements.gradientPalette;
        if (!container) return;

        container.innerHTML = '';

        GRADIENT_PALETTE.forEach(gradient => {
            const swatch = document.createElement('div');
            swatch.className = `gradient-swatch ${this.selectedAvatarGradient === gradient ? 'selected' : ''}`;
            swatch.style.background = gradient;
            swatch.addEventListener('click', () => {
                this.selectedAvatarGradient = gradient;
                container.querySelectorAll('.gradient-swatch').forEach(s => s.classList.remove('selected'));
                swatch.classList.add('selected');
                this.updateAvatarPreview();
            });
            container.appendChild(swatch);
        });
    }

    rerollAvatarModal() {
        const allEmojis = Object.values(EMOJI_CATEGORIES).flat();
        this.selectedAvatarEmoji = allEmojis[Math.floor(Math.random() * allEmojis.length)];
        this.selectedAvatarGradient = GRADIENT_PALETTE[Math.floor(Math.random() * GRADIENT_PALETTE.length)];

        this.updateAvatarPreview();
        this.renderEmojiGrid();
        this.renderGradientPalette();
    }

    saveAvatar() {
        wsClient.send('update_avatar', {
            avatar: this.selectedAvatarEmoji,
            color: this.selectedAvatarGradient
        });
        this.closeAvatarModal();
    }
}
