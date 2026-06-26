/* core/interpretations.js — INTERP_META, confidence, derivation. Deps: utils, position */

const INTERP_META = {

  // ── DRAW ──
  MAX_DRAW_PRESSURE: {
    category: 'DRAW', importance: 0.85,
    confidence_rules: [
      { w: 0.40, test: f => f.texture === 'VERY_WET' },
      { w: 0.25, test: f => f.connectivity === 'HIGHLY_CONNECTED' },
      { w: 0.20, test: f => f.flushPressure === 'THREE_FLUSH' || f.flushPressure === 'FOUR_FLUSH' },
      { w: 0.15, test: f => (f.rangeStats?.drawHeavy || 0) > 0.60 } // rangeStats: 60%+ of hands have draw potential
    ]
  },

  HIGH_DRAW_PRESSURE: {
    category: 'DRAW', importance: 0.70,
    confidence_rules: [
      { w: 0.40, test: f => f.texture === 'WET' },
      { w: 0.25, test: f => f.connectivity === 'CONNECTED' || f.connectivity === 'HIGHLY_CONNECTED' },
      { w: 0.20, test: f => f.flushPressure === 'TWO_FLUSH' || f.flushPressure === 'THREE_FLUSH' },
      { w: 0.15, test: f => (f.rangeStats?.drawHeavy || 0) > 0.35 } // rangeStats: 35%+ of hands draw-heavy
    ]
  },

  LOW_DRAW_PRESSURE: {
    category: 'DRAW', importance: 0.30, // rainbow/dry is self-evident; low narrative value
    confidence_rules: [
      { w: 0.60, test: f => f.texture === 'DRY' || f.texture === 'VERY_DRY' },
      { w: 0.40, test: f => f.flushPressure === 'RAINBOW' }
    ]
  },

  FLUSH_THREAT_ACTIVE: {
    category: 'DRAW', importance: 0.80,
    confidence_rules: [
      { w: 0.70, test: f => f.flushPressure === 'THREE_FLUSH' },
      { w: 0.30, test: f => f.texture === 'WET' || f.texture === 'VERY_WET' }
    ]
  },

  FLUSH_COMPLETED_BOARD: {
    category: 'DRAW', importance: 0.90, // flush live = immediate decision impact
    confidence_rules: [
      { w: 0.80, test: f => f.flushPressure === 'FOUR_FLUSH' },
      { w: 0.20, test: f => (f.flushScore || 0) >= 80 }
    ]
  },

  STRAIGHT_THREAT_ACTIVE: {
    category: 'DRAW', importance: 0.75,
    confidence_rules: [
      { w: 0.60, test: f => f.connectivity === 'HIGHLY_CONNECTED' },
      { w: 0.40, test: f => (f.connectivityScore || 0) >= 70 }
    ]
  },

  MULTI_DRAW_BOARD: {
    category: 'DRAW', importance: 0.80,
    // Needs both connectivity AND flush; both rules carry equal weight
    confidence_rules: [
      { w: 0.50, test: f => f.connectivity === 'CONNECTED' || f.connectivity === 'HIGHLY_CONNECTED' },
      { w: 0.50, test: f => f.flushPressure === 'TWO_FLUSH' || f.flushPressure === 'THREE_FLUSH' }
    ]
  },

  // ── NUT ──
  NUT_REGION_NARROW: {
    category: 'NUT', importance: 0.80,
    confidence_rules: [
      { w: 0.50, test: f => f.pairStructure === 'DOUBLE_PAIRED' },
      { w: 0.20, test: f => f.nutAdvantage && Math.abs(f.nutAdvantage.advantage) > 0.2 },
      { w: 0.15, test: f => f.rankStructure === 'HIGH' },
      { w: 0.15, test: f => (f.rangeStats?.madeSpread || 0) > 0.18 } // wide spread = nut hands much stronger than weak hands
    ]
  },

  NUT_REGION_POLARIZED: {
    category: 'NUT', importance: 0.85,
    confidence_rules: [
      { w: 0.55, test: f => f.pairStructure === 'TRIPS_BOARD' },
      { w: 0.20, test: f => f.nutAdvantage && Math.abs(f.nutAdvantage.advantage) > 0.3 },
      { w: 0.15, test: f => f.rankStructure === 'HIGH' || f.rankStructure === 'LOW' },
      { w: 0.10, test: f => (f.rangeStats?.madeSpread || 0) > 0.22 } // extreme spread = very polarized
    ]
  },

  BOARD_LOCKED: {
    category: 'NUT', importance: 0.85, // quads board is unusual, not always the key decision factor
    confidence_rules: [
      { w: 0.90, test: f => f.pairStructure === 'QUADS_BOARD' },
      { w: 0.10, test: f => (f.wetnessScore || 0) <= 20 }
    ]
  },

  // ── RANGE ──
  HIGH_CARD_LEVERAGE: {
    category: 'RANGE', importance: 0.95, // most actionable strategic signal
    confidence_rules: [
      { w: 0.35, test: f => f.rankStructure === 'HIGH' },           // primary evidence
      { w: 0.25, test: f => f.rangeDynamics === 'RANGE_ADV_HERO' },
      { w: 0.20, test: f => (f.rangeAdvantage || 0) > 0.2 },        // continuous corroboration
      { w: 0.12, test: f => f.nutAdvantage && f.nutAdvantage.advantage > 0 },
      { w: 0.08, test: f => f.texture === 'DRY' || f.texture === 'VERY_DRY' }
    ]
  },

  LOW_BOARD_DEFENDER_EDGE: {
    category: 'RANGE', importance: 0.75,
    confidence_rules: [
      { w: 0.40, test: f => f.rankStructure === 'LOW' },
      { w: 0.35, test: f => f.rangeDynamics === 'RANGE_ADV_VILLAIN' },
      { w: 0.25, test: f => (f.rangeAdvantage || 0) < -0.1 }
    ]
  },

  // ── SIGNAL ──
  BTN_FAVORS_AGGRESSION: {
    category: 'SIGNAL', importance: 0.85,
    confidence_rules: [
      { w: 0.40, test: f => f.aggressionSignal === 'ATTACK' },
      { w: 0.25, test: f => f.rangeDynamics === 'RANGE_ADV_HERO' },
      { w: 0.20, test: f => f.nutDynamics === 'NUT_ADV_HERO' },
      { w: 0.15, test: f => f.texture === 'DRY' || f.rankStructure === 'HIGH' }
    ]
  },

  AGGRESSION_REQUIRES_DISCIPLINE: {
    category: 'SIGNAL', importance: 0.70,
    confidence_rules: [
      { w: 0.45, test: f => f.aggressionSignal === 'CAUTION' },
      { w: 0.30, test: f => f.texture === 'VERY_WET' || f.texture === 'WET' },
      { w: 0.25, test: f => f.connectivity === 'HIGHLY_CONNECTED' }
    ]
  },

  DEFENDER_CAN_RESIST: {
    category: 'SIGNAL', importance: 0.65,
    confidence_rules: [
      { w: 0.45, test: f => f.aggressionSignal === 'DEFEND' },
      { w: 0.30, test: f => f.rangeDynamics === 'RANGE_ADV_VILLAIN' },
      { w: 0.25, test: f => f.rankStructure === 'LOW' }
    ]
  },

  VALUE_BETTING_POLARIZED: {
    category: 'SIGNAL', importance: 0.80,
    confidence_rules: [
      { w: 0.50, test: f => f.aggressionSignal === 'POLARIZE' },
      { w: 0.30, test: f => f.pairStructure === 'PAIRED' || f.pairStructure === 'DOUBLE_PAIRED' },
      { w: 0.20, test: f => f.nutAdvantage && Math.abs(f.nutAdvantage.advantage) > 0.25 }
    ]
  },

  // ── RANGE-STAT derived (P1-D: rangeStats を使う新Interpretation) ──
  // これらは盤面全体のmade/potential分布から導かれる
  DRAW_HEAVY_RANGE: {
    category: 'RANGE', importance: 0.75, // RANGEカテゴリ: レンジ分布の特性であってboard textureのDRAWではない
    confidence_rules: [
      { w: 0.55, test: f => (f.rangeStats?.drawHeavy || 0) > 0.50 },    // majority draw-heavy
      { w: 0.30, test: f => (f.rangeStats?.potAvg    || 0) > 0.15 },    // range-wide potential
      { w: 0.15, test: f => f.connectivity === 'CONNECTED' || f.connectivity === 'HIGHLY_CONNECTED' }
    ]
  },

  MADE_STRENGTH_DOMINANT: {
    category: 'RANGE', importance: 0.80,
    confidence_rules: [
      { w: 0.50, test: f => (f.rangeStats?.madeAvg   || 0) > 0.20 },    // above-average made strength
      { w: 0.30, test: f => (f.rangeStats?.drawHeavy || 0) < 0.20 },    // few draws = made hands dominate
      { w: 0.20, test: f => f.texture === 'DRY' || f.texture === 'VERY_DRY' }
    ]
  },

  NEUTRAL: {
    category: 'SIGNAL', importance: 0.0,
    confidence_rules: []
  }
};


