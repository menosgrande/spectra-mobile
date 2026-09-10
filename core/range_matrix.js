/* core/range_matrix.js — 169 matrix, draw classif, range stats. Deps: utils, strength, texture, position */

function classifyPotential(hand, board) {
  if (board.length < 3) return 0;
  // バグ修正: 以前はboard.length<3のガードしかなく、リバー(5枚)でも
  // フロップ/ターンと同じロジックでpotentialStrengthを計算していた。
  // リバーは次のカードが来ないため「ドローの伸びしろ」という概念自体が
  // 存在せず、常に0であるべき。
  if (board.length >= 5) return 0;

  // ── Flush draw potential ──
  // バグ修正: 以前はスーテッドハンドを「4コンボ全部がそのスートを持つ」かのように
  // 重み1.0で扱っていたが、実際にはAKs等の4コンボ（各スート1つずつ）のうち、
  // ボードの特定の1スートと一致するのは1コンボだけ（25%）。残り3コンボは
  // その特定スートとは無関係（ボードが完全レインボーならさらに別スートと
  // 一致し得るが、それは別カテゴリの内訳＝categoryBreakdownで表現する話であり、
  // ここでの◥バッジの数値は「代表的な一致コンボ」の重みとして25%が正しい）。
  // ペア: hand[2]はundefinedだが、6コンボ中3コンボ(50%)は特定の1スートと一致する
  // （例: AAの6通りのうち、スペードを含むのは3通り）。
  const isSuited  = hand[2] === 's';
  const isPair    = hand[0] === hand[1] && hand[2] === undefined;
  const suitedWeight = isSuited ? 0.25 : (isPair ? 0.5 : 0);
  let hasFlushDraw = false, hasBackdoorFD = false;
  if (suitedWeight > 0) {
    // Find which suit this hand would be — we don't know the specific suit here,
    // so we check the most common suit on the board (proxy for flush draw presence)
    const suitCounts = {};
    board.forEach(c => suitCounts[c[1]] = (suitCounts[c[1]] || 0) + 1);
    const maxSuitOnBoard = Math.max(...Object.values(suitCounts));
    // バグ修正（v3.9.47、他AIレビュー指摘・実測検証済み）: スーテッドハンドは
    // 2枚とも同じ1スートを共有するため、そのスートについて「board+hand」の
    // 合計はmaxSuitOnBoard+2。一方ペアは2枚が必ず異なるスートなので、特定の
    // 1スートに寄与できるのは最大1枚だけ、合計はmaxSuitOnBoard+1。
    // 以前はこの違いを無視し、ペアにもスーテッドと同じ閾値（===2→FD, ===1→BD-FD）
    // を使っていたため、ペアの判定が実際より1段階ズレていた
    // （例: 33 on 3-flushフロップ=本物のFDなのにnull、33 on rainbowフロップ
    // =フラッシュ到達が数学的に不可能なのにBD-FDという「幽霊ドロー」を検出していた）。
    // さらにBD-FD（バックドア、残り2枚が必要）はturn以降（残り1枚）では成立
    // し得ないため、board.length===3（フロップ）限定のガードも追加した
    // （以前はturnでもBD-FDが誤って発火し、幽霊のoutsがUIに流れていた）。
    if (isSuited) {
      hasFlushDraw  = maxSuitOnBoard === 2;
      hasBackdoorFD = maxSuitOnBoard === 1 && board.length === 3;
    } else if (isPair) {
      hasFlushDraw  = maxSuitOnBoard === 3;
      hasBackdoorFD = maxSuitOnBoard === 2 && board.length === 3;
    }
  }

  // ── Straight draw potential ──
  // Use hand ranks + board ranks; check for 4-card straight draws
  const ri1 = RANK_IDX[hand[0]];
  const ri2 = hand[1] && hand[1] !== 's' && hand[1] !== 'o' ? RANK_IDX[hand[1]] : null;
  const boardRanks = board.map(c => RANK_IDX[c[0]]);
  const allRanks = ri2 !== null
    ? [...new Set([ri1, ri2, ...boardRanks])].sort((a, b) => a - b)
    : [...new Set([ri1, ...boardRanks])].sort((a, b) => a - b);

  let hasOESD = false;
  let hasGSD  = false;

  // バグ修正: allRanks内に「5枚連続」＝完成済みストレートが既に存在する場合、
  // その中の4枚部分集合が偶然OESDパターン（span===3）に一致してしまい、
  // 「役が完成しているのに、さらにドローの伸びしろがある」という
  // 二重計上バグが起きていた（例: J-Q-A盤面でK-Tsが完成ブロードウェイなのに
  // OESD+0.40が上乗せされ、最終スコアが閾値をまたいでhandNameが誤表示される）。
  // → 5枚連続が既に成立している場合は、それはmadeStrength側の仕事なので
  //   ここでは追加のOESD/GSD potentialを与えない。
  // ホイール(A-2-3-4-5)はAceがlow側にも回るため、Aceを13として扱う別配列でも判定する。
  const straightCheckRanks = allRanks[0] === 0 ? [...allRanks, 13] : allRanks;
  let hasMadeStraight = false;
  for (let k = 0; k <= straightCheckRanks.length - 5; k++) {
    if (straightCheckRanks[k + 4] - straightCheckRanks[k] === 4) { hasMadeStraight = true; break; }
  }

  if (!hasMadeStraight) {
    // v3.9.31: 他AIレビューで指摘・検証済みのCriticalバグ修正。
    // 以前はallRanks（ホールカード+ボードの合成ランク集合）の中から
    // span===3(OESD)/span===4(GSD)の4連続窓を探すだけで、その窓が
    // 「ボードのランクだけで完結している」かどうかをチェックしていなかった。
    // 例: ターンJ-T-9-8（4連続ボード）でHeroがA-K（ランク的に無関係）を持っていても、
    // allRanks=[6,7,8,9,11,12]の中の[6,7,8,9]窓がOESD判定され、全169ハンドが
    // 一律でOESD扱いになっていた（ボードがストレートに化ける確率は
    // computeBoardStraightPctの仕事であり、ここはHero固有のドロー判定であるべき）。
    // → 窓の4ランクのうち少なくとも1つがホールカード由来(ri1/ri2)であることを必須にした。
    for (let k = 0; k <= allRanks.length - 4; k++) {
      const w0 = allRanks[k], w1 = allRanks[k + 1], w2 = allRanks[k + 2], w3 = allRanks[k + 3];
      const holeInWindow = w0 === ri1 || w1 === ri1 || w2 === ri1 || w3 === ri1
        || (ri2 !== null && (w0 === ri2 || w1 === ri2 || w2 === ri2 || w3 === ri2));
      if (!holeInWindow) continue;
      const span = w3 - w0;
      if (span === 3) { hasOESD = true; break; }
      if (span === 4) hasGSD = true;
    }
  }

  // ── Score ──
  // FD  = 0.45 (9 outs), OESD = 0.40 (8 outs), GSD = 0.20 (4 outs), BD-FD = 0.10 (目安)
  // ペアはsuitedWeight(0.5)で按分。Combos: FD+OESD can coexist → cap at 0.85
  let potential = 0;
  if (hasFlushDraw)       potential += 0.45 * suitedWeight;
  else if (hasBackdoorFD) potential += 0.10 * suitedWeight;
  if (hasOESD)      potential += 0.40;
  else if (hasGSD)  potential += 0.20;

  return Math.min(0.85, potential);
}


