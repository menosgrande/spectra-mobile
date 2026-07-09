# State Management Reference

## 設計原則（最重要・まずここだけ読む）

1. **`players` がゲームデータの唯一の真実（Source of Truth）。`activePlayerIndex` が現在位置。** この2つを合わせて初めてゲーム状況が完全に再現できる。
2. **PREVはターン巻き戻し機能であり、状態復元機能ではない。** 「ゲーム履歴を1ターン戻す」以上のことはしない。
3. **`winner` はUI状態であり、ゲーム履歴ではない。** gameover画面を出すためのフラグであって、巻き戻し対象に含めない。
4. **統計（Stats）は派生値として計算する。独立したstateにしない。** `players[].history` から都度 `calculateStats(players)` のように計算する。
5. **再レンダリング後も古いクロージャから読まれる可能性がある値は、必ずRef化する。** `setTimeout`/`setInterval`/`Promise`はその典型だが、`window.addEventListener`や`requestAnimationFrame`など、Reactのレンダリングサイクルの外側で後から呼ばれるものは全て同じ条件に当てはまる。
6. **Save形式を変更するときは必ず `CURRENT_SAVE_VERSION` を上げ、`migrateSaveData` に変換を書く。**
7. **保存・保持するのは一次データだけ。計算可能な値（派生値）は保存しない。** `currentPlayer`・`roundState`・`isBust`・`stats`・`checkoutRoute` のような「`players`から都度計算できる値」は、state化もlocalStorage保存もしない。原則4（統計）はこの一般原則の一例にすぎない。

この7行が、状態一覧の表よりも実際の保守作業では役に立つ。表は「何があるか」、この章は「どう考えるか」。

---

## 状態遷移の全体像

```
[SETUP画面]
    │ START GAME
    ▼
[throwing]  ──OK──▶  [next]  ──NEXT──▶  [throwing] (次プレイヤー)
    │                  │
    │ (チェックアウト/ラウンド上限)
    ▼
[gameover]  ──PLAY AGAIN──▶  [SETUP画面]
```

---

## State 一覧・分類表

### カテゴリ定義
| 記号 | 意味 |
|------|------|
| **設定** | ゲーム開始前に決定、ゲーム中は不変 |
| **ゲーム** | `players`/`activePlayerIndex` のように、それだけでゲーム状況を完全再現できる確定済みコアデータ |
| **一時入力** | まだ確定していない、現在のターンの入力中データ（Transient State） |
| **UI** | 「今何を表示するか」を決める状態。ゲームの再現には不要 |

> `confirmStage` と `winner` は一見「ゲームの一部」に見えるが、どちらも **UI State** に分類している。理由は設計原則1〜3を参照。`players` と `activePlayerIndex` だけでゲーム状況は完全に再現できるのに対し、これらは「今どの画面/オーバーレイを出すか」を制御するための状態だから。

> `currentThrows` は「ゲームState」と「UI State」のどちらでもなく、**一時入力（Transient State）として独立カテゴリ**にしている。`players`/`activePlayerIndex`のような確定済みデータでもなく、`confirmStage`のような画面制御フラグでもない。「まだコミットされていない、今のターンの入力中の投擲」という第三のカテゴリ。`handleRestoreSave` や `handleUndoCommittedTurn` を触るときに「これもゲーム履歴の一部では？」と誤解しやすいので、ここで明確に切り分けておく。

---

### 設定 State（ゲーム開始時に確定）

| State | 型 | デフォルト | localStorage保存 | Ref同期 | PREV対象 |
|-------|----|-----------|-----------------|---------|---------|
| `gameMode` | `"01"\|"countup"` | `"01"` | ✅ | ✅ `gameModeRef` | ❌ |
| `playerCount` | `1\|2` | `2` | ✅ | ✅ `playerCountRef` | ❌ |
| `cpuMode` | `boolean` | `false` | ✅ | ❌ | ❌ |
| `cpuDifficulty` | `string` | `"medium"` | ✅ | ✅ `cpuDifficultyRef` | ❌ |
| `p1StartScore` | `number` | `501` | ✅（players経由） | ❌ | ❌ |
| `p2StartScore` | `number` | `501` | ✅（players経由） | ❌ | ❌ |
| `p1Handicap` | `number` | `0` | ✅（players.cricketHandicap経由） | ❌ | ❌ |
| `p2Handicap` | `number` | `0` | ✅（players.cricketHandicap経由） | ❌ | ❌ |

