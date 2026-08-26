# SPECTRA v3.9.1 — Board Intelligence OS

テキサスホールデムのボードテクスチャ・レンジ構造・戦況を解析するポーカー分析ツール。

**設計思想：** 意思決定エンジンではない。「今どんな戦況か」を可視化する認知支援OS。  
Fold/Call/Raise の推奨・GTOアクション・EV比較は**提示しない**。

---

## ファイル構成

```
index.html                  ← UI本体（単一ファイル）
spectra-worker.js            ← Worker エントリーポイント（API窓口のみ）
core/
  utils.js                  ← 定数・ユーティリティ関数
  texture.js                ← ボードテクスチャ分類
  position.js               ← ポジションプロファイル・アーキタイプ
  strength.js               ← ハンド強度評価エンジン
  range_matrix.js           ← 169ハンド評価・ドロー分類・レンジ統計
  board_intel.js            ← ボードフィーチャー抽出・アグレッションシグナル
  interpretations.js        ← 意味付けエンジン（Interpretation生成）
  narrative.js              ← Narrative生成・HUD計算
  board_intelligence.js     ← オーケストレーター（analyzeBoard）
```

### importScripts 読込順（依存グラフ順）

```
utils → texture → position → strength → range_matrix
  → board_intel → interpretations → narrative → board_intelligence
```

---

## Worker API

### Primary: `BOARD_INTELLIGENCE`

```js
// 送信
spectraWorker.postMessage({
  type: 'BOARD_INTELLIGENCE',
  payload: {
    board: ['Ah', '7d', '2c'],          // 3〜5枚
    context: {
      street: 'FLOP',
      heroPos: 'BTN',
      villainPos: 'BB',
      archetype: 'STANDARD',
      profile: 'BTN_VS_BB'
    }
  }
});

// 受信
{
  type: 'BOARD_INTELLIGENCE',
  data: {
    street,
    features,         // ボード特性（texture / connectivity / etc）
    metrics,          // 数値メトリクス
    interpretations,  // { key, score, confidence, importance, narrativeRank }[]
    narrative,        // string[] 最大3行
    hudSignals,       // { attack, value, bluff, capped }  各0-1
    rangeMatrix       // evalRange169 の出力（169ハンド分）
  },
  cached: boolean,
  calcTime: number    // ms
}
```

### Legacy (後方互換)

| type | 用途 |
|------|------|
| `EVAL_169` | 169ハンドのrawScore/density等 |
| `TEXTURE` | ボードテクスチャのみ |

---

## データモデル

### rangeMatrix アイテム

```ts
{
  hand:              string   // "AA" | "AKs" | "KAo"
  bestCombo:         string   // "AhKh" — 最高スコアを出した具体コンボ
  rawScore:          number   // 0-1 (madeStrength + potential補正済み)
  madeStrength:      number   // 0-1 現在の役の強さ（boardHazard補正付き）
  potentialStrength: number   // 0-1 将来の伸び代（ドロー・アウツベース）
  potential:         number   // potentialStrengthのalias
  density:           number   // 0-1 生存コンボ率（0=デッドコンボ）
  class:             string   // NUTS / TOP_PAIR_PLUS / MIDDLE_PAIR / WEAK_PAIR / AIR
  handName:          string   // THREE OF A KIND / FLUSH etc.
  drawType:          string   // FD / OESD / GSD / BD-FD / null
  outs:              number   // potentialStrength * 20 の近似
}
```

### features オブジェクト

```ts
{
  texture:          'VERY_DRY' | 'DRY' | 'SEMI-WET' | 'WET' | 'VERY_WET'
  connectivity:     'DISCONNECTED' | 'LOW_CONNECTED' | 'CONNECTED' | 'HIGHLY_CONNECTED'
  flushPressure:    'RAINBOW' | 'TWO_FLUSH' | 'THREE_FLUSH' | 'FOUR_FLUSH' | 'FIVE_FLUSH'
  pairStructure:    'UNPAIRED' | 'PAIRED' | 'DOUBLE_PAIRED' | 'TRIPS_BOARD'
                  | 'FULL_HOUSE_BOARD' | 'QUADS_BOARD'
  rankStructure:    'LOW' | 'MIXED' | 'HIGH'
  rangeDynamics:    'RANGE_ADV_HERO' | 'NEUTRAL' | 'RANGE_ADV_VILLAIN'
  nutDynamics:      'NUT_ADV_HERO' | 'NEUTRAL' | 'NUT_ADV_VILLAIN'
  aggressionSignal: 'ATTACK' | 'CAUTION' | 'DEFEND' | 'POLARIZE' | 'NEUTRAL'
  rangeAdvantage:   number   // -1..+1
  nutAdvantage:     { advantage, density, coverage }
  rangeStats:       { madeAvg, potAvg, drawHeavy, madeSpread }
  wetnessScore:     number   // 0-100
  connectivityScore: number  // 0-100
  flushScore:       number   // 0-100
}
```

### Interpretation アイテム

```ts
{
  key:           string   // "HIGH_CARD_LEVERAGE" etc.
  score:         number   // 0-1 盤面がこのInterpretationをどれだけ示唆するか
  confidence:    number   // 0-1 根拠の厚み（coverage×0.7 + depth×0.3）
  importance:    number   // 0-1 プレイヤーが知る価値（静的定数）
  narrativeRank: number   // score × confidence × importance（Narrative選択に使用）
}
```

