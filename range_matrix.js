/* core/range_matrix.js — 169 matrix, draw classif, range stats. Deps: utils, strength, texture, position */

function classifyPotential(hand, board) {
  if (board.length < 3) return 0;

  // ── Flush draw potential ──
  // Suited hands only: hand[2] === 's'
  const isSuited = hand[2] === 's';
  let hasFlushDraw = false;
  if (isSuited) {
    // Find which suit this hand would be — we don't know the specific suit here,
    // so we check the most common suit on the board (proxy for flush draw presence)
    const suitCounts = {};
    board.forEach(c => suitCounts[c[1]] = (suitCounts[c[1]] || 0) + 1);
    const maxSuitOnBoard = Math.max(...Object.values(suitCounts));
    // Suited hand has FD potential if 2+ of same suit on board (would need 1 match)
    hasFlushDraw = maxSuitOnBoard >= 2;
  }

  // ── Straight draw potential ──
  // Use hand ranks + board ranks; check for 4-card straight draws
  const ri1 = RANK_IDX[hand[0]];
  const ri2 = hand[1] && hand[1] !== 's' && hand[1] !== 'o' ? RANK_IDX[hand[1]] : null;
  const boardRanks = board.map(c => RANK_IDX[c[0]]);
  const allRanks = ri2 !== null
    ? [...new Set([ri1, ri2, ...boardRanks])].sort((a, b) => a - b)
    : [...new Set([ri1, ...boardRanks])].sort((a, b) => a - b);

  let hasOESD = false;
  let hasGSD  = false;
  for (let k = 0; k <= allRanks.length - 4; k++) {
    const span = allRanks[k + 3] - allRanks[k];
    if (span === 3) { hasOESD = true; break; }
    if (span === 4) hasGSD = true;
  }

  // ── Score ──
  // FD  = 0.45 (9 outs), OESD = 0.40 (8 outs), GSD = 0.20 (4 outs)
  // Combos: FD+OESD can coexist → cap at 0.85
  let potential = 0;
  if (hasFlushDraw) potential += 0.45;
  if (hasOESD)      potential += 0.40;
  else if (hasGSD)  potential += 0.20;

  return Math.min(0.85, potential);
}


function classifyDraw(hand, board) {
  if (board.length < 3) return null;

  // hand format: "AA" (pair), "AKs" (suited), "KAo" (offsuit)
  // hand[0] = rank1, hand[1] = rank2 (or 2nd rank char for pairs = same as [0])
  // hand[2] = 's' | 'o' | undefined (pairs have no suffix)
  const ri1 = RANK_IDX[hand[0]];
  // For pairs: hand[1] is the same rank letter, not a suit
  const ri2 = RANK_IDX[hand[1]]; // always a rank index (A-2)
  const boardRanks = board.map(c => RANK_IDX[c[0]]).sort((a, b) => a - b);
  const allRanks = [...new Set([ri1, ri2, ...boardRanks])].sort((a, b) => a - b);

  // ── Straight draw checks ──
  // OESD: 4 cards spanning exactly 3 ranks (e.g. 5678)
  for (let k = 0; k <= allRanks.length - 4; k++) {
    if (allRanks[k + 3] - allRanks[k] === 3) {
      return 'OESD';
    }
  }

  // GSD: 4 cards spanning exactly 4 ranks with one gap (e.g. 5679)
  for (let k = 0; k <= allRanks.length - 4; k++) {
    if (allRanks[k + 3] - allRanks[k] === 4) {
      return 'GSD';
    }
  }

  // ── Flush draw checks (suited hands only) ──
  // hand[2] === 's' means the hand notation is suited; pair hands have no [2]
  const isSuited = hand[2] === 's';
  if (isSuited) {
    // We don't know the exact suit of the hand in the 169 canonical form,
    // but we know suited hands share one suit. Use board's most frequent suit
    // as a proxy: if the board has 2+ of the same suit, a suited hand will
    // have FD potential for that suit combination.
    const suitCounts = {};
    board.forEach(c => suitCounts[c[1]] = (suitCounts[c[1]] || 0) + 1);
    const maxSuitCount = Math.max(...Object.values(suitCounts));
    if (maxSuitCount >= 2) return 'FD';
    if (maxSuitCount === 1) return 'BD-FD';
  }

  return null;
}


