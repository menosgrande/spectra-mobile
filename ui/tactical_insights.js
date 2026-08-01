/**
 * SPECTRA — Tactical Insights
 *
 * structureFeatures（polarization / drawStructure / coverage / dominance / entropy）
 * から戦術タグ（TACTICAL INSIGHTS）文言を生成する純粋関数。
 *
 * 元は index.html 内の単一 <script> に埋め込まれていたが、
 * 「盤面構造 → 戦略的意味づけ」という役割が独立しているため分離。
 *
 * 読込み: index.html から <script src="ui/tactical_insights.js"></script> として
 *         メインの <script> より前に読み込む（グローバル関数として提供）。
 * 依存:   なし（sf オブジェクトを受け取るだけの純粋関数）
 */

function generateTacticalInsights(sf) {
  if (!sf) return [];
  const tags = [];
  const pol = sf.polarization ?? 0;
  const drw = sf.drawStructure ?? 0;
  const cov = sf.coverage ?? 0;
  const dom = sf.dominance ?? 0;
  const ent = sf.entropy ?? 0;

  // 1. 二極化度合い（POLARIZATION）に応じた戦略
  if (pol >= 60) {
    tags.push({ tag: '⚡ POLARIZED RANGE', color: '#ff3b3b', text: 'ナッツとエアーの二極化。Overbet(75%+ Pot) や Check-Raise に非常に適した盤面構造' });
  } else if (pol <= 38 && cov >= 50) {
    tags.push({ tag: '🛡️ CONDENSED / CAP', color: '#00ff9d', text: 'レンジキャップド傾向。Check-Back や Delay C-Bet によるレンジ保護・Check-Raise警戒が有効' });
  }

  // 2. ドロー構造（DRAW STRUCTURE）に応じた戦略
  if (drw >= 65) {
    tags.push({ tag: '🌊 DYNAMIC & HEAVY DRAW', color: '#ffb800', text: '多重ドロー豊富。相手にフリーカードを与えない Protection Bet (66% Pot) や Multi-Street 連続打撃が有効' });
  } else if (drw <= 30) {
    tags.push({ tag: '🌵 DRY & STATIC BOARD', color: '#00d4ff', text: 'ドロー少の静的盤面。スモールC-Bet(25-33%) による高頻度Range Bet または Check-Back で波乱防止' });
  }

  // 3. ナッツ支配・レンジアドバンテージ（DOMINANCE & COVERAGE）
  if (dom >= 60) {
    tags.push({ tag: '👑 NUT ADVANTAGE', color: '#a855f7', text: 'ナッツ層の偏重。強気のレンジアプレッシャーやアグレッシブな3-Barrelで相手に圧力をかけやすい' });
  } else if (cov >= 60 && pol < 50) {
    tags.push({ tag: '🎯 MEDIUM DENSITY', color: '#00ff9d', text: '中手ヒット層が豊富。Check/Call ラインやスモールベットによるShowdown Valueの回収が有効' });
  }

  // 4. アクション複合指針 (Check-Raise, Check-Back, Probe Bet, Delay C-bet)
  if (pol >= 48 && drw >= 45) {
    tags.push({ tag: '⚔️ CHECK-RAISE HIGH', color: '#ff7c00', text: '強手と強ドローを混ぜた Check-Raise / Semi-Bluff ベットラインの期待値が高い' });
  } else if (drw < 40 && pol < 50) {
    tags.push({ tag: '↩️ CHECK-BACK OPTION', color: '#29b6f6', text: 'インポジション(IP)時、Showdown Value維持のための Check-Back → ターン Delay C-Bet が好選択肢' });
  }

  if (ent >= 68) {
    tags.push({ tag: '🌀 COMPLEX SPLIT', color: '#3b82f6', text: '戦略分岐が複雑。同一ハンド群でも Bet/Check の混合戦略（Split Strategy）を採用' });
  }

  // フォールバック（タグが空の場合）
  if (tags.length === 0) {
    tags.push({ tag: '⚖️ BALANCED ACTION', color: '#00d4ff', text: 'バランス型構造。ポジションに応じて Range Bet / Check-Back / Check-Call を柔軟に切り替え' });
  }

  return tags;
}
