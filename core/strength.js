/* core/strength.js — hand evaluation & strength decomp. Deps: utils.js */

/* ══════════════════════════════
   設計リファクタ（v3.7）:
   以前は evaluate7() が「役判定」と「連続値スコアリング（ボード補正・
   キッカー補正込み）」を1つの関数の中で混在させており、この構造が
   繰り返しバグの温床になっていた（ロイヤルフラッシュ取り逃がし、
   ホイールがカテゴリ閾値を割り込む、トリップスがストレート名で
   表示される、等）。原因はどれも「最終的な連続値スコアから
   getHandName()で役名を逆算する」という設計そのものにあった。
   ボード補正やポテンシャル加算でスコアがカテゴリ境界を跨ぐたびに
   同種のバグが再発する構造だったため、根本から分離する:

     detectHandCategory(cards)  → 役判定のみ（純粋関数、スコアなし）
     scoreHandCategory(cat, cards) → 判定済みカテゴリに対して
                                     連続値スコア（ボード補正込み）を計算
     evaluate7(cards)           → 上記2つをオーケストレートし、
                                     { score, category, categoryName }
                                     を返す（category は判定結果そのもの
                                     なので、スコアがどれだけ揺れても
                                     「スコアと役名が食い違う」バグは
                                     構造上発生しなくなる。
                                     ※ただし detectHandCategory() 自体の
                                     役判定ロジックが誤っていれば、それは
                                     そのまま役名に反映される——この分離が
                                     防ぐのはスコアとの不整合のみで、
                                     役判定ロジック自体の正しさを保証する
                                     ものではない）
══════════════════════════════ */

// レビュー指摘対応: category を生の文字列リテラルで書くとタイポに気づきにくいため、
// 定数オブジェクトを経由して参照する（HAND_CATEGORY.ROYAL_FLUSH のように使う）。
// 値そのものは内部識別子として従来通りの文字列を維持（CATEGORY_DISPLAYのキーと一致させる）。
const HAND_CATEGORY = {
  ROYAL_FLUSH:     'ROYAL_FLUSH',
  STRAIGHT_FLUSH:  'STRAIGHT_FLUSH',
  FOUR_OF_A_KIND:  'FOUR_OF_A_KIND',
  FULL_HOUSE:      'FULL_HOUSE',
  FLUSH:           'FLUSH',
  STRAIGHT:        'STRAIGHT',
  THREE_OF_A_KIND: 'THREE_OF_A_KIND',
  TWO_PAIR:        'TWO_PAIR',
  ONE_PAIR:        'ONE_PAIR',
  HIGH_CARD:       'HIGH_CARD'
};

const CATEGORY_DISPLAY = {
  ROYAL_FLUSH:     'ROYAL FLUSH',
  STRAIGHT_FLUSH:  'STRAIGHT FLUSH',
  FOUR_OF_A_KIND:  'FOUR OF A KIND',
  FULL_HOUSE:      'FULL HOUSE',
  FLUSH:           'FLUSH',
  STRAIGHT:        'STRAIGHT',
  THREE_OF_A_KIND: 'THREE OF A KIND',
  TWO_PAIR:        'TWO PAIR',
  ONE_PAIR:        'ONE PAIR',
  HIGH_CARD:       'HIGH CARD'
};