const INTERP_WEIGHTS = {
  MAX_DRAW_PRESSURE: 0.95,
  HIGH_DRAW_PRESSURE: 0.75,
  LOW_DRAW_PRESSURE: 0.30,

  FLUSH_THREAT_ACTIVE: 0.80,
  FLUSH_COMPLETED_BOARD: 0.90,

  NUT_REGION_NARROW: 0.85,
  NUT_REGION_POLARIZED: 0.88,
  BOARD_LOCKED: 1.00,

  HIGH_CARD_LEVERAGE: 0.70,
  LOW_BOARD_DEFENDER_EDGE: 0.65,

  STRAIGHT_THREAT_ACTIVE: 0.78,
  MULTI_DRAW_BOARD: 0.82,

  BTN_FAVORS_AGGRESSION: 0.74,
  AGGRESSION_REQUIRES_DISCIPLINE: 0.68,
  DEFENDER_CAN_RESIST: 0.60,
  VALUE_BETTING_POLARIZED: 0.80,

  DRAW_HEAVY_RANGE: 0.70,      // range-stat derived
  MADE_STRENGTH_DOMINANT: 0.65,

  NEUTRAL: 0.0
};


function computeConfidence(key, features) {
  const meta = INTERP_META[key];
  if (!meta || !meta.confidence_rules || meta.confidence_rules.length === 0) return 0.5;

  const rules     = meta.confidence_rules;
  const totalW    = rules.reduce((s, r) => s + r.w, 0);
  let hitW = 0, hitCount = 0;
  for (const r of rules) {
    let pass = false;
    try { pass = r.test(features); } catch { pass = false; }
    if (pass) { hitW += r.w; hitCount++; }
  }

  const coverage = totalW > 0 ? hitW / totalW : 0;  // weighted ratio
  const depth    = hitCount / rules.length;           // rule count ratio

  return coverage * 0.7 + depth * 0.3;
}


