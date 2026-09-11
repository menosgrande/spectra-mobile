/**
 * SPECTRA v3.9.1 Worker — Entry Point
 *
 * このファイルは「公開APIの窓口」のみを担う。
 * 計算・評価・意味生成はすべて core/ モジュールが行う。
 *
 * importScripts 読込順（依存グラフ順）:
 *   utils → texture → position → strength → equity → range_matrix
 *   → board_intel → interpretations → narrative → board_intelligence
 */

importScripts(
  './core/utils.js',
  './core/texture.js',
  './core/position.js',
  './core/strength.js',
  './core/equity.js',
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
        // v3.9.47: 他AIによる独立監査で指摘。この文字列はv3.9.1以降ずっと
        // 更新されておらず、実際のバージョンと乖離していた（診断時の混乱種）。
        // このプロジェクトにバージョンの単一の正はREADMEの変更履歴しかなく、
        // ここだけを機械的に同期する仕組みも無いため、精度の低い数字を
        // 更新し続けるより「追跡していない」ことを明示する方が安全と判断。
        version: 'unspecified (see README changelog)',
        capabilities: ['BOARD_INTELLIGENCE', 'EVAL_169', 'TEXTURE', 'HERO_RANK']
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

    if (type === 'HERO_RANK') {
      // v3.9.39: 「強さ目安 v1」専用API。BOARD_INTELLIGENCE(analyzeBoard())の
      // パイプラインには一切触れない、独立した軽量リクエスト。Hero Handの
      // カード変更時にこれだけを呼ぶ設計で、triggerUpdate()は呼ばない。
      const t0    = performance.now();
      const board = payload.board || [];
      const hero  = payload.hero  || [];

      // evaluate7()は5枚未満のカードでは常にscore:0を返す仕様のため、
      // Preflop（board.length<3）ではHERO_RANKの結果は無意味になる。
      // 呼び出し側（renderHeroAnalysis）は既にPreflopをChen percentile経路に
      // 分岐させているので、ここに到達するのは想定外だが、防御的にガードする。
      if (board.length < 3 || hero.length !== 2) {
        self.postMessage({
          type: 'HERO_RANK',
          requestId,
          data: null,
          reason: 'HERO_RANK requires board.length>=3 and hero.length===2 (Preflop is out of scope for v1)'
        });
        return;
      }

      const cacheKey = 'hr:' + board.join(',') + '|' + [...hero].sort().join(',');

      if (heroRankCache.has(cacheKey)) {
        self.postMessage({
          type: 'HERO_RANK',
          requestId,
          data: heroRankCache.get(cacheKey),
          cached: true,
          calcTime: 0
        });
        return;
      }

      const result = computeHeroRank(board, hero);
      const ms     = Math.round(performance.now() - t0);
      heroRankCacheSet(cacheKey, result);

      self.postMessage({
        type: 'HERO_RANK',
        requestId,
        data: result,
        cached: false,
        calcTime: ms
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
