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
  'utils.js', 'texture.js', 'position.js', 'strength.js', 'equity.js',
  'range_matrix.js', 'board_intel.js', 'interpretations.js',
  'narrative.js', 'board_intelligence.js'
];

let code = '';
for (const f of FILES) {
  code += fs.readFileSync(path.join(CORE_DIR, f), 'utf8') + '\n';
}
// eval()内で定義された関数をこのスコープに晒すため、そのままevalする。
// v3.9.57: core/nuts_display.jsはspectra-worker.jsのimportScriptsには
// 含まれない（メインスレッド専用、Workerには不要）。完全自己完結（他の
// core/*.jsに依存しない）にしてあるため単独でevalしても動くが、
// FILESには加えない（Workerの実際の読み込み順を模したものではなくなる
// ため）。テストの都合で同じeval呼び出しの文字列に連結している。
code += fs.readFileSync(path.join(CORE_DIR, 'nuts_display.js'), 'utf8') + '\n';
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

test('classifyNutDynamics: K-7-2r（ドライなハイボードの代表格）もBTN vs BBでNUT_ADV_HERO（他AIレビュー指摘・v3.9.32修正）', () => {
  // 修正前はconnectivity===LOW_CONNECTEDのみを要求しており、K-7-2rはgaps>6の
  // DISCONNECTED判定になるため、条件を満たさず常にNEUTRAL扱いになっていた。
  const board = ['Ks', '7h', '2d']; // DISCONNECTED (gaps=11), unpaired, has King
  const btnVsBb = { heroPos: 'BTN', villainPos: 'BB' };
  assert.strictEqual(classifyConnectivity(board), 'DISCONNECTED');
  assert.strictEqual(classifyNutDynamics(board, btnVsBb), 'NUT_ADV_HERO');
});

test('classifyNutDynamics: HIGHLY_CONNECTEDな高ボード(K-Q-J)はNUT_ADV_HEROの対象外のまま（回帰確認）', () => {
  const board = ['Ks', 'Qh', 'Jd']; // HIGHLY_CONNECTED, unpaired, has King
  const btnVsBb = { heroPos: 'BTN', villainPos: 'BB' };
  assert.strictEqual(classifyConnectivity(board), 'HIGHLY_CONNECTED');
  assert.strictEqual(classifyNutDynamics(board, btnVsBb), 'NEUTRAL');
});


console.log('\n=== texture.js: Board Feature Classifiers（v3.9.32 golden tests） ===');

test('classifyConnectivity: A-2-3ホイールはHIGHLY_CONNECTED（他AIレビュー指摘。修正前はAceをhigh固定で扱いDISCONNECTEDだった）', () => {
  assert.strictEqual(classifyConnectivity(['As', '2h', '3d']), 'HIGHLY_CONNECTED');
});

test('classifyConnectivity: A-2-4/A-3-5等の他のホイール派生も、Ace-high固定判定より繋がっている評価になる', () => {
  assert.strictEqual(classifyConnectivity(['As', '2h', '4d']), 'CONNECTED');
});

test('classifyConnectivity: K-7-2r（Ace不在の通常ドライボード）はwheel補正の影響を受けずDISCONNECTEDのまま（回帰確認）', () => {
  assert.strictEqual(classifyConnectivity(['Ks', '7h', '2d']), 'DISCONNECTED');
});

test('classifyConnectivity: 通常のストレート(5-6-7-8-9)はwheel補正を入れてもHIGHLY_CONNECTEDのまま（回帰確認）', () => {
  assert.strictEqual(classifyConnectivity(['5s', '6h', '7d', '8c', '9s']), 'HIGHLY_CONNECTED');
});

test('classifyFlushPressure: リバーで5枚全て同スート(5-flush)はFIVE_FLUSH（他AIレビュー指摘。修正前はどの分岐にも該当せずRAINBOWに落ちていた）', () => {
  assert.strictEqual(classifyFlushPressure(['Ah', 'Kh', 'Qh', 'Jh', '9h']), 'FIVE_FLUSH');
});

test('classifyFlushPressure: 4-flushは引き続きFOUR_FLUSH（回帰確認）', () => {
  assert.strictEqual(classifyFlushPressure(['Ah', 'Kh', 'Qh', 'Jh', '9d']), 'FOUR_FLUSH');
});

test('classifyPairStructure: クアッズボードはQUADS_BOARD（他AIレビュー指摘。修正前は該当分岐がなくUNPAIREDに落ちていた）', () => {
  assert.strictEqual(classifyPairStructure(['Ks', 'Kh', 'Kd', 'Kc', '2s']), 'QUADS_BOARD');
});

test('classifyPairStructure: トリップスボード・ツーペアボード・通常ペアボードは引き続き正しく分類される（回帰確認）', () => {
  assert.strictEqual(classifyPairStructure(['As', 'Ad', 'Ac', 'Kd']), 'TRIPS_BOARD');
  assert.strictEqual(classifyPairStructure(['As', 'Ad', 'Kc', 'Kd']), 'DOUBLE_PAIRED');
  assert.strictEqual(classifyPairStructure(['As', 'Ad', 'Kc']), 'PAIRED');
  assert.strictEqual(classifyPairStructure(['As', 'Kd', '2c']), 'UNPAIRED');
});


console.log('\n=== range_matrix.js: OESD/GSD ホールカード非参加バグ（v3.9.31 golden test） ===');

test('classifyDraw: 4連続ボード(J-T-9-8)でホールカードが無関係(33)ならOESD/GSDと判定されない（他AIレビュー指摘のCriticalバグ）', () => {
  // 注意: A-Kのようなハイカードは9-T-J-K-Qのガットショットが実在するため使えない
  // （ホール参加の"本物のドロー"になってしまう）。ランク的に完全に無関係な低いペアを使う。
  // v3.9.46で一度BD-FDに書き換えたが誤りだった。v3.9.46時点の本番Blob bundleが
  // 実際にBD-FDを返していたことは事実だが、「本番と同じだから正しい」という
  // 検証だけで期待値を更新し、その挙動自体がポーカーとして正しいかを検証して
  // いなかった（他AIによる独立監査で指摘・実測確認）。このboard(Js,Th,9d,8c)は
  // 4スート全て異なる完全レインボーで、33はどのスートも1枚しか持たないため、
  // ボード+ホール=1+1=2枚にしかならず、フラッシュ完成に必要な3枚（残りturn+river
  // の2枚）を全て自分と同スートで揃える必要がある——backdoorとしてもボードの
  // 寄与が0なので数学的に到達不可能で、正しくはドロー無し(null)。v3.9.47で
  // classifyDraw/classifyPotentialのペア閾値バグ（スーテッドと同じ閾値を誤流用
  // していた）を修正し、本来のnullに戻した。
  const board = ['Js', 'Th', '9d', '8c'];
  assert.strictEqual(classifyDraw('33', board), null);
});

test('classifyDraw: 同じ盤面でホールカードが実際に窓へ参加していれば引き続き正しく検出される（回帰確認）', () => {
  // Hero: K + board 9-T-J → 9,T,J,Kの4枚窓でQを待つ本物のガットショット
  // （AKoは一見ボードと無関係に見えるが、Kが実際にこの窓に参加する正当なドローなので
  //  この盤面ではGSDと判定されるのが正しい。上のテストとは異なる盤面(9-T-J、8無し)を使う）
  const board = ['9d', 'Ts', 'Jc'];
  assert.strictEqual(classifyDraw('AKo', board), 'GSD');
});