### HUD Signals

```ts
{
  attack: number   // 0-1 攻撃的なアクションの有効性
  value:  number   // 0-1 バリューベットの有効性
  bluff:  number   // 0-1 ブラフの有効性
  capped: number   // 0-1 レンジがcappedになっている度合い
}
// HUD = score × confidence（importance は乗じない、盤面実態優先）
// Narrative = score × confidence × importance（人間への伝達価値優先）
```

---

## ハンド強度スコア体系（rawScore 0-1）

| 役 | スコア帯 | 上限 (band ceiling) |
|---|---|---|
| Royal Flush | 1.00 | 1.000 |
| Straight Flush | 0.90〜0.99 | 1.000 |
| Four of a Kind | 0.80〜0.89 | 0.895 |
| Full House | 0.70〜0.79 | 0.795 |
| Flush | 0.58〜0.67 | 0.675 |
| Straight | 0.47〜0.57 | 0.575 |
| Three of a Kind | 0.38〜0.46 | 0.465 |
| Two Pair | 0.26〜0.37 | 0.375 |
| One Pair | 0.10〜0.25 | 0.255 |
| High Card | 0.00〜0.09 | 0.095 |

**board ceiling 修正（v3.6）:** `boardAdjustment`がカテゴリ上限を超えないようclamp済み。  
例: QuadsにboardAdjustment +0.12が加わっても0.895で止まり、Royal帯(0.90+)に侵入しない。

---

## Interpretation カタログ

| Key | Category | importance | 発火条件 |
|-----|----------|-----------|---------|
| MAX_DRAW_PRESSURE | DRAW | 0.85 | texture=VERY_WET |
| HIGH_DRAW_PRESSURE | DRAW | 0.70 | texture=WET |
| LOW_DRAW_PRESSURE | DRAW | 0.30 | texture=DRY |
| FLUSH_THREAT_ACTIVE | DRAW | 0.80 | THREE_FLUSH |
| FLUSH_COMPLETED_BOARD | DRAW | 0.90 | FOUR/FIVE_FLUSH |
| STRAIGHT_THREAT_ACTIVE | DRAW | 0.75 | HIGHLY_CONNECTED |
| MULTI_DRAW_BOARD | DRAW | 0.80 | CONNECTED + TWO_FLUSH |
| NUT_REGION_NARROW | NUT | 0.80 | DOUBLE_PAIRED |
| NUT_REGION_POLARIZED | NUT | 0.85 | TRIPS/FULL_HOUSE_BOARD |
| BOARD_LOCKED | NUT | 0.85 | QUADS_BOARD |
| HIGH_CARD_LEVERAGE | RANGE | 0.95 | rankStructure=HIGH + RANGE_ADV_HERO |
| LOW_BOARD_DEFENDER_EDGE | RANGE | 0.75 | rankStructure=LOW + RANGE_ADV_VILLAIN |
| DRAW_HEAVY_RANGE | RANGE | 0.75 | rangeStats.drawHeavy > 50% |
| MADE_STRENGTH_DOMINANT | RANGE | 0.80 | drawHeavy < 20% + madeAvg > 0.18 |
| BTN_FAVORS_AGGRESSION | SIGNAL | 0.85 | aggressionSignal=ATTACK |
| AGGRESSION_REQUIRES_DISCIPLINE | SIGNAL | 0.70 | aggressionSignal=CAUTION |
| DEFENDER_CAN_RESIST | SIGNAL | 0.65 | aggressionSignal=DEFEND |
| VALUE_BETTING_POLARIZED | SIGNAL | 0.80 | aggressionSignal=POLARIZE |

### Narrative Budget（最大3行）

1. `narrativeRank` 降順でソート
2. `score >= 0.50` AND `confidence >= 0.40` のフロア
3. カテゴリ多様性（DRAW/NUT/RANGE/SIGNALから各最大1件）
4. `enrichNarrativeLine()` で `rangeStats` の定量値を文言に付加

---

## Position Matrix

5×6グリッド（Hero行 × Villain列）で、ボードを加えたレンジ優位を可視化。

- **色:** 赤系=Hero有利、青系=Villain有利、グレー=中立
- **クリック:** セルをクリックでHero/Villain Positionを切り替え、即再計算
- **ボード補正:** `baseAdv × 0.5 + lastRangeAdv × 0.5` でWorker値を反映

```
Hero Positions (rows):  UTG / HJ / CO / BTN / SB
Villain Positions (cols): UTG / HJ / CO / BTN / SB / BB
```

---

## UIパネル構成（デスクトップ 3カラム）

```
LEFT (200px)        CENTER (1fr)         RIGHT (220px)
─────────────       ──────────────       ──────────────
Board Input         Situation Badge      Position Matrix
Hero Hand           Board Cards          Structure Radar (5軸)
NUTS Table          3D Heatmap           Board Texture
(全ストリート共通)   HUD Signals          Board Intelligence
                                          (Board Diagnostics)
```

**v3.6.1 変更:** リバー専用の「River Polar View（PURE VALUE / BLUFF CATCH / BLUFF・FOLD 3分割）」は廃止。
リバーもFLOP/TURNと同じ役ごとのコンボ%分布リスト（NUTS Table）をそのまま継続表示する
（`renderNuts()` 内の `isRiver` フラグは恒久的に `false` 固定）。

