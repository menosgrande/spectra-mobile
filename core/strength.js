/* core/strength.js — hand evaluation & strength decomp. Deps: utils.js */

function evaluate7(cards) {
  if (!cards || cards.length < 5) return 0;

  const ranks = cards.map(c => RANK_IDX[c[0]]);   // 0=A … 12=2
  const suits = cards.map(c => c[1]);

  // ── flush detection ──
  const suitCounts = {};
  suits.forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);
  const flushSuit = Object.keys(suitCounts).find(s => suitCounts[s] >= 5) || null;
  const isFlush = flushSuit !== null;

  // ── straight detection (on unique sorted ranks) ──
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => a - b);
  // Ace-low straight: A(0) plays as rank 13 after K(1)
  if (uniqueRanks[0] === 0) uniqueRanks.push(13);
  let straightHighIdx = -1; // index of lowest card in best straight
  for (let k = uniqueRanks.length - 1; k >= 4; k--) {
    if (uniqueRanks[k] - uniqueRanks[k - 4] === 4) {
      straightHighIdx = k;
      break;
    }
  }
  const isStraight = straightHighIdx !== -1;
  const isStraightFlush = isFlush && isStraight && (function() {
    const flushRanks = cards
      .filter(c => c[1] === flushSuit)
      .map(c => RANK_IDX[c[0]])
      .sort((a, b) => a - b);
    const uFlush = [...new Set(flushRanks)];
    if (uFlush[0] === 0) uFlush.push(13);
    for (let k = uFlush.length - 1; k >= 4; k--) {
      if (uFlush[k] - uFlush[k - 4] === 4) return true;
    }
    return false;
  })();

  // ── frequency map ──
  const freq = {};
  ranks.forEach(r => freq[r] = (freq[r] || 0) + 1);
  // pairs/trips sorted by count desc, then rank asc (lower idx = higher card)
  const entries = Object.entries(freq)
    .map(([r, c]) => ({ r: Number(r), c }))
    .sort((a, b) => b.c - a.c || a.r - b.r);
  const counts = entries.map(e => e.c);

  // ── Layer 1: base made-hand score (0…1) ──
  let madeScore;
  const topRank = entries[0].r; // rank index of primary card (0=Ace)

  if (isStraightFlush) {
    // sfHigh = uniqueRanks[straightHighIdx] = lowest-rank-index card in the straight
    // RANK_IDX: A=0, K=1, Q=2, J=3, T=4, ...
    // Royal Flush = T-J-Q-K-A → low card = T(idx=4) → sfHigh=4
    // A-2-3-4-5 (wheel SF) → low card = A treated as low(idx=13 or 0), handled separately
    const sfHigh = uniqueRanks[straightHighIdx];
    // Royal: sfHigh=4 (Ten is the lowest card, Ace is high)
    const isRoyal = (sfHigh === 4);
    // Score: Royal=1.00, next best SF (K-high, sfHigh=5) ≈ 0.958, lowest SF ≈ 0.90
    // Use sfHigh to distinguish within SF band
    madeScore = isRoyal ? 1.00 : 0.90 + (1 - sfHigh / 12) * 0.054;
  } else if (counts[0] === 4) {
    // Quads: 0.80..0.89, higher quads = higher score
    madeScore = 0.80 + (1 - topRank / 12) * 0.09;
  } else if (counts[0] === 3 && counts[1] >= 2) {
    // Full house: 0.70..0.79
    madeScore = 0.70 + (1 - topRank / 12) * 0.09;
  } else if (isFlush) {
    // Flush: 0.58..0.67 (high-card flush > low-card flush)
    const flushCards = cards.filter(c => c[1] === flushSuit).map(c => RANK_IDX[c[0]]).sort((a, b) => a - b);
    const flushTop = flushCards[0]; // lowest idx = highest card
    madeScore = 0.58 + (1 - flushTop / 12) * 0.09;
  } else if (isStraight) {
    // Straight: 0.47..0.57
    const stHigh = uniqueRanks[straightHighIdx];
    madeScore = 0.47 + (1 - stHigh / 12) * 0.10;
  } else if (counts[0] === 3) {
    // Trips: 0.38..0.46
    madeScore = 0.38 + (1 - topRank / 12) * 0.08;
  } else if (counts[0] === 2 && counts[1] === 2) {
    // Two pair: 0.26..0.37
    const secondRank = entries[1].r;
    madeScore = 0.26 + (1 - topRank / 12) * 0.07 + (1 - secondRank / 12) * 0.04;
  } else if (counts[0] === 2) {
    // One pair: 0.10..0.25
    madeScore = 0.10 + (1 - topRank / 12) * 0.15;
  } else {
    // High card: 0.00..0.09
    madeScore = (1 - topRank / 12) * 0.09;
  }
  madeScore = clamp01(madeScore);

  // ── Band ceiling: カテゴリ境界をまたぐ補正を防止 ──
  let bandCeiling;
  if (isStraightFlush) {
    // Royal (madeScore=1.00) → ceiling=1.00
    // Non-Royal SF (madeScore<1.00) → ceiling=0.954（Royal帯0.955+に侵入しない）
    bandCeiling = (madeScore >= 0.9999) ? 1.00 : 0.954;
  } else if (counts[0] === 4)                    { bandCeiling = 0.895; }
  else if (counts[0] === 3 && counts[1] >= 2)    { bandCeiling = 0.795; }
  else if (isFlush)                              { bandCeiling = 0.675; }
  else if (isStraight)                           { bandCeiling = 0.575; }
  else if (counts[0] === 3)                      { bandCeiling = 0.465; }
  else if (counts[0] === 2 && counts[1] === 2)   { bandCeiling = 0.375; }
  else if (counts[0] === 2)                      { bandCeiling = 0.255; }
  else                                            { bandCeiling = 0.095; }

  // ── Layer 2: board interaction adjustment ──
  const boardAdjustment = computeBoardInteraction(cards, ranks, freq, isStraightFlush, isFlush, isStraight, counts);

  return Math.min(bandCeiling, clamp01(madeScore + boardAdjustment));
}