console.log('\n=== 統合: analyzeBoard() ===');

test('analyzeBoard()が例外なく169マトリクスを返す', () => {
  const board = ['Ah', '7d', '2c'];
  const context = { street: 'FLOP', heroPos: 'BTN', villainPos: 'BB', archetype: 'STANDARD', profile: 'BTN_VS_BB' };
  const result = analyzeBoard(board, context);
  assert.strictEqual(result.rangeMatrix.length, 169);
  assert.ok(Array.isArray(result.narrative));
});


console.log('\n=== range_matrix.js: drawOverlap 常時0バグ（v3.9.34 golden test） ===');

test('hasComboDraw: OESD+FDのコンボドローは検出される（他AIレビュー指摘。修正前はclassifyDrawの早期returnによりdrawOverlapが構造上常に0だった）', () => {
  // Hero 98s + board Ts-7s-8d: 9,8,T,7が4連続窓(OESD)、かつT♠7♠でフラッシュドロー(2枚同スート)
  assert.strictEqual(hasComboDraw('98s', ['Ts', '7s', '8d']), true);
});

test('hasComboDraw: ガットショット+FDのコンボドローも検出される', () => {
  assert.strictEqual(hasComboDraw('Q9s', ['Js', 'Ts', '2d']), true);
});

test('hasComboDraw: フラッシュドローのみ（ストレートドローなし）はfalse（回帰確認）', () => {
  assert.strictEqual(hasComboDraw('AKs', ['7s', '2s', '9d']), false);
});

test('hasComboDraw: ストレートドローのみ（フラッシュドローなし・レインボー）はfalse（回帰確認）', () => {
  assert.strictEqual(hasComboDraw('98s', ['Th', '7d', '2c']), false);
});

test('hasComboDraw: ペアはストレートドローを持たないためfalseになりやすい（回帰確認）', () => {
  assert.strictEqual(hasComboDraw('99', ['Th', '8h', '2d']), false);
});

test('computeStructureFeatures: ドライなレインボーフロップではdrawOverlap寄与分がなく、ウェットな2トーン・コネクテッドフロップより低いdrawStructureになる', () => {
  const wetBoard = ['Ts', '7s', '8d'];
  const dryBoard = ['Ah', '7d', '2c'];
  const wetMatrix = evalRange169(wetBoard, [], {});
  const dryMatrix = evalRange169(dryBoard, [], {});
  const wetFeatures = computeStructureFeatures(wetMatrix, wetBoard);
  const dryFeatures = computeStructureFeatures(dryMatrix, dryBoard);
  assert.ok(wetFeatures.drawStructure > dryFeatures.drawStructure,
    `wet(${wetFeatures.drawStructure}) should be > dry(${dryFeatures.drawStructure})`);
});

test('computeStructureFeatures: boardを渡さない場合はdrawOverlap=0のまま（後方互換のフォールバック確認）', () => {
  const wetBoard = ['Ts', '7s', '8d'];
  const wetMatrix = evalRange169(wetBoard, [], {});
  const withoutBoard = computeStructureFeatures(wetMatrix, null);
  const withBoard = computeStructureFeatures(wetMatrix, wetBoard);
  assert.ok(withBoard.drawStructure > withoutBoard.drawStructure);
});


console.log('\n=== range_matrix.js: computeRangeAdvantage BB openWidth/defendWidth取り違え（v3.9.36 golden test） ===');

test('computeRangeAdvantage: BBはdefendWidth(1.8)を使うべきで、openWidth(0.5,「Fold most hands preflop」)を使ってはいけない（他AIレビュー指摘のBug）', () => {
  // ドライなハイボード(K-7-2)でも、defendWidthを使えば基準値が過度にHero有利に
  // 張り付かない（+0.744ではなく、ボード補正を含めても現実的な範囲に収まる）ことを確認
  const board = ['Ks', '7h', '2d'];
  const context = { street: 'FLOP', heroPos: 'BTN', villainPos: 'BB' };
  const rangeMatrix = evalRange169(board, [], context);
  const adv = computeRangeAdvantage(board, 'BTN', 'BB', rangeMatrix);
  assert.ok(adv < 0.3, `K-7-2ドライボードでrangeAdvantageが${adv}(0.3以上)は基準値がopenWidthのままの疑い`);
});

test('computeRangeAdvantage: 定石でBB(ディフェンダー)有利とされるウェットな低ボード(7-6-5)では、実際にマイナス（villain=BB優位）に振れる', () => {
  // 修正前はvillain側の基準がopenWidth(0.5)固定で常に強くHero優位に張り付き、
  // このような明確にBB有利なボードでもプラス（Hero優位）のままだった
  const board = ['7s', '6h', '5d'];
  const context = { street: 'FLOP', heroPos: 'BTN', villainPos: 'BB' };
  const rangeMatrix = evalRange169(board, [], context);
  const adv = computeRangeAdvantage(board, 'BTN', 'BB', rangeMatrix);
  assert.ok(adv < 0, `7-6-5ウェット低ボードでrangeAdvantageが${adv}(0以上)はBB有利を表現できていない`);
});

test('computeRangeAdvantage: defendWidthが未定義の他ポジションはopenWidthへ従来通りフォールバックする（回帰確認）', () => {
  const board = ['Ks', '7h', '2d'];
  const context = { street: 'FLOP', heroPos: 'BTN', villainPos: 'CO' };
  const rangeMatrix = evalRange169(board, [], context);
  // CO(villain)にはdefendWidthが無いため例外なく計算できることだけを確認（値そのものは検証しない）
  const adv = computeRangeAdvantage(board, 'BTN', 'CO', rangeMatrix);
  assert.ok(typeof adv === 'number' && !Number.isNaN(adv));
});


console.log('\n=== range_matrix.js: coverage軸の恒常化（v3.9.37 golden test） ===');

test('computeStructureFeatures: 旧coverage定義(169ハンド平均density)はフロップ内容に関わらず一定値になる問題があった（回帰確認: 現在は変化する）', () => {
  const boards = [
    ['As', 'Ks', 'Qs'],  // monotone
    ['9s', '7d', '2c'],  // rainbow dry
    ['Ks', 'Kd', '4c'],  // paired
    ['As', 'Ad', 'Ac'],  // trips (most extreme card removal)
  ];
  const context = { street: 'FLOP', heroPos: 'BTN', villainPos: 'BB' };
  const coverages = boards.map(b => {
    const rm = evalRange169(b, [], context);
    return computeStructureFeatures(rm, b).coverage;
  });
  const allSame = coverages.every(c => c === coverages[0]);
  assert.ok(!allSame, `coverageが全ボードで${coverages[0]}に固定されている（構造変化に反応していない）: ${coverages}`);
});

test('computeStructureFeatures: MID-STRENGTH COVERAGEはハイドライボードよりペアボードで明確に高い値になる', () => {
  const context = { street: 'FLOP', heroPos: 'BTN', villainPos: 'BB' };
  const dryBoard = ['As', 'Kd', '2c'];
  const pairedBoard = ['Ks', 'Kd', '4c'];
  const dryRm = evalRange169(dryBoard, [], context);
  const pairedRm = evalRange169(pairedBoard, [], context);
  const dryCov = computeStructureFeatures(dryRm, dryBoard).coverage;
  const pairedCov = computeStructureFeatures(pairedRm, pairedBoard).coverage;
  assert.ok(pairedCov > dryCov + 30, `paired(${pairedCov}) should be well above dry(${dryCov})`);
});