モバイルはタブ切替（BOARD / HEAT / INTEL）。

---

## 既知の制限・設計上の割り切り

- **classifyPotential** は169ハンド単位（スート抽象）。具体コンボごとの精密なドロー判定はしない
- **bestCombo** のフラッシュドロースート優先はタイブレーク（同スコア時のみ）
- **ストレートドロー判定** に Ace の low/high 両形（A-2-3-4-5）対応済み（v3.6 diff）
- **QUADS_BOARDのコネクティビティ** は強制的に`DISCONNECTED`扱い（v3.6 diff）
- **GTO/Solver系の計算は一切しない**（設計方針）
- **topClassCombos（v3.7〜）** は「169ハンド表記の中で最高カテゴリに到達したコンボ」のみを数える設計上、残りのコンボが別カテゴリ（例: 一部はストレート、一部はフラッシュ）でも表からは見えなくなる。NUTSテーブルを見た際「このハンドはこの盤面でほぼ全部○○寄りなんだ」という誤解を招きうる（バグではなく169セル＝1行という構造上の制約）
- **Worker応答の`requestId`照合は実装済み**（v3.9.13〜）。`index.html`側は`currentRequestId`をインクリメントして送信し、受信時に一致しないstale responseは破棄している（他AIレビューで本READMEの旧記述「未実装」との乖離を指摘され修正）
- **Worker障害時のfallbackキャッシュキーがcontext非対応**。`evalCache`（Worker内）はboard+heroPos+villainPos+archetype+profileをキーにしているが、fallback側（index.html内の簡易評価エンジン）のキャッシュキーはボードのみで、ポジション/archetype変更が反映されない可能性がある。Worker正常時は影響しない（fallback発動時のみ）
- **v3.9.26: 他AIレビューで指摘・検証済み。** `computeRangeDrawPct()`のUI表示ラベルが「169ハンド平均」となっていたが、実装は169カテゴリの均等平均ではなく、ボード/ヒーローとかぶらない具体的コンボ（最大1326通り）単位の加重平均だった（計算式は妥当、ラベルが不正確だった）→ラベルとツールチップを「全1326コンボ平均」に修正、計算自体は変更なし。あわせて`computeRangeDrawPct()`に直前1回分の(board,heroHand)キー付きキャッシュを追加し、Hero選択の中間状態や盤面再描画のたびに1326コンボ全走査が毎回走っていた無駄な再計算を削減。それ以外の指摘（Hero→`updateBoardCards()`のdraw glow参照、`heroVs3betDecisionPct()`のFOLD92%固定値、ATTACK WINDOW等の断定的表現）は設計判断が絡むため未対応・要相談として保留
- **v3.9.27: 上記の保留分もユーザー確認の上で対応済み。** ①`updateBoardCards()`本体からheroHand参照を完全に除去し、Hero固有の装飾（draw glow・hero-cardクラス）を`applyHeroCardOverlay()`として分離（Hero Hand削除時はこの関数と呼び出し1行を消すだけでよい構造に）。②`heroVs3betDecisionPct()`のレンジ外フォールバックだった固定値「FOLD 92% / CALL 6% / RAISE 2%」（根拠のない疑似戦略頻度）を廃止し、`{outsideRange:true}`という分類結果のみを返す形に変更。UI側も3本のバーではなく「推定3BETレンジ外」という単一表示に変更。③ATTACK WINDOW/DEFEND等のバッジ・カテゴリー名自体は識別ラベルとして維持しつつ、その下に添える短文（TACTIC_SHORT・sub文言）と、STRUCTURE RADARの「攻勢チャンス→攻勢傾向」「バリュー密度→バリュー構造」「ブラフ有効度→ブラフ余地」を含む説明文を、断定的な行動指示（〜すべき/〜が有効）から傾向を示す表現（〜を検討しやすい等）に統一。TACTICAL INSIGHTS（generateTacticalInsights、Overbet等の具体的サイジング文言を含む別機能）は今回のスコープ外として未着手

---

## テスト

`tests/engine.test.js` — Node標準の`assert`のみで書かれたリグレッションテストスイート（フレームワーク不使用）。
`core/*.js`をWorkerと同じ読込順で結合してevalし、実際のWorker挙動をそのまま再現してテストする。

```bash
node tests/engine.test.js
```

配置は `tests/` を `core/` と同じ階層（リポジトリルート）に置く想定：

```
index.html
spectra-worker.js
core/
  utils.js ...
tests/
  engine.test.js
```

現在27ケース。主な内容：

- 役判定（ロイヤル取り逃がし・ホイール境界6パターン・トリップス誤認 など、このセッションで発見・修正したバグの再発防止）
- 同一カテゴリ内のキッカー比較（フルハウス下位ペア・クアッズ/トリップス/ワンペアのキッカー・フラッシュの質、6件）
- ストレート/ストレートフラッシュの最高位カード順序（v3.7.5でpokersolver突き合わせにより発覚したバグの再発防止、3件）
- 169マトリクス・ドロー分類（フラッシュ完成済みハンドの二重カウント、topClassCombos、デッドコンボ除外）
- Nut Dynamics（`context.heroPos`/`context.villainPos`を正しく見ているか）
- 統合テスト（`analyzeBoard()`が例外なく動くか）

