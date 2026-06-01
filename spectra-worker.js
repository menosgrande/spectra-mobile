'use strict';

/**
 * SPECTRA v3.1 — Web Worker
 * eval169: ボード上で各169ハンドが「今何になっているか」を確定的に評価
 * calcNuts: 全ハンドタイプを対象に最強ハンドをランキング
 */

// ═══════════════════════════════════════════════════════════
// HAND EVALUATION ENGINE
// ═══════════════════════════════════════════════════════════

const RANKS     = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'];
const SUITS     = ['s','h','d','c'];
const RANK_VAL  = { A:14,K:13,Q:12,J:11,T:10,9:9,8:8,7:7,6:6,5:5,4:4,3:3,2:2 };
const HAND_NAMES = {
  1:'STRAIGHT FLUSH', 2:'FOUR OF A KIND', 3:'FULL HOUSE',
  4:'FLUSH', 5:'STRAIGHT', 6:'THREE OF A KIND',
  7:'TWO PAIR', 8:'ONE PAIR', 9:'HIGH CARD'
};

function rv(card) { return RANK_VAL[card[0]]; }
function sv(card) { return card[1]; }

// 5枚のカードからハンドを分類
function classify5(cards) {
  const ranks = cards.map(rv).sort((a, b) => b - a);
  const suits = cards.map(sv);
  const isFlush = suits.every(s => s === suits[0]);

  const countMap = {};
  ranks.forEach(r => countMap[r] = (countMap[r] || 0) + 1);
  const counts = Object.values(countMap).sort((a, b) => b - a);
  const uniq = [...new Set(ranks)].sort((a, b) => b - a);

  // ストレート判定
  let isStraight = false;
  let straightHigh = 0;
  if (uniq.length >= 5) {
    // 通常ストレート
    for (let i = 0; i <= uniq.length - 5; i++) {
      if (uniq[i] - uniq[i + 4] === 4) {
        isStraight = true;
        straightHigh = uniq[i];
        break;
      }
    }
    // ホイール (A-2-3-4-5)
    if (!isStraight && uniq.includes(14) && uniq.includes(2) && uniq.includes(3) && uniq.includes(4) && uniq.includes(5)) {
      isStraight = true;
      straightHigh = 5;
    }
  }

  // スコアリング用のタイブレーク値（大きいほど強い）
  // type: 小さいほど強い (1=SF, 9=HC)
  let type, tiebreak;

  if (isFlush && isStraight) {
    type = 1;
    tiebreak = straightHigh;
  } else if (counts[0] === 4) {
    type = 2;
    const quad = parseInt(Object.keys(countMap).find(k => countMap[k] === 4));
    const kicker = parseInt(Object.keys(countMap).find(k => countMap[k] !== 4));
    tiebreak = quad * 100 + (kicker || 0);
  } else if (counts[0] === 3 && counts[1] === 2) {
    type = 3;
    const trip = parseInt(Object.keys(countMap).find(k => countMap[k] === 3));
    const pair = parseInt(Object.keys(countMap).find(k => countMap[k] === 2));
    tiebreak = trip * 100 + pair;
  } else if (isFlush) {
    type = 4;
    tiebreak = ranks[0] * 1e8 + ranks[1] * 1e6 + ranks[2] * 1e4 + ranks[3] * 100 + ranks[4];
  } else if (isStraight) {
    type = 5;
    tiebreak = straightHigh;
  } else if (counts[0] === 3) {
    type = 6;
    const trip = parseInt(Object.keys(countMap).find(k => countMap[k] === 3));
    const kickers = uniq.filter(r => r !== trip).sort((a, b) => b - a);
    tiebreak = trip * 1e4 + (kickers[0] || 0) * 100 + (kickers[1] || 0);
  } else if (counts[0] === 2 && counts[1] === 2) {
    type = 7;
    const pairs = Object.keys(countMap).filter(k => countMap[k] === 2).map(Number).sort((a, b) => b - a);
    const kicker = uniq.find(r => !pairs.includes(r)) || 0;
    tiebreak = pairs[0] * 1e4 + pairs[1] * 100 + kicker;
  } else if (counts[0] === 2) {
    type = 8;
    const pair = parseInt(Object.keys(countMap).find(k => countMap[k] === 2));
    const kickers = uniq.filter(r => r !== pair).sort((a, b) => b - a);
    tiebreak = pair * 1e6 + (kickers[0] || 0) * 1e4 + (kickers[1] || 0) * 100 + (kickers[2] || 0);
  } else {
    type = 9;
    tiebreak = ranks[0] * 1e8 + ranks[1] * 1e6 + ranks[2] * 1e4 + ranks[3] * 100 + ranks[4];
  }

  return { type, tiebreak };
}

