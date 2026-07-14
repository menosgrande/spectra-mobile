# SPECTRA STATE_MANAGEMENT.md

UIとWorker間のデータフロー・状態管理の設計仕様書。

---

## グローバル状態変数（index.html）

```js
// ── 入力系 ──
let currentBoard   = [];          // ['Ah','7d','2c'] 最大5枚
let heroHand       = [];          // ['As','Kd'] — 任意入力

// ── ポジション選択 ──
let selectedHeroPos    = 'BTN';   // Position Matrix クリックで更新
let selectedVillainPos = 'BB';

// ── Worker状態 ──
let spectraWorker  = null;
let workerReady    = false;

// ── キャッシュ・表示用 ──
let lastHeatmapData = [];         // render3DHeatmap / renderNuts に使用
let lastRangeAdv    = null;       // Position Matrix のボード補正値
let calcTimer       = null;       // 入力debounce（300ms）
let _spinTimer      = null;       // CALCULATINGスピナー（200ms遅延）
```

---

## データフロー

```
ユーザー入力
  ↓
onInputChanged() / onHeroChanged()
  ↓ debounce 300ms
triggerUpdate()
  ↓ postMessage(BOARD_INTELLIGENCE)
  ↓
[Web Worker: analyzeBoard()]
  ↓
  utils.js         定数・ユーティリティ
  texture.js       ボードテクスチャ分類
  position.js      ポジションプロファイル
  strength.js      ハンド強度評価
  range_matrix.js  169ハンド評価
  board_intel.js   ボードフィーチャー抽出
  interpretations.js  意味付けエンジン
  narrative.js     Narrative生成・HUD計算
  board_intelligence.js  オーケストレート
  ↓
onWorkerMessage(BOARD_INTELLIGENCE)
  ↓
  ├─ render3DHeatmap(data.rangeMatrix)   ← ヒートマップ描画
  ├─ renderNuts(data.rangeMatrix)        ← NUTSテーブル
  ├─ applyTexture(data.texture)          ← テクスチャ表示
  ├─ renderConclusion(data)              ← SITUATION BADGE
  ├─ renderBoardIntelligence(data)       ← BIパネル
  ├─ renderRangeAdvantage(data)          ← Position Matrix 更新
  └─ updateHeroCells()                   ← HERO HANDセルハイライト
```

---

## スピナー制御（CALCULATING表示）

```
triggerUpdate()
  └─ _spinTimer = setTimeout(show spinner, 200ms)   ← 200ms遅延
       ↓（Workerが200ms以内に返せば表示なし）

onWorkerMessage(BOARD_INTELLIGENCE)
  └─ clearTimeout(_spinTimer)    ← タイマーキャンセル
  └─ hm-spin.remove('active')    ← 即時消去
```

**ポイント:** キャッシュヒット（ほぼ即時レスポンス）時はスピナーが一切見えない。

---

## Worker キャッシュ

**キャッシュキー:**

```js
const cacheKey = board.join(',') + '|' + heroPos + '|' + villainPos
               + '|' + archetype + '|' + profile;
// 例: "Ah,7d,2c|BTN|BB|STANDARD|BTN_VS_BB"
```

- 同一ボード・同一コンテキストなら即座にキャッシュ返却
- ポジション変更・アーキタイプ変更でキャッシュミス → 再計算
- `evalCache`（Worker内部の`Map`）はWorkerライフタイム中に保持

---

## Board Input（5スロット）

```
slot 0 (rsel-0 / ssel-0)  ─┐
slot 1 (rsel-1 / ssel-1)   │ FLOP (3枚で解析開始)
slot 2 (rsel-2 / ssel-2)  ─┘
slot 3 (rsel-3 / ssel-3)    TURN
slot 4 (rsel-4 / ssel-4)    RIVER
```

`readBoard()` が全5スロットを走査し、`rank + suit` が揃っているスロットだけを `currentBoard` に追加。