test('computeStructureFeatures: ターンでも4枚目のカード次第でcoverageが大きく変動する（フロップ止まりではなくストリート内でも反応することを確認）', () => {
  const context = { street: 'TURN', heroPos: 'BTN', villainPos: 'BB' };
  const blankTurn = ['As', 'Ad', 'Ac', '2h'];   // trip aces flop + irrelevant turn
  const quadsTurn = ['As', 'Ad', 'Ac', 'Ah'];   // same flop + board goes to quads
  const blankRm = evalRange169(blankTurn, [], context);
  const quadsRm = evalRange169(quadsTurn, [], context);
  const blankCov = computeStructureFeatures(blankRm, blankTurn).coverage;
  const quadsCov = computeStructureFeatures(quadsRm, quadsTurn).coverage;
  assert.ok(Math.abs(blankCov - quadsCov) > 30,
    `同一フロップでも4枚目カードでcoverageが大きく変わるはず: blank=${blankCov} quads=${quadsCov}`);
});


console.log('\n=== range_matrix.js: categoryBreakdown/comboSuitsのcore未反映 同期修正（v3.9.40 golden test） ===');

test('eval169: モノトーンスペードフロップでQJsのcategoryBreakdownがFLUSH(♠1コンボ)とHIGH CARD(他3コンボ)に分離される（v3.9.11/v3.9.31導入分がcoreに存在しなかった欠落の回帰確認）', () => {
  const board = ['As', 'Ks', '7s'];
  const rm = eval169(board, []);
  const qjs = rm.find(h => h.hand === 'QJs');
  assert.ok(qjs.categoryBreakdown, 'categoryBreakdownがundefinedのまま（core未反映バグの再発）');
  assert.strictEqual(qjs.categoryBreakdown.length, 2, `カテゴリ数は2のはず: ${JSON.stringify(qjs.categoryBreakdown)}`);
  const flush = qjs.categoryBreakdown.find(g => g.name === 'FLUSH');
  const highCard = qjs.categoryBreakdown.find(g => g.name === 'HIGH CARD');
  assert.strictEqual(flush.count, 1, 'FLUSHは4コンボ中スート一致の1コンボのみのはず');
  assert.deepStrictEqual(flush.suits, ['s'], 'FLUSHの関与スートは♠のみのはず');
  assert.strictEqual(highCard.count, 3, 'HIGH CARDは残り3コンボ(オフスート側)のはず');
  assert.deepStrictEqual(highCard.suits.sort(), ['c', 'd', 'h'], 'HIGH CARDの関与スートは♠以外の3つのはず');
});

test('eval169: ペアハンド(88)のcomboSuitsが6コンボ全ての組み合わせスートを正しく集約する（772rボード、TWO PAIR全6コンボ）', () => {
  const board = ['7h', '7d', '2c'];
  const rm = eval169(board, []);
  const pair88 = rm.find(h => h.hand === '88');
  assert.ok(pair88.categoryBreakdown, 'categoryBreakdownがundefinedのまま（core未反映バグの再発）');
  assert.strictEqual(pair88.categoryBreakdown.length, 1, '772rでは88は常にTWO PAIRのみ、カテゴリ分岐は無いはず');
  const twoPair = pair88.categoryBreakdown[0];
  assert.strictEqual(twoPair.name, 'TWO PAIR');
  assert.strictEqual(twoPair.count, 6, 'ペアの全6コンボがTWO PAIRのはず');
  assert.deepStrictEqual(twoPair.suits.sort(), ['c', 'd', 'h', 's'], 'ペアは4スート全てがcomboSuitsに現れるはず（各スート3コンボずつ関与）');
});

test('evalRange169: categoryBreakdownがUI(renderHeroAnalysis)向けにpassthroughされる（evalRange169のマッピングからcategoryBreakdownキーが欠落していた回帰確認）', () => {
  const board = ['As', 'Ks', '7s'];
  const rm = evalRange169(board, [], null);
  const qjs = rm.find(h => h.hand === 'QJs');
  assert.ok(qjs.categoryBreakdown, 'evalRange169の出力にcategoryBreakdownが無い（マッピング欠落の再発）');
  assert.strictEqual(qjs.categoryBreakdown.length, 2);
});

console.log('\n=== range_matrix.js: computeHeroRank (HERO_RANK v1, v3.9.39) core同期・golden test（v3.9.43） ===');

test('computeHeroRank: AsKs on Qs7d2c (flop, ハイカード) — population/rank/percentileの実測固定', () => {
  const r = computeHeroRank(['Qs', '7d', '2c'], ['As', 'Ks']);
  assert.strictEqual(r.population, 1081, 'flopの生存コンボ数はC(47,2)=1081のはず');
  assert.strictEqual(r.strongerCount + r.tiedCount + r.weakerCount, r.population, 'stronger+tied+weaker=populationの契約');
  assert.strictEqual(r.rankPos, 438);
  assert.ok(Math.abs(r.strengthPercentile - 59.620721554116564) < 1e-9);
});

test('computeHeroRank: 7c7d on Ks7h2d (flop, セット) — population同一盤面サイズでも上位ハンドは高percentile', () => {
  const r = computeHeroRank(['Ks', '7h', '2d'], ['7c', '7d']);
  assert.strictEqual(r.population, 1081);
  assert.strictEqual(r.rankPos, 4);
  assert.ok(Math.abs(r.strengthPercentile - 99.72247918593895) < 1e-9);
});

test('computeHeroRank: AsAd on KsKd4c9h (turn, オーバーペア=ツーペア) — turnはpopulation=1035(C(45,2))', () => {
  const r = computeHeroRank(['Ks', 'Kd', '4c', '9h'], ['As', 'Ad']);
  assert.strictEqual(r.population, 1035);
  assert.strictEqual(r.rankPos, 97);
  assert.ok(Math.abs(r.strengthPercentile - 90.77294685990339) < 1e-9);
});

test('computeHeroRank: Th9h on 8h7h2cJd3s (river, ストレート・tied9件) — riverはpopulation=990(C(44,2))、tiedCountが正しく0.5按分される', () => {
  const r = computeHeroRank(['8h', '7h', '2c', 'Jd', '3s'], ['Th', '9h']);
  assert.strictEqual(r.population, 990);
  assert.strictEqual(r.tiedCount, 9);
  assert.strictEqual(r.rankPos, 6);
  assert.ok(Math.abs(r.strengthPercentile - 99.54545454545455) < 1e-9);
});

console.log('\n=== v3.9.47: ペアFD/BD-FDの閾値バグ修正（他AIによる独立監査で発見）意味論マトリクステスト ===');
// 設計方針（監査提言どおり）: 実カード列挙による「フラッシュ到達可能性」という
// ポーカー規則そのものから正解を導き、コード出力と突き合わせる。suitedは2枚とも
// 同一スート（board+hand=maxSuit+2）、pairは1枚しか寄与できない（+1）。
// BD-FD（残り2枚必要）はflop（board.length===3）限定。

