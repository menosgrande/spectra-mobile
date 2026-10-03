/* core/nuts_display.js — computeNutDisplayData(): index.html の renderNuts() から
 * 分析ロジックのみを抽出した純粋関数（④、UI構造整理）。
 *
 * v3.9.57（④-3）: renderNuts()（index.html）の224行のうち、DOM操作・色・
 * ラベル文字列・折りたたみ状態を除いた「分析結果」の部分だけをここへ移した。
 * 既存の計算結果を一切変えないことを目的とした移植であり、新しい分類・
 * 新しいsort順・新しいcombo統合ルール・新しいflush判定は追加していない
 * （golden testで既存renderNuts()の出力と一致することを確認済み）。
 *
 * 依存関係について（重要）: このファイルは意図的に他のcore/*.jsに依存しない
 * 完全自己完結にしている。理由は配布経路が他のcore/*.jsと異なるため——
 * computeNutDisplayData()はrenderNuts()というメインスレッド（UIスレッド）の
 * 関数から同期的に呼ばれるが、他のcore/*.jsはWorkerスレッドにしか
 * importScriptsされない（Workerとメインスレッドはグローバルスコープを
 * 共有しないため、Worker側にしか無い関数はメインスレッドから呼べない）。
 * そのためtools/build-worker-bundle.jsは、このファイルをWorkerバンドルとは
 * 別に、index.html側のメインスレッド用<script>ブロックへも直接注入する
 * （AUTO-GENERATED-START/ENDマーカー参照）。もしcore/utils.jsのRANK_IDX等に
 * 依存すると、注入先でRANK_IDXの重複宣言や、utils.js全体を追加注入する
 * 必要が生じて話が複雑になるため、必要な最小限（ランク文字→序列の対応）を
 * このファイル内に閉じたユニークな名前で持つ。
 *
 * 境界の方針（ユーザー確認済み）:
 *   core側（この関数）  = 分析上必要な事実・分類・数値
 *     - live filter、combos計算、strength→band分類、band別集計
 *     - activeBandsの絞り込み（hiddenはboardHasPair由来の分析結果であり
 *       UIトグルの折りたたみ状態とは別物なのでcore側に残す）
 *     - pct算出
 *     - mergeSuitedOffsuit相当の集計（ただしlabel文字列・isMerged flagは
 *       除く——これらは表示専用で分析には使われないため。isMergedは
 *       renderNuts()内でも他から一切参照されていないことを確認済み）
 *     - flush帯のbeatsBoard/chopRisk判定（ランク比較という分析ロジック）
 *   UI側（index.html）に残すもの = 色・ラベル・表示状態・DOM・HTML
 *     - DOM操作、SSYM/SCOL、drawColor()、DRAW_TYPE_EXPLAIN
 *     - collapsedNutBands、toggleNutBand
 *     - CHIP_LIMITによるshown/overflow分割（実装時に原コードと照合済み：
 *       CHIP_LIMITはband集計後のcombos/pctには一切影響せず、表示する
 *       チップ件数を絞るだけの純粋な表示制限。flush帯のbeatsBoard/chopRisk
 *       も、renderGroup()呼び出し時にCHIP_LIMITで別途切っているだけで、
 *       分析結果自体（配列の中身）はCHIP_LIMIT適用前の全件のまま）
 *       → よってcoreはbeatsBoard/chopRiskを全件返し、UI側で表示件数を絞る
 *     - HTML文字列生成
 *
 * HAND_BANDSの名称・閾値(min)は既存renderNuts()と同一（SPECTRA独自の
 * strengthスコア閾値による分類。evaluate7()の実際の役判定とは別物という
 * 位置づけも既存のまま——詳細はindex.html側のHAND_BANDS定義コメント参照）。
 */

// core/utils.jsのRANKS/RANK_IDXとは意図的に別名にしている（上記の理由により
// このファイルは他のcore/*.jsと同一スコープで読まれない前提のため衝突は
// 起きないが、万一将来どこかで一緒にevalされても安全なようにユニーク名にする）。
const _NUTS_RANKS_ORDER = 'AKQJT98765432';
function _nutsRankIdx(rankChar) {
  const i = _NUTS_RANKS_ORDER.indexOf(rankChar);
  return i === -1 ? 12 : i;
}

const NUT_DISPLAY_BANDS = [
  { name: 'ROYAL FLUSH',     min: 0.955 },
  { name: 'STRAIGHT FLUSH',  min: 0.896 },
  { name: 'FOUR OF A KIND',  min: 0.796 },
  { name: 'FULL HOUSE',      min: 0.676 },
  { name: 'FLUSH',           min: 0.576 },
  { name: 'STRAIGHT',        min: 0.466 },
  { name: 'THREE OF A KIND', min: 0.376 },
  { name: 'TWO PAIR',        min: 0.256 },
  { name: 'ONE PAIR',        min: 0.096 },
  { name: 'HIGH CARD',       min: 0.000 }
];