// v3.9.34: 他AIレビュー指摘・ユーザー確認済み。classifyDraw()は「1ハンド=1タグ」の
// 早期return方式（ストレートドローが見つかったらフラッシュドロー判定へは進まない）
// のため、ストレートドローとフラッシュドローが同時に存在するコンボドロー
// （例: 9-8suited on T-7-2ツートーン＝OESD+FD）でも必ずどちらか一方しか
// タグ付けされない。そのためcomputeStructureFeatures()内のdrawOverlap
// （fdSet ∩ sdSet）は構造上常に空集合＝0%になっており、drawStructure特徴量の
// 0.20の重みが常に死んでいた（STRUCTURE RADARのDRW軸・generateTacticalInsights
// のDRAW POTENTIAL分類の両方に影響）。ブルートフォース確認：ドライな
// レインボーフロップでは0/169だが、ウェットな2トーン・コネクテッドフロップ
// （例: T♠7♠8♦）では35/169ハンドが実際にコンボドロー該当だった。
// classifyDraw()自体の「1ハンド1タグ」という既存の返り値の形はNUTSバッジ・
// ヒートマップのglow色等、多くの消費側が前提にしているため変更せず、
// drawOverlap計算専用に、フラッシュドロー該当とストレートドロー該当を
// それぞれ独立に（早期returnなしで）判定する軽量ヘルパーを別途用意した。
function hasComboDraw(hand, board) {
  if (!board || board.length < 3 || board.length >= 5) return false;

  const ri1 = RANK_IDX[hand[0]];
  const ri2 = RANK_IDX[hand[1]];
  const boardRanks = board.map(c => RANK_IDX[c[0]]).sort((a, b) => a - b);
  const allRanks = [...new Set([ri1, ri2, ...boardRanks])].sort((a, b) => a - b);

  const straightCheckRanks = allRanks[0] === 0 ? [...allRanks, 13] : allRanks;
  let hasMadeStraight = false;
  for (let k = 0; k <= straightCheckRanks.length - 5; k++) {
    if (straightCheckRanks[k + 4] - straightCheckRanks[k] === 4) { hasMadeStraight = true; break; }
  }

  let hasStraightDraw = false;
  if (!hasMadeStraight) {
    for (let k = 0; k <= allRanks.length - 4; k++) {
      const w0 = allRanks[k], w1 = allRanks[k + 1], w2 = allRanks[k + 2], w3 = allRanks[k + 3];
      const holeInWindow = w0 === ri1 || w1 === ri1 || w2 === ri1 || w3 === ri1
        || w0 === ri2 || w1 === ri2 || w2 === ri2 || w3 === ri2;
      const span = w3 - w0;
      if (holeInWindow && (span === 3 || span === 4)) { hasStraightDraw = true; break; }
    }
  }

  const isSuited = hand[2] === 's';
  const isPair   = hand[0] === hand[1] && hand[2] === undefined;
  let hasFlushDraw = false;
  if (isSuited || isPair) {
    const suitCounts = {};
    board.forEach(c => suitCounts[c[1]] = (suitCounts[c[1]] || 0) + 1);
    const maxSuitCount = Math.max(...Object.values(suitCounts));
    // バグ修正（v3.9.48、他AIによる2回目の独立監査で指摘）: classifyDraw/
    // classifyPotential（v3.9.47で修正済み）と全く同じ閾値誤共用バグが
    // この関数にも独立に存在していた。hasComboDraw()はcomputeStructureFeatures()
    // のdrawOverlap専用に独自のフラッシュ判定を持っており、v3.9.47の修正が
    // ここには波及していなかった（UIのタグには出ないが、STRUCTURE RADARの
    // DRW軸に歪みが残っていた）。スーテッドは2枚とも同スート(+2)、ペアは
    // 1枚しか寄与できない(+1)ため閾値を分ける。ここでは「本物のFD」のみを
    // 判定すればよく（backdoorはコンボドローの定義に含めない）、BD-FDの
    // ケースは扱わない。
    if (isSuited)    hasFlushDraw = maxSuitCount === 2;
    else if (isPair) hasFlushDraw = maxSuitCount === 3;
  }

  return hasStraightDraw && hasFlushDraw;
}


