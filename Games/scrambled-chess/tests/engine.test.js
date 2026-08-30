// Node-based self-tests for chess-engine.js / ai.js. Run: node game/tests/engine.test.js
//
// chess-engine.js and ai.js are plain classic scripts (no import/export) so
// the game can be opened directly via file:// in a browser — see the note
// at the top of chess-engine.js. To test them from Node, run their source
// in a vm context (which shares one global scope across both files, the
// same way two <script> tags do in a page) and pull the globals they expose
// back out, rather than using ES import.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/chess-engine.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/ai.js'), 'utf8'), sandbox);
const { ChessGame, chooseAIMove } = sandbox;

let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`FAIL  ${name}`);
    console.log(`      ${err.message}`);
    failed++;
  }
}

test('classic starting position is correct', () => {
  const g = new ChessGame('classic', 'twoPlayer');
  assert.equal(g.board[0].join(','), 'wR,wN,wB,wQ,wK,wB,wN,wR');
  assert.equal(g.board[1].every((p) => p === 'wP'), true);
  assert.equal(g.board[6].every((p) => p === 'bP'), true);
  assert.equal(g.board[7].join(','), 'bR,bN,bB,bQ,bK,bB,bN,bR');
  assert.equal(g.turn, 'w');
  assert.equal(g.status, 'active');
});

test('pawn double-move and basic legal moves from start', () => {
  const g = new ChessGame('classic', 'twoPlayer');
  // Array.from() re-materializes the array in this (main) realm — arrays
  // built inside the vm sandbox belong to a different realm than this test
  // file's own array literals, which makes assert's strict deepEqual report
  // a false mismatch ("same structure but not reference-equal") even when
  // the content is identical. This is purely a test-harness artifact of
  // using vm.createContext; it doesn't affect the real browser, where all
  // classic <script> tags share one realm. See engine.test.js's header note.
  const moves = Array.from(g.getLegalMoves('e2').map((m) => m.to)).sort();
  assert.deepEqual(moves, ['e3', 'e4']);
});

test('en passant capture is legal immediately after and only immediately after a double push', () => {
  const g = new ChessGame('classic', 'twoPlayer');
  assert.equal(g.makeMove('e2', 'e4').ok, true);
  assert.equal(g.makeMove('a7', 'a6').ok, true);
  assert.equal(g.makeMove('e4', 'e5').ok, true);
  assert.equal(g.makeMove('d7', 'd5').ok, true); // black double push next to white pawn on e5
  const epMoves = g.getLegalMoves('e5').map((m) => m.to);
  assert.ok(epMoves.includes('d6'), 'expected en passant capture to d6 to be legal');
  const res = g.makeMove('e5', 'd6');
  assert.equal(res.ok, true);
  assert.equal(g.board[4][3], null, 'captured black pawn on d5 should be removed'); // r=4 -> rank5, c=3 -> d
  assert.equal(g.board[5][3], 'wP', 'white pawn should now be on d6');

  // en passant window closes after one move
  const g2 = new ChessGame('classic', 'twoPlayer');
  g2.makeMove('e2', 'e4');
  g2.makeMove('a7', 'a6');
  g2.makeMove('e4', 'e5');
  g2.makeMove('d7', 'd5');
  g2.makeMove('a2', 'a3'); // unrelated move — en passant right should now be gone
  g2.makeMove('a6', 'a5');
  const stale = g2.getLegalMoves('e5').map((m) => m.to);
  assert.ok(!stale.includes('d6'), 'en passant should not be available after a move passes');
});

test('pawn promotion produces the requested piece', () => {
  const g = new ChessGame('classic', 'twoPlayer');
  // Clear a path: place a white pawn on b7 with nothing on b8, black king elsewhere.
  g.board = g.board.map((row) => row.slice());
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) g.board[r][c] = null;
  g.board[6][1] = 'wP'; // b7
  g.board[0][4] = 'wK'; // e1
  g.board[7][4] = 'bK'; // e8
  g.turn = 'w';
  g.status = 'active';
  const moves = g.getLegalMoves('b7');
  assert.ok(moves.some((m) => m.to === 'b8' && Array.isArray(m.promotion)));
  const res = g.makeMove('b7', 'b8', 'R');
  assert.equal(res.ok, true);
  assert.equal(g.board[7][1], 'wR');
});

test('kingside castling works when path is clear and safe', () => {
  const g = new ChessGame('classic', 'twoPlayer');
  g.board[0][5] = null; // f1
  g.board[0][6] = null; // g1
  const moves = g.getLegalMoves('e1');
  assert.ok(moves.some((m) => m.to === 'g1' && m.isCastle === 'K'));
  const res = g.makeMove('e1', 'g1');
  assert.equal(res.ok, true);
  assert.equal(g.board[0][6], 'wK');
  assert.equal(g.board[0][5], 'wR');
  assert.equal(g.board[0][4], null);
  assert.equal(g.board[0][7], null);
});