**注意:** これは`detectHandCategory()`/`scoreHandCategory()`の**回帰防止**テストであり、単体では
役判定ロジックそのものの網羅的な正しさを保証しない。ただしv3.7.5で下記の独立実装との突き合わせ検証を
実施し、大規模なランダム試行で完全一致を確認済み（詳細は次項）。

---

## 検証方法: pokersolver（独立実装）との突き合わせ

役判定・キッカー比較の信頼性を検証するため、npmの`pokersolver`（本リポジトリとは独立に実装された
ポーカー役評価ライブラリ）と結果を突き合わせるスクリプト（`crossval.js`。**リポジトリ本体には含まれない
検証専用ツール**）を用意し、以下2つの軸で検証した。

1. **カテゴリ一致率** — ランダムな7枚に対して役の種類が一致するか
2. **勝敗順序一致率** — 同一ボード上で2組のホールカードを比較したとき、pokersolverの
   `Hand.winners()`（引き分け対応）と自作スコアの大小比較が一致するか
   （キッカー比較の正しさを直接検証できる）

実行方法（要`npm install pokersolver`。開発時のみの依存で、本番のindex.html/Workerには一切影響しない）:

```bash
npm install pokersolver
node crossval.js
```

**v3.7.5時点の結果:**

| 検証項目 | 試行回数 | 一致率 |
|---|---|---|
| ランダム7枚のカテゴリ一致 | 20,000 | 100.0000% |
| ランダム対決の勝敗順序一致 | 20,000 | 100.0000% |
| 固定エッジケース（ロイヤル・ホイール等） | 6 | 6/6 |

2回の独立試行（異なる乱数シード）で同じ結果を再現済み。この検証によって、以前は固定ボーナスによる
`bandCeiling`クランプでマスクされていた「ストレート/ストレートフラッシュの最高位カード取り違え」
という重大なバグが発見・修正された（v3.7.5の変更履歴を参照）。

---

## 開発履歴（フェーズ）

