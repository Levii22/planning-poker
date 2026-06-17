import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';

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
    'https://levii22.github.io'
];

// Rate limiting
const RATE_LIMIT_WINDOW_MS = 5000;  // 5 seconds
const RATE_LIMIT_MAX_MESSAGES = 20; // Max messages per window

// Limits
const MAX_NAME_LENGTH = 20;
const MAX_ROOMS = 1000;
const MAX_PLAYERS_PER_ROOM = 50;
const MAX_MESSAGE_SIZE = 1024; // 1KB max message size



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
// HEARTBEAT / KEEP-ALIVE
// =============================================================================
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

// Ping all clients periodically to keep connections alive
const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            console.log('Terminating inactive client');
            return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping(); // Send ping frame
    });
}, HEARTBEAT_INTERVAL);

wss.on('close', () => {
    clearInterval(heartbeatInterval);
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



// =============================================================================
// GAME STATE STORAGE
// =============================================================================
const rooms = new Map();
const players = new Map(); // Map WebSocket to player info
const disconnectTimeouts = new Map(); // Map playerId -> setTimeout ID

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

const AVATAR_EMOJIS = ['🐱', '🐶', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐸', '🐵', '🦄', '🦖', '🐙', '🐳', '🦥', '🦘', '🦉', '🦔', '🦆', '🦖', '🐝', '🐧', '🦁', '🦭'];
const AVATAR_GRADIENTS = [
    'linear-gradient(135deg, #4f46e5, #312e81)', // Deep Purple/Indigo
    'linear-gradient(135deg, #ea580c, #991b1b)', // Sunset/Rust
    'linear-gradient(135deg, #059669, #0f766e)', // Emerald/Teal
    'linear-gradient(135deg, #db2777, #9f1239)', // Velvet Rose/Plum
    'linear-gradient(135deg, #0891b2, #0284c7)', // Ocean Cyan
    'linear-gradient(135deg, #7c3aed, #5b21b6)', // Royal Purple/Violet
    'linear-gradient(135deg, #d97706, #9a3412)', // Autumn Amber
    'linear-gradient(135deg, #be123c, #5b21b6)'  // Crimson Dusk
];

function getRandomPlayerAvatar() {
    const emoji = AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)];
    const gradient = AVATAR_GRADIENTS[Math.floor(Math.random() * AVATAR_GRADIENTS.length)];
    return { emoji, gradient };
}

// Broadcast to all players in a room
function broadcastToRoom(roomCode, message, excludeWs = null) {
    const room = rooms.get(roomCode);
    if (!room) return;

    const data = JSON.stringify(message);
    room.players.forEach((player) => {
        if (player.ws && player.ws !== excludeWs && player.ws.readyState === 1) {
            player.ws.send(data);
        }
    });
}

// Get room state for clients
function getRoomState(roomCode, includeVotes = false) {
    const room = rooms.get(roomCode);
    if (!room) return null;

    const playersList = [];
    room.players.forEach((player) => {
        playersList.push({
            id: player.id,
            name: player.name,
            isHost: player.isHost,
            hasSelected: player.selectedCard !== null,
            card: includeVotes || room.state === 'revealed' ? player.selectedCard : null,
            active: player.ws !== null,
            avatar: player.avatar,
            color: player.color
        });
    });

    return {
        roomCode,
        state: room.state,
        players: playersList,
        ignoreHostVote: room.ignoreHostVote || false,
        cardValues: CARD_VALUES
    };
}

// Get sorted list of players for reveal
function getSortedRevealOrder(room) {
    const revealOrder = [];
    room.players.forEach((p) => {
        revealOrder.push({
            id: p.id,
            name: p.name,
            card: p.selectedCard
        });
    });

    revealOrder.sort((a, b) => {
        const aVal = a.card === null ? -1000 : CARD_VALUES.indexOf(a.card);
        const bVal = b.card === null ? -1000 : CARD_VALUES.indexOf(b.card);
        return bVal - aVal;
    });

    return revealOrder;
}

wss.on('connection', (ws, req) => {
    // Initialize rate limiting for this connection
    ws.messageTimestamps = [];
    ws.isAlive = true;

    // Respond to server pings to keep connection alive
    ws.on('pong', () => {
        ws.isAlive = true;
    });

    // Determine client IP, prioritizing proxy headers if behind Nginx/etc.
    const forwardedFor = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];
    const clientIp = (forwardedFor ? forwardedFor.split(',')[0].trim() : null) 
                  || realIp 
                  || req.socket.remoteAddress;
                  
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
            players.delete(ws); // Remove connection mapping

            const room = rooms.get(player.roomCode);
            if (room) {
                // Mark player as disconnected
                player.ws = null;

                // Broadcast updated room state to show player is offline
                broadcastToRoom(player.roomCode, {
                    type: 'player_disconnected',
                    playerId: player.id,
                    roomState: getRoomState(player.roomCode)
                });

                // Start grace period timer
                const GRACE_PERIOD = 20000; // 20 seconds
                const timeoutId = setTimeout(() => {
                    disconnectTimeouts.delete(player.id);

                    const currentRoom = rooms.get(player.roomCode);
                    if (currentRoom) {
                        const currentPlayer = currentRoom.players.get(player.id);
                        // Only clean up if they haven't reconnected (ws is still null)
                        if (currentPlayer && currentPlayer.ws === null) {
                            currentRoom.players.delete(player.id);

                            if (currentPlayer.selectedCard !== null) {
                                currentRoom.voteCount = Math.max(0, (currentRoom.voteCount || 0) - 1);
                            }

                            // If host left, assign new host or close room
                            if (currentPlayer.isHost && currentRoom.players.size > 0) {
                                // Find first active player
                                let newHost = null;
                                for (const p of currentRoom.players.values()) {
                                    if (p.ws !== null) {
                                        newHost = p;
                                        break;
                                    }
                                }
                                // Fallback to any player
                                if (!newHost) {
                                    newHost = currentRoom.players.values().next().value;
                                }
                                if (newHost) {
                                    newHost.isHost = true;
                                    currentRoom.hostId = newHost.id;
                                    if (newHost.ws && newHost.ws.readyState === 1) {
                                        newHost.ws.send(JSON.stringify({ type: 'became_host' }));
                                    }
                                }
                            }

                            if (currentRoom.players.size === 0) {
                                rooms.delete(player.roomCode);
                                console.log(`Room ${player.roomCode} deleted - no players after grace period`);
                            } else {
                                broadcastToRoom(player.roomCode, {
                                    type: 'player_left',
                                    playerId: player.id,
                                    roomState: getRoomState(player.roomCode)
                                });
                            }
                        }
                    }
                }, GRACE_PERIOD);

                disconnectTimeouts.set(player.id, timeoutId);
            }
            console.log(`Player ${player.name} disconnected (entering grace period)`);
        } else {
            console.log('Anonymous client disconnected');
        }
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
            const sessionToken = uuidv4();

            const avatarInfo = getRandomPlayerAvatar();
            const player = {
                id: playerId,
                name,
                isHost: true,
                selectedCard: null,
                roomCode,
                ws,
                sessionToken,
                avatar: avatarInfo.emoji,
                color: avatarInfo.gradient
            };

            rooms.set(roomCode, {
                state: 'waiting', // waiting, voting, revealed
                players: new Map([[playerId, player]]),
                ignoreHostVote: false, // Default: host vote is counted
                voteCount: 0,
                hostId: playerId,
                createdAt: Date.now()
            });

            players.set(ws, player);

            ws.send(JSON.stringify({
                type: 'room_created',
                roomCode,
                playerId,
                sessionToken,
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
            const sessionToken = uuidv4();

            const avatarInfo = getRandomPlayerAvatar();
            const player = {
                id: playerId,
                name,
                isHost: false,
                selectedCard: null,
                roomCode,
                ws,
                sessionToken,
                avatar: avatarInfo.emoji,
                color: avatarInfo.gradient
            };

            room.players.set(playerId, player);
            players.set(ws, player);

            ws.send(JSON.stringify({
                type: 'joined_room',
                roomCode,
                playerId,
                sessionToken,
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
            room.voteCount = 0;
            room.state = 'voting';

            broadcastToRoom(player.roomCode, {
                type: 'round_started',
                roomState: getRoomState(player.roomCode)
            });

            console.log(`Round started in room ${player.roomCode}`);
            break;
        }

        case 'toggle_host_mode': {
            const player = players.get(ws);
            if (!player || !player.isHost) return;

            const room = rooms.get(player.roomCode);
            if (!room) return;

            // Toggle the setting
            room.ignoreHostVote = !room.ignoreHostVote;

            // Broadcast update
            broadcastToRoom(player.roomCode, {
                type: 'host_mode_toggled',
                ignoreHostVote: room.ignoreHostVote,
                roomState: getRoomState(player.roomCode)
            });

            console.log(`Host mode toggled in room ${player.roomCode}: ${room.ignoreHostVote}`);
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

            // Update vote count if this is a new vote
            if (player.selectedCard === null) {
                room.voteCount = (room.voteCount || 0) + 1;
            }
            player.selectedCard = message.card;

            broadcastToRoom(player.roomCode, {
                type: 'player_selected',
                playerId: player.id,
                roomState: getRoomState(player.roomCode)
            });

            console.log(`${player.name} selected a card in room ${player.roomCode}`);

            // Check if we should auto-reveal (excluding inactive players and counting correctly)
            let activeVotersCount = 0;
            let activePlayersCount = 0;
            let activeHostVoted = false;
            let activeHostExists = false;

            room.players.forEach((p) => {
                if (p.ws !== null) {
                    activePlayersCount++;
                    if (p.selectedCard !== null) {
                        activeVotersCount++;
                    }
                    if (p.isHost) {
                        activeHostExists = true;
                        if (p.selectedCard !== null) {
                            activeHostVoted = true;
                        }
                    }
                }
            });

            let requiredVoters = activePlayersCount;
            let currentVoters = activeVotersCount;

            if (room.ignoreHostVote && activeHostExists) {
                requiredVoters--;
                if (activeHostVoted) {
                    currentVoters--;
                }
            }

            // If everyone active and needed has voted, auto-reveal
            if (requiredVoters > 0 && currentVoters >= requiredVoters) {
                console.log(`Auto-revealing in room ${player.roomCode} (votes: ${room.voteCount}/${activePlayersCount}, ignoreHost: ${room.ignoreHostVote})`);

                // Trigger reveal logic
                room.state = 'revealed';

                // Build and sort reveal order
                const revealOrder = getSortedRevealOrder(room);

                broadcastToRoom(player.roomCode, {
                    type: 'cards_revealed',
                    revealOrder,
                    roomState: getRoomState(player.roomCode, true)
                });
            }
            break;
        }

        case 'reveal_cards': {
            const player = players.get(ws);
            if (!player || !player.isHost) return;

            const room = rooms.get(player.roomCode);
            if (!room) return;

            room.state = 'revealed';

            // Build and sort reveal order (for animation sequencing)
            const revealOrder = getSortedRevealOrder(room);

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
            room.voteCount = 0;
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

        case 'transfer_host': {
            const player = players.get(ws);
            if (!player || !player.isHost) return;

            const targetPlayerId = message.playerId;
            if (!targetPlayerId) return;

            const room = rooms.get(player.roomCode);
            if (!room) return;

            const targetPlayer = room.players.get(targetPlayerId);
            if (!targetPlayer || targetPlayer.id === player.id) return;

            // Transfer host
            player.isHost = false;
            targetPlayer.isHost = true;
            room.hostId = targetPlayerId;

            // Notify the new host
            if (targetPlayer.ws && targetPlayer.ws.readyState === 1) {
                targetPlayer.ws.send(JSON.stringify({ type: 'became_host' }));
            }

            // Broadcast updated state to everyone
            broadcastToRoom(player.roomCode, {
                type: 'host_transferred',
                newHostId: targetPlayerId,
                roomState: getRoomState(player.roomCode)
            });

            console.log(`Host transferred from ${player.name} to ${targetPlayer.name} in room ${player.roomCode}`);
            break;
        }

        case 'rejoin': {
            const { playerId, roomCode, sessionToken } = message;

            if (!playerId || !roomCode || !sessionToken) {
                ws.send(JSON.stringify({
                    type: 'session_expired',
                    message: 'Session details missing.'
                }));
                return;
            }

            const room = rooms.get(roomCode);
            if (!room) {
                ws.send(JSON.stringify({
                    type: 'session_expired',
                    message: 'Room not found.'
                }));
                return;
            }

            const player = room.players.get(playerId);
            if (!player || player.sessionToken !== sessionToken) {
                ws.send(JSON.stringify({
                    type: 'session_expired',
                    message: 'Session invalid or expired.'
                }));
                return;
            }

            // Clear any active disconnect timeout for this player
            if (disconnectTimeouts.has(playerId)) {
                clearTimeout(disconnectTimeouts.get(playerId));
                disconnectTimeouts.delete(playerId);
            }

            // If the player had an existing active connection (e.g. duplicate tab), close it
            if (player.ws && player.ws !== ws) {
                try {
                    player.ws.close(1000, 'Replaced by new connection');
                } catch (e) {
                    console.error('Error closing old player socket:', e);
                }
            }

            // Re-associate player with the new WebSocket
            player.ws = ws;

            // Set the reverse mapping for message lookup
            players.set(ws, player);

            // Send rejoin confirmation
            ws.send(JSON.stringify({
                type: 'rejoined_room',
                roomCode,
                playerId,
                isHost: player.isHost,
                roomState: getRoomState(roomCode)
            }));

            // Broadcast that the player is back online
            broadcastToRoom(roomCode, {
                type: 'player_reconnected',
                playerId: player.id,
                roomState: getRoomState(roomCode)
            }, ws);

            console.log(`Player ${player.name} reconnected to room ${roomCode}`);
            break;
        }

        case 'leave': {
            const player = players.get(ws);
            if (player) {
                const room = rooms.get(player.roomCode);
                if (room) {
                    room.players.delete(player.id);

                    if (player.selectedCard !== null) {
                        room.voteCount = Math.max(0, (room.voteCount || 0) - 1);
                    }

                    // If host left, assign new host or close room
                    if (player.isHost && room.players.size > 0) {
                        let newHost = null;
                        for (const p of room.players.values()) {
                            if (p.ws !== null) {
                                newHost = p;
                                break;
                            }
                        }
                        if (!newHost) {
                            newHost = room.players.values().next().value;
                        }
                        if (newHost) {
                            newHost.isHost = true;
                            room.hostId = newHost.id;
                            if (newHost.ws && newHost.ws.readyState === 1) {
                                newHost.ws.send(JSON.stringify({ type: 'became_host' }));
                            }
                        }
                    }

                    if (room.players.size === 0) {
                        rooms.delete(player.roomCode);
                        console.log(`Room ${player.roomCode} deleted - player voluntarily left`);
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
            break;
        }
    }
}

console.log(`🃏 Agile Poker WebSocket server running on port ${PORT}`);
