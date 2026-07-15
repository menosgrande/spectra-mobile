# SPECTRA v3.6.2 — Board Intelligence OS

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
| P2-J | **外部レビュー対応**: (1) `board_intel.js`の`classifyNutDynamics`が`context.positions === 'BTN_VS_BB'`という、実際のUI呼び出しでは存在しないフィールドを見ていたバグを修正（`context.heroPos === 'BTN' && context.villainPos === 'BB'`に変更）。実運用では常にfalse側に倒れ、ポジションに関わらずNUT_ADV_VILLAIN固定/NEUTRAL固定になっていた。(2) `utils.js`の`evalCache`が無制限に増え続ける可能性があったため、`cacheSet()`ヘルパーを追加しFIFOで上限500件に制限。(3) バージョン表記の混在（index.html内`v3.0 BATTLE OS`、worker内`3.6`、README`3.6.1`）を`v3.6.2`に統一 |

