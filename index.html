<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"/>
<title>SPECTRA v3.0</title>
<link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@500;600;700&family=Orbitron:wght@700;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
html,body{width:100%;height:100%;overflow:hidden;background:#04080f;color:#c8dff0;font-family:'Rajdhani',sans-serif;}
body::after{content:'';position:fixed;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.07) 2px,rgba(0,0,0,0.07) 4px);pointer-events:none;z-index:9999;}
#root{display:flex;flex-direction:column;width:100vw;height:100vh;}

/* HEADER */
#hdr{display:flex;align-items:center;justify-content:space-between;padding:5px 14px;border-bottom:1px solid rgba(0,180,255,0.2);background:linear-gradient(90deg,#030810,#060f1e,#030810);flex-shrink:0;height:46px;}
.logo-t{font-family:'Orbitron',monospace;font-size:17px;font-weight:900;color:#00d4ff;text-shadow:0 0 16px rgba(0,212,255,.6);letter-spacing:3px;}
.logo-s{font-size:8px;letter-spacing:3px;color:rgba(160,200,230,.4);margin-top:1px;}
.hdr-mid{font-family:'Orbitron',monospace;font-size:15px;font-weight:700;color:#00d4ff;letter-spacing:4px;text-shadow:0 0 20px rgba(0,212,255,.5);}
.hdr-r{display:flex;align-items:center;gap:10px;font-family:'Share Tech Mono',monospace;font-size:11px;color:rgba(160,200,230,.5);}
.conn-dot{width:7px;height:7px;border-radius:50%;background:#00ff9d;box-shadow:0 0 8px rgba(0,255,157,.6);animation:pulse 1.8s ease-in-out infinite;}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}

/* MODE TOGGLE */
#mode-toggle{display:flex;gap:0;border:1px solid rgba(0,180,255,.3);border-radius:3px;overflow:hidden;flex-shrink:0;}
.mode-btn{font-family:'Orbitron',monospace;font-size:9px;letter-spacing:1.5px;padding:4px 10px;cursor:pointer;border:none;background:transparent;color:rgba(160,200,230,.4);transition:all .2s;}
.mode-btn.active{background:rgba(0,212,255,.15);color:#00d4ff;text-shadow:0 0 8px rgba(0,212,255,.6);}
.mode-btn:hover:not(.active){background:rgba(0,212,255,.06);color:rgba(0,212,255,.7);}
#mode-divider{width:1px;background:rgba(0,180,255,.3);}

/* MAIN */
#main{display:grid;grid-template-columns:200px 1fr 220px;gap:6px;padding:6px;flex:1;min-height:0;}
@media(min-width:769px){#main{display:grid !important;grid-template-columns:200px 1fr 220px !important;}}

/* PANEL */
.pnl{background:#080e1a;border:1px solid rgba(0,180,255,0.15);border-radius:3px;display:flex;flex-direction:column;gap:5px;padding:7px;position:relative;overflow:hidden;}
@media(min-width:769px){#main>.pnl{display:flex !important;}}
.pnl::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(0,212,255,.4),transparent);}
.sec{font-family:'Orbitron',monospace;font-size:7.5px;letter-spacing:2.5px;color:rgba(0,212,255,.7);text-transform:uppercase;padding-bottom:4px;border-bottom:1px solid rgba(0,180,255,.12);flex-shrink:0;}

/* LEFT — STREET + NUTS */
#street-box{background:rgba(0,180,255,.06);border:1px solid rgba(0,255,157,.2);border-radius:2px;padding:8px;text-align:center;flex-shrink:0;}
#street-name{font-family:'Orbitron',monospace;font-size:26px;font-weight:900;color:#00ff9d;text-shadow:0 0 20px rgba(0,255,157,.7);letter-spacing:2px;}
#street-cnt{font-family:'Share Tech Mono',monospace;font-size:12px;color:rgba(160,200,230,.5);margin-top:2px;}
#nuts-list{display:flex;flex-direction:column;gap:4px;flex:1;overflow:hidden;}
.nuts-row{display:flex;align-items:center;gap:5px;padding:5px 4px;border-bottom:1px solid rgba(255,255,255,.05);}
.n-rank{font-family:'Orbitron',monospace;font-size:12px;color:#ffb800;min-width:16px;}
.n-eq{font-family:'Share Tech Mono',monospace;font-size:10px;color:#00d4ff;background:rgba(0,200,255,.08);border:1px solid rgba(0,200,255,.25);border-radius:2px;padding:2px 5px;min-width:44px;text-align:center;}
.n-hand{font-size:16px;font-weight:700;flex:1;}
.n-type{font-size:9px;color:rgba(160,200,230,.5);text-align:right;line-height:1.3;}

/* CENTER */
#center-pnl{padding:5px;gap:4px;}
.cam-hdr{display:flex;justify-content:space-between;align-items:center;flex-shrink:0;}
.cam-lbl{font-family:'Orbitron',monospace;font-size:8px;letter-spacing:2px;color:rgba(0,212,255,.7);}
.cam-lbl span{color:#00d4ff;}

/* Camera wrap */
#cam-wrap{flex:1;position:relative;background:#000;border:1px solid rgba(0,180,255,.25);border-radius:3px;overflow:hidden;min-height:0;}
#cam-video{width:100%;height:100%;object-fit:cover;display:none;}
#cam-canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}
#cam-placeholder{position:absolute;inset:0;background:radial-gradient(ellipse at center,#0a1830 0%,#020810 70%);display:flex;align-items:center;justify-content:center;}
#table-oval{width:80%;height:76%;border:3px solid #1e2d45;border-radius:120px;background:radial-gradient(ellipse,#0d1f35 0%,#070f1c 100%);position:relative;display:flex;align-items:center;justify-content:center;box-shadow:0 0 40px rgba(0,0,0,.8),inset 0 0 30px rgba(0,0,0,.6);}
#table-oval::before{content:'';position:absolute;inset:6px;border:1px solid rgba(0,180,255,.08);border-radius:114px;}
.pl-chip{width:28px;height:28px;border-radius:50%;background:#0f1e30;border:1px solid #1e2d45;display:flex;align-items:center;justify-content:center;font-size:8px;color:#3a5070;font-family:'Share Tech Mono',monospace;}
.pl-cards{display:flex;gap:2px;}
.pl-card-back{width:9px;height:13px;background:#1a2a40;border:1px solid #243550;border-radius:1px;}
#pl-top{position:absolute;top:-17px;display:flex;flex-direction:column;align-items:center;gap:2px;}
#pl-left{position:absolute;left:-18px;display:flex;align-items:center;gap:2px;}
#pl-right{position:absolute;right:-18px;display:flex;align-items:center;gap:2px;}
#pl-bot{position:absolute;bottom:-17px;display:flex;flex-direction:column;align-items:center;gap:2px;}

/* BOARD CARDS AREA */
#board-area{display:flex;flex-direction:column;padding:4px 2px;flex-shrink:0;}
.board-slot{display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;}
.slot-inputs{display:flex;gap:2px;width:100%;align-items:center;}
.slot-inputs select{flex:1;min-width:0;background:#0c1828;border:1px solid rgba(0,180,255,.35);border-radius:3px;font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;padding:3px 1px;cursor:pointer;outline:none;text-align:center;transition:border-color .2s,background .2s,box-shadow .2s;box-shadow:0 0 6px rgba(0,140,255,.15);}
.slot-inputs select:focus{border-color:rgba(0,212,255,.9);background:#0f2035;box-shadow:0 0 10px rgba(0,212,255,.3);}
.rank-sel{color:#e0f0ff;}

/* Card display */
.board-card{width:100%;aspect-ratio:2.2/3.2;border:2px solid rgba(0,255,157,.5);border-radius:6px;background:transparent;display:flex;align-items:center;justify-content:center;position:relative;transition:border-color .2s,box-shadow .2s;overflow:hidden;}
.board-card.waiting{border-color:rgba(0,180,255,.15);box-shadow:none;background:transparent;}
.board-card.active{border-color:rgba(255,255,255,.25);box-shadow:0 0 18px rgba(0,255,157,.2);}
.card-inner{width:100%;height:100%;border-radius:5px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;}
.bg-s{background:#b0b8c8;}.bg-h{background:#f0a0a8;}.bg-d{background:#90b0e8;}.bg-c{background:#90c8a0;}
.card-suit-bg{font-size:clamp(80px,13vw,140px);line-height:1;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;user-select:none;}
.card-suit-bg.sym-s{color:#1a1a22;}.card-suit-bg.sym-h{color:#8b0010;}.card-suit-bg.sym-d{color:#0a2080;}.card-suit-bg.sym-c{color:#0a4010;}
.card-rank-center{font-size:clamp(30px,4.5vw,52px);font-weight:900;line-height:1;font-family:Georgia,'Times New Roman',serif;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.5);position:relative;z-index:2;}
.card-corner-tl{position:absolute;top:4px;left:5px;display:flex;flex-direction:column;align-items:center;z-index:3;line-height:1.1;}
.card-corner-br{position:absolute;bottom:4px;right:5px;display:flex;flex-direction:column;align-items:center;transform:rotate(180deg);z-index:3;line-height:1.1;}
.corner-rank{font-size:11px;font-weight:700;font-family:Georgia,serif;color:#fff;line-height:1;text-shadow:0 1px 3px rgba(0,0,0,.4);}
.corner-suit{font-size:9px;line-height:1;color:rgba(255,255,255,.9);}
.wait-txt{font-family:'Share Tech Mono',monospace;font-size:8px;color:rgba(0,180,255,.35);letter-spacing:1px;animation:blink2 1.4s step-end infinite;}
.slot-clr{opacity:0;pointer-events:none;transition:opacity .15s;}
.slot-clr.has-card{opacity:1;pointer-events:auto;}
.cam-mode .slot-inputs{display:none;}

/* Stabilizer */
#stab-bar{display:flex;align-items:center;gap:7px;padding:4px 8px;border:1px solid rgba(0,255,157,.2);border-radius:2px;background:rgba(0,255,157,.03);font-family:'Share Tech Mono',monospace;font-size:9px;flex-shrink:0;}
#stab-dot{width:7px;height:7px;border-radius:50%;}
#stab-txt{flex:1;}
#stab-conf{color:#00d4ff;}

/* RIGHT */
.wet-big{font-family:'Orbitron',monospace;font-size:22px;font-weight:700;color:#ff3b3b;text-shadow:0 0 14px rgba(255,59,59,.5);}
.wet-sub{font-size:9px;color:#ff3b3b;letter-spacing:2px;margin-top:-2px;}
.metric{margin-bottom:6px;}
.metric-lbl{font-size:9px;letter-spacing:1.5px;color:rgba(160,200,230,.45);margin-bottom:2px;}
.bar-wrap{height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden;}
.bar-fill{height:100%;border-radius:2px;transition:width .7s ease;}
.metric-val{font-family:'Share Tech Mono',monospace;font-size:11px;margin-top:2px;}
.range-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:3px;}
.range-name{font-family:'Orbitron',monospace;font-size:8px;letter-spacing:1.5px;margin-bottom:3px;}
.range-val{font-family:'Share Tech Mono',monospace;font-size:13px;font-weight:700;margin-top:2px;}

/* HEATMAP */
#hm-wrap{flex:1;display:flex;flex-direction:column;min-height:0;gap:2px;position:relative;}
#hm-grid{display:grid;grid-template-columns:11px repeat(13,1fr);gap:1px;flex:1;min-height:0;align-content:start;}
.hm-hdr{font-family:'Share Tech Mono',monospace;font-size:7px;color:rgba(0,212,255,.55);display:flex;align-items:center;justify-content:center;}
.hm-c{font-family:'Share Tech Mono',monospace;font-size:6px;display:flex;align-items:center;justify-content:center;border-radius:1px;aspect-ratio:1/1;transition:background-color .3s ease;cursor:default;color:rgba(255,255,255,.75);}
#hm-spin{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(4,8,15,.75);border-radius:2px;font-family:'Share Tech Mono',monospace;font-size:10px;color:#00d4ff;letter-spacing:2px;}
#hm-spin.active{display:flex;}

/* FOOTER */
#ftr{display:flex;justify-content:space-between;align-items:center;padding:3px 14px;border-top:1px solid rgba(0,180,255,.15);font-family:'Share Tech Mono',monospace;font-size:9px;color:rgba(160,200,230,.4);flex-shrink:0;background:rgba(0,0,0,.5);}
.analyzing{color:#00ff9d;animation:blink2 1.4s step-end infinite;}
@keyframes blink2{0%,100%{opacity:1}50%{opacity:.15}}

/* BRAIN OVERLAY — v3.0: Worker初期化中 */
#brain-overlay{position:fixed;inset:0;background:rgba(4,8,15,.93);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:1000;transition:opacity .5s;}
#brain-overlay.hidden{opacity:0;pointer-events:none;}
.brain-title{font-family:'Orbitron',monospace;font-size:18px;color:#00d4ff;letter-spacing:4px;text-shadow:0 0 20px rgba(0,212,255,.6);}
.brain-msg{font-family:'Share Tech Mono',monospace;font-size:11px;color:rgba(160,200,230,.6);}
.brain-prog-wrap{width:300px;height:3px;background:rgba(0,180,255,.1);border-radius:2px;overflow:hidden;}
.brain-prog{height:100%;background:linear-gradient(90deg,#00d4ff,#00ff9d);border-radius:2px;transition:width .4s;}

/* MOBILE */
#mob-tabs{display:none;flex-shrink:0;flex-direction:row;background:#040a14;border-bottom:1px solid rgba(0,180,255,.2);}
.mob-tab{flex:1;font-family:'Orbitron',monospace;font-size:8px;letter-spacing:1.5px;padding:9px 4px;border:none;background:transparent;color:rgba(160,200,230,.35);cursor:pointer;border-bottom:2px solid transparent;transition:all .2s;}
.mob-tab.active{color:#00d4ff;border-bottom-color:#00d4ff;background:rgba(0,212,255,.05);}

@media(max-width:768px){
  html,body{overflow:auto;}
  #root{height:auto;min-height:100dvh;overflow:visible;}
  #hdr{padding:6px 10px;height:auto;flex-wrap:wrap;gap:4px;}
  .logo-s{display:none;}.logo-t{font-size:14px;letter-spacing:2px;}.hdr-mid{display:none;}
  #fps-d,#time-d{display:none;}.hdr-r{gap:6px;}.conn-dot{display:none;}
  #mob-tabs{display:flex;}
  #main{display:flex !important;flex-direction:column !important;padding:0;gap:0;flex:none;}
  #main>.pnl{display:none;overflow:visible;border-radius:0;border-left:none;border-right:none;min-height:calc(100dvh - 46px - 37px);flex-shrink:0;}
  #main>.pnl.mob-active{display:flex;}
  #cam-wrap{min-height:140px;max-height:180px;flex:0 0 160px;}
  .card-suit-bg{font-size:clamp(36px,14vw,64px);}
  .card-rank-center{font-size:clamp(18px,6vw,32px);}
  #board-area>div:last-child{overflow-x:auto;padding-bottom:4px;}
  .slot-inputs select,#board-area select{font-size:16px !important;padding:6px 2px !important;min-height:36px;}
  .slot-clr{width:30px !important;height:30px !important;font-size:14px !important;}
  #clear-all-btn{padding:6px 12px !important;font-size:9px !important;}
  .n-eq{font-size:11px;}.n-hand{font-size:18px;}.n-type{font-size:10px;}
  #hm-grid{grid-template-columns:14px repeat(13,1fr);gap:2px;}
  .hm-c{font-size:7px;}
  #ftr{display:none;}
  #table-oval{width:90%;height:70%;}
}
</style>
</head>
<body>
<div id="root">

<!-- BRAIN OVERLAY -->
<div id="brain-overlay">
  <div class="brain-title">SPECTRA v3.0</div>
  <div class="brain-msg" id="brain-msg">INITIALIZING ENGINE WORKER...</div>
  <div class="brain-prog-wrap"><div class="brain-prog" id="brain-prog" style="width:20%"></div></div>
  <div style="font-family:'Share Tech Mono',monospace;font-size:9px;color:rgba(160,200,230,.3);margin-top:4px;" id="brain-sub">loading spectra-worker.js</div>
</div>

<!-- HEADER -->
<div id="hdr">
  <div><div class="logo-t">SPECTRA</div><div class="logo-s">SPECTRA POKER SYSTEM v3.0</div></div>
  <div class="hdr-mid">SPECTRA</div>
  <div class="hdr-r">
    <div id="mode-toggle">
      <button class="mode-btn active" id="btn-manual" onclick="setMode('MANUAL')">MANUAL</button>
      <div id="mode-divider"></div>
      <button class="mode-btn" id="btn-camera" onclick="setMode('CAMERA')">CAMERA</button>
    </div>
    <div class="conn-dot"></div>
    <span>|</span><span id="fps-d">FPS: 29</span>
    <span id="time-d">--:--:--</span>
    <span id="brain-badge" style="font-family:'Orbitron',monospace;font-size:8px;padding:2px 6px;border:1px solid rgba(0,180,255,.3);border-radius:2px;color:rgba(0,180,255,.6);letter-spacing:1px;">BRAIN:INIT</span>
  </div>
</div>

<!-- MOBILE TABS -->
<div id="mob-tabs">
  <button class="mob-tab active" id="mtab-board" onclick="mobTab('board')">BOARD</button>
  <button class="mob-tab" id="mtab-nuts"  onclick="mobTab('nuts')">NUTS</button>
  <button class="mob-tab" id="mtab-stats" onclick="mobTab('stats')">ANALYTICS</button>
</div>

<!-- MAIN -->
<div id="main">

  <!-- LEFT: STREET + NUTS -->
  <div class="pnl" id="mob-pnl-nuts">
    <div id="street-box">
      <div id="street-name">PREFLOP</div>
      <div id="street-cnt">0 / 5</div>
    </div>
    <div class="sec" style="margin-top:3px">NUTS RANKING <span style="font-size:6.5px;opacity:.6">[ABSOLUTE]</span></div>
    <div id="nuts-list">
      <div style="font-family:'Share Tech Mono',monospace;font-size:9px;color:rgba(160,200,230,.3);padding:10px 4px;line-height:1.6;">ボードを3枚以上<br>入力するとNUTS<br>が表示されます</div>
    </div>
  </div>

  <!-- CENTER -->
  <div class="pnl mob-active" id="center-pnl">
    <div class="cam-hdr">
      <div class="cam-lbl" id="cam-lbl-txt">▐ MANUAL BOARD INPUT <span>[SIMULATOR MODE]</span></div>
      <div id="board-hash" style="font-family:'Share Tech Mono',monospace;font-size:9px;color:rgba(0,212,255,.6)">BOARD: --</div>
    </div>
    <div id="cam-wrap">
      <video id="cam-video" autoplay playsinline muted></video>
      <canvas id="cam-canvas"></canvas>
      <div id="cam-placeholder">
        <div id="table-oval">
          <div id="pl-top"><div class="pl-cards"><div class="pl-card-back"></div><div class="pl-card-back"></div></div><div class="pl-chip">D</div></div>
          <div id="pl-left"><div class="pl-chip">P1</div><div class="pl-cards"><div class="pl-card-back"></div><div class="pl-card-back"></div></div></div>
          <div id="pl-right"><div class="pl-cards"><div class="pl-card-back"></div><div class="pl-card-back"></div></div><div class="pl-chip">P3</div></div>
          <div id="pl-bot"><div class="pl-chip">P2</div><div class="pl-cards"><div class="pl-card-back"></div><div class="pl-card-back"></div></div></div>
        </div>
      </div>
    </div>
    <div id="board-area"></div>
    <div id="stab-bar">
      <div id="stab-dot" style="background:rgba(0,180,255,.4);"></div>
      <div id="stab-txt" style="color:rgba(0,180,255,.6);">MANUAL INPUT MODE — SELECT CARDS ABOVE</div>
      <div id="stab-conf">CONF: --</div>
    </div>
  </div>

  <!-- RIGHT: ANALYTICS + HEATMAP -->
  <div class="pnl" id="mob-pnl-stats">
    <div class="sec">ANALYTICS &amp; HUD</div>
    <div style="height:3px;background:rgba(255,255,255,.05);border-radius:2px;overflow:hidden;flex-shrink:0;">
      <div id="prog-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#00d4ff,#1a6aff);border-radius:2px;transition:width .7s;"></div>
    </div>
    <div style="background:rgba(0,0,0,.3);border:1px solid rgba(0,180,255,.12);border-radius:3px;padding:7px;flex-shrink:0;">
      <div class="sec" style="border:none;padding:0;margin-bottom:5px;">▐ BOARD TEXTURE</div>
      <div class="wet-big" id="wet-val">--%</div>
      <div class="wet-sub" id="wet-lbl">ANALYZING</div>
      <div style="margin-top:7px;">
        <div class="metric">
          <div class="metric-lbl">CONNECTEDNESS</div>
          <div class="bar-wrap"><div class="bar-fill" id="bar-con" style="width:0%;background:#00d4ff;"></div></div>
          <div class="metric-val" id="val-con" style="color:#00d4ff;">--%</div>
        </div>
        <div class="metric" style="margin-bottom:0;">
          <div class="metric-lbl">FLUSH DENSITY</div>
          <div class="bar-wrap"><div class="bar-fill" id="bar-fls" style="width:0%;background:#a855f7;"></div></div>
          <div class="metric-val" id="val-fls" style="color:#a855f7;">--%</div>
        </div>
      </div>
    </div>
    <div style="background:rgba(0,0,0,.3);border:1px solid rgba(0,180,255,.12);border-radius:3px;padding:7px;flex-shrink:0;">
      <div class="sec" style="border:none;padding:0;margin-bottom:5px;">▐ RANGE ADVANTAGE <span style="font-size:6px;">(BTN vs BB)</span></div>
      <div class="range-grid">
        <div>
          <div class="range-name" style="color:#ff3b3b;">BTN</div>
          <div class="bar-wrap"><div class="bar-fill" id="bar-btn" style="width:0%;background:#ff3b3b;"></div></div>
          <div class="range-val" id="val-btn" style="color:#ff3b3b;">--%</div>
        </div>
        <div>
          <div class="range-name" style="color:#3b82f6;">BB</div>
          <div class="bar-wrap"><div class="bar-fill" id="bar-bb" style="width:0%;background:#3b82f6;"></div></div>
          <div class="range-val" id="val-bb" style="color:#60a5fa;">--%</div>
        </div>
      </div>
      <canvas id="sparkline" width="200" height="32" style="width:100%;margin-top:5px;opacity:.7;"></canvas>
    </div>
    <div class="sec">▐ DYNAMIC HEATMAP</div>
    <div id="hm-wrap">
      <div id="hm-grid"></div>
      <div id="hm-spin">CALCULATING...</div>
    </div>
  </div>

</div><!-- /main -->

<div id="ftr">
  <span class="analyzing">● ENGINE WORKER ACTIVE</span>
  <span id="ftr-hash">HASH: N/A</span>
  <span id="calc-time" style="color:rgba(0,212,255,.5);">CALC: --ms</span>
  <span>SPECTRA POKER SYSTEM v3.0</span>
</div>

</div><!-- /root -->

<script>
/* ═══════════════════════════════════════════════════
   SPECTRA v3.0 — メインスクリプト
   Pyodide完全削除 / spectra-worker.js 完全移行
   currentBoard = 唯一の真実
═══════════════════════════════════════════════════ */

const RANKS_LIST  = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'];
const SUITS_LIST  = ['s','h','d','c'];
const SUIT_SYM    = {s:'♠',h:'♥',d:'♦',c:'♣'};
const SUIT_COLORS = {s:'#222',h:'#d00020',d:'#0055cc',c:'#007a2a'};
const STREET_COL  = {PREFLOP:'#00d4ff',FLOP:'#00ff9d',TURN:'#ffb800',RIVER:'#ff3b3b'};
const HAND_TYPES  = {1:'STRAIGHT FLUSH',2:'FOUR OF KIND',3:'FULL HOUSE',4:'FLUSH',5:'STRAIGHT',6:'THREE OF KIND',7:'TWO PAIR',8:'ONE PAIR',9:'HIGH CARD'};

/* ═══════════════════════════════════════════════════
   STATE — currentBoard が唯一の真実
═══════════════════════════════════════════════════ */
let currentBoard = [];   // e.g. ['As','Kh','Qs','Td','9c']
let currentMode  = 'MANUAL';
let camStream    = null;
let calcTimer    = null;
let msgId        = 0;
const pendingMsg = new Map(); // id → resolve

/* ═══════════════════════════════════════════════════
   WORKER INIT
═══════════════════════════════════════════════════ */
let worker = null;

function initWorker() {
  try {
    worker = new Worker('spectra-worker.js');

    worker.onmessage = (e) => {
      const { id, type, data, cached, calcTime } = e.data;

      // pending promise を解決
      if (id !== undefined && pendingMsg.has(id)) {
        pendingMsg.get(id)(e.data);
        pendingMsg.delete(id);
        return;
      }

      // HELLOで起動完了
      if (type === 'HELLO') {
        document.getElementById('brain-prog').style.width = '100%';
        document.getElementById('brain-msg').textContent = 'ENGINE WORKER ONLINE';
        document.getElementById('brain-badge').textContent  = 'BRAIN:READY';
        document.getElementById('brain-badge').style.color  = '#00ff9d';
        document.getElementById('brain-badge').style.borderColor = 'rgba(0,255,157,.4)';
        setTimeout(() => document.getElementById('brain-overlay').classList.add('hidden'), 500);
      }
    };

    worker.onerror = (e) => {
      console.error('[Worker Error]', e);
      document.getElementById('brain-msg').textContent = 'WORKER ERROR: ' + e.message;
      document.getElementById('brain-badge').textContent = 'BRAIN:ERR';
      document.getElementById('brain-badge').style.color = '#ff3b3b';
    };

    // INIT
    worker.postMessage({ type: 'INIT' });

  } catch(e) {
    // Workerが使えない環境（file://など）へのフォールバック
    document.getElementById('brain-msg').textContent = 'WORKER UNAVAILABLE — CHECK SERVER';
    document.getElementById('brain-badge').textContent = 'BRAIN:ERR';
    document.getElementById('brain-badge').style.color = '#ff3b3b';
    console.error('[SPECTRA] Worker init failed:', e);
  }
}

/* Worker にメッセージを送り、Promiseで結果を受け取る */
function workerRequest(type, payload) {
  return new Promise((resolve, reject) => {
    if (!worker) { reject(new Error('Worker not ready')); return; }
    const id = ++msgId;
    pendingMsg.set(id, resolve);
    worker.postMessage({ id, type, payload });
    // タイムアウト10秒
    setTimeout(() => {
      if (pendingMsg.has(id)) {
        pendingMsg.delete(id);
        reject(new Error('Worker timeout'));
      }
    }, 10000);
  });
}

/* ═══════════════════════════════════════════════════
   updateBoard — currentBoardを更新し全UIを同期
   どこから呼ばれても必ずここを通す
═══════════════════════════════════════════════════ */
function updateBoard(newBoard) {
  currentBoard = newBoard.filter(Boolean);
  renderStreet(currentBoard);
  updateBoardCards();
  renderAnalytics(currentBoard);
  updateDuplicateGuard();

  const hash = currentBoard.length ? currentBoard.join(' ').toUpperCase() : '--';
  document.getElementById('board-hash').textContent = 'BOARD: ' + hash;
  document.getElementById('ftr-hash').textContent   = 'HASH: ' + hash;

  if (currentBoard.length >= 3) {
    setStabState('LOCKED');
    clearTimeout(calcTimer);
    calcTimer = setTimeout(recalculate, 300);
  } else {
    resetBrainUI();
    setStabState('MANUAL');
  }
}

/* ═══════════════════════════════════════════════════
   recalculate — Worker に計算を依頼
═══════════════════════════════════════════════════ */
async function recalculate() {
  if (!worker || currentBoard.length < 3) return;

  setStabState('CALC');
  document.getElementById('hm-spin').classList.add('active');

  const t0 = performance.now();
  try {
    const res = await workerRequest('EVAL_169', { board: currentBoard });
    const ms = Math.round(performance.now() - t0);
    const suffix = res.cached ? ' (cached)' : '';
    document.getElementById('calc-time').textContent = `CALC: ${ms}ms${suffix}`;

    if (res.data && res.data.length) {
      renderHeatmap(res.data);
      renderNuts(res.data);
    }
    setStabState('DONE');
  } catch(e) {
    console.error('[SPECTRA] recalculate failed:', e);
    setStabState('ERR');
  }
  document.getElementById('hm-spin').classList.remove('active');
}

/* ═══════════════════════════════════════════════════
   MODE
═══════════════════════════════════════════════════ */
function setMode(mode) {
  currentMode = mode;
  document.getElementById('btn-manual').classList.toggle('active', mode === 'MANUAL');
  document.getElementById('btn-camera').classList.toggle('active', mode === 'CAMERA');
  const lbl = document.getElementById('cam-lbl-txt');

  if (mode === 'MANUAL') {
    document.getElementById('board-area').classList.remove('cam-mode');
    lbl.innerHTML = '▐ MANUAL BOARD INPUT <span>[SIMULATOR MODE]</span>';
    stopCamera();
    document.getElementById('cam-placeholder').style.display = 'flex';
    document.getElementById('cam-video').style.display = 'none';
    setStabState('MANUAL');
  } else {
    document.getElementById('board-area').classList.add('cam-mode');
    lbl.innerHTML = '▐ LIVE CAMERA FEED <span>[OVERHEAD MAT]</span>';
    startCamera();
    setStabState('CAM');
  }
}

async function startCamera() {
  try {
    camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    const v = document.getElementById('cam-video');
    v.srcObject = camStream;
    v.style.display = 'block';
    document.getElementById('cam-placeholder').style.display = 'none';
  } catch(e) {
    setStabState('CAM_ERR');
  }
}

function stopCamera() {
  if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
}

/* ═══════════════════════════════════════════════════
   TEXTURE (JS側で計算 — 軽量なのでWorker不要)
═══════════════════════════════════════════════════ */
function calcTexture(board) {
  if (board.length < 3) return null;
  const ranks = board.map(c => 'AKQJT98765432'.indexOf(c[0]));
  const suits  = board.map(c => c[1]);
  const sorted = [...ranks].sort((a, b) => a - b);
  let gaps = 0;
  for (let i = 1; i < sorted.length; i++) gaps += sorted[i] - sorted[i - 1];
  const connect = Math.max(0, Math.round(100 - gaps * 8));
  const suitCounts = {};
  suits.forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);
  const maxSuit = Math.max(...Object.values(suitCounts));
  const flush = Math.round(maxSuit / board.length * 100);
  const wet   = Math.round((connect + flush) / 2);
  const lbl   = wet >= 80 ? 'VERY WET / 非常に危険'
              : wet >= 60 ? 'WET / 危険'
              : wet >= 40 ? 'SEMI-WET / やや危険'
              : wet >= 20 ? 'DRY / 安全' : 'VERY DRY / 非常に安全';
  return { wet, connect, flush, lbl };
}

/* ═══════════════════════════════════════════════════
   RENDERERS
═══════════════════════════════════════════════════ */
function strengthColor(v) {
  if (v >= 80) return '#b91c1c';
  if (v >= 60) return '#c2410c';
  if (v >= 40) return '#ca8a04';
  if (v >= 20) return '#15803d';
  if (v >   0) return '#0e7490';
  return '#0d1a2a';
}

function buildHeatmap() {
  const grid = document.getElementById('hm-grid');
  grid.innerHTML = '';
  // corner
  const corner = document.createElement('div');
  corner.className = 'hm-hdr';
  grid.appendChild(corner);
  // headers
  RANKS_LIST.forEach(r => {
    const h = document.createElement('div');
    h.className = 'hm-hdr';
    h.textContent = r;
    grid.appendChild(h);
  });
  // cells
  RANKS_LIST.forEach((r1, i) => {
    const rh = document.createElement('div');
    rh.className = 'hm-hdr';
    rh.textContent = r1;
    grid.appendChild(rh);
    RANKS_LIST.forEach((r2, j) => {
      const lbl = i === j ? r1 + r2 : (i < j ? r1 + r2 + 's' : r2 + r1 + 'o');
      const c = document.createElement('div');
      c.className = 'hm-c';
      c.id = 'hc' + (i * 13 + j);
      c.title = lbl;
      c.textContent = lbl.slice(0, 2);
      c.style.backgroundColor = '#0d1a2a';
      grid.appendChild(c);
    });
  });
}

function renderHeatmap(data) {
  data.forEach((item, idx) => {
    const c = document.getElementById('hc' + idx);
    if (c) c.style.backgroundColor = strengthColor(item.equity ?? item.pct ?? 0);
  });
}

function renderNuts(data) {
  // equity or pct どちらでも対応
  const sorted = [...data].sort((a, b) => (b.equity ?? b.pct ?? 0) - (a.equity ?? a.pct ?? 0));
  const top    = sorted.slice(0, 7);
  document.getElementById('nuts-list').innerHTML = top.map((item, i) => {
    const val = (item.equity ?? item.pct ?? 0).toFixed(1);
    const rc  = item.rc ?? 9;
    return `<div class="nuts-row">
      <div class="n-rank">${i + 1}</div>
      <div class="n-eq">${val}%</div>
      <div class="n-hand">${item.hand}</div>
      <div class="n-type">${HAND_TYPES[rc] || ''}</div>
    </div>`;
  }).join('');
}

function renderAnalytics(board) {
  const tex = calcTexture(board);
  if (!tex) {
    document.getElementById('wet-val').textContent = '--%';
    document.getElementById('wet-lbl').textContent = 'ANALYZING';
    ['bar-con','bar-fls','bar-btn','bar-bb'].forEach(id => document.getElementById(id).style.width = '0%');
    ['val-con','val-fls','val-btn','val-bb'].forEach(id => document.getElementById(id).textContent = '--%');
    document.getElementById('prog-bar').style.width = '0%';
    return;
  }
  document.getElementById('wet-val').textContent = tex.wet + '%';
  document.getElementById('wet-lbl').textContent = tex.lbl;
  document.getElementById('bar-con').style.width = tex.connect + '%';
  document.getElementById('val-con').textContent = tex.connect + '%';
  document.getElementById('bar-fls').style.width = tex.flush + '%';
  document.getElementById('val-fls').textContent = tex.flush + '%';
  const btn = Math.round(50 + tex.wet * .12);
  const bb  = 100 - btn;
  document.getElementById('bar-btn').style.width = btn + '%';
  document.getElementById('val-btn').textContent = btn + '%';
  document.getElementById('bar-bb').style.width  = bb  + '%';
  document.getElementById('val-bb').textContent  = bb  + '%';
  document.getElementById('prog-bar').style.width = (board.length / 5 * 100) + '%';
  drawSparkline(btn, bb);
}

function renderStreet(board) {
  const count  = board.length;
  const street = count < 3 ? 'PREFLOP' : count === 3 ? 'FLOP' : count === 4 ? 'TURN' : 'RIVER';
  const sn = document.getElementById('street-name');
  sn.textContent   = street;
  sn.style.color      = STREET_COL[street];
  sn.style.textShadow = `0 0 20px ${STREET_COL[street]}`;
  document.getElementById('street-cnt').textContent = count + ' / 5';
}

function resetBrainUI() {
  for (let i = 0; i < 169; i++) {
    const c = document.getElementById('hc' + i);
    if (c) c.style.backgroundColor = '#0d1a2a';
  }
  document.getElementById('nuts-list').innerHTML =
    '<div style="font-family:\'Share Tech Mono\',monospace;font-size:9px;color:rgba(160,200,230,.3);padding:10px 4px;line-height:1.6;">ボードを3枚以上<br>入力するとNUTS<br>が表示されます</div>';
  document.getElementById('calc-time').textContent = 'CALC: --ms';
}

/* ═══════════════════════════════════════════════════
   BOARD AREA
═══════════════════════════════════════════════════ */
const BG_CLS      = { s:'bg-s', h:'bg-h', d:'bg-d', c:'bg-c' };
const SUIT_GLOW   = { s:'rgba(180,180,220,.35)', h:'rgba(220,30,60,.35)', d:'rgba(30,80,220,.35)', c:'rgba(30,160,60,.35)' };
const SUIT_BORDER = { s:'rgba(160,160,210,.7)', h:'rgba(220,30,60,.8)', d:'rgba(30,80,220,.8)', c:'rgba(30,160,60,.8)' };

function clearSlot(i) {
  const r = document.getElementById('rsel-' + i);
  const s = document.getElementById('ssel-' + i);
  if (r) r.value = '';
  if (s) {
    s.value = '';
    s.style.color       = 'rgba(160,200,230,.5)';
    s.style.boxShadow   = '0 0 6px rgba(0,140,255,.15)';
    s.style.borderColor = 'rgba(0,180,255,.35)';
    s.style.background  = '#0c1828';
  }
  document.getElementById('clr-' + i)?.classList.remove('has-card');
  onInputChanged();
}

let _clearTimer = null;
function clearAllStart() {
  const btn = document.getElementById('clear-all-btn');
  if (btn) { btn.style.background = 'rgba(255,59,59,.15)'; btn.textContent = 'HOLD...'; }
  _clearTimer = setTimeout(() => {
    clearBoard();
    if (btn) { btn.textContent = '✕ CLEAR ALL'; btn.style.background = 'rgba(255,59,59,.05)'; }
  }, 600);
}
function clearAllCancel() {
  clearTimeout(_clearTimer);
  const btn = document.getElementById('clear-all-btn');
  if (btn) { btn.style.background = 'rgba(255,59,59,.05)'; btn.textContent = '✕ CLEAR ALL'; }
}

function buildBoardArea() {
  const area = document.getElementById('board-area');
  area.innerHTML = '';

  // header row
  const hdr = document.createElement('div');
  hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;padding:0 2px;flex-shrink:0;';
  hdr.innerHTML = `
    <span style="font-family:'Share Tech Mono',monospace;font-size:8px;color:rgba(0,212,255,.35);letter-spacing:2px;">▐ BOARD CARDS</span>
    <button id="clear-all-btn"
      onmousedown="clearAllStart()" onmouseup="clearAllCancel()" onmouseleave="clearAllCancel()"
      ontouchstart="clearAllStart()" ontouchend="clearAllCancel()"
      style="font-family:'Orbitron',monospace;font-size:8px;letter-spacing:.8px;padding:3px 8px;
             border:1px solid rgba(255,59,59,.3);border-radius:2px;background:rgba(255,59,59,.05);
             color:rgba(255,100,100,.6);cursor:pointer;transition:all .15s;user-select:none;"
      onmouseover="this.style.borderColor='rgba(255,59,59,.6)';this.style.color='rgba(255,130,130,1)';"
      onmouseout="this.style.borderColor='rgba(255,59,59,.3)';this.style.color='rgba(255,100,100,.6)';">
      ✕ CLEAR ALL</button>`;
  area.appendChild(hdr);

  const slotsWrap = document.createElement('div');
  slotsWrap.style.cssText = 'display:flex;gap:6px;padding:0 2px;align-items:flex-start;';
  area.appendChild(slotsWrap);

  for (let i = 0; i < 5; i++) {
    const slot = document.createElement('div');
    slot.className = 'board-slot';
    slot.id = 'slot-' + i;
    slot.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;';

    // rank select
    const rSel = document.createElement('select');
    rSel.className = 'rank-sel';
    rSel.id = 'rsel-' + i;
    rSel.style.cssText = 'width:100%;background:#0c1828;border:1px solid rgba(0,180,255,.35);border-radius:3px;font-family:"Rajdhani",sans-serif;font-size:14px;font-weight:700;padding:3px 1px;cursor:pointer;outline:none;text-align:center;color:#e0f0ff;transition:border-color .2s,background .2s,box-shadow .2s;box-shadow:0 0 6px rgba(0,140,255,.15);';
    rSel.innerHTML = '<option value="">-</option>' + RANKS_LIST.map(r => `<option value="${r}">${r}</option>`).join('');

    // suit row
    const suitRow = document.createElement('div');
    suitRow.style.cssText = 'display:flex;gap:2px;width:100%;align-items:center;';

    const sSel = document.createElement('select');
    sSel.className = 'suit-sel';
    sSel.id = 'ssel-' + i;
    sSel.style.cssText = 'flex:1;min-width:0;background:#0c1828;border:1px solid rgba(0,180,255,.35);border-radius:3px;font-family:"Rajdhani",sans-serif;font-size:14px;font-weight:700;padding:3px 1px;cursor:pointer;outline:none;text-align:center;transition:border-color .2s,background .2s,box-shadow .2s;box-shadow:0 0 6px rgba(0,140,255,.15);';
    sSel.innerHTML = '<option value="">-</option>' + SUITS_LIST.map(s => `<option value="${s}" style="color:${SUIT_COLORS[s]}">${SUIT_SYM[s]}</option>`).join('');

    const clrBtn = document.createElement('button');
    clrBtn.id = 'clr-' + i;
    clrBtn.className = 'slot-clr';
    clrBtn.title = 'このカードを消す';
    clrBtn.textContent = '✕';
    clrBtn.style.cssText = 'flex-shrink:0;width:20px;height:20px;padding:0;border:1px solid rgba(255,59,59,.3);border-radius:2px;background:rgba(255,59,59,.06);color:rgba(255,100,100,.55);font-size:10px;cursor:pointer;line-height:1;transition:all .15s;';
    clrBtn.onmouseover = () => { clrBtn.style.background = 'rgba(255,59,59,.28)'; clrBtn.style.color = '#ff9090'; clrBtn.style.borderColor = 'rgba(255,59,59,.7)'; };
    clrBtn.onmouseout  = () => { clrBtn.style.background = 'rgba(255,59,59,.06)'; clrBtn.style.color = 'rgba(255,100,100,.55)'; clrBtn.style.borderColor = 'rgba(255,59,59,.3)'; };
    clrBtn.onclick = () => clearSlot(i);

    const updateSuitColor = () => {
      const v = sSel.value;
      sSel.style.color       = SUIT_COLORS[v] || 'rgba(160,200,230,.5)';
      sSel.style.boxShadow   = v ? `0 0 10px ${SUIT_GLOW[v]}`  : '0 0 6px rgba(0,140,255,.15)';
      sSel.style.borderColor = v ? SUIT_BORDER[v] : 'rgba(0,180,255,.35)';
      sSel.style.background  = v ? 'rgba(0,0,0,.6)' : '#0c1828';
      clrBtn.classList.toggle('has-card', !!(rSel.value && v));
    };

    rSel.addEventListener('change', () => { updateSuitColor(); onInputChanged(); });
    sSel.addEventListener('change', () => { updateSuitColor(); onInputChanged(); });
    updateSuitColor();

    suitRow.appendChild(sSel);
    suitRow.appendChild(clrBtn);

    const card = document.createElement('div');
    card.className = 'board-card waiting';
    card.id = 'bcard-' + i;
    card.innerHTML = `<div class="wait-txt">CARD ${i + 1}</div>`;

    slot.appendChild(rSel);
    slot.appendChild(suitRow);
    slot.appendChild(card);
    slotsWrap.appendChild(slot);
  }
}

function updateBoardCards() {
  for (let i = 0; i < 5; i++) {
    const rVal = document.getElementById('rsel-' + i)?.value || '';
    const sVal = document.getElementById('ssel-' + i)?.value || '';
    const card = document.getElementById('bcard-' + i);
    const clrBtn = document.getElementById('clr-' + i);
    if (!card) continue;
    if (rVal && sVal) {
      const rank = rVal.toUpperCase(), suit = sVal;
      const sym  = SUIT_SYM[suit] || '';
      card.className = 'board-card active';
      card.innerHTML = `<div class="card-inner ${BG_CLS[suit] || ''}">
        <span class="card-suit-bg sym-${suit}">${sym}</span>
        <span class="card-rank-center">${rank}</span>
        <div class="card-corner-tl"><span class="corner-rank">${rank}</span><span class="corner-suit">${sym}</span></div>
        <div class="card-corner-br"><span class="corner-rank">${rank}</span><span class="corner-suit">${sym}</span></div>
      </div>`;
      clrBtn?.classList.add('has-card');
    } else {
      card.className = 'board-card waiting';
      card.innerHTML = `<div class="wait-txt">CARD ${i + 1}</div>`;
      clrBtn?.classList.remove('has-card');
    }
  }
}

/* ═══════════════════════════════════════════════════
   重複防止ガード
═══════════════════════════════════════════════════ */
function updateDuplicateGuard() {
  const selected = new Set();
  for (let i = 0; i < 5; i++) {
    const r = document.getElementById('rsel-' + i)?.value;
    const s = document.getElementById('ssel-' + i)?.value;
    if (r && s) selected.add(r + s);
  }
  for (let i = 0; i < 5; i++) {
    const r = document.getElementById('rsel-' + i);
    const s = document.getElementById('ssel-' + i);
    if (!r || !s) continue;
    const myVal = (r.value && s.value) ? r.value + s.value : '';
    Array.from(s.options).forEach(opt => {
      if (!opt.value) return;
      const card = r.value + opt.value;
      opt.disabled = selected.has(card) && card !== myVal;
    });
    Array.from(r.options).forEach(opt => {
      if (!opt.value) return;
      const card = opt.value + s.value;
      opt.disabled = s.value && selected.has(card) && card !== myVal;
    });
  }
}

/* ═══════════════════════════════════════════════════
   INPUT CHANGE → updateBoard へ渡す
═══════════════════════════════════════════════════ */
function onInputChanged() {
  if (currentMode !== 'MANUAL') return;
  const newBoard = [];
  for (let i = 0; i < 5; i++) {
    const r = document.getElementById('rsel-' + i)?.value;
    const s = document.getElementById('ssel-' + i)?.value;
    if (r && s) newBoard.push(r + s);
  }
  updateBoard(newBoard);
}

/* ═══════════════════════════════════════════════════
   CLEAR
═══════════════════════════════════════════════════ */
function clearBoard() {
  for (let i = 0; i < 5; i++) {
    const r = document.getElementById('rsel-' + i);
    const s = document.getElementById('ssel-' + i);
    if (r) r.value = '';
    if (s) { s.value = ''; s.style.color = 'rgba(160,200,230,.5)'; }
  }
  updateBoard([]);
}

/* ═══════════════════════════════════════════════════
   STABILIZER
═══════════════════════════════════════════════════ */
function setStabState(state) {
  const dot = document.getElementById('stab-dot');
  const txt = document.getElementById('stab-txt');
  const conf = document.getElementById('stab-conf');
  const map = {
    MANUAL:  { c:'rgba(0,180,255,.4)', t:'rgba(0,180,255,.6)', msg:'MANUAL INPUT MODE — SELECT CARDS ABOVE', conf:'CONF: --' },
    LOCKED:  { c:'#00ff9d',  t:'#00ff9d',  msg:'BOARD LOCKED — ENGINE CALCULATING',  conf:'CONF: ...' },
    CALC:    { c:'#ffb800',  t:'#ffb800',  msg:'EVALUATING 169 HANDS — WORKER ACTIVE', conf:'CONF: ...' },
    DONE:    { c:'#00ff9d',  t:'#00ff9d',  msg:'CALCULATION COMPLETE — HEATMAP UPDATED', conf:'CONF: 1.00' },
    ERR:     { c:'#ff3b3b',  t:'#ff3b3b',  msg:'ENGINE ERROR — CHECK CONSOLE', conf:'CONF: --' },
    CAM:     { c:'#00d4ff',  t:'#00d4ff',  msg:'CAMERA MODE — LIVE FEED ACTIVE', conf:'CONF: LIVE' },
    CAM_ERR: { c:'#ff3b3b',  t:'#ff3b3b',  msg:'CAMERA ERROR — CHECK PERMISSIONS', conf:'CONF: --' },
  };
  const s = map[state] || map.MANUAL;
  dot.style.background = s.c;
  dot.style.boxShadow  = `0 0 8px ${s.c}`;
  txt.style.color      = s.t;
  txt.textContent      = s.msg;
  conf.textContent     = s.conf;
}

/* ═══════════════════════════════════════════════════
   SPARKLINE
═══════════════════════════════════════════════════ */
function drawSparkline(btn, bb) {
  const cv  = document.getElementById('sparkline');
  const ctx = cv.getContext('2d');
  const W   = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const line = (pts, col) => {
    ctx.beginPath(); ctx.strokeStyle = col; ctx.lineWidth = 1.5;
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();
  };
  const pts1 = [], pts2 = [];
  for (let x = 0; x <= W; x += 4) {
    const t = x / W;
    pts1.push({ x, y: H / 2 - (btn / 100 - .5) * H * .6 + Math.sin(t * Math.PI * 4) * 3 });
    pts2.push({ x, y: H / 2 - (bb  / 100 - .5) * H * .6 + Math.sin(t * Math.PI * 4 + 2) * 3 });
  }
  line(pts1, '#ff3b3b');
  line(pts2, '#3b82f6');
}

/* ═══════════════════════════════════════════════════
   CLOCK
═══════════════════════════════════════════════════ */
setInterval(() => {
  const n = new Date();
  document.getElementById('time-d').textContent =
    String(n.getHours()).padStart(2,'0') + ':' +
    String(n.getMinutes()).padStart(2,'0') + ':' +
    String(n.getSeconds()).padStart(2,'0');
  document.getElementById('fps-d').textContent = 'FPS: ' + (28 + Math.floor(Math.random() * 4));
}, 1000);

/* ═══════════════════════════════════════════════════
   MOBILE TABS
═══════════════════════════════════════════════════ */
function mobTab(tab) {
  const pnlMap = { board: 'center-pnl', nuts: 'mob-pnl-nuts', stats: 'mob-pnl-stats' };
  const btnMap = { board: 'mtab-board', nuts: 'mtab-nuts',  stats: 'mtab-stats' };
  Object.entries(pnlMap).forEach(([k, id]) => {
    document.getElementById(id)?.classList.toggle('mob-active', k === tab);
  });
  Object.entries(btnMap).forEach(([k, id]) => {
    document.getElementById(id)?.classList.toggle('active', k === tab);
  });
}

window.addEventListener('resize', () => {
  if (window.innerWidth > 768) {
    ['center-pnl','mob-pnl-nuts','mob-pnl-stats'].forEach(id => {
      document.getElementById(id)?.classList.remove('mob-active');
    });
  }
});

/* ═══════════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════════ */
buildHeatmap();
buildBoardArea();
setStabState('MANUAL');
renderStreet([]);
drawSparkline(50, 50);
initWorker();
</script>
</body>
</html>