| Phase | 内容 |
|-------|------|
| P0 | classifyDraw/classifyPotential のスートバグ修正 |
| P1-A | Interpretation Confidence Layer（score/confidence/importance/narrativeRank） |
| P1-B | evaluate7 の5枚評価問題、madeStrength/potentialStrength 分離 |
| P1-C | equity/pct/rc/score の legacy フィールド削除、rawScore 一本化 |
| P1-D | rangeStats 導入、Narrative への made/potential 接続 |
| P1.5 | BOARD_INTELLIGENCE API 統一（4回→1回 postMessage） |
| P2-A | 1800行モノリス → 9モジュール分割（importScripts構成） |
| P2-B | bestCombo 追跡、Narrative 定量化、band ceiling 修正、デッドコンボ黒化 |
| P2-C | **strength.js**: Royal/Straight Flushのスコア算出バグ修正（flushSuit以外のカードが混ざると誤判定していた `sfHigh` を、flushSuit限定の計算に変更）。あわせて `computeBoardInteraction` のロイヤルボーナス判定も同様に修正 |
| P2-D | UI: リバー専用「River Polar View」廃止、NUTS Tableを全ストリート共通に統一。Structure Radar（5軸）に目盛り視認性向上＋英語凡例（ENT/POL/COV/DRW/DOM フルネーム）を追加 |
| P2-E | **range_matrix.js**: `classifyPotential`/`classifyDraw` の二重計上バグ修正。既に完成済みのストレート（ホイール含む）・フラッシュに対して、追加でドローの伸びしろ(OESD/GSD/FD)を加算してしまい、最終スコアが本来の役の上限を飛び越えて別カテゴリ扱いされる不具合を修正 |
| P2-F | **strength.js**: ①ホイール(A-2-3-4-5)がストレート帯の下限を割り込みTHREE OF A KIND扱いになる境界バグを床clampで修正 ②同スートが6枚以上連続する盤面（4-flushボード等）で、最強のストレートフラッシュ（ロイヤル含む）に辿り着く前に弱い窓で判定が停止していたループ方向バグを昇順探索に修正 ③`getHandName`にROYAL FLUSH区分(閾値0.955)を追加 |
| P2-G | **NUTS Table 拡張**: CURRENT NUTS要約行（具体スート表示）、コンボ実数併記、ドロー重複タグ（種類+アウツ概算）、帯の折りたたみ、suited/offsuit統合表示（例: 「AT s/o」）、FLUSH帯のボード基準チョップ判定（ボード超え/以下の2分割）を追加 |
| P2-H | **可読性・初心者向けパス**: NUTSパネルのチップ・ラベル類のフォントサイズ全体的に底上げ。ドロータグ・HUDシグナル・各パネル見出しに日本語ツールチップ（title属性）を追加。レーダー目盛りを白系に変更しレーダースコープ風の見た目に。未使用だった`nuts-sec-label`要素を実装（従来HTML未実装でJSからの書き込みが無効化されていた） |
| P2-I | **range_matrix.js**: `eval169`のコンボ数カウントバグ修正。同じ169ハンド内の4通り(suited)/12通り(offsuit)のコンボは`rawEval7 = Math.max(...scores)`で代表スコアを決めているが、コンボ数(`activeCombos`)はカードのブロック有無だけで数えており「代表スコアと同じ役に到達したコンボ数」ではなかった。通常は問題にならないが、ボードに濃いフラッシュ（3+同スート等）がある場合、スーテッド4通りのうち実際にボードと同スートが揃うのは1通りだけ、という非対称が起きる（例: 4-flushボード+スーテッドハンド=ロイヤルは実質1コンボしかないのに、NUTSテーブルには「Live: 4」と誤表示されていた）。新たに`topClassCombos`（代表スコアと同じ役名(getHandName)に到達したコンボ数のみ）を計算し、NUTSテーブルのLive Combo表示はこちらを優先するように修正 |
| P2-J | **外部レビュー対応**: (1) `board_intel.js`の`classifyNutDynamics`が`context.positions === 'BTN_VS_BB'`という、実際のUI呼び出しでは存在しないフィールドを見ていたバグを修正（`context.heroPos === 'BTN' && context.villainPos === 'BB'`に変更）。実運用では常にfalse側に倒れ、ポジションに関わらずNUT_ADV_VILLAIN固定/NEUTRAL固定になっていた。(2) `utils.js`の`evalCache`が無制限に増え続ける可能性があったため、`cacheSet()`ヘルパーを追加しFIFOで上限500件に制限。(3) バージョン表記の混在（index.html内`v3.0 BATTLE OS`、worker内`3.6`、README`3.6.1`）を`v3.7`に統一 |
| P2-K | **リグレッション修正（P2-I由来）**: `calc3DHSL()`と`render3DHeatmap()`が`item.activeCombos`を参照していたが、これはUI側のrangeMatrixには元々存在しないフィールド（`density`という比率のみが渡っていた）。以前は`item.totalCombos`も同様に存在しなかったため`tc>0`判定が常にfalseとなりデフォルト値にフォールバックして「たまたま」正常に見えていたが、P2-Iで`totalCombos`をUIに渡すよう変更した際にこの副作用が表面化し、ヒートマップの彩度が常に最低（`0/tc=0`）になる、`data-den`ツールチップがNaNになる、という2つのリグレッションを引き起こしていた。両箇所とも既存の`item.density`（正しく計算済みの比率）を直接使うように修正 |
| **v3.7** | **設計リファクタ: 役判定とスコアリングの分離**（外部レビュー指摘への対応）。以前の`evaluate7()`は「役判定」と「連続値スコアリング（ボード補正・キッカー補正込み）」を1つの関数内で混在させており、これがこのセッション中に見つかった一連のバグ（ロイヤルフラッシュ取り逃がし、ホイールがカテゴリ閾値を割り込む、トリップスがストレート名で表示される等）の共通原因だった——いずれも「最終的な連続値スコアから`getHandName()`で役名を逆算する」設計が引き金。`strength.js`を`detectHandCategory(cards)`（純粋な役判定、スコアなし）と`scoreHandCategory(cat, cards)`（判定済みカテゴリに対する連続値スコア計算）に分離し、`evaluate7(cards)`は`{ score, category, categoryName }`を返すオーケストレーターに変更。`range_matrix.js`の`eval169()`は数値スコア配列から`Math.max()`で最高値を取って`getHandName()`で逆算する方式をやめ、判定済みオブジェクトの中から最高スコアのものを選んでその`category`をそのまま使う方式に変更（`topClassCombos`の比較も同様に、数値の逆算ではなく`category`の直接比較に変更）。`getHandName()`は使用箇所がなくなったためレガシー関数としてコメントを付けて残置。既存の全リグレッションテスト（Royal/SF判定、ホイール境界、トリップス誤認、コンボ数バグ、Nut Dynamics）は全て同じ結果を維持することを確認済み——動作は変えず、構造だけを直した。**なお、この分離が防ぐのは「スコア補正による役名の食い違い」のみで、`detectHandCategory()`自体の役判定ロジックの誤りまでは防げない**（外部レビューでの指摘通り、別問題として残る） |
| **v3.7 追補** | 外部レビュー指摘への追加対応。(1) `category`を生の文字列リテラル(`'ROYAL_FLUSH'`等)で直接書くとタイポに気づきにくいため、`HAND_CATEGORY`定数オブジェクトを導入し`HAND_CATEGORY.ROYAL_FLUSH`のように参照するよう統一。(2) このセッション中に書き溜めたアドホックな検証コードを`tests/engine.test.js`として正式なリグレッションテストスイートに整理（フレームワーク不使用、Node標準の`assert`のみ。`node tests/engine.test.js`で実行。18ケース、詳細は「テスト」節を参照） |
| **v3.7.2** | **UIフィードバック一括対応。** (1) CURRENT NUTS表示を廃止（同点最強ハンドが複数ある場合に1つしか出せず実態と合わない上、一番上の帯を見れば分かるため冗長というフィードバックにより）。(2) ヒートマップ彩度バグ修正: 従来はdensity(0-1)にほぼ線形で彩度を決めていたため、ボードに同ランクが2枚出ていて残りコンボが少ないケース（例: board上にA2枚出ている状態でのAA=クアッズ最有力）で、Hueは正しく赤なのに彩度不足で色が消えたように見えていた。density===0（本当にデッド）の時だけ灰色寄りにし、生きてさえいれば希少度に関わらずしっかり彩度を持たせるよう変更。(3) Structure RadarのCOVERAGE軸が常にほぼ100固定だったバグ修正: 「169ハンドのうち生存コンボが1つでもあるか」という二値的な数え方だったため、同ランクが3枚以上出るような極端なボード以外では常に100近辺になっていた。169ハンド全体の平均densityに変更し、ストリートの進行（カード消費量）を連続的に反映するようにした（ただし同一ストリート内でのテクスチャ差にはあまり反応しない、という設計上の限界は残る）。(4) CLEAR ALLボタンが個別クリア(`clearSlot`)と同じ完全リセットをしておらず、スート選択時の枠線色・背景色・クリアボタンの見た目が残ってしまうバグを修正。(5) 将来のカメラ撮影機能用に確保されていたプレースホルダー（ポーカーテーブルのグラフィック、`camStream`変数含む）を削除——実装されたことのない未使用の飾りだったため、中央パネルの空きスペースをBOARD INPUTエリアが埋めるようにした。(6) HERO HAND / HERO OUTSパネルをコメントアウト（実装は削除せず残置。復活させる場合は該当HTMLコメントを外し、`buildHeroSelects();`のコメントも外すだけでよい）。`updateOutsPanel()`にnullガードを追加し、対象要素が無くても他の`updateHeroCells()`呼び出し元（5箇所）が壊れないようにした。(7) 各セクション見出しの隣に「？」ヘルプバッジ（`.help-q`）を追加。既存の`title`ツールチップはホバーしないと存在に気づけず「右側の分析要素が何なのか分からない」というフィードバックがあったため、視覚的に目立つマークを常設した（対象: RANGE PROFILE / POSITION MATRIX / STRUCTURE RADAR / BOARD INTELLIGENCE / 3D HEATMAP / HAND DISTRIBUTION） |
| **v3.7.3** | **ヒートマップ色相(Hue)バグ修正。** 以前は`hue = (1 - eq/100) × 180`と、強さ(eq 0-100%)に対して線形にHueを割り当てていた。これだと実際にはかなり強いハンド（例: 4s/5d/5sボードでの55=クアッズ最有力、eq≈82%）でもhueが32°程度にしかならず、赤というより黄土色/オレンジ寄りの中途半端な色になり、「勝っているハンドなのに負けているように見える」というフィードバックがあった。線形だと強さ全体が0-180°に均等配分されるため、"本当に強い"部類（トリップス以上）が使える"赤"の面積が狭すぎたのが原因。べき乗カーブ(`Math.pow(eq/100, 0.4)`)でeqを圧縮し、強いハンドほど急激に赤(hue低)へ寄せるよう変更（eq=82%→hue≈14°、eq=50%→hue≈44°、eq=20%→hue≈85°）。弱いハンドは引き続き黄〜緑〜シアンに広く分布する |
| **v3.7.4** | **外部レビュー対応・第2弾。** (1) **同一カテゴリ内のキッカー比較バグ修正（★重大）**: 以前はフルハウスの下位ペア(KK/QQ/33/44)やクアッズのキッカー(AK/J9)が完全に同点になっていた（`secondaryRank`を保持していたのに未使用、クアッズ・トリップス・ワンペア・フラッシュも同様にキッカー未考慮）。`strength.js`に`kickerFraction()`（base-13位取り記数法によるランク列の分数エンコード）を追加し、FULL_HOUSE/FLUSH/THREE_OF_A_KIND/TWO_PAIR/ONE_PAIR/FOUR_OF_A_KIND/HIGH_CARDの各カテゴリでキッカーを正しく比較するよう修正。あわせて、`computeBoardInteraction()`内の「ワンペアのキッカー加算」ロジック（`count===1`のカードをrank昇順ソートして先頭を取るだけの実装で、実質「盤面の一番強いカード」を常に拾ってしまいホールカードの実際のキッカーを無視していた）を削除し、クアッズの「+0.06固定ボーナス」（カテゴリ内の全ハンドに一律加算されるだけで、ほとんどのクアッズをbandCeilingに張り付かせてキッカー差を消していた）も削除。テストケースを6件追加（計24件、`tests/engine.test.js`）。(2) **ヒートマップHueの二重反映バグ修正**: 以前はHue(色相)の元になる`rawScore`に既に`potentialStrength`（ドローの伸びしろ）が加算済みで、Lightness(明度)側でも同じpotentialをもう一度使っており、「今はまだ弱いがドローが強いハンド」がHueの段階で赤寄りに見えてしまっていた。Hueは`madeStrength`（現在の強さのみ）を使うよう変更し、potentialはLightness側だけで表現する設計に統一。ツールチップのSTRENGTH欄も同様に修正（以前はrawScore表示でPOTENTIAL欄と情報が重複していた）。凡例の不明瞭な「FLEX」表記を「将来性」に変更。(3) `bi-toggle`のstyle属性内で`display:none`と`display:flex`が両方指定されており後勝ちで前者が無意味化していた不要コードを削除。(4) `clearBoard()`後も`lastHeatmapData`/`lastNutsFeatures`が保持されたままだった点を修正（実害は無いが将来の再描画機能追加時のstale state対策）。(5) モバイルのセルタップ時のツールチップ自動非表示`setTimeout`がキャンセルされずに積み上がり、連続タップで新しいツールチップが古いタイマーに消される可能性があったバグを修正 |
| **v3.7.5** | **pokersolver（npm・独立実装のポーカー評価ライブラリ）との突き合わせ検証、およびそこで発覚した2つの重大バグの修正。** 役判定の信頼性に対する懸念を受け、`crossval.js`（このリポジトリ本体には含めていない検証専用スクリプト）でランダム7枚2万件のカテゴリ一致率、ランダムなボード+2ホール対決2万件の勝敗順序一致率を検証した。その過程で以下2点の重大バグが発覚し修正した。**(1) ストレート/ストレートフラッシュの最高位カード取り違えバグ（★最重大）**: `detectHandCategory()`のストレート窓検出で、5枚連続ウィンドウの「終端（最弱カード）」を最高位カードとして使ってしまっていた（本来使うべきは「開始点（最強カード）」）。この結果、同じSTRAIGHT/STRAIGHT_FLUSHカテゴリ内で、7ハイストレートと5ハイのホイールが同点になる、キングハイSFが6ハイSFに負けて見える、といった順序の乱れが起きていた。以前はv3.7.4以前に存在した固定ボーナス（クアッズ+0.06、SF/Royal+0.04〜0.08等）がスコアをbandCeilingへ張り付かせる副作用で、このバグがずっとマスクされ続けていた（点数がほぼ同じ値にクランプされるため、実際の高位カードの違いが見えなかった）。ロイヤルフラッシュの判定条件（`sfHigh===4`）もこの取り違えに合わせて誤っていたため、`sfHigh===0`（Aのインデックス）に修正。**(2) `computeBoardInteraction()`の残存ボーナスがキッカー比較を上書きするバグ**: v3.7.4でクアッズの固定ボーナスは削除したが、「ホールカードが役に絡んでいるボーナス」「ボードだけで役が完成している場合のペナルティ」「SF/Royalの追加ボーナス」がまだ残っており、これらがフラッシュの3〜5枚目やワンペアの2〜3枚目など「深い位置のキッカー差」（13進法エンコードで指数関数的に小さい粒度になる）を上書きしてしまっていた。これらはどれも実際のポーカーのルールには存在しない演出的な加点であり、役のカテゴリ＋キッカーの並びだけで手の強さは完全に決まるため、`computeBoardInteraction()`を完全に無効化（常に0を返す）した。**検証結果:** 修正後、ランダム7枚2万件のカテゴリ一致率100.0000%、ランダム対決2万件の勝敗順序一致率100.0000%、既存の固定エッジケース6/6一致（2回の独立試行で再現性も確認済み）。`tests/engine.test.js`に回帰テストを3件追加（計27件） |
| **v3.8** | **新機能: BOARD READ CHALLENGE（日替わり盤面クイズ）。** 外部レビューで提案されたゲーミフィケーション案（今日のボードチャレンジ・「このボードどう打つ？」型・AI採点）を、README冒頭の設計方針（「意思決定エンジンではない」「Fold/Call/Raise推奨・GTOアクション・EV比較は提示しない」）と矛盾しない形に落とし込んで実装した。「ベットすべきか」ではなく「盤面の性質をどう読んだか」（テクスチャ・レンジ有利・ナッツ有利・一番強いドロー、の4問）を、解析結果を見る前に推測させ、SPECTRA自身が計算した値（`analyzeBoard()`の出力）と一致したかどうかだけを採点する（GTOソルバーとの比較やアクション推奨は一切行わない）。日付文字列をシードにした決定的な擬似乱数でフロップ3枚を毎日生成するため、サーバー無しで全ユーザーが同じ「今日のボード」を見られる。メインの解析フロー（`currentBoard`/`spectraWorker`）に一切干渉しないよう、チャレンジ専用の別Workerインスタンスを使用。連続日数・最高記録・平均スコアは`localStorage`に保存（このアプリはGitHub Pages等で配信する通常のWebページであり、Claude.aiアーティファクトのプレビュー環境ではないため、localStorage使用は問題ない）。ヘッダーに🎯CHALLENGEボタンを追加、モーダル形式で表示 |
| **v3.8.1** | **Structure Radar 可読性改善（外部提案A）。** (1) 軸ラベルを「3文字コード（小さく）＋日本語ワード＋現在値%」の3段構成に変更し、レーダーだけで各軸の数値が読めるようにした（以前は3文字コードと日本語が1行併記のみで値は表示されていなかった）。`buildRadarGrid()`で各軸に`radar-val-{key}`のidを持つtspanを用意し、`renderStructureRadar()`が毎回の再計算時にそこへ現在値を書き込む。(2) 前ストリートとの比較用「ゴースト残像」を追加。ストリートが進んだ時（FLOP→TURN→RIVER）だけ、直前のstructureFeaturesの形を薄い点線ポリゴン（`#radar-shape-prev`）として重ねて描画し、「どの軸が伸びた/縮んだか」が一目で分かるようにした。同一ストリート内の再計算（ポジション変更等）では残像を更新しない。ヘルプバッジの説明文も「実線=現在のストリート、点線=1つ前のストリート」に更新 |
| **v3.8.2** | **リバー処理の甘さを修正。** (1) **`classifyPotential()`/`classifyDraw()`（range_matrix.js）**: 従来は`board.length<3`のガードしかなく、リバー(5枚)でもフロップ/ターンと同じロジックでpotentialStrength・drawType(FD/OESD/GSD等)を計算していた。リバーは次のカードが来ないため「ドローの伸びしろ」という概念自体が存在しないはずが、数値として出続けていた。`board.length>=5`で強制的に`potential=0`・`drawType=null`・`outs=0`を返すよう修正。フォールバック評価エンジン側の`classifyDrawInline()`、および現在コメントアウト中のHERO OUTSパネルが使う`detectDraws()`にも同一バグが独立して存在したため、あわせて修正（後者は現状到達しないが将来の再有効化に備えて修正）。回帰テストを2件追加（計29件）。(2) **NUTSテーブルのチップ並び順修正**: チップが生存コンボ数(combos)基準でソートされており、盤面にブロックされてコンボが少ないだけの最強ハンド（例: KKKAAボードでのAA、盤面に既にA2枚出ているため生存コンボが1通りのみ）が、コンボ数の多い弱いハンド（K-x等）より後ろに表示され「弱い方が強く見える」誤解を生んでいた。実際の強さ(madeStrength)基準のソートに変更。(3) **リバーの色相をカテゴリ別ティア制に変更**: クアッズA(made≈0.882)とクアッズK(made≈0.876)のように僅差の場合、連続的なべき乗カーブでは色相がほぼ同じ値に収束し「見た目で判別しづらい・特別な配色に見える」という指摘があった。リバー限定で役のカテゴリごとに固定の色帯（Lightness側の既存ティア境界0.70/0.44/0.26/0.10と揃えた5段階）を割り当てる、より「原色に近い・素直な」配色に変更。フロップ/ターンは従来の連続カーブのまま（ドローの伸びしろがまだ意味を持つため） |
| **v3.9** | **ヒートマップの色設計を全面刷新（役割分離）。** 外部フィードバックにより、従来のHue×Saturation×Lightnessの3重エンコードは「濃い/薄い」と「明るい/暗い」を同時に読み取るのが難しく、何を意味しているのか直感的に理解しづらいという指摘を受けた。各視覚チャンネルの役割を完全に分離する設計に変更。**(1) 背景マスク（枠線スタイル）**: ハンドの静的カテゴリ（盤面に一切依存しない、プリフロップの形そのもの）を`classifyHandCategory()`で判定し、太い実線=Pocket Pair／二重線=Suited Broadway／破線=Suited Connector・Gapper系／点線=Offsuit Broadway／細い実線=その他、の5種の枠線で表現。文字の可読性を潰さないよう、背景パターンではなく枠線スタイルの違いのみを使用。**(2) 彩度（Saturation）**: 現在のMade Strengthのみを表す（potentialは一切混ぜない）。固定の単一色相(hue=8、暖色)に対し、弱い=くすんだ色(12%)〜強い=鮮やかな色(94%)で連続的に変化。デッドコンボ(density=0)のみ無彩色化。**(3) 明度（Lightness）**: 完全に固定値に変更し、情報のエンコードを撤廃（「よく分からない明度」の元凶だったため）。**(4) Draw Potential（将来性）**: 彩度から分離し、セル右上の独立したシアン色ドット（`hm-pot-dot`）として表現。一定以上のpotentialがある場合のみ表示され、大きさ・不透明度がpotential値に応じて変化する。**(5) VILLAIN VIEW → ポジションタブ形式に刷新**: 従来の2ボタン(HERO/VILLAIN)トグルを、ヒートマップ上部のブラウザタブ風UI（OFF/UTG/HJ/CO/BTN/SB/BB）＋「vs 3bet」チェックボックスに変更。選択したポジションのレンジ幅（Chen Formulaによるヒューリスティックな169ハンド強度ランキング＋ポジション別レンジ幅の目安値、`POSITION_RANGE_PCT`/`POSITION_3BET_RANGE_PCT`）に入らないハンドを`villain-out`クラスで暗くする。ボードの有無に依存せず独立して動作する（`renderVillainOverlay()`）ため、**プリフロップ（ボード未入力）でも機能する**。GTOソルバーで導出した値ではなく、あくまで一般的なレンジ表の目安値を使ったヒューリスティックである旨をヘルプバッジで明記 |
| **v3.9.1** | **ヒートマップ調整＋UI整理。** (1) **彩度だけでは強さの変化が見えない問題を修正**: v3.9で彩度のみに強さを乗せ明度を固定したところ、人間の目には差がほとんど見えず「全部真っ赤」に見えてしまうという指摘があった（彩度の知覚差は明度の知覚差より弱い）。彩度と明度を同じ1つの値(madeStrength)に対して両方連動させることで、暗い赤(弱い)〜鮮やかで明るい赤(強い)というはっきりしたグラデーションに変更（背景マスク=構造・彩度+明度=強さ・ドット=将来性、という3系統の役割分離は維持）。(2) **ヒートマップを拡大**: セルのフォントサイズを6px→9.5pxに拡大し文字を読みやすくした。左右パネル幅を200px/220px→180px/200pxに詰め、中央のヒートマップ領域を広げた。(3) **POSITION MATRIX（5×6グリッド）を削除**: 面積を取る割に変化が乏しく、Range Profile（勝率バー）やBoard Intelligenceの有利不利表示と情報が重複していたため撤去。ポジション自体の選択は引き続きhero-pos-select/villain-pos-selectのドロップダウンで行う。(4) **Structure Radar（5軸レーダーチャート）を★評価リストに変更**: 「レーダー型は形が見えにくい」という指摘を受け、SVGペンタゴンを5項目・5段階の★評価リスト（ENT/POL/COV/DRW/DOMそれぞれ★の数＋パーセント値）に置き換え。前ストリートとの比較は▲上昇/▼下降/・変化なしのシンプルな記号で表示するよう変更（ゴースト残像ポリゴンは撤去） |

