/**
 * SPECTRA core engine vs pokersolver 突き合わせ
 *
 * 目的: 自作の役判定(detectHandCategory)・スコアリング(scoreHandCategory)が
 *       独立実装である pokersolver と一致するかを大量ランダム試行＋
 *       エッジケースで検証する。
 *
 * 検証する2つの軸:
 *   1. カテゴリ一致率   — 同じ7枚に対して役の種類(category)が一致するか
 *   2. 勝敗順序一致率   — 同じボード上で2つの異なるホールカードを比較したとき、
 *                        pokersolverのHand.winners()と自作スコアの大小比較が
 *                        一致するか（キッカー比較バグの直接的な検証になる）
 */

const fs = require('fs');
const path = require('path');
const { Hand } = require('pokersolver');

// ── SPECTRA core を読み込み（Workerと同じ結合方式） ──
const CORE_DIR = path.join(__dirname, '..', 'testrun', 'core');
const FILES = [
  'utils.js', 'texture.js', 'position.js', 'strength.js',
  'range_matrix.js', 'board_intel.js', 'interpretations.js',
  'narrative.js', 'board_intelligence.js'
];
let code = '';
for (const f of FILES) code += fs.readFileSync(path.join(CORE_DIR, f), 'utf8') + '\n';
eval(code);

// ── pokersolver name/descr → 自作 category へのマッピング ──
function toOurCategory(psHand) {
  switch (psHand.name) {
    case 'Straight Flush':
      return /royal/i.test(psHand.descr) ? 'ROYAL_FLUSH' : 'STRAIGHT_FLUSH';
    case 'Four of a Kind':  return 'FOUR_OF_A_KIND';
    case 'Full House':      return 'FULL_HOUSE';
    case 'Flush':           return 'FLUSH';
    case 'Straight':        return 'STRAIGHT';
    case 'Three of a Kind': return 'THREE_OF_A_KIND';
    case 'Two Pair':        return 'TWO_PAIR';
    case 'Pair':            return 'ONE_PAIR';
    case 'High Card':       return 'HIGH_CARD';
    default: return 'UNKNOWN:' + psHand.name;
  }
}

// ── カード表記の変換 ──
// 自作: rank+suit (例 "Ah"), pokersolver: 同じ表記だが 10 は "T" (共通なので変換不要)
// RANKS = 'AKQJT98765432', SUITS='shdc' -- pokersolverも同じ文字セットを受け付ける

