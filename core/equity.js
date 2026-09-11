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
 * 街ごとの計算方式（⑥-D以降で段階的に実装）:
 *   river（board.length===5）: 完全列挙、厳密値。v3.9.50で実装。
 *   turn（board.length===4） : 残り1枚を完全列挙。未実装（⑥-D）。
 *   flop（board.length===3） : モンテカルロ（デフォルトiterations=50000）。未実装（⑥-F）。
 *   preflop（board.length<3）: evaluate7が5枚未満で機能しないため非対応
 *   （HERO_RANKと同じ制約）。
 */

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
    throw new Error('computeEquity: turn (board.length === 4) is not yet implemented (planned: ⑥-D)');
  }
  if (board.length === 3) {
    throw new Error('computeEquity: flop (board.length === 3) is not yet implemented (planned: ⑥-F, Monte Carlo)');
  }
  throw new Error(`computeEquity: unsupported board.length ${board.length}`);
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
    equity: winProbability + tieProbability * 0.5
  };
}
