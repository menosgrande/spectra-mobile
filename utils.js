/* core/utils.js — constants, cache, clamp01. No deps. */

/**
 * SPECTRA v3.5 Worker
 * Protocol: INIT_OK handshake
 * Public API : BOARD_INTELLIGENCE (unified entry point)
 * Legacy API : EVAL_169 / TEXTURE  (backward compat, internally delegated)
 *
 * Evaluation stack:
 *   evaluate7()          → 0-1 continuous score (two-layer: made + board interaction)
 *   classifyHandClass()  → NUTS / TOP_PAIR_PLUS / MIDDLE_PAIR / WEAK_PAIR / AIR
 *   evalRange169()       → 169-hand matrix { hand, rawScore, potential, density, class }
 *   computeRangeAdvantage() → -1..+1 (+ = hero advantage)
 *   computeNutAdvantage()   → { advantage:-1..+1, density, coverage }
 *   analyzeBoard()       → full BOARD_INTELLIGENCE response
 */

const RANKS = 'AKQJT98765432';
const SUITS = 'shdc';
const RANK_IDX = {};
RANKS.split('').forEach((r, i) => RANK_IDX[r] = i);

const HAND_TYPES = {
  1: 'STRAIGHT FLUSH',
  2: 'FOUR OF A KIND',
  3: 'FULL HOUSE',
  4: 'FLUSH',
  5: 'STRAIGHT',
  6: 'THREE OF A KIND',
  7: 'TWO PAIR',
  8: 'ONE PAIR',
  9: 'HIGH CARD'
};

let evalCache = new Map();

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}
