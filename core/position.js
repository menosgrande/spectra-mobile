/* core/position.js — position profiles & archetype. Deps: utils.js, texture.js */

const POSITION_PROFILE = {
  UTG: {
    label: 'UTG (Early)',
    // Opens very tight
    openWidth: 0.6,           // 60% of optimal
    nutDensity: 1.2,          // Premium hand concentration
    highCardDensity: 1.1,     // Broadway heavy
    drawCoverage: 0.8,        // Fewer draws in opening range
    defensibility: 0.7,       // Hard to defend against aggression
    adjustmentFactor: 1.0     // baseline
  },

  HJ: {
    label: 'HJ (Hijack)',
    openWidth: 0.8,
    nutDensity: 1.1,
    highCardDensity: 1.0,
    drawCoverage: 0.9,
    defensibility: 0.75,
    adjustmentFactor: 1.1
  },

  CO: {
    label: 'CO (Cutoff)',
    openWidth: 1.2,           // 120% of optimal
    nutDensity: 1.0,
    highCardDensity: 1.0,
    drawCoverage: 1.1,
    defensibility: 0.85,
    adjustmentFactor: 1.2
  },

  BTN: {
    label: 'BTN (Button)',
    openWidth: 1.5,           // 150% - widest range
    nutDensity: 0.9,          // Diluted premium region
    highCardDensity: 0.95,
    drawCoverage: 1.3,        // Heavy on draws/speculative
    defensibility: 0.9,       // Easy to defend
    adjustmentFactor: 1.3
  },

  SB: {
    label: 'SB (Small Blind)',
    openWidth: 1.3,
    nutDensity: 0.95,
    highCardDensity: 0.98,
    drawCoverage: 1.2,
    defensibility: 1.0,       // Neutral position
    adjustmentFactor: 1.2
  },

  BB: {
    label: 'BB (Big Blind)',
    // Defend rather than open
    defendWidth: 1.8,         // 180% - defend very wide
    openWidth: 0.5,           // Fold most hands preflop
    nutDensity: 0.8,          // Fewer premium hands in calling range
    lowBoardCoverage: 1.4,    // Strong on low boards
    drawCoverage: 1.3,        // Many drawing hands
    defensibility: 1.1,       // Position strength
    adjustmentFactor: 1.0
  }
};


const RANGE_ARCHETYPE_PROFILE = {
  STANDARD: {
    // Balanced, typical play
    rangeWidthMultiplier: 1.0,
    nutConcentration: 1.0,
    equityBoost: 0.0,
    spreadModifier: 0.0
  },

  TIGHT: {
    // Only premium hands, strong ranges
    rangeWidthMultiplier: 0.6,     // Only 60% of hands
    nutConcentration: 1.4,          // More concentrated in nut region
    equityBoost: 0.18,              // ~18% equity improvement
    spreadModifier: -0.25           // Less spread, more polarized
  },

  LOOSE: {
    // Wide, marginal hands included
    rangeWidthMultiplier: 1.5,      // 150% of standard (more marginal)
    nutConcentration: 0.7,          // Diluted nut region
    equityBoost: -0.12,             // ~12% equity decrease
    spreadModifier: 0.35            // More spread, less polarized
  },

  GTO: {
    // Game-theoretically balanced
    rangeWidthMultiplier: 1.0,
    nutConcentration: 1.1,          // Slightly more balanced toward value
    equityBoost: 0.06,              // Slight bias toward exploiting
    spreadModifier: 0.08            // Balanced bluff/value ratio
  },

  RECREATIONAL: {
    // Unpredictable, wide and weak
    rangeWidthMultiplier: 1.8,      // Very wide
    nutConcentration: 0.5,          // Nut region very diluted
    equityBoost: -0.22,             // Significant equity loss
    spreadModifier: 0.5             // Maximum spread
  }
};


function getPositionProfile(position) {
  return POSITION_PROFILE[position] || POSITION_PROFILE.BB;
}


