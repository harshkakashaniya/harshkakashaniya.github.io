// Plain classic script — relies on ChessGame, chooseAIMove, and
// PIECE_SVG_MARKUP already being in global scope (chess-engine.js, ai.js,
// and piece-svgs.js must load before this file; see index.html's script
// order). See the note in chess-engine.js for why this isn't an ES module.

const SVG_NS = 'http://www.w3.org/2000/svg';

function createPieceSvg(piece) {
  const isWhite = piece[0] === 'w';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', isWhite ? 'piece-white' : 'piece-black');
  svg.innerHTML = PIECE_SVG_MARKUP[piece[1]];
  return svg;
}

// The AI opponent is always Black; the human is always White in "vs Computer"
// mode. Requirements only asked for *a* computer opponent, not color choice —
// see docs/game/frontend-notes.md for why this scope cut was made.
const AI_COLOR = 'b';

const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status-line');
const promoEl = document.getElementById('promotion-picker');
const themeToggle = document.getElementById('theme-toggle');
const startBtn = document.getElementById('start-btn');
const newGameBtn = document.getElementById('new-game-btn');

let selectedMode = 'classic';
let selectedOpponent = 'twoPlayer';
let game = null;
let selectedSquare = null;
let legalMovesForSelection = [];
let squareEls = new Map(); // square string -> DOM element
let inputLocked = false;

// ---- Theme ----
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'dark' ? '\u{1F319}' : '☀️';
  themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to day theme' : 'Switch to night theme');
}
function initTheme() {
  const saved = localStorage.getItem('scrambled-chess-theme');
  applyTheme(saved === 'light' ? 'light' : 'dark');
}
themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem('scrambled-chess-theme', next);
});

// ---- Start screen ----
document.querySelectorAll('[data-mode]').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedMode = btn.dataset.mode;
    document.querySelectorAll('[data-mode]').forEach((b) => {
      const on = b === btn;
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-pressed', String(on));
    });
    document.getElementById('mode-hint').textContent = selectedMode === 'scrambled'
      ? 'Back-rank pieces are shuffled for both sides (pawns stay put) — read the position before you plan an opening.'
      : 'Standard starting position — bring your usual openings.';
  });
});

document.querySelectorAll('[data-opponent]').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedOpponent = btn.dataset.opponent;
    document.querySelectorAll('[data-opponent]').forEach((b) => {
      const on = b === btn;
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-pressed', String(on));
    });
    document.getElementById('opponent-hint').textContent = selectedOpponent === 'ai'
      ? 'You play White; the computer plays Black.'
      : 'Share this device and take turns.';
  });
});

startBtn.addEventListener('click', () => {
  game = new ChessGame(selectedMode, selectedOpponent);
  selectedSquare = null;
  legalMovesForSelection = [];
  inputLocked = false;
  startScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  buildBoardSquares();
  render();
});

newGameBtn.addEventListener('click', () => {
  game = null;
  gameScreen.classList.add('hidden');
  startScreen.classList.remove('hidden');
  hidePromotionPicker();
});

// ---- Board ----
function buildBoardSquares() {
  boardEl.innerHTML = '';
  squareEls.clear();
  for (let r = 7; r >= 0; r--) {
    for (let c = 0; c < 8; c++) {
      const square = 'abcdefgh'[c] + (r + 1);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'square ' + ((r + c) % 2 === 0 ? 'dark' : 'light');
      btn.dataset.square = square;
      btn.setAttribute('role', 'gridcell');
      btn.addEventListener('click', () => onSquareClick(square));
      boardEl.appendChild(btn);
      squareEls.set(square, btn);
    }
  }
}

