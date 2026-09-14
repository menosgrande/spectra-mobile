/* core/equity.js — computeEquity(): 真のWin Probability / Equity計算。
 * Deps: utils.js（RANKS/SUITS）, strength.js（evaluate7）
 *
 * v3.9.50（⑥-A/B/C）: 仕様固定＋river実装＋golden test。
 *
 * HERO_RANKとの違い（意図的に計算コアを独立させている理由）:
 *   HERO_RANK = Heroの現在の手が、生存コンボ全体の中で何%より強いか
 *               （静的な強さのpercentile。相手が実際に何を持っているかは問わない）
 *   EQUITY    = Villainの具体的なコンボ（レンジ）と、残りのboard runoutを尽くした
 *               ときの実際のshowdown結果（win/tie/loss）
 *   数学的に別物であり、HERO_RANKのロジックを流用・分岐させるのではなく、
 *   computeEquity()として独立した関数にする。
 *
 * データ契約:
 *   computeEquity({ hero, board, villainRange?, iterations? })
 *   → { winCount, tieCount, lossCount, totalWeight,
 *       winProbability, tieProbability, lossProbability, equity }
 *   equity = winProbability + tieProbability * 0.5
 *
 *   villainRange省略時: Hero+boardと衝突しない全2-card combinationsを
 *   weight=1で均等採用する（computeHeroRank()の比較母集団に近い「全生存
 *   コンボ均等」）。169表のクラス表現（'AKs'等）をそのままvillainRangeに
 *   流用しない——実際のequity計算にはスート・カード除去を反映した具体的な
 *   2枚コンボへの展開が必須なため。
 *
 *   villainRange指定時: MVPでは未実装。将来
 *   [{cards:['As','Kd'], weight:0.5}, ...] 形式の重み付きコンボ列へ拡張する
 *   ためのAPI予約のみ。指定された場合は明示的にエラーを投げる（黙って無視しない）。
 *
 * 街ごとの計算方式:
 *   river（board.length===5）: 完全列挙、厳密値（precise:true）。v3.9.50で実装。
 *   turn（board.length===4） : 残り1枚を完全列挙、厳密値（precise:true）。v3.9.51（⑥-D）で実装。
 *   flop（board.length===3） : Monte Carlo（デフォルトiterations=50000、precise:false）。
 *   v3.9.52（⑥-E）で実装。mulberry32による軽量seedable PRNGを使用。公開APIとして
 *   seedは正式に持たない（将来のvillainRange/Worker API整備と合わせて検討）が、
 *   computeEquityFlop()自体は直接seedを渡せるため、テストでの再現性は担保できる。
 *   preflop（board.length<3）: evaluate7が5枚未満で機能しないため非対応
 *   （HERO_RANKと同じ制約）。
 */

const DEFAULT_FLOP_ITERATIONS = 50000;

// v3.9.52（⑥-E）: mulberry32 — 軽量・seedable PRNG。Worker内でも安全に動く
// （Math.randomより若干遅いだけで、依存ライブラリ無しで書ける）。flopの
// Monte Carloは公開APIとしてseedを正式に持たない（今回は見送り、将来の
// villainRange/Worker API整備と合わせて検討する）が、テストの再現性
// （同一seed・同一入力で同一結果）を担保するため、computeEquityFlop()
// 自体はseedを直接受け取れる形にしてある。
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildDefaultVillainCombos(deadSet) {
  // computeHeroRank()（range_matrix.js）と同じ実績あるパターン：
  // 生存デッキを作り、そこから2枚の全組み合わせ（C(n,2)）を列挙する。
  const deck = [];
  for (let i = 0; i < 13; i++) {
    for (let s = 0; s < 4; s++) {
      const c = RANKS[i] + SUITS[s];
      if (!deadSet.has(c)) deck.push(c);
    }
  }
  const combos = [];
  for (let i = 0; i < deck.length; i++) {
    for (let j = i + 1; j < deck.length; j++) {
      combos.push({ cards: [deck[i], deck[j]], weight: 1 });
    }
  }
  return combos;
}

function computeEquity({ hero, board, villainRange, iterations } = {}) {
  if (!hero || hero.length !== 2) {
    throw new Error('computeEquity: hero must be exactly 2 cards');
  }
  if (!board || board.length < 3) {
    // v3.9.50: preflop（board.length<3）はevaluate7が5枚未満で機能しないため
    // 非対応（HERO_RANKと同じ制約をそのまま踏襲）。
    throw new Error('computeEquity: preflop (board.length < 3) is not supported');
  }
  if (villainRange) {
    // v3.9.50: MVPでは未実装。黙って無視せず明示的にエラーにする
    // （API予約のみ、将来[{cards, weight}, ...]形式で対応）。
    throw new Error('computeEquity: villainRange is reserved for future use and not yet implemented in this MVP');
  }

  const deadSet = new Set([...board, ...hero]);
  const villainCombos = buildDefaultVillainCombos(deadSet);

  if (board.length === 5) {
    return computeEquityRiver(hero, board, villainCombos);
  }
  if (board.length === 4) {
    return computeEquityTurn(hero, board, villainCombos);
  }
  if (board.length === 3) {
    return computeEquityFlop(hero, board, villainCombos, iterations || DEFAULT_FLOP_ITERATIONS);
  }
  throw new Error(`computeEquity: unsupported board.length ${board.length}`);
}

