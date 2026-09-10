#!/usr/bin/env node
/**
 * SPECTRA — pair/suited flush-draw 意味論 受入テスト（v3.9.47 検収用 / oracle v2）
 *
 * 使い方:  node spectra-bdfd-acceptance.js [coreディレクトリ]
 * 例:      node spectra-bdfd-acceptance.js ./core
 *
 * オラクルは実カード列挙に基づく独立実装（外部依存なし）。
 * classifyDraw / classifyPotential の閾値実装には一切依存しない。
 *
 * オラクル規約（v2）— 「ホールカードがフラッシュに参加できること」を必須とする:
 *   各スートについて、生きたコンボが握れるそのスートのホールカード枚数 holeC を求め、
 *   holeC === 0 のスートは（ボードだけで到達できるフラッシュは全ハンド共通のため）
 *   そのハンドクラスのドローとは見なさない。
 *   total = ボードの同スート枚数 + holeC として:
 *     total >= 5 → フラッシュ完成済み（ドロータグなし → null）
 *     total == 4 → FD（あと1枚。フロップ/ターン両方で成立）
 *     total == 3 → BD-FD（あと2枚 → フロップ限定。ターンでは到達不能 → null）
 *   オフスートはモデル規約により常に対象外（null）。
 *
 * 判別力確認（リバートテスト）:
 *   core/range_matrix.js のペア閾値を maxSuit===2（FD）/ ===1（BD-FD）に戠すと、
 *   このスクリプトは複数行 FAIL で終了する（exit 1）。通過が固定値でない証拠になる。
 */
const fs = require('fs');
const path = require('path');

const CORE_DIR = process.argv[2] || path.join(__dirname, 'core');
const FILES = ['utils.js','texture.js','position.js','strength.js','range_matrix.js','board_intel.js','interpretations.js','narrative.js','board_intelligence.js'];
let code = '';
for (const f of FILES) code += fs.readFileSync(path.join(CORE_DIR, f), 'utf8') + '\n';
eval(code);

// ── オラクル v2: スート別ホール参加寄与の列挙 ──
const SUITS = ['s', 'h', 'd', 'c'];
function classifyDrawOracle(hand, board) {
  if (hand.length === 3 && hand[2] === 'o') return null; // モデル規約: オフスート対象外
  const isPair   = hand.length === 2;
  const isSuited = hand[2] === 's';
  let made = false, fd = false, bd = false;
  for (const s of SUITS) {
    let holeC;
    if (isPair) {
      holeC = board.includes(hand[0] + s) ? 0 : 1;          // r+s を握れる生きたコンボが存在
    } else if (isSuited) {
      holeC = (board.includes(hand[0] + s) || board.includes(hand[1] + s)) ? 0 : 2; // r1+s / r2+s の両方が生きている時だけ2枚
    } else {
      holeC = 0;
    }
    if (holeC === 0) continue; // ホール参加不可のスートはクラスのドローと見なさない
    const boardC = board.filter(c => c[1] === s).length;
    const total = boardC + holeC;
    if (total >= 5) made = true;
    else if (total === 4) fd = true;
    else if (total === 3 && board.length === 3) bd = true;
  }
  if (made) return null;
  if (fd) return 'FD';
  if (bd) return 'BD-FD';
  return null;
}

// 裏取り: ホール参加ありでフラッシュに実際に到達できるか（全ランアウト列挙）
function flushReachableWithHole(hand, board) {
  const suits = ['s', 'h', 'd', 'c'];
  const isPair = hand.length === 2, isSuited = hand[2] === 's';
  const combos = [];
  if (isPair) {
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) combos.push([hand[0] + SUITS[i], hand[0] + SUITS[j]]);
  } else if (isSuited) {
    for (let i = 0; i < 4; i++) combos.push([hand[0] + SUITS[i], hand[1] + SUITS[i]]);
  } else {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (i !== j) combos.push([hand[0] + SUITS[i], hand[1] + SUITS[j]]);
  }
  for (const combo of combos) {
    if (combo.some(card => board.includes(card))) continue;
    const dead = new Set([...board, ...combo]);
    const deck = [];
    for (const r of 'AKQJT98765432') for (const s of SUITS) { const c = r + s; if (!dead.has(c)) deck.push(c); }
    const check = (cards7) => {
      const cnt = {};
      cards7.forEach(x => cnt[x[1]] = (cnt[x[1]] || 0) + 1);
      return Object.keys(cnt).some(s => cnt[s] >= 5 && combo.some(hc => hc[1] === s));
    };
    if (board.length === 3) {
      for (let i = 0; i < deck.length; i++) for (let j = i + 1; j < deck.length; j++)
        if (check([...board, ...combo, deck[i], deck[j]])) return true;
    } else {
      for (const d of deck) if (check([...board, ...combo, d])) return true;
    }
  }
  return false;
}

