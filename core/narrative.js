/* core/narrative.js — HUD, narrative, strategy profiles. Deps: utils, interpretations */

const INTERP_META_BTN_VS_BB = {
  MAX_DRAW_PRESSURE: { attack: -0.10, value: 0.00, bluff: -0.40, capped: 0.00 },
  HIGH_DRAW_PRESSURE: { attack: -0.05, value: 0.05, bluff: -0.20, capped: 0.05 },
  LOW_DRAW_PRESSURE: { attack: 0.15, value: 0.10, bluff: -0.15, capped: -0.05 },
  FLUSH_THREAT_ACTIVE: { attack: -0.15, value: 0.10, bluff: -0.30, capped: 0.10 },
  FLUSH_COMPLETED_BOARD: { attack: -0.20, value: 0.20, bluff: -0.35, capped: 0.15 },
  NUT_REGION_NARROW: { attack: 0.10, value: 0.35, bluff: -0.25, capped: 0.20 },
  NUT_REGION_POLARIZED: { attack: 0.05, value: 0.40, bluff: -0.30, capped: 0.25 },
  BOARD_LOCKED: { attack: -0.25, value: 0.45, bluff: -0.40, capped: 0.35 },
  HIGH_CARD_LEVERAGE: { attack: 0.30, value: 0.40, bluff: 0.10, capped: 0.00 },
  LOW_BOARD_DEFENDER_EDGE: { attack: -0.20, value: 0.10, bluff: -0.10, capped: 0.15 },
  STRAIGHT_THREAT_ACTIVE: { attack: -0.10, value: 0.05, bluff: -0.25, capped: 0.05 },
  MULTI_DRAW_BOARD: { attack: -0.05, value: 0.00, bluff: -0.15, capped: 0.05 },
  BTN_FAVORS_AGGRESSION: { attack: 0.50, value: 0.10, bluff: 0.20, capped: 0.00 },
  AGGRESSION_REQUIRES_DISCIPLINE: { attack: -0.20, value: 0.15, bluff: -0.10, capped: 0.10 },
  DEFENDER_CAN_RESIST: { attack: -0.30, value: 0.05, bluff: -0.20, capped: 0.15 },
  VALUE_BETTING_POLARIZED: { attack: 0.00, value: 0.50, bluff: -0.20, capped: 0.30 },
  DRAW_HEAVY_RANGE:       { attack: -0.08, value: 0.05, bluff: -0.20, capped: 0.05 },
  MADE_STRENGTH_DOMINANT: { attack: 0.12, value: 0.08, bluff: 0.05, capped: -0.05 },
  NEUTRAL: { attack: 0.00, value: 0.00, bluff: 0.00, capped: 0.00 }
};


const INTERP_META_3BET_IP = {
  MAX_DRAW_PRESSURE: { attack: 0.05, value: -0.10, bluff: -0.15, capped: 0.00 },
  HIGH_DRAW_PRESSURE: { attack: 0.10, value: 0.00, bluff: -0.05, capped: 0.05 },
  LOW_DRAW_PRESSURE: { attack: 0.25, value: 0.05, bluff: 0.10, capped: -0.10 },
  FLUSH_THREAT_ACTIVE: { attack: 0.00, value: 0.15, bluff: -0.10, capped: 0.10 },
  FLUSH_COMPLETED_BOARD: { attack: -0.05, value: 0.30, bluff: -0.15, capped: 0.20 },
  NUT_REGION_NARROW: { attack: 0.25, value: 0.50, bluff: 0.00, capped: 0.15 },
  NUT_REGION_POLARIZED: { attack: 0.20, value: 0.55, bluff: -0.05, capped: 0.20 },
  BOARD_LOCKED: { attack: -0.10, value: 0.60, bluff: -0.25, capped: 0.35 },
  HIGH_CARD_LEVERAGE: { attack: 0.60, value: 0.20, bluff: 0.35, capped: 0.00 },
  LOW_BOARD_DEFENDER_EDGE: { attack: -0.05, value: 0.20, bluff: 0.05, capped: 0.20 },
  STRAIGHT_THREAT_ACTIVE: { attack: 0.00, value: 0.10, bluff: -0.05, capped: 0.10 },
  MULTI_DRAW_BOARD: { attack: 0.10, value: 0.05, bluff: 0.15, capped: 0.05 },
  BTN_FAVORS_AGGRESSION: { attack: 0.70, value: 0.05, bluff: 0.40, capped: -0.05 },
  AGGRESSION_REQUIRES_DISCIPLINE: { attack: -0.10, value: 0.20, bluff: 0.10, capped: 0.10 },
  DEFENDER_CAN_RESIST: { attack: -0.40, value: 0.15, bluff: -0.10, capped: 0.20 },
  VALUE_BETTING_POLARIZED: { attack: 0.15, value: 0.65, bluff: 0.00, capped: 0.40 },
  DRAW_HEAVY_RANGE:       { attack: 0.05, value: -0.05, bluff: -0.10, capped: 0.05 },
  MADE_STRENGTH_DOMINANT: { attack: 0.20, value: 0.10, bluff: 0.15, capped: -0.10 },
  NEUTRAL: { attack: 0.00, value: 0.00, bluff: 0.00, capped: 0.00 }
};