function detectHandCategory(cards) {
  const ranks = cards.map(c => RANK_IDX[c[0]]);   // 0=A … 12=2
  const suits = cards.map(c => c[1]);

  // ── flush detection ──
  const suitCounts = {};
  suits.forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);
  const flushSuit = Object.keys(suitCounts).find(s => suitCounts[s] >= 5) || null;
  const isFlush = flushSuit !== null;

  // ── straight detection (on unique sorted ranks, 全スート混在) ──
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => a - b);
  // Ace-low straight: A(0) plays as rank 13 after K(1)
  if (uniqueRanks[0] === 0) uniqueRanks.push(13);
  let straightHighIdx = -1; // index of lowest card in best straight
  // 6枚以上ランクが連続するケース（例: A-K-Q-J-T-9が全部同スート）で
  // より弱い窓に先に一致して停止しないよう、昇順(=最良の窓から)にチェックする。
  for (let k = 4; k < uniqueRanks.length; k++) {
    if (uniqueRanks[k] - uniqueRanks[k - 4] === 4) {
      straightHighIdx = k;
      break;
    }
  }
  const isStraight = straightHighIdx !== -1;

  // ── straight-flush specific detection（flushSuitのカードだけで再判定） ──
  // 一般ストレート判定を流用すると、フラッシュに関与しない余分なカードに
  // 引きずられてロイヤルフラッシュを取り逃がすバグがあったため、
  // flushSuit限定で改めてストレートを判定する。
  let sfHigh = -1; // flushSuit内で成立するストレートの下端 RANK_IDX（値が小さいほど強い）
  if (isFlush) {
    const flushRanks = cards
      .filter(c => c[1] === flushSuit)
      .map(c => RANK_IDX[c[0]])
      .sort((a, b) => a - b);
    const uFlush = [...new Set(flushRanks)];
    if (uFlush[0] === 0) uFlush.push(13);
    for (let k = 4; k < uFlush.length; k++) {
      if (uFlush[k] - uFlush[k - 4] === 4) {
        sfHigh = uFlush[k];
        break;
      }
    }
  }
  const isStraightFlush = sfHigh !== -1;

  // ── frequency map ──
  const freq = {};
  ranks.forEach(r => freq[r] = (freq[r] || 0) + 1);
  const entries = Object.entries(freq)
    .map(([r, c]) => ({ r: Number(r), c }))
    .sort((a, b) => b.c - a.c || a.r - b.r);
  const counts = entries.map(e => e.c);
  const topRank = entries[0].r;

  // ── カテゴリ確定（役判定はここで完結、スコアはまだ計算しない） ──
  let category;
  let primaryRank = topRank;   // スコア計算で使う代表ランク（役ごとに意味が変わる）
  let secondaryRank = null;    // フルハウスの組ランク／ツーペアの2組目

  if (isStraightFlush) {
    category = (sfHigh === 4) ? HAND_CATEGORY.ROYAL_FLUSH : HAND_CATEGORY.STRAIGHT_FLUSH;
    primaryRank = sfHigh;
  } else if (counts[0] === 4) {
    category = HAND_CATEGORY.FOUR_OF_A_KIND;
  } else if (counts[0] === 3 && counts[1] >= 2) {
    category = HAND_CATEGORY.FULL_HOUSE;
    secondaryRank = entries[1].r;
  } else if (isFlush) {
    category = HAND_CATEGORY.FLUSH;
    const flushCards = cards.filter(c => c[1] === flushSuit).map(c => RANK_IDX[c[0]]).sort((a, b) => a - b);
    primaryRank = flushCards[0]; // 最高フラッシュカード
  } else if (isStraight) {
    category = HAND_CATEGORY.STRAIGHT;
    primaryRank = uniqueRanks[straightHighIdx];
  } else if (counts[0] === 3) {
    category = HAND_CATEGORY.THREE_OF_A_KIND;
  } else if (counts[0] === 2 && counts[1] === 2) {
    category = HAND_CATEGORY.TWO_PAIR;
    secondaryRank = entries[1].r;
  } else if (counts[0] === 2) {
    category = HAND_CATEGORY.ONE_PAIR;
  } else {
    category = HAND_CATEGORY.HIGH_CARD;
  }

  return {
    category, primaryRank, secondaryRank, topRank,
    isFlush, flushSuit, isStraight, isStraightFlush, sfHigh,
    freq, entries, counts
  };
}