> **クリケットのハンディキャップ**: `makeHandicapCricketMarks(handicapCount)` が `CRICKET_TARGETS`（20→19→…→15→Bull）の順に1ナンバー最大3マークまで頭出しマークを積む。得点は一切付与しない（マークのみのハンデ）。`players[].cricketHandicap` に設定値そのものを保持しておき、セーブ復元時は `p1StartScore`/`p2StartScore` と同じパターンで `players[].initialScore` ならぬ `players[].cricketHandicap` から復元する。

> **01のオートハンデ（DARTSLIVE2準拠）**: `autoHandicap01`("off"|"dl2") / `p1Rating` / `p2Rating` はセットアップ画面専用の一時state。`p1StartScore`/`p2StartScore` と同じ設計方針で、ゲーム開始時に `computeAuto01Scores()` がレーティング差から実際の開始点数を算出して `players[].initialScore` に焼き込むだけで、rating自体はセーブ対象に含めない（ゲーム開始後は `initialScore` が唯一のsource of truthで、rating入力は再現不要）。出典は DARTSLIVE公式サポート記事の添付PDF（301/501/701/901/1101/1501 × レーティング差0.5刻み〜8.5以降プラトー）。クリケット版のDARTSLIVE2ハンデ表はPDFのテキスト抽出で列がズレて未実装（要: PDF直接アップロードでの再確認）。
| `outMode` | `string` | `"single"` | ✅ | ✅ `outModeRef` | ❌ |
| `checkoutPref` | `string` | `"double"` | ✅ | ❌ | ❌ |
| `bullType` | `string` | `"separate"` | ✅ | ✅ `bullTypeRef` | ❌ |
| `cuRounds` | `number` | `8` | ✅ | ✅ `cuRoundsRef` | ❌ |
| `maxRounds` | `number\|null` | `null` | ✅ | ✅ `maxRoundsRef` | ❌ |
| `helpLang` | `"ja"\|"en"` | `"ja"` | ✅ | ❌ | ❌ |
| `soundEnabled` | `boolean` | `true` | ❌ | ❌ | ❌ |

---

### ゲーム State（players/activePlayerIndexだけで再現可能な確定済みコアデータ）

| State | 型 | デフォルト | localStorage保存 | Ref同期 | PREV対象 |
|-------|----|-----------|-----------------|---------|---------|
| `players` | `Player[]` | 初期配列 | ✅ | ✅ `playersRef` | ✅ snap保存 |
| `activePlayerIndex` | `0\|1` | `0` | ✅ | ✅ `activePlayerIndexRef` | ✅ snap保存 |
| `turnHistoryState` | `Snap[]` | `[]` | ✅ | ❌ | — |

---

### 一時入力 State（Transient State。まだ確定していない現ターンの入力）

| State | 型 | デフォルト | localStorage保存 | Ref同期 | PREV対象 |
|-------|----|-----------|-----------------|---------|---------|
| `currentThrows` | `Throw[]` | `[]` | ✅ | ✅ `currentThrowsRef` | ❌（PREV時に`[]`固定） |
| `padMultiplier` | `1\|2\|3` | `1` | ✅ | ❌ | ❌ |
| `editingThrowIndex` | `number\|null` | `null` | ✅ | ❌ | ❌（PREV時にnull固定） |

> これらは「OK確定（`handleCommitRound`）」が起きるまで `players` には反映されない、ターン進行中だけ存在するデータ。確定済みの`players`とは別物として扱う。

---

### UI State（表示制御。ゲームの再現には不要）