test('castling is illegal if the king would pass through an attacked square', () => {
  const g = new ChessGame('classic', 'twoPlayer');
  g.board[0][5] = null; // f1 empty
  g.board[0][6] = null; // g1 empty
  g.board[1][5] = null; // f2 pawn cleared — open the file
  g.board[6][5] = null; // f7 pawn cleared — open the file all the way
  g.board[7][5] = 'bR'; // black rook on f8 now attacks the whole f-file, including f1
  const moves = g.getLegalMoves('e1');
  assert.ok(!moves.some((m) => m.to === 'f1'), 'king should not be able to step into check on f1 either');
  assert.ok(!moves.some((m) => m.isCastle === 'K'), 'castling should be blocked by an attacked transit square');
});

test('queenside castling works when path is clear and safe', () => {
  const g = new ChessGame('classic', 'twoPlayer');
  g.board[0][1] = null; // b1
  g.board[0][2] = null; // c1
  g.board[0][3] = null; // d1
  const moves = g.getLegalMoves('e1');
  assert.ok(moves.some((m) => m.to === 'c1' && m.isCastle === 'Q'));
  const res = g.makeMove('e1', 'c1');
  assert.equal(res.ok, true);
  assert.equal(g.board[0][2], 'wK');
  assert.equal(g.board[0][3], 'wR');
  assert.equal(g.board[0][0], null);
  assert.equal(g.board[0][4], null);
});

test('threefold repetition is detected as a draw', () => {
  const g = new ChessGame('classic', 'twoPlayer');
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) g.board[r][c] = null;
  g.board[0][4] = 'wK'; g.board[7][4] = 'bK'; g.board[0][0] = 'wR';
  g.turn = 'w'; g.status = 'active';
  g.castling.w.kingMoved = true; g.castling.b.kingMoved = true;
  g._recordPosition();
  // Shuffle the same rook and king back and forth: the exact same position
  // (same board + turn) recurs every 2 full cycles.
  const seq = [['a1', 'a2'], ['e8', 'd8'], ['a2', 'a1'], ['d8', 'e8']];
  let i = 0;
  while (g.status === 'active' && i < 40) {
    const [from, to] = seq[i % seq.length];
    const res = g.makeMove(from, to);
    assert.equal(res.ok, true, `move ${from}-${to} should be legal (iteration ${i})`);
    i++;
  }
  assert.equal(g.status, 'draw');
  assert.equal(g.drawReason, 'threefold-repetition');
});

test('checkmate is detected (Scholar\'s Mate)', () => {
  const g = new ChessGame('classic', 'twoPlayer');
  const seq = [['e2', 'e4'], ['e7', 'e5'], ['f1', 'c4'], ['b8', 'c6'], ['d1', 'h5'], ['g8', 'f6'], ['h5', 'f7']];
  for (const [from, to] of seq) {
    const res = g.makeMove(from, to);
    assert.equal(res.ok, true, `move ${from}-${to} should be legal`);
  }
  assert.equal(g.status, 'checkmate');
  assert.equal(g.winner, 'w');
});

test('stalemate is detected and distinguished from checkmate', () => {
  const g = new ChessGame('classic', 'twoPlayer');
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) g.board[r][c] = null;
  // Classic stalemate: Black king a8, White king c7, White queen b6 — Black to move, not in check, no legal moves.
  g.board[7][0] = 'bK'; // a8
  g.board[6][2] = 'wK'; // c7
  g.board[5][1] = 'wQ'; // b6
  g.turn = 'b';
  g.status = 'active';
  g._recordPosition();
  g._refreshStatus();
  assert.equal(g.isInCheck('b'), false);
  assert.equal(g.status, 'stalemate');
  assert.equal(g.drawReason, 'stalemate');
  assert.equal(g.winner, null);
});

test('scrambled mode always places the king between the two rooks (100 trials)', () => {
  for (let i = 0; i < 100; i++) {
    const g = new ChessGame('scrambled', 'twoPlayer');
    for (const row of [0, 7]) {
      const backRank = g.board[row];
      const kingIdx = backRank.findIndex((p) => p && p[1] === 'K');
      const rookIdxs = [];
      backRank.forEach((p, idx) => { if (p && p[1] === 'R') rookIdxs.push(idx); });
      assert.equal(rookIdxs.length, 2);
      assert.ok(rookIdxs[0] < kingIdx && kingIdx < rookIdxs[1], `row ${row}: king not between rooks (${backRank.join(',')})`);
      const pawnRow = row === 0 ? 1 : 6;
      assert.ok(g.board[pawnRow].every((p) => p && p[1] === 'P'), 'pawn rank must stay all pawns');
    }
  }
});