function classifyDraw(hand, board) {
  if (board.length < 3) return null;
  // バグ修正: 同上。リバー(5枚)ではドロー概念自体が存在しないため、
  // FD/OESD/GSD/BD-FDのようなタグを一切付けない。
  if (board.length >= 5) return null;

  // hand format: "AA" (pair), "AKs" (suited), "KAo" (offsuit)
  // hand[0] = rank1, hand[1] = rank2 (or 2nd rank char for pairs = same as [0])
  // hand[2] = 's' | 'o' | undefined (pairs have no suffix)
  const ri1 = RANK_IDX[hand[0]];
  // For pairs: hand[1] is the same rank letter, not a suit
  const ri2 = RANK_IDX[hand[1]]; // always a rank index (A-2)
  const boardRanks = board.map(c => RANK_IDX[c[0]]).sort((a, b) => a - b);
  const allRanks = [...new Set([ri1, ri2, ...boardRanks])].sort((a, b) => a - b);

  // ── Straight draw checks ──
  // バグ修正: classifyPotentialと同様、5枚連続（完成済みストレート）が
  // 既に存在する場合は、それを「ドロー」として二重にタグ付けしない。
  // ホイール(A-2-3-4-5)はAceをlow(13扱い)にした配列でも判定する。
  const straightCheckRanks = allRanks[0] === 0 ? [...allRanks, 13] : allRanks;
  let hasMadeStraight = false;
  for (let k = 0; k <= straightCheckRanks.length - 5; k++) {
    if (straightCheckRanks[k + 4] - straightCheckRanks[k] === 4) { hasMadeStraight = true; break; }
  }

  if (!hasMadeStraight) {
    // v3.9.31: classifyPotentialと同じCriticalバグ修正。ホールカードが窓に
    // 参加していないボードオンリーの4連続窓をOESD/GSDとして誤検出しないようにする。
    // OESD: 4 cards spanning exactly 3 ranks (e.g. 5678)
    for (let k = 0; k <= allRanks.length - 4; k++) {
      const w0 = allRanks[k], w1 = allRanks[k + 1], w2 = allRanks[k + 2], w3 = allRanks[k + 3];
      const holeInWindow = w0 === ri1 || w1 === ri1 || w2 === ri1 || w3 === ri1
        || w0 === ri2 || w1 === ri2 || w2 === ri2 || w3 === ri2;
      if (holeInWindow && w3 - w0 === 3) {
        return 'OESD';
      }
    }

    // GSD: 4 cards spanning exactly 4 ranks with one gap (e.g. 5679)
    for (let k = 0; k <= allRanks.length - 4; k++) {
      const w0 = allRanks[k], w1 = allRanks[k + 1], w2 = allRanks[k + 2], w3 = allRanks[k + 3];
      const holeInWindow = w0 === ri1 || w1 === ri1 || w2 === ri1 || w3 === ri1
        || w0 === ri2 || w1 === ri2 || w2 === ri2 || w3 === ri2;
      if (holeInWindow && w3 - w0 === 4) {
        return 'GSD';
      }
    }
  }

  // ── Flush draw checks (suited hands + pairs) ──
  // hand[2] === 's' means the hand notation is suited; pair hands have no [2].
  // バグ修正: ペアは6コンボ中3コンボ(50%)が特定スートと一致するため、
  // 完全に除外せずFD/BD-FDタグの対象に含める（数値側の重みはclassifyPotential参照）。
  const isSuited = hand[2] === 's';
  const isPair   = hand[0] === hand[1] && hand[2] === undefined;
  if (isSuited || isPair) {
    // We don't know the exact suit of the hand in the 169 canonical form,
    // but we know suited hands share one suit. Use board's most frequent suit
    // as a proxy: if the board has 2+ of the same suit, a suited hand will
    // have FD potential for that suit combination.
    const suitCounts = {};
    board.forEach(c => suitCounts[c[1]] = (suitCounts[c[1]] || 0) + 1);
    const maxSuitCount = Math.max(...Object.values(suitCounts));
    // バグ修正（v3.9.47、classifyPotentialと同一の根拠）: スーテッドハンドは
    // 2枚とも同じスートなのでboard+hand=maxSuitCount+2、ペアは1枚しか寄与
    // できないのでmaxSuitCount+1。閾値をisSuited/isPairで分け、BD-FD
    // （残り2枚必要）はフロップ限定（board.length===3）にガードする。
    if (isSuited) {
      if (maxSuitCount === 2) return 'FD';
      if (maxSuitCount === 1 && board.length === 3) return 'BD-FD';
    } else if (isPair) {
      if (maxSuitCount === 3) return 'FD';
      if (maxSuitCount === 2 && board.length === 3) return 'BD-FD';
    }
  }

  return null;
}


