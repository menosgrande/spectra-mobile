/* core/texture.js — board texture & classifiers. Deps: utils.js */

function calcBoardTexture(board) {
  if (board.length < 3) return null;

  const ranks = board.map(c => RANK_IDX[c[0]]);
  const suits = board.map(c => c[1]);
  const sorted = [...ranks].sort((a, b) => a - b);

  // Connectivity
  let gaps = 0;
  for (let i = 1; i < sorted.length; i++) {
    gaps += sorted[i] - sorted[i - 1];
  }
  const connect = Math.max(0, Math.round(100 - gaps * 8));

  // Flush pressure
  const suitCounts = {};
  suits.forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);
  const maxSuit = Math.max(...Object.values(suitCounts));
  const flush = Math.round((maxSuit / board.length) * 100);

  // Overall wetness
  const wet = Math.round((connect + flush) / 2);

  let texture;
  if (wet >= 85) texture = 'VERY_WET';
  else if (wet >= 65) texture = 'WET';
  else if (wet >= 45) texture = 'SEMI_WET';
  else if (wet >= 20) texture = 'DRY';
  else texture = 'VERY_DRY';

  const lbl = wet>=80 ? 'VERY WET / 非常に危険'
            : wet>=60 ? 'WET / 危険'
            : wet>=40 ? 'SEMI-WET / やや危険'
            : wet>=20 ? 'DRY / 安全'
            : 'VERY DRY / 安全';

  return {
    wet, connect, flush, texture, lbl,
    connectivityScore: connect,
    flushScore: flush,
    wetnessScore: wet
  };
}


function classifyConnectivity(board) {
  const ranks = board.map(c => RANK_IDX[c[0]]);
  const sorted = [...ranks].sort((a, b) => a - b);
  const unique = [...new Set(sorted)].length;

  // v3.9.32: 他AIレビューで指摘・ユーザー確認済み。A-2-3のようなホイール系
  // ローボードは、Aceをhigh側(通常のindex=0のまま)扱うと極端なgapになり
  // DISCONNECTED誤判定になっていた（例: A-2-3のgapsが12相当になってしまう）。
  // このRANK_IDXは'AKQJT98765432'順（A=0が最小、2=12が最大）なので、
  // Aceをlow側として扱う場合は「2(index12)よりさらに1つ先」の index=13 として
  // 扱う（-1ではなく13にする点に注意。逆方向の並びのため）。
  // その上でAceをhigh(0)のままの場合とlow(13)の場合の両方でgapsを計算し、
  // より小さい方（＝より繋がっている方）を採用する。
  function computeGaps(arr) {
    const s = [...arr].sort((a, b) => a - b);
    let g = 0;
    for (let i = 1; i < s.length; i++) g += s[i] - s[i - 1];
    return g;
  }
  const hasAce = ranks.includes(0);
  const lowRanks = hasAce ? ranks.map(r => (r === 0 ? 13 : r)) : null;

  if (unique === 5) {
    // Check for straight
    for (let k = 0; k <= sorted.length - 5; k++) {
      if (sorted[k + 4] - sorted[k] === 4) {
        return 'HIGHLY_CONNECTED';
      }
    }
    if (hasAce) {
      const lowSorted = [...lowRanks].sort((a, b) => a - b);
      for (let k = 0; k <= lowSorted.length - 5; k++) {
        if (lowSorted[k + 4] - lowSorted[k] === 4) {
          return 'HIGHLY_CONNECTED';
        }
      }
    }
  }

  let gaps = computeGaps(ranks);
  if (hasAce) gaps = Math.min(gaps, computeGaps(lowRanks));

  if (gaps <= 2) return 'HIGHLY_CONNECTED';
  if (gaps <= 4) return 'CONNECTED';
  if (gaps <= 6) return 'LOW_CONNECTED';
  return 'DISCONNECTED';
}


function classifyFlushPressure(board) {
  const suits = board.map(c => c[1]);
  const suitCounts = {};
  suits.forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);
  const maxSuit = Math.max(...Object.values(suitCounts));

  if (board.length === 3) {
    if (maxSuit === 3) return 'THREE_FLUSH';
    if (maxSuit === 2) return 'TWO_FLUSH';
    return 'RAINBOW';
  }

  // v3.9.32: 他AIレビューで指摘・ユーザー確認済み。5枚全て同スート(リバーでの
  // 5-flush)の場合、maxSuit===5はどの分岐にも該当せず誤ってRAINBOWに落ちていた。
  if (maxSuit >= 5) return 'FIVE_FLUSH';
  if (maxSuit === 4) return 'FOUR_FLUSH';
  if (maxSuit === 3) return 'THREE_FLUSH';
  if (maxSuit === 2) return 'TWO_FLUSH';
  return 'RAINBOW';
}


function classifyPairStructure(board) {
  const ranks = board.map(c => c[0]);
  const freq = {};
  ranks.forEach(r => freq[r] = (freq[r] || 0) + 1);
  const counts = Object.values(freq).sort((a, b) => b - a);

  // v3.9.32: 他AIレビューで指摘・ユーザー確認済み。クアッズボード(counts[0]===4)
  // に該当する分岐が存在せず、UNPAIRED誤判定になっていた。下流(deriveHudSignals
  // のQUADS_BOARD加点・BOARD_LOCKED等)は既にQUADS_BOARDという値を期待していたが、
  // この関数が一度もその値を返していなかったため到達不能だった。
  // なお counts[0]===3 && counts[1]===2（フルハウスボード）は今回スコープ外
  // としてTRIPS_BOARD命名のまま維持（FULL_HOUSE_BOARDへの分離は下流の重み表を
  // 別途監査してから行うべきなので、意図的に見送っている）。
  if (counts[0] === 4) return 'QUADS_BOARD';
  if (counts[0] === 3 && counts[1] === 2) return 'TRIPS_BOARD';
  if (counts[0] === 3) return 'TRIPS_BOARD';
  if (counts[0] === 2 && counts[1] === 2) return 'DOUBLE_PAIRED';
  if (counts[0] === 2) return 'PAIRED';
  return 'UNPAIRED';
}


function classifyRankStructure(board) {
  const highRanks = board.filter(c => {
    const r = c[0];
    return ['A', 'K', 'Q', 'J', 'T'].includes(r);
  }).length;

  const lowRanks = board.filter(c => {
    const r = c[0];
    return ['5', '4', '3', '2'].includes(r);
  }).length;

  const midRanks = board.length - highRanks - lowRanks;

  if (highRanks >= 2) return 'HIGH';
  if (lowRanks >= 2) return 'LOW';
  if (midRanks >= 2) return 'MID';
  return 'MIXED';
}