test('classifyDraw: ペア×3-flushフロップ = 本物のFD（board3+ペア1枚=4枚、あと1枚待ち）', () => {
  assert.strictEqual(classifyDraw('33', ['3s', '7s', 'Ks']), 'FD');
});
test('classifyDraw: ペア×2-toneフロップ = バックドアFD（board2+ペア1枚=3枚、残り2枚必要）', () => {
  assert.strictEqual(classifyDraw('33', ['7s', '2d', '9s']), 'BD-FD');
});
test('classifyDraw: ペア×rainbowフロップ = ドロー無し（board1+ペア1枚=2枚、残り3枚必要=到達不可能）', () => {
  assert.strictEqual(classifyDraw('33', ['2s', '7h', '9d']), null);
});
test('classifyDraw: ペア×rainbowターン = ドロー無し（turn以降はbackdoor自体が成立し得ない、残りriver1枚のみ）', () => {
  assert.strictEqual(classifyDraw('33', ['2s', '7h', '9d', 'Kc']), null);
});
test('classifyDraw: ペア×1-flushターン = 本物のFD（board3+ペア1枚=4枚、river待ちの実在ドロー）', () => {
  assert.strictEqual(classifyDraw('33', ['3s', '7s', '9d', 'Ks']), 'FD');
});
test('classifyDraw: スーテッド×rainbowターン = ドロー無し（turnのBD-FDは残りriver1枚のみで成立不能）', () => {
  assert.strictEqual(classifyDraw('AKs', ['2s', '7h', '9d', 'Kc']), null);
});
test('classifyDraw: スーテッド×1-flushターン = 本物のFD（board2枚+スーテッド2枚=4枚、river待ちの実在ドロー）', () => {
  // 2s,7h,9s,Kcのうちsスートが2枚(2s,9s)。スーテッドは2枚とも同スートなので
  // board2+hand2=4枚、river1枚待ちの本物のフラッシュドロー。
  assert.strictEqual(classifyDraw('AKs', ['2s', '7h', '9s', 'Kc']), 'FD');
});
test('classifyPotential: ペア×rainbowフロップはpotential=0（幽霊ドローのoutsがUIに出ない回帰確認）', () => {
  assert.strictEqual(classifyPotential('33', ['2s', '7h', '9d']), 0);
});
test('classifyPotential: ペア×3-flushフロップは非ゼロ（本物のFDとしてpotentialに反映される）', () => {
  assert.ok(classifyPotential('33', ['3s', '7s', 'Ks']) > 0);
});

console.log('\n=== v3.9.50: computeEquity() ⑥-B/C（river完全列挙のみ）golden test ===');
test('computeEquity: ロイヤルフラッシュ(Ah,Kh on Th,Jh,Qh,2c,3d)は唯一無二の最強手なのでequity=1.0', () => {
  // ハート5枚(Ah,Kh,Qh,Jh,Th)でロイヤルフラッシュ完成。これを上回る/並ぶ役は
  // 存在せず、かつ必要なAh/Khを両方Heroが保持しているため他の誰にも再現
  // できない（手計算で自明にwin=100%になるケース）。
  const r = computeEquity({ hero: ['Ah', 'Kh'], board: ['Th', 'Jh', 'Qh', '2c', '3d'] });
  assert.strictEqual(r.totalWeight, 990); // C(45,2)
  assert.strictEqual(r.winCount, 990);
  assert.strictEqual(r.tieCount, 0);
  assert.strictEqual(r.lossCount, 0);
  assert.strictEqual(r.equity, 1);
});

test('computeEquity: クアッズ2ボード(2c,2d,2h,2s,Kc)でHero=As,Qd — 手計算(win=861/990,tie=129/990,loss=0)と一致', () => {
  // ボードの2222はクアッズとして全員共通。勝敗は「board外で最も高いカード
  // （キッカー）」のみで決まる。HeroはAsを持つため、Villainが残り3枚の
  // エース(Ah,Ac,Ad)のいずれかを持てばキッカー同点＝tie、持たなければ
  // Heroのキッカー(A)がVillainの最良キッカー(最大でK)を上回るため必ずwin。
  // Villainが敗北するケースは数学的に存在しない（Heroのキッカーがすでに
  // 最強のAのため）。
  // 全コンボ=C(45,2)=990。エースを1枚以上含むコンボ=990-C(42,2)=990-861=129（tie）。
  // エースを含まないコンボ=861（win）。
  const r = computeEquity({ hero: ['As', 'Qd'], board: ['2c', '2d', '2h', '2s', 'Kc'] });
  assert.strictEqual(r.totalWeight, 990);
  assert.strictEqual(r.winCount, 861);
  assert.strictEqual(r.tieCount, 129);
  assert.strictEqual(r.lossCount, 0);
  assert.ok(Math.abs(r.equity - (861 / 990 + 129 / 990 * 0.5)) < 1e-9);
});

console.log('\n=== v3.9.52: computeEquity() ⑥-E（flop Monte Carlo）golden test ===');
// 方針（完全一致ではなく統計的検証）:
//  1. 確率の合計が1に近いこと
//  2. equity = win + tie*0.5 の関係が成立すること
//  3. 完全列挙できる小規模基準ケースとの誤差が許容範囲内であること
//  4. 同一seed・同一入力で完全に再現できること
// Monte Carloの乱数結果そのものをgolden testの期待値にはしない（実装変更に弱いため）。

test('computeEquityFlop: flopで既にロイヤルフラッシュ完成(Ah,Kh on Th,Jh,Qh)は退化ケースとしてMC全試行が厳密にequity=1.0になる', () => {
  // ランアウトに関わらず結果が変わらない退化ケースなので、統計的ばらつきが
  // 一切無く、全試行が例外なく一致するはず（MCの配線ミスがあれば即座に破綻する）。
  const r = computeEquity({ hero: ['Ah', 'Kh'], board: ['Th', 'Jh', 'Qh'] });
  assert.strictEqual(r.precise, false);
  assert.strictEqual(r.totalWeight, 50000); // DEFAULT_FLOP_ITERATIONS
  assert.strictEqual(r.winCount, 50000);
  assert.strictEqual(r.equity, 1);
});

test('computeEquityFlop: 確率の合計は1に近い（win+tie+loss probability ≈ 1）', () => {
  const deadSet = new Set(['2c', '7d', '9s', 'As', 'Kd']);
  const combos = buildDefaultVillainCombos(deadSet);
  const r = computeEquityFlop(['As', 'Kd'], ['2c', '7d', '9s'], combos, 20000, 1);
  const sum = r.winProbability + r.tieProbability + r.lossProbability;
  assert.ok(Math.abs(sum - 1) < 1e-9, `確率の合計が1から乖離: ${sum}`);
});

test('computeEquityFlop: equity = winProbability + tieProbability*0.5 の関係が成立する', () => {
  const deadSet = new Set(['2c', '7d', '9s', 'As', 'Kd']);
  const combos = buildDefaultVillainCombos(deadSet);
  const r = computeEquityFlop(['As', 'Kd'], ['2c', '7d', '9s'], combos, 20000, 2);
  assert.ok(Math.abs(r.equity - (r.winProbability + r.tieProbability * 0.5)) < 1e-12);
});