function contextMultiplier(features) {
  let m = 1.0;

  if (features.texture === 'VERY_WET') m *= 1.15;
  else if (features.texture === 'WET') m *= 1.08;
  else if (features.texture === 'VERY_DRY') m *= 1.05;

  if (features.connectivity === 'HIGHLY_CONNECTED') m *= 1.2;
  else if (features.connectivity === 'CONNECTED') m *= 1.1;

  if (features.pairStructure === 'DOUBLE_PAIRED') m *= 1.25;
  else if (features.pairStructure === 'TRIPS_BOARD') m *= 1.2;

  if (features.flushPressure === 'THREE_FLUSH') m *= 1.2;
  else if (features.flushPressure === 'FOUR_FLUSH') m *= 1.25;

  return m;
}


function structuralBonus(features, key) {
  let b = 1.0;

  if (key.includes('DRAW') && features.connectivity === 'HIGHLY_CONNECTED') {
    b += 0.1;
  }

  if (key.includes('LEVERAGE') && features.rankStructure === 'HIGH') {
    b += 0.08;
  }

  if (key.includes('NUT') && features.pairStructure !== 'UNPAIRED') {
    b += 0.12;
  }

  if (key.includes('THREAT') && features.flushPressure !== 'RAINBOW') {
    b += 0.06;
  }

  return Math.min(1.5, b); // cap at 1.5x
}


