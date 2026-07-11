// =============================================================
// world.js - オープンワールド地形(解析的生成)・港/基地配置・
//            破壊可能オブジェクト(チャンク決定論生成)・ミニマップ
// =============================================================
'use strict';

const World = (() => {

  // 疑似ノイズ(角度ベースの海岸線ゆらぎ)。lobesで岬の数、ampで凹凸の激しさが変わる
  function wob(a, s, lobes){
    return Math.sin(a * (lobes || 3) + s) * 0.5 + Math.sin(a * 7 + s * 2.3) * 0.3 + Math.sin(a * 13 + s * 4.1) * 0.2;
  }
  function edgeR(cont, angle){
    return cont.r * (1 + (cont.amp || 0.13) * wob(angle, cont.seed, cont.lobes));
  }

  // その座標を含む大陸を返す(なければ null)。sx/syの伸縮で多様な形になる
  function landAt(x, y){
    for (const c of DATA.CONTINENTS) {
      const dx = (x - c.x) / (c.sx || 1), dy = (y - c.y) / (c.sy || 1);
      const d = Math.hypot(dx, dy);
      if (d > c.r * 1.55) continue;
      const e = edgeR(c, Math.atan2(dy, dx));
      if (d < e) return { cont: c, d, edge: e };
    }
    return null;
  }
  function isLand(x, y){ return landAt(x, y) !== null; }

  // 'grass' | 'sand' | 'sea' | 'deep'
  function terrainAt(x, y){
    const L = landAt(x, y);
    if (L) return (L.d > L.edge - 90) ? 'sand' : 'grass';
    let minGap = 1e9;
    for (const c of DATA.CONTINENTS) {
      const d = Math.hypot(x - c.x, y - c.y) - c.r * Math.max(c.sx || 1, c.sy || 1);
      if (d < minGap) minGap = d;
    }
    return minGap > 2200 ? 'deep' : 'sea';
  }

  // タイル情報: 地形タイプ + バイオーム(描画用)
  function tileAt(x, y){
    const L = landAt(x, y);
    if (L) return { t: (L.d > L.edge - 90) ? 'sand' : 'grass', biome: L.cont.biome || 'grass' };
    let minGap = 1e9;
    for (const c of DATA.CONTINENTS) {
      const d = Math.hypot(x - c.x, y - c.y) - c.r * Math.max(c.sx || 1, c.sy || 1);
      if (d < minGap) minGap = d;
    }
    return { t: minGap > 2200 ? 'deep' : 'sea', biome: 'grass' };
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
  const MM_EXTENT = DATA.WORLD_EXTENT;    // 世界の半径
  const WM_RES = 1536;                    // 全世界画像の解像度
  const LOCAL_EXTENT = 22000;             // ローカルモードの表示半径
  let wmCanvas = null;

  // 全世界画像(1024x1024、1px≈168ユニット)。起動時に一度だけ生成
  function worldImage(){
    if (wmCanvas) return wmCanvas;
    wmCanvas = document.createElement('canvas');
    wmCanvas.width = WM_RES; wmCanvas.height = WM_RES;
    const g = wmCanvas.getContext('2d');
    const img = g.createImageData(WM_RES, WM_RES);
    for (let py = 0; py < WM_RES; py++){
      for (let px = 0; px < WM_RES; px++){
        const wx = (px / WM_RES * 2 - 1) * MM_EXTENT;
        const wy = (py / WM_RES * 2 - 1) * MM_EXTENT;
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

  // ミニマップ描画情報: mode 'local'(周辺13,000) / 'world'(全体)
  // 戻り値: {img, sx, sy, sw} = worldImage内の切り抜き範囲、toMM(wx,wy)=表示座標変換
  function minimapView(cx, cy, mode){
    const img = worldImage();
    if (mode === 'world') {
      return {
        img, sx: 0, sy: 0, sw: WM_RES,
        toMM(x, y){ return { x: (x / MM_EXTENT + 1) / 2 * MM_SIZE, y: (y / MM_EXTENT + 1) / 2 * MM_SIZE }; },
        inView(){ return true; },
      };
    }
    const scale = WM_RES / (MM_EXTENT * 2);           // world→画像px
    const sw = LOCAL_EXTENT * 2 * scale;
    const sx = Math.max(0, Math.min(WM_RES - sw, (cx + MM_EXTENT) * scale - sw / 2));
    const sy = Math.max(0, Math.min(WM_RES - sw, (cy + MM_EXTENT) * scale - sw / 2));
    return {
      img, sx, sy, sw,
      toMM(x, y){
        return { x: ((x + MM_EXTENT) * scale - sx) / sw * MM_SIZE,
                 y: ((y + MM_EXTENT) * scale - sy) / sw * MM_SIZE };
      },
      inView(x, y){
        return Math.abs(x - cx) < LOCAL_EXTENT * 1.05 && Math.abs(y - cy) < LOCAL_EXTENT * 1.05;
      },
    };
  }

  // ---- 探索記録(霧マップ) ----
  const EX_CELL = 4200;
  let exSet = new Set(), fogCv = null, fogG = null;
  function initExplored(arr){ exSet = new Set(arr || []); fogCv = null; }
  function punch(k){
    const parts = k.split(',');
    const scale = WM_RES / (MM_EXTENT * 2);
    const x = (parts[0] * EX_CELL + MM_EXTENT) * scale;
    const y = (parts[1] * EX_CELL + MM_EXTENT) * scale;
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

  // 距離リング(敵の強さ)
  function ringOf(x, y){ return Math.floor(Math.hypot(x, y) / DATA.DIST_RING); }

  return { isLand, landAt, terrainAt, tileAt, ports, bases, resetRun, tick, setObjHp,
           nearbyObjects, destroyObject, objectDrops,
           worldImage, minimapView, MM_SIZE, ringOf, edgeR, CHUNK,
           initExplored, recordExplore, exploredArray, fogCanvas };
})();