| State | 型 | デフォルト | localStorage保存 | PREV対象 | 備考 |
|-------|----|-----------|-----------------|---------|------|
| `confirmStage` | `"throwing"\|"next"\|"gameover"` | `"throwing"` | ✅ | ❌（PREV時に`"throwing"`固定） | 「今どの画面/操作待ち状態か」を表すだけ。ゲームルールではない |
| `winner` | `object\|null` | `null` | ✅ | ❌（PREV時にnull固定） | UI Stateだが**リロード後もgameover画面を維持するため**保存する。gameover中はPREV不可なのでnull固定で整合 |
| `undoConfirmStage` | `string` | `"idle"` | ❌ | ❌ | |
| `showSettingsSetup` | `boolean` | `true` | ❌ | ❌ | |
| `showExitConfirm` | `boolean` | `false` | ❌ | ❌ | |
| `showQuitConfirm` | `boolean` | `false` | ❌ | ❌ | |
| `showHowTo` | `boolean` | `false` | ❌ | ❌ | |

---

## PREV（turnHistoryState）の設計方針

### CLEARとPREVは完全に別の責務を持つ（コマンド分離モデル）

この分離が崩れると「点数が戻らない」「戻りすぎる」という体感バグが即発生する。
**不変条件として守ること：`turnHistoryState` に触れる操作は `handleUndoCommittedTurn`（PREV）のみ。**

| 操作 | 実装関数 | turnHistoryState | players | confirmStage | 一言 |
|------|---------|-----------------|---------|--------------|------|
| CLEAR | `handleFlushRound` | **触れない** | **触れない** | `"throwing"` に戻す | 入力バッファのリセットのみ |
| PREV | `handleUndoCommittedTurn` | **pop する** | スナップから復元 | `"throwing"` に固定 | 唯一の履歴消費点 |

**CLEARは「未確定入力状態への遷移」であり、コミット済み状態は一切変更しない。**
`confirmStage === "next"` 中にCLEARを押しても、`players` のスコアはOK時点の確定値のまま残る。
これは「キャンセル」ではなく「入力バッファを空にしてthrowingに戻る」操作であり、
ターンごとスコアを取り消したい場合はPREVを使うというUIルール上の役割分担がある。

**なぜ以前CLEARがturnHistoryStateを消費していたか（歴史的経緯）：**
旧設計では `confirmStage === "next"` 中のCLEARを「ターン取り消し」として扱い、
スナップからplayersを復元していた。これが「OK→CLEAR→PREV」で想定より戻りすぎる体感バグの根本原因となった。
現在はこの分岐を削除し、CLEARは`confirmStage`に関係なく常に入力バッファのみをクリアする。

### PREVは状態復元機能ではない。PREVはターン巻き戻し機能である。

この一文を覚えておくと、将来「モーダルも戻そう」「編集状態も戻そう」という誘惑を防げる。
PREVが担当するのは **ゲーム履歴（`players` / `activePlayerIndex`）の1ターン巻き戻し** だけで、
UI状態（`winner` / `confirmStage` / オーバーレイ表示）の巻き戻しはそもそも担当しない。

### snap に保存するもの
```js
{
  players: cloneDeep(players),   // ターン前のスコア・履歴
  activePlayerIndex,             // ターン前の手番
}
```
以前は `confirmStage: "throwing"` も含めていたが、どこからも読まれない実質ダミー値だったため削除した（コード側も対応済み）。
PREV復元後の `confirmStage` は常に `setConfirmStage("throwing")` で固定するので、snap側に持つ必要がない。
将来 snap にフィールドを追加する場合は、「復元時に実際に読むか」を先に確認すること。読まないなら持たない。

### snap に保存しないもの・PREV時の扱い

| State | PREV時の扱い | 理由 |
|-------|------------|------|
| `winner` | `null` 固定 | gameover中はPREV不可なので常にnull。UI状態履歴は持たない |
| `confirmStage` | `"throwing"` 固定 | 直前ターンへの巻き戻しなので常にthrowing |
| `currentThrows` | `[]` 固定 | 投擲入力中でも直前ターンへ戻す |
| `editingThrowIndex` | `null` 固定 | 編集状態を引き継がない |
| `padMultiplier` | そのまま維持 | 入力補助UIでゲーム状態に影響しない |

将来 winner表示中にPREVを許可する要望が出た場合も、snapにUI状態を追加するのではなく、
まず `confirmStage` の遷移設計そのものを見直すこと（「PREVの対象を広げる」のではなく「gameoverに入る前のタイミングを変える」方向で検討する）。