const INTERP_META_SRP_IP = {
  MAX_DRAW_PRESSURE: { attack: -0.05, value: 0.05, bluff: -0.25, capped: 0.05 },
  HIGH_DRAW_PRESSURE: { attack: 0.00, value: 0.10, bluff: -0.10, capped: 0.05 },
  LOW_DRAW_PRESSURE: { attack: 0.10, value: 0.15, bluff: -0.05, capped: 0.00 },
  FLUSH_THREAT_ACTIVE: { attack: -0.10, value: 0.15, bluff: -0.20, capped: 0.10 },
  FLUSH_COMPLETED_BOARD: { attack: -0.15, value: 0.25, bluff: -0.25, capped: 0.15 },
  NUT_REGION_NARROW: { attack: 0.05, value: 0.40, bluff: -0.20, capped: 0.15 },
  NUT_REGION_POLARIZED: { attack: 0.00, value: 0.45, bluff: -0.25, capped: 0.20 },
  BOARD_LOCKED: { attack: -0.20, value: 0.50, bluff: -0.35, capped: 0.30 },
  HIGH_CARD_LEVERAGE: { attack: 0.20, value: 0.35, bluff: 0.05, capped: -0.05 },
  LOW_BOARD_DEFENDER_EDGE: { attack: -0.15, value: 0.15, bluff: -0.15, capped: 0.10 },
  STRAIGHT_THREAT_ACTIVE: { attack: -0.05, value: 0.10, bluff: -0.15, capped: 0.05 },
  MULTI_DRAW_BOARD: { attack: -0.05, value: 0.05, bluff: -0.10, capped: 0.05 },
  BTN_FAVORS_AGGRESSION: { attack: 0.35, value: 0.15, bluff: 0.15, capped: 0.00 },
  AGGRESSION_REQUIRES_DISCIPLINE: { attack: -0.15, value: 0.15, bluff: -0.05, capped: 0.10 },
  DEFENDER_CAN_RESIST: { attack: -0.25, value: 0.10, bluff: -0.15, capped: 0.10 },
  VALUE_BETTING_POLARIZED: { attack: -0.05, value: 0.45, bluff: -0.15, capped: 0.25 },
  DRAW_HEAVY_RANGE:       { attack: -0.05, value: 0.05, bluff: -0.15, capped: 0.05 },
  MADE_STRENGTH_DOMINANT: { attack: 0.08, value: 0.10, bluff: 0.03, capped: -0.05 },
  NEUTRAL: { attack: 0.00, value: 0.00, bluff: 0.00, capped: 0.00 }
};


const STRATEGY_PROFILE = {
  BTN_VS_BB:  INTERP_META_BTN_VS_BB,
  '3BET_IP':  INTERP_META_3BET_IP,
  SRP_IP:     INTERP_META_SRP_IP
  // Future: SB_VS_BTN, CO_VS_BTN, HJ_VS_BTN, Multiway, etc.
};


const NARRATIVE_MAP = {
  'MAX_DRAW_PRESSURE': 'Draw pressure is extreme.',
  'HIGH_DRAW_PRESSURE': 'Draw pressure is elevated.',
  'LOW_DRAW_PRESSURE': 'Draw pressure is limited.',
  'FLUSH_THREAT_ACTIVE': 'Flush threat is active.',
  'FLUSH_COMPLETED_BOARD': 'Flushes are already live.',
  'NUT_REGION_NARROW': 'Nut region is concentrated.',
  'NUT_REGION_POLARIZED': 'Nut advantage is polarized.',
  'BOARD_LOCKED': 'Board is heavily locked.',
  'HIGH_CARD_LEVERAGE': 'High-card leverage favors BTN.',
  'LOW_BOARD_DEFENDER_EDGE': 'Low board favors the defender.',
  'STRAIGHT_THREAT_ACTIVE': 'Straight pressure is active.',
  'MULTI_DRAW_BOARD': 'Multiple draws are available.',
  'BTN_FAVORS_AGGRESSION': 'BTN can attack at high frequency.',
  'AGGRESSION_REQUIRES_DISCIPLINE': 'Aggression needs more selectivity.',
  'DEFENDER_CAN_RESIST': 'Defender can continue more often.',
  'VALUE_BETTING_POLARIZED': 'Value is more polarized here.',
  'DRAW_HEAVY_RANGE':      'Range-wide draw potential is elevated.',
  'MADE_STRENGTH_DOMINANT':'Made hands dominate this board.',
  'NEUTRAL': '--'
};


