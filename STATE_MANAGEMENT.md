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

**v3.6.2 修正:** 従来`evalCache`は無制限に増え続ける可能性があった（長時間セッションでメモリ増加）。
`utils.js`に`cacheSet(key, value)`ヘルパーを追加し、上限`EVAL_CACHE_MAX=500`件を超えたら
最も古いエントリ（Mapの挿入順で先頭）から削除するFIFO方式に変更。`evalCache.set()`の直接呼び出しは
`spectra-worker.js`内の2箇所とも`cacheSet()`に置き換え済み。

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

**保留中の課題（未着手）:** Position Matrixのクリックが唯一のHero/Villain位置選択手段になっている点、
および「表示されるポジションが実際の状況と違う」という指摘（詳細未確認・スクリーンショット待ち）。
着手時は本セクションと合わせて見直すこと。

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
  └─ new Worker('spectra-worker.js')
  └─ worker.postMessage({ type: 'INIT' })
      ↓ (Worker内でimportScripts完了後)
  └─ onWorkerMessage({ type: 'INIT_OK', version: '3.7' })
  └─ workerReady = true
  └─ finalizeBrainReady()
      ├─ brain-overlay を非表示
      ├─ buildHeatmap()        セル生成
      ├─ buildBoardArea()      入力スロット生成
      ├─ buildBoardCardDisplay() カード表示エリア生成
      ├─ buildHeroSelects()    Hero Hand セレクタ生成
      └─ buildPosMatrix()      Position Matrix 生成
```

**フォールバック:** Worker起動失敗 or 3秒タイムアウト or Worker実行時例外(`ENGINE_ERROR`) → `startFallback()` でUIのみモードに移行。

**v3.7.1 修正:** 以前は`startFallback()`が`spectraWorker`をnull化していなかったため、
fallback発動後も`triggerUpdate()`が`if(spectraWorker)`分岐に入り続け、壊れた/応答しないWorkerへ
postMessageし続けてしまっていた（importScripts失敗時は`self.onmessage`自体が設定されないため応答が
一切返らず、スピナーが固まる）。現在は`startFallback()`内で`spectraWorker.terminate()`と
`spectraWorker = null`を行うため、以降`triggerUpdate()`は正しく`else`側（inline fallback）に入る。
あわせて、Worker側の`ENGINE_ERROR`（実行時例外）を`onWorkerMessage()`が無視していたバグも修正し、
受信時に`startFallback()`を呼ぶようにした。

---

## NUTS テーブル（renderNuts）

**v3.6.1:** `isRiver` は恒久的に `false` 固定。リバー到達時も river-polar（PURE VALUE/BLUFF CATCH/BLUFF・FOLD の3分割）へは切り替えず、
FLOP/TURNと同じ役ごとのコンボ%分布リストを継続表示する。`renderRiverPolar()` / `#river-polar` はコードとDOMは残存するが、
到達経路がなくなったため常に非表示（`display:none`）のままとなる。

**v3.6.2: 構成が大きく変わった。** 現在の`renderNuts(data, features)`の出力は以下の通り：

```
[CURRENT NUTS要約行]  ← 今この瞬間の最強ハンドを1行で表示
  bestHand.hand を getRepresentativeCombo()+comboToHtml() で具体スート化して表示
  （例: "AKs" ではなく "A♠K♠" と表示。ボードと矛盾しない組み合わせを1つ選ぶ）

[役帯ごとのブロック（1帯あたり約4行）]
  1行目: ▸/▾ 折りたたみアイコン + 役名 + (CONFIRMEDバッジ) … (コンボ実数) + %
  2行目: 割合バー
  3〜4行目: 該当ハンドのチップ一覧（最大10件、+N件で省略表示）
```

**帯の集計処理:**

```
入力: rangeMatrix (169アイテム)

処理:
  1. density > 0 のみ（デッドコンボ除外。例: KKKボードでのKKは自動的に除外される）
  2. HAND_BANDS の閾値（ROYAL FLUSH ~ HIGH CARD）でスコアを帯に振り分け
  3. 各帯の items に { hand, combos, isSuited, isPair, drawType, outs } を格納
     combosは h.topClassCombos を優先使用（無ければ density*baseTotal にフォールバック）
```

**v3.6.2 バグ修正: `topClassCombos`（Worker側 range_matrix.js の eval169）**

