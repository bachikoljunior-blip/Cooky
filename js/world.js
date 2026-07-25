// =============================================================
// world.js - オープンワールド地形(解析的生成)・港/基地配置・
//            破壊可能オブジェクト(チャンク決定論生成)・ミニマップ
// =============================================================
'use strict';

const World = (() => {

  // 疑似ノイズ(角度ベースの海岸線ゆらぎ)。lobesで岬の数、ampで凹凸の激しさが変わる。
  // 実際の大陸のように、全体の輪郭はなだらかに保ち、小さなスケールのギザギザだけを重ねる
  function wob(a, s, lobes){
    return Math.sin(a * (lobes || 3) + s) * 0.5 + Math.sin(a * 7 + s * 2.3) * 0.18
         + Math.sin(a * 13 + s * 4.1) * 0.1
         + Math.sin(a * 19 + s * 1.7) * 0.07 + Math.sin(a * 29 + s * 3.3) * 0.05;
  }
  // ---- 陸地 = 複数の「板」(parts)の合成 ----
  // 単一中心の放射形だと、どう歪めても「凸凹した円盤」にしかならない。
  // 実際の大陸のような弧・三日月・くびれ・半島は、ずらして重ねた複数の板の
  // 合成(union)から生まれる。parts の無い陸地は従来通り自身1枚の板として扱う。
  function partEdge(c, p, i, angle){
    const seed = (p.seed != null ? p.seed : c.seed + i * 7);
    let r = p.r * (1 + (p.amp != null ? p.amp : (c.amp || 0.13)) * wob(angle, seed, p.lobes || c.lobes));
    const tp = p.taper || (c.parts ? null : c.taper);
    if (tp) r *= 1 + tp.d * Math.cos(angle - tp.a);
    const coast = p.coast || (c.parts ? null : c.coast);
    if (coast) for (const f of coast) {
      let da = angle - f.a;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      r *= 1 + f.d * Math.exp(-(da * da) / (2 * f.w * f.w));
    }
    return r;
  }
  // 板1枚に対する「海岸からの符号つき距離」(負=陸の内側、正=海側。おおよそworld単位)
  function partGap(c, p, i, x, y){
    let dx = x - c.x - (p.dx || 0), dy = y - c.y - (p.dy || 0);
    const rot = (p.rot != null ? p.rot : (c.parts ? 0 : c.rot)) || 0;
    if (rot) {
      const co = Math.cos(-rot), si = Math.sin(-rot);
      const rx = dx * co - dy * si, ry = dx * si + dy * co;
      dx = rx; dy = ry;
    }
    const sx = (p.sx != null ? p.sx : (c.parts ? 1 : c.sx)) || 1;
    const sy = (p.sy != null ? p.sy : (c.parts ? 1 : c.sy)) || 1;
    dx /= sx; dy /= sy;
    const d = Math.hypot(dx, dy);
    const sMin = Math.min(sx, sy);
    if (d > p.r * 2.4) return (d - p.r) * sMin;   // 遠距離は近似で十分(三角関数を省く)
    return (d - partEdge(c, p, i, Math.atan2(dy, dx))) * sMin;
  }
  function partsOf(c){ return c.parts || [c]; }
  // 最寄りの海岸までの符号つき距離と、その陸地
  function coastGap(x, y){
    let best = 1e18, bc = null;
    for (const c of DATA.CONTINENTS) {
      const ps = partsOf(c);
      for (let i = 0; i < ps.length; i++) {
        const g = partGap(c, ps[i], i, x, y);
        if (g < best) { best = g; bc = c; }
      }
    }
    return { gap: best, cont: bc };
  }
  // 後方互換: 単一の板としての縁の半径(港の配置などに使用)
  function edgeR(cont, angle){ return partEdge(cont, cont, 0, angle); }

  // その座標を含む陸地を返す(なければ null)
  function landAt(x, y){
    const g = coastGap(x, y);
    return g.gap < 0 ? { cont: g.cont, gap: g.gap } : null;
  }
  function isLand(x, y){ return landAt(x, y) !== null; }

  // 'grass' | 'sand' | 'sea' | 'deep' ― 海岸からの距離だけで決まる
  // (砂浜=海岸から90以内の陸、浅瀬=海岸から2600以内の海)
  function terrainKind(gap){
    return gap < -90 ? 'grass' : gap < 0 ? 'sand' : gap < 2600 ? 'sea' : 'deep';
  }
  function terrainAt(x, y){
    return terrainKind(coastGap(x, y).gap);
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
    // バイオドームも一気に開かない: 始まりに近いほど「穏やかな並びの先頭」だけが使われ、
    // 遠くへ行くほど種類が増える(段階の導入。セルの形・条件は不変)
    const ring = Math.hypot(cx, cy) * BIODOME_W / DATA.DIST_RING;
    const avail = Math.min(BIO_ORDER.length, 4 + Math.max(0, Math.floor((ring - 4) / 3)) * 2);
    return Math.floor(v * avail);
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

  // 海域バイオーム: 海もバイオドームと同じセル割りで環境が変わる
  function seaBiomeAt(x, y){
    return (DATA.SEA_OF || {})[biodomeAt(x, y).biome] || 'open';
  }

  // タイル情報: 地形タイプ + バイオーム(描画用)。バイオームはバイオドームで決まる。
  // 水タイルには海域バイオーム(sea)が付く
  function tileAt(x, y){
    const t = terrainKind(coastGap(x, y).gap);
    if (t === 'grass' || t === 'sand') return { t, biome: biodomeAt(x, y).biome };
    return { t, biome: 'grass', sea: seaBiomeAt(x, y) };
  }

  // ---- 港の座標を計算 ----
  // 本土の港: 始まりの大陸の海岸、angle方向。
  // 遠隔の港(at持ち): 他大陸の岸辺の明示座標から、seaAngle方向へ歩いて出航点を求める
  const main = DATA.CONTINENTS[0];
  // 乗船地点: 出航点は海の上にあり、歩いて近づける限界は港ごとに違う。
  // 桟橋から海へ向かって歩き、陸で居られる最後の地点を「船に乗る場所」として持つ
  function shoreSpot(fx, fy, tx, ty){
    const dx = tx - fx, dy = ty - fy;
    const L = Math.hypot(dx, dy) || 1;
    let last = { x: fx, y: fy };
    for (let t = 0; t <= L; t += 6) {
      const x = fx + dx / L * t, y = fy + dy / L * t;
      if (!isLand(x, y)) break;
      last = { x, y };
    }
    return last;
  }
  const ports = DATA.PORTS.map(p => {
    let o;
    if (p.at) {
      // 遠隔の港: atは「その辺り」を指す目安なので、そこから海へ歩いて渚を求め、
      // 港町は本土の港と同じく渚の60px内陸に置く(内陸2kmの“港町”にしない)
      const ca = Math.cos(p.seaAngle), sa = Math.sin(p.seaAngle);
      let d = 0;
      while (d < 20000 && isLand(p.at.x + ca * d, p.at.y + sa * d)) d += 6;
      const shx = p.at.x + ca * (d - 6), shy = p.at.y + sa * (d - 6);
      o = { ...p, x: shx - ca * 60, y: shy - sa * 60,
            seaX: shx + ca * 110, seaY: shy + sa * 110 };
    } else {
      const e = edgeR(main, p.angle);
      const sx = main.sx || 1, sy = main.sy || 1;
      o = {
        ...p,
        x: main.x + Math.cos(p.angle) * (e - 60) * sx,   // 陸側ドック
        y: main.y + Math.sin(p.angle) * (e - 60) * sy,
        seaX: main.x + Math.cos(p.angle) * (e + 110) * sx, // 出航ポイント(海側)
        seaY: main.y + Math.sin(p.angle) * (e + 110) * sy,
      };
    }
    const sp = shoreSpot(o.x, o.y, o.seaX, o.seaY);
    o.boardX = sp.x; o.boardY = sp.y;
    return o;
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
  function resetRun(){
    destroyed = new Map(); objHp = new Map(); clock = 0;
    objCache.cx = 1e9;   // 前周回のオブジェクト状態(削りHP・破壊)をキャッシュに残さない
  }
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
      else if (t === 'sea') type = roll < 0.5 ? 'coral' : (roll < 0.8 ? 'wreck' : 'crate');   // 浅瀬には漂流する木箱も
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
      // 木は風土に合わせた見た目に(砂漠・火山・魔界などは枯れ木、氷原・月影は雪木)。
      // HP・ドロップは変えない ― 見た目のみ
      let spr = { tree:'ob_tree', rock:'ob_rock', crate:'ob_crate', wreck:'ob_wreck', coral:'ob_coral',
                  goldtree:'ob_goldtree', pearlshell:'ob_pearl' }[type];
      if (type === 'tree') {
        const bio = biodomeAt(x, y).biome;
        if (['desert', 'bones', 'volcano', 'magma', 'makai', 'void', 'end'].includes(bio)) spr = 'ob_tree_dry';
        else if (['frost', 'moon'].includes(bio)) spr = 'ob_tree_snow';
      }
      list.push({ key, x, y, type, rare,
        hp: curHp, maxHp: ohp,
        sprite: spr,
        r: 16 });
    }
    return list;
  }

  // ---- 地形の障害(岩場): 壊せない自然の岩。周回マップのところどころに自然に配置 ----
  // 基地・港・道・出発点のそばには置かない。決定論(チャンクのハッシュ)で常に同じ場所に出る
  function chunkCrags(cx, cy){
    const list = [];
    if (hash(cx, cy, 91) > 0.06) return list;   // 数チャンクに1群れ
    const bx = (cx + 0.5) * CHUNK, by = (cy + 0.5) * CHUNK;
    if (Math.hypot(bx, by) < 700) return list;
    for (const p of ports) if (Math.hypot(bx - p.x, by - p.y) < 460) return list;
    let nearBase = null;
    for (const b of bases) {
      const d = Math.hypot(bx - b.x, by - b.y);
      if (d < 460) return list;
      if (d < 5600) nearBase = b;
    }
    const rd = nearBase ? roadOf(nearBase.id) : null;
    // 見晴らし台・祠を岩や崖で埋めない(近傍9チャンクのランドマークを避ける)
    const lms = [];
    for (let iy = cy - 1; iy <= cy + 1; iy++)
      for (let ix = cx - 1; ix <= cx + 1; ix++) lms.push(...chunkLandmarks(ix, iy));
    const nearLm = (x, y, r) => lms.some(lm => Math.hypot(x - lm.x, y - lm.y) < r + 60);
    // 崖の尾根: 岩群のおよそ1/4は、一列に連なる段差(崖)になる。
    // 当たり判定は従来の円のまま(既存の回り込み・湧き規則がそのまま効く)
    if (hash(cx, cy, 105) < 0.25) {
      const ang = hash(cx, cy, 106) * Math.PI;
      const segs = 4 + Math.floor(hash(cx, cy, 107) * 3);   // 4〜6節
      const r = 24 + hash(cx, cy, 108) * 10;
      for (let i = 0; i < segs; i++) {
        const x = bx + Math.cos(ang) * (i - (segs - 1) / 2) * r * 1.5;
        const y = by + Math.sin(ang) * (i - (segs - 1) / 2) * r * 1.5;
        const t = terrainAt(x, y);
        if (t !== 'grass' && t !== 'sand') continue;
        if (rd && roadDist(rd, x, y) < 120) continue;
        if (nearLm(x, y, r)) continue;
        list.push({ x, y, r, cliff: true, ang });
      }
      return list;
    }
    const n = 1 + Math.floor(hash(cx, cy, 92) * 2.5);
    for (let i = 0; i < n; i++) {
      const x = bx + (hash(cx, cy, 93 + i) - 0.5) * CHUNK * 0.9;
      const y = by + (hash(cx, cy, 97 + i) - 0.5) * CHUNK * 0.9;
      const t = terrainAt(x, y);
      if (t !== 'grass' && t !== 'sand') continue;
      if (rd && roadDist(rd, x, y) < 120) continue;   // 基地の小道は塞がない
      const rr2 = 20 + hash(cx, cy, 101 + i) * 22;
      if (nearLm(x, y, rr2)) continue;
      list.push({ x, y, r: rr2 });
    }
    return list;
  }
  // ---- ランドマーク: 見晴らし台(高台の露岩)と古の祠 ----
  // 見晴らし台: 登ると周囲の地形が地図に刻まれる(探索の目印)。先人の手記が残されている
  // 古の祠: 祈ると一定時間の加護(周回ごとに一度)
  function chunkLandmarks(cx, cy){
    const list = [];
    const roll = hash(cx, cy, 111);
    if (roll > 0.0062) return list;
    const x = (cx + 0.35 + hash(cx, cy, 112) * 0.3) * CHUNK;
    const y = (cy + 0.35 + hash(cx, cy, 113) * 0.3) * CHUNK;
    if (terrainAt(x, y) !== 'grass') return list;
    if (Math.hypot(x, y) < 900) return list;
    for (const p of ports) if (Math.hypot(x - p.x, y - p.y) < 500) return list;
    for (const b of bases) if (Math.hypot(x - b.x, y - b.y) < 500) return list;
    list.push({ key: 'lm' + cx + ',' + cy, x, y, kind: roll < 0.0022 ? 'vantage' : 'shrine' });
    return list;
  }
  // 先人の遺物: 朽ちた野営跡・折れた剣の塚・風化した旗。
  // 先代の死に戻り(城主オウ)の旅路を、テキストではなく地形そのものが語る。
  // 装飾のみ(当たり判定・インタラクトなし)
  function chunkRelics(cx, cy){
    const list = [];
    const roll = hash(cx, cy, 131);
    if (roll > 0.004) return list;
    const x = (cx + 0.3 + hash(cx, cy, 132) * 0.4) * CHUNK;
    const y = (cy + 0.3 + hash(cx, cy, 133) * 0.4) * CHUNK;
    if (terrainAt(x, y) !== 'grass') return list;
    if (Math.hypot(x, y) < 900) return list;
    for (const p of ports) if (Math.hypot(x - p.x, y - p.y) < 400) return list;
    for (const b of bases) if (Math.hypot(x - b.x, y - b.y) < 400) return list;
    const kinds = ['camp', 'sword', 'banner'];
    list.push({ x, y, kind: kinds[Math.floor(hash(cx, cy, 134) * kinds.length)] });
    return list;
  }
  let relCache = { cx: 1e9, cy: 1e9, rng: 0, list: [] };
  function nearbyRelics(px, py, radius){
    const cx = Math.floor(px / CHUNK), cy = Math.floor(py / CHUNK);
    const rng = Math.ceil(radius / CHUNK);
    if (relCache.cx === cx && relCache.cy === cy && relCache.rng >= rng) return relCache.list;
    const list = [];
    for (let iy = cy - rng; iy <= cy + rng; iy++)
      for (let ix = cx - rng; ix <= cx + rng; ix++) list.push(...chunkRelics(ix, iy));
    relCache = { cx, cy, rng, list };
    return list;
  }

  let lmCache = { cx: 1e9, cy: 1e9, rng: 0, list: [] };
  function nearbyLandmarks(px, py, radius){
    const cx = Math.floor(px / CHUNK), cy = Math.floor(py / CHUNK);
    const rng = Math.ceil(radius / CHUNK);
    if (lmCache.cx === cx && lmCache.cy === cy && lmCache.rng >= rng) return lmCache.list;
    const list = [];
    for (let iy = cy - rng; iy <= cy + rng; iy++)
      for (let ix = cx - rng; ix <= cx + rng; ix++) list.push(...chunkLandmarks(ix, iy));
    lmCache = { cx, cy, rng, list };
    return list;
  }

  let cragCache = { cx: 1e9, cy: 1e9, rng: 0, list: [] };
  function nearbyCrags(px, py, radius){
    const cx = Math.floor(px / CHUNK), cy = Math.floor(py / CHUNK);
    const rng = Math.ceil(radius / CHUNK);
    if (cragCache.cx === cx && cragCache.cy === cy && cragCache.rng >= rng) return cragCache.list;
    const list = [];
    for (let iy = cy - rng; iy <= cy + rng; iy++)
      for (let ix = cx - rng; ix <= cx + rng; ix++) list.push(...chunkCrags(ix, iy));
    cragCache = { cx, cy, rng, list };
    return list;
  }

  // プレイヤー周辺のオブジェクトを列挙(キャッシュ付き)
  let objCache = { cx:1e9, cy:1e9, rng:0, list:[] };
  function nearbyObjects(px, py, radius){
    const cx = Math.floor(px / CHUNK), cy = Math.floor(py / CHUNK);
    const rng = Math.ceil(radius / CHUNK);
    if (objCache.cx === cx && objCache.cy === cy && objCache.rng >= rng) {
      // リスポーン時間が明けた破壊物があれば消化して、同チャンク内でも再生成する
      let expired = false;
      for (const [k, t] of destroyed) {
        if (clock - t >= RESPAWN_SEC) { destroyed.delete(k); objHp.delete(k); expired = true; }
      }
      if (!expired) return objCache.list.filter(o => !isDestroyed(o.key));
    }
    const list = [];
    for (let ix = cx - rng; ix <= cx + rng; ix++)
      for (let iy = cy - rng; iy <= cy + rng; iy++)
        list.push(...chunkObjects(ix, iy));
    objCache = { cx, cy, rng, list };
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
      for (const p of partsOf(c)) {
        const m = p.r * (1 + ((p.amp != null ? p.amp : c.amp) || 0.13) * 1.3 + 0.35) *
                  Math.max(p.sx || c.sx || 1, p.sy || c.sy || 1);
        x0 = Math.min(x0, c.x + (p.dx || 0) - m); x1 = Math.max(x1, c.x + (p.dx || 0) + m);
        y0 = Math.min(y0, c.y + (p.dy || 0) - m); y1 = Math.max(y1, c.y + (p.dy || 0) + m);
      }
    }
    const pad = 25000;
    x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
    const side = Math.max(x1 - x0, y1 - y0);
    WB = { x0: (x0 + x1) / 2 - side / 2, y0: (y0 + y1) / 2 - side / 2, w: side };
    return WB;
  }

  // 全世界画像。世界が広大なため一括生成すると数秒固まる。
  // 少しずつ(1回十数ms)描き足す分割生成にして、生成中も部分的な画像をそのまま使う。
  let wmRow = 0;
  function worldImage(){
    if (wmCanvas) return wmCanvas;
    const B = bounds();
    wmCanvas = document.createElement('canvas');
    wmCanvas.width = WM_RES; wmCanvas.height = WM_RES;
    const g = wmCanvas.getContext('2d');
    g.fillStyle = 'rgba(22,50,92,0.9)';          // 未生成の行はひとまず海の色
    g.fillRect(0, 0, WM_RES, WM_RES);
    // 始まりの大陸(y=0付近)に近い行から描く: 序盤のミニマップが真っ先に埋まる
    const rowOrder = Array.from({ length: WM_RES }, (_, i) => i)
      .sort((a, b) => Math.abs(B.y0 + (a + 0.5) / WM_RES * B.w) - Math.abs(B.y0 + (b + 0.5) / WM_RES * B.w));
    const step = () => {
      const t0 = performance.now();
      while (wmRow < WM_RES && performance.now() - t0 < 12) {
        const row = rowOrder[wmRow];
        const img = g.createImageData(WM_RES, 1);
        const wy = B.y0 + (row + 0.5) / WM_RES * B.w;
        for (let px = 0; px < WM_RES; px++){
          const wx = B.x0 + (px + 0.5) / WM_RES * B.w;
          const ti = tileAt(wx, wy);
          const i = px * 4;
          let c;
          const bio = DATA.BIOMES[ti.biome] || DATA.BIOMES.grass;
          if (ti.t === 'grass') c = bio.mm;
          else if (ti.t === 'sand') c = [160, 140, 90];
          else if (ti.t === 'sea') c = (DATA.SEA_BIOMES[ti.sea] || {}).mm || [22, 50, 92];
          else { const sm = (DATA.SEA_BIOMES[ti.sea] || {}).mm || [22, 50, 92];
                 c = [sm[0] * 0.55 | 0, sm[1] * 0.55 | 0, sm[2] * 0.62 | 0]; }
          // 深海圏は地図上でも海の色が深く沈む(何も無い沖だと一目で分かる)
          if (ti.t === 'sea' || ti.t === 'deep') {
            const vf = voidFactorAt(wx, wy);
            if (vf > 0) { const m = 1 - Math.min(0.78, vf * 0.1); c = [c[0] * m | 0, c[1] * m | 0, c[2] * m | 0]; }
          }
          img.data[i] = c[0]; img.data[i+1] = c[1]; img.data[i+2] = c[2]; img.data[i+3] = 230;
        }
        g.putImageData(img, 0, row);
        wmRow++;
      }
      if (wmRow < WM_RES) setTimeout(step, 0);
    };
    step();
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
      // 拠点・港ヒント(複数)も必ず地図に収まるように
      for (const hid in SaveSys.data.hints || {}) {
        const wh = bases.find(b => b.id === hid) || ports.find(p => p.id === hid);
        if (wh) consider(wh.x, wh.y);
      }
      const wh0 = SaveSys.data.nextHint && bases.find(b => b.id === SaveSys.data.nextHint);
      if (wh0) consider(wh0.x, wh0.y);
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
    // 周辺図: プレイヤー中心。拠点ヒントがあれば「一番近いもの」が必ず収まるまで範囲を広げる
    let ext = LOCAL_EXTENT;
    let lhD = Infinity;
    const consider2 = (b) => { if (b) { const d = Math.hypot(b.x - cx, b.y - cy); if (d < lhD) lhD = d; } };
    for (const hid in SaveSys.data.hints || {}) consider2(bases.find(b => b.id === hid) || ports.find(p => p.id === hid));
    consider2(SaveSys.data.nextHint && bases.find(b => b.id === SaveSys.data.nextHint));
    if (lhD < Infinity) ext = Math.max(ext, lhD * 1.15);
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
    fogG.fillStyle = '#050912';   // 未踏の地は完全に見えない(うっすら透けない)
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

  // ---- 基地から延びる小道と、その先の名所(井戸・祠などの目印) ----
  // 基地間を結ぶ道は作らない(場所の発見は物語で行う)。基地から「どこか」への短い道だけ。
  const roadCache = new Map();
  function roadOf(baseId){
    if (roadCache.has(baseId)) return roadCache.get(baseId);
    const b = bases.find(bb => bb.id === baseId);
    if (!b) return null;
    let h = 0; for (let i = 0; i < baseId.length; i++) h = (h * 31 + baseId.charCodeAt(i)) | 0;
    let road = null;
    for (let k = 0; k < 8 && !road; k++) {
      const a = ((Math.abs(h) % 100) / 100 + k / 8) * Math.PI * 2;
      const ex = b.x + Math.cos(a) * 3400, ey = b.y + Math.sin(a) * 3400;
      const mx = b.x + Math.cos(a) * 1700, my = b.y + Math.sin(a) * 1700;
      if (terrainAt(ex, ey) === 'grass' && terrainAt(mx, my) === 'grass')
        road = { x1: b.x + Math.cos(a) * 220, y1: b.y + Math.sin(a) * 220, x2: ex, y2: ey, a };
    }
    roadCache.set(baseId, road);
    return road;
  }
  // 点と道(線分)の距離
  function roadDist(road, x, y){
    const dx = road.x2 - road.x1, dy = road.y2 - road.y1;
    const t = Math.max(0, Math.min(1, ((x - road.x1) * dx + (y - road.y1) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - (road.x1 + dx * t), y - (road.y1 + dy * t));
  }

  // ---- 海流: 帯状に流れる速い潮(乗ると船が速い)。凪の日はさらに速い ----
  function currentAt(x, y){
    const v = Math.sin(x / 26000 + y / 41000) + Math.sin(x / 9000 - y / 13000 + 2.1)
            + 0.5 * Math.sin((x + y) / 6500 + 4.4);
    return Math.max(0, (Math.abs(v) - 1.35)) / 1.15;   // 0(流れなし)〜1(強い潮)
  }

  // ---- 航路の早瀬: 港と大陸を結ぶ「海の道」。陸の小道の海版で、
  // 素の船足(徒歩と同じ)でも、早瀬に乗れば大陸間を渡れる。
  // 物語の順路に沿って敷かれている(港→隣接大陸、大陸の岸→さらに先)
  const ROUTE_DEFS = [
    ['p_e', 'b_dragon'], ['p_se', 'b_green'], ['p_s', 'b_green'], ['p_sw', 'b_black'],
    ['p_n', 'b_star'], ['p_ne', 'b_mist'], ['p_n', 'b_frost'], ['p_nw', 'b_sea'], ['p_w', 'b_dusk'],
    ['p_white', 'b_sun'], ['p_white', 'b_mist'], ['p_storm', 'b_end'], ['p_storm', 'b_sun'], ['p_moon', 'b_void'],
    ['b_dragon', 'b_mist'], ['b_green', 'b_ember'], ['b_star', 'b_frost'],
    ['b_forge', 'b_sun'], ['b_storm', 'b_sun'], ['b_moon', 'b_void'], ['b_grave', 'b_void'],
    ['b_storm', 'b_end'], ['b_void', 'b_end'],
  ];
  const ROUTE_W = 2400;
  let seaRoutes = null;
  function anchorOf(id, towards){
    const pt = ports.find(p => p.id === id);
    if (pt) return { x: pt.seaX, y: pt.seaY };
    const b = DATA.BASES.find(q => q.id === id);
    // 基地から相手方向へ歩いて、海に出た所が船着き(早瀬の起点)
    const d0 = Math.hypot(towards.x - b.x, towards.y - b.y) || 1;
    const ux = (towards.x - b.x) / d0, uy = (towards.y - b.y) / d0;
    for (let d = 0; d < d0; d += 300) {
      if (!isLand(b.x + ux * d, b.y + uy * d)) return { x: b.x + ux * (d + 400), y: b.y + uy * (d + 400) };
    }
    return { x: b.x, y: b.y };
  }
  function buildRoutes(){
    seaRoutes = [];
    for (const [fromId, toId] of ROUTE_DEFS) {
      const tb = DATA.BASES.find(q => q.id === toId);
      if (!tb) continue;
      const a = anchorOf(fromId, tb);
      const bb = anchorOf(toId, a);   // 相手側も海岸まで
      seaRoutes.push({ x1: a.x, y1: a.y, x2: bb.x, y2: bb.y });
    }
  }
  function routeCurrentAt(x, y){
    if (!seaRoutes) buildRoutes();
    let best = 0;
    for (const r of seaRoutes) {
      const dx = r.x2 - r.x1, dy = r.y2 - r.y1;
      const L2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - r.x1) * dx + (y - r.y1) * dy) / L2));
      const d = Math.hypot(x - (r.x1 + dx * t), y - (r.y1 + dy * t));
      if (d < ROUTE_W) { const st = 1 - d / ROUTE_W; if (st > best) best = st; }
    }
    return best;
  }

  // ---- 外洋の深海圏 ----
  // どの陸からも遠い「何もない沖」は、岸から十分な余裕(START)を越えたところから
  // 離れるほど危険が急速に増す。案内のテキストは無し ― 海の色が深く沈み、HUDの
  // 危険度が上がり、現れる魔物が強くなることで体で分かる(引き返す猶予はある)。
  // 大陸間の海峡は幅が狭く(岸まで常にSTART未満)発動しない。長い航路の早瀬の上と
  // その周辺も抑制される ― 海の道を辿る限りは深海圏に呑まれない。
  const VOID_START = 12000, VOID_RAMP = 1100, VOID_MAX = 10;
  let extTable = null;
  function contLand(c, x, y){
    const ps = partsOf(c);
    for (let i = 0; i < ps.length; i++) if (partGap(c, ps[i], i, x, y) < 0) return true;
    return false;
  }
  function buildExtents(){
    extTable = [];
    for (const c of DATA.CONTINENTS) {
      let R0 = 0;
      for (const p of partsOf(c)) {
        const m = p.r * (1 + ((p.amp != null ? p.amp : c.amp) || 0.13) * 1.3 + 0.4) *
                  Math.max(p.sx || c.sx || 1, p.sy || c.sy || 1);
        R0 = Math.max(R0, Math.hypot(p.dx || 0, p.dy || 0) + m);
      }
      const ex = new Float32Array(96);
      for (let k = 0; k < 96; k++) {
        const a = k / 96 * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        let last = 0;
        for (let d = 0; d <= R0; d += 700) if (contLand(c, c.x + ca * d, c.y + sa * d)) last = d;
        ex[k] = last;
      }
      extTable.push({ x: c.x, y: c.y, ex, bound: R0 });
    }
  }
  // 最寄りの陸(海岸)までのおおよその距離。負=陸の上
  function distToLand(x, y){
    if (!extTable) buildExtents();
    let best = 1e18;
    for (const t of extTable) {
      const dx = x - t.x, dy = y - t.y;
      const d = Math.hypot(dx, dy);
      if (d - t.bound > best) continue;
      const af = ((Math.atan2(dy, dx) / (Math.PI * 2)) * 96 + 96) % 96;
      const k = Math.floor(af), f = af - k;
      const e = t.ex[k] * (1 - f) + t.ex[(k + 1) % 96] * f;
      if (d - e < best) best = d - e;
    }
    return best;
  }
  function routeDist(x, y){
    if (!seaRoutes) buildRoutes();
    let best = 1e18;
    for (const r of seaRoutes) {
      const dx = r.x2 - r.x1, dy = r.y2 - r.y1;
      const L2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - r.x1) * dx + (y - r.y1) * dy) / L2));
      const d = Math.hypot(x - (r.x1 + dx * t), y - (r.y1 + dy * t));
      if (d < best) best = d;
    }
    return best;
  }
  // 深海圏の強さ 0〜VOID_MAX(危険度への加算値と同じ)
  function voidFactorAt(x, y){
    const gap = distToLand(x, y);
    if (gap <= VOID_START) return 0;
    let w = Math.min(VOID_MAX, (gap - VOID_START) / VOID_RAMP);
    const dr = routeDist(x, y);
    if (dr < 12000) w *= Math.max(0, (dr - 6000) / 6000);
    return w;
  }

  // 距離リング(敵の強さ)
  // 危険度: 「始まりからの距離の同心円」が基調(境界は方角ごとに揺らいだ自然な形)。
  // 遠方は圧縮してなだらかにし、基地の周りはその基地の「物語上の危険度」(danger)へ
  // ブレンドする ― 後半の基地の近くほど高く、序盤の基地の周りは遠くでも比較的安全。
  // 基地領域の縁も揺らぎ、極端な段差にはならない。
  function ringOf(x, y){
    const a = Math.atan2(y, x);
    const w = 1 + 0.14 * Math.sin(a * 3 + 1.3) + 0.09 * Math.sin(a * 5 - 0.7) + 0.06 * Math.sin(a * 9 + 2.1);
    const raw = Math.hypot(x, y) * w / DATA.DIST_RING;
    let r = raw < 5 ? raw : 5 + Math.sqrt(raw - 5) * 0.9;   // 荒野は距離とともにゆるやかに上がる
    // 最も影響の強い基地の危険度へブレンド
    let bt = 0, bd = 0;
    for (const b of bases) {
      if (b.danger == null) continue;
      const dx = x - b.x, dy = y - b.y;
      if (Math.abs(dx) > 26000 || Math.abs(dy) > 26000) continue;
      const ba = Math.atan2(dy, dx);
      const rad = 17000 * (1 + 0.22 * Math.sin(ba * 3 + b.x * 0.0007) + 0.14 * Math.sin(ba * 5 + b.y * 0.0007));
      const d = Math.hypot(dx, dy);
      if (d < rad) { const t = 1 - d / rad; if (t > bt) { bt = t; bd = b.danger; } }
    }
    const tt = Math.min(1, bt * 1.6);
    r = r * (1 - tt) + bd * tt;
    r += voidFactorAt(x, y);   // 何もない沖の深海圏: 離れるほど急速に危険になる
    return Math.floor(Math.max(0, r));
  }

  return { isLand, landAt, terrainAt, tileAt, ports, bases, resetRun, tick, setObjHp,
           nearbyObjects, destroyObject, objectDrops, nearbyCrags, nearbyLandmarks, nearbyRelics,
           worldImage, minimapView, MM_SIZE, ringOf, edgeR, CHUNK, bounds,
           initExplored, recordExplore, exploredArray, fogCanvas, isExplored,
           biodomeAt, seaBiomeAt, roadOf, roadDist, currentAt, routeCurrentAt, voidFactorAt };
})();