function computeBoardInteraction(cards, ranks, freq, isSF, isFlush, isStraight, counts) {
  if (cards.length < 7) return 0; // only meaningful with full 7-card context

  let delta = 0;

  // ── Nut-lock bonus: top-of-category hands ──
  if (isSF) {
    const sfRanks = [...ranks].sort((a, b) => a - b);
    delta += (sfRanks[0] === 0 && sfRanks[1] === 1) ? 0.08 : 0.04; // Royal > other SF
  } else if (counts[0] === 4) {
    delta += 0.06;
  }

  // ── Hand contribution bonus: hand cards are active in the made hand ──
  // Rewards hands that *use* their hole cards (vs. playing the board)
  const handRanks = cards.slice(0, 2).map(c => RANK_IDX[c[0]]);
  let handContrib = 0;
  for (const r of handRanks) {
    if ((freq[r] || 0) >= 2) handContrib += 1.0; // hole card makes a pair/better
    else if ((freq[r] || 0) === 1) handContrib += 0.2; // single matching rank (weak)
  }
  delta += clamp01(handContrib / 2) * 0.06;

  // ── Kicker quality for pair hands ──
  if (counts[0] === 2) {
    const kickers = Object.entries(freq)
      .filter(([, c]) => c === 1)
      .map(([r]) => Number(r))
      .sort((a, b) => a - b);
    if (kickers.length > 0) delta += (1 - kickers[0] / 12) * 0.04;
  }

  // ── Board-lock penalty: great board but hand doesn't use it ──
  // (e.g. holding 72o on AAAKK — playing the board)
  const boardRanksSet = new Set(cards.slice(2).map(c => RANK_IDX[c[0]]));
  const handUsesBoard = handRanks.some(r => boardRanksSet.has(r));
  if (!handUsesBoard && (counts[0] >= 3)) {
    delta -= 0.04; // strong board but hole cards don't contribute
  }

  return delta; // caller does clamp01(madeScore + delta)
}


function classifyHandClass(score) {
  // Thresholds calibrated to evaluate7 output ranges:
  //   SF/Quads/Boat  ≥ 0.70
  //   Flush/Straight ≥ 0.47
  //   Trips          ≥ 0.38
  //   Two pair       ≥ 0.26
  //   One pair       ≥ 0.10
  //   High card       < 0.10
  if (score >= 0.80) return 'NUTS';          // SF / Quads / top Boat
  if (score >= 0.44) return 'TOP_PAIR_PLUS'; // Flush, Straight, Trips, Boats
  if (score >= 0.26) return 'MIDDLE_PAIR';   // Two pair
  if (score >= 0.10) return 'WEAK_PAIR';     // One pair
  return 'AIR';
}


function getHandName(rawScore) {
  if (rawScore >= 0.90) return 'STRAIGHT FLUSH';
  if (rawScore >= 0.80) return 'FOUR OF A KIND';
  if (rawScore >= 0.70) return 'FULL HOUSE';
  if (rawScore >= 0.58) return 'FLUSH';
  if (rawScore >= 0.47) return 'STRAIGHT';
  if (rawScore >= 0.38) return 'THREE OF A KIND';
  if (rawScore >= 0.26) return 'TWO PAIR';
  if (rawScore >= 0.10) return 'ONE PAIR';
  return 'HIGH CARD';
}


function boardHazard(board) {
  const ranks      = board.map(c => RANK_IDX[c[0]]);
  const highCount  = ranks.filter(r => r <= 4).length; // A,K,Q,J,T
  const sorted     = [...ranks].sort((a, b) => a - b);
  let minGap       = Infinity;
  for (let i = 1; i < sorted.length; i++) minGap = Math.min(minGap, sorted[i] - sorted[i - 1]);
  const isConnected = minGap <= 1;
  const freq = {};
  ranks.forEach(r => freq[r] = (freq[r] || 0) + 1);
  const isPaired = Object.values(freq).some(c => c >= 2);

  let h = (highCount / board.length) * 0.60; // high-card density
  if (isConnected)  h += 0.15;               // connected board → more combos for villain
  if (!isPaired)    h += 0.05;               // unpaired → villain has more two-pair combos
  return Math.min(1, h);
}


function computeMadeStrength(rawEval7, board) {
  const haz     = boardHazard(board);
  const penalty = haz * 0.03 * (1 - rawEval7);
  return Math.max(0, rawEval7 - penalty);
}


function computeProjectedRawScore(madeStrength, potentialStrength) {
  const potWeight = 0.35 * (1 - madeStrength);
  return Math.min(1, madeStrength + potentialStrength * potWeight);
}