test('scrambled game still supports castling to the same g/c destination squares', () => {
  // Force a known scrambled back rank by constructing the board directly:
  // R N K B Q B N R  (king at file c=2, rooks at 0 and 7 -> king between rooks)
  const g = new ChessGame('classic', 'twoPlayer');
  const backRank = ['R', 'N', 'K', 'B', 'Q', 'B', 'N', 'R'];
  for (let c = 0; c < 8; c++) {
    g.board[0][c] = 'w' + backRank[c];
    g.board[7][c] = 'b' + backRank[c];
  }
  g.castling.w = { homeRow: 0, kingFile: 2, queensideRookFile: 0, kingsideRookFile: 7, kingMoved: false, queensideRookMoved: false, kingsideRookMoved: false };
  g.castling.b = { homeRow: 7, kingFile: 2, queensideRookFile: 0, kingsideRookFile: 7, kingMoved: false, queensideRookMoved: false, kingsideRookMoved: false };
  // Clear squares between king(c1) and kingside rook(h1): d1,e1,f1,g1
  for (const c of [3, 4, 5, 6]) g.board[0][c] = null;
  const moves = g.getLegalMoves('c1');
  const castle = moves.find((m) => m.isCastle === 'K');
  assert.ok(castle, 'expected kingside castle to be available');
  assert.equal(castle.to, 'g1');
  const res = g.makeMove('c1', 'g1');
  assert.equal(res.ok, true);
  assert.equal(g.board[0][6], 'wK');
  assert.equal(g.board[0][5], 'wR', 'kingside rook should land on f1 regardless of its scrambled start file');
});

test('fifty-move rule triggers a draw (and resets on capture)', () => {
  const g = new ChessGame('classic', 'twoPlayer');
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) g.board[r][c] = null;
  g.board[0][4] = 'wK'; g.board[0][0] = 'wR';
  g.board[7][4] = 'bK'; g.board[7][7] = 'bR';
  g.turn = 'w'; g.status = 'active';
  g.castling.w.kingMoved = true; g.castling.b.kingMoved = true;
  g._recordPosition();
  assert.equal(g.makeMove('a1', 'a2').ok, true); // quiet, non-pawn, non-capture move
  assert.equal(g.halfmoveClock, 1);
  g.halfmoveClock = 99; // fast-forward instead of repeating one position 3x (which would trigger threefold instead)
  const res = g.makeMove('h8', 'h7');
  assert.equal(res.ok, true);
  assert.equal(g.status, 'draw');
  assert.equal(g.drawReason, 'fifty-move');

  // A capture must reset the clock, not just a pawn move.
  const g2 = new ChessGame('classic', 'twoPlayer');
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) g2.board[r][c] = null;
  g2.board[0][4] = 'wK'; g2.board[3][3] = 'wR'; // d4
  g2.board[7][4] = 'bK'; g2.board[3][6] = 'bN'; // g4
  g2.turn = 'w'; g2.status = 'active';
  g2.castling.w.kingMoved = true; g2.castling.b.kingMoved = true;
  g2.halfmoveClock = 50;
  g2._recordPosition();
  const cap = g2.makeMove('d4', 'g4'); // rook captures knight
  assert.equal(cap.ok, true);
  assert.equal(g2.halfmoveClock, 0, 'a capture must reset the halfmove clock');
});

test('AI always returns a legal move and never crashes across random self-play', () => {
  const g = new ChessGame('classic', 'twoPlayer');
  let moveCount = 0;
  while (g.status === 'active' && moveCount < 40) {
    const mv = chooseAIMove(g, 2);
    assert.ok(mv, 'AI should return a move while the game is active');
    const legal = g.getLegalMoves(mv.from).map((m) => m.to);
    assert.ok(legal.includes(mv.to), `AI move ${mv.from}-${mv.to} must be in the legal move list`);
    const res = g.makeMove(mv.from, mv.to, mv.promotion);
    assert.equal(res.ok, true);
    moveCount++;
  }
  assert.ok(moveCount > 0);
});

test('AI plays legally from a scrambled starting position too', () => {
  const g = new ChessGame('scrambled', 'ai');
  let moveCount = 0;
  while (g.status === 'active' && moveCount < 20) {
    const mv = chooseAIMove(g, 2);
    assert.ok(mv);
    const res = g.makeMove(mv.from, mv.to, mv.promotion);
    assert.equal(res.ok, true);
    moveCount++;
  }
  assert.ok(moveCount > 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