function deriveInterpretations(features) {
  const base = [];

  // ─ Texture layer ─
  if (features.texture === 'VERY_WET') base.push('MAX_DRAW_PRESSURE');
  else if (features.texture === 'WET') base.push('HIGH_DRAW_PRESSURE');
  else if (features.texture === 'VERY_DRY') base.push('LOW_DRAW_PRESSURE');
  else if (features.texture === 'DRY') base.push('LOW_DRAW_PRESSURE');

  // ─ Flush pressure layer ─
  if (features.flushPressure === 'THREE_FLUSH') base.push('FLUSH_THREAT_ACTIVE');
  if (features.flushPressure === 'FOUR_FLUSH') base.push('FLUSH_COMPLETED_BOARD');

  // ─ Pair structure layer ─
  if (features.pairStructure === 'DOUBLE_PAIRED') base.push('NUT_REGION_NARROW');
  if (features.pairStructure === 'TRIPS_BOARD') base.push('NUT_REGION_POLARIZED');
  if (features.pairStructure === 'QUADS_BOARD') base.push('BOARD_LOCKED');

  // ─ Rank + Range layer (NOW ARCHETYPE-MODULATED UPSTREAM) ─
  if (features.rankStructure === 'HIGH' && features.rangeDynamics === 'RANGE_ADV_HERO') {
    base.push('HIGH_CARD_LEVERAGE');
  }
  if (features.rankStructure === 'LOW' && features.rangeDynamics === 'RANGE_ADV_VILLAIN') {
    base.push('LOW_BOARD_DEFENDER_EDGE');
  }

  // ─ Connectivity layer ─
  if (features.connectivity === 'HIGHLY_CONNECTED') base.push('STRAIGHT_THREAT_ACTIVE');
  if (features.connectivity === 'CONNECTED' && features.flushPressure === 'TWO_FLUSH') {
    base.push('MULTI_DRAW_BOARD');
  }

  // ─ Aggression signal layer ─
  if (features.aggressionSignal === 'ATTACK') base.push('BTN_FAVORS_AGGRESSION');
  if (features.aggressionSignal === 'CAUTION') base.push('AGGRESSION_REQUIRES_DISCIPLINE');
  if (features.aggressionSignal === 'DEFEND') base.push('DEFENDER_CAN_RESIST');
  if (features.aggressionSignal === 'POLARIZE') base.push('VALUE_BETTING_POLARIZED');

  // ─ Range-stat derived layer (P1-D: rangeStats) ─
  const rs = features.rangeStats;
  if (rs) {
    if (rs.drawHeavy > 0.50) base.push('DRAW_HEAVY_RANGE');
    if (rs.drawHeavy < 0.20 && rs.madeAvg > 0.18) base.push('MADE_STRENGTH_DOMINANT');
  }

  if (base.length === 0) base.push('NEUTRAL');

  // ─ Score calculation ─
  const m = contextMultiplier(features);
  const archetype = features.archetype || 'STANDARD';

  return base.map(key => {
    const w = INTERP_WEIGHTS[key] ?? 0.5;
    const b = structuralBonus(features, key);
    let score = clamp01(w * m * b);

    // ─ Phase 4A: Apply archetype bonus at interpretation generation time ─
    score = applyArchetypeBonus(score, key, archetype);

    // ─ P1: Confidence Layer ─
    const confidence    = computeConfidence(key, features);
    const importance    = INTERP_META[key]?.importance ?? 0.5;
    const narrativeRank = score * confidence * importance;

    return { key, score, confidence, importance, narrativeRank };
  }).sort((a, b) => b.score - a.score); // Primary sort: score (HUD uses this order)
                                        // Narrative re-sorts by narrativeRank internally
}