同じ169ハンド内のコンボ（suited4通り/offsuit12通り）は`rawEval7 = Math.max(...scores)`で代表スコアを決めるが、
従来の`activeCombos`はカードのブロック有無だけで数えており「代表スコアと同じ役に到達したコンボ数」ではなかった。
ボードに濃いフラッシュ（3+同スート）がある場合、スーテッド4通りのうち実際にボードと同スートが揃うのは1通りだけ、
という非対称が起きる（例: 4-flushボード+スーテッドハンド=ロイヤルは実質1コンボしかないのに、
NUTSテーブルには「Live: 4」と誤表示されていた）。
`topClassCombos`（代表スコアと同じ役名(`getHandName`)に到達したコンボ数のみをカウント）を新設し、
NUTSテーブルのLive Combo表示・帯集計はこちらを優先する。
※副作用として、残り3コンボ分の「本当はストレートである」実態はどの帯にもカウントされなくなる
（169ハンド＝1行という構造上の制約。正確に分離するには combo単位でのテーブル行分割が必要で、これは未対応）。

**チップ表示の加工処理（表示直前に適用）:**

- **s/o統合（`mergeSuitedOffsuit()`）**: 同じ帯の中に `ATs` と `ATo` が両方存在する場合（＝フラッシュ関連が絡まずスート違いでも同スコア）、
  「AT s/o」の1チップにまとめてコンボ数を合算する。ペアは対象外（常に単独）。ドロータグは統合時は曖昧になるため出さない。
- **ドロー重複タグ**: そのハンドが`drawType`を持つ場合、種類とアウツ概算を小さく併記（例: `T9s FD·9o`）。
  ホバーで`DRAW_TYPE_EXPLAIN`辞書による日本語説明が出る。
- **FLUSH帯のみ: ボード基準の2分割**: ボード上の支配スート（`dominantSuit`）の最高ランクを`boardTopFlushRank`として算出し、
  スーテッドハンドを「ボード超え（キッカーで差がつく）」「ボード以下（同士討ちはチョップ寄り）」の2グループに分けて表示。
  `boardTopFlushRank`がAce(0)の場合は「⚠ ボードの♠Aがキッカー確定 → 同士討ちはチョップ濃厚」の注記を出す。
  この分割は通常のスート内訳サブ行（旧仕様）を置き換えている。

**帯の折りたたみ:** `collapsedNutBands`（グローバルSet、デフォルト`['HIGH CARD']`）に含まれる帯はヘッダー＋バーの2行のみ表示。
ヘッダークリックで`toggleNutBand(name)`が呼ばれ、`lastNutsFeatures`（renderNuts呼び出し時にキャッシュ）を使って再描画する。

**CURRENT NUTS表示について:** `bestHand`は`live`配列（density>0）の中で`madeStrength`（無ければ`rawScore`）が最大のものを採用。
`handName`はv3.7以降、Worker側`evaluate7()`が判定した実際のカテゴリ（`category`/`categoryName`）がそのまま`eval169`→`evalRange169`経由で渡ってくる。
以前のようにスコア数値から`getHandName()`で逆算する経路はなくなったため、ボード補正等でスコアが揺れて役名が誤表示される問題は構造上発生しなくなった（詳細は`strength.js`のP2-K/v3.7の項を参照）。
※ただし`detectHandCategory()`自体の役判定ロジックに誤りがあれば、当然それはそのまま役名に反映される。防げるのは「スコアと役名の不整合」のみで、役判定ロジック自体の正しさを保証するものではない。

---

## Structure Rating / Structure Radar（4軸評価リスト・renderStructureRadar）

`data.structureFeatures`（0-100、内部的にはentropy含む5フィールド）のうち4軸を表示する。データソースは`computeStructureFeatures()`（range_matrix.js）。

```
軸構成（RADAR_AXES / 4軸・index.html 2115行目）:
  DRW  drawStructure   ドロー感      ストレートやフラッシュなどドロー（未完成の可能性）の多さ
  POL  polarization    二極化       最強の役とエアーへの二極化度（中途半端な手の少なさ）
  DEN  coverage        レンジ密度    ワンペア・ツーペア等、中間的な強さのヒット手の広さ
  NUT  dominance       ナッツ偏り    特定の最強手（ナッツ）の独占・偏在度
```