### turnHistoryState はゲームの真実ではない

`turnHistoryState` はUX用の巻き戻し履歴であり、`players`（ゲームの唯一の真実）の正史ではない。
**保持上限は20ターン**（`.slice(-20)` でCPU・人間の両経路に実装済み）。

この上限は「メモリ/localStorageサイズの節約」のためだけにあり、ゲームルールとは無関係。
将来この値を変更する場合（例: `.slice(-50)` や無制限に戻す）は、必ずこのドキュメントの数値も同時に更新すること。
逆にここが更新されていない `.slice(-N)` を見つけたら、コードとドキュメントのどちらかが古い可能性がある。

---

## Ref 同期ルール

**本質は「再レンダリング後も古いクロージャから読まれる可能性がある値はRef化する」こと。**
非同期処理（`setTimeout`/`setInterval`/`Promise`）はこれが起きる典型例だが、唯一の例外ではない。
`window.addEventListener` のイベントハンドラ、`requestAnimationFrame` のコールバック、外部ライブラリへ渡すコールバックなど、
**Reactのレンダリングサイクルの外側で後から呼ばれるあらゆる関数**が同じ問題を持つ。
現状この境界はCPUの `useEffect`（内部で `setTimeout` を使う）だけだが、
将来 `window.addEventListener` や `requestAnimationFrame` を使う機能を追加した場合も、
そこから参照する state は同じ理由でRef化が必要になる。「CPUだから」「非同期だから」ではなく「クロージャの外から呼ばれるから」が条件。

| Ref | 対応 State | 用途 |
|-----|-----------|------|
| `playersRef` | `players` | CPUターンでのスコア参照 |
| `activePlayerIndexRef` | `activePlayerIndex` | CPUの手番確認 |
| `gameModeRef` | `gameMode` | 01 / countup 分岐 |
| `outModeRef` | `outMode` | バースト判定 |
| `bullTypeRef` | `bullType` | チェックアウト計算 |
| `cuRoundsRef` | `cuRounds` | CountUp終了判定 |
| `cpuDifficultyRef` | `cpuDifficulty` | CPUの精度 |
| `playerCountRef` | `playerCount` | 1P/2P終了判定 |
| `maxRoundsRef` | `maxRounds` | 01/クリケット共通のラウンド上限判定 |
| `winnerRef` | `winner` | 二重ゲームオーバー防止 |
| `currentThrowsRef` | `currentThrows` | OK確定時の最新投擲取得 |

---

## localStorage 保存・復元チェックリスト

新しい State を追加するときは以下5点を必ず確認する。

```
1. useState 宣言
2. 再レンダリング後も読まれる可能性がある（Ref化が必要か）→ useRef 宣言 + .current 同期
3. localStorage 保存オブジェクトに追加
4. handleRestoreSave で復元処理を追加
5. PREV対象か？ → 以下の4択のどれかを必ず決める
   a. snap に保存し、PREV復元時に実際に読む
   b. PREV復元時は固定値にリセットする（例: winner→null, currentThrows→[]）
   c. PREVの影響を受けない（設定Stateなど、ゲーム進行と無関係）
   d. まだ決めていない（要注意・後回しにしない）
```

5番目を忘れると今回の `winner` のような問題が起きる。「保存・復元は考えたが、PREVで戻すべきかは考えていなかった」状態を防ぐのが目的。`d`を選んだまま実装を進めないこと。

### 復元時のデフォルト値の選び方

`version` 管理を導入した今は、`||` ではなく `??` を使うことを推奨する。

- `boolean` → `d.field ?? false`
- `string` → `d.field ?? "defaultValue"`
- `number` → `d.field ?? defaultNumber`
- `null許容` → `d.field ?? null`

**`||` は `0` / `false` / `""` を意図せず潰す。** 例えば `maxRounds` が `0`（あり得るなら）を意味のある値として保存していた場合、`d.maxRounds || null` は `0` を `null` に変えてしまう。`??` は `null`/`undefined` のときだけフォールバックするので安全。

