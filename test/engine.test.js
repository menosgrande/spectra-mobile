/**
 * SPECTRA — Core Engine Regression Suite
 *
 * core/*.js は Web Worker の importScripts 前提で書かれており、
 * import/exportを持たない（グローバル関数宣言のみ）。そのため実際の
 * Worker読み込み順そのままファイルを結合してevalする、という方式で
 * テストする（Workerでの実際の挙動を最も忠実に再現できるため）。
 *
 * 実行方法:
 *   node tests/engine.test.js
 *
 * フレームワーク不使用（node標準の assert のみ）。
 * 失敗があれば非ゼロで終了するので、将来CIに繋ぐこともできる。
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const CORE_DIR = path.join(__dirname, '..', 'core');
const FILES = [
  'utils.js', 'texture.js', 'position.js', 'strength.js',
  'range_matrix.js', 'board_intel.js', 'interpretations.js',
  'narrative.js', 'board_intelligence.js'
];

let code = '';
for (const f of FILES) {
  code += fs.readFileSync(path.join(CORE_DIR, f), 'utf8') + '\n';
}
// eval()内で定義された関数をこのスコープに晒すため、そのままevalする
eval(code);

let pass = 0, fail = 0;
function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ok  - ${name}`);
  } catch (err) {
    fail++;
    console.log(`FAIL  - ${name}`);
    console.log(`        ${err.message}`);
  }
}

console.log('=== detectHandCategory / evaluate7: 役判定 ===');

test('ロイヤルフラッシュ (Ah Kh Qh Jh Th + 9c8c、余分な低カード混在)', () => {
  const r = evaluate7(['Ah', 'Kh', 'Qh', 'Jh', 'Th', '9c', '8c']);
  assert.strictEqual(r.category, 'ROYAL_FLUSH');
  assert.strictEqual(r.score, 1.0);
});

test('通常のストレートフラッシュ (9h-Kh, キングハイ)', () => {
  const r = evaluate7(['9h', 'Th', 'Jh', 'Qh', 'Kh', '2c', '3c']);
  assert.strictEqual(r.category, 'STRAIGHT_FLUSH');
});

test('ホイールSF (A2345同スート) はストレートフラッシュ扱い', () => {
  const r = evaluate7(['Ah', '2h', '3h', '4h', '5h', '9c', 'Kd']);
  assert.strictEqual(r.category, 'STRAIGHT_FLUSH');
});

test('ホイール(A2345非同スート)はストレート扱い、トリップス帯に落ちない', () => {
  const r = evaluate7(['Ah', '2d', '3c', '4s', '5h', '9c', 'Kd']);
  assert.strictEqual(r.category, 'STRAIGHT');
  assert.ok(r.score >= 0.47, `wheel score ${r.score} should stay >= 0.47 (STRAIGHT floor)`);
});

test('6枚連続同スート(A23456)は6-highSFを正しく選ぶ（ホイールで妥協しない）', () => {
  const wheel = evaluate7(['Ah', '2h', '3h', '4h', '5h', '9c', 'Kd']).score;
  const sixHigh = evaluate7(['Ah', '2h', '3h', '4h', '5h', '6h', 'Kc']).score;
  assert.ok(sixHigh > wheel, `6-high SF (${sixHigh}) should score higher than wheel SF (${wheel})`);
});

test('7枚連続同スート(A234567)は最高位(3-7)のSFを選ぶ', () => {
  const sixHigh = evaluate7(['Ah', '2h', '3h', '4h', '5h', '6h', 'Kc']).score;
  const sevenCard = evaluate7(['Ah', '2h', '3h', '4h', '5h', '6h', '7h']).score;
  assert.ok(sevenCard > sixHigh, `7-card run (${sevenCard}) should beat 6-card run (${sixHigh})`);
});

test('フルハウス: AhKh混在でも誤ってSF扱いされない', () => {
  const r = evaluate7(['7h', '7d', '7c', '2h', '2d', 'Ah', 'Kh']);
  assert.strictEqual(r.category, 'FULL_HOUSE');
});

test('トリップス: J-Q-Aボード+AAは正しくTHREE_OF_A_KIND（ストレートと誤認しない）', () => {
  const r = evaluate7(['Ah', 'Ad', 'Jc', 'Qd', 'As']);
  assert.strictEqual(r.category, 'THREE_OF_A_KIND');
});

test('同ボードでKTsは正しくSTRAIGHT（トリップスAAより強い）', () => {
  const board = ['Jc', 'Qd', 'As'];
  const kts = evaluate7(['Kh', 'Th', ...board]);
  const aa  = evaluate7(['Ah', 'Ad', ...board]);
  assert.strictEqual(kts.category, 'STRAIGHT');
  assert.strictEqual(aa.category, 'THREE_OF_A_KIND');
  assert.ok(kts.score > aa.score);
});

console.log('\n=== 外部レビュー対応: 同一カテゴリ内のキッカー比較 ===');

test('ワンペアのキッカー差: KQ > JT > 54（77A92ボード）', () => {
  const board = ['7h', '7d', 'Ac', '9s', '2c'];
  const kq = evaluate7(['Kh', 'Qd', ...board]);
  const jt = evaluate7(['Jh', 'Td', ...board]);
  const c54 = evaluate7(['5h', '4d', ...board]);
  assert.strictEqual(kq.category, 'ONE_PAIR');
  assert.ok(kq.score > jt.score, `KQ(${kq.score}) should beat JT(${jt.score})`);
  assert.ok(jt.score > c54.score, `JT(${jt.score}) should beat 54(${c54.score})`);
});

test('トリップスのキッカー差: KQ > JT > 23（777A9ボード）', () => {
  const board = ['7h', '7d', '7s', 'Ac', '9c'];
  const kq = evaluate7(['Kh', 'Qd', ...board]);
  const jt = evaluate7(['Jh', 'Td', ...board]);
  const c23 = evaluate7(['2h', '3d', ...board]);
  assert.strictEqual(kq.category, 'THREE_OF_A_KIND');
  assert.ok(kq.score > jt.score);
  assert.ok(jt.score > c23.score);
});

test('フラッシュの質の差: Qハイ > Jハイ > 9ハイ（4-flushボード AhKh7h2h）', () => {
  const board = ['Ah', 'Kh', '7h', '2h'];
  const qh = evaluate7(['Qh', '3d', ...board]);
  const jh = evaluate7(['Jh', '3d', ...board]);
  const nh = evaluate7(['9h', '3d', ...board]);
  assert.strictEqual(qh.category, 'FLUSH');
  assert.ok(qh.score > jh.score);
  assert.ok(jh.score > nh.score);
});

test('フルハウスの下位ペア差: 777/KK > 777/QQ > 777/44 > 777/33', () => {
  const board = ['7h', '7d', '7s', 'Ac', '2c'];
  const kk = evaluate7(['Kh', 'Kd', ...board]);
  const qq = evaluate7(['Qh', 'Qd', ...board]);
  const c44 = evaluate7(['4h', '4d', ...board]);
  const c33 = evaluate7(['3h', '3d', ...board]);
  [kk, qq, c44, c33].forEach(r => assert.strictEqual(r.category, 'FULL_HOUSE'));
  assert.ok(kk.score > qq.score);
  assert.ok(qq.score > c44.score);
  assert.ok(c44.score > c33.score);
});

test('クアッズのキッカー差: AK > J9 > 32（かつ盤面キッカーとの偶然一致で逆転しない）', () => {
  const board = ['7h', '7d', '7s', '7c', '2c']; // quads board, board kicker = 2
  const ak = evaluate7(['Ah', 'Kd', ...board]);
  const j9 = evaluate7(['Jh', '9d', ...board]);
  const c32 = evaluate7(['3h', '2d', ...board]); // 2d matches board's kicker card
  [ak, j9, c32].forEach(r => assert.strictEqual(r.category, 'FOUR_OF_A_KIND'));
  assert.ok(ak.score > j9.score, `AK(${ak.score}) should beat J9(${j9.score})`);
  assert.ok(j9.score > c32.score, `J9(${j9.score}) should beat 32(${c32.score}) despite 32 sharing a rank with the board's kicker`);
});

test('完全に同じキッカー構成は正しく同点になる（チョップ想定）', () => {
  const board = ['7h', '7d', 'Ac', '9s', '2c'];
  const kq1 = evaluate7(['Ks', 'Qc', ...board]);
  const kq2 = evaluate7(['Kc', 'Qs', ...board]);
  assert.strictEqual(kq1.score, kq2.score, 'identical rank kickers (different suits) should tie exactly');
});

console.log('\n=== pokersolver突き合わせで発覚: ストレートの高位カード取り違えバグ ===');

test('7ハイストレートは5ハイのホイールより強い（同じ帯の中での順序）', () => {
  const board = ['5s', '3h', '7d', '4c', 'Jh'];
  const sevenHigh = evaluate7(['3s', '6c', ...board]); // 3-4-5-6-7 = 7ハイ
  const wheel = evaluate7(['2c', 'Ac', ...board]);      // A-2-3-4-5 = 5ハイ(ホイール)
  assert.strictEqual(sevenHigh.category, 'STRAIGHT');
  assert.strictEqual(wheel.category, 'STRAIGHT');
  assert.ok(sevenHigh.score > wheel.score,
    `7-high(${sevenHigh.score}) should beat wheel(${wheel.score})`);
});

test('キングハイ・ストレートフラッシュは6ハイ・ストレートフラッシュより強い', () => {
  const kingHigh = evaluate7(['9h', 'Th', 'Jh', 'Qh', 'Kh', '2c', '3c']);
  const sixHigh  = evaluate7(['2h', '3h', '4h', '5h', '6h', 'Ac', 'Kc']);
  assert.strictEqual(kingHigh.category, 'STRAIGHT_FLUSH');
  assert.strictEqual(sixHigh.category, 'STRAIGHT_FLUSH');
  assert.ok(kingHigh.score > sixHigh.score,
    `King-high SF(${kingHigh.score}) should beat 6-high SF(${sixHigh.score})`);
});

test('ロイヤルフラッシュの判定はsfHigh(修正後は最高位カード)がA(idx0)であることを見る', () => {
  const r = evaluate7(['Ah', 'Kh', 'Qh', 'Jh', 'Th', '9c', '8c']);
  assert.strictEqual(r.category, 'ROYAL_FLUSH');
  assert.strictEqual(r.score, 1.0);
});

console.log('\n=== リバー(5枚)ではドロー・ポテンシャルが常に0/nullになる ===');

test('リバーではフラッシュドローっぽい形でもpotential=0・drawType=null', () => {
  const board = ['9h', '8h', '2c', '5d', 'Kc']; // 5枚 = river
  const rm = evalRange169(board, [], {});
  const kqs = rm.find(h => h.hand === 'KQs');
  assert.strictEqual(kqs.potentialStrength, 0);
  assert.strictEqual(kqs.drawType, null);
  assert.strictEqual(kqs.outs, 0);
});

test('同じ盤面でもターン(4枚)なら引き続きFDが検出される（リバー限定の修正であることを確認）', () => {
  const boardTurn = ['9h', '8h', '2c', '5d'];
  const rm = evalRange169(boardTurn, [], {});
  const kqs = rm.find(h => h.hand === 'KQs');
  assert.strictEqual(kqs.drawType, 'FD');
  assert.ok(kqs.potentialStrength > 0);
});


console.log('\n=== range_matrix.js: 169マトリクス・ドロー分類 ===');

test('フラッシュ完成ボードでのFDダブルカウント修正（4-flushボード+スーテッド=既に完成、ドロー扱いしない）', () => {
  const board = ['Qh', '9h', 'Jh', 'Ah']; // 4-flush board (turn)
  const rm = evalRange169(board, [], {});
  const kts = rm.find(h => h.hand === 'KTs');
  assert.strictEqual(kts.handName, 'ROYAL FLUSH');
  assert.strictEqual(kts.potentialStrength, 0, 'already-made royal should not get extra draw potential');
  assert.strictEqual(kts.drawType, null, 'already-made hand should not carry a draw tag');
});

test('本物のフラッシュドローは引き続き検出される（2枚のみ同スート）', () => {
  const board = ['9h', '5h', '2c'];
  const rm = evalRange169(board, [], {});
  const kqs = rm.find(h => h.hand === 'KQs');
  assert.strictEqual(kqs.drawType, 'FD');
  assert.ok(kqs.potentialStrength > 0);
});

test('本物のOESDは引き続き検出される', () => {
  const board = ['9c', '8d', '2s'];
  const rm = evalRange169(board, [], {});
  const t7o = rm.find(h => h.hand === 'T7o');
  assert.strictEqual(t7o.drawType, 'OESD');
});

test('完成済みストレート(ホイール)がドロー(OESD等)として二重計上されない', () => {
  const board = ['2h', '3d', '4c'];
  const rm = evalRange169(board, [], {});
  const a5o = rm.find(h => h.hand === 'A5o');
  assert.strictEqual(a5o.handName, 'STRAIGHT');
  assert.strictEqual(a5o.drawType, null);
  assert.strictEqual(a5o.potentialStrength, 0);
});

test('topClassCombos: ロイヤル達成コンボは1のみ（4通り中3通りはただのストレート）', () => {
  const board = ['Qh', '9h', 'Jh', 'Ah'];
  const rm = evalRange169(board, [], {});
  const kts = rm.find(h => h.hand === 'KTs');
  assert.strictEqual(kts.topClassCombos, 1);
  assert.strictEqual(kts.totalCombos, 4);
});

test('KKKボードでのKK（デッドコンボ）はrangeMatrixから除外される', () => {
  const board = ['Kh', 'Kd', 'Kc'];
  const rm = evalRange169(board, [], {});
  const kk = rm.find(h => h.hand === 'KK');
  assert.strictEqual(kk.density, 0);
});


console.log('\n=== board_intel.js: Nut Dynamics ===');

test('classifyNutDynamics: 実際のcontext形式(heroPos/villainPos)で正しく判定される', () => {
  const boardPaired = ['9h', '9d', '8c']; // HIGHLY_CONNECTED + PAIRED
  const btnVsBb = { heroPos: 'BTN', villainPos: 'BB' };
  const coVsBtn = { heroPos: 'CO', villainPos: 'BTN' };
  assert.strictEqual(classifyNutDynamics(boardPaired, btnVsBb), 'NEUTRAL');
  assert.strictEqual(classifyNutDynamics(boardPaired, coVsBtn), 'NUT_ADV_VILLAIN');
});

test('classifyNutDynamics: Ace+LOW_CONNECTED+UNPAIREDでBTN vs BBはNUT_ADV_HERO', () => {
  const board = ['As', 'Kd', '8c']; // LOW_CONNECTED, unpaired, has Ace
  const btnVsBb = { heroPos: 'BTN', villainPos: 'BB' };
  assert.strictEqual(classifyNutDynamics(board, btnVsBb), 'NUT_ADV_HERO');
});


console.log('\n=== 統合: analyzeBoard() ===');

test('analyzeBoard()が例外なく169マトリクスを返す', () => {
  const board = ['Ah', '7d', '2c'];
  const context = { street: 'FLOP', heroPos: 'BTN', villainPos: 'BB', archetype: 'STANDARD', profile: 'BTN_VS_BB' };
  const result = analyzeBoard(board, context);
  assert.strictEqual(result.rangeMatrix.length, 169);
  assert.ok(Array.isArray(result.narrative));
});


console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
