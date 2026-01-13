import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// =============================================================================
// SECURITY CONFIGURATION
// =============================================================================
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Allowed origins for production (add your production domain)
const ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'https://levii22.github.io/planning-poker'
];

// Rate limiting
const RATE_LIMIT_WINDOW_MS = 5000;  // 5 seconds
const RATE_LIMIT_MAX_MESSAGES = 20; // Max messages per window

// Limits
const MAX_NAME_LENGTH = 20;
const MAX_ROOMS = 1000;
const MAX_PLAYERS_PER_ROOM = 50;
const MAX_MESSAGE_SIZE = 1024; // 1KB max message size

// Session tokens for reconnection (token -> player info)
const sessionTokens = new Map();
const SESSION_TOKEN_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

// =============================================================================
// WEBSOCKET SERVER WITH ORIGIN VERIFICATION
// =============================================================================
const wss = new WebSocketServer({
    port: PORT,
    maxPayload: MAX_MESSAGE_SIZE,
    verifyClient: (info, callback) => {
        const origin = info.origin || info.req.headers.origin;

        // In development, allow all origins
        if (NODE_ENV !== 'production') {
            callback(true);
            return;
        }

        // In production, verify origin
        if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
            console.warn(`⚠️ Connection rejected from origin: ${origin}`);
            callback(false, 403, 'Forbidden: Invalid origin');
            return;
        }

        callback(true);
    }
});

// =============================================================================
// SECURITY UTILITIES
// =============================================================================

// Rate limiting check
function checkRateLimit(ws) {
    const now = Date.now();
    if (!ws.messageTimestamps) {
        ws.messageTimestamps = [];
    }

    // Remove old timestamps outside the window
    ws.messageTimestamps = ws.messageTimestamps.filter(
        t => now - t < RATE_LIMIT_WINDOW_MS
    );

    // Check if over limit
    if (ws.messageTimestamps.length >= RATE_LIMIT_MAX_MESSAGES) {
        return false;
    }

    ws.messageTimestamps.push(now);
    return true;
}

// Sanitize player name - remove dangerous characters, limit length
function sanitizeName(name) {
    if (!name || typeof name !== 'string') return null;

    // Trim, remove HTML/script tags, limit length
    const sanitized = name
        .trim()
        .replace(/<[^>]*>/g, '')           // Remove HTML tags
        .replace(/[<>"'`&;()\[\]{}]/g, '') // Remove dangerous characters
        .slice(0, MAX_NAME_LENGTH);

    return sanitized.length >= 1 ? sanitized : null;
}

// Validate card value
function isValidCard(card) {
    return card === null || CARD_VALUES.includes(card);
}

// Validate room code format
function isValidRoomCode(code) {
    if (!code || typeof code !== 'string') return false;
    return /^[A-Z0-9]{4}$/.test(code.toUpperCase());
}

// Generate secure session token
function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Clean up expired session tokens
function cleanupExpiredSessions() {
    const now = Date.now();
    for (const [token, data] of sessionTokens.entries()) {
        if (now - data.createdAt > SESSION_TOKEN_EXPIRY_MS) {
            sessionTokens.delete(token);
        }
    }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredSessions, 5 * 60 * 1000);

// =============================================================================
// GAME STATE STORAGE
// =============================================================================
const rooms = new Map();
const players = new Map(); // Map WebSocket to player info

// Generate 4-character room code
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return rooms.has(code) ? generateRoomCode() : code;
}

// Card values for Planning Poker
const CARD_VALUES = ['0', '½', '1', '2', '3', '5', '8', '13', '21', '?', '☕'];

// Broadcast to all players in a room
function broadcastToRoom(roomCode, message, excludeWs = null) {
    const room = rooms.get(roomCode);
    if (!room) return;

    const data = JSON.stringify(message);
    room.players.forEach((player, ws) => {
        if (ws !== excludeWs && ws.readyState === 1) {
            ws.send(data);
        }
    });
}

// Get room state for clients
function getRoomState(roomCode, includeVotes = false) {
    const room = rooms.get(roomCode);
    if (!room) return null;

    const playersList = [];
    room.players.forEach((player, ws) => {
        playersList.push({
            id: player.id,
            name: player.name,
            isHost: player.isHost,
            hasSelected: player.selectedCard !== null,
            card: includeVotes || room.state === 'revealed' ? player.selectedCard : null
        });
    });

    return {
        roomCode,
        state: room.state,
        players: playersList,
        cardValues: CARD_VALUES
    };
}

wss.on('connection', (ws, req) => {
    // Initialize rate limiting for this connection
    ws.messageTimestamps = [];
    ws.isAlive = true;

    const clientIp = req.socket.remoteAddress;
    console.log(`New client connected from ${clientIp}`);

    ws.on('message', (data) => {
        // Rate limiting check
        if (!checkRateLimit(ws)) {
            console.warn(`⚠️ Rate limit exceeded for ${clientIp}`);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Rate limit exceeded. Please slow down.'
            }));
            return;
        }

        try {
            const message = JSON.parse(data);
            handleMessage(ws, message);
        } catch (e) {
            console.error('Failed to parse message:', e);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format'
            }));
        }
    });

    ws.on('close', () => {
        const player = players.get(ws);
        if (player) {
            const room = rooms.get(player.roomCode);
            if (room) {
                room.players.delete(ws);

                // If host left, assign new host or close room
                if (player.isHost && room.players.size > 0) {
                    const [newHostWs, newHost] = room.players.entries().next().value;
                    newHost.isHost = true;
                    newHostWs.send(JSON.stringify({ type: 'became_host' }));
                }

                if (room.players.size === 0) {
                    rooms.delete(player.roomCode);
                    console.log(`Room ${player.roomCode} deleted - no players`);
                } else {
                    broadcastToRoom(player.roomCode, {
                        type: 'player_left',
                        playerId: player.id,
                        roomState: getRoomState(player.roomCode)
                    });
                }
            }
            players.delete(ws);
        }
        console.log('Client disconnected');
    });
});

