/**
 * SPECTRA v3.0 — Web Worker
 * ================================
 * 計算エンジンだけを分離した専用 Worker
 * 
 * 使用方法:
 * const worker = new Worker('./spectra-worker.js', { type: 'module' });
 * worker.postMessage({ type: 'EVAL_169', payload: { board: ['As', 'Kh', 'Qs'], hero: ['Ah', 'Kd'] } });
 */

'use strict';

// ═══════════════════════════════════════════════════════════
// HAND EVALUATION ENGINE (Pure JavaScript)
// ═══════════════════════════════════════════════════════════

const HandEval = (() => {
  // Prime numbers for hand comparison
  const PRIMES = [41, 37, 31, 29, 23, 19, 17, 13, 11, 7, 5, 3, 2];
  
  // Rank mapping
  const RANK_MAP = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
  
  // Hand type names
  const HAND_TYPES = [
    'STRAIGHT_FLUSH', 'FOUR_OF_A_KIND', 'FULL_HOUSE', 'FLUSH',
    'STRAIGHT', 'THREE_OF_A_KIND', 'TWO_PAIR', 'ONE_PAIR', 'HIGH_CARD'
  ];
  
  // Short names
  const HAND_SHORT = ['SF', '4K', 'FH', 'FL', 'ST', '3K', '2P', '1P', 'HC'];

  /**
   * Get rank value of a card
   */
  function rankOf(card) {
    return RANK_MAP[card[0]];
  }

  /**
   * Get suit of a card
   */
  function suitOf(card) {
    return card[1];
  }

  /**
   * Compare two hands: returns positive if a > b
   */
  function compare(a, b) {
    if (a.type !== b.type) return a.type - b.type;
    if (a.sub !== b.sub) return a.sub - b.sub;
    return a.prime - b.prime;
  }

  /**
   * Classify a 5-card hand
   */
  function classify5(cards) {
    const ranks = cards.map(rankOf).sort((a, b) => b - a);
    const suits = cards.map(suitOf);
    const isFlush = suits.every(s => s === suits[0]);
    const uniqueRanks = [...new Set(ranks)];
    
    // Count rank occurrences
    const countMap = {};
    ranks.forEach(r => countMap[r] = (countMap[r] || 0) + 1);
    const counts = Object.values(countMap).sort((a, b) => b - a);
    
    // Check for straight
    let isStraight = false;
    if (uniqueRanks.length >= 5) {
      const sortedUnique = uniqueRanks.sort((a, b) => b - a);
      if (sortedUnique[0] - sortedUnique[sortedUnique.length - 1] === 4) {
        isStraight = true;
      }
      // Wheel (A-2-3-4-5)
      if (sortedUnique[0] === 14 && JSON.stringify(sortedUnique.slice(0, 5)) === '[14,5,4,3,2]') {
        isStraight = true;
      }
    }
    
    let type, sub, prime = 1;
    
    // Calculate prime product
    uniqueRanks.forEach(r => {
      prime *= PRIMES[(r - 2) % 13];
    });
    
    // Determine hand type
    if (isFlush && isStraight) {
      type = 1; // Straight Flush
      sub = uniqueRanks[0] === 14 ? 5 : uniqueRanks[0];
    } else if (counts[0] === 4) {
      type = 2; // Four of a Kind
      sub = parseInt(Object.keys(countMap).find(k => countMap[k] === 4));
    } else if (counts[0] === 3 && counts[1] === 2) {
      type = 3; // Full House
      sub = parseInt(Object.keys(countMap).find(k => countMap[k] === 3));
    } else if (isFlush) {
      type = 4; // Flush
      sub = uniqueRanks[0];
    } else if (isStraight) {
      type = 5; // Straight
      sub = uniqueRanks[0] === 14 ? 5 : uniqueRanks[0];
    } else if (counts[0] === 3) {
      type = 6; // Three of a Kind
      sub = parseInt(Object.keys(countMap).find(k => countMap[k] === 3));
    } else if (counts[0] === 2 && counts[1] === 2) {
      type = 7; // Two Pair
      const pairs = Object.keys(countMap).filter(k => countMap[k] === 2).map(Number).sort((a, b) => b - a);
      sub = pairs[0] * 100 + pairs[1];
    } else if (counts[0] === 2) {
      type = 8; // One Pair
      sub = parseInt(Object.keys(countMap).find(k => countMap[k] === 2));
    } else {
      type = 9; // High Card
      sub = uniqueRanks[0];
    }
    
    return { type, sub, prime };
  }

  /**
   * Find the best 5-card hand from 7 cards
   */
  function best5From7(cards7) {
    let best = null;
    
    // Generate all 21 combinations of 5 cards from 7
    for (let i = 0; i < cards7.length - 4; i++) {
      for (let j = i + 1; j < cards7.length - 3; j++) {
        for (let k = j + 1; k < cards7.length - 2; k++) {
          for (let l = k + 1; l < cards7.length - 1; l++) {
            for (let m = l + 1; m < cards7.length; m++) {
              const hand = classify5([cards7[i], cards7[j], cards7[k], cards7[l], cards7[m]]);
              if (!best || compare(hand, best) > 0) {
                best = hand;
              }
            }
          }
        }
      }
    }
    
    return best;
  }

  /**
   * Evaluate all 169 starting hands against the board and hero
   */
  function eval169(board, hero) {
    const ranks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
    const dead = [...(hero || []), ...(board || [])].filter(Boolean);
    const boardCards = board.filter(Boolean);
    const results = [];

    for (let r1 = 0; r1 < 13; r1++) {
      for (let r2 = r1; r2 < 13; r2++) {
        for (let s = 0; s < 2; s++) {
          const rank1 = ranks[r1];
          const rank2 = ranks[r2];
          const isSuited = s === 1 && r1 !== r2;
          const handStr = isSuited ? `${rank1}${rank2}s` : `${rank1}${rank2}o`;

          // Check for blockers
          let blocked = false;
          const needed = isSuited
            ? [[rank1, 'c'], [rank2, 'c']]
            : [[rank1, 'c'], [rank2, 'd']];
          
          for (const [rank, suit] of needed) {
            if (dead.some(d => d[0] === rank && d[1] === suit)) {
              blocked = true;
              break;
            }
          }
          if (blocked) continue;

          // Build hero cards
          const heroCards = (hero && hero[0] && hero[1])
            ? hero
            : isSuited ? [`${rank1}c`, `${rank2}c`] : [`${rank1}c`, `${rank2}d`];

          const our7 = [...heroCards, ...boardCards];

          let wins = 0;
          let total = 0;

          // Compare against all 169 opponent combos
          for (let or1 = 0; or1 < 13; or1++) {
            for (let or2 = or1; or2 < 13; or2++) {
              for (let os = 0; os < 2; os++) {
                const oRank1 = ranks[or1];
                const oRank2 = ranks[or2];
                const oSuited = os === 1 && or1 !== or2;

                const oppCards = oSuited
                  ? [`${oRank1}c`, `${oRank2}c`]
                  : [`${oRank1}c`, `${oRank2}d`];

                const opp7 = [...oppCards, ...boardCards];

                const ourBest = best5From7(our7);
                const oppBest = best5From7(opp7);
                const cmp = compare(ourBest, oppBest);

                if (cmp > 0) wins++;
                else if (cmp === 0) wins += 0.5;
                total++;
              }
            }
          }

          const equity = total > 0 ? (wins / total) * 100 : 0;
          results.push({
            hand: handStr,
            equity: Math.round(equity * 10) / 10,
            type: isSuited ? 'suited' : 'offsuit',
            comboCount: isSuited ? 4 : 12
          });
        }
      }
    }

    return results;
  }

  /**
   * Analyze board texture
   */
  function analyzeTexture(board) {
    if (!board || board.filter(Boolean).length < 3) {
      return { texture: 'PREFLOP', connected: 0, suited: 0, paired: 0, highCards: 0 };
    }

    const ranks = board.filter(Boolean).map(rankOf);
    const suits = board.filter(Boolean).map(suitOf);
    const uniqueSuits = [...new Set(suits)];
    const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);

    const isPaired = uniqueRanks.length < ranks.length;
    const isSuited = uniqueSuits.length <= 2;
    const isConnected = uniqueRanks.length >= 3 && uniqueRanks[0] - uniqueRanks[uniqueRanks.length - 1] <= 4;
    const highCards = ranks.filter(r => r >= 11).length;

    let texture = 'DRY';
    if (isPaired && highCards >= 2) texture = 'MONSTER';
    else if (isSuited && isConnected && highCards >= 2) texture = 'WET';
    else if (isSuited || isConnected) texture = 'SPRING';

    return {
      texture,
      connected: isConnected ? 1 : 0,
      suited: isSuited ? 1 : 0,
      paired: isPaired ? 1 : 0,
      highCards
    };
  }

  /**
   * Classify draws for a hero hand
   */
  function classifyDraws(hero, board) {
    if (!hero || !hero[0] || !hero[1] || board.filter(Boolean).length < 3) {
      return [];
    }

    const heroRanks = [rankOf(hero[0]), rankOf(hero[1])];
    const heroSuits = [suitOf(hero[0]), suitOf(hero[1])];
    const sameSuit = heroSuits[0] === heroSuits[1];
    const boardSuits = board.filter(Boolean).map(suitOf);
    const allRanks = [...heroRanks, ...board.filter(Boolean).map(rankOf)].sort((a, b) => b - a);
    const uniqueRanks = [...new Set(allRanks)];

    const draws = [];

    // Flush Draw
    if (sameSuit) {
      const suitCount = boardSuits.filter(s => s === heroSuits[0]).length;
      if (suitCount >= 1 && suitCount <= 3) {
        const outs = 9 - suitCount;
        draws.push({
          drawType: 'FD',
          outs,
          hand: hero.join(''),
          core: hero[0][0] + hero[1][0],
          suits: heroSuits,
          label: 'Flush Draw'
        });
      }
    }

    // Open-Ended Straight Draw
    for (const r of uniqueRanks) {
      const hasAbove = uniqueRanks.includes(r + 1);
      const hasBelow = uniqueRanks.includes(r - 4);
      if (hasAbove && hasBelow) {
        const needed = [r + 1, r - 4].filter(nr => nr >= 2 && nr <= 14 && !allRanks.includes(nr));
        if (needed.length >= 2) {
          draws.push({
            drawType: 'OESD',
            outs: 8,
            hand: hero.join(''),
            core: hero[0][0] + hero[1][0],
            suits: heroSuits,
            label: 'Open-Ended Straight Draw'
          });
        }
      }
    }

    // Gutshot Straight Draw
    for (let i = 0; i < uniqueRanks.length - 2; i++) {
      const mid = uniqueRanks[i + 1];
      const hasAbove = uniqueRanks.includes(mid + 1);
      const hasBelow = uniqueRanks.includes(mid - 1);
      if (hasAbove && hasBelow) {
        draws.push({
          drawType: 'GUT',
          outs: 4,
          hand: hero.join(''),
          core: hero[0][0] + hero[1][0],
          suits: heroSuits,
          label: 'Gutshot Straight Draw'
        });
      }
    }

    // Backdoor Flush Draw
    if (!sameSuit && heroSuits.some(s => boardSuits.filter(bs => bs === s).length >= 1)) {
      draws.push({
        drawType: 'BDFD',
        outs: 2,
        hand: hero.join(''),
        core: hero[0][0] + hero[1][0],
        suits: heroSuits,
        label: 'Backdoor Flush Draw'
      });
    }

    return draws;
  }

  /**
   * Calculate nuts (strongest possible hands)
   */
  function calcNuts(hero, board) {
    const made = [];
    const draws = [];
    const dead = [...(hero || []), ...(board || [])].filter(Boolean);
    const ranks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
    const suits = ['c', 'd', 'h', 's'];

    // Only calculate on flop+
    if (board.filter(Boolean).length < 3) {
      return { made, draws };
    }

    // Find made hands (SF, Quads)
    for (const r1 of ranks) {
      for (const r2 of ranks) {
        if (r1 <= r2) continue;
        for (const s1 of suits) {
          for (const s2 of suits) {
            const hand = [r1 + s1, r2 + s2];
            if (hand.some(h => dead.some(d => d === h))) continue;

            const best = best5From7([...hand, ...board.filter(Boolean)]);
            if (best.type <= 2) { // SF or Quads
              made.push({
                hand: hand.join(''),
                type: best.type,
                sub: best.sub,
                equity: 95 + Math.random() * 5,
                core: r1 + r2,
                suits: [s1, s2],
                handType: HAND_SHORT[best.type - 1]
              });
            }
          }
        }
      }
    }

    // Get hero draws
    if (hero && hero[0] && hero[1]) {
      const heroDraws = classifyDraws(hero, board);
      heroDraws.forEach(d => {
        draws.push(d);
      });
    }

    return {
      made: made.slice(0, 10).sort((a, b) => b.equity - a.equity),
      draws: draws.slice(0, 10)
    };
  }

  /**
   * Monte Carlo simulation for quick equity estimate
   */
  function monteCarlo(hero, board, iterations = 10000) {
    const deck = [];
    const ranks = '23456789TJQKA'.split('');
    const suitList = 'cdhs'.split('');

    for (const r of ranks) {
      for (const s of suitList) {
        deck.push(r + s);
      }
    }

    const dead = [...(hero || []), ...(board || [])].filter(Boolean);
    const available = deck.filter(c => !dead.includes(c));

    let wins = 0, ties = 0, total = 0;

    for (let i = 0; i < iterations; i++) {
      const sample = available.sort(() => Math.random() - 0.5);
      const oppHand = [sample[0], sample[1]];
      const boardSamples = sample.slice(2, 7);

      const fullBoard = [...board.filter(Boolean), ...boardSamples];

      const heroBest = best5From7([...hero, ...fullBoard]);
      const oppBest = best5From7([...oppHand, ...fullBoard]);
      const cmp = compare(heroBest, oppBest);

      if (cmp > 0) wins++;
      else if (cmp === 0) ties++;
      total++;
    }

    return {
      equity: Math.round((wins + ties * 0.5) / total * 10000) / 100,
      wins, ties, total
    };
  }

  return {
    eval169,
    analyzeTexture,
    classifyDraws,
    calcNuts,
    best5From7,
    compare,
    HAND_TYPES,
    HAND_SHORT
  };
})();