function randomDeck() {
  const RANKS = 'AKQJT98765432'.split('');
  const SUITS = 'shdc'.split('');
  const deck = [];
  for (const r of RANKS) for (const s of SUITS) deck.push(r + s);
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

let categoryTrials = 0, categoryMismatches = [];
let orderTrials = 0, orderMismatches = [];

// ══════════════════════════════
// 検証1: ランダム7枚 × N回 のカテゴリ一致率
// ══════════════════════════════
const N_RANDOM = 20000;
for (let t = 0; t < N_RANDOM; t++) {
  const deck = randomDeck();
  const cards7 = deck.slice(0, 7);

  const ours = evaluate7(cards7);
  const ps = Hand.solve(cards7);
  const psCategory = toOurCategory(ps);

  categoryTrials++;
  if (ours.category !== psCategory) {
    categoryMismatches.push({ cards: cards7.slice(), ourCategory: ours.category, psCategory, psDescr: ps.descr });
  }
}

// ══════════════════════════════
// 検証2: 同一ボード上でのホールカード比較（勝敗順序）× N回
// ランダムな5枚ボード + 2組のランダムなホールカード(各2枚)を用意し、
// pokersolverのHand.winners()（引き分け対応）と自作score比較が一致するか検証。
// これはこのセッションで修正したキッカー比較バグの直接的な回帰検証になる。
// ══════════════════════════════
const N_ORDER = 20000;
for (let t = 0; t < N_ORDER; t++) {
  const deck = randomDeck();
  const board = deck.slice(0, 5);
  const holeA = deck.slice(5, 7);
  const holeB = deck.slice(7, 9);

  const cardsA = [...holeA, ...board];
  const cardsB = [...holeB, ...board];

  const oursA = evaluate7(cardsA);
  const oursB = evaluate7(cardsB);

  const psA = Hand.solve(cardsA);
  const psB = Hand.solve(cardsB);
  const winners = Hand.winners([psA, psB]);
  const psResult = winners.length === 2 ? 'TIE' : (winners[0] === psA ? 'A' : 'B');

  let ourResult;
  if (oursA.score > oursB.score) ourResult = 'A';
  else if (oursB.score > oursA.score) ourResult = 'B';
  else ourResult = 'TIE';

  orderTrials++;
  if (ourResult !== psResult) {
    orderMismatches.push({
      board: board.slice(), holeA: holeA.slice(), holeB: holeB.slice(),
      ourResult, psResult,
      oursA: { score: oursA.score, category: oursA.category },
      oursB: { score: oursB.score, category: oursB.category },
      psA: { name: psA.name, descr: psA.descr },
      psB: { name: psB.name, descr: psB.descr }
    });
  }
}

// ══════════════════════════════
// 検証3: 今回のセッションで発見・修正した既知のエッジケース群
// （このセッションのバグ修正が「たまたまpokersolverと一致していただけ」でなく
//   本質的に正しいことを確認する固定ケース）
// ══════════════════════════════
const edgeCases = [
  { name: 'ロイヤルフラッシュ(余分な低カード混在)', cards: ['Ah','Kh','Qh','Jh','Th','9c','8c'] },
  { name: 'ホイールストレート(A2345 offsuit)', cards: ['Ah','2d','3c','4s','5h','9c','Kd'] },
  { name: 'ホイールストレートフラッシュ(A2345同スート)', cards: ['Ah','2h','3h','4h','5h','9c','Kd'] },
  { name: '6枚連続同スート(A23456同スート)', cards: ['Ah','2h','3h','4h','5h','6h','Kc'] },
  { name: '7枚連続同スート(A234567同スート)', cards: ['Ah','2h','3h','4h','5h','6h','7h'] },
  { name: 'トリップスがストレートより弱い(JQA+AA vs KT)', cards: ['Ah','Ad','Jc','Qd','As'] },
];
console.log('=== 固定エッジケース: カテゴリ一致確認 ===');
let edgeFail = 0;
for (const ec of edgeCases) {
  const ours = evaluate7(ec.cards);
  const ps = Hand.solve(ec.cards);
  const psCategory = toOurCategory(ps);
  const ok = ours.category === psCategory;
  if (!ok) edgeFail++;
  console.log(`[${ok ? 'OK' : 'FAIL'}] ${ec.name}: ours=${ours.category} pokersolver=${psCategory}(${ps.descr})`);
}

// ══════════════════════════════
// 結果出力
// ══════════════════════════════
console.log('\n=== 検証1: ランダム7枚 カテゴリ一致率 ===');
console.log(`試行回数: ${categoryTrials}`);
console.log(`不一致件数: ${categoryMismatches.length}`);
console.log(`一致率: ${(100 * (categoryTrials - categoryMismatches.length) / categoryTrials).toFixed(4)}%`);
if (categoryMismatches.length > 0) {
  console.log('--- 不一致サンプル(最大10件) ---');
  categoryMismatches.slice(0, 10).forEach(m => {
    console.log(`  cards=${m.cards.join(',')} ours=${m.ourCategory} pokersolver=${m.psCategory}(${m.psDescr})`);
  });
}

console.log('\n=== 検証2: ホールカード対決 勝敗順序一致率 ===');
console.log(`試行回数: ${orderTrials}`);
console.log(`不一致件数: ${orderMismatches.length}`);
console.log(`一致率: ${(100 * (orderTrials - orderMismatches.length) / orderTrials).toFixed(4)}%`);
if (orderMismatches.length > 0) {
  console.log('--- 不一致サンプル(最大15件) ---');
  orderMismatches.slice(0, 15).forEach(m => {
    console.log(`  board=${m.board.join(',')} holeA=${m.holeA.join(',')} holeB=${m.holeB.join(',')}`);
    console.log(`    ours: A=${m.oursA.category}(${m.oursA.score.toFixed(4)}) B=${m.oursB.category}(${m.oursB.score.toFixed(4)}) → ${m.ourResult}`);
    console.log(`    pokersolver: A=${m.psA.name}(${m.psA.descr}) B=${m.psB.name}(${m.psB.descr}) → ${m.psResult}`);
  });
}

console.log('\n=== 固定エッジケース ===');
console.log(`${edgeCases.length - edgeFail}/${edgeCases.length} 一致`);

// 保存: 全不一致を後で分析できるようJSONにも書き出す
fs.writeFileSync(path.join(__dirname, 'mismatches.json'), JSON.stringify({
  categoryMismatches, orderMismatches
}, null, 2));

const totalFail = categoryMismatches.length + orderMismatches.length + edgeFail;
console.log(`\n${totalFail === 0 ? '✅ 全検証で完全一致' : '⚠ 不一致あり、mismatches.json を確認してください'}`);
process.exit(totalFail > 0 ? 1 : 0);