// renderNuts()のmergeSuitedOffsuit()と同じ集計だが、label文字列・isMerged
// flagは含まない（表示専用で分析結果としては使われないため）。isSuitedは
// 「このグループがsuitedコンボのみで構成されているか」という分析上の
// 意味を持つ（flush帯のbeatsBoard/chopRisk判定で使われる）ため保持する。
function mergeSuitedOffsuitCombos(items) {
  const map = new Map();
  for (const it of items) {
    const key = it.hand.slice(0, 2);
    if (!map.has(key)) {
      map.set(key, {
        key, combos: 0, isPair: it.isPair,
        suitedCombos: 0, offsuitCombos: 0,
        drawType: null, outs: 0, bestScore: 0,
        bestRankIdx: Math.min(_nutsRankIdx(key[0]), _nutsRankIdx(key[1]))
      });
    }
    const g = map.get(key);
    g.combos += it.combos;
    if ((it.score ?? 0) > g.bestScore) g.bestScore = it.score ?? 0;
    if (!it.isPair) {
      if (it.isSuited) {
        g.suitedCombos += it.combos;
        if (!g.drawType) { g.drawType = it.drawType; g.outs = it.outs; }
      } else {
        g.offsuitCombos += it.combos;
      }
    }
  }
  return [...map.values()].map(g => {
    let isSuited;
    if (g.isPair) {
      isSuited = false;
    } else if (g.suitedCombos > 0 && g.offsuitCombos > 0) {
      isSuited = false; g.drawType = null; // 両方存在→ドロータグは片方に偏るため曖昧、出さない
    } else if (g.suitedCombos > 0) {
      isSuited = true;
    } else {
      isSuited = false;
    }
    return { ...g, hand: g.key, isSuited };
  });
}

function computeNutDisplayData(data, features, currentBoard) {
  const suitCnt = {};
  currentBoard.forEach(c => suitCnt[c[1]] = (suitCnt[c[1]] || 0) + 1);
  const suitsSorted  = Object.entries(suitCnt).sort((a, b) => b[1] - a[1]);
  const dominantSuit = suitsSorted[0]?.[0] || 'h';

  const pairStruct = features?.pairStructure || '';
  const boardHasPair = ['PAIRED', 'DOUBLE_PAIRED', 'TRIPS_BOARD', 'FULL_HOUSE_BOARD', 'QUADS_BOARD'].includes(pairStruct);
  const boardFlushComplete = features?.flushPressure === 'FOUR_FLUSH' || features?.flushPressure === 'FIVE_FLUSH';

  const bandDefs = NUT_DISPLAY_BANDS.map(b => ({
    name: b.name,
    min: b.min,
    confirmed: b.name === 'FLUSH' ? boardFlushComplete : (b.name === 'ONE PAIR' ? boardHasPair : false),
    hidden: b.name === 'HIGH CARD' ? boardHasPair : false
  }));

  const live = data.filter(h => (h.density ?? 1) > 0);
  let totalCombos = 0;
  const bands = bandDefs.map(b => ({ ...b, combos: 0, items: [] }));

  live.forEach(h => {
    const isPair    = h.hand.length === 2 && h.hand[0] === h.hand[1];
    const isSuited  = h.hand.endsWith('s');
    const baseTotal = isPair ? 6 : isSuited ? 4 : 12;
    const combos = h.topClassCombos ?? Math.round((h.density ?? 1) * baseTotal);
    totalCombos += combos;
    const score = h.madeStrength ?? h.rawScore ?? 0;
    const bi = bands.findIndex(b => score >= b.min);
    if (bi >= 0 && combos > 0) {
      bands[bi].combos += combos;
      bands[bi].items.push({ hand: h.hand, combos, isSuited, isPair, drawType: h.drawType, outs: h.outs, score });
    }
  });

  const activeBands = bands.filter(b => !b.hidden && b.combos > 0);

  const resultBands = activeBands.map(b => {
    const pct = totalCombos > 0 ? (b.combos / totalCombos * 100) : 0;
    const isFlushBand = b.name === 'FLUSH' || b.name === 'STRAIGHT FLUSH' || b.name === 'ROYAL FLUSH';
    const mergedItems = mergeSuitedOffsuitCombos(b.items);
    const sortedItems = [...mergedItems].sort((x, y) => y.bestScore - x.bestScore);

    let flushSplit = null;
    if (isFlushBand && b.name === 'FLUSH') {
      const boardFlushRanks = currentBoard
        .filter(c => c[1] === dominantSuit)
        .map(c => _nutsRankIdx(c[0]));
      const boardTopFlushRank = boardFlushRanks.length ? Math.min(...boardFlushRanks) : null;

      if (boardTopFlushRank !== null) {
        const suitedOnly = sortedItems.filter(i => i.isSuited);
        const beatsBoard  = suitedOnly.filter(i => i.bestRankIdx < boardTopFlushRank);
        const chopRisk    = suitedOnly.filter(i => i.bestRankIdx >= boardTopFlushRank);
        flushSplit = { boardTopFlushRank, boardTopIsAce: boardTopFlushRank === 0, beatsBoard, chopRisk };
      }
    }

    return {
      name: b.name,
      confirmed: b.confirmed,
      combos: b.combos,
      pct,
      isFlushBand,
      items: sortedItems,
      flushSplit
    };
  });

  return { dominantSuit, totalCombos, bands: resultBands };
}