### Duplicate Guard

```js
updateDuplicateGuard()
// 選択済みの (rank + suit) の完全一致のみを他スロットで disabled にする。
// 同ランク・異スート（例: Ah と As）は許容。
```

---

## Hero Hand の扱い

```
onHeroChanged()
  └─ heroHand = [r1+s1, r2+s2]  完全カード表記
  └─ updateHeroCells()           ヒートマップのセルをハイライト
  └─ updateBoardCards()          ボードカード表示を更新（HERO重複チェック）
```

Hero Hand は Worker への送信には**含まれない**（UIのみで管理）。  
ヒートマップ上でのハイライト（`.hero-cell`）とOuts表示に使用する。

---

## Heatmap セルのデータ属性

```html
<div id="hc{0-168}" class="hm-c"
  data-hand="AKs"
  data-eq="72.3"      <!-- getDisplayStrength() * 100 -->
  data-pot="45"       <!-- potential * 100 -->
  data-den="75"       <!-- density * 100 -->
  data-draw="FD"
  data-dead="0"       <!-- 1=デッドコンボ（density=0） -->
></div>
```

**インデックス計算:**

```js
// RANKS_LIST = ['A','K','Q','J','T','9','8','7','6','5','4','3','2']
// hc(i*13 + j)  i=rank1_index, j=rank2_index
// i < j → suited (upper-right triangle)
// i > j → offsuit (lower-left triangle)
// i === j → pair (diagonal)
```

---

## Heatmap 色計算（calc3DHSL）

```
density === 0  → '#000000'  (デッドコンボ: 真っ黒)

それ以外:
  hue = (1 - strength/100) × 240
  // 強い=赤(0°) ～ 弱い=青(240°)、フルスペクトラム

  sat = density × 100  (生存率で彩度)

  lum (FLOP):  madeBase(22-44%) + potential × 26%
  lum (TURN):  madeBase(26-54%) + potential × 18%
  lum (RIVER): 役強度で段階的固定値（15/22/40/50/60%）
```

**RIVER で FLEX（輝度変化）が消える理由:**  
ターン・リバーでは将来性（potential）が確定するため、輝度を固定して役の強さのみを反映する。

---

## Position Matrix の状態更新

```
buildPosMatrix() が呼ばれるタイミング:
  1. finalizeBrainReady()        初期化時
  2. Position Matrixセルクリック  setPosFromMatrix()内
  3. Hero/Villain select変更      onchange handler
  4. onWorkerMessage()            rangeAdv更新後

セルの色計算:
  baseAdv = POS_BASE[heroPos][villainPos]  (静的テーブル)
  blended = baseAdv × 0.5 + lastRangeAdv × 0.5  (選択セルのみ)
```

---

## Mobile タブ状態

```js
const MOB_TAB_MAP = { left: 'pnl-left', center: 'pnl-center', right: 'pnl-right' };

switchMobTab(tab):
  1. 全パネルから mob-active を除去
  2. 選択パネルに mob-active を付与
  3. タブボタンの active を更新
```

---

## Worker 初期化フロー

```
initEngine()
  └─ new Worker('worker/spectra-worker.js')
  └─ worker.postMessage({ type: 'INIT' })
      ↓ (Worker内でimportScripts完了後)
  └─ onWorkerMessage({ type: 'INIT_OK', version: '3.6' })
  └─ workerReady = true
  └─ finalizeBrainReady()
      ├─ brain-overlay を非表示
      ├─ buildHeatmap()        セル生成
      ├─ buildBoardArea()      入力スロット生成
      ├─ buildBoardCardDisplay() カード表示エリア生成
      ├─ buildHeroSelects()    Hero Hand セレクタ生成
      └─ buildPosMatrix()      Position Matrix 生成
```

**フォールバック:** Worker起動失敗 or 4秒タイムアウト → `startFallback()` でUIのみモードに移行。

---