// ── マトリクス: pair/suited × 3flush/2tone/rainbow × flop/turn ＋ R1(カード除去)検証ケース ──
const B = {
  '3flush-flop':  ['6s', '7s', 'Ks'],
  '2tone-flop':   ['7s', '2d', '9s'],
  'rainbow-flop': ['Kh', '8d', '4c'],
  '3flush-turn':  ['6s', '7s', 'Ks', '2c'],
  '2tone-turn':   ['7s', '2d', '9s', '5h'],
  'rainbow-turn': ['Kh', '8d', '4c', '9s']
};
// R1検証: ボードの同スート2枚(または3枚)がハンドのランクカードを含むケース。
// 閾値だけで判定していると、死んでいるコンボまで数えてファントムFD/BD-FDが出る。
const B_R1 = {
  '2tone-dead(Ks)': ['7s', '2d', 'Ks'],   // AKs: 該当スートコンボ(AsKs)がKsボードで死亡
  '3flush-dead(3s)': ['3s', '7s', 'Ks']   // 33: スペードを握るコンボ(3s3x)が3sボードで全滅
};

const CASES = [];
for (const h of ['33', 'AKs']) for (const k of Object.keys(B)) CASES.push([h, k, B[k], false]);
CASES.push(['AKo', 'rainbow-flop', B['rainbow-flop'], false]); // モデル規約: null
CASES.push(['AKo', '2tone-turn',   B['2tone-turn'],   false]); // モデル規約: null
CASES.push(['AKs', '2tone-dead(Ks)',  B_R1['2tone-dead(Ks)'],  true]);  // R1
CASES.push(['33',  '3flush-dead(3s)', B_R1['3flush-dead(3s)'], true]);  // R1

let pass = 0, fail = 0;
console.log('hand  | board            | classifyDraw | oracle | 到達(ホール参加) | 判定');
console.log('------+------------------+--------------+--------+----------------+-----');
for (const [hand, key, board, isR1] of CASES) {
  const got = classifyDraw(hand, board);
  const exp = classifyDrawOracle(hand, board);
  const reach = flushReachableWithHole(hand, board) ? 'Y' : 'N';
  let ok = got === exp;
  // 不変条件: FD/BD-FDを返すならホール参加でフラッシュ到達が数学的に可能なはず
  if ((got === 'FD' || got === 'BD-FD') && reach === 'N') ok = false;
  if (ok) pass++; else fail++;
  console.log(`${hand.padEnd(5)} | ${(key + (isR1 ? ' [R1]' : '')).padEnd(16)} | ${String(got).padEnd(12)} | ${String(exp).padEnd(6)} | ${reach}              | ${ok ? 'OK' : 'FAIL'}`);
}

// リバーは常にnull（既存仕様の回帰）
const riv = classifyDraw('33', ['6s', '7s', 'Ks', '2c', '9h']);
if (riv === null) pass++; else { fail++; console.log(`FAIL: river で ${riv} が返った（riverは常にnullであるべき）`); }

// ── classifyDraw と classifyPotential の整合（情報表示）──
console.log('\n-- classifyPotential（整合確認・情報） --');
for (const [hand, key, board, isR1] of CASES) {
  if (hand === 'AKo') continue;
  const p = classifyPotential(hand, board);
  const exp = classifyDrawOracle(hand, board);
  const tag = (exp === 'FD') ? '本物のFD' : (exp === 'BD-FD') ? 'バックドア' : 'ドローなし';
  console.log(`${hand} ${key.padEnd(18)} potential=${p.toFixed(4)}  (${tag})`);
}

// ── hasComboDraw のペア閾値整合（drawOverlap計算系に旧閾値が残っていないか）──
// 66 on 5s-7s-8s: 実在のOESD（5-6-7-8窓にホール参加）かつペアの本物FD（3flushボード）。
const hcd = hasComboDraw('66', ['5s', '7s', '8s']);
console.log(`\nhasComboDraw('66',[5s,7s,8s]) = ${hcd}  ← trueが望ましい（falseならdrawOverlap計算だけ旧閾値が残存）`);

// ── 既存回帰（リポジトリ内テスト由来）──
const r1 = classifyDraw('33', ['Js', 'Th', '9d', '8c']); // v3.9.47ではnullが期待値
const r2 = classifyDraw('AKs', ['9d', 'Ts', 'Jc']);      // GSD（ストレート優先・既存テスト）
if (r1 === null) pass++; else { fail++; console.log(`FAIL: 回帰 r1 = ${r1}（期待 null）`); }
if (r2 === 'GSD') pass++; else { fail++; console.log(`FAIL: 回帰 r2 = ${r2}（期待 GSD）`); }

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