// 7枚から最強5枚
function best5From7(cards7) {
  let best = null;
  for (let i = 0; i < 3; i++)
    for (let j = i + 1; j < 4; j++)
      for (let k = j + 1; k < 5; k++)
        for (let l = k + 1; l < 6; l++)
          for (let m = l + 1; m < 7; m++) {
            const h = classify5([cards7[i], cards7[j], cards7[k], cards7[l], cards7[m]]);
            if (!best || h.type < best.type || (h.type === best.type && h.tiebreak > best.tiebreak))
              best = h;
          }
  return best;
}

// ハンドスコアを「強さ%」に変換（表示用）
// type1(SF)=100%, type9(HC)=~5% の目安で線形マッピング
function typeToStrength(type) {
  const map = { 1: 98, 2: 90, 3: 80, 4: 70, 5: 60, 6: 45, 7: 30, 8: 15, 9: 5 };
  return map[type] || 5;
}

// ═══════════════════════════════════════════════════════════
// DEAD CARD CHECK
// ═══════════════════════════════════════════════════════════

function isDead(card, deadSet) {
  return deadSet.has(card);
}

// ═══════════════════════════════════════════════════════════
// EVAL 169 — ボード上での確定的ハンド評価
// ═══════════════════════════════════════════════════════════
//
// 各169ハンドについて「代表コンボ」を1つ選び、
// ボードと合わせた7枚（またはflop以下なら5枚）で
// 現在のハンドランクを確定的に計算する。
// equityではなく「今何になっているか」を返す。
//
// index順: RANKS×RANKSの上三角 (169エントリ)
// i<j → suited (r1r2s), i>j → offsuit (r2r1o), i==j → pair (r1r1)