function eval169(board, hero) {
  const results = [];
  const boardSet = new Set(board);
  // Hero cards are removed from the available deck
  const heroSet  = new Set(hero || []);
  const deadSet  = new Set([...boardSet, ...heroSet]);

  for (let i = 0; i < 13; i++) {
    for (let j = 0; j < 13; j++) {
      const r1 = RANKS[i];
      const r2 = RANKS[j];
      let hand, evals = [], activeCombos = 0;

      if (i === j) {
        // Pair
        hand = r1 + r2;
        for (let s1 = 0; s1 < 4; s1++) {
          for (let s2 = s1 + 1; s2 < 4; s2++) {
            const c1 = r1 + SUITS[s1];
            const c2 = r1 + SUITS[s2];
            if (!deadSet.has(c1) && !deadSet.has(c2)) {
              activeCombos++;
              const e = evaluate7([c1, c2, ...board]);
              e.comboSuits = [SUITS[s1], SUITS[s2]]; // v3.9.11: どのスートの組み合わせか記録
              evals.push(e);
            }
          }
        }
      } else if (i < j) {
        // Suited
        hand = r1 + r2 + 's';
        for (let s = 0; s < 4; s++) {
          const c1 = r1 + SUITS[s];
          const c2 = r2 + SUITS[s];
          if (!deadSet.has(c1) && !deadSet.has(c2)) {
            activeCombos++;
            const e = evaluate7([c1, c2, ...board]);
            e.comboSuits = [SUITS[s]]; // v3.9.11: スーテッドは単一スート
            evals.push(e);
          }
        }
      } else {
        // Offsuit
        hand = r2 + r1 + 'o';
        for (let s1 = 0; s1 < 4; s1++) {
          for (let s2 = 0; s2 < 4; s2++) {
            if (s1 === s2) continue;
            const c1 = r2 + SUITS[s1];
            const c2 = r1 + SUITS[s2];
            if (!deadSet.has(c1) && !deadSet.has(c2)) {
              activeCombos++;
              const e = evaluate7([c1, c2, ...board]);
              e.comboSuits = [SUITS[s1], SUITS[s2]]; // v3.9.31: オフスートも追跡（Hero厳密照合用）
              evals.push(e);
            }
          }
        }
      }

      const totalCombos = i === j ? 6 : (i < j ? 4 : 12);

      // ── 代表コンボ（最高スコア）を選ぶ ──
      // 設計リファクタ（v3.7）: 以前は数値スコアの配列からMath.maxで
      // 最高値を取り、その数値からgetHandName()で役名を「逆算」していた。
      // これはボード補正やポテンシャル加算で数値が閾値を跨ぐたびに
      // 役名がズレるバグの温床だった（ロイヤル取り逃がし・トリップスが
      // ストレート扱い等、いずれもこの1session内で発見・修正済み）。
      // 今は evaluate7() が判定した「本物のカテゴリ」をそのまま運ぶため、
      // 数値がどれだけ揺れても「スコアと役名が食い違う」バグは構造上発生しない
      // （detectHandCategory自体の役判定ロジックが誤っていれば話は別）。
      let best = null;
      for (const e of evals) {
        if (!best || e.score > best.score) best = e;
      }
      const rawEval7 = best ? best.score : 0;

      const potStrength = classifyPotential(hand, board);
      const madeStr     = computeMadeStrength(rawEval7, board);
      const rawScore    = computeProjectedRawScore(madeStr, potStrength);

      // ── Live Combo数 ──
      // バグ修正: activeCombosは「dead cardでブロックされていないコンボ数」であって、
      // 「代表コンボと同じ役に到達したコンボ数」ではない。通常スートは対称なので
      // 問題にならないが、ボード自体に濃いフラッシュ関連（3+同スート等）がある場合、
      // スーテッドハンド4通りのうち実際にボードと同スートが揃うのは1通りだけ、
      // というケースが起きる（例: 4-flushボード+スーテッドハンド=ロイヤルは
      // 実質1コンボしかないのに、activeCombosは4のまま＝表示上「Live: 4」の誤表示）。
      // 代表コンボの category と直接一致するコンボだけを数える（スコアの逆算比較ではない）。
      const topClassCombos = best ? evals.filter(e => e.category === best.category).length : 0;

      // v3.9.11: カテゴリ内訳を「役名+件数」から「実際の強さ(平均madeStrength)+関与スート」に
      // 強化。例: モノトーンボードのAKsは「♠(1/4コンボ): 68%（フラッシュ）」
      // 「他(3/4コンボ): 42%（ハイカード）」のように、弱い方の実際の強さも数値で見える形にする。
      const categoryGroups = {};
      evals.forEach(e => {
        if (!categoryGroups[e.category]) {
          categoryGroups[e.category] = { count: 0, name: e.categoryName, score: e.score, scoreSum: 0, suitSet: new Set() };
        }
        const g = categoryGroups[e.category];
        g.count++;
        g.scoreSum += e.score;
        if (e.score > g.score) g.score = e.score;
        (e.comboSuits || []).forEach(s => g.suitSet.add(s));
      });
      const categoryBreakdown = Object.values(categoryGroups)
        .sort((a, b) => b.score - a.score)
        .slice(0, 12) // v3.9.31: 3→12に拡大。Hero厳密照合(renderHeroAnalysis)がスート単位で
        // 正しいグループを引けるよう、実質的に全カテゴリ(最大12コンボ=最大12カテゴリ)を保持する。
        .map(g => ({
          name:  g.name,
          count: g.count,
          avgMadeStrength: computeMadeStrength(g.scoreSum / g.count, board), // 0-1
          suits: [...g.suitSet] // 空配列 = オフスート等、スート特定なし
        }));

      results.push({
        hand:             hand,
        rawScore:         rawScore,
        madeStrength:     madeStr,
        potentialStrength: potStrength,
        class:            classifyHandClass(rawScore),
        handName:         best ? best.categoryName : 'HIGH CARD', // ← getHandName()による逆算をやめ、判定済みcategoryをそのまま使う
        activeCombos:     activeCombos,
        topClassCombos:   topClassCombos,
        totalCombos:      totalCombos,
        categoryBreakdown: categoryBreakdown,
        potential:        potStrength,    // alias: UI/rangeEngine との互換
        drawType:         classifyDraw(hand, board),
        outs:             Math.round(potStrength * 20) // potStrength = outs/20 から逆算
      });
    }
  }

  return results;
}


