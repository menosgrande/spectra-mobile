/* core/board_intelligence.js — orchestrator. Deps: ALL */

function detectStreet(board) {
  if (!board || board.length < 3) return 'PREFLOP';
  if (board.length === 3) return 'FLOP';
  if (board.length === 4) return 'TURN';
  return 'RIVER';
}


function buildPreFlopIntelligence(context) {
  return {
    street: 'PREFLOP',
    features: {
      texture: 'NEUTRAL',
      connectivity: 'NEUTRAL',
      flushPressure: 'NEUTRAL',
      pairStructure: 'NEUTRAL',
      rankStructure: 'NEUTRAL',
      rangeDynamics: 'NEUTRAL',
      nutDynamics: 'NEUTRAL',
      aggressionSignal: 'NEUTRAL'
    },
    metrics: {
      wetnessScore: 0,
      connectivityScore: 0,
      flushScore: 0,
      highCardScore: 0
    },
    interpretations: ['WAITING_FOR_BOARD'],
    narrative: ['Waiting for board.'],
    hudSignals: { attack: 'NEUTRAL', value: 'NEUTRAL', bluff: 'NEUTRAL', capped: 'NONE' }
  };
}


function analyzeBoard(board, context) {
  if (!board || board.length < 3) {
    return buildPreFlopIntelligence(context);
  }

  const heroPos    = context.heroPos    || 'BTN';
  const villainPos = context.villainPos || 'BB';

  // ── Unified evaluation core ──
  // 1. Range matrix (169 hands × board)
  const rangeMatrix = evalRange169(board, [], context);

  // 2. Board features (texture / connectivity / pair / rank)
  const features = extractBoardFeatures(board, context);

  // 3. Advantage engine (-1..+1 scalars)
  const rangeAdv   = computeRangeAdvantage(board, heroPos, villainPos, rangeMatrix);
  const nutAdv     = computeNutAdvantage(board, heroPos, villainPos, rangeMatrix);
  const rangeStats = computeRangeStats(rangeMatrix);

  // Attach continuous advantage values + range stats to features for downstream consumers
  features.rangeAdvantage = rangeAdv;                    // -1..+1
  features.nutAdvantage   = nutAdv;                      // { advantage, density, coverage }
  features.rangeStats     = rangeStats;                  // { madeAvg, potAvg, drawHeavy, madeSpread }

  // 4. Interpretations (use enriched features)
  const interpretations = deriveInterpretations(features);

  // 5. Narrative + HUD
  const narrative  = buildNarrative(interpretations, 3, features);
  const hudSignals = deriveHudSignals(features, interpretations, context);
  const metrics    = extractMetrics(features);

  return {
    street: context.street || detectStreet(board),
    features,
    metrics,
    interpretations,
    narrative,
    hudSignals,
    rangeMatrix   // include for consumers that want raw matrix
  };
}