function scoreHandCategory(cat, cards) {
  const { category, primaryRank, secondaryRank, counts, isFlush, isStraight, isStraightFlush, freq } = cat;

  let madeScore, bandCeiling;

  switch (category) {
    case HAND_CATEGORY.ROYAL_FLUSH:
      madeScore = 1.00;
      bandCeiling = 1.00;
      break;
    case HAND_CATEGORY.STRAIGHT_FLUSH:
      // 次に良いSF(K-high)≈0.958、最弱SF(wheel)≈0.90
      madeScore = 0.90 + (1 - primaryRank / 12) * 0.054;
      bandCeiling = 0.954; // Royal帯(0.955+)に侵入しない
      break;
    case HAND_CATEGORY.FOUR_OF_A_KIND:
      madeScore = 0.80 + (1 - primaryRank / 12) * 0.09;
      bandCeiling = 0.895;
      break;
    case HAND_CATEGORY.FULL_HOUSE:
      madeScore = 0.70 + (1 - primaryRank / 12) * 0.09;
      bandCeiling = 0.795;
      break;
    case HAND_CATEGORY.FLUSH:
      madeScore = 0.58 + (1 - primaryRank / 12) * 0.09;
      bandCeiling = 0.675;
      break;
    case HAND_CATEGORY.STRAIGHT:
      // ホイール(A-2-3-4-5)はAceがlow扱い(idx=13)になるため通常域(4〜12)を
      // 超えて式に代入すると0.47を割り込みTHREE OF A KIND帯と誤認されうる。
      // この後のcomputeMadeStrength()内boardHazardペナルティも吸収できるよう
      // 余裕を持たせて0.49を床にする。
      madeScore = Math.max(0.49, 0.47 + (1 - primaryRank / 12) * 0.10);
      bandCeiling = 0.575;
      break;
    case HAND_CATEGORY.THREE_OF_A_KIND:
      madeScore = 0.38 + (1 - primaryRank / 12) * 0.08;
      bandCeiling = 0.465;
      break;
    case HAND_CATEGORY.TWO_PAIR:
      madeScore = 0.26 + (1 - primaryRank / 12) * 0.07 + (1 - secondaryRank / 12) * 0.04;
      bandCeiling = 0.375;
      break;
    case HAND_CATEGORY.ONE_PAIR:
      madeScore = 0.10 + (1 - primaryRank / 12) * 0.15;
      bandCeiling = 0.255;
      break;
    default: // HIGH_CARD
      madeScore = (1 - primaryRank / 12) * 0.09;
      bandCeiling = 0.095;
  }
  madeScore = clamp01(madeScore);

  // ── Layer 2: board interaction adjustment ──
  const isRoyal = category === HAND_CATEGORY.ROYAL_FLUSH;
  const isSF     = category === HAND_CATEGORY.ROYAL_FLUSH || category === HAND_CATEGORY.STRAIGHT_FLUSH;
  const ranks    = cards.map(c => RANK_IDX[c[0]]);
  const boardAdjustment = computeBoardInteraction(cards, ranks, freq, isSF, isFlush, isStraight, counts, isRoyal);

  // bandCeilingでクランプするため、ボード補正・キッカー補正がどれだけ
  // 加算されてもカテゴリ境界（例: FLUSH→STRAIGHT FLUSH帯）を跨がない。
  // これによりcategoryとscoreは常に整合する。
  return Math.min(bandCeiling, clamp01(madeScore + boardAdjustment));
}


function evaluate7(cards) {
  if (!cards || cards.length < 5) {
    return { score: 0, category: 'HIGH_CARD', categoryName: CATEGORY_DISPLAY.HIGH_CARD };
  }

  const cat = detectHandCategory(cards);
  const score = scoreHandCategory(cat, cards);

  return { score, category: cat.category, categoryName: CATEGORY_DISPLAY[cat.category] };
}


function computeBoardInteraction(cards, ranks, freq, isSF, isFlush, isStraight, counts, isRoyal) {
  if (cards.length < 7) return 0; // only meaningful with full 7-card context

  let delta = 0;

  // ── Nut-lock bonus: top-of-category hands ──
  // バグ修正: 従来は「7枚中にA(idx0)とK(idx1)が存在するか」を全スート込みでチェックしていたため、
  // フラッシュに関与しないオフスートのA/Kが混ざっているだけでロイヤル判定されてしまっていた。
  // 現在は evaluate7 側で確定した isRoyal（flushSuit内のストレートがT-J-Q-K-Aか）をそのまま使う。
  if (isSF) {
    delta += isRoyal ? 0.08 : 0.04; // Royal > other SF
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
  // ⚠ レガシー関数（v3.7リファクタ以降は使用しない）
  // 以前はrange_matrix.jsがこの関数で「スコアから役名を逆算」していたが、
  // ボード補正やポテンシャル加算でスコアが閾値を跨ぐと役名がズレるバグの
  // 温床になっていたため廃止。現在は evaluate7() が返す category/categoryName
  // （役判定そのものの結果）を直接使うため、この関数は呼ばれていない。
  // 外部デバッグ用途などでスコア単体から大まかな役名を推測したい場合のみ
  // 参考値として残す。
  if (rawScore >= 0.955) return 'ROYAL FLUSH';
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