function eval169(board, hero) {
  const boardCards = (board || []).filter(Boolean);
  const deadSet = new Set([...(hero || []), ...boardCards].filter(Boolean));

  const results = [];

  for (let i = 0; i < 13; i++) {
    for (let j = 0; j < 13; j++) {
      const r1 = RANKS[i], r2 = RANKS[j];
      let handStr, c1, c2, isSuited, isPair;

      if (i === j) {
        // ペア
        handStr = r1 + r2;
        isPair = true;
        isSuited = false;
        // 使えるスーツの組み合わせを探す
        let found = false;
        for (let a = 0; a < 4 && !found; a++) {
          for (let b = a + 1; b < 4 && !found; b++) {
            const ca = r1 + SUITS[a], cb = r2 + SUITS[b];
            if (!isDead(ca, deadSet) && !isDead(cb, deadSet)) {
              c1 = ca; c2 = cb; found = true;
            }
          }
        }
        if (!found) { results.push(null); continue; }
      } else if (i < j) {
        // suited (上三角)
        handStr = r1 + r2 + 's';
        isSuited = true; isPair = false;
        let found = false;
        for (let s = 0; s < 4 && !found; s++) {
          const ca = r1 + SUITS[s], cb = r2 + SUITS[s];
          if (!isDead(ca, deadSet) && !isDead(cb, deadSet)) {
            c1 = ca; c2 = cb; found = true;
          }
        }
        if (!found) { results.push(null); continue; }
      } else {
        // offsuit (下三角) — 表示はr2r1o
        handStr = r2 + r1 + 'o';
        isSuited = false; isPair = false;
        let found = false;
        outer:
        for (let a = 0; a < 4; a++) {
          for (let b = 0; b < 4; b++) {
            if (a === b) continue;
            const ca = r2 + SUITS[a], cb = r1 + SUITS[b];
            if (!isDead(ca, deadSet) && !isDead(cb, deadSet)) {
              c1 = ca; c2 = cb; found = true; break outer;
            }
          }
        }
        if (!found) { results.push(null); continue; }
      }

      // ボードと合わせて評価
      const allCards = [c1, c2, ...boardCards];
      let handResult;

      if (allCards.length >= 5) {
        handResult = best5From7(allCards);
      } else if (allCards.length === 4) {
        // turn以前：4枚での暫定評価（ペア・ツーペア・トリップス判定）
        const r = allCards.map(rv);
        const countMap = {};
        r.forEach(x => countMap[x] = (countMap[x] || 0) + 1);
        const counts = Object.values(countMap).sort((a, b) => b - a);
        let type = 9;
        if (counts[0] === 3) type = 6;
        else if (counts[0] === 2 && counts[1] === 2) type = 7;
        else if (counts[0] === 2) type = 8;
        handResult = { type, tiebreak: Math.max(...r) };
      } else {
        // preflop / 2枚だけ
        const r = allCards.map(rv).sort((a, b) => b - a);
        const countMap = {};
        r.forEach(x => countMap[x] = (countMap[x] || 0) + 1);
        const counts = Object.values(countMap).sort((a, b) => b - a);
        const type = counts[0] === 2 ? 8 : 9;
        handResult = { type, tiebreak: r[0] * 100 + (r[1] || 0) };
      }

      const strength = typeToStrength(handResult.type);

      results.push({
        hand: handStr,
        equity: strength,           // UIのheatmap用（0-100）
        pct: strength,
        rc: handResult.type,        // ハンドランク (1=SF … 9=HC)
        handName: HAND_NAMES[handResult.type] || 'HIGH CARD',
        tiebreak: handResult.tiebreak,
        suited: isSuited,
        pair: isPair,
      });
    }
  }

  return results.filter(Boolean);
}

// ═══════════════════════════════════════════════════════════
// CALC NUTS — 全ハンドタイプ対象の最強ハンドランキング
// ═══════════════════════════════════════════════════════════

function calcNuts(board) {
  const boardCards = (board || []).filter(Boolean);
  if (boardCards.length < 3) return [];

  const deadSet = new Set(boardCards);
  const candidates = [];

  for (let i = 0; i < 13; i++) {
    for (let j = i; j < 13; j++) {
      const r1 = RANKS[i], r2 = RANKS[j];
      const isPair = i === j;

      // suited combos
      if (!isPair) {
        for (let s = 0; s < 4; s++) {
          const c1 = r1 + SUITS[s], c2 = r2 + SUITS[s];
          if (isDead(c1, deadSet) || isDead(c2, deadSet)) continue;
          const allCards = [c1, c2, ...boardCards];
          if (allCards.length >= 5) {
            const h = best5From7(allCards);
            candidates.push({ c1, c2, hand: r1 + r2 + 's', ...h });
          }
        }
      }

      // offsuit combos
      for (let a = 0; a < 4; a++) {
        for (let b = 0; b < 4; b++) {
          if (isPair && b <= a) continue;
          if (!isPair && a === b) continue;
          const c1 = r1 + SUITS[a], c2 = r2 + SUITS[b];
          if (isDead(c1, deadSet) || isDead(c2, deadSet)) continue;
          const allCards = [c1, c2, ...boardCards];
          if (allCards.length >= 5) {
            const h = best5From7(allCards);
            const handStr = isPair ? (r1 + r2) : (r1 + r2 + 'o');
            candidates.push({ c1, c2, hand: handStr, ...h });
          }
        }
      }
    }
  }

  // ソート: type昇順（強い順）→ tiebreak降順
  candidates.sort((a, b) => a.type !== b.type ? a.type - b.type : b.tiebreak - a.tiebreak);

  // 重複排除（同じハンド文字列で最強のものだけ残す）
  const seen = new Set();
  const unique = [];
  for (const c of candidates) {
    if (!seen.has(c.hand)) {
      seen.add(c.hand);
      unique.push(c);
    }
  }

  // 上位15件を返す
  return unique.slice(0, 15).map((c, idx) => ({
    rank: idx + 1,
    hand: c.hand,
    combo: c.c1 + c.c2,
    rc: c.type,
    handName: HAND_NAMES[c.type] || 'HIGH CARD',
    equity: typeToStrength(c.type),
    tiebreak: c.tiebreak,
  }));
}

