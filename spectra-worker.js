/**
 * SPECTRA v3.9.1 Worker — Entry Point
 *
 * このファイルは「公開APIの窓口」のみを担う。
 * 計算・評価・意味生成はすべて core/ モジュールが行う。
 *
 * importScripts 読込順（依存グラフ順）:
 *   utils → texture → position → strength → range_matrix
 *   → board_intel → interpretations → narrative → board_intelligence
 */

importScripts(
  './core/utils.js',
  './core/texture.js',
  './core/position.js',
  './core/strength.js',
  './core/range_matrix.js',
  './core/board_intel.js',
  './core/interpretations.js',
  './core/narrative.js',
  './core/board_intelligence.js'
);

console.log('[SPECTRA v3.9.1] All modules loaded OK');

/* ══════════════════════════════
   PUBLIC API
   BOARD_INTELLIGENCE — unified entry (P1.5〜)
   EVAL_169, TEXTURE  — backward compat (legacy)
   INIT               — handshake
══════════════════════════════ */
self.onmessage = function (e) {
  const { type, payload, requestId } = e.data;

  try {
    if (type === 'INIT') {
      self.postMessage({
        type: 'INIT_OK',
        version: '3.9.1',
        capabilities: ['BOARD_INTELLIGENCE', 'EVAL_169', 'TEXTURE']
      });
      return;
    }

    if (type === 'BOARD_INTELLIGENCE') {
      const t0      = performance.now();
      const board   = payload.board   || [];
      const context = payload.context || { street: 'FLOP', positions: 'BTN_VS_BB' };

      const cacheKey = board.join(',') + '|'
        + (context.heroPos    || 'BTN') + '|'
        + (context.villainPos || 'BB')  + '|'
        + (context.archetype  || 'STANDARD') + '|'
        + (context.profile    || 'BTN_VS_BB');

      if (evalCache.has(cacheKey)) {
        self.postMessage({
          type: 'BOARD_INTELLIGENCE',
          requestId,
          data: evalCache.get(cacheKey),
          cached: true,
          calcTime: 0
        });
        return;
      }

      const intel = analyzeBoard(board, context);
      intel.texture = calcBoardTexture(board);

      const ms = Math.round(performance.now() - t0);
      cacheSet(cacheKey, intel);

      self.postMessage({
        type: 'BOARD_INTELLIGENCE',
        requestId,
        data: intel,
        cached: false,
        calcTime: ms
      });
      return;
    }

    if (type === 'EVAL_169') {
      const t0       = performance.now();
      const board    = payload.board || [];
      const cacheKey = 'e169:' + board.join(',');

      if (evalCache.has(cacheKey)) {
        self.postMessage({
          type: 'EVAL_169',
          requestId,
          data: evalCache.get(cacheKey),
          cached: true,
          calcTime: 0
        });
        return;
      }

      const results = eval169(board);
      const ms      = Math.round(performance.now() - t0);
      cacheSet(cacheKey, results);

      self.postMessage({
        type: 'EVAL_169',
        requestId,
        data: results,
        cached: false,
        calcTime: ms
      });
      return;
    }

    if (type === 'TEXTURE') {
      self.postMessage({
        type: 'TEXTURE',
        requestId,
        data: calcBoardTexture(payload.board || [])
      });
      return;
    }
  } catch (err) {
    self.postMessage({
      type: 'ENGINE_ERROR',
      requestId,
      data: {
        message: err?.message || String(err),
        stack: err?.stack || ''
      }
    });
  }
};