function handleMessage(ws, message) {
    switch (message.type) {
        case 'create_room': {
            // Check room limit
            if (rooms.size >= MAX_ROOMS) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Server is at capacity. Please try again later.'
                }));
                return;
            }

            // Sanitize and validate name
            const name = sanitizeName(message.name);
            if (!name) {
                ws.send(JSON.stringify({ type: 'error', message: 'Valid name is required (1-20 characters)' }));
                return;
            }

            const roomCode = generateRoomCode();
            const playerId = uuidv4();
            const sessionToken = generateSessionToken();

            const player = {
                id: playerId,
                name,
                isHost: true,
                selectedCard: null,
                roomCode,
                sessionToken
            };

            rooms.set(roomCode, {
                state: 'waiting', // waiting, voting, revealed
                players: new Map([[ws, player]]),
                createdAt: Date.now()
            });

            players.set(ws, player);

            // Store session for reconnection
            sessionTokens.set(sessionToken, {
                playerId,
                roomCode,
                name,
                createdAt: Date.now()
            });

            ws.send(JSON.stringify({
                type: 'room_created',
                roomCode,
                playerId,
                sessionToken, // Send token for reconnection
                roomState: getRoomState(roomCode)
            }));

            console.log(`Room ${roomCode} created by ${player.name}`);
            break;
        }

        case 'join_room': {
            // Validate room code format
            const roomCode = message.roomCode?.toUpperCase();
            if (!isValidRoomCode(roomCode)) {
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid room code format' }));
                return;
            }

            const room = rooms.get(roomCode);
            if (!room) {
                ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
                return;
            }

            // Check player limit
            if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
                ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
                return;
            }

            // Sanitize and validate name
            const name = sanitizeName(message.name);
            if (!name) {
                ws.send(JSON.stringify({ type: 'error', message: 'Valid name is required (1-20 characters)' }));
                return;
            }

            const playerId = uuidv4();
            const sessionToken = generateSessionToken();

            const player = {
                id: playerId,
                name,
                isHost: false,
                selectedCard: null,
                roomCode,
                sessionToken
            };

            room.players.set(ws, player);
            players.set(ws, player);

            // Store session for reconnection
            sessionTokens.set(sessionToken, {
                playerId,
                roomCode,
                name,
                createdAt: Date.now()
            });

            ws.send(JSON.stringify({
                type: 'joined_room',
                roomCode,
                playerId,
                sessionToken, // Send token for reconnection
                roomState: getRoomState(roomCode)
            }));

            broadcastToRoom(roomCode, {
                type: 'player_joined',
                player: { id: playerId, name: player.name, hasSelected: false },
                roomState: getRoomState(roomCode)
            }, ws);

            console.log(`${player.name} joined room ${roomCode}`);
            break;
        }

        case 'start_round': {
            const player = players.get(ws);
            if (!player || !player.isHost) return;

            const room = rooms.get(player.roomCode);
            if (!room) return;

            // Reset all votes
            room.players.forEach(p => p.selectedCard = null);
            room.state = 'voting';

            broadcastToRoom(player.roomCode, {
                type: 'round_started',
                roomState: getRoomState(player.roomCode)
            });

            console.log(`Round started in room ${player.roomCode}`);
            break;
        }

        case 'select_card': {
            const player = players.get(ws);
            if (!player) return;

            const room = rooms.get(player.roomCode);
            if (!room || room.state !== 'voting') return;

            // Validate card value against whitelist
            if (!isValidCard(message.card)) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Invalid card value'
                }));
                return;
            }

            player.selectedCard = message.card;

            broadcastToRoom(player.roomCode, {
                type: 'player_selected',
                playerId: player.id,
                roomState: getRoomState(player.roomCode)
            });

            console.log(`${player.name} selected a card in room ${player.roomCode}`);
            break;
        }

        case 'reveal_cards': {
            const player = players.get(ws);
            if (!player || !player.isHost) return;

            const room = rooms.get(player.roomCode);
            if (!room) return;

            room.state = 'revealed';

            // Build reveal order (for animation sequencing)
            const revealOrder = [];
            room.players.forEach((p) => {
                revealOrder.push({
                    id: p.id,
                    name: p.name,
                    card: p.selectedCard
                });
            });

            broadcastToRoom(player.roomCode, {
                type: 'cards_revealed',
                revealOrder,
                roomState: getRoomState(player.roomCode, true)
            });

            console.log(`Cards revealed in room ${player.roomCode}`);
            break;
        }

        case 'reset_round': {
            const player = players.get(ws);
            if (!player || !player.isHost) return;

            const room = rooms.get(player.roomCode);
            if (!room) return;

            room.players.forEach(p => p.selectedCard = null);
            room.state = 'waiting';

            broadcastToRoom(player.roomCode, {
                type: 'round_reset',
                roomState: getRoomState(player.roomCode)
            });

            console.log(`Round reset in room ${player.roomCode}`);
            break;
        }

        case 'close_reveal': {
            const player = players.get(ws);
            if (!player || !player.isHost) return;

            broadcastToRoom(player.roomCode, {
                type: 'reveal_closed'
            });

            console.log(`Reveal closed in room ${player.roomCode}`);
            break;
        }
    }
}

console.log(`🃏 Agile Poker WebSocket server running on port ${PORT}`);
