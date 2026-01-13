import { wsClient } from './websocket.js';
import { game } from './game.js';

// DOM Elements
const lobbyView = document.getElementById('lobby');
const gameView = document.getElementById('game');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const hostNameInput = document.getElementById('hostName');
const playerNameInput = document.getElementById('playerName');
const roomCodeInput = document.getElementById('roomCode');
const errorMessage = document.getElementById('errorMessage');

// State
let isConnected = false;

// Initialize
async function init() {
  try {
    await wsClient.connect();
    isConnected = true;
    setupEventListeners();
    setupWebSocketHandlers();
  } catch (error) {
    showError('Failed to connect to server. Please refresh the page.');
  }
}

function setupEventListeners() {
  createRoomBtn.addEventListener('click', createRoom);
  joinRoomBtn.addEventListener('click', joinRoom);

  // Enter key support
  hostNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') createRoom();
  });

  roomCodeInput.addEventListener('keypress', (e) => {
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

  wsClient.on('error', (msg) => {
    showError(msg.message);
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
  lobbyView.classList.remove('active');
  lobbyView.classList.add('hidden');
  gameView.classList.add('active');
  gameView.classList.remove('hidden');

  // Initialize game
  game.initialize(roomCode, playerId, isHost, roomState);

  // Reset lobby buttons
  createRoomBtn.disabled = false;
  joinRoomBtn.disabled = false;
  createRoomBtn.querySelector('.btn-text').textContent = 'Create Room';
  joinRoomBtn.querySelector('.btn-text').textContent = 'Join Room';
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.add('visible');

  // Reset buttons
  createRoomBtn.disabled = false;
  joinRoomBtn.disabled = false;
  createRoomBtn.querySelector('.btn-text').textContent = 'Create Room';
  joinRoomBtn.querySelector('.btn-text').textContent = 'Join Room';

  setTimeout(() => {
    errorMessage.classList.remove('visible');
  }, 4000);
}

// Start the app
init();
