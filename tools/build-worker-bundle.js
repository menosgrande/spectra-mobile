#!/usr/bin/env node
/**
 * SPECTRA — Worker Bundle Builder（v3.9.45で新規追加、v3.9.46でcanonical source確定、
 * v3.9.57でmain-thread注入を追加）
 *
 * Canonical source architecture（v3.9.46で確定）：
 *   core/*.js（9ファイル）と spectra-worker.js が canonical source。
 *   index.html の <script type="text/plain" id="spectra-worker-src"> は
 *   このスクリプトの出力で完全に置き換えられる「生成物」であり、以後は
 *   手編集しない。spectra-worker.js自体はimportScripts()でcore/*.jsを
 *   直接読み込むだけの薄いエントリーポイントなので、生成の必要はなく
 *   canonical sourceの一部としてそのまま手編集する。
 *
 *   v3.9.46で、当時「本番Blob bundle」にしか存在しなかった5件の実質差分
 *   （position.jsのUTG1/UTG2/LJ欠落、strength.jsの係数0.03/0.10、
 *   range_matrix.jsのペア+backdoor FD対応欠落、interpretations.jsの
 *   FIVE_FLUSH見落とし、board_intelligence.jsのboard引数欠落）を
 *   全てcore側へ反映し、本番Blobとcore/*.jsを完全一致させた上でこの
 *   canonical化を行った（全ファイルの機械的な差分棚卸しにより、逆方向
 *   ＝core側にしかない実質差分は0件だったことを確認済み）。
 *
 *   v3.9.57（④-3、UI構造整理）で2つ目の生成先を追加：core/nuts_display.js
 *   （renderNuts()の純粋計算部分をcanonical化したもの）は、他のcore/*.jsと
 *   違ってWorkerではなくメインスレッド（UIスレッド）からしか呼ばれない
 *   （renderNuts()自体がメインスレッド関数のため）。WorkerとUIスレッドは
 *   グローバルスコープを共有しないので、Workerバンドルへ含めても意味が無く、
 *   index.html側のメインスレッド用<script>ブロックに直接注入する必要がある。
 *   ここは「汎用的な複数ファイル注入の仕組み」は作らず、core/nuts_display.js
 *   1ファイル専用の単純な文字列置換として実装している（過剰な一般化を避ける
 *   というユーザー方針）。将来同種のファイルが増えた場合に初めて一般化を検討する。
 *
 * 目的：
 *   index.html の <script type="text/plain" id="spectra-worker-src"> は
 *   file:// でもクロスオリジン制限を受けずWorkerを起動するための、
 *   spectra-worker.js + core/*.js の「手作業コピペによる結合済みバンドル」
 *   だった。手作業ゆえに何度も同期漏れが発生した実績がある
 *   （v3.9.40: categoryBreakdown/comboSuits、v3.9.43: computeHeroRank、
 *   v3.9.46: 上記5件）。このスクリプトは spectra-worker.js の
 *   importScripts() 宣言を「正」として、そこから機械的にバンドルを
 *   再生成する。手で編集するのは常に spectra-worker.js / core/*.js の
 *   side だけにし、index.html 側のバンドルは常にこのスクリプトの出力で
 *   上書きする運用に一本化する。
 *
 * 使い方：
 *   node tools/build-worker-bundle.js          → index.html を書き換える
 *   node tools/build-worker-bundle.js --check  → 差分があれば非ゼロ終了
 *                                                 （CI/テストからの利用を想定。
 *                                                 index.htmlは変更しない）
 *
 * 前提（崩れたらこのスクリプト自体の要修正）：
 *   - spectra-worker.js 冒頭に importScripts(...); が1回だけ存在し、
 *     引数は './core/xxx.js' 形式の文字列リテラルの配列であること
 *   - index.html に <script type="text/plain" id="spectra-worker-src"> が
 *     ちょうど1箇所存在すること
 *   - index.html に /* AUTO-GENERATED-START: core/nuts_display.js *\/ ...
 *     /* AUTO-GENERATED-END: core/nuts_display.js *\/ のマーカー対が
 *     ちょうど1箇所存在すること（メインスレッド注入先）
 */

const fs = require('fs');
const path = require('path');

const ROOT           = path.join(__dirname, '..');
const WORKER_FILE     = path.join(ROOT, 'spectra-worker.js');
const INDEX_FILE       = path.join(ROOT, 'index.html');
const MARKER_ID         = 'spectra-worker-src';
const NUTS_DISPLAY_FILE = path.join(ROOT, 'core', 'nuts_display.js');
const NUTS_START_MARKER = '/* AUTO-GENERATED-START: core/nuts_display.js */';
const NUTS_END_MARKER   = '/* AUTO-GENERATED-END: core/nuts_display.js */';

function readFile(p) {
  return fs.readFileSync(p, 'utf8');
}

// spectra-worker.js から importScripts(...) の中身（core/*.js の相対パス配列）を
// 抽出する。マッチしなければ「前提が崩れている」ことなので例外を投げて止める。
function extractImportedCoreFiles(workerSrc) {
  const m = workerSrc.match(/importScripts\(([\s\S]*?)\);/);
  if (!m) {
    throw new Error('spectra-worker.js に importScripts(...) が見つかりません。前提が崩れています。');
  }
  const files = [...m[1].matchAll(/['"]\.\/(core\/[^'"]+\.js)['"]/g)].map(x => x[1]);
  if (files.length === 0) {
    throw new Error('importScripts(...) の中身から core/*.js のパスを1件も抽出できませんでした。');
  }
  return { files, fullMatch: m[0] };
}