// v3.9.39: 「強さ目安 v1」— Hero自身の具体的な2枚を、現在のboard+heroを除いた
// 生存コンボ全体（具体的な2枚の組み合わせ単位）と直接比較し、stronger/tied/weaker
// を数える。169セルに集約されたeval169()の代表コンボ値を経由しないため、v3.9.31の
// ペア曖昧さ問題（カテゴリ集約後のsuits Setが和集合になり偽陽性を生む懸念）を
// 構造的に回避できる。対象はFlop/Turn/Riverのみ（board.length>=3が前提。
// evaluate7()は5枚未満のカードでは常にscore:0のハードコード値を返す仕様のため、
// Preflopではこの関数を呼ばないこと。呼び出し側でガードする）。
// madeStrengthでの比較を採用（computeMadeStrength()のboardHazardペナルティは
// board単位の定数でコンボ間では変わらないため、rawEval7に対する狭義単調増加の
// アフィン変換であり、rawEval7で比較してもmadeStrengthで比較しても順位は
// 数式上・実測上（5盤面×各1176コンボで検証済み）完全に一致する。madeStrengthに
// 揃えるのは他の計算箇所との一貫性のため）。
function computeHeroRank(board, hero) {
  const boardSet = new Set(board);
  const heroSet  = new Set(hero || []);
  const deadSet  = new Set([...boardSet, ...heroSet]);

  const heroRaw  = evaluate7([...hero, ...board]);
  const heroMade = computeMadeStrength(heroRaw.score, board);

  const deck = [];
  for (let i = 0; i < 13; i++) {
    for (let s = 0; s < 4; s++) {
      const c = RANKS[i] + SUITS[s];
      if (!deadSet.has(c)) deck.push(c);
    }
  }

  let strongerCount = 0, tiedCount = 0, weakerCount = 0;
  for (let i = 0; i < deck.length; i++) {
    for (let j = i + 1; j < deck.length; j++) {
      const e = evaluate7([deck[i], deck[j], ...board]);
      const made = computeMadeStrength(e.score, board);
      if (made > heroMade)      strongerCount++;
      else if (made < heroMade) weakerCount++;
      else                      tiedCount++;
    }
  }

  // contract: strongerCount + tiedCount + weakerCount === population
  // Hero自身はpopulationに含めない（Heroはpopulationと比較される対象であり、
  // populationの要素そのものではない）
  const population = strongerCount + tiedCount + weakerCount;
  const strengthPercentile = population > 0
    ? (weakerCount + tiedCount * 0.5) / population * 100
    : 0;
  const rankPos = Math.round(strongerCount + tiedCount * 0.5) + 1;

  return {
    madeStrength: heroMade,
    handName: heroRaw.categoryName || heroRaw.category,
    strongerCount,
    tiedCount,
    weakerCount,
    population,
    strengthPercentile,
    rankPos
  };
}


function evalRange169(board, hero, context) {
  const raw = eval169(board, hero); // hero passed for removal
  return raw.map(item => ({
    hand:              item.hand,
    rawScore:          item.rawScore,
    madeStrength:      item.madeStrength,
    potentialStrength: item.potentialStrength,
    potential:         item.potential,    // alias (UI互換)
    density:           item.totalCombos > 0 ? item.activeCombos / item.totalCombos : 0,
    class:             item.class,
    handName:          item.handName,
    drawType:          item.drawType,     // UI: renderNuts で使用
    outs:              item.outs,         // UI: アウツ表示で使用
    topClassCombos:    item.topClassCombos, // UI: renderNutsのLive Combo表示で使用（同じ役に到達したコンボ数）
    totalCombos:       item.totalCombos,    // UI: renderNutsでのbaseTotal算出に使用
    categoryBreakdown: item.categoryBreakdown // UI: ヒートマップのポップアップ・三角塗りで使用
  }));
}