function computeEquityFlop(hero, board, villainCombos, iterations, seed) {
  // v3.9.52（⑥-E）: flopは残り2枚（C(45,2)最大990通り）×Villainコンボ数
  // （最大C(47,2)=1081通り）で組み合わせ爆発するため、river/turnと違い
  // 完全列挙ではなくMonte Carloで近似する。villainRangeは今回もMVPの
  // 均等レンジのみなので、Villainコンボは重み無視で一様抽出してよい
  // （全コンボweight=1のため、一様抽出＝重み付き抽出と数学的に同一）。
  const rng = mulberry32(seed == null ? (Date.now() >>> 0) : seed);
  const n   = villainCombos.length;

  let winWeight = 0, tieWeight = 0, lossWeight = 0, totalWeight = 0;

  for (let t = 0; t < iterations; t++) {
    const combo = villainCombos[Math.floor(rng() * n)];

    const dead = new Set([...board, ...hero, ...combo.cards]);
    const deck = [];
    for (let i = 0; i < 13; i++) {
      for (let s = 0; s < 4; s++) {
        const c = RANKS[i] + SUITS[s];
        if (!dead.has(c)) deck.push(c);
      }
    }

    // 残りデッキから重複無しで2枚（turn+river）を抽出。
    const i1 = Math.floor(rng() * deck.length);
    let i2 = Math.floor(rng() * (deck.length - 1));
    if (i2 >= i1) i2++;

    const fullBoard    = [...board, deck[i1], deck[i2]];
    const heroScore    = evaluate7([...hero, ...fullBoard]).score;
    const villainScore = evaluate7([...combo.cards, ...fullBoard]).score;

    totalWeight++;
    if (heroScore > villainScore)      winWeight++;
    else if (heroScore < villainScore) lossWeight++;
    else                                tieWeight++;
  }

  const winProbability  = totalWeight > 0 ? winWeight  / totalWeight : 0;
  const tieProbability  = totalWeight > 0 ? tieWeight  / totalWeight : 0;
  const lossProbability = totalWeight > 0 ? lossWeight / totalWeight : 0;

  return {
    winCount: winWeight,
    tieCount: tieWeight,
    lossCount: lossWeight,
    totalWeight,
    winProbability,
    tieProbability,
    lossProbability,
    equity: winProbability + tieProbability * 0.5,
    precise: false // flop: Monte Carlo推計のため近似値
  };
}

function computeEquityTurn(hero, board, villainCombos) {
  // v3.9.51（⑥-D）: turn（残り1枚）は組み合わせ爆発しないため、river同様に
  // 完全列挙する（モンテカルロ不要）。riverと異なり、各Villainコンボごとに
  // 「Hero+turn board+そのVillainコンボ」を除いた残りカードからriverを
  // 選ぶ必要がある——computeHeroRank()のpopulation列挙とは違い、Villain
  // 自身の2枚も除外対象になる点が重要（ユーザー指摘どおり）。
  let winWeight = 0, tieWeight = 0, lossWeight = 0, totalWeight = 0;

  for (const combo of villainCombos) {
    const deadForRiver = new Set([...board, ...hero, ...combo.cards]);
    const riverDeck = [];
    for (let i = 0; i < 13; i++) {
      for (let s = 0; s < 4; s++) {
        const c = RANKS[i] + SUITS[s];
        if (!deadForRiver.has(c)) riverDeck.push(c);
      }
    }

    for (const riverCard of riverDeck) {
      const fullBoard    = [...board, riverCard];
      const heroScore    = evaluate7([...hero, ...fullBoard]).score;
      const villainScore = evaluate7([...combo.cards, ...fullBoard]).score;
      totalWeight += combo.weight;
      if (heroScore > villainScore)      winWeight += combo.weight;
      else if (heroScore < villainScore) lossWeight += combo.weight;
      else                                tieWeight += combo.weight;
    }
  }

  const winProbability  = totalWeight > 0 ? winWeight  / totalWeight : 0;
  const tieProbability  = totalWeight > 0 ? tieWeight  / totalWeight : 0;
  const lossProbability = totalWeight > 0 ? lossWeight / totalWeight : 0;

  return {
    winCount: winWeight,
    tieCount: tieWeight,
    lossCount: lossWeight,
    totalWeight,
    winProbability,
    tieProbability,
    lossProbability,
    equity: winProbability + tieProbability * 0.5,
    precise: true // turn: 完全列挙のため厳密値
  };
}

function computeEquityRiver(hero, board, villainCombos) {
  const heroScore = evaluate7([...hero, ...board]).score;

  let winWeight = 0, tieWeight = 0, lossWeight = 0, totalWeight = 0;
  for (const combo of villainCombos) {
    const villainScore = evaluate7([...combo.cards, ...board]).score;
    totalWeight += combo.weight;
    if (heroScore > villainScore)      winWeight += combo.weight;
    else if (heroScore < villainScore) lossWeight += combo.weight;
    else                                tieWeight += combo.weight;
  }

  const winProbability  = totalWeight > 0 ? winWeight  / totalWeight : 0;
  const tieProbability  = totalWeight > 0 ? tieWeight  / totalWeight : 0;
  const lossProbability = totalWeight > 0 ? lossWeight / totalWeight : 0;

  return {
    winCount: winWeight,
    tieCount: tieWeight,
    lossCount: lossWeight,
    totalWeight,
    winProbability,
    tieProbability,
    lossProbability,
    equity: winProbability + tieProbability * 0.5,
    precise: true // river: 完全列挙のため厳密値
  };
}
