# SPECTRA v3.7.2 — Board Intelligence OS

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

現在18ケース。主な内容：

- 役判定（ロイヤル取り逃がし・ホイール境界6パターン・トリップス誤認 など、このセッションで発見・修正したバグの再発防止）
- 169マトリクス・ドロー分類（フラッシュ完成済みハンドの二重カウント、topClassCombos、デッドコンボ除外）
- Nut Dynamics（`context.heroPos`/`context.villainPos`を正しく見ているか）
- 統合テスト（`analyzeBoard()`が例外なく動くか）

**注意:** これは`detectHandCategory()`/`scoreHandCategory()`の**回帰防止**テストであり、
役判定ロジックそのものの網羅的な正しさ（例: 全カード組み合わせに対する既存評価器との突き合わせ）は
保証しない。外部レビューで提案された「100〜200ケースの単体テスト」「ランダム7枚×既存評価器との
突き合わせ」まではまだ未着手（今後の課題）。

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
| **v3.7.1** | **index.html: Worker障害時のfallback遷移バグ修正**（外部レビュー指摘）。`startFallback()`が`workerReady=true`にするだけで`spectraWorker`をnull化していなかったため、`triggerUpdate()`の`if(spectraWorker)`分岐に入り続け、壊れた/応答しないWorkerへpostMessageし続けてしまっていた（importScripts失敗時は`self.onmessage`自体が設定されないため応答が一切返らず、CALCULATINGスピナーが解放されないまま固まる）。「見た目上はfallback」なのに実際にはfallbackが有効化されていない状態だった。`startFallback()`で`spectraWorker.terminate()`＋`spectraWorker = null`を行うよう修正。あわせて、Worker側(`spectra-worker.js`)が実行時例外を`ENGINE_ERROR`としてpostMessageしていたにもかかわらず`onWorkerMessage()`の`switch`に対応する`case`が無く握りつぶされていたバグも修正（`ENGINE_ERROR`受信時に`startFallback()`を呼ぶcaseを追加）。通常時のWorker成功フロー・公開APIは変更なし |
| **v3.7.2** | **UIフィードバック一括対応。** (1) CURRENT NUTS表示を廃止（同点最強ハンドが複数ある場合に1つしか出せず実態と合わない上、一番上の帯を見れば分かるため冗長というフィードバックにより）。(2) ヒートマップ彩度バグ修正: 従来はdensity(0-1)にほぼ線形で彩度を決めていたため、ボードに同ランクが2枚出ていて残りコンボが少ないケース（例: board上にA2枚出ている状態でのAA=クアッズ最有力）で、Hueは正しく赤なのに彩度不足で色が消えたように見えていた。density===0（本当にデッド）の時だけ灰色寄りにし、生きてさえいれば希少度に関わらずしっかり彩度を持たせるよう変更。(3) Structure RadarのCOVERAGE軸が常にほぼ100固定だったバグ修正: 「169ハンドのうち生存コンボが1つでもあるか」という二値的な数え方だったため、同ランクが3枚以上出るような極端なボード以外では常に100近辺になっていた。169ハンド全体の平均densityに変更し、ストリートの進行（カード消費量）を連続的に反映するようにした（ただし同一ストリート内でのテクスチャ差にはあまり反応しない、という設計上の限界は残る）。(4) CLEAR ALLボタンが個別クリア(`clearSlot`)と同じ完全リセットをしておらず、スート選択時の枠線色・背景色・クリアボタンの見た目が残ってしまうバグを修正。(5) 将来のカメラ撮影機能用に確保されていたプレースホルダー（ポーカーテーブルのグラフィック、`camStream`変数含む）を削除——実装されたことのない未使用の飾りだったため、中央パネルの空きスペースをBOARD INPUTエリアが埋めるようにした。(6) HERO HAND / HERO OUTSパネルをコメントアウト（実装は削除せず残置。復活させる場合は該当HTMLコメントを外し、`buildHeroSelects();`のコメントも外すだけでよい）。`updateOutsPanel()`にnullガードを追加し、対象要素が無くても他の`updateHeroCells()`呼び出し元（5箇所）が壊れないようにした。(7) 各セクション見出しの隣に「？」ヘルプバッジ（`.help-q`）を追加。既存の`title`ツールチップはホバーしないと存在に気づけず「右側の分析要素が何なのか分からない」というフィードバックがあったため、視覚的に目立つマークを常設した（対象: RANGE PROFILE / POSITION MATRIX / STRUCTURE RADAR / BOARD INTELLIGENCE / 3D HEATMAP / HAND DISTRIBUTION） |