function computeRangeStats(rangeMatrix) {
  if (!rangeMatrix || rangeMatrix.length === 0) {
    return { madeAvg: 0, potAvg: 0, drawHeavy: 0, madeSpread: 0 };
  }
  const total   = rangeMatrix.length;
  const madeAvg = rangeMatrix.reduce((s, h) => s + (h.madeStrength      || 0), 0) / total;
  const potAvg  = rangeMatrix.reduce((s, h) => s + (h.potentialStrength || 0), 0) / total;
  const drawHeavy = rangeMatrix.filter(h => (h.potentialStrength || 0) > 0.15).length / total;

  const sortedMade = [...rangeMatrix].sort((a, b) => b.madeStrength - a.madeStrength);
  const n25 = Math.max(1, Math.floor(total * 0.25));
  const topMade = sortedMade.slice(0,  n25).reduce((s, h) => s + h.madeStrength, 0) / n25;
  const botMade = sortedMade.slice(-n25).reduce((s, h) => s + h.madeStrength, 0) / n25;
  const madeSpread = topMade - botMade;

  return { madeAvg, potAvg, drawHeavy, madeSpread };
}


/* ══════════════════════════════
   computeStructureFeatures
   5軸すべて 0-100 (整数)

   データソース別に独立した指標を計算する。
   PokerのGTOや戦略的判断は含まない — 純粋な構造統計。

   Entropy      rawScore分布 → 複雑さ
                0=全ハンドが同一強度  100=あらゆる強さが均等に分布
   Polarization rawScore分布 → 強弱差
                0=上下25%の差なし    100=上位と下位が最大乖離
   Coverage     density      → レンジの広さ
                0=全コンボデッド      100=169ハンド全生存
   DrawStructure drawType    → ドロー構造  (UI表示名: Draw Pressure)
                0=ドロー要素皆無      100=複合ドローが充満
   Dominance    rawScore分布 → Gini不平等度
                0=全ハンドの強さが均等  100=一部ハンドが格差を独占
                ← モノトーンボードで高い、クアッズボードで低い
══════════════════════════════ */
function computeStructureFeatures(rangeMatrix, board) {
  const live = rangeMatrix.filter(h => h.density > 0);
  if (live.length === 0) {
    return { entropy: 0, polarization: 0, coverage: 0, drawStructure: 0, dominance: 0 };
  }

  const n      = live.length;
  const scores = live.map(h => h.rawScore);
  const total  = scores.reduce((s, v) => s + v, 0);

  // A. Entropy（rawScore → 複雑さ）
  // Shannon entropy を 20ビンで計算し、log2(20) で正規化
  const BIN  = 20;
  const bins = new Array(BIN).fill(0);
  scores.forEach(s => bins[Math.min(BIN - 1, Math.floor(s * BIN))]++);
  const entropyRaw = -bins.reduce((sum, c) => {
    if (!c) return sum;
    const p = c / n;
    return sum + p * Math.log2(p);
  }, 0);
  const entropy = Math.round((entropyRaw / Math.log2(BIN)) * 100);

  // B. Polarization（rawScore → 強弱差）
  // 上位25%平均 - 下位25%平均
  const sorted = [...scores].sort((a, b) => b - a);
  const q25    = Math.max(1, Math.floor(n * 0.25));
  const topAvg = sorted.slice(0, q25).reduce((s, v) => s + v, 0) / q25;
  const botAvg = sorted.slice(-q25).reduce((s, v) => s + v, 0) / q25;
  const polarization = Math.round((topAvg - botAvg) * 100);

  // C. Coverage（MID-STRENGTH COVERAGE — v3.9.37で再定義）
  // 旧実装は「169ハンド全体の平均density」だったが、他AIレビュー・ユーザーとの
  // 詳細な実測検証で判明した通り、これはボード構造にほぼ反応しない
  // （フロップはボード内容に関わらず常に89固定、ターンは常に85固定。最も
  // 極端なケース＝トリップスAのフロップでさえ89のまま）。理由は、169ハンド
  // 全体を平均すると、特定の3〜5枚のカード除去がごく一部のハンドにしか
  // 大きく影響しないため、平均値としては「街（ボード枚数）」だけで決まる
  // 値に潰れてしまうため（バグではなく、集約方法自体の設計限界）。
  // UIの説明文「ワンペア・ツーペアなど中間的な強さのヒット手がどれほど
  // 広く分布しているか」に実装を合わせる形で再定義：
  // 全1326通りのホールカードコンボ（生存しているもの）のうち、SPECTRAの
  // madeStrengthが[0.10, 0.45)の中間強度帯に入るコンボの割合。
  // 169カテゴリ均等平均ではなく1326コンボ加重平均を採用（computeRangeDrawPct()の
  // 「全1326コンボ平均」と同じ思想で統一。169均等平均も試したが、ほぼ同じ
  // 挙動でありコンボ加重の方が実際のレンジ構成に近い）。
  // 実測で確認済み: フロップ10パターンで29〜99、ターンでも各ボードの4枚目
  // カードで大きく変動（例: A-A-Aフロップ→ターンで4枚目がAなら0%、ブランクなら
  // 78%）することを確認した。
  // 既知の限界（意図的に許容・0.35等への恣意的な境界変更はしない）:
  // ペアボード（K-K-4 / 4-4-3 / 8-8-7等）はボードの質に関わらず軒並み98〜99%に
  // 集中し、ペアの強さやキッカーの質による差別化ができない。これは「ペアボード
  // かどうか」という方向としては正しい反応だが、「coverageが高い＝Heroのレンジが
  // 強い／広くボードに適合している」という戦略的な意味には絶対に飛躍させない
  // こと。あくまで「中間強度帯に分類される生存コンボが多い」という観測事実に
  // 留める（UI側の説明文もその前提で記述する）。
  const MID_LO = 0.10, MID_HI = 0.45;
  let midLiveCombos = 0, totalLiveCombos = 0;
  rangeMatrix.forEach(h => {
    const liveCombos = (h.density || 0) * (h.totalCombos || 0);
    totalLiveCombos += liveCombos;
    if (h.madeStrength >= MID_LO && h.madeStrength < MID_HI) midLiveCombos += liveCombos;
  });
  const coverage = totalLiveCombos > 0 ? Math.round((midLiveCombos / totalLiveCombos) * 100) : 0;

  // D. DrawStructure（drawType → ドロー構造）
  // LiveDrawRatio×0.4 + DrawComplexity×0.4 + DrawOverlap×0.2
  const withDraw      = live.filter(h => h.drawType && h.drawType !== '--');
  const liveDrawRatio = withDraw.length / n;
  const drawTypes     = new Set(withDraw.map(h => h.drawType));
  const drawComplexity = drawTypes.size / 4; // FD/OESD/GSD/BD-FD → max 4種
  // v3.9.34: 他AIレビュー指摘・ユーザー確認済み。classifyDraw()は1ハンド1タグの
  // 早期return方式のため、fdSet(drawTypeに'FD'を含む)とsdSet(drawTypeが
  // 厳密にOESD/GSD)は同一ハンドについて絶対に両立せず、この交差は構造上
  // 常に空集合＝drawOverlapが常に0になっていた（ブルートフォース確認：
  // ウェットな2トーン・コネクテッドフロップでも常に0、本来は非ゼロになるべき）。
  // → 上のfdSet/sdSetによる交差ではなく、hasComboDraw()でストレートドロー・
  //   フラッシュドローの該当を独立に（早期returnなしで）判定して数える。
  // boardが渡されない呼び出し（未使用の旧経路等）に対する後方互換として、
  // その場合は0のまま（従来の壊れた挙動と同じ）にフォールバックする。
  const drawOverlap = board
    ? live.filter(h => hasComboDraw(h.hand, board)).length / n
    : 0;
  const drawStructure = Math.round(
    clamp01(liveDrawRatio * 0.40 + drawComplexity * 0.40 + drawOverlap * 0.20) * 100
  );

  // E. Dominance（rawScore → Gini不平等度）
  // Gini係数: 0=完全均等、1=完全集中
  // モノトーンボードで高い（フラッシュ持ちだけが圧倒的強さ）
  // クアッズボードで低い（ほぼ全ハンドがフルハウス帯に密集）
  const ascended = [...scores].sort((a, b) => a - b);
  let giniNum = 0;
  ascended.forEach((v, i) => { giniNum += (2 * (i + 1) - n - 1) * v; });
  const dominance = Math.round(
    (total > 0 ? Math.max(0, giniNum / (n * total)) : 0) * 100
  );

  return { entropy, polarization, coverage, drawStructure, dominance };
}