test('computeEquityFlop: 完全列挙した基準値との誤差が許容範囲内（As,Kd on 2c,7d,9s）', () => {
  // 基準値は本テストの作成時に、Villain全1081コンボ×残り45枚から2枚の
  // 完全列挙（C(45,2)=990、計1,070,190回のevaluate7ペア比較、実行時間
  // 約6.5秒）で一度だけ計測した厳密値。実行の都度この完全列挙をやり直すと
  // テストスイートが著しく遅くなるため、値をコメント付きで固定している。
  // 厳密値: win=554910, tie=11522, loss=503758, total=1070190,
  //         equity=0.5238985600687728
  const deadSet = new Set(['2c', '7d', '9s', 'As', 'Kd']);
  const combos = buildDefaultVillainCombos(deadSet);
  const r = computeEquityFlop(['As', 'Kd'], ['2c', '7d', '9s'], combos, 50000, 7);
  const exactEquity = 0.5238985600687728;
  // n=50000のBernoulli近似で標準誤差は√(p(1-p)/n)≈0.0022。10標準誤差分の
  // 余裕(0.03)を見ても偶発的なflakinessは実質発生しない水準。
  assert.ok(Math.abs(r.equity - exactEquity) < 0.03, `MC推計値${r.equity}が厳密値${exactEquity}から乖離しすぎ`);
});

test('computeEquityFlop: 同一seed・同一入力なら完全に再現できる（再現性の担保）', () => {
  const deadSet = new Set(['2c', '7d', '9s', 'As', 'Kd']);
  const combos = buildDefaultVillainCombos(deadSet);
  const a = computeEquityFlop(['As', 'Kd'], ['2c', '7d', '9s'], combos, 3000, 999);
  const b = computeEquityFlop(['As', 'Kd'], ['2c', '7d', '9s'], combos, 3000, 999);
  assert.deepStrictEqual(a, b);
});

test('computeEquityFlop: 異なるseedなら（極めて高確率で）異なる結果になる', () => {
  const deadSet = new Set(['2c', '7d', '9s', 'As', 'Kd']);
  const combos = buildDefaultVillainCombos(deadSet);
  const a = computeEquityFlop(['As', 'Kd'], ['2c', '7d', '9s'], combos, 3000, 111);
  const b = computeEquityFlop(['As', 'Kd'], ['2c', '7d', '9s'], combos, 3000, 222);
  assert.notDeepStrictEqual(a, b);
});

console.log('\n=== v3.9.57: computeNutDisplayData()（④-3、renderNuts()の純粋計算部分をcanonical化）golden test ===');
test('computeNutDisplayData: 3枚spadeフラッシュボード(Ks,Qs,Js,2d,7h)の帯構成・combos・flush分割が実測値と一致', () => {
  const board = ['Ks', 'Qs', 'Js', '2d', '7h'];
  const r = analyzeBoard(board, {});
  const d = computeNutDisplayData(r.rangeMatrix, r.features, board);
  assert.strictEqual(d.dominantSuit, 's');
  assert.strictEqual(d.totalCombos, 964);
  const byName = Object.fromEntries(d.bands.map(b => [b.name, b]));
  assert.strictEqual(byName['ROYAL FLUSH'].combos, 1);
  assert.strictEqual(byName['FLUSH'].combos, 43);
  assert.strictEqual(byName['ONE PAIR'].combos, 390);
  assert.strictEqual(byName['HIGH CARD'].combos, 402);
  // ボードはKs-Qs-Jsで既にフラッシュ完成ではないのでFLUSH帯はconfirmed:falseのはず
  assert.strictEqual(byName['FLUSH'].confirmed, false);
  // flush帯の分割: ボードの最強spadeはKs(rank idx=1)。それより強い(idx<1、つまりAs絡み)
  // コンボがbeatsBoard、それ以外(K以下でspadeを持つ)がchopRisk。
  assert.strictEqual(byName['FLUSH'].flushSplit.boardTopFlushRank, 1);
  assert.strictEqual(byName['FLUSH'].flushSplit.boardTopIsAce, false);
  assert.strictEqual(byName['FLUSH'].flushSplit.beatsBoard.length, 8);
  assert.strictEqual(byName['FLUSH'].flushSplit.chopRisk.length, 35);
});

test('computeNutDisplayData: ペアボード(7c,7d,2h,9s,4c)ではHIGH CARDが除外され、ONE PAIRがconfirmedになる', () => {
  const board = ['7c', '7d', '2h', '9s', '4c'];
  const r = analyzeBoard(board, {});
  const d = computeNutDisplayData(r.rangeMatrix, r.features, board);
  assert.ok(!d.bands.some(b => b.name === 'HIGH CARD'), 'ペアボードではHIGH CARD帯が出力に含まれないはず（board自体が既に一対持っているため全員最低でもワンペア）');
  const onePair = d.bands.find(b => b.name === 'ONE PAIR');
  assert.strictEqual(onePair.confirmed, true);
  assert.strictEqual(onePair.combos, 576);
});

test('computeNutDisplayData: 純粋関数であり、DOM/UI状態（document, collapsedNutBands等）に一切依存しない（コメントを除いた実コードに出現しないことの確認）', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'core', 'nuts_display.js'), 'utf8');
  // コメント行を除去してから検査する（コメント中でこれらの語を説明として
  // 言及すること自体は許容するため、自己言及で誤検出しないようにする）。
  const codeOnly = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  for (const forbidden of ['document.', 'collapsedNutBands', 'window.', 'localStorage']) {
    assert.ok(!codeOnly.includes(forbidden), `core/nuts_display.jsのコード本体に "${forbidden}" が含まれている（純粋関数の境界違反）`);
  }
});