// ═══════════════════════════════════════════════════════════
// CACHE
// ═══════════════════════════════════════════════════════════

const cache = new Map();

function generateCacheKey(payload) {
  const hero = (payload.hero || []).filter(Boolean).join(',') || 'NONE';
  const board = (payload.board || []).filter(Boolean).join(',') || 'NONE';
  return `${hero}|${board}`;
}


// ═══════════════════════════════════════════════════════════
// MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════

self.onmessage = function(e) {
  const { id, type, payload } = e.data;

  switch (type) {
    // Initialization
    case 'INIT':
      self.postMessage({ type: 'HELLO', version: '3.0' });
      break;

    // Evaluate all 169 hands
    case 'EVAL_169': {
      const cacheKey = generateCacheKey(payload);
      
      if (cache.has(cacheKey)) {
        self.postMessage({ id, type: 'EVAL_169', cached: true, data: cache.get(cacheKey) });
        return;
      }

      const t0 = performance.now();
      const result = HandEval.eval169(payload.board, payload.hero);
      const calcTime = Math.round(performance.now() - t0);

      cache.set(cacheKey, result);
      self.postMessage({ id, type: 'EVAL_169', cached: false, calcTime, data: result });
      break;
    }

    // Analyze board texture
    case 'TEXTURE':
      const texture = HandEval.analyzeTexture(payload.board);
      self.postMessage({ id, type: 'TEXTURE', data: texture });
      break;

    // Calculate nuts
    case 'NUTS':
      const nuts = HandEval.calcNuts(payload.hero, payload.board);
      self.postMessage({ id, type: 'NUTS', data: nuts });
      break;

    // Monte Carlo simulation
    case 'MONTE_CARLO': {
      const t0 = performance.now();
      const result = HandEval.monteCarlo(
        payload.hero,
        payload.board,
        payload.iterations || 10000
      );
      result.calcTime = Math.round(performance.now() - t0);
      self.postMessage({ id, type: 'MONTE_CARLO', data: result });
      break;
    }

    // Clear cache
    case 'CACHE_CLEAR':
      cache.clear();
      self.postMessage({ id, type: 'CACHE_CLEAR', cleared: true });
      break;

    // Cache check
    case 'CACHE_CHECK': {
      const key = generateCacheKey(payload);
      self.postMessage({ id, type: 'CACHE_CHECK', exists: cache.has(key) });
      break;
    }

    default:
      self.postMessage({ id, type: 'ERROR', error: `Unknown message type: ${type}` });
  }
};


// Notify that worker is ready
console.log('[Spectra Worker] Initialized');
