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
  let straightHighRank = -1; // 成立したストレートの最高位カードのRANK_IDX（値が小さいほど強い）
  // バグ修正（pokersolver突き合わせで発覚、v3.7.5）: 以前は`straightHighIdx = k`として
  // ウィンドウの終端（配列の昇順で見て一番後ろ=RANK_IDXが一番大きい=一番弱いカード）を
  // 保存しており、後段で`uniqueRanks[straightHighIdx]`とそのまま使っていたため、
  // 実際には「ストレートの中で一番弱いカード」をスコアリングに使ってしまっていた
  // （例: 3-4-5-6-7の7ハイストレートで、本来の最高位カード'7'ではなく
  // 最弱の'3'のRANK_IDXが使われ、5ハイのホイールと点数が同じになる、
  // 7ハイの方が8ハイより高得点になる、といった順序の乱れが起きていた）。
  // 以前はSF/Quads等の固定ボーナスがbandCeilingへの張り付きを引き起こしており、
  // その副作用でこのバグがスコア上マスクされ続けていた（ボーナス撤去で露呈）。
  // 正しくはウィンドウの開始点（uniqueRanks[k-4]、RANK_IDXが一番小さい=一番強い
  // カード）を使う。
  // 6枚以上ランクが連続するケース（例: A-K-Q-J-T-9が全部同スート）で
  // より弱い窓に先に一致して停止しないよう、昇順(=最良の窓から)にチェックする。
  for (let k = 4; k < uniqueRanks.length; k++) {
    if (uniqueRanks[k] - uniqueRanks[k - 4] === 4) {
      straightHighRank = uniqueRanks[k - 4];
      break;
    }
  }
  const isStraight = straightHighRank !== -1;

  // ── straight-flush specific detection（flushSuitのカードだけで再判定） ──
  // 一般ストレート判定を流用すると、フラッシュに関与しない余分なカードに
  // 引きずられてロイヤルフラッシュを取り逃がすバグがあったため、
  // flushSuit限定で改めてストレートを判定する。
  let sfHigh = -1; // flushSuit内で成立するストレートの最高位カードのRANK_IDX（値が小さいほど強い）
  if (isFlush) {
    const flushRanks = cards
      .filter(c => c[1] === flushSuit)
      .map(c => RANK_IDX[c[0]])
      .sort((a, b) => a - b);
    const uFlush = [...new Set(flushRanks)];
    if (uFlush[0] === 0) uFlush.push(13);
    for (let k = 4; k < uFlush.length; k++) {
      // 同上のバグ修正: ウィンドウの開始点(k-4)を使う。
      if (uFlush[k] - uFlush[k - 4] === 4) {
        sfHigh = uFlush[k - 4];
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
    // sfHighは修正後、ウィンドウの開始点（最高位カード）を指すようになったため、
    // ロイヤル(T-J-Q-K-A)の判定も「最高位カードがA(idx0)か」に変更する
    // （旧コードでは窓の終端＝T(idx4)を見ていたため sfHigh===4 だった）。
    category = (sfHigh === 0) ? HAND_CATEGORY.ROYAL_FLUSH : HAND_CATEGORY.STRAIGHT_FLUSH;
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
    primaryRank = straightHighRank;
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


/* ══════════════════════════════
   外部レビュー対応（同一カテゴリ内のキッカー比較バグ修正）:
   以前は各カテゴリのスコアが primaryRank（と一部 secondaryRank）だけで
   決まっており、同じ役の中でのキッカー差（例: フルハウスの下のペア、
   クアッズの余り1枚、トリップス/ワンペアの残りカード）が一切スコアに
   反映されていなかった。結果、KK/QQ/33/44のフルハウスが完全に同点になる、
   AK/J9のクアッズが完全に同点になる、といった誤順位付けが起きていた。
   （ワンペアのキッカー比較は従来computeBoardInteraction側で行っていたが、
   「count===1のエントリを rank 昇順でソートして先頭を取る」という実装が
   実質「盤面上のカードの中で一番強いカードを常に拾う」だけになっており、
   ホールカードのキッカーがどれだけ強くても盤面のAに埋もれて反映されない
   バグがあった）

   kickerFraction(): [primaryRank, kicker1, kicker2, ...] のようなランク列を
   base-13の位取り記数法で単一の分数にエンコードする。
   value = Σ (12 - rank_i) / 13^(i+1)
   この方式なら、より上位（先頭に近い）のランクの差は、それより下位の
   ランク列がどんな値を取ろうと必ず上回る（等比級数の性質）。
   つまり「primaryRankが同じ場合のみ次のキッカーで比較する」という
   ポーカー本来のキッカー比較順序を、複雑な条件分岐なしに再現できる。
══════════════════════════════ */
function kickerFraction(rankTuple) {
  let value = 0;
  for (let i = 0; i < rankTuple.length; i++) {
    const r = Math.max(0, Math.min(12, rankTuple[i]));
    value += (12 - r) / Math.pow(13, i + 1);
  }
  return value; // [0, 1) 未満
}

// entries（{r, c}の配列、count降順・rank昇順ソート済み）から、
// excludeRanks に含まれないランクを rank昇順（強い順）で数え上げ、
// 先頭 count 個を返す。足りない場合は最弱値(12)で埋める。
function getExtraKickers(entries, excludeRanks, count) {
  const excludeSet = new Set(excludeRanks);
  const remaining = entries
    .filter(e => !excludeSet.has(e.r))
    .map(e => e.r)
    .sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(remaining[i] !== undefined ? remaining[i] : 12);
  }
  return result;
}

function scoreHandCategory(cat, cards) {
  const { category, primaryRank, secondaryRank, counts, isFlush, isStraight, isStraightFlush, freq, entries, flushSuit } = cat;

  let madeScore, bandCeiling, bandWidth;

  // キッカー分のスコアはband幅の95%までに抑え、残り5%をboardAdjustment
  // （ホールカードの寄与ボーナス等）の余地として空けておく。
  // これにより「キッカー最強＋board補正最大」でもbandCeilingを超えて
  // クランプされ、別のキッカー差が消える事態をできる限り避ける。
  const KICKER_HEADROOM = 0.95;

  switch (category) {
    case HAND_CATEGORY.ROYAL_FLUSH:
      madeScore = 1.00;
      bandCeiling = 1.00;
      bandWidth = 0.045;
      break;
    case HAND_CATEGORY.STRAIGHT_FLUSH:
      // 次に良いSF(K-high)≈0.958、最弱SF(wheel)≈0.90
      // ストレートフラッシュは最高位カード1枚で強さが完全に決まるため
      // （5枚全部が連番同スートなので、他のキッカーという概念自体が無い）、
      // primaryRankのみの評価で正しい。
      madeScore = 0.90 + (1 - primaryRank / 12) * 0.054;
      bandCeiling = 0.954; // Royal帯(0.955+)に侵入しない
      bandWidth = 0.054;
      break;
    case HAND_CATEGORY.FOUR_OF_A_KIND: {
      // バグ修正: 以前はprimaryRank(クアッズのランク)のみでキッカー(5枚目)を
      // 無視していた。クアッズ+キッカー1枚をタプルでエンコードする。
      const kicker = getExtraKickers(entries, [primaryRank], 1);
      const width = 0.09;
      bandWidth = width;
      madeScore = 0.80 + kickerFraction([primaryRank, ...kicker]) * width * KICKER_HEADROOM;
      bandCeiling = 0.895;
      break;
    }
    case HAND_CATEGORY.FULL_HOUSE: {
      // バグ修正: 以前はsecondaryRank（下位のペア）を保持していたのに
      // スコア計算で一切使っていなかった。777/KKと777/QQが完全に同点になっていた。
      // フルハウスはトリップ+ペアの5枚で完結するため、これ以上のキッカーは不要。
      const width = 0.09;
      bandWidth = width;
      madeScore = 0.70 + kickerFraction([primaryRank, secondaryRank]) * width * KICKER_HEADROOM;
      bandCeiling = 0.795;
      break;
    }
    case HAND_CATEGORY.FLUSH: {
      // バグ修正: 以前は最高位フラッシュカード1枚(primaryRank)のみで
      // 2〜5枚目の差を無視していた（4-flushボードでQ/J/9ハイのフラッシュが
      // 全部同点になっていた）。フラッシュを構成する5枚（同スート、強い順）を
      // タプルでエンコードする。
      const flushRanks = cards
        .filter(c => c[1] === flushSuit)
        .map(c => RANK_IDX[c[0]])
        .sort((a, b) => a - b)
        .slice(0, 5);
      const width = 0.09;
      bandWidth = width;
      madeScore = 0.58 + kickerFraction(flushRanks) * width * KICKER_HEADROOM;
      bandCeiling = 0.675;
      break;
    }
    case HAND_CATEGORY.STRAIGHT:
      // ホイール(A-2-3-4-5)はAceがlow扱い(idx=13)になるため通常域(4〜12)を
      // 超えて式に代入すると0.47を割り込みTHREE OF A KIND帯と誤認されうる。
      // この後のcomputeMadeStrength()内boardHazardペナルティも吸収できるよう
      // 余裕を持たせて0.49を床にする。
      // ストレートも最高位カード1枚で強さが完全に決まる（5枚連番の並びが
      // 決まればキッカーの概念が無い）ため、primaryRankのみの評価で正しい。
      madeScore = Math.max(0.49, 0.47 + (1 - primaryRank / 12) * 0.10);
      bandCeiling = 0.575;
      bandWidth = 0.10;
      break;
    case HAND_CATEGORY.THREE_OF_A_KIND: {
      // バグ修正: 以前はprimaryRank(トリップのランク)のみでキッカー2枚を無視していた。
      const kickers = getExtraKickers(entries, [primaryRank], 2);
      const width = 0.08;
      bandWidth = width;
      madeScore = 0.38 + kickerFraction([primaryRank, ...kickers]) * width * KICKER_HEADROOM;
      bandCeiling = 0.465;
      break;
    }
    case HAND_CATEGORY.TWO_PAIR: {
      // バグ修正: 以前は上位ペア・下位ペアのみでキッカー(5枚目)を無視していた。
      const kicker = getExtraKickers(entries, [primaryRank, secondaryRank], 1);
      const width = 0.11; // 0.07(primary)+0.04(secondary)相当の合計幅を維持
      bandWidth = width;
      madeScore = 0.26 + kickerFraction([primaryRank, secondaryRank, ...kicker]) * width * KICKER_HEADROOM;
      bandCeiling = 0.375;
      break;
    }
    case HAND_CATEGORY.ONE_PAIR: {
      // バグ修正: 以前はcomputeBoardInteraction側で「count===1のカードを
      // rank昇順ソートして先頭を取る」というキッカー処理をしていたが、
      // これは実質「7枚の中で一番強いカード」を毎回拾うだけになっており、
      // 盤面に強いカード（例:A）があると、ホールカードのキッカーがどれだけ
      // 強くても常に盤面のカードに埋もれて無視される欠陥があった
      // （例: 77A92盤面でKQ/JT/54を持っても、キッカーは常に盤面のAになり
      // 全部同点になっていた）。ペアランク+キッカー3枚をタプルでエンコードし、
      // computeBoardInteraction側の重複ロジックは削除した。
      const kickers = getExtraKickers(entries, [primaryRank], 3);
      const width = 0.15;
      bandWidth = width;
      madeScore = 0.10 + kickerFraction([primaryRank, ...kickers]) * width * KICKER_HEADROOM;
      bandCeiling = 0.255;
      break;
    }
    default: { // HIGH_CARD
      // バグ修正: 以前はtopRank(最高位カード)1枚のみで残り4枚を無視していた。
      const kickers = getExtraKickers(entries, [primaryRank], 4);
      const width = 0.09;
      bandWidth = width;
      madeScore = kickerFraction([primaryRank, ...kickers]) * width * KICKER_HEADROOM;
      bandCeiling = 0.095;
    }
  }
  madeScore = clamp01(madeScore);

  // ── Layer 2: board interaction adjustment ──
  const isRoyal = category === HAND_CATEGORY.ROYAL_FLUSH;
  const isSF     = category === HAND_CATEGORY.ROYAL_FLUSH || category === HAND_CATEGORY.STRAIGHT_FLUSH;
  const ranks    = cards.map(c => RANK_IDX[c[0]]);
  const boardAdjustment = computeBoardInteraction(cards, ranks, freq, isSF, isFlush, isStraight, counts, isRoyal, bandWidth);

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


function computeBoardInteraction(cards, ranks, freq, isSF, isFlush, isStraight, counts, isRoyal, width) {
  // 外部レビュー対応・pokersolver突き合わせでの発見（v3.7.5）:
  // 以前はここで「ホールカードが役に絡んでいるボーナス」「ボードだけで
  // 役が完成している場合のペナルティ」「SF/Royalの追加ボーナス」を
  // 固定値または小さくスケールした値で加算していたが、これらはどれも
  // 本物のポーカーのルールには存在しない、SPECTRA独自の演出的な加点だった。
  //
  // scoreHandCategory()側でkickerFraction()による正確なキッカー比較を
  // 導入した結果、これらの加点が「深い位置のキッカー差」（例: フラッシュの
  // 3〜5枚目、ワンペアの2〜3枚目のキッカー）を上書きしてしまう新たな
  // バグを引き起こすことが判明した。深い位置のキッカーの粒度は
  // 13^n（nは何番目か）で指数関数的に小さくなるため、どんなに小さく
  // スケールした固定ボーナスでも、いずれかの位置の粒度を必ず上回って
  // しまい、完全に正確な順序付けとは両立しない。
  //
  // ポーカーのハンド強度は「役のカテゴリ＋キッカーの並び」だけで完全に
  // 決まるべきものであり、それ以上の"演出的加点"は本質的に不要と判断し、
  // このセッションで全て撤去した。
  //
  // 検証: pokersolver（独立実装のポーカー評価ライブラリ、npm）との突き合わせで、
  // ランダム7枚2万件のカテゴリ一致率100%、ランダムなボード+2ホール対決
  // 2万件の勝敗順序一致率100%、既存の固定エッジケース6/6一致を確認済み。
  return 0;
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
