// Simple AI opponent: material + light positional evaluation, negamax with
// alpha-beta pruning. Intentionally not strong — see docs/game/requirements.md
// ("AI strength" decision) and docs/game/backend-contract.md for scope.
//
// Plain classic script — relies on PIECE_VALUES and FILES (both from
// chess-engine.js, which must be loaded first; see index.html's script
// order) already being in global scope. See the note in chess-engine.js for
// why this isn't an ES module. Reuses the global FILES rather than
// redeclaring it — a same-named top-level `const` in two classic scripts
// sharing one global scope is a SyntaxError, not a harmless shadow.

const CENTER_SQUARES = new Set(['d4', 'd5', 'e4', 'e5']);

function evaluateBoard(board, color) {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      const pieceColor = piece[0];
      const type = piece[1];
      const sign = pieceColor === color ? 1 : -1;
      score += sign * PIECE_VALUES[type];
      const sq = FILES[c] + (r + 1);
      if (CENTER_SQUARES.has(sq) && type !== 'K') score += sign * 0.15;
    }
  }
  return score;
}

// Score from the perspective of the side to move in `game`.
function evaluatePosition(game) {
  if (game.status === 'checkmate') return -100000;
  if (game.status === 'stalemate' || game.status === 'draw') return 0;
  return evaluateBoard(game.board, game.turn);
}

function negamax(game, depth, alpha, beta) {
  if (depth === 0 || game.status !== 'active') return evaluatePosition(game);

  const moves = game.getAllLegalMoves();
  let best = -Infinity;
  for (const mv of moves) {
    const clone = game.clone();
    clone.makeMove(mv.from, mv.to, 'Q');
    const score = -negamax(clone, depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

// Returns { from, to, promotion } for the side to move, or null if no legal moves.
function chooseAIMove(game, depth = 2) {
  const moves = game.getAllLegalMoves();
  if (moves.length === 0) return null;

  let bestScore = -Infinity;
  let bestMoves = [];
  for (const mv of moves) {
    const clone = game.clone();
    clone.makeMove(mv.from, mv.to, 'Q');
    const score = -negamax(clone, depth - 1, -Infinity, Infinity);
    if (score > bestScore + 1e-9) {
      bestScore = score;
      bestMoves = [mv];
    } else if (Math.abs(score - bestScore) <= 1e-9) {
      bestMoves.push(mv);
    }
  }

  const chosen = bestMoves[Math.floor(Math.random() * bestMoves.length)];
  return { from: chosen.from, to: chosen.to, promotion: 'Q' };
}

globalThis.chooseAIMove = chooseAIMove;