function computeRangeAdvantage(board, heroPos, villainPos, rangeMatrix) {
  // Position profiles
  const heroProf    = getPositionProfile(heroPos    || 'BTN');
  const villainProf = getPositionProfile(villainPos || 'BB');

  // v3.9.36: 他AIレビュー指摘・データフロー追跡の上でBugと確定し修正。
  // 以前はvillain側のベースにも一律villainProf.openWidthを使っていたが、
  // このアプリが唯一想定している状況（BTNがopen、BBがdefendしてフロップへ
  // 到達するsingle-raised pot）では、BBは「オープンレンジ」ではなく
  // 「ディフェンドレンジ」でボードに参加している。BBのopenWidth=0.5
  // （コメント通り「Fold most hands preflop」＝BBが最初にレイズする場合の
  // 想定値）はこの局面には無関係で、POSITION_PROFILE.BB.defendWidth=1.8
  // という正しいフィールドが定義されているのに一度も参照されていなかった。
  // 実数値で検証：villainBaseがopenWidth(0.5)のままだと基準posAdvが+0.744
  // （ほぼ最大までHero有利に張り付く）になり、その後のボードテクスチャ
  // 補正（±0.10〜0.18程度）ではLOW_BOARD_DEFENDER_EDGE（rangeAdvantage<-0.1
  // が必要）が事実上到達不能になっていた。defendWidthを使うと基準posAdvは
  // +0.077まで下がり、ボード補正で実際にプラス/マイナス両方向に振れる
  // ようになることを確認済み。BB以外のポジションはdefendWidthが未定義の
  // ため、その場合は従来通りopenWidthにフォールバックする（この一点しか
  // 現状は到達しないUI＝BTN vs BB以外は将来の拡張時に同様の整備が必要）。
  const villainWidth = villainProf.defendWidth ?? villainProf.openWidth;

  // Position-based base (hero openWidth vs villain defendWidth/openWidth)
  const heroBase    = (heroProf.openWidth || 1.0) * (heroProf.adjustmentFactor    || 1.0);
  const villainBase = (villainWidth       || 1.0) * (villainProf.adjustmentFactor || 1.0);
  let posAdv = (heroBase - villainBase) / Math.max(heroBase, villainBase, 0.01); // -1..+1 approx

  // Board modifier
  if (board && board.length >= 3) {
    const tex  = calcBoardTexture(board);
    const rank = classifyRankStructure(board);
    const conn = classifyConnectivity(board);
    const pair = classifyPairStructure(board);

    if (rank === 'HIGH' && conn === 'LOW_CONNECTED') posAdv += 0.18;
    if (tex.texture === 'DRY' || tex.texture === 'VERY_DRY') posAdv += 0.10;
    if (tex.texture === 'WET' || tex.texture === 'VERY_WET') posAdv -= 0.10;
    if (conn === 'CONNECTED' || conn === 'HIGHLY_CONNECTED') posAdv -= 0.12;
    // v3.9.42: 保留リスト②の監査で確定・修正。TRIPS_BOARD/QUADS_BOARDという
    // 盤面構造が存在する一方、ここではPAIRED/DOUBLE_PAIREDのみを見ており
    // TRIPS_BOARDが欠落していた。同じ「villain側がセットでトラップしやすい/
    // レンジが偏る」という意味論を持つ他の2箇所（calcRangeDynamics()の
    // isPaired判定、deriveAggressionSignal()のPOLARIZE判定）は両方とも
    // PAIRED/DOUBLE_PAIRED/TRIPS_BOARDの3値を一貫してグループ化しており、
    // computeRangeAdvantage()だけがこの拡張を欠いていたことをgrep監査で確認。
    // QUADS_BOARDは意図的に対象外のまま維持する：上記2箇所を含むアプリ内の
    // どの「villain trap/polarize」系分岐にも一度もQUADS_BOARDは含まれておらず、
    // 代わりにBOARD_LOCKED（deriveHudSignals、importance 0.85）という完全に
    // 別系統のHUDシグナルで扱われている（quadsは極端に稀・ロックされたボード
    // でこの加減算モデルに馴染まないという設計判断が一貫している）。
    // 20000盤面のbrute forceで検証済み：TRIPS_BOARD該当盤面は全て厳密に-0.12
    // だけシフトし（PAIRED/DOUBLE_PAIRED/UNPAIRED/QUADS_BOARDは無変化）、
    // 副作用は確認されなかった。
    if (pair === 'PAIRED' || pair === 'DOUBLE_PAIRED' || pair === 'TRIPS_BOARD') posAdv -= 0.12;
    if (rank === 'LOW') posAdv -= 0.14;
  }

  // Top-range score differential (upper 30% of rangeMatrix)
  if (rangeMatrix && rangeMatrix.length > 0) {
    const sorted  = [...rangeMatrix].sort((a, b) => b.rawScore - a.rawScore);
    const topN    = Math.max(1, Math.floor(sorted.length * 0.30));
    const topAvg  = sorted.slice(0, topN).reduce((s, h) => s + h.rawScore, 0) / topN;
    // Shift toward hero if topAvg is high (strong board for aggressor)
    const scoreShift = (topAvg - 0.5) * 0.20;
    posAdv += scoreShift;
  }

  return Math.max(-1, Math.min(1, posAdv));
}