console.log('\n=== v3.9.55: Worker EQUITYメッセージ型（⑥-G）統合テスト ===');
// core/*.jsだけをevalする既存ハーネスにはspectra-worker.js（self.onmessage）が
// 含まれていないため、このブロックだけは別途Worker本体を読み込んでselfをスタブし、
// 実際にメッセージを投げて応答を受け取る形で検証する（Workerの配線ミスは
// core側のテストでは一切検出できないため、統合テストとして必要）。
//
// 注意（v3.9.55で判明）: core/*.jsのキャッシュは`let equityCache = ...`という
// let宣言のため、このファイル冒頭のeval(code)で作られたスコープの外からは
// 参照できない（function宣言は巻き上げでグローバル的に見えるが、letは
// eval毎のスコープに閉じる）。そのためWorker本体を別のeval呼び出しで読むと
// 「equityCache is not defined」になる。実際のWorkerではimportScriptsで
// 同一グローバルに読み込まれるためこの問題は起きないので、テスト側で
// core+workerを1つの文字列として結合し、同一スコープでevalする。
(function testWorkerEquity() {
  let coreCode = '';
  for (const f of FILES) {
    coreCode += fs.readFileSync(path.join(CORE_DIR, f), 'utf8') + '\n';
  }
  const workerSrc = fs.readFileSync(path.join(__dirname, '..', 'spectra-worker.js'), 'utf8')
    // importScripts(...)はNode上では実行できない。上でcoreCodeとして直接
    // 結合しているため、宣言だけを取り除けばWorker本体はそのまま動く
    // （実際のWorkerでのimportScriptsと同じ「同一グローバルへの読み込み」を再現）。
    .replace(/importScripts\([\s\S]*?\);/, '');

  const posted = [];
  const self = {
    postMessage: (m) => posted.push(m),
    onmessage: null
  };
  const performance = globalThis.performance || { now: () => Date.now() };
  eval(coreCode + '\n' + workerSrc);

  function send(payloadObj) {
    posted.length = 0;
    self.onmessage({ data: payloadObj });
    return posted[posted.length - 1];
  }

  test('Worker EQUITY: INIT_OKのcapabilitiesに EQUITY が含まれる', () => {
    const r = send({ type: 'INIT', requestId: 1, payload: {} });
    assert.strictEqual(r.type, 'INIT_OK');
    assert.ok(r.capabilities.includes('EQUITY'), `capabilities に EQUITY が無い: ${JSON.stringify(r.capabilities)}`);
  });

  test('Worker EQUITY: riverのリクエストがdata付きで返り、計算コアと同じ結果になる', () => {
    const board = ['2c', '2d', '2h', '2s', 'Kc'];
    const hero  = ['As', 'Qd'];
    const r = send({ type: 'EQUITY', requestId: 2, payload: { board, hero } });
    assert.strictEqual(r.type, 'EQUITY');
    assert.strictEqual(r.cached, false);
    assert.ok(r.data, `dataがnull: reason=${r.reason}`);
    // core側を直接呼んだ結果と一致すること（Workerが余計な加工をしていない確認）
    assert.deepStrictEqual(r.data, computeEquity({ hero, board }));
    assert.strictEqual(r.data.precise, true);
  });

  test('Worker EQUITY: 2回目の同一リクエストはキャッシュ命中する（cached:true, calcTime:0）', () => {
    const board = ['2c', '2d', '2h', '2s', 'Kc'];
    const hero  = ['As', 'Qd'];
    send({ type: 'EQUITY', requestId: 3, payload: { board, hero } });
    const r = send({ type: 'EQUITY', requestId: 4, payload: { board, hero } });
    assert.strictEqual(r.cached, true);
    assert.strictEqual(r.calcTime, 0);
  });

  test('Worker EQUITY: villainRangeが異なれば別キャッシュエントリになる（キーにvillainRangeが含まれている）', () => {
    const board = ['2c', '7d', '9s', 'Jh', 'Kd'];
    const hero  = ['As', 'Ks'];
    const a = send({ type: 'EQUITY', requestId: 5, payload: { board, hero, villainRange: [{ cards: ['Qh', 'Qd'], weight: 1 }] } });
    const b = send({ type: 'EQUITY', requestId: 6, payload: { board, hero, villainRange: [{ cards: ['Ah', 'Ad'], weight: 1 }] } });
    assert.strictEqual(a.cached, false);
    assert.strictEqual(b.cached, false); // 別レンジなので命中してはいけない
    assert.notDeepStrictEqual(a.data, b.data);
  });

  test('Worker EQUITY: preflopはENGINE_ERRORではなくreason付きのEQUITY応答で返る', () => {
    const r = send({ type: 'EQUITY', requestId: 7, payload: { board: ['2c', '7d'], hero: ['As', 'Ks'] } });
    assert.strictEqual(r.type, 'EQUITY');
    assert.strictEqual(r.data, null);
    assert.ok(/Preflop/.test(r.reason), `reasonがPreflopに言及していない: ${r.reason}`);
  });

  test('Worker EQUITY: 不正なvillainRange（有効コンボ0件）もENGINE_ERRORにせずreason付きEQUITY応答で返す', () => {
    // 入力起因のエラーでENGINE ERRORバッジを点灯させてはいけない（UIの意味が変わる）。
    const r = send({
      type: 'EQUITY',
      requestId: 8,
      payload: {
        board: ['2c', '7d', '9s', 'Jh', 'Kd'],
        hero: ['As', 'Ks'],
        villainRange: [{ cards: ['As', 'Qd'], weight: 1 }] // heroと衝突して全滅
      }
    });
    assert.strictEqual(r.type, 'EQUITY');
    assert.strictEqual(r.data, null);
    assert.ok(/invalid EQUITY request/.test(r.reason), `reason: ${r.reason}`);
  });
})();

console.log('\n=== v3.9.54: flop/river-turnのcountフィールドの単位差を明文化する回帰テスト（他AIレビュー指摘）===');
test('computeEquity: river/turnのtotalWeightはvillainRangeのweight合計、flopのtotalWeightはMonte Carlo試行回数——単位が違うことを明示的に固定する', () => {
  const villainRange = [
    { cards: ['Qh', 'Qd'], weight: 1 },
    { cards: ['Ah', 'Ad'], weight: 3 }
  ];
  // river: totalWeightはweight合計(1+3=4)そのもの。
  const river = computeEquity({ hero: ['As', 'Ks'], board: ['2c', '7d', '9s', 'Jh', 'Kd'], villainRange });
  assert.strictEqual(river.precise, true);
  assert.strictEqual(river.totalWeight, 4);
  // turn: totalWeightはweight合計(4)×残りriver枚数(44) = 176。
  const turn = computeEquity({ hero: ['As', 'Ks'], board: ['2c', '7d', '9s', 'Jh'], villainRange });
  assert.strictEqual(turn.precise, true);
  assert.strictEqual(turn.totalWeight, 176);
  // flop: totalWeightはweight合計とは無関係に、Monte Carloのiterations数と一致する。
  const flop = computeEquity({ hero: ['As', 'Ks'], board: ['2c', '7d', '9s'], villainRange, iterations: 1234 });
  assert.strictEqual(flop.precise, false);
  assert.strictEqual(flop.totalWeight, 1234); // weight合計(4)ではなくiterations数
});

console.log('\n=== v3.9.51: computeEquity() ⑥-D（turn完全列挙）golden test ===');
test('computeEquity: クアッズ2ボード(2c,2d,2h,2s)turn、Hero=As,Qd — riverによってtie/winが分岐するケースを手計算と厳密照合', () => {
  // turnで既にクアッズ2完成。決着はキッカー（board外の最高カード）のみ。
  // HeroはAsを保持しているため、Villainが残り3枚のエース(Ah/Ac/Ad)の
  // いずれかを「ホールカードとして」持てば、riverが何であれ必ずtie。
  // Villainがエースを持たない場合は、riverでエースが出た瞬間だけ
  // （共有カードとして両者がアクセスできるため）tieに転じ、それ以外の
  // riverでは常にHeroの勝ち。lossは数学的に0通り（Heroのキッカーが
  // 既に最強のAのため、Villainが上回る手段が無い）。
  // 手計算: 総コンボ=C(46,2)=1035。うちエースを1枚以上持つ132コンボは
  // 全44river×tie=132*44=5808。エース非保持903コンボは、残り3枚の
  // エースがriverに来る3通りだけtie（903*3=2709）、残り41通りはwin
  // （903*41=37023）。tie合計=5808+2709=8517、win合計=37023、
  // total=1035*44=45540。
  const r = computeEquity({ hero: ['As', 'Qd'], board: ['2c', '2d', '2h', '2s'] });
  assert.strictEqual(r.totalWeight, 45540);
  assert.strictEqual(r.winCount, 37023);
  assert.strictEqual(r.tieCount, 8517);
  assert.strictEqual(r.lossCount, 0);
  assert.ok(Math.abs(r.equity - (37023 / 45540 + 8517 / 45540 * 0.5)) < 1e-9);
});

test('computeEquity: preflop(board.length<3)はHERO_RANKと同じ理由で非対応、明示的にエラー', () => {
  assert.throws(() => computeEquity({ hero: ['As', 'Ks'], board: [] }), /preflop/);
});