// ═══════════════════════════════════════════════════════════
// BOARD TEXTURE (軽量、JS計算)
// ═══════════════════════════════════════════════════════════

function analyzeTexture(board) {
  const cards = (board || []).filter(Boolean);
  if (cards.length < 3) return null;

  const ranks = cards.map(rv);
  const suits = cards.map(sv);
  const sorted = [...ranks].sort((a, b) => a - b);

  // connectedness
  let gaps = 0;
  for (let i = 1; i < sorted.length; i++) gaps += sorted[i] - sorted[i - 1];
  const connect = Math.max(0, Math.round(100 - gaps * 9));

  // flush density
  const suitCounts = {};
  suits.forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);
  const maxSuit = Math.max(...Object.values(suitCounts));
  const flush = Math.round(maxSuit / cards.length * 100);

  const wet = Math.round((connect + flush) / 2);
  const lbl = wet >= 80 ? 'VERY WET / 非常に危険'
            : wet >= 60 ? 'WET / 危険'
            : wet >= 40 ? 'SEMI-WET / やや危険'
            : wet >= 20 ? 'DRY / 安全' : 'VERY DRY / 非常に安全';

  return { wet, connect, flush, lbl };
}

// ═══════════════════════════════════════════════════════════
// CACHE
// ═══════════════════════════════════════════════════════════

const cache = new Map();

function cacheKey(board) {
  return (board || []).filter(Boolean).sort().join(',');
}

// ═══════════════════════════════════════════════════════════
// MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════

self.onmessage = function(e) {
  const { id, type, payload } = e.data;

  switch (type) {
    case 'INIT':
      self.postMessage({ type: 'HELLO', version: '3.1' });
      break;

    case 'EVAL_169': {
      const key = cacheKey(payload.board);
      if (cache.has(key)) {
        self.postMessage({ id, type: 'EVAL_169', cached: true, data: cache.get(key) });
        return;
      }
      const t0 = performance.now();
      const data = eval169(payload.board, payload.hero);
      const calcTime = Math.round(performance.now() - t0);
      cache.set(key, data);
      self.postMessage({ id, type: 'EVAL_169', cached: false, calcTime, data });
      break;
    }

    case 'NUTS': {
      const key = 'nuts:' + cacheKey(payload.board);
      if (cache.has(key)) {
        self.postMessage({ id, type: 'NUTS', cached: true, data: cache.get(key) });
        return;
      }
      const t0 = performance.now();
      const data = calcNuts(payload.board);
      const calcTime = Math.round(performance.now() - t0);
      cache.set(key, data);
      self.postMessage({ id, type: 'NUTS', cached: false, calcTime, data });
      break;
    }

    case 'TEXTURE': {
      const data = analyzeTexture(payload.board);
      self.postMessage({ id, type: 'TEXTURE', data });
      break;
    }

    case 'CACHE_CLEAR':
      cache.clear();
      self.postMessage({ id, type: 'CACHE_CLEAR', cleared: true });
      break;

    default:
      self.postMessage({ id, type: 'ERROR', error: `Unknown: ${type}` });
  }
};

console.log('[Spectra Worker v3.1] Ready');