> 既存コードに `||` が残っている箇所は、影響範囲を確認しながら段階的に `??` へ置き換えていく。新規追加分は最初から `??` で統一する。

---

## 組み合わせテストマトリクス

| シナリオ | PREV | Save/Restore | CPU | 01ラウンド制限 |
|---------|------|-------------|-----|-------------|
| 01 / 1P / ∞ | — | — | — | — |
| 01 / 1P / 10R | — | — | — | ✅ |
| 01 / 2P / ∞ | ✅ | ✅ | — | — |
| 01 / 2P / 10R | ✅ | ✅ | — | ✅ |
| 01 / CPU / ∞ | ✅ | ✅ | ✅ | — |
| 01 / CPU / 10R | ✅ | ✅ | ✅ | ✅ ← 最重要 |
| CountUp / 1P | — | ✅ | — | — |
| CountUp / 2P | ✅ | ✅ | — | — |
| CountUp / CPU | ✅ | ✅ | ✅ | — |

**優先テストケース（01 / CPU / ラウンド制限）**

最初に置くべきは単体のPREVではなく、**PREVとCPUの往復**。実際に壊れるのはPREV単体ではなく、CPUとPREVが交互に発生するケースだから。

1. **CPU戦 → PREV → CPU戦 → PREV → CPU戦**（往復で `cpuTimerRef` / `turnHistoryState` / `winner` / `confirmStage` が壊れないか）← 最優先
2. CPU戦 → CPUターン中に PREV → 再開後の手番が正しいか
3. 301 / 3R制限 / CPU → 最終ターンCPUがチェックアウト → 正常終了か
4. 301 / 3R制限 / CPU → 最終ターン同点 → DRAW表示か
5. CPU戦 → セーブ → 復帰 → CPUターンが正常発火するか
6. CPU戦 → PREV 20回連打 → それ以上は PREV 不可になるか

---

## CPU Difficulty Parameters

`CPU_DIFFICULTY` は実質的に**ゲーム設定の一部**であり、ロードマップ（将来やること）ではなく現在の仕様として独立章にしている。半年後に難易度を追加・調整するときはここを最初に見ること。

| パラメータ | 意味 | 範囲 |
|-----------|------|------|
| `spread` | 通常ショットの精度を表すパラメータ。数値が大きいほど低精度（具体的な使われ方は `cpuComputeThrow` を参照） | 数値が大きいほど低精度 |
| `dropChance` | 1投ごとの「投げ損ない(MISS)」発生確率（0〜1）。`cpuPlayTurn`のループ内で、対象ダーツ(i)が`dropDarts`範囲に入っているときのみ判定される | 0〜1 |
| `dropDarts` | 1ターン3投のうち、終盤何投が`dropChance`判定の対象になるか。例: `dropDarts=1`なら3投目だけが対象、`dropDarts=2`なら2,3投目が対象。`0`にすると一切ドロップしない | 0〜2 |
| `checkoutHitProb` | チェックアウトルートを狙った際に成功する確率（0〜1）。`findCheckoutRoute`で有効なルートが見つかった場合のみ参照される。失敗時は通常ショット計算にフォールバックする | 0〜1 |

```js
const CPU_DIFFICULTY = {
  easy:   { spread: 55, dropChance: 0.40, dropDarts: 2, checkoutHitProb: 0.10 },
  medium: { spread: 35, dropChance: 0.18, dropDarts: 1, checkoutHitProb: 0.30 },
  hard:   { spread: 20, dropChance: 0.08, dropDarts: 1, checkoutHitProb: 0.60 },
  pro:    { spread: 8,  dropChance: 0.02, dropDarts: 0, checkoutHitProb: 0.82 },
};
```

**設計原則**: 難易度を表すパラメータは全てこの1オブジェクトに集約する。`hitProbMap` のような別管理のオブジェクトを新設しない。新しいパラメータ（例: 高得点残しを優先する `leaveBias` など）を追加する場合も、必ずこのテーブルの一行として追加し、このドキュメントの表も同時に更新する。

> 将来追加が想定されるパラメータの例: `leaveBias`（フィニッシュしやすい残り点数、例えば170/167/164などへの誘導を優先するか）。easyは「とにかく高得点狙い」、proは「フィニッシュ残しを優先」のような挙動分岐に使える。

