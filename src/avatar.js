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

        this.initGradientPalette();
        this.bindEvents();
    }

    bindEvents() {
        if (!this.elements.avatarModal) return;

        this.elements.closeAvatarModal?.addEventListener('click', () => this.closeAvatarModal());
        this.elements.saveAvatarBtn?.addEventListener('click', () => this.saveAvatar());
        this.elements.modalRerollBtn?.addEventListener('click', () => this.rerollAvatarModal());

        // Event delegation for category tab switching
        const tabsContainer = this.elements.avatarModal.querySelector('.emoji-tabs');
        tabsContainer?.addEventListener('click', (e) => {
            const btn = e.target.closest('.tab-btn');
            if (!btn || btn.classList.contains('active')) return;

            tabsContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.activeEmojiTab = btn.dataset.tab;
            this.renderEmojiGrid();
        });

        // Event delegation for emoji grid clicks
        this.elements.emojiGrid?.addEventListener('click', (e) => {
            const btn = e.target.closest('.emoji-option');
            if (!btn) return;

            this.selectedAvatarEmoji = btn.textContent.trim();
            this.elements.emojiGrid.querySelectorAll('.emoji-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            this.updateAvatarPreview();
        });

        // Event delegation for gradient palette clicks
        this.elements.gradientPalette?.addEventListener('click', (e) => {
            const swatch = e.target.closest('.gradient-swatch');
            if (!swatch) return;

            this.selectedAvatarGradient = swatch.dataset.gradient;
            this.syncGradientSelection();
            this.updateAvatarPreview();
        });

        // Close on escape key
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                this.closeAvatarModal();
            }
        });
    }

    isOpen() {
        return this.elements.avatarModal && !this.elements.avatarModal.classList.contains('hidden');
    }

    initGradientPalette() {
        const container = this.elements.gradientPalette;
        if (!container || container.children.length > 0) return;

        container.innerHTML = '';
        const fragment = document.createDocumentFragment();

        GRADIENT_PALETTE.forEach(gradient => {
            const swatch = document.createElement('div');
            swatch.className = 'gradient-swatch';
            swatch.dataset.gradient = gradient;
            swatch.style.background = gradient;
            fragment.appendChild(swatch);
        });

        container.appendChild(fragment);
    }

    syncGradientSelection() {
        const container = this.elements.gradientPalette;
        if (!container) return;

        container.querySelectorAll('.gradient-swatch').forEach(s => {
            s.classList.toggle('selected', s.dataset.gradient === this.selectedAvatarGradient);
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
        this.syncGradientSelection();

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

        const list = EMOJI_CATEGORIES[this.activeEmojiTab] || EMOJI_CATEGORIES.animals;
        const fragment = document.createDocumentFragment();

        list.forEach(emoji => {
            const btn = document.createElement('button');
            btn.className = `emoji-option ${this.selectedAvatarEmoji === emoji ? 'selected' : ''}`;
            btn.textContent = emoji;
            fragment.appendChild(btn);
        });

        container.innerHTML = '';
        container.appendChild(fragment);
    }

    rerollAvatarModal() {
        const allEmojis = Object.values(EMOJI_CATEGORIES).flat();
        this.selectedAvatarEmoji = allEmojis[Math.floor(Math.random() * allEmojis.length)];
        this.selectedAvatarGradient = GRADIENT_PALETTE[Math.floor(Math.random() * GRADIENT_PALETTE.length)];

        this.updateAvatarPreview();
        this.renderEmojiGrid();
        this.syncGradientSelection();
    }

    saveAvatar() {
        wsClient.send('update_avatar', {
            avatar: this.selectedAvatarEmoji,
            color: this.selectedAvatarGradient
        });
        this.closeAvatarModal();
    }
}