function computeNutAdvantage(board, heroPos, villainPos, rangeMatrix) {
  const heroProf    = getPositionProfile(heroPos    || 'BTN');
  const villainProf = getPositionProfile(villainPos || 'BB');

  const heroDens    = heroProf.nutDensity    || 1.0;
  const villainDens = villainProf.nutDensity || 1.0;

  // Nut threshold: top 8% of rangeMatrix rawScores
  let nutDensity  = 0;
  let nutCoverage = 0;

  if (rangeMatrix && rangeMatrix.length > 0) {
    const sorted   = [...rangeMatrix].sort((a, b) => b.rawScore - a.rawScore);
    const nutCutoff = sorted[Math.floor(sorted.length * 0.08)]?.rawScore ?? 0.80;
    const nutHands  = sorted.filter(h => h.rawScore >= nutCutoff);
    nutDensity  = nutHands.length / rangeMatrix.length;
    // coverage: fraction of nut hands that are active (density field)
    const activeDens = nutHands.reduce((s, h) => s + (h.density || 0), 0);
    nutCoverage = nutHands.length > 0 ? activeDens / nutHands.length : 0;
  }

  // Position-based nut advantage
  const rawAdv = (heroDens - villainDens) / Math.max(heroDens, villainDens, 0.01);
  // Board: high-card boards favor BTN nut region, low boards favor BB
  let boardNutShift = 0;
  if (board && board.length >= 3) {
    const rank = classifyRankStructure(board);
    if (rank === 'HIGH') boardNutShift += 0.12;
    if (rank === 'LOW')  boardNutShift -= 0.15;
  }

  const advantage = Math.max(-1, Math.min(1, rawAdv + boardNutShift));

  return { advantage, density: nutDensity, coverage: nutCoverage };
}
