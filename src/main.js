import { wsClient } from './websocket.js';
import { game } from './game.js';

// DOM Elements
const lobbyView = document.getElementById('lobby');
const gameView = document.getElementById('game');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const exitRoomBtn = document.getElementById('exitRoomBtn');
const hostNameInput = document.getElementById('hostName');
const playerNameInput = document.getElementById('playerName');
const roomCodeInput = document.getElementById('roomCode');
const errorMessage = document.getElementById('errorMessage');
const connectionStatus = document.getElementById('connectionStatus');

// State
let isConnected = false;

// Update connection status UI
function updateConnectionStatus(status) {
  connectionStatus.className = 'connection-status ' + status;
  const statusText = connectionStatus.querySelector('.status-text');

  switch (status) {
    case 'connecting':
      statusText.textContent = 'Connecting...';
      break;
    case 'connected':
      statusText.textContent = 'Connected';
      break;
    case 'disconnected':
      statusText.textContent = 'Disconnected';
      break;
  }
}

// Initialize
async function init() {
  updateConnectionStatus('connecting');
  setupWebSocketHandlers(); // Register handlers first

  const urlParams = new URLSearchParams(window.location.search);
  const room = urlParams.get('room');
  if (room) {
    roomCodeInput.value = room.toUpperCase();
    setTimeout(() => playerNameInput.focus(), 100);
  }

  try {
    await wsClient.connect();
    isConnected = true;
    updateConnectionStatus('connected');
    setupEventListeners();

    // Auto-rejoin if a valid session exists and matches the URL room code (if present)
    const urlRoom = room ? room.toUpperCase() : null;
    if (wsClient.roomCode && wsClient.playerId && wsClient.sessionToken) {
      if (!urlRoom || urlRoom === wsClient.roomCode) {
        console.log('🔄 Session found, attempting automatic rejoin...');
        wsClient.send('rejoin', {
          playerId: wsClient.playerId,
          roomCode: wsClient.roomCode,
          sessionToken: wsClient.sessionToken
        });
      } else {
        console.log('🔄 Different room specified in URL, clearing old session.');
        wsClient.clearSession();
      }
    }
  } catch (error) {
    updateConnectionStatus('disconnected');
    showError('Failed to connect to server. Please refresh the page.');
  }
}

let errorTimeoutId = null;

function resetLobbyButtons() {
  createRoomBtn.disabled = false;
  joinRoomBtn.disabled = false;
  createRoomBtn.querySelector('.btn-text').textContent = 'Create Room';
  joinRoomBtn.querySelector('.btn-text').textContent = 'Join Room';
}

function showLobbyView() {
  game.cleanup();

  const url = new URL(window.location.href);
  url.searchParams.delete('room');
  window.history.replaceState({}, '', url);

  lobbyView.classList.remove('hidden');
  lobbyView.classList.add('active');
  gameView.classList.remove('active');
  gameView.classList.add('hidden');

  resetLobbyButtons();
}

function showGameView(roomCode) {
  lobbyView.classList.remove('active');
  lobbyView.classList.add('hidden');
  gameView.classList.add('active');
  gameView.classList.remove('hidden');

  const url = new URL(window.location.href);
  url.searchParams.set('room', roomCode);
  window.history.replaceState({}, '', url);

  resetLobbyButtons();
}

function setupEventListeners() {
  createRoomBtn.addEventListener('click', createRoom);
  joinRoomBtn.addEventListener('click', joinRoom);
  exitRoomBtn.addEventListener('click', exitRoom);

  // Modern Enter key handling
  hostNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createRoom();
  });

  playerNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (roomCodeInput.value.trim().length === 4) {
        joinRoom();
      } else {
        roomCodeInput.focus();
      }
    }
  });

  roomCodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinRoom();
  });

  // Auto-uppercase room code
  roomCodeInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
  });
}

function setupWebSocketHandlers() {
  wsClient.on('room_created', (msg) => {
    switchToGame(msg.roomCode, msg.playerId, true, msg.roomState);
  });

  wsClient.on('joined_room', (msg) => {
    switchToGame(msg.roomCode, msg.playerId, false, msg.roomState);
  });

  wsClient.on('rejoined_room', (msg) => {
    console.log('✅ Rejoined room successfully!');
    switchToGame(msg.roomCode, msg.playerId, msg.isHost, msg.roomState);
  });

  wsClient.on('session_expired', (msg) => {
    console.warn('⚠️ Session expired:', msg.message);
    wsClient.clearSession();
    showLobbyView();
    showError(msg.message || 'Session expired');
  });

  wsClient.on('error', (msg) => {
    showError(msg.message);
  });

  // Connection state handlers
  wsClient.on('connection_closed', () => {
    isConnected = false;
  });

  wsClient.on('connection_reconnecting', () => {
    updateConnectionStatus('connecting');
  });

  wsClient.on('connection_restored', () => {
    isConnected = true;
    updateConnectionStatus('connected');
    
    // Auto-rejoin if a valid session exists
    if (wsClient.roomCode && wsClient.playerId && wsClient.sessionToken) {
      console.log('🔄 Connection restored, sending rejoin request...');
      wsClient.send('rejoin', {
        playerId: wsClient.playerId,
        roomCode: wsClient.roomCode,
        sessionToken: wsClient.sessionToken
      });
    }
  });

  wsClient.on('connection_lost', () => {
    isConnected = false;
    updateConnectionStatus('disconnected');
    
    wsClient.clearSession();
    showLobbyView();
    showError('Connection lost. Returning to lobby.');
  });
}

function createRoom() {
  const name = hostNameInput.value.trim();

  if (!name) {
    showError('Please enter your name');
    return;
  }

  if (!isConnected) {
    showError('Not connected to server');
    return;
  }

  createRoomBtn.disabled = true;
  createRoomBtn.querySelector('.btn-text').textContent = 'Creating...';

  wsClient.send('create_room', { name });
}

function joinRoom() {
  const name = playerNameInput.value.trim();
  const roomCode = roomCodeInput.value.trim().toUpperCase();

  if (!name) {
    showError('Please enter your name');
    return;
  }

  if (!roomCode || roomCode.length !== 4) {
    showError('Please enter a valid 4-character room code');
    return;
  }

  if (!isConnected) {
    showError('Not connected to server');
    return;
  }

  joinRoomBtn.disabled = true;
  joinRoomBtn.querySelector('.btn-text').textContent = 'Joining...';

  wsClient.send('join_room', { name, roomCode });
}

function switchToGame(roomCode, playerId, isHost, roomState) {
  showGameView(roomCode);
  game.initialize(roomCode, playerId, isHost, roomState);
}

function exitRoom() {
  // Notify server of voluntary leave
  wsClient.send('leave');

  // Clear local session storage
  wsClient.clearSession();

  // Cleanly close WebSocket connection
  if (wsClient.ws) {
    try {
      wsClient.ws.close(1000, 'User voluntarily left the room');
    } catch (e) {
      console.error('Error closing WebSocket on exit:', e);
    }
  }

  showLobbyView();
  console.log('🚪 Left room voluntarily. Returned to lobby.');

  // Open a fresh socket for lobby state (creating/joining future rooms)
  wsClient.connect().catch(e => console.error('Error reconnecting after exit:', e));
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.add('visible');

  resetLobbyButtons();

  if (errorTimeoutId) {
    clearTimeout(errorTimeoutId);
  }

  errorTimeoutId = setTimeout(() => {
    errorMessage.classList.remove('visible');
    errorTimeoutId = null;
  }, 4000);
}

// Start the app
init();