console.log('\n=== v3.9.53: computeEquity() ⑥-F（villainRange重み付きコンボ）golden test ===');

test('computeEquity: villainRange未指定時は既存の均等母集団（buildDefaultVillainCombos）と完全に同じ結果になる（回帰確認）', () => {
  const withDefault  = computeEquity({ hero: ['As', 'Qd'], board: ['2c', '2d', '2h', '2s', 'Kc'] });
  const deadSet       = new Set(['2c', '2d', '2h', '2s', 'Kc', 'As', 'Qd']);
  const explicitCombos = buildDefaultVillainCombos(deadSet).map(c => ({ cards: c.cards, weight: c.weight }));
  const withExplicit  = computeEquity({ hero: ['As', 'Qd'], board: ['2c', '2d', '2h', '2s', 'Kc'], villainRange: explicitCombos });
  assert.deepStrictEqual(withExplicit, withDefault);
});

test('computeEquity(river): villainRangeで明示的に2コンボ(weight=1均等)を指定すると、その2コンボだけの厳密な勝敗になる', () => {
  // Hero=As,Ks on board 2c,7d,9s,Jh,Kd（Heroはキング・ペア＋Aキッカー）。
  // Villain1=QhQd、Villain2=ThTcはいずれもHeroに劣るため両方Hero勝ちの
  // 自明ケースで、weight=1均等の動作を確認する。
  const r = computeEquity({
    hero: ['As', 'Ks'],
    board: ['2c', '7d', '9s', 'Jh', 'Kd'],
    villainRange: [
      { cards: ['Qh', 'Qd'], weight: 1 },
      { cards: ['Th', 'Tc'], weight: 1 }
    ]
  });
  assert.strictEqual(r.totalWeight, 2);
  assert.strictEqual(r.winCount, 2);
  assert.strictEqual(r.equity, 1);
});

test('computeEquity(river): weight=0のコンボは結果に一切影響しない', () => {
  const r = computeEquity({
    hero: ['As', 'Ks'],
    board: ['2c', '7d', '9s', 'Jh', 'Kd'],
    villainRange: [
      { cards: ['Qh', 'Qd'], weight: 1 },
      { cards: ['Ah', 'Ad'], weight: 0 } // Heroに勝つ手だがweight=0なので無視されるはず
    ]
  });
  assert.strictEqual(r.totalWeight, 1);
  assert.strictEqual(r.winCount, 1);
  assert.strictEqual(r.equity, 1); // weight=0のAhAd（本来なら負け要因）が無視され続けている
});

test('computeEquity(river): weight比1:2が実際に1:2の寄与になる', () => {
  // Villain1=QhQd（Hero勝ち）、Villain2=AhAd（Hero負け、AAがボードのK
  // ペアを上回る）をweight 1:2で指定。勝敗の重みがそのまま反映されるはず。
  const r = computeEquity({
    hero: ['As', 'Ks'],
    board: ['2c', '7d', '9s', 'Jh', 'Kd'],
    villainRange: [
      { cards: ['Qh', 'Qd'], weight: 1 },
      { cards: ['Ah', 'Ad'], weight: 2 }
    ]
  });
  assert.strictEqual(r.totalWeight, 3);
  assert.strictEqual(r.winCount, 1);
  assert.strictEqual(r.lossCount, 2);
  assert.ok(Math.abs(r.winProbability - (1 / 3)) < 1e-9);
});

test('computeEquity: Hero/boardと衝突するコンボは黙って除外され、残りの有効コンボだけで計算される', () => {
  const r = computeEquity({
    hero: ['As', 'Ks'],
    board: ['2c', '7d', '9s', 'Jh', 'Kd'],
    villainRange: [
      { cards: ['As', 'Qd'], weight: 1 }, // Asがhero自身のカードと衝突、除外されるはず
      { cards: ['Th', 'Tc'], weight: 1 }  // 有効
    ]
  });
  assert.strictEqual(r.totalWeight, 1); // 衝突コンボが除外され、有効な1コンボのみ残る
});

test('computeEquity: 全コンボがHero/boardと衝突して有効コンボが0件になった場合は明示的にエラー', () => {
  assert.throws(() => computeEquity({
    hero: ['As', 'Ks'],
    board: ['2c', '7d', '9s', 'Jh', 'Kd'],
    villainRange: [
      { cards: ['As', 'Qd'], weight: 1 }, // Asがheroと衝突
      { cards: ['Kd', 'Th'], weight: 1 }  // Kdがboardと衝突
    ]
  }), /no valid combos/);
});

test('computeEquity: 全コンボがweight=0の場合も明示的にエラー（加重サンプリング・集計が数学的に不能なため）', () => {
  assert.throws(() => computeEquity({
    hero: ['As', 'Ks'],
    board: ['2c', '7d', '9s', 'Jh', 'Kd'],
    villainRange: [{ cards: ['Qh', 'Qd'], weight: 0 }]
  }), /zero total weight/);
});

test('computeEquity(turn): villainRangeの重みがturnでも正しく反映される', () => {
  const r = computeEquity({
    hero: ['As', 'Ks'],
    board: ['2c', '7d', '9s', 'Jh'],
    villainRange: [
      { cards: ['Qh', 'Qd'], weight: 1 },
      { cards: ['Ah', 'Ad'], weight: 3 }
    ]
  });
  // turnはriverカード1枚（dead除外後の残り44枚）を完全列挙するため、
  // totalWeight = (1+3) * 44 = 176 になるはず。
  assert.strictEqual(r.totalWeight, 176);
});

test('computeEquity(flop): villainRangeの重みがMonte Carloの加重サンプリングに正しく反映される', () => {
  // Hero=2c,3d（ゴミ手）に対し、QQ・AAどちらのVillainも確実に上回るため、
  // Heroの勝率はほぼ0になるはず（統計的検証。厳密0ではなくバックドア等の
  // 極小確率は残るため閾値で判定する）。
  const r = computeEquity({
    hero: ['2c', '3d'],
    board: ['7h', '9s', 'Jc'],
    villainRange: [
      { cards: ['Qh', 'Qd'], weight: 1 },
      { cards: ['Ah', 'Ad'], weight: 9 }
    ],
    iterations: 20000
  });
  assert.strictEqual(r.totalWeight, 20000);
  assert.strictEqual(r.precise, false);
  assert.ok(r.winProbability < 0.05, `HeroがQQ/AA相手に想定外に勝ちすぎている: ${r.winProbability}`);
});

