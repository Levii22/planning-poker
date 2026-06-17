// WebSocket client wrapper with security enhancements
class WebSocketClient {
    constructor() {
        this.ws = null;
        this.handlers = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 15;
        this.reconnectTimeoutId = null;

        // Load session from localStorage if available
        this.sessionToken = localStorage.getItem('poker_session_token');
        this.playerId = localStorage.getItem('poker_player_id');
        this.roomCode = localStorage.getItem('poker_room_code');

        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    console.log('👀 Tab became visible, checking connection...');
                    this.reconnectIfNeeded();
                }
            });
        }
    }

    connect() {
        // Clean up old socket if it exists
        if (this.ws) {
            try {
                this.ws.onopen = null;
                this.ws.onmessage = null;
                this.ws.onclose = null;
                this.ws.onerror = null;
                this.ws.close();
            } catch (e) {
                console.error('Error closing old socket:', e);
            }
        }

        if (this.reconnectTimeoutId) {
            clearTimeout(this.reconnectTimeoutId);
            this.reconnectTimeoutId = null;
        }

        return new Promise((resolve, reject) => {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.hostname;
            const wsUrl = window.location.hostname === 'localhost'
                ? `${protocol}//${host}:3001`
                : 'wss://potato.tetas.pt';

            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('🔌 Connected to server');
                this.reconnectAttempts = 0;
                resolve();
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);

                    // Store session info for reconnection
                    if (message.sessionToken) {
                        this.sessionToken = message.sessionToken;
                        this.playerId = message.playerId;
                        this.roomCode = message.roomCode;

                        localStorage.setItem('poker_session_token', message.sessionToken);
                        localStorage.setItem('poker_player_id', message.playerId);
                        localStorage.setItem('poker_room_code', message.roomCode);
                    }

                    this.handleMessage(message);
                } catch (e) {
                    console.error('Failed to parse message:', e);
                }
            };

            this.ws.onclose = (event) => {
                console.log('🔌 Disconnected from server', event.code, event.reason);
                // Notify about disconnection
                this.handleMessage({ type: 'connection_closed' });
                // Only reconnect on unexpected closures
                if (event.code !== 1000) {
                    this.handleMessage({ type: 'connection_reconnecting' });
                    this.attemptReconnect();
                }
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            };
        });
    }

    // Exponential backoff with jitter to prevent thundering herd
    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;

            // Exponential backoff: 1s, 2s, 4s, 8s, 16s (capped)
            const baseDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 16000);
            // Add jitter (±25%)
            const jitter = baseDelay * 0.25 * (Math.random() - 0.5);
            const delay = Math.round(baseDelay + jitter);

            console.log(`Attempting to reconnect in ${delay}ms (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

            this.reconnectTimeoutId = setTimeout(() => {
                this.connect().then(() => {
                    this.handleMessage({ type: 'connection_restored' });
                }).catch(() => {
                    // Connection failed, will be retried by onclose handler
                });
            }, delay);
        } else {
            console.error('Max reconnection attempts reached');
            this.handleMessage({ type: 'connection_lost' });
        }
    }

    reconnectIfNeeded() {
        if (!this.roomCode || !this.playerId) {
            // Not in an active game session
            return;
        }

        const isClosed = !this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING;
        if (isClosed) {
            console.log('🔄 Socket is closed/closing, attempting immediate reconnect...');
            this.reconnectAttempts = 0; // Reset attempts to start fresh
            if (this.reconnectTimeoutId) {
                clearTimeout(this.reconnectTimeoutId);
                this.reconnectTimeoutId = null;
            }
            this.connect().then(() => {
                this.handleMessage({ type: 'connection_restored' });
            }).catch((e) => {
                console.error('Immediate reconnect failed:', e);
            });
        }
    }

    // Clear session on logout/leave
    clearSession() {
        this.sessionToken = null;
        this.playerId = null;
        this.roomCode = null;
        localStorage.removeItem('poker_session_token');
        localStorage.removeItem('poker_player_id');
        localStorage.removeItem('poker_room_code');
    }

    send(type, data = {}) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, ...data }));
        }
    }

    on(type, handler) {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, []);
        }
        this.handlers.get(type).push(handler);
    }

    off(type, handler) {
        if (this.handlers.has(type)) {
            const handlers = this.handlers.get(type);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    handleMessage(message) {
        const handlers = this.handlers.get(message.type);
        if (handlers) {
            handlers.forEach(handler => handler(message));
        }

        // Also call 'any' handlers
        const anyHandlers = this.handlers.get('*');
        if (anyHandlers) {
            anyHandlers.forEach(handler => handler(message));
        }
    }
}

export const wsClient = new WebSocketClient();