**注意:** `computeStructureFeatures()`が返す`entropy`（rawScore分布の複雑さ）は現在★評価リストには表示されない。ただし値自体は引き続き計算されており、`ui/tactical_insights.js`の`generateTacticalInsights()`内で「🌀 COMPLEX SPLIT」タグの判定（`ent >= 68`）に使われている。UI表示から消えているだけでデータフローからは削除されていない点に注意。

**v3.6.1:** 目盛りライン（25/50/75）の視認性を強化（当時はSVGレーダー、5軸: ENT/POL/COV/DRW/DOM）。
**v3.9.1:** 「レーダー型SVGペンタゴンは直感的な形が見えにくい」というフィードバックに基づき★評価リストにUI刷新。前ストリートとの比較は▲上昇/▼下降/・変化なしのシンプルな記号で表示。
**（changelog未記載の変更）** ★評価リスト移行の過程でENT（entropy）が表示軸から外れ、5軸→4軸になっている。いつのタイミングで外れたかの記録が無いため、次に触る際はここへ追記すること。

### STRUCTURE RATING の評価と設計上の位置づけ

- **肯定的な評価 (Pros)**: 1次元の勝率・EVに留まらない「戦況の質的解像度」を提供。戦術の選択肢（大型ベット向きか、チェック/プロテクション向きか）を非GTO命令型で思考補助する点、およびストリート間でのダイナミクス（▲/▼変化）を瞬時に識別できる点が高く評価される。
- **否定的な評価 (Cons)**: アクションに直接結びつきにくく初心者にとって抽象度が高い点、DEN（coverage）などが平均Densityベースのため同一ストリート内の微小カード差に反応しにくい感度の限界、および厳密なGTO Game TreeのEV分布の代替ではなく169マトリクス上のヒューリスティック統計値である点。

---

## 初心者向けツールチップ（v3.6.2〜）

専門用語に`title`属性でホバー説明を付与する仕組み。新規追加時はここに追記すること。

```
DRAW_TYPE_EXPLAIN  … FD/OESD/GSD/BD-FDの説明（NUTSチップのドロータグに適用）
HUD_DEFS[].explain … attack/value/bluff/cappedの説明（Board Intelligence内のHUDバッジに適用）
各パネル見出しのtitle属性 … HERO HAND / POSITION MATRIX / STRUCTURE RADAR /
                            HERO OUTS / BOARD INTELLIGENCE / 3D HEATMAP / NUTS(nuts-sec-label)
```

NUTSパネルのチップ・ラベル類は他パネルより一段階大きいフォントサイズを採用している
（v3.6.2で「文字が小さい」という指摘を受けて底上げ済み。他パネルは未対応、今後の課題）。

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
  ui/
    tactical_insights.js
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

---

## ディレクトリ構成の方針（core/ vs ui/）

v3.9.2〜、index.html内の巨大な単一`<script>`から、DOM操作を持たない純粋ロジックを段階的に切り出す方針を採用。

```
core/  … Worker側（spectra-worker.jsがimportScriptsで読み込む）。解析エンジン本体。
ui/    … メインスレッド側（index.htmlが<script src="...">で読み込む）。
         盤面構造などの解析結果 → UI表示用の文言・データへの変換ロジック。
         DOM操作（document. / getElementById / innerHTML）を含まない純粋関数のみを対象とする。
```

**切り出し済み:**
- `ui/tactical_insights.js` … `generateTacticalInsights(sf)`。structureFeatures（polarization/drawStructure/coverage/dominance/entropy）→ TACTICAL INSIGHTSタグ文言への変換。index.html側の`renderStructureRadar`と`renderChallengeResult`から呼び出される。

**切り出し候補（未着手・優先度は都度相談）:**
1. **フォールバック評価エンジン** — Worker不使用時の代替計算一式。`classifyHandCategory` `chenScore` `build169ChenPercentile` `isInVillainRange` `getDisplayStrength` `calc3DHSL` `fallbackColor` `fallbackEval169` `evalHandFallback` `parseCard` `estimatePairScore/estimateSuitedScore/estimateOffsuitScore` `classifyDrawInline` `detectDraws` `getOutsCards` `drawColor` `mergeSuitedOffsuit` `getRepresentativeCombo` `comboToHtml` `calcTexture`。全てDOM非依存。`calcTexture`は`core/texture.js`の`calcBoardTexture`と役割が重複している疑いがあり、切り出し前に要比較。
2. **デイリーチャレンジのロジック** — `seededRandom` `todayKey` `generateDailyBoard` `loadChallengeState` `saveChallengeState` `deriveChallengeCorrectAnswers` `submitChallenge` `ensureChallengeWorker`。ゲームロジック部分のみでDOM非依存。
3. **表示用フォーマットヘルパー** — `hudLevel` `valueToStars` `fl` `colorGradient` `deriveSituationBadge` `detectStreet`。小粒のため優先度は低め。