// 各core/*.jsファイルを、実際のindex.htmlバンドルと同じ区切りコメント形式で連結する。
function buildCoreSection(files) {
  let out = '';
  for (const relPath of files) {
    const content = readFile(path.join(ROOT, relPath)).replace(/\s+$/, '');
    out += `/* --- ${relPath} --- */\n\n${content}\n\n\n`;
  }
  return out;
}

// spectra-worker.js本体からimportScripts(...)宣言だけを取り除いたものを返す。
function buildWorkerSection(workerSrc, importStatement) {
  let rest = workerSrc.replace(importStatement, '/* importScripts stripped for bundled worker */\n');
  rest = rest.replace(/\s+$/, '');
  return `/* --- spectra-worker.js --- */\n\n${rest}\n`;
}

function buildBundle() {
  const workerSrc = readFile(WORKER_FILE);
  const { files, fullMatch } = extractImportedCoreFiles(workerSrc);
  const coreSection   = buildCoreSection(files);
  const workerSection = buildWorkerSection(workerSrc, fullMatch);
  return `/* SPECTRA WORKER BUNDLE AUTO-GENERATED */\n\n${coreSection}${workerSection}\n`;
}

// マーカー対の間の中身を置き換える汎用ヘルパー（core/nuts_display.js専用の
// 呼び出しにのみ使う。複数ファイルを扱う一般化された仕組みではない）。
function findMarkerRange(html, startMarker, endMarker, label) {
  const openIdx = html.indexOf(startMarker);
  if (openIdx === -1) {
    console.error(`index.html に ${label} の開始マーカーが見つかりません。`);
    process.exit(2);
  }
  const contentStart = openIdx + startMarker.length;
  const closeIdx = html.indexOf(endMarker, contentStart);
  if (closeIdx === -1) {
    console.error(`index.html に ${label} の終了マーカーが見つかりません。`);
    process.exit(2);
  }
  return { contentStart, closeIdx };
}

function main() {
  const check = process.argv.includes('--check');
  const bundle = buildBundle();
  const nutsDisplaySrc = readFile(NUTS_DISPLAY_FILE).replace(/\s+$/, '');

  let html = readFile(INDEX_FILE);

  // ── ターゲット1: Worker bundle（<script type="text/plain">）──
  const openTag  = `<script type="text/plain" id="${MARKER_ID}">`;
  const closeTag = '</script>';
  const openIdx  = html.indexOf(openTag);
  if (openIdx === -1) {
    console.error(`index.html に ${openTag} が見つかりません。`);
    process.exit(2);
  }
  const wContentStart = openIdx + openTag.length;
  const wCloseIdx = html.indexOf(closeTag, wContentStart);
  if (wCloseIdx === -1) {
    console.error('対応する </script> が見つかりません。');
    process.exit(2);
  }
  const currentWorkerBundle = html.slice(wContentStart + 1, wCloseIdx); // +1: 開始タグ直後の改行をスキップ

  // ── ターゲット2: main-thread注入（core/nuts_display.js）──
  const { contentStart: nContentStart, closeIdx: nCloseIdx } =
    findMarkerRange(html, NUTS_START_MARKER, NUTS_END_MARKER, 'core/nuts_display.js');
  const currentNutsInjection = html.slice(nContentStart, nCloseIdx);
  const newNutsInjection = `\n${nutsDisplaySrc}\n`;

  const workerMismatch = currentWorkerBundle !== bundle;
  const nutsMismatch   = currentNutsInjection !== newNutsInjection;

  if (check) {
    if (!workerMismatch && !nutsMismatch) {
      console.log('OK: index.html の Worker バンドルは spectra-worker.js / core/*.js と同期しています。');
      process.exit(0);
    }
    console.error('NG: index.html が spectra-worker.js / core/*.js とズレています。');
    console.error('    `node tools/build-worker-bundle.js` を実行して再生成してください。');
    const reportDiff = (label, a, b) => {
      const aLines = a.split('\n'), bLines = b.split('\n');
      const n = Math.max(aLines.length, bLines.length);
      for (let i = 0; i < n; i++) {
        if (aLines[i] !== bLines[i]) {
          console.error(`  [${label}] 最初の食い違い（行 ${i + 1}）:`);
          console.error(`    現在の index.html: ${JSON.stringify(aLines[i])}`);
          console.error(`    再生成した内容    : ${JSON.stringify(bLines[i])}`);
          break;
        }
      }
    };
    if (workerMismatch) reportDiff('Worker bundle', currentWorkerBundle, bundle);
    if (nutsMismatch)   reportDiff('main-thread注入 (core/nuts_display.js)', currentNutsInjection, newNutsInjection);
    process.exit(1);
  } else {
    if (!workerMismatch && !nutsMismatch) {
      console.log('変更なし（既に同期済み）。');
      return;
    }
    // 後ろ側（nuts_display注入）から書き換えるとWorker bundle側のオフセットに
    // 影響しないため、この順で文字列を組み立てる。
    let newHtml = html;
    if (nutsMismatch) {
      newHtml = newHtml.slice(0, nContentStart) + newNutsInjection + newHtml.slice(nCloseIdx);
    }
    if (workerMismatch) {
      // nuts注入で長さが変わっている可能性があるため、Worker bundle側の
      // 位置はnewHtmlに対して取り直す。
      const oi = newHtml.indexOf(openTag);
      const cs = oi + openTag.length;
      const ci = newHtml.indexOf(closeTag, cs);
      newHtml = newHtml.slice(0, cs) + '\n' + bundle + newHtml.slice(ci);
    }
    fs.writeFileSync(INDEX_FILE, newHtml, 'utf8');
    console.log('index.html を再生成しました（Worker バンドル' + (nutsMismatch ? ' + main-thread注入' : '') + '）。');
  }
}

main();