---

## 今後の拡張ロードマップ

### 1. セーブデータ migration
`migrateSaveData(save)` の枠を用意済み（`CURRENT_SAVE_VERSION` 定数で管理）。
現在は中身が空（変換不要）。次回 `version` を上げるときは:
1. `CURRENT_SAVE_VERSION` を増やす
2. `switch (v)` 内に旧バージョンからの変換処理を追加

**実例（v7→v8）**: `o1MaxRounds` を `maxRounds` にリネームし、クリケットにも同じラウンド上限を適用できるよう汎用化した。`case 7` で `save.o1MaxRounds` を `save.maxRounds` にコピーするフィールドリネーム変換を追加（`case 6` からのフォールスルーで、v0〜v7のどのセーブも通過する）。
3. 新規追加フィールドは `handleRestoreSave` のデフォルト値補完と二重管理にならないよう、極力 `migrateSaveData` 側に寄せる

**未来バージョンを読んだ場合の方針（実装済み）**
`save.version > CURRENT_SAVE_VERSION` の場合、`migrateSaveData` は `null` を返し、復元を拒否する。
このとき localStorage のデータは削除しない（アプリを更新すれば読める可能性があるため）。
将来UIで明示的なトースト通知（「このセーブデータは新しいバージョンで作成されています」）を出す場合は、
`handleRestoreSave` が `false` を返した呼び出し元で、拒否理由（期限切れ/破損/未来バージョン）を区別できるようにすると親切。現状は全て `false` で一括りなので、必要になったら戻り値を `{ ok: boolean, reason?: string }` に拡張する。

**将来の分岐点: validation と migration の分離**
現在 `migrateSaveData` は「未来バージョンの拒否」と「旧バージョンの変換」の両方を担っている。
これは規模的にまだ問題にならないが、以下のようなケース（バリデーションの責務）が増えてきたら分離を検討する：
- version不正（数値ではない、負数など）
- 必須フィールドの欠落（`players`が配列でない等）
- 型破損（`activePlayerIndex`が文字列になっている等）
- JSON自体の改ざん・手動編集

理想形：
```js
const validated = validateSaveData(parsed); // 構造的に正しいかだけ見る
if (!validated.ok) return false;
const migrated = migrateSaveData(validated.data); // バージョン間の変換だけ見る
```
`validateSaveData` が「形式として読めるか」、`migrateSaveData` が「古い形式を新しい形式に変換できるか」を担当する形に分けると、責務が明確になる。version管理を始めた今がこの分岐点であることは認識しておく。

### 2. ロジックの論理整理（実施済み）と物理分割（保留中）

**現状（実施済み）**: 物理ファイル分割はまだ行わず、`app.js` 単一ファイル内に以下10個のセクション見出し（`◆ SECTION:`コメント）を追加し、責務ごとの境界を明示している。

```
◆ Constants                                  — WEDGES, MAX_THROWS_PER_TURN, 各種定数
◆ Checkout Logic                             — ARRANGE_TABLE, BOGEY_SETUP_TABLE,
                                                getSteelDartsArrangement, findCheckoutRoute
◆ Round & Throw Helpers                      — cloneDeep, getSubtotal, normalizeOutMode,
                                                getRoundState, getHitSoundType, getThrowFromCoords
◆ Scoring Logic (Leave Quality)              — compactRoute, BOGEY_NUMBERS, PREFERRED_LEAVES,
                                                LEAVE_PRIORITY, scoreLeaveQuality
◆ CPU Difficulty                             — CPU_DIFFICULTY
◆ CPU Strategy                               — cpuComputeThrow, cpuPlayTurn
◆ Scoring Logic (Assist Output) — つづき      — findHighScorePlan, buildAssistLine,
                                                buildCountUpAssist
◆ React Component — Shared UI Pieces         — Icons, FliqloDigit, FliqloScoreboard, PlayerCockpit
◆ React Component — Main App                 — function App() 本体
◆ Save / Restore Helpers (App内部)            — migrateSaveData, handleRestoreSave 周辺
```