`render*`系（`renderNuts` `buildBoardArea`等）はDOM操作そのものが本体のため、index.html側に残す。

---

## UI改修 履歴（旧TODO）

1. **✅ ボード拡大表示部の削除（完了）**
   `open-picker-modal-btn`（🔍 拡大表示ボタン）を削除。それに伴い到達不能になった`#picker-overlay`モーダル一式（HTML/CSS、`openDeckPicker()` `closeDeckPicker()` `onPickerOverlayClick()` `clearCurrentPickerSlot()` `clearAllPickerCards()`）も合わせて削除。カード選択は常設の`inline-picker-grid-container`（`renderInlinePickerGrid()`）に一本化。
   あわせて、ターゲットスロット表示先だった`active-slot-badge`要素も既に削除済みだったため、参照元の`updateTargetBadge()`（4箇所の呼び出し含む）も削除。ターゲットスロットの選択状態はインラインpicker側（カード表示部分、`renderPickerSlots()`のactive表示）で完結しているため、バッジ表示は不要と判断。

2. **✅ ボード選択部に戻るボタン（完了）**
   `stepBackPickerSlot()`を追加。現在スロットにカードがあればそれを消去、無ければ直前入力済みスロットを遡って消去する。インライン picker の操作行に「◀ 戻す」ボタンとして設置。

3. **見送り: カード表示部の右詰め**
   対応不要と判断。`board-slots-row`は現状（`display:flex;gap:6px`の左詰め）のまま。

4. **✅ ヒートマップ右上のバッジ形状: ■ → ◥（完了）**
   `.hm-pot-dot`を`clip-path:polygon(0 0, 100% 0, 100% 100%)`によるコーナートライアングルに変更。`getDrawPotentialLevelColor()`が`border-color`ではなく`background`/`boxShadow`を直接設定する実装になり、意図通り◥として描画されるようになった。

5. **✅ ◥部の色合い（完了）**
   2色（シアン/ゴールド）ではなく、potential強度に応じた5段階配色に変更（`getDrawPotentialLevelColor()`）: ★1灰(微)→★2緑(小)→★3青(中)→★4橙(大)→★5金(特大・複合強力ドロー)。ヒートマップ凡例にも5段階の色見本を追加。

6. **未着手: Workerバンドルのビルドスクリプト化**
   v3.9.5でWorkerを`file://`でも起動できるようBlob URL方式に変更した際、`core/*.js` 9ファイル + `spectra-worker.js`を連結したコピーを`index.html`内の`<script type="text/plain" id="spectra-worker-src">`に埋め込む方式にした。
   現状はこのコピーを手動で再生成しており、`core/*.js`側を編集してもこの埋め込みコピーに反映し忘れるとWorkerの動作だけ古いまま、というズレが発生しうる。連結処理を行う小さなビルドスクリプト（Node/Python）を用意し、`core/*.js`編集後に実行する運用にするか、ビルド時に自動生成する仕組みにするかを検討。

7. **未着手: フォールバック評価エンジン（`fallbackEval169`一式）の整理**
   上記のBlob URL化により`file://`でもWorkerがほぼ確実に起動するようになったため、メインスレッド側の代替評価ロジック（`classifyHandCategory` `chenScore` `fallbackEval169` `evalHandFallback` `classifyDrawInline`等、「切り出し候補」セクションに列挙済みの一群）は実質発動しなくなったと見られる。
   Worker側ロジックとは別に保守されている二重実装であり、v3.6.2の「フォールバック時に戦況バッジが固まる」バグの原因もここだった。①使われなくなったなら削除する、②保険として残すなら「Worker側ロジックを変更したらこちらも追随させる」運用ルールを明文化する、のどちらかの判断が必要。

8. **未着手: NUTSパネル以外のフォントサイズ底上げ**
   上記「主要定数」欄に既出の通り、NUTSパネルはv3.6.2で文字サイズを底上げ済みだが、他パネル（HERO HAND / POSITION MATRIX / STRUCTURE RADAR / HERO OUTS / BOARD INTELLIGENCE / 3D HEATMAP等）は未対応のまま。