function getOrderedPositionAdvantage(heroPos, villainPos) {
  // Calculate position advantage from ordered pair
  // Hero is the aggressor/opener
  const heroProf = getPositionProfile(heroPos);
  const villainProf = getPositionProfile(villainPos);

  // Higher openWidth = wider opening range = equity advantage early
  // Higher drawCoverage = more flexibility
  const heroAdvantage = (heroProf.openWidth * heroProf.adjustmentFactor);
  const villainDisadvantage = villainProf.defensibility; // How well they can defend

  // Normalize to 0.0-1.0 scale where 0.5 = neutral
  const rawAdvantage = heroAdvantage / (heroAdvantage + villainDisadvantage);
  return clamp01(rawAdvantage);
}


function getOrderedNutAdvantage(heroPos, villainPos, board) {
  // Calculate nut density advantage
  const heroProf = getPositionProfile(heroPos);
  const villainProf = getPositionProfile(villainPos);

  // Nut density from position + board structure
  const heroNutDensity = heroProf.nutDensity;
  const villainNutDensity = villainProf.nutDensity;

  const rawAdvantage = heroNutDensity / (heroNutDensity + villainNutDensity);
  return clamp01(rawAdvantage);
}


function getArchetypeProfile(archetype) {
  return RANGE_ARCHETYPE_PROFILE[archetype] || RANGE_ARCHETYPE_PROFILE.STANDARD;
}


function applyArchetypeToRangeDynamics(baseDynamics, archetype) {
  // Modify range advantage based on archetype range width
  const prof = getArchetypeProfile(archetype);
  
  // TIGHT ranges have wider equity advantage
  // LOOSE ranges have narrower or reversed advantage
  if (baseDynamics === 'RANGE_ADV_HERO') {
    if (archetype === 'TIGHT') return 'RANGE_ADV_HERO';     // Maintain/strengthen
    if (archetype === 'LOOSE') return 'NEUTRAL';           // Dilute advantage
    if (archetype === 'GTO') return 'RANGE_ADV_HERO';       // Maintain
  }
  
  if (baseDynamics === 'RANGE_ADV_VILLAIN') {
    if (archetype === 'TIGHT') return 'RANGE_ADV_VILLAIN';      // Maintain
    if (archetype === 'LOOSE') return 'NEUTRAL';           // Lose advantage
    if (archetype === 'GTO') return 'RANGE_ADV_VILLAIN';        // Maintain
  }

  // RECREATIONAL is unpredictable
  if (archetype === 'RECREATIONAL') return 'NEUTRAL';

  return baseDynamics;
}


function applyArchetypeToNutDynamics(baseNutAdv, archetype) {
  // Modify nut region advantage based on nutConcentration
  const prof = getArchetypeProfile(archetype);
  const nutMultiplier = prof.nutConcentration;

  if (baseNutAdv === 'NUT_ADV_HERO') {
    if (nutMultiplier > 1.2) return 'NUT_ADV_HERO';        // Tighter → stronger nut adv
    if (nutMultiplier < 0.8) return 'NEUTRAL';            // Looser → dilute nut adv
  }

  if (baseNutAdv === 'NUT_ADV_VILLAIN') {
    if (nutMultiplier > 1.2) return 'NUT_ADV_VILLAIN';
    if (nutMultiplier < 0.8) return 'NEUTRAL';
  }

  if (archetype === 'RECREATIONAL') return 'NEUTRAL';     // Too unpredictable

  return baseNutAdv;
}


function applyArchetypeBonus(score, key, archetype) {
  // Interpretation scores are modulated by archetype
  // Applied at interpretation generation time (upstream)
  const prof = getArchetypeProfile(archetype);
  
  // Tight → amplifies value, dilutes bluff
  // Loose → dampens value, amplifies draw
  if (key.includes('VALUE') || key.includes('LEVERAGE')) {
    if (archetype === 'TIGHT') return clamp01(score * (1 + prof.equityBoost * 2));
    if (archetype === 'LOOSE') return clamp01(score * (1 - 0.2));
  }

  if (key.includes('DRAW') || key.includes('PRESSURE')) {
    if (archetype === 'TIGHT') return clamp01(score * 0.8);   // Draw less likely in tight range
    if (archetype === 'LOOSE') return clamp01(score * 1.3);   // Draw more likely in loose
  }

  return score;
}
