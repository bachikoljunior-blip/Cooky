// =============================================================
// world.js - オープンワールド地形(解析的生成)・港/基地配置・
//            破壊可能オブジェクト(チャンク決定論生成)・ミニマップ
// =============================================================
'use strict';

const World = (() => {

  // 疑似ノイズ(角度ベースの海岸線ゆらぎ)。lobesで岬の数、ampで凹凸の激しさが変わる。
  // 実際の大陸のように、大きなうねりの上に細かいギザギザ(フラクタルな海岸線)を重ねる
  function wob(a, s, lobes){
    return Math.sin(a * (lobes || 3) + s) * 0.5 + Math.sin(a * 7 + s * 2.3) * 0.3
         + Math.sin(a * 13 + s * 4.1) * 0.2
         + Math.sin(a * 19 + s * 1.7) * 0.13 + Math.sin(a * 29 + s * 3.3) * 0.08;
  }
  function edgeR(cont, angle){
    let r = cont.r * (1 + (cont.amp || 0.13) * wob(angle, cont.seed, cont.lobes));
    // 質量の偏り(taper): 実際の大陸のように、片側が広く反対側へ細く伸びる
    if (cont.taper) r *= 1 + cont.taper.d * Math.cos(angle - cont.taper.a);
    // 大陸ごとの個性: coast=[{a:方角, w:幅rad, d:深さ}] 負dで湾(入り江)、正dで岬(半島)
    if (cont.coast) for (const f of cont.coast) {
      let da = angle - f.a;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      r *= 1 + f.d * Math.exp(-(da * da) / (2 * f.w * f.w));
    }
    return r;
  }

  // その座標を含む大陸を返す(なければ null)。sx/syの伸縮とrotの回転で多様な形になる
  function landAt(x, y){
    for (const c of DATA.CONTINENTS) {
      let dx = x - c.x, dy = y - c.y;
      if (c.rot) {
        const co = Math.cos(-c.rot), si = Math.sin(-c.rot);
        const rx = dx * co - dy * si, ry = dx * si + dy * co;
        dx = rx; dy = ry;
      }
      dx /= (c.sx || 1); dy /= (c.sy || 1);
      const d = Math.hypot(dx, dy);
      if (d > c.r * 2.1) continue;
      const e = edgeR(c, Math.atan2(dy, dx));
      if (d < e) return { cont: c, d, edge: e };
    }
    return null;
  }
  function isLand(x, y){ return landAt(x, y) !== null; }

  // 海の種別: 浅瀬(sea)は円ではなく実際の海岸線に沿った帯にする
  function seaKind(x, y){
    let gap = 1e9;
    for (const c of DATA.CONTINENTS) {
      let dx = x - c.x, dy = y - c.y;
      if (c.rot) {
        const co = Math.cos(-c.rot), si = Math.sin(-c.rot);
        const rx = dx * co - dy * si, ry = dx * si + dy * co;
        dx = rx; dy = ry;
      }
      dx /= (c.sx || 1); dy /= (c.sy || 1);
      const d = Math.hypot(dx, dy);
      if (d > c.r * 2.6) continue;
      const e = edgeR(c, Math.atan2(dy, dx));
      const g = (d - e) * Math.min(c.sx || 1, c.sy || 1);
      if (g < gap) gap = g;
    }
    return gap > 2600 ? 'deep' : 'sea';
  }

  // 'grass' | 'sand' | 'sea' | 'deep'
  function terrainAt(x, y){
    const L = landAt(x, y);
    if (L) return (L.d > L.edge - 90) ? 'sand' : 'grass';
    return seaKind(x, y);
  }

  // ---- バイオドーム: 約1分歩くごと(≈2600px)に別のバイオドームへ入る ----
  // 広い領域ごとに見た目のバイオームと敵の顔ぶれ(BIOME_FAUNA)が変わる。素材の違いは
  // 敵ごとのドロップテーブルから自然に生まれる(場所によるドロップ率の細工はしない)。
  // 境界は画一的な直線ではなく、座標をノイズでゆがめて自然な曲線にする(ドメインワープ)。
  const BIODOME_W = 2600;
  // 穏やか→過酷の順に並べたバイオーム。隣り合うバイオドームはこの並びで近いものになり、
  // 一つ跨ぐごとに段階を踏んで少しずつ変わる(たまに急激に変わる場所もある)。
  const BIO_ORDER = ['grass','jungle','mist','chalk','bones','desert','storm','frost',
                     'moon','twilight','obsidian','volcano','magma','makai','void','end'];
  // セルごとのバイオーム順インデックス: 低周波の滑らかなノイズ → 隣接セルは1段くらいしか違わない
  function biomeIndex(cx, cy){
    const f = 0.34;
    let v = Math.sin(cx * f + 1.7) + Math.sin(cy * f * 0.92 + 4.2)
          + 0.6 * Math.sin((cx + cy) * f * 0.5 + 2.1) + 0.4 * Math.sin((cx - cy) * f * 0.7 + 5.3);
    v = (v / 2.6 + 1) / 2;                       // ~[0,1] に正規化
    v = Math.max(0, Math.min(0.999, v));
    return Math.floor(v * BIO_ORDER.length);
  }
  // ジッタード・ボロノイのセル判定(ワープ済み座標で最も近い中心の領域に属させる)
  function domeCellAt(x, y){
    const W = BIODOME_W;
    // ドメインワープ(多重・非整数周期): 格子の規則性を崩して境界をうねらせる
    const wx = x + (Math.sin(y / (W * 0.63) + 1.3) + 0.45 * Math.sin(y / (W * 0.27) + 4.1)
                  + 0.3 * Math.sin(y / (W * 1.7) + 2.9)) * 0.28 * W;
    const wy = y + (Math.sin(x / (W * 0.58) + 2.7) + 0.45 * Math.sin(x / (W * 0.31) + 0.7)
                  + 0.3 * Math.sin(x / (W * 1.9) + 5.5)) * 0.28 * W;
    // 四つ角が集まる格子頂点が消え、3方向で交わる自然な多角形の境界になる。
    const gx = Math.floor(wx / W), gy = Math.floor(wy / W);
    let bestD = 1e18, bcx = gx, bcy = gy;
    for (let iy = gy - 1; iy <= gy + 1; iy++) {
      for (let ix = gx - 1; ix <= gx + 1; ix++) {
        const jx = (hash(ix, iy, 3) - 0.5) * 0.92;   // 中心を ±0.46 セルずらす
        const jy = (hash(ix, iy, 7) - 0.5) * 0.92;
        const ccx = (ix + 0.5 + jx) * W, ccy = (iy + 0.5 + jy) * W;
        const dx = wx - ccx, dy = wy - ccy, d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; bcx = ix; bcy = iy; }
      }
    }
    // スタート地点(原点)そのものを追加のシードにする ― 初期バイオドームは
    // スポーンを中心とした一領域になり、境界(≈半セル)まで十分な距離がある
    if (originSeed) {
      const dx = wx - originSeed.x, dy = wy - originSeed.y;
      if (dx * dx + dy * dy < bestD) return { cx: ORIGIN_CX, cy: ORIGIN_CY };
    }
    return { cx: bcx, cy: bcy };
  }
  const ORIGIN_CX = -1e9, ORIGIN_CY = -1e9;   // 原点シード領域のセルID(番兵)
  let originSeed = null;
  function initOriginSeed(){
    // 原点のワープ後座標(domeCellAtと同じ式)をシード位置にする
    const W = BIODOME_W;
    originSeed = {
      x: (Math.sin(1.3) + 0.45 * Math.sin(4.1) + 0.3 * Math.sin(2.9)) * 0.28 * W,
      y: (Math.sin(2.7) + 0.45 * Math.sin(0.7) + 0.3 * Math.sin(5.5)) * 0.28 * W,
    };
  }
  function biodomeAt(x, y){
    if (!originSeed) initOriginSeed();
    const c = domeCellAt(x, y);
    // 初期(原点シード)のバイオドームは必ず草原
    const biome = c.cx === ORIGIN_CX ? 'grass' : BIO_ORDER[biomeIndex(c.cx, c.cy)];
    return { biome, cx: c.cx, cy: c.cy };
  }

  // タイル情報: 地形タイプ + バイオーム(描画用)。バイオームはバイオドームで決まる
  function tileAt(x, y){
    const L = landAt(x, y);
    if (L) return { t: (L.d > L.edge - 90) ? 'sand' : 'grass', biome: biodomeAt(x, y).biome };
    return { t: seaKind(x, y), biome: 'grass' };
  }

  // ---- 港の座標を計算(始まりの大陸の海岸、angle方向) ----
  const main = DATA.CONTINENTS[0];
  const ports = DATA.PORTS.map(p => {
    const e = edgeR(main, p.angle);
    const sx = main.sx || 1, sy = main.sy || 1;
    return {
      ...p,
      x: main.x + Math.cos(p.angle) * (e - 60) * sx,   // 陸側ドック
      y: main.y + Math.sin(p.angle) * (e - 60) * sy,
      seaX: main.x + Math.cos(p.angle) * (e + 110) * sx, // 出航ポイント(海側)
      seaY: main.y + Math.sin(p.angle) * (e + 110) * sy,
    };
  });

  const bases = DATA.BASES.slice(); // {id,name,x,y,cont}

  // ---- チャンク決定論オブジェクト生成 ----
  const CHUNK = 320;
  function hash(cx, cy, k){
    let h = (cx * 374761393 + cy * 668265263 + k * 1274126177) | 0;
    h = (h ^ (h >>> 13)) * 1103515245 | 0;
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 4294967296;
  }

  // 周回中のオブジェクト状態: ダメージは保持(勝手に回復しない)、
  // 破壊後は一定時間でリスポーンする
  let destroyed = new Map();   // key -> 破壊時刻
  let objHp = new Map();       // key -> 残りHP
  let clock = 0;
  const RESPAWN_SEC = 90;
  function resetRun(){ destroyed = new Map(); objHp = new Map(); clock = 0; }
  function tick(dt){ clock += dt; }
  function setObjHp(key, hp){ objHp.set(key, hp); }
  function isDestroyed(key){
    const t = destroyed.get(key);
    if (t === undefined) return false;
    if (clock - t >= RESPAWN_SEC) { destroyed.delete(key); objHp.delete(key); return false; }
    return true;
  }

  // 指定チャンクのオブジェクト一覧を得る
  function chunkObjects(cx, cy){
    const list = [];
    const n = Math.floor(hash(cx, cy, 1) * 4); // 0-3個
    for (let i = 0; i < n; i++) {
      const key = cx + ',' + cy + ',' + i;
      if (isDestroyed(key)) continue;
      const x = (cx + hash(cx, cy, 10 + i)) * CHUNK;
      const y = (cy + hash(cx, cy, 20 + i)) * CHUNK;
      const t = terrainAt(x, y);
      const roll = hash(cx, cy, 30 + i);
      const rareRoll = hash(cx, cy, 70 + i);
      let type = null, rare = false;
      if (t === 'grass') type = roll < 0.5 ? 'tree' : (roll < 0.8 ? 'rock' : 'crate');
      else if (t === 'sand') type = roll < 0.5 ? 'rock' : 'crate';
      else if (t === 'sea') type = roll < 0.6 ? 'coral' : 'wreck';
      else if (t === 'deep') { if (roll < 0.3) type = 'wreck'; }
      // レアオブジェクト: 琥珀の古木(陸) / 真珠貝(海) ― 専用素材の唯一の入手源
      if (rareRoll < 0.022) {
        if (t === 'grass') { type = 'goldtree'; rare = true; }
        else if (t === 'sea' || t === 'deep') { type = 'pearlshell'; rare = true; }
      }
      if (!type) continue;
      // 拠点・港のそばには置かない
      let near = false;
      for (const p of ports) if (Math.hypot(x - p.x, y - p.y) < 140) { near = true; break; }
      if (!near) for (const b of bases) if (Math.hypot(x - b.x, y - b.y) < 160) { near = true; break; }
      if (near) continue;
      const ohp = rare ? 70 : (type === 'rock' ? 30 : (type === 'wreck' ? 40 : 18));
      const curHp = objHp.has(key) ? objHp.get(key) : ohp;   // 削ったHPは回復しない
      list.push({ key, x, y, type, rare,
        hp: curHp, maxHp: ohp,
        sprite: { tree:'ob_tree', rock:'ob_rock', crate:'ob_crate', wreck:'ob_wreck', coral:'ob_coral',
                  goldtree:'ob_goldtree', pearlshell:'ob_pearl' }[type],
        r: 16 });
    }
    return list;
  }

  // プレイヤー周辺のオブジェクトを列挙(キャッシュ付き)
  let objCache = { cx:1e9, cy:1e9, list:[] };
  function nearbyObjects(px, py, radius){
    const cx = Math.floor(px / CHUNK), cy = Math.floor(py / CHUNK);
    const rng = Math.ceil(radius / CHUNK);
    if (objCache.cx === cx && objCache.cy === cy) {
      return objCache.list.filter(o => !isDestroyed(o.key));
    }
    const list = [];
    for (let ix = cx - rng; ix <= cx + rng; ix++)
      for (let iy = cy - rng; iy <= cy + rng; iy++)
        list.push(...chunkObjects(ix, iy));
    objCache = { cx, cy, list };
    return list;
  }
  function destroyObject(key){ destroyed.set(key, clock); objHp.delete(key); objCache.cx = 1e9; }

  // オブジェクトのドロップテーブル
  function objectDrops(type, matUnlocked){
    const out = [];
    const push = (m, c) => { if (matUnlocked(m) && Math.random() < c) out.push(m); };
    switch(type){
      case 'tree':  push('wood', 0.9); push('jelly', 0.15); break;
      case 'rock':  push('scrap', 0.6); push('crystal', 0.35); push('magic', 0.12); break;
      case 'crate': push('wood', 0.5); push('scrap', 0.4); push('hide', 0.3); push('crystal', 0.2); push('magic', 0.1); break;
      case 'coral': push('shell', 0.8); push('coral', 0.4); break;
      case 'wreck': push('wood', 0.8); push('scrap', 0.5); push('shell', 0.4); push('coral', 0.25); push('star', 0.08); break;
      case 'goldtree':  push('amber', 1.0); push('amber', 0.5); push('wood', 0.9); break;
      case 'pearlshell': push('pearl', 1.0); push('pearl', 0.5); push('shell', 0.9); break;
    }
    return out;
  }

  // ---- ミニマップ(全世界を一度だけプリレンダし、切り抜いて使う) ----
  const MM_SIZE = 180;                    // 画面上の表示サイズ
  const WM_RES = 1536;                    // 全世界画像の解像度
  const LOCAL_EXTENT = 22000;             // ローカルモードの表示半径
  let wmCanvas = null;

  // 世界の描画範囲: 陸地の実際の広がりから求める(始まりの大陸は世界の中心ではない)
  let WB = null;
  function bounds(){
    if (WB) return WB;
    let x0 = 1e18, y0 = 1e18, x1 = -1e18, y1 = -1e18;
    for (const c of DATA.CONTINENTS) {
      const m = c.r * (1 + (c.amp || 0.13) * 1.3 + 0.35) * Math.max(c.sx || 1, c.sy || 1);
      x0 = Math.min(x0, c.x - m); x1 = Math.max(x1, c.x + m);
      y0 = Math.min(y0, c.y - m); y1 = Math.max(y1, c.y + m);
    }
    const pad = 25000;
    x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
    const side = Math.max(x1 - x0, y1 - y0);
    WB = { x0: (x0 + x1) / 2 - side / 2, y0: (y0 + y1) / 2 - side / 2, w: side };
    return WB;
  }

  // 全世界画像。起動時に一度だけ生成(範囲は陸地のバウンディングボックス)
  function worldImage(){
    if (wmCanvas) return wmCanvas;
    const B = bounds();
    wmCanvas = document.createElement('canvas');
    wmCanvas.width = WM_RES; wmCanvas.height = WM_RES;
    const g = wmCanvas.getContext('2d');
    const img = g.createImageData(WM_RES, WM_RES);
    for (let py = 0; py < WM_RES; py++){
      for (let px = 0; px < WM_RES; px++){
        const wx = B.x0 + (px + 0.5) / WM_RES * B.w;
        const wy = B.y0 + (py + 0.5) / WM_RES * B.w;
        const ti = tileAt(wx, wy);
        const i = (py * WM_RES + px) * 4;
        let c;
        const bio = DATA.BIOMES[ti.biome] || DATA.BIOMES.grass;
        if (ti.t === 'grass') c = bio.mm;
        else if (ti.t === 'sand') c = [160, 140, 90];
        else if (ti.t === 'sea') c = [22, 50, 92];
        else c = [12, 28, 58];
        img.data[i] = c[0]; img.data[i+1] = c[1]; img.data[i+2] = c[2]; img.data[i+3] = 230;
      }
    }
    g.putImageData(img, 0, 0);
    return wmCanvas;
  }

  // ミニマップ描画情報: mode 'local'(周辺) / 'world'(全体)
  // 戻り値: {img, sx, sy, sw} = worldImage内の切り抜き範囲、toMM(wx,wy)=表示座標変換
  function minimapView(cx, cy, mode){
    const img = worldImage();
    const B = bounds();
    const scale = WM_RES / B.w;   // world→画像px
    if (mode === 'world') {
      // 全体図は「知っている世界」のバウンディングボックスに合わせてズーム
      // (序盤は初期の大陸が大きく映り、発見が広がるほど地図も広がる)
      let x0 = -34000, x1 = 34000, y0 = -34000, y1 = 34000;   // 始まりの大陸は常に収める
      const seen = SaveSys.data.seen || {};
      const consider = (x, y) => {
        x0 = Math.min(x0, x - 15000); x1 = Math.max(x1, x + 15000);
        y0 = Math.min(y0, y - 15000); y1 = Math.max(y1, y + 15000);
      };
      for (const b of bases) if (SaveSys.data.bases[b.id] || seen[b.id]) consider(b.x, b.y);
      for (const p of ports) if (SaveSys.data.ports[p.id] || seen[p.id]) consider(p.x, p.y);
      consider(cx, cy);
      // 次の拠点ヒントも必ず地図に収まるように
      const wh = SaveSys.data.nextHint && bases.find(b => b.id === SaveSys.data.nextHint);
      if (wh) consider(wh.x, wh.y);
      let side = Math.min(B.w, Math.max(x1 - x0, y1 - y0) * 1.08);
      let bx0 = (x0 + x1) / 2 - side / 2, by0 = (y0 + y1) / 2 - side / 2;
      bx0 = Math.max(B.x0, Math.min(B.x0 + B.w - side, bx0));
      by0 = Math.max(B.y0, Math.min(B.y0 + B.w - side, by0));
      return {
        img, sx: (bx0 - B.x0) * scale, sy: (by0 - B.y0) * scale, sw: side * scale,
        toMM(x, y){ return { x: (x - bx0) / side * MM_SIZE, y: (y - by0) / side * MM_SIZE }; },
        inView(x, y){ return x > bx0 && x < bx0 + side && y > by0 && y < by0 + side; },
      };
    }
    // 周辺図: プレイヤー中心。次の拠点ヒントがあれば、それが必ず収まるまで範囲を広げる
    let ext = LOCAL_EXTENT;
    const lh = SaveSys.data.nextHint && bases.find(b => b.id === SaveSys.data.nextHint);
    if (lh) ext = Math.max(ext, Math.hypot(lh.x - cx, lh.y - cy) * 1.15);
    ext = Math.min(ext, B.w / 2);
    const sw = Math.min(WM_RES, ext * 2 * scale);
    const sx = Math.max(0, Math.min(WM_RES - sw, (cx - B.x0) * scale - sw / 2));
    const sy = Math.max(0, Math.min(WM_RES - sw, (cy - B.y0) * scale - sw / 2));
    return {
      img, sx, sy, sw,
      toMM(x, y){
        return { x: ((x - B.x0) * scale - sx) / sw * MM_SIZE,
                 y: ((y - B.y0) * scale - sy) / sw * MM_SIZE };
      },
      inView(x, y){
        return Math.abs(x - cx) < ext * 1.2 && Math.abs(y - cy) < ext * 1.2;
      },
    };
  }

  // ---- 探索記録(霧マップ) ----
  const EX_CELL = 4200;
  let exSet = new Set(), fogCv = null, fogG = null;
  function initExplored(arr){ exSet = new Set(arr || []); fogCv = null; }
  function punch(k){
    const parts = k.split(',');
    const B = bounds();
    const scale = WM_RES / B.w;
    const x = (parts[0] * EX_CELL - B.x0) * scale;
    const y = (parts[1] * EX_CELL - B.y0) * scale;
    const w = EX_CELL * scale;
    fogG.clearRect(x - 0.5, y - 0.5, w + 1, w + 1);
  }
  function fogCanvas(){
    if (fogCv) return fogCv;
    fogCv = document.createElement('canvas');
    fogCv.width = WM_RES; fogCv.height = WM_RES;
    fogG = fogCv.getContext('2d');
    fogG.fillStyle = 'rgba(5,9,18,0.93)';
    fogG.fillRect(0, 0, WM_RES, WM_RES);
    for (const k of exSet) punch(k);
    return fogCv;
  }
  // 現在地周辺を「行ったことのある場所」として記録(radは地図学で拡大)
  function recordExplore(x, y, rad){
    const cx = Math.floor(x / EX_CELL), cy = Math.floor(y / EX_CELL);
    for (let ix = cx - rad; ix <= cx + rad; ix++) {
      for (let iy = cy - rad; iy <= cy + rad; iy++) {
        const k = ix + ',' + iy;
        if (!exSet.has(k)) {
          exSet.add(k);
          if (fogCv) punch(k);
        }
      }
    }
  }
  function exploredArray(){ return Array.from(exSet); }
  function isExplored(x, y){ return exSet.has(Math.floor(x / EX_CELL) + ',' + Math.floor(y / EX_CELL)); }

  // 距離リング(敵の強さ)
  function ringOf(x, y){ return Math.floor(Math.hypot(x, y) / DATA.DIST_RING); }

  return { isLand, landAt, terrainAt, tileAt, ports, bases, resetRun, tick, setObjHp,
           nearbyObjects, destroyObject, objectDrops,
           worldImage, minimapView, MM_SIZE, ringOf, edgeR, CHUNK, bounds,
           initExplored, recordExplore, exploredArray, fogCanvas, isExplored,
           biodomeAt };
})();