## NUTS テーブル（renderNuts）

**v3.6.1:** `isRiver` は恒久的に `false` 固定。リバー到達時も river-polar（PURE VALUE/BLUFF CATCH/BLUFF・FOLD の3分割）へは切り替えず、
FLOP/TURNと同じ役ごとのコンボ%分布リストを継続表示する。`renderRiverPolar()` / `#river-polar` はコードとDOMは残存するが、
到達経路がなくなったため常に非表示（`display:none`）のままとなる。

```
入力: rangeMatrix (169アイテム)

処理:
  1. getDisplayStrength() 降順でソート
  2. density > 0 のみ（デッドコンボ除外）
  3. 上位7件を表示

各行:
  rank | strength% | hand + bestCombo(colored suits) | handName | drawType
```

**bestCombo 表示形式:**

```js
formatCombo("AhKh")
  → <span style="color:#e04060">A♥</span><span style="color:#e04060">K♥</span>
```

スーテッドの場合: domainSuit（ボード上最多スート）と一致するコンボを優先選択。

---

## Structure Radar（5軸SVGチャート・renderStructureRadar）

`data.structureFeatures`（0-100の5軸）をペンタゴン形のSVGにプロットする。データソースは`computeStructureFeatures()`（range_matrix.js）。

```
軸構成（RADAR_AXES）:
  ENT  Entropy         rawScore分布の複雑さ
  POL  Polarization    上位25% - 下位25%の強弱差
  COV  Coverage        density>0のハンド数 / 169
  DRW  DrawStructure   drawType の豊富さ・複合度
  DOM  Dominance       rawScore分布のGini係数（不平等度）
```

**v3.6.1:** 目盛りライン（25/50/75）の視認性を強化（`rgba(0,180,255,0.2)`→`rgba(140,200,240,0.55)`、font-size 5→6）。
また、略語だけでは意味が伝わりにくいため、チャート下部に5軸それぞれの英語フルネーム＋簡単な説明を凡例として常時表示する
（`ENT Entropy — complexity` など）。

---

## 主要定数

```js
// Worker側 (utils.js)
RANKS = 'AKQJT98765432'     // インデックス0=A, 12=2
SUITS = 'shdc'
RANK_IDX = { A:0, K:1, Q:2, ... 2:12 }

// UI側 (index.html)
RANKS_LIST = ['A','K','Q','J','T','9','8','7','6','5','4','3','2']
SUITS_LIST = ['s','h','d','c']
SUIT_SYM   = { s:'♠', h:'♥', d:'♦', c:'♣' }
SUIT_COLORS= { s:'#a0a8c0', h:'#e04060', d:'#4080e0', c:'#30b060' }
STREET_COLORS = { PREFLOP:'#00d4ff', FLOP:'#00ff9d', TURN:'#ffb800', RIVER:'#ff3b3b' }
```

---

## デプロイ構成（GitHub Pages）

**v3.6.1 訂正:** 実際のリポジトリ構成は `worker/` フォルダを介さないフラット構成。
`spectra-worker.js` は `index.html` と同階層に置き、`core/` フォルダのみ別に切る。

```
/                     ← リポジトリルート
  index.html
  spectra-worker.js
  core/
    utils.js
    texture.js
    position.js
    strength.js
    range_matrix.js
    board_intel.js
    interpretations.js
    narrative.js
    board_intelligence.js
```

**注意:** 過去に `new Worker('worker/spectra-worker.js')` という誤ったパス参照により、
`spectra-worker.js` が404 → `onerror`/3秒タイムアウト経由で `startFallback()` に落ちる
（≒Workerエンジンが一切機能せずUIのみの空回り状態になる）バグがあった。
現在の正しい参照パス: `new Worker('spectra-worker.js')`（index.htmlと同階層を直接参照）。
`spectra-worker.js` 側の `importScripts('./core/utils.js', ...)` は変更不要（自身と同階層のcore/を見るため）。
