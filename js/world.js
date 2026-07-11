// =============================================================
// world.js - オープンワールド地形(解析的生成)・港/基地配置・
//            破壊可能オブジェクト(チャンク決定論生成)・ミニマップ
// =============================================================
'use strict';

const World = (() => {

  // 疑似ノイズ(角度ベースの海岸線ゆらぎ)
  function wob(a, s){
    return Math.sin(a*3 + s) * 0.5 + Math.sin(a*7 + s*2.3) * 0.3 + Math.sin(a*13 + s*4.1) * 0.2;
  }
  function edgeR(cont, angle){
    return cont.r * (1 + 0.13 * wob(angle, cont.seed));
  }

  // その座標を含む大陸を返す(なければ null)
  function landAt(x, y){
    for (const c of DATA.CONTINENTS) {
      const dx = x - c.x, dy = y - c.y;
      const d = Math.hypot(dx, dy);
      if (d > c.r * 1.2) continue;
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
    // 深海判定: どの大陸の縁からも遠い
    let minGap = 1e9;
    for (const c of DATA.CONTINENTS) {
      const d = Math.hypot(x - c.x, y - c.y) - c.r;
      if (d < minGap) minGap = d;
    }
    return minGap > 700 ? 'deep' : 'sea';
  }

  // ---- 港の座標を計算(始まりの大陸の海岸、angle方向) ----
  const main = DATA.CONTINENTS[0];
  const ports = DATA.PORTS.map(p => {
    const e = edgeR(main, p.angle);
    return {
      ...p,
      x: main.x + Math.cos(p.angle) * (e - 50),   // 陸側ドック
      y: main.y + Math.sin(p.angle) * (e - 50),
      seaX: main.x + Math.cos(p.angle) * (e + 90), // 出航ポイント(海側)
      seaY: main.y + Math.sin(p.angle) * (e + 90),
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

  // 周回中に壊されたオブジェクト(周回リセット)
  let destroyed = new Set();
  function resetRun(){ destroyed = new Set(); }

  // 指定チャンクのオブジェクト一覧を得る
  function chunkObjects(cx, cy){
    const list = [];
    const n = Math.floor(hash(cx, cy, 1) * 4); // 0-3個
    for (let i = 0; i < n; i++) {
      const key = cx + ',' + cy + ',' + i;
      if (destroyed.has(key)) continue;
      const x = (cx + hash(cx, cy, 10 + i)) * CHUNK;
      const y = (cy + hash(cx, cy, 20 + i)) * CHUNK;
      const t = terrainAt(x, y);
      const roll = hash(cx, cy, 30 + i);
      let type = null;
      if (t === 'grass') type = roll < 0.5 ? 'tree' : (roll < 0.8 ? 'rock' : 'crate');
      else if (t === 'sand') type = roll < 0.5 ? 'rock' : 'crate';
      else if (t === 'sea') type = roll < 0.6 ? 'coral' : 'wreck';
      else if (t === 'deep') { if (roll < 0.3) type = 'wreck'; }
      if (!type) continue;
      // 拠点・港のそばには置かない
      let near = false;
      for (const p of ports) if (Math.hypot(x - p.x, y - p.y) < 140) { near = true; break; }
      if (!near) for (const b of bases) if (Math.hypot(x - b.x, y - b.y) < 160) { near = true; break; }
      if (near) continue;
      list.push({ key, x, y, type,
        hp: type === 'rock' ? 30 : (type === 'wreck' ? 40 : 18),
        maxHp: type === 'rock' ? 30 : (type === 'wreck' ? 40 : 18),
        sprite: { tree:'ob_tree', rock:'ob_rock', crate:'ob_crate', wreck:'ob_wreck', coral:'ob_coral' }[type],
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
      return objCache.list.filter(o => !destroyed.has(o.key));
    }
    const list = [];
    for (let ix = cx - rng; ix <= cx + rng; ix++)
      for (let iy = cy - rng; iy <= cy + rng; iy++)
        list.push(...chunkObjects(ix, iy));
    objCache = { cx, cy, list };
    return list;
  }
  function destroyObject(key){ destroyed.add(key); objCache.cx = 1e9; }

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
    }
    return out;
  }

  // ---- ミニマップ(低解像度プリレンダ) ----
  const MM_SIZE = 180, MM_EXTENT = 8600;
  let mmCanvas = null;
  function minimap(){
    if (mmCanvas) return mmCanvas;
    mmCanvas = document.createElement('canvas');
    mmCanvas.width = MM_SIZE; mmCanvas.height = MM_SIZE;
    const g = mmCanvas.getContext('2d');
    const img = g.createImageData(MM_SIZE, MM_SIZE);
    for (let py = 0; py < MM_SIZE; py++){
      for (let px = 0; px < MM_SIZE; px++){
        const wx = (px / MM_SIZE * 2 - 1) * MM_EXTENT;
        const wy = (py / MM_SIZE * 2 - 1) * MM_EXTENT;
        const t = terrainAt(wx, wy);
        const i = (py * MM_SIZE + px) * 4;
        let c;
        if (t === 'grass') c = [46, 100, 60];
        else if (t === 'sand') c = [160, 140, 90];
        else if (t === 'sea') c = [22, 50, 92];
        else c = [12, 28, 58];
        img.data[i] = c[0]; img.data[i+1] = c[1]; img.data[i+2] = c[2]; img.data[i+3] = 230;
      }
    }
    g.putImageData(img, 0, 0);
    return mmCanvas;
  }
  function worldToMM(x, y){
    return { x: (x / MM_EXTENT + 1) / 2 * MM_SIZE, y: (y / MM_EXTENT + 1) / 2 * MM_SIZE };
  }

  // 距離リング(敵の強さ)
  function ringOf(x, y){ return Math.floor(Math.hypot(x, y) / DATA.DIST_RING); }

  return { isLand, landAt, terrainAt, ports, bases, resetRun,
           nearbyObjects, destroyObject, objectDrops,
           minimap, worldToMM, MM_SIZE, ringOf, edgeR, CHUNK };
})();