function getStrategyProfile(context) {
  // Resolve situation profile from context (Situation Layer)
  if (context.profile) {
    return STRATEGY_PROFILE[context.profile] || STRATEGY_PROFILE.BTN_VS_BB;
  }

  // Fallback: infer from positions
  if (context.positions === 'BTN_VS_BB') {
    return STRATEGY_PROFILE.BTN_VS_BB;
  }

  return STRATEGY_PROFILE.BTN_VS_BB; // Default
}


function enrichNarrativeLine(key, baseLine, features) {
  const rs = features?.rangeStats;
  if (!rs) return baseLine;

  const pct = (x) => Math.round(x * 100);

  switch (key) {
    case 'MAX_DRAW_PRESSURE':
      return `${baseLine} ${pct(rs.drawHeavy)}% of range carries draw equity.`;

    case 'HIGH_DRAW_PRESSURE':
      return `${baseLine} ${pct(rs.drawHeavy)}% of hands have draw potential.`;

    case 'DRAW_HEAVY_RANGE':
      return rs.potAvg > 0.20
        ? `${baseLine} Avg draw equity across range: ${pct(rs.potAvg)}%.`
        : baseLine;

    case 'MADE_STRENGTH_DOMINANT':
      return `${baseLine} Avg made strength: ${pct(rs.madeAvg)}%, draw-heavy hands: ${pct(rs.drawHeavy)}%.`;

    case 'NUT_REGION_NARROW':
    case 'NUT_REGION_POLARIZED':
      return rs.madeSpread > 0.18
        ? `${baseLine} Nut spread: ${rs.madeSpread.toFixed(2)} — wide gap between strong and weak hands.`
        : baseLine;

    case 'LOW_DRAW_PRESSURE':
      // 自明すぎる情報は数値を追加しない（Narrativeが冗長にならないよう）
      return baseLine;

    default:
      return baseLine;
  }
}


function buildNarrative(interpretations, maxLines = 3, features = null) {
  // Narrative Budget (P1):
  //   1. Re-sort by narrativeRank (score × confidence × importance)
  //   2. Filter: score >= 0.50 AND confidence >= 0.40
  //   3. Category diversity: at most 1 per category (DRAW / NUT / RANGE / SIGNAL)
  //   4. Hard cap: maxLines (default 3)
  // Narrative Enrichment (P1.5):
  //   5. enrichNarrativeLine() で rangeStats の定量値を文言に付加
  if (!interpretations || interpretations.length === 0) return ['--'];

  const SCORE_FLOOR      = 0.50;
  const CONFIDENCE_FLOOR = 0.40;

  const eligible = [...interpretations]
    .sort((a, b) => b.narrativeRank - a.narrativeRank)
    .filter(i => i.score >= SCORE_FLOOR && i.confidence >= CONFIDENCE_FLOOR);

  // Category diversity: take top-ranked from each category
  const seen   = new Set();
  const picked = [];
  for (const i of eligible) {
    const cat = INTERP_META[i.key]?.category ?? 'OTHER';
    if (!seen.has(cat)) {
      seen.add(cat);
      picked.push(i);
    }
    if (picked.length >= maxLines) break;
  }

  const lines = picked
    .map(i => {
      const base = NARRATIVE_MAP[i.key];
      if (!base || base === '--') return null;
      return enrichNarrativeLine(i.key, base, features);
    })
    .filter(Boolean);

  return lines.length ? lines : ['--'];
}


function deriveHudSignals(features, interpretations, context) {
  // Phase 2.75: Situation-aware strategy selection
  // Phase 4A: Archetype already applied to features & interpretations (upstream)
  const strategyProfile = getStrategyProfile(context);

  let attack = 0.5;
  let value = 0.5;
  let bluff = 0.5;
  let capped = 0.0;

  // ─ Matrix-driven aggregation with situation profile ─
  for (const interp of interpretations) {
    const meta = strategyProfile[interp.key];
    if (!meta) continue;

    // P1: weight by score × confidence (importance excluded — HUD reflects board reality)
    const w = interp.score * (interp.confidence ?? 1.0);
    attack += meta.attack * w;
    value  += meta.value  * w;
    bluff  += meta.bluff  * w;
    capped += meta.capped * w;
  }

  // ─ Structural modifiers (feature-level, not interpretation-level) ─
  if (features.pairStructure === 'QUADS_BOARD') {
    value += 0.2;
    capped += 0.15;
  }

  return {
    attack: clamp01(attack),
    value: clamp01(value),
    bluff: clamp01(bluff),
    capped: clamp01(capped)
  };
}


function extractMetrics(features) {
  return {
    wetnessScore: features.wetnessScore || 0,
    connectivityScore: features.connectivityScore || 0,
    flushScore: features.flushScore || 0,
    highCardScore: features.rankStructure === 'HIGH' ? 80 : (features.rankStructure === 'LOW' ? 20 : 50)
  };
}