console.log('\n=== v3.9.49: FULL_HOUSE_BOARD分離（TRIPS_BOARDから独立、⑤対応）golden test ===');
test('classifyPairStructure: AAA22（フルハウスボード）はFULL_HOUSE_BOARDを返す', () => {
  assert.strictEqual(classifyPairStructure(['As', 'Ad', 'Ac', '2s', '2d']), 'FULL_HOUSE_BOARD');
});
test('classifyPairStructure: AAA27（純粋なトリップス、フルハウスではない）は引き続きTRIPS_BOARDのまま', () => {
  assert.strictEqual(classifyPairStructure(['As', 'Ad', 'Ac', '2s', '7d']), 'TRIPS_BOARD');
});
test('classifyPairStructure: AAAA2（クアッズ）は引き続きQUADS_BOARDのまま（このグループの対象外）', () => {
  assert.strictEqual(classifyPairStructure(['As', 'Ad', 'Ac', 'Ah', '2s']), 'QUADS_BOARD');
});
test('computeRangeAdvantage: フルハウスボードでもTRIPS_BOARDと同じ-0.12シフトを受ける（重み値は共用のまま分離）', () => {
  // 6s,6d,6c,2s,9d(TRIPS_BOARD)から5枚目だけ2dに変えてFULL_HOUSE_BOARD化すると、
  // rank/connectivity分類も連動して変わってしまうため定数比較で差分を厳密分離
  // するのは困難。ここでは実測値を直接固定する（このファイルの他のgolden test
  // と同じ方針）。値が変わった場合、-0.12シフト条件からFULL_HOUSE_BOARDが
  // 抜け落ちていないか、他の分類関数に変更が無いかをまず疑うこと。
  const adv = computeRangeAdvantage(['6s', '6d', '6c', '2s', '2d'], 'BTN', 'BB', []);
  assert.ok(Math.abs(adv - (-0.303076923076923)) < 1e-9, `実測値-0.303076923076923に対し実際は${adv}`);
});
test('deriveInterpretations: フルハウスボードでもNUT_REGION_POLARIZEDが引き続き発火する', () => {
  const r = analyzeBoard(['As', 'Ad', 'Ac', '2s', '2d'], {});
  assert.ok(r.interpretations.some(i => i.key === 'NUT_REGION_POLARIZED'), 'FULL_HOUSE_BOARDでもNUT_REGION_POLARIZEDが発火するはず（TRIPS_BOARDと同じ条件に追加済み）');
});
test('calcRangeDynamics/deriveAggressionSignal: フルハウスボードもisPaired/POLARIZE判定に含まれ続ける', () => {
  const r = analyzeBoard(['As', 'Ad', 'Ac', '2s', '2d'], {});
  assert.strictEqual(r.features.aggressionSignal === 'POLARIZE' || r.features.rangeDynamics !== undefined, true);
  // isPairedはrangeDynamics算出のboardModifier経由で間接的にしか見えないため、
  // ここではderiveAggressionSignal側のPOLARIZE分岐（より直接的）で確認する。
  assert.strictEqual(r.features.aggressionSignal, 'POLARIZE');
});

console.log('\n=== v3.9.48: hasComboDraw()に残っていた同一バグ（他AIによる2回目の独立監査で発見）===');
test('hasComboDraw: ペア66×3-flushフロップ(5s,7s,8s)でストレートドロー+本物のFD=combo drawとしてtrue', () => {
  // v3.9.47の修正はclassifyDraw/classifyPotentialのみで、drawOverlap専用の
  // 独自フラッシュ判定を持つhasComboDraw()には波及していなかった（他AIによる
  // 2回目の独立監査で指摘）。board(5s,7s,8s)は3-flush(board3+ペア1枚=4枚、
  // 本物のFD)かつ66にとってOESD/GSD相当のストレートドローも存在するため、
  // 修正後は正しくtrueになるはず。
  assert.strictEqual(hasComboDraw('66', ['5s', '7s', '8s']), true);
});
test('hasComboDraw: ペア66×2-toneフロップ(5s,7d,8s)は本物のFDではない（backdoorはコンボドローに含めない）ためfalse', () => {
  assert.strictEqual(hasComboDraw('66', ['5s', '7d', '8s']), false);
});

console.log('\n=== v3.9.46: canonical source統合（本番Blob bundleとの5件のドリフト解消）golden test ===');

test('POSITION_PROFILE: UTG1/UTG2/LJ（9-max対応、v3.9.8）がcore側にも存在する', () => {
  assert.ok(getPositionProfile('UTG1'), 'core/position.jsに欠落していたUTG1が復元されているはず');
  assert.ok(getPositionProfile('UTG2'), 'core/position.jsに欠落していたUTG2が復元されているはず');
  assert.ok(getPositionProfile('LJ'), 'core/position.jsに欠落していたLJが復元されているはず');
  assert.strictEqual(getPositionProfile('UTG1').label, 'UTG+1');
});

test('computeMadeStrength: 係数0.03→0.10（v3.9.12、本番Blob bundleでは既に適用済みだったがcoreだけ0.03のまま放置されていた）', () => {
  // 778.3盤面（ペア・コネクテッド）でのhaz込みペナルティを実測固定。
  // 0.03のままなら 0.5 - (haz*0.03*0.5) ≈ 0.4977、0.10なら0.4925。
  const v = computeMadeStrength(0.5, ['7s', '7h', '8d']);
  assert.ok(Math.abs(v - 0.4925) < 1e-9, `0.10係数での期待値0.4925に対し実際は${v}`);
});

test('deriveInterpretations: FIVE_FLUSH（5枚同スートのriverボード）でもFLUSH_COMPLETED_BOARDが発火する（v3.9.32のFIVE_FLUSH判定追加がcore側で見落とされていた）', () => {
  const r = analyzeBoard(['2s', '5s', '9s', 'Ks', '7s'], {});
  assert.strictEqual(r.features.flushPressure, 'FIVE_FLUSH');
  assert.ok(r.interpretations.some(i => i.key === 'FLUSH_COMPLETED_BOARD'), 'FIVE_FLUSHでもFLUSH_COMPLETED_BOARDが発火するはず（FOUR_FLUSHのみのチェックだと見落とす）');
});

test('analyzeBoard: computeStructureFeatures()にboard引数が渡り、drawOverlapが機能する（渡っていないとdrawStructureのdrawOverlap寄与が常に0になる）', () => {
  // v3.9.47修正: 他AIによる独立監査で指摘。旧テスト(9d-Ts-Jc-Qh)は4スートが
  // バラバラの完全レインボーで、hasComboDrawのフラッシュ側条件が全ハンドで
  // falseになりdrawOverlapが構造上常に0になる盤面だったため、board引数を
  // 渡しても渡さなくても結果が同一(=62)になり、テストの目的（board引数の
  // 有無で結果が変わることの確認）を一度も証明していなかった。
  // 9s-Ts-Jc-2dはスート2枚(9s,Ts)を含みコンボドローが実際に発生するため、
  // board引数の有無で drawStructure が 63(あり) vs 59(なし) と分岐する
  // （v3.9.48でhasComboDraw()のペア閾値バグを修正した際に64→63へ変化。
  // ペア絡みの偽陽性コンボドローが1件減った分の妥当な変化）。
  const r = analyzeBoard(['9s', 'Ts', 'Jc', '2d'], {});
  assert.strictEqual(r.structureFeatures.drawStructure, 63);
});

console.log(`\n${pass} passed, ${fail} failed`);

// v3.9.47: 他AIによる独立監査の指摘（テストと`--check`が非束縛で、テストが
// 通ってもindex.htmlの生成物が同期している保証がなかった）を受けて追加。
// core/*.jsのテストが全通過しても、tools/build-worker-bundle.js --checkが
// 失敗する状態（index.html未再生成）ではCI的には失敗として扱う。
const { execFileSync } = require('child_process');
let checkOk = true;
try {
  execFileSync('node', [path.join(__dirname, '..', 'tools', 'build-worker-bundle.js'), '--check'], { stdio: 'inherit' });
} catch (e) {
  checkOk = false;
}

process.exit((fail > 0 || !checkOk) ? 1 : 0);
