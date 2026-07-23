/* core/range_matrix.js — 169 matrix, draw classif, range stats. Deps: utils, strength, texture, position */

function classifyPotential(hand, board) {
  if (board.length < 3) return 0;
  // バグ修正: 以前はboard.length<3のガードしかなく、リバー(5枚)でも
  // フロップ/ターンと同じロジックでpotentialStrengthを計算していた。
  // リバーは次のカードが来ないため「ドローの伸びしろ」という概念自体が
  // 存在せず、常に0であるべき。
  if (board.length >= 5) return 0;

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
    // バグ修正: maxSuitOnBoard>=2なら常に「ドロー」として+0.45していたが、
    // board側に既に3枚以上同スートがある場合、スーテッドハンド（2枚）と合わせて
    // 5枚以上になり、フラッシュは既に完成している（ドローではない）。
    // 例: 4-flushボード+スーテッドハンド = ロイヤル/フラッシュ完成なのに
    // 「まだドロー中」として二重にpotentialを加算していた。
    // → ちょうど2枚（=まだ1枚足りない、本物のドロー）の時だけ加算する。
    hasFlushDraw = maxSuitOnBoard === 2;
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

  // バグ修正: allRanks内に「5枚連続」＝完成済みストレートが既に存在する場合、
  // その中の4枚部分集合が偶然OESDパターン（span===3）に一致してしまい、
  // 「役が完成しているのに、さらにドローの伸びしろがある」という
  // 二重計上バグが起きていた（例: J-Q-A盤面でK-Tsが完成ブロードウェイなのに
  // OESD+0.40が上乗せされ、最終スコアが閾値をまたいでhandNameが誤表示される）。
  // → 5枚連続が既に成立している場合は、それはmadeStrength側の仕事なので
  //   ここでは追加のOESD/GSD potentialを与えない。
  // ホイール(A-2-3-4-5)はAceがlow側にも回るため、Aceを13として扱う別配列でも判定する。
  const straightCheckRanks = allRanks[0] === 0 ? [...allRanks, 13] : allRanks;
  let hasMadeStraight = false;
  for (let k = 0; k <= straightCheckRanks.length - 5; k++) {
    if (straightCheckRanks[k + 4] - straightCheckRanks[k] === 4) { hasMadeStraight = true; break; }
  }

  if (!hasMadeStraight) {
    for (let k = 0; k <= allRanks.length - 4; k++) {
      const span = allRanks[k + 3] - allRanks[k];
      if (span === 3) { hasOESD = true; break; }
      if (span === 4) hasGSD = true;
    }
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
  // バグ修正: 同上。リバー(5枚)ではドロー概念自体が存在しないため、
  // FD/OESD/GSD/BD-FDのようなタグを一切付けない。
  if (board.length >= 5) return null;

  // hand format: "AA" (pair), "AKs" (suited), "KAo" (offsuit)
  // hand[0] = rank1, hand[1] = rank2 (or 2nd rank char for pairs = same as [0])
  // hand[2] = 's' | 'o' | undefined (pairs have no suffix)
  const ri1 = RANK_IDX[hand[0]];
  // For pairs: hand[1] is the same rank letter, not a suit
  const ri2 = RANK_IDX[hand[1]]; // always a rank index (A-2)
  const boardRanks = board.map(c => RANK_IDX[c[0]]).sort((a, b) => a - b);
  const allRanks = [...new Set([ri1, ri2, ...boardRanks])].sort((a, b) => a - b);

  // ── Straight draw checks ──
  // バグ修正: classifyPotentialと同様、5枚連続（完成済みストレート）が
  // 既に存在する場合は、それを「ドロー」として二重にタグ付けしない。
  // ホイール(A-2-3-4-5)はAceをlow(13扱い)にした配列でも判定する。
  const straightCheckRanks = allRanks[0] === 0 ? [...allRanks, 13] : allRanks;
  let hasMadeStraight = false;
  for (let k = 0; k <= straightCheckRanks.length - 5; k++) {
    if (straightCheckRanks[k + 4] - straightCheckRanks[k] === 4) { hasMadeStraight = true; break; }
  }

  if (!hasMadeStraight) {
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
    // バグ修正: board側に既に3枚以上同スートがあれば、スーテッドハンド(2枚)と
    // 合わせて5枚以上=フラッシュは既に完成しておりドローではない。
    // 「まだ1枚足りない」ちょうど2枚の時だけFDタグを付ける。
    if (maxSuitCount === 2) return 'FD';
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

  for (let i = 0; i < 13; i++) {
    for (let j = 0; j < 13; j++) {
      const r1 = RANKS[i];
      const r2 = RANKS[j];
      let hand, evals = [], activeCombos = 0;

      if (i === j) {
        // Pair
        hand = r1 + r2;
        for (let s1 = 0; s1 < 4; s1++) {
          for (let s2 = s1 + 1; s2 < 4; s2++) {
            const c1 = r1 + SUITS[s1];
            const c2 = r1 + SUITS[s2];
            if (!deadSet.has(c1) && !deadSet.has(c2)) {
              activeCombos++;
              evals.push(evaluate7([c1, c2, ...board]));
            }
          }
        }
      } else if (i < j) {
        // Suited
        hand = r1 + r2 + 's';
        for (let s = 0; s < 4; s++) {
          const c1 = r1 + SUITS[s];
          const c2 = r2 + SUITS[s];
          if (!deadSet.has(c1) && !deadSet.has(c2)) {
            activeCombos++;
            evals.push(evaluate7([c1, c2, ...board]));
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
              evals.push(evaluate7([c1, c2, ...board]));
            }
          }
        }
      }

      const totalCombos = i === j ? 6 : (i < j ? 4 : 12);

      // ── 代表コンボ（最高スコア）を選ぶ ──
      // 設計リファクタ（v3.7）: 以前は数値スコアの配列からMath.maxで
      // 最高値を取り、その数値からgetHandName()で役名を「逆算」していた。
      // これはボード補正やポテンシャル加算で数値が閾値を跨ぐたびに
      // 役名がズレるバグの温床だった（ロイヤル取り逃がし・トリップスが
      // ストレート扱い等、いずれもこの1session内で発見・修正済み）。
      // 今は evaluate7() が判定した「本物のカテゴリ」をそのまま運ぶため、
      // 数値がどれだけ揺れても「スコアと役名が食い違う」バグは構造上発生しない
      // （detectHandCategory自体の役判定ロジックが誤っていれば話は別）。
      let best = null;
      for (const e of evals) {
        if (!best || e.score > best.score) best = e;
      }
      const rawEval7 = best ? best.score : 0;

      const potStrength = classifyPotential(hand, board);
      const madeStr     = computeMadeStrength(rawEval7, board);
      const rawScore    = computeProjectedRawScore(madeStr, potStrength);

      // ── Live Combo数 ──
      // バグ修正: activeCombosは「dead cardでブロックされていないコンボ数」であって、
      // 「代表コンボと同じ役に到達したコンボ数」ではない。通常スートは対称なので
      // 問題にならないが、ボード自体に濃いフラッシュ関連（3+同スート等）がある場合、
      // スーテッドハンド4通りのうち実際にボードと同スートが揃うのは1通りだけ、
      // というケースが起きる（例: 4-flushボード+スーテッドハンド=ロイヤルは
      // 実質1コンボしかないのに、activeCombosは4のまま＝表示上「Live: 4」の誤表示）。
      // 代表コンボの category と直接一致するコンボだけを数える（スコアの逆算比較ではない）。
      const topClassCombos = best ? evals.filter(e => e.category === best.category).length : 0;

      results.push({
        hand:             hand,
        rawScore:         rawScore,
        madeStrength:     madeStr,
        potentialStrength: potStrength,
        class:            classifyHandClass(rawScore),
        handName:         best ? best.categoryName : 'HIGH CARD', // ← getHandName()による逆算をやめ、判定済みcategoryをそのまま使う
        activeCombos:     activeCombos,
        topClassCombos:   topClassCombos,
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
    rawScore:          item.rawScore,
    madeStrength:      item.madeStrength,
    potentialStrength: item.potentialStrength,
    potential:         item.potential,    // alias (UI互換)
    density:           item.totalCombos > 0 ? item.activeCombos / item.totalCombos : 0,
    class:             item.class,
    handName:          item.handName,
    drawType:          item.drawType,     // UI: renderNuts で使用
    outs:              item.outs,         // UI: アウツ表示で使用
    topClassCombos:    item.topClassCombos, // UI: renderNutsのLive Combo表示で使用（同じ役に到達したコンボ数）
    totalCombos:       item.totalCombos     // UI: renderNutsでのbaseTotal算出に使用
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


/* ══════════════════════════════
   computeStructureFeatures
   5軸すべて 0-100 (整数)

   データソース別に独立した指標を計算する。
   PokerのGTOや戦略的判断は含まない — 純粋な構造統計。

   Entropy      rawScore分布 → 複雑さ
                0=全ハンドが同一強度  100=あらゆる強さが均等に分布
   Polarization rawScore分布 → 強弱差
                0=上下25%の差なし    100=上位と下位が最大乖離
   Coverage     density      → レンジの広さ
                0=全コンボデッド      100=169ハンド全生存
   DrawStructure drawType    → ドロー構造  (UI表示名: Draw Pressure)
                0=ドロー要素皆無      100=複合ドローが充満
   Dominance    rawScore分布 → Gini不平等度
                0=全ハンドの強さが均等  100=一部ハンドが格差を独占
                ← モノトーンボードで高い、クアッズボードで低い
══════════════════════════════ */
function computeStructureFeatures(rangeMatrix) {
  const live = rangeMatrix.filter(h => h.density > 0);
  if (live.length === 0) {
    return { entropy: 0, polarization: 0, coverage: 0, drawStructure: 0, dominance: 0 };
  }

  const n      = live.length;
  const scores = live.map(h => h.rawScore);
  const total  = scores.reduce((s, v) => s + v, 0);

  // A. Entropy（rawScore → 複雑さ）
  // Shannon entropy を 20ビンで計算し、log2(20) で正規化
  const BIN  = 20;
  const bins = new Array(BIN).fill(0);
  scores.forEach(s => bins[Math.min(BIN - 1, Math.floor(s * BIN))]++);
  const entropyRaw = -bins.reduce((sum, c) => {
    if (!c) return sum;
    const p = c / n;
    return sum + p * Math.log2(p);
  }, 0);
  const entropy = Math.round((entropyRaw / Math.log2(BIN)) * 100);

  // B. Polarization（rawScore → 強弱差）
  // 上位25%平均 - 下位25%平均
  const sorted = [...scores].sort((a, b) => b - a);
  const q25    = Math.max(1, Math.floor(n * 0.25));
  const topAvg = sorted.slice(0, q25).reduce((s, v) => s + v, 0) / q25;
  const botAvg = sorted.slice(-q25).reduce((s, v) => s + v, 0) / q25;
  const polarization = Math.round((topAvg - botAvg) * 100);

  // C. Coverage（density → レンジの広さ）
  // バグ修正: 従来は「169ハンドのうち生存コンボが1つでもあるか」を数えていたが、
  // 同ランクが3枚以上ボードに出るような極端なケース以外ではほぼ全ハンドが
  // 多少なりとも生き残るため、実質常に100固定になっていた
  // （レーダーのCOV軸が常に最大表示になる原因）。
  // → 169ハンド全体の平均density（生存コンボの割合）に変更し、
  //   カード除去の影響量を連続的に反映するようにする。
  const avgDensityAll = rangeMatrix.reduce((s, h) => s + (h.density || 0), 0) / 169;
  const coverage = Math.round(avgDensityAll * 100);

  // D. DrawStructure（drawType → ドロー構造）
  // LiveDrawRatio×0.4 + DrawComplexity×0.4 + DrawOverlap×0.2
  const withDraw      = live.filter(h => h.drawType && h.drawType !== '--');
  const liveDrawRatio = withDraw.length / n;
  const drawTypes     = new Set(withDraw.map(h => h.drawType));
  const drawComplexity = drawTypes.size / 4; // FD/OESD/GSD/BD-FD → max 4種
  const fdSet   = new Set(withDraw.filter(h => h.drawType.includes('FD')).map(h => h.hand));
  const sdSet   = new Set(withDraw.filter(h => h.drawType === 'OESD' || h.drawType === 'GSD').map(h => h.hand));
  const drawOverlap   = [...fdSet].filter(h => sdSet.has(h)).length / n;
  const drawStructure = Math.round(
    clamp01(liveDrawRatio * 0.40 + drawComplexity * 0.40 + drawOverlap * 0.20) * 100
  );

  // E. Dominance（rawScore → Gini不平等度）
  // Gini係数: 0=完全均等、1=完全集中
  // モノトーンボードで高い（フラッシュ持ちだけが圧倒的強さ）
  // クアッズボードで低い（ほぼ全ハンドがフルハウス帯に密集）
  const ascended = [...scores].sort((a, b) => a - b);
  let giniNum = 0;
  ascended.forEach((v, i) => { giniNum += (2 * (i + 1) - n - 1) * v; });
  const dominance = Math.round(
    (total > 0 ? Math.max(0, giniNum / (n * total)) : 0) * 100
  );

  return { entropy, polarization, coverage, drawStructure, dominance };
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
