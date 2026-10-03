/* core/utils.js — constants, cache, clamp01. No deps. */

/**
 * SPECTRA v3.5 Worker
 * Protocol: INIT_OK handshake
 * Public API : BOARD_INTELLIGENCE (unified entry point)
 * Secondary  : HERO_RANK (v3.9.39〜, Hero Hand専用の独立API)
 * Legacy API : EVAL_169 / TEXTURE  (backward compat, internally delegated)
 *
 * Evaluation stack:
 *   evaluate7()          → { score, category, categoryName }（v3.7〜: 役判定と
 *                           連続値スコアリングを分離。category は判定結果そのもの
 *                           なのでスコアの揺れで役名がズレることはない）
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

// バグ修正候補（レビュー指摘）: evalCacheが無制限に増え続ける可能性があったため、
// 上限を設けてFIFO（Mapは挿入順を保持する）で古いエントリから削除するようにする。
const EVAL_CACHE_MAX = 500;
function cacheSet(key, value) {
  if (evalCache.size >= EVAL_CACHE_MAX && !evalCache.has(key)) {
    const oldestKey = evalCache.keys().next().value;
    evalCache.delete(oldestKey);
  }
  evalCache.set(key, value);
}

// v3.9.39: HERO_RANK専用キャッシュ。evalCache（BOARD_INTELLIGENCE用）とは責務が
// 異なるため意図的に分離している（BOARD_INTELLIGENCEのanalyzeBoard()やそのキャッシュ
// には一切触れない、独立したHero Hand専用API）。FIFO方式・キー設計の考え方は
// evalCache/cacheSetと同一にして一貫性を保つ。
// キーはboard+hero（ソート済み）のみで一意に決まる：computeHeroRank(board, hero)は
// context/streetを引数に取らず、streetはboardの枚数（3/4/5）から一意に定まるため、
// BOARD_INTELLIGENCEのキャッシュキーのようにcontext.heroPos等を追加で含める必要はない。
let heroRankCache = new Map();
const HERO_RANK_CACHE_MAX = 300;
function heroRankCacheSet(key, value) {
  if (heroRankCache.size >= HERO_RANK_CACHE_MAX && !heroRankCache.has(key)) {
    const oldestKey = heroRankCache.keys().next().value;
    heroRankCache.delete(oldestKey);
  }
  heroRankCache.set(key, value);
}

// v3.9.55（⑥-G）: EQUITY専用キャッシュ。heroRankCacheと同じFIFO方式・同じ
// 責務分離の考え方（BOARD_INTELLIGENCEのパイプラインには一切触れない独立API）。
// ただしキー設計はHERO_RANKより複雑：computeEquity()はvillainRangeとiterations
// にも依存するため、これらをキーに含める必要がある。
//   - villainRangeは順序に依存しないよう各コンボをソートしてから正規化する
//     （同じレンジを違う順序で渡しても同一キーになるべき）。
//   - iterationsはflopのMonte Carlo精度を変えるため、同じboard/heroでも
//     iterationsが違えば別エントリにする（1万試行の結果と5万試行の結果を
//     同じキーで返してしまうと、preciseの意味が曖昧になる）。
// 1件あたりの計算コストがHERO_RANKより高い（flopは5万試行）ため、上限は
// 控えめの200件に設定する。
let equityCache = new Map();
const EQUITY_CACHE_MAX = 200;
function equityCacheSet(key, value) {
  if (equityCache.size >= EQUITY_CACHE_MAX && !equityCache.has(key)) {
    const oldestKey = equityCache.keys().next().value;
    equityCache.delete(oldestKey);
  }
  equityCache.set(key, value);
}

function equityCacheKey(board, hero, villainRange, iterations) {
  const b = [...board].sort().join(',');
  const h = [...hero].sort().join(',');
  const r = villainRange
    ? villainRange
        .map(c => [...c.cards].sort().join('') + ':' + c.weight)
        .sort()
        .join(',')
    : 'default';
  const i = iterations == null ? 'auto' : String(iterations);
  return `eq:${b}|${h}|${r}|${i}`;
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}