function eval169(board, hero) {
  const results = [];
  const boardSet = new Set(board);
  // Hero cards are removed from the available deck
  const heroSet  = new Set(hero || []);
  const deadSet  = new Set([...boardSet, ...heroSet]);

  // ── ボード上で最も多いスート ── 同点タイブレーク時、このスートのコンボを優先
  // (例: board に h が2枚 → AhKh のようなフラッシュドロー成立コンボを bestCombo に選ぶ)
  const suitCounts = {};
  board.forEach(c => suitCounts[c[1]] = (suitCounts[c[1]] || 0) + 1);
  const dominantSuit = Object.entries(suitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const dominantSuitCount = dominantSuit ? suitCounts[dominantSuit] : 0;

  for (let i = 0; i < 13; i++) {
    for (let j = 0; j < 13; j++) {
      const r1 = RANKS[i];
      const r2 = RANKS[j];
      let hand, activeCombos = 0;
      let bestScore = -1;
      let bestCombo = null; // 最高スコアを出した具体的コンボ "KhKd" 等
      let bestIsDominantSuit = false;

      if (i === j) {
        // Pair
        hand = r1 + r2;
        for (let s1 = 0; s1 < 4; s1++) {
          for (let s2 = s1 + 1; s2 < 4; s2++) {
            const c1 = r1 + SUITS[s1];
            const c2 = r1 + SUITS[s2];
            if (!deadSet.has(c1) && !deadSet.has(c2)) {
              activeCombos++;
              const score = evaluate7([c1, c2, ...board]);
              if (score > bestScore) { bestScore = score; bestCombo = c1 + c2; }
            }
          }
        }
      } else if (i < j) {
        // Suited — 同点なら dominantSuit と一致するコンボを優先（FD表示のため）
        hand = r1 + r2 + 's';
        for (let s = 0; s < 4; s++) {
          const c1 = r1 + SUITS[s];
          const c2 = r2 + SUITS[s];
          if (!deadSet.has(c1) && !deadSet.has(c2)) {
            activeCombos++;
            const score = evaluate7([c1, c2, ...board]);
            const isDominant = dominantSuitCount >= 2 && SUITS[s] === dominantSuit;
            // 厳密に上回るか、同点でdominantSuit一致なら採用
            if (score > bestScore || (score === bestScore && isDominant && !bestIsDominantSuit)) {
              bestScore = score; bestCombo = c1 + c2; bestIsDominantSuit = isDominant;
            }
          }
        }
      } else {
        // Offsuit
        hand = r2 + r1 + 'o';
        for (let s1 = 0; s1 < 4; s1++) {
          for (let s2 = 0; s2 < 4; s2++) {
            if (s1 === s2) continue;
            const c1 = r2 + SUITS[s1];
            const c2 = r1 + SUITS[s2];
            if (!deadSet.has(c1) && !deadSet.has(c2)) {
              activeCombos++;
              const score = evaluate7([c1, c2, ...board]);
              if (score > bestScore) { bestScore = score; bestCombo = c1 + c2; }
            }
          }
        }
      }

      const totalCombos = i === j ? 6 : (i < j ? 4 : 12);
      const rawEval7    = bestScore >= 0 ? bestScore : 0;
      const potStrength = classifyPotential(hand, board);
      const madeStr     = computeMadeStrength(rawEval7, board);
      const rawScore    = computeProjectedRawScore(madeStr, potStrength);

      results.push({
        hand:             hand,
        bestCombo:        bestCombo,       // 例: "KhKd" — 最高評価を出した具体的カード組
        rawScore:         rawScore,
        madeStrength:     madeStr,
        potentialStrength: potStrength,
        class:            classifyHandClass(rawScore),
        handName:         getHandName(rawScore),
        activeCombos:     activeCombos,
        totalCombos:      totalCombos,
        potential:        potStrength,    // alias: UI/rangeEngine との互換
        drawType:         classifyDraw(hand, board),
        outs:             Math.round(potStrength * 20) // potStrength = outs/20 から逆算
      });
    }
  }

  return results;
}


function evalRange169(board, hero, context) {
  const raw = eval169(board, hero); // hero passed for removal
  return raw.map(item => ({
    hand:              item.hand,
    bestCombo:         item.bestCombo,      // 例: "KhKd" — NUTS表示用の具体コンボ
    rawScore:          item.rawScore,
    madeStrength:      item.madeStrength,
    potentialStrength: item.potentialStrength,
    potential:         item.potential,    // alias (UI互換)
    density:           item.totalCombos > 0 ? item.activeCombos / item.totalCombos : 0,
    class:             item.class,
    handName:          item.handName,
    drawType:          item.drawType,     // UI: renderNuts で使用
    outs:              item.outs          // UI: アウツ表示で使用
  }));
}


function computeRangeStats(rangeMatrix) {
  if (!rangeMatrix || rangeMatrix.length === 0) {
    return { madeAvg: 0, potAvg: 0, drawHeavy: 0, madeSpread: 0 };
  }
  const total   = rangeMatrix.length;
  const madeAvg = rangeMatrix.reduce((s, h) => s + (h.madeStrength      || 0), 0) / total;
  const potAvg  = rangeMatrix.reduce((s, h) => s + (h.potentialStrength || 0), 0) / total;
  const drawHeavy = rangeMatrix.filter(h => (h.potentialStrength || 0) > 0.15).length / total;

  const sortedMade = [...rangeMatrix].sort((a, b) => b.madeStrength - a.madeStrength);
  const n25 = Math.max(1, Math.floor(total * 0.25));
  const topMade = sortedMade.slice(0,  n25).reduce((s, h) => s + h.madeStrength, 0) / n25;
  const botMade = sortedMade.slice(-n25).reduce((s, h) => s + h.madeStrength, 0) / n25;
  const madeSpread = topMade - botMade;

  return { madeAvg, potAvg, drawHeavy, madeSpread };
}


function computeRangeAdvantage(board, heroPos, villainPos, rangeMatrix) {
  // Position profiles
  const heroProf    = getPositionProfile(heroPos    || 'BTN');
  const villainProf = getPositionProfile(villainPos || 'BB');

  // Position-based base (hero openWidth vs villain defensibility)
  const heroBase    = (heroProf.openWidth    || 1.0) * (heroProf.adjustmentFactor    || 1.0);
  const villainBase = (villainProf.openWidth || 1.0) * (villainProf.adjustmentFactor || 1.0);
  let posAdv = (heroBase - villainBase) / Math.max(heroBase, villainBase, 0.01); // -1..+1 approx

  // Board modifier
  if (board && board.length >= 3) {
    const tex  = calcBoardTexture(board);
    const rank = classifyRankStructure(board);
    const conn = classifyConnectivity(board);
    const pair = classifyPairStructure(board);

    if (rank === 'HIGH' && conn === 'LOW_CONNECTED') posAdv += 0.18;
    if (tex.texture === 'DRY' || tex.texture === 'VERY_DRY') posAdv += 0.10;
    if (tex.texture === 'WET' || tex.texture === 'VERY_WET') posAdv -= 0.10;
    if (conn === 'CONNECTED' || conn === 'HIGHLY_CONNECTED') posAdv -= 0.12;
    if (pair === 'PAIRED' || pair === 'DOUBLE_PAIRED') posAdv -= 0.12;
    if (rank === 'LOW') posAdv -= 0.14;
  }

  // Top-range score differential (upper 30% of rangeMatrix)
  if (rangeMatrix && rangeMatrix.length > 0) {
    const sorted  = [...rangeMatrix].sort((a, b) => b.rawScore - a.rawScore);
    const topN    = Math.max(1, Math.floor(sorted.length * 0.30));
    const topAvg  = sorted.slice(0, topN).reduce((s, h) => s + h.rawScore, 0) / topN;
    // Shift toward hero if topAvg is high (strong board for aggressor)
    const scoreShift = (topAvg - 0.5) * 0.20;
    posAdv += scoreShift;
  }

  return Math.max(-1, Math.min(1, posAdv));
}


function computeNutAdvantage(board, heroPos, villainPos, rangeMatrix) {
  const heroProf    = getPositionProfile(heroPos    || 'BTN');
  const villainProf = getPositionProfile(villainPos || 'BB');

  const heroDens    = heroProf.nutDensity    || 1.0;
  const villainDens = villainProf.nutDensity || 1.0;

  // Nut threshold: top 8% of rangeMatrix rawScores
  let nutDensity  = 0;
  let nutCoverage = 0;

  if (rangeMatrix && rangeMatrix.length > 0) {
    const sorted   = [...rangeMatrix].sort((a, b) => b.rawScore - a.rawScore);
    const nutCutoff = sorted[Math.floor(sorted.length * 0.08)]?.rawScore ?? 0.80;
    const nutHands  = sorted.filter(h => h.rawScore >= nutCutoff);
    nutDensity  = nutHands.length / rangeMatrix.length;
    // coverage: fraction of nut hands that are active (density field)
    const activeDens = nutHands.reduce((s, h) => s + (h.density || 0), 0);
    nutCoverage = nutHands.length > 0 ? activeDens / nutHands.length : 0;
  }

  // Position-based nut advantage
  const rawAdv = (heroDens - villainDens) / Math.max(heroDens, villainDens, 0.01);
  // Board: high-card boards favor BTN nut region, low boards favor BB
  let boardNutShift = 0;
  if (board && board.length >= 3) {
    const rank = classifyRankStructure(board);
    if (rank === 'HIGH') boardNutShift += 0.12;
    if (rank === 'LOW')  boardNutShift -= 0.15;
  }

  const advantage = Math.max(-1, Math.min(1, rawAdv + boardNutShift));

  return { advantage, density: nutDensity, coverage: nutCoverage };
}