function render() {
  const state = game.getState();

  for (const [square, el] of squareEls) {
    const { r, c } = squareToRC(square);
    const piece = state.board[r][c];
    el.innerHTML = '';
    el.classList.remove('is-selected', 'is-check');
    if (piece) {
      el.appendChild(createPieceSvg(piece));
    }
  }

  if (selectedSquare) squareEls.get(selectedSquare).classList.add('is-selected');
  for (const mv of legalMovesForSelection) {
    const el = squareEls.get(mv.to);
    const marker = document.createElement('div');
    marker.className = state.board[squareToRC(mv.to).r][squareToRC(mv.to).c] || mv.isEnPassant ? 'capture-ring' : 'legal-dot';
    el.appendChild(marker);
  }

  if (state.inCheck && state.status === 'active') {
    const kingSquare = findKingSquare(state.board, state.turn);
    if (kingSquare) squareEls.get(kingSquare).classList.add('is-check');
  }

  statusEl.classList.remove('is-check', 'is-over');
  if (state.status === 'checkmate') {
    statusEl.textContent = `Checkmate — ${state.winner === 'w' ? 'White' : 'Black'} wins`;
    statusEl.classList.add('is-over');
  } else if (state.status === 'stalemate') {
    statusEl.textContent = 'Stalemate — Draw';
    statusEl.classList.add('is-over');
  } else if (state.status === 'draw') {
    const reason = { 'fifty-move': '50-move rule', 'threefold-repetition': 'threefold repetition', 'insufficient-material': 'insufficient material' }[state.drawReason] || state.drawReason;
    statusEl.textContent = `Draw — ${reason}`;
    statusEl.classList.add('is-over');
  } else {
    const who = state.turn === 'w' ? 'White' : 'Black';
    statusEl.textContent = state.inCheck ? `${who} to move — Check` : `${who} to move`;
    if (state.inCheck) statusEl.classList.add('is-check');
  }
}

function findKingSquare(board, color) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === color + 'K') return 'abcdefgh'[c] + (r + 1);
    }
  }
  return null;
}

function onSquareClick(square) {
  if (!game || inputLocked) return;
  const state = game.getState();
  if (state.status !== 'active') return;
  if (state.opponentType === 'ai' && state.turn === AI_COLOR) return; // not the human's turn

  const { r, c } = squareToRC(square);
  const piece = state.board[r][c];

  if (selectedSquare) {
    const chosen = legalMovesForSelection.find((m) => m.to === square);
    if (chosen) {
      if (chosen.promotion) {
        // Capture from/to as locals and lock the board — otherwise a click on
        // another square while the picker is open would swap out the
        // module-level `selectedSquare` from under this closure and apply the
        // wrong move.
        const from = selectedSquare;
        const to = square;
        inputLocked = true;
        showPromotionPicker(state.turn, (promotion) => {
          inputLocked = false;
          applyMove(from, to, promotion);
        });
      } else {
        applyMove(selectedSquare, square);
      }
      return;
    }
    // Clicking another of the player's own pieces switches selection instead of requiring deselect first.
    if (piece && piece[0] === state.turn) {
      selectSquare(square);
    } else {
      selectedSquare = null;
      legalMovesForSelection = [];
      render();
    }
    return;
  }

  if (piece && piece[0] === state.turn) selectSquare(square);
}

function selectSquare(square) {
  selectedSquare = square;
  legalMovesForSelection = game.getLegalMoves(square);
  render();
}

function applyMove(from, to, promotion) {
  const result = game.makeMove(from, to, promotion);
  selectedSquare = null;
  legalMovesForSelection = [];
  hidePromotionPicker();
  if (!result.ok) {
    render();
    return;
  }
  render();
  maybeTriggerAI();
}

function maybeTriggerAI() {
  const state = game.getState();
  if (state.status !== 'active' || state.opponentType !== 'ai' || state.turn !== AI_COLOR) return;
  inputLocked = true;
  statusEl.textContent = 'Computer is thinking…';
  // Yield to the browser so the "thinking" status actually paints before the
  // (synchronous, blocking) search runs — see docs/game/backend-contract.md.
  setTimeout(() => {
    const mv = chooseAIMove(game, 2);
    if (mv) game.makeMove(mv.from, mv.to, mv.promotion);
    inputLocked = false;
    render();
  }, 50);
}

// ---- Promotion picker ----
function showPromotionPicker(color, onChoose) {
  promoEl.innerHTML = '';
  promoEl.classList.remove('hidden');
  for (const type of ['Q', 'R', 'B', 'N']) {
    const btn = document.createElement('button');
    btn.appendChild(createPieceSvg(color + type));
    btn.setAttribute('aria-label', `Promote to ${type}`);
    btn.addEventListener('click', () => onChoose(type));
    promoEl.appendChild(btn);
  }
}
function hidePromotionPicker() {
  promoEl.classList.add('hidden');
  promoEl.innerHTML = '';
}

initTheme();