「Round & Throw Helpers」と「React Component — Shared UI Pieces」は元々の切り出し単位案（`checkout.js`/`scoring.js`/`difficulty.js`/`strategy.js`の4分類）には無かった領域。`getRoundState`等はCheckout/Scoring双方から参照される共通基盤のため、無理にどちらかへ分類すると依存関係の見通しが悪化すると判断し、独立セクションとして追加した。

このセクション整理は **コメント追加のみ**（関数の中身・順序・state構造は無変更）で、git diffで `+` 行が全てコメント行であることを確認済み（削除行0、追加行は全て`//`または空行）。

**物理ファイル分割（まだ実施しない）**: 上記セクションがそのまま将来の切り出し単位の候補になる。
```
checkout.js    → ARRANGE_TABLE, BOGEY_SETUP_TABLE, getSteelDartsArrangement, findCheckoutRoute
scoring.js     → compactRoute, BOGEY_NUMBERS, PREFERRED_LEAVES, LEAVE_PRIORITY,
                 scoreLeaveQuality, findHighScorePlan, buildAssistLine, buildCountUpAssist
difficulty.js  → CPU_DIFFICULTY
strategy.js    → cpuComputeThrow, cpuPlayTurn
（命名未定）    → cloneDeep, getSubtotal, normalizeOutMode, getRoundState,
                 getHitSoundType, getThrowFromCoords （Checkout/Scoring共通基盤）
```
物理分割の実施判断は「動く→仕様固める→利用者に触ってもらう→問題箇所が見える→そこで分割」の順を優先し、機能が安定するまでは保留する。分割までは、この範囲の関数が外部state/propsに依存しないよう純粋関数を保つことを優先する。

`CPU_DIFFICULTY` の各パラメータの意味は「CPU Difficulty Parameters」章を参照。

### 3. history の寿命設計
`players[].history` は統計計算の元データであり、`players`全体（設計原則1）の一部として現状は上限なく増え続ける。
1ゲーム単位では問題ないが、将来「複数ゲームを通した統計」を持つ場合は注意が必要。
- 1ゲーム内の `history` に上限は設けない（ゲーム自体の正しさに直結するため安易に切らない）
- 複数ゲームを跨ぐ統計（ベストレグ、通算PPDなど）を持つ場合は、**ゲーム用の履歴と統計用の履歴を分ける**か、
  ゲーム終了時に集計値だけを別途永続化し、生の `history` 配列はゲームをまたいで保持しない設計にする
- 「何百ゲームも遊ぶと重くなる」問題が出たら、まずは統計用ストレージを分離してから `history.slice(-N)` のような上限を検討する。先に上限を入れると、巻き戻しや統計の正確性を壊しやすい

### 4. Stats機能（PPD / MPR / AVG / CHECKOUT率）追加時の注意

**統計は state にしない。`players[].history` から導出する。**

```js
const stats = calculateStats(players); // ◯ 派生値として計算
const [stats, setStats] = useState(...); // ✕ 二重管理の元
```

`players` と `stats` を両方stateで持つと、PREVでplayersが戻った時にstats更新を忘れて平均値だけズレる、という典型的なバグが起きる。`calculateStats` のような純粋関数で都度計算すれば、PREV/Restore/CPUのどの経路でも自動的に整合する。

追加する際は以下を必ず再検証すること：
- **Bust**: バーストしたラウンドを統計の分母（投擲数）に含めるか、除外するかを最初に仕様として決める
- **PREV**: 統計をstateにしていれば「巻き戻し後も古い統計が残る」事故が起きるが、`calculateStats(players)` 方式なら自動的に解決する
- **CPU**: CPUの統計を人間と同じ計算ロジックで出すか、別枠にするか。CPUの投擲データは `cpuPlayTurn` の戻り値にバースト時の投擲も含まれるため、集計時にダブルカウントしないよう注意

---

## 設計原則まとめ（1行版）

> **すべての状態遷移は「UI状態」と「履歴状態」を分離して考え、PREVのみが履歴（`turnHistoryState`）を変更する唯一の操作である。**

この一文が崩れたとき（CLEARやその他の操作が`turnHistoryState`を消費し始めたとき）、PREV系のバグが再発する。
