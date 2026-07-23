/* core/board_intel.js — board features, range dynamics, aggression. Deps: texture, position */

function extractBoardFeatures(board, context) {
  // ─ Single source of truth: texture ─
  const textureData = calcBoardTexture(board);
  
  // ─ All derived from this single texture ─
  const connectivity = classifyConnectivity(board);
  const flushPressure = classifyFlushPressure(board);
  const pairStructure = classifyPairStructure(board);
  const rankStructure = classifyRankStructure(board);
  
  // ─ Now rangeDynamics uses Position Matrix + board ─
  const rangeDynamicsResult = calcRangeDynamics(
    textureData.texture,
    connectivity,
    rankStructure,
    pairStructure,
    context  // Includes heroPos, villainPos, archetype
  );
  
  let rangeDynamics = rangeDynamicsResult.label;
  
  let nutDynamics = classifyNutDynamics(board, context);
  
  // ─ Phase 4A: Apply Archetype to Range/Nut (upstream) ─
  const archetype = context.archetype || 'STANDARD';
  rangeDynamics = applyArchetypeToRangeDynamics(rangeDynamics, archetype);
  nutDynamics = applyArchetypeToNutDynamics(nutDynamics, archetype);
  
  const aggressionSignal = deriveAggressionSignal({
    texture: textureData.texture,
    connectivity,
    flushPressure,
    pairStructure,
    rankStructure,
    rangeDynamics,
    nutDynamics
  });

  return {
    texture: textureData.texture,
    connectivity,
    flushPressure,
    pairStructure,
    rankStructure,
    rangeDynamics,
    nutDynamics,
    aggressionSignal,
    wetnessScore: textureData.wetnessScore,
    connectivityScore: textureData.connectivityScore,
    flushScore: textureData.flushScore,
    archetype: archetype // Carry archetype forward for interpretation
  };
}


function calcRangeDynamics(texture, connectivity, rankStructure, pairStructure, context) {
  // Phase 4B: Position Matrix replaces discrete labels
  // Extract positions from context
  const heroPos = context.heroPos || 'BTN';
  const villainPos = context.villainPos || 'BB';

  // ─ Get position-based advantage scores (0.0-1.0) ─
  const positionAdvantage = getOrderedPositionAdvantage(heroPos, villainPos);
  
  // ─ Physical layer: texture + connectivity ─
  const isHighCardAdvantage = rankStructure === 'HIGH' && connectivity === 'LOW_CONNECTED';
  const isDrawHeavy = texture === 'VERY_WET' || texture === 'WET';
  const isConnected = connectivity === 'CONNECTED' || connectivity === 'HIGHLY_CONNECTED';
  const isPaired = pairStructure === 'PAIRED' || pairStructure === 'DOUBLE_PAIRED' || pairStructure === 'TRIPS_BOARD';

  // ─ Board adjustments to position advantage ─
  let boardModifier = 1.0;

  if (isHighCardAdvantage) {
    boardModifier += 0.2; // Hero gains on high cards
  }

  if (isDrawHeavy) {
    boardModifier -= 0.1; // Villain (typically in-position/defensive) gains on draws
  }

  if (isConnected) {
    boardModifier -= 0.15; // Villain's connected ranges strengthen
  }

  if (isPaired) {
    boardModifier -= 0.15; // Villain can trap with sets
  }

  if (texture === 'DRY' || texture === 'VERY_DRY') {
    boardModifier += 0.12; // Hero can pressure
  }

  // ─ Calculate final range advantage ─
  const rangeAdvantage = clamp01(positionAdvantage * boardModifier);

  // ─ Convert to discrete label for backward compatibility (optional) ─
  // But store the continuous score
  let rangeDynamics;
  if (rangeAdvantage > 0.6) {
    rangeDynamics = 'RANGE_ADV_HERO';
  } else if (rangeAdvantage < 0.4) {
    rangeDynamics = 'RANGE_ADV_VILLAIN';
  } else {
    rangeDynamics = 'NEUTRAL';
  }

  return {
    label: rangeDynamics,
    score: rangeAdvantage,
    heroScore: rangeAdvantage,
    villainScore: 1.0 - rangeAdvantage
  };
}


function classifyNutDynamics(board, context) {
  const hasAce = board.some(c => c[0] === 'A');
  const hasKing = board.some(c => c[0] === 'K');
  const connectivity = classifyConnectivity(board);
  const pairStruct = classifyPairStructure(board);

  // バグ修正: context.positions('BTN_VS_BB'等の文字列)を見ていたが、
  // 実際にUIから渡されるcontextはcontext.heroPos/context.villainPosのみで、
  // context.positionsはWorkerのフォールバックデフォルトにしか存在しない。
  // そのため実運用では常にundefinedとの比較になり、
  // 常にNEUTRAL/NUT_ADV_VILLAIN固定になってしまっていた（実際のポジションを無視）。
  const isBtnVsBb = context.heroPos === 'BTN' && context.villainPos === 'BB';

  if ((hasAce || hasKing) && connectivity === 'LOW_CONNECTED' && pairStruct === 'UNPAIRED') {
    return isBtnVsBb ? 'NUT_ADV_HERO' : 'NEUTRAL';
  }

  if (connectivity === 'HIGHLY_CONNECTED' && (pairStruct === 'PAIRED' || pairStruct === 'DOUBLE_PAIRED')) {
    return isBtnVsBb ? 'NEUTRAL' : 'NUT_ADV_VILLAIN';
  }

  return 'NEUTRAL';
}


function deriveAggressionSignal(features) {
  const { texture, connectivity, flushPressure, pairStructure, rankStructure, rangeDynamics, nutDynamics } = features;

  if (rangeDynamics === 'RANGE_ADV_HERO' && nutDynamics === 'NUT_ADV_HERO' && (rankStructure === 'HIGH' || texture === 'DRY' || texture === 'VERY_DRY')) {
    return 'ATTACK';
  }

  if (texture === 'VERY_WET' && connectivity === 'HIGHLY_CONNECTED' && (flushPressure === 'THREE_FLUSH' || flushPressure === 'FOUR_FLUSH')) {
    return 'CAUTION';
  }

  if (rangeDynamics === 'RANGE_ADV_VILLAIN' && nutDynamics === 'NUT_ADV_VILLAIN') {
    return 'DEFEND';
  }

  if (pairStructure === 'PAIRED' || pairStructure === 'DOUBLE_PAIRED' || pairStructure === 'TRIPS_BOARD') {
    return 'POLARIZE';
  }

  return 'NEUTRAL';
}
