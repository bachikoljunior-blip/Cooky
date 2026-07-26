// =============================================================
// town.js - 街の地形
//   建物は「置いた絵」ではなく地形そのもの: 床・壁・戸口でできていて、
//   壁は通れず、戸口からは中に入れる。施設の主は建物の中にいる。
//   段は本当に高さを持ち、石段を上ると人も建物も持ち上がって見える。
//   街ごとに骨組み(archetype)と素材が違うので、同じ形の街はひとつも無い。
// =============================================================
'use strict';

const Town = (() => {
  const ELEV = 22;      // 一段の高さ(見た目のせり上がり)
  const WT = 16;        // 壁の厚み
  const DOOR = 78;      // 戸口の幅(人がすれ違える)
  const PR = 16;        // 人の半径

  // ---------------- 素材(街の色) ----------------
  // 石・木・土・雪・灰・砂・骨。街の成り立ちで使う材が違う
  const MAT = {
    stone: { g:'#3a424f', g2:'#434c5a', road:'#5d6472', wall:'#79828f', top:'#a8b2bf', fl:'#4d5665', trim:'#cbd4e0' , roof:'#8d5f4e' },
    slate: { g:'#333b47', g2:'#3b4351', road:'#535b69', wall:'#6d7684', top:'#9ba5b3', fl:'#464e5c', trim:'#bcc6d4' , roof:'#4f5f7a' },
    timber:{ g:'#453a2c', g2:'#4f4433', road:'#6a5a40', wall:'#8a6c46', top:'#b58f5c', fl:'#5c4c34', trim:'#e0bd85' , roof:'#8a4a34' },
    dirt:  { g:'#443a28', g2:'#4d4230', road:'#665739', wall:'#7c6440', top:'#a68858', fl:'#544731', trim:'#d0b077' , roof:'#7a5a3a' },
    grass: { g:'#2e4432', g2:'#364e3a', road:'#5b5c3c', wall:'#697a4e', top:'#93a86b', fl:'#455540', trim:'#bcd490' , roof:'#4d6b48' },
    snow:  { g:'#465464', g2:'#4f5f70', road:'#6c7c8f', wall:'#8595a6', top:'#c3d3e2', fl:'#5a6a7b', trim:'#eaf3fb' , roof:'#7d8ea1' },
    ash:   { g:'#443330', g2:'#4d3b35', road:'#665045', wall:'#7f5c4a', top:'#ac7f60', fl:'#54403a', trim:'#e79a5f' , roof:'#8a4630' },
    sand:  { g:'#4c4433', g2:'#564d3a', road:'#6f6244', wall:'#918058', top:'#bfa872', fl:'#5d5340', trim:'#f0d99a' , roof:'#a07a4a' },
    bone:  { g:'#464438', g2:'#4f4d40', road:'#67654f', wall:'#8b8871', top:'#b6b294', fl:'#57553f', trim:'#eae5cb' , roof:'#7d7a63' },
    obsid: { g:'#2b2d36', g2:'#33353f', road:'#454854', wall:'#5a5e6e', top:'#7f8496', fl:'#3a3d48', trim:'#8fe8d6' , roof:'#3c5f60' },
    gold:  { g:'#4b3c22', g2:'#55452a', road:'#71592d', wall:'#9c7b3b', top:'#d0a752', fl:'#5c4a2c', trim:'#ffdd8c' , roof:'#b8853a' },
    void_: { g:'#262133', g2:'#2d273c', road:'#3a3352', wall:'#4f4670', top:'#736697', fl:'#312a44', trim:'#c4aefb' , roof:'#4a3f6b' },
    soul:  { g:'#252f47', g2:'#2c3752', road:'#3f4c72', wall:'#55638c', top:'#8093c0', fl:'#354262', trim:'#8ef0f6' , roof:'#3f5580' },
  };

  // ---------------- 決定論の乱数(街ごとに固定) ----------------
  function seedOf(s){ let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rngOf(seed){ let s = seed || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  // ---------------- 部品 ----------------
  // 建物: 中心と大きさ、戸口の向き。中の主が立つ位置(slot)は戸口の反対側の奥
  function bld(x, y, w, h, door, o){
    const b = Object.assign({ x, y, w, h, door, lv: 0, kind:'house' }, o || {});
    const back = { s:[0,-1], n:[0,1], w:[1,0], e:[-1,0] }[door] || [0,-1];
    b.slot = { x: x + back[0] * (w / 2 - 46), y: y + back[1] * (h / 2 - 44) };
    return b;
  }
  // 戸口を除いた壁の矩形(当たり判定と描画に使う)
  function wallRects(b){
    const x0 = b.x - b.w/2, x1 = b.x + b.w/2, y0 = b.y - b.h/2, y1 = b.y + b.h/2;
    const dw = Math.min(DOOR, (b.door === 'n' || b.door === 's' ? b.w : b.h) - WT * 2 - 8);
    const out = [];
    const seg = (side, a0, a1, horiz, fixed) => {
      if (horiz) out.push({ x0:a0, y0:fixed, x1:a1, y1:fixed + WT, side });
      else out.push({ x0:fixed, y0:a0, x1:fixed + WT, y1:a1, side });
    };
    // 南北の壁
    for (const [side, fy] of [['n', y0], ['s', y1 - WT]]) {
      if (b.door === side) {
        const c = b.x + (b.doorOff || 0);
        seg(side, x0, Math.max(x0, c - dw/2), true, fy);
        seg(side, Math.min(x1, c + dw/2), x1, true, fy);
      } else seg(side, x0, x1, true, fy);
    }
    // 東西の壁(角は南北の壁に含まれるので内側だけ)
    for (const [side, fx] of [['w', x0], ['e', x1 - WT]]) {
      if (b.door === side) {
        const c = b.y + (b.doorOff || 0);
        seg(side, y0 + WT, Math.max(y0 + WT, c - dw/2), false, fx);
        seg(side, Math.min(y1 - WT, c + dw/2), y1 - WT, false, fx);
      } else seg(side, y0 + WT, y1 - WT, false, fx);
    }
    return out.filter(r => r.x1 - r.x0 > 1 && r.y1 - r.y0 > 1);
  }

  // ---------------- 建物の中身(用途ごとの造作) ----------------
  // 置き場所は画面の向き基準の定位置(奥の壁ぎわ・左右の壁ぎわ・手前の隅)。
  // 主の立ち位置と帳場にかかる場所は空けるので、どの向きの戸口でも主が隠れない
  const ANCHOR = [[-0.62, 0.17], [0.62, 0.17], [0, 0.15], [-0.68, 0.52], [0.68, 0.52],
                  [-0.6, 0.85], [0.6, 0.85], [0, 0.85]];
  function anchorPos(bd, u, v){
    const iw = bd.w - WT * 2, ih = bd.h - WT * 2;
    return { x: bd.x + u * iw / 2, y: bd.y - ih / 2 + v * ih };
  }
  // その建物に実際に置ける造作の一覧(位置つき)。主・帳場を避けて前から詰める
  function fitsOf(bd){
    if (bd._fits) return bd._fits;
    const list = FIT[bd.use || bd.kind] || [];
    const front = { s:[0, 1], n:[0, -1], w:[-1, 0], e:[1, 0] }[bd.door] || [0, 1];
    const cnt = { x: bd.slot.x + front[0] * 38, y: bd.slot.y + front[1] * 38 };
    const free = [];
    for (const [u, v] of ANCHOR) {
      const q = anchorPos(bd, u, v);
      if (Math.hypot(q.x - bd.slot.x, q.y - bd.slot.y) < 52) continue;   // 主を埋めない
      if (Math.hypot(q.x - cnt.x, q.y - cnt.y) < 46) continue;           // 帳場に重ねない
      free.push(q);
    }
    const out = [];
    for (let i = 0; i < list.length && i < free.length; i++) out.push({ k: list[i], x: free[i].x, y: free[i].y });
    return (bd._fits = out);
  }
  // 用途ごとの造作。並びの先頭ほど「その施設らしさ」が強いものを置く
  const FIT = {
    altar:  ['dais', 'brazier', 'brazier'],
    lab:    ['still', 'shelf', 'crate'],
    camp:   ['banner', 'bedroll', 'bedroll'],
    lib:    ['shelf', 'shelf', 'desk'],
    armory: ['rack', 'anvil', 'crate'],
    war:    ['rack', 'dummy', 'target'],
    life:   ['shrine', 'basin', 'herbs'],
    lore:   ['chest', 'crate', 'crate', 'barrel'],
    ship:   ['timber', 'rope', 'bench'],
    house:  ['bed', 'table'],
    hut:    ['bedroll', 'pot'],
    tent:   ['bedroll', 'bedroll'],
    ware:   ['crate', 'crate', 'barrel', 'crate'],
    keep:   ['banner', 'banner', 'table'],
    tower:  ['shelf', 'desk'],
    inn:    ['hearth', 'table', 'table'],
    dug:    ['hearth', 'bedroll'],
    ruin:   ['rubble', 'rubble'],
    shed:   ['anvil', 'bench', 'barrel'],
    temple: ['dais', 'brazier', 'brazier'],
    shrine: ['shrine', 'brazier', 'brazier'],
  };
  // 床に敷くもの(人の下)と、立ち上がるもの(人と前後する)の区別
  const FLAT = { dais:1, hearth:1, bedroll:1, bed:1, rubble:1, herbs:1, target:1, rope:1 };
  // 屋根の色。外から見て「何の建物か」が分かる
  const ROOF = {
    altar:'#57487f', lab:'#3f6b7a', camp:'#7a5f3a', lib:'#54406b', armory:'#7a4436',
    war:'#7a3f33', life:'#3f6b4e', lore:'#7a6234', ship:'#6b5236', tent:'#6b5a3a',
    ware:'#5b5040', keep:'#57506b', tower:'#4a5a72', inn:'#8a5a34', dug:'#68798a',
    ruin:'#474747', shed:'#6b4030', temple:'#a8853f', shrine:'#42675d',
  };
  // 戸口の上に下がる看板の紋
  const SIGN = { altar:'✦', lab:'⚗', camp:'⌂', lib:'▤', armory:'⚔', war:'◎', life:'❖',
                 lore:'▣', ship:'⚓', inn:'♨', ware:'▦', shed:'⚒', temple:'☀', shrine:'⛩' };

  // ---------------- 骨組み(街の形) ----------------
  // どの骨組みも { levels, stairs, buildings, walls, water, roads, slots } を返す。
  // slots.fac は施設(最大3)、slots.npc/side/villager は人の立ち位置。
  const ARCH = {};

  // 魂の広場: 先人が築いた祭壇の壇(一段高い)を中心に、施設の堂が環を描く
  ARCH.plaza = (b, r, cfg) => {
    const dais = { x0:-250, y0:-330, x1:250, y1:-110, lv:1 };
    return {
      levels: [dais],
      stairs: [{ x:0, y:-96, w:150, h:52, lo:0, hi:1, dir:'n' }],
      buildings: [
        bld(0, -232, 260, 150, 's', { lv:1, kind:'hall', fac:0 }),
        bld(-430, -180, 220, 150, 's', { kind:'hall', fac:1 }),
        bld(430, -180, 220, 150, 's', { kind:'hall', fac:2 }),
        bld(-660, -10, 190, 150, 'e', { kind:'hall', fac:3 }),
        bld(660, -10, 190, 150, 'w', { kind:'hall', fac:4 }),
      ],
      walls: [{ x0:-770, y0:340, x1:-330, y1:340 + WT }, { x0:330, y0:340, x1:770, y1:340 + WT }],
      water: [{ x0:-620, y0:120, x1:-380, y1:250, kind:'pool' }],
      roads: [[[0, 300], [0, -60]], [[-560, 60], [-120, 20], [120, 20], [560, 60]]],
      slots: { gate:{ x:0, y:270 }, stats:{ x:-300, y:250 },
               side:[{ x:180, y:150 }, { x:330, y:170 }, { x:480, y:150 }],
               villager:[{ x:-180, y:160 }, { x:250, y:60 }] },
    };
  };

  // 砦の村: 外周の城壁と門、奥に一段高い本丸。兵舎は城壁の内側に並ぶ
  ARCH.fort = (b, r, cfg) => {
    const keep = { x0:-300, y0:b.y0 + 20, x1:300, y1:-120, lv:1 };
    const wl = [], W = b.x1 - 60, E = b.x0 + 60;
    wl.push({ x0:E, y0:b.y0 + 10, x1:W, y1:b.y0 + 10 + WT });          // 北の城壁
    wl.push({ x0:E, y0:b.y0 + 10, x1:E + WT, y1:300 });                 // 西
    wl.push({ x0:W - WT, y0:b.y0 + 10, x1:W, y1:300 });                 // 東
    wl.push({ x0:E, y0:300, x1:-70, y1:300 + WT });                     // 南(門の口を空ける)
    wl.push({ x0:70, y0:300, x1:W, y1:300 + WT });
    return {
      levels: [keep],
      stairs: [{ x:cfg.stairX || -140, y:-106, w:130, h:50, lo:0, hi:1, dir:'n' }],
      buildings: [
        bld(0, b.y0 + 105, 300, 150, 's', { lv:1, kind:'keep', fac:0 }),
        bld(E + 150, 60, 220, 160, 'e', { kind:'hall', fac:1 }),
        bld(W - 150, 60, 220, 160, 'w', { kind:'hall', fac:2 }),
        bld(E + 150, 220, 170, 120, 'e', { kind:'house' }),
        bld(W - 150, 220, 170, 120, 'w', { kind:'house' }),
      ],
      walls: wl,
      roads: [[[0, 300], [0, -60]], [[E + 150, 140], [0, 120], [W - 150, 140]]],
      slots: { gate:{ x:0, y:355 }, board:{ x:-150, y:340 },
               npc:{ x:150, y:-40 }, side:[{ x:-260, y:60 }, { x:260, y:60 }],
               villager:[{ x:-90, y:200 }, { x:120, y:230 }] },
    };
  };

  // 遺跡の街: 崩れた列柱の壇。屋根の落ちた堂が壇の上、無事な一棟が下
  ARCH.ruin = (b, r, cfg) => {
    const pl = { x0:b.x0 + 70, y0:b.y0 + 20, x1:b.x1 - 70, y1:-110, lv:1 };
    return {
      levels: [pl],
      stairs: [{ x:-260, y:-96, w:120, h:50, lo:0, hi:1, dir:'n' },
               { x:280, y:-96, w:120, h:50, lo:0, hi:1, dir:'n' }],
      buildings: [
        bld(-250, b.y0 + 120, 240, 170, 's', { lv:1, kind:'ruin', fac:0 }),
        bld(250, b.y0 + 120, 240, 170, 's', { lv:1, kind:'ruin', fac:1 }),
        bld(0, 120, 250, 150, 's', { kind:'hall', fac:2 }),
      ],
      walls: [{ x0:b.x0 + 70, y0:-120, x1:b.x0 + 70 + WT, y1:60 },
              { x0:b.x1 - 70 - WT, y0:-120, x1:b.x1 - 70, y1:60 }],
      roads: [[[0, 320], [0, 210]], [[-260, -40], [0, 10], [280, -40]]],
      pillars: [[-430, -200], [-430, -30], [430, -200], [430, -30], [0, -250]],
      slots: { gate:{ x:0, y:350 }, board:{ x:-330, y:300 },
               npc:{ x:-120, y:-30 }, side:[{ x:150, y:-30 }, { x:-380, y:150 }],
               villager:[{ x:340, y:170 }, { x:-160, y:250 }] },
    };
  };

  // 泉の村: 湧き水を囲んで段々に家が建つ。板の桟道が水の上を渡る
  ARCH.spring = (b, r, cfg) => {
    const pool = { x0:-190, y0:-40, x1:190, y1:170, kind:'pool' };
    const ter = { x0:b.x0 + 60, y0:b.y0 + 20, x1:b.x1 - 60, y1:-150, lv:1 };
    return {
      levels: [ter],
      stairs: [{ x:cfg.stairX || 210, y:-136, w:120, h:50, lo:0, hi:1, dir:'n' }],
      buildings: [
        bld(-260, b.y0 + 110, 230, 150, 's', { lv:1, kind:'hall', fac:0 }),
        bld(240, b.y0 + 110, 230, 150, 's', { lv:1, kind:'hall', fac:1 }),
        bld(b.x0 + 160, 90, 200, 150, 'e', { kind:'hall', fac:2 }),
        bld(b.x1 - 160, 90, 180, 130, 'w', { kind:'house' }),
      ],
      water: [pool],
      roads: [[[0, 320], [-300, 220], [-300, -80]], [[300, 240], [300, -100]]],
      slots: { gate:{ x:0, y:340 }, board:{ x:-340, y:300 },
               npc:{ x:0, y:-90 }, side:[{ x:-380, y:-40 }, { x:380, y:-40 }],
               villager:[{ x:-300, y:230 }, { x:330, y:200 }] },
    };
  };

  // 鍛冶の街: 谷底の一本道。左右の岩棚に工房が掘り込まれ、奥に大炉の堂
  ARCH.forge = (b, r, cfg) => {
    const lw = { x0:b.x0 + 40, y0:b.y0 + 20, x1:b.x0 + 330, y1:340, lv:1 };
    const re = { x0:b.x1 - 330, y0:b.y0 + 20, x1:b.x1 - 40, y1:340, lv:1 };
    return {
      levels: [lw, re],
      stairs: [{ x:b.x0 + 350, y:-40, w:52, h:130, lo:0, hi:1, dir:'w' },
               { x:b.x1 - 350, y:-40, w:52, h:130, lo:0, hi:1, dir:'e' },
               { x:b.x0 + 350, y:250, w:52, h:120, lo:0, hi:1, dir:'w' }],
      buildings: [
        bld(b.x0 + 185, b.y0 + 130, 250, 180, 'e', { lv:1, kind:'shed', fac:0 }),
        bld(b.x1 - 185, b.y0 + 130, 250, 180, 'w', { lv:1, kind:'shed', fac:1 }),
        bld(b.x0 + 185, 190, 250, 170, 'e', { lv:1, kind:'shed', fac:2 }),
        bld(b.x1 - 185, 190, 250, 170, 'w', { lv:1, kind:'shed' }),
      ],
      roads: [[[0, 350], [0, b.y0 + 60]]],
      slots: { gate:{ x:0, y:340 }, board:{ x:-120, y:290 },
               npc:{ x:0, y:-160 }, side:[{ x:-110, y:40 }, { x:110, y:40 }],
               villager:[{ x:-90, y:170 }, { x:110, y:220 }] },
    };
  };

  // 森の集落: 木立の間に小屋が散る。道はうねり、小高い塚に一軒だけ建つ
  ARCH.grove = (b, r, cfg) => {
    const knoll = { x0:-370, y0:b.y0 + 30, x1:-40, y1:-150, lv:1 };
    const hut = (x, y, d) => bld(x, y, 175 + Math.floor(r() * 40), 130 + Math.floor(r() * 30), d, { kind:'hut' });
    return {
      levels: [knoll],
      stairs: [{ x:-190, y:-136, w:110, h:48, lo:0, hi:1, dir:'n' }],
      buildings: [
        Object.assign(bld(-205, b.y0 + 125, 230, 155, 's', { lv:1, kind:'hut', fac:0 })),
        Object.assign(hut(240, b.y0 + 140, 's'), { fac:1 }),
        Object.assign(hut(b.x1 - 170, 110, 'w'), { fac:2 }),
        hut(b.x0 + 160, 160, 'e'), hut(60, 220, 'n'),
      ],
      roads: [[[0, 340], [-60, 220], [90, 120], [-40, 10], [-190, -100]],
              [[90, 120], [430, 60]]],
      trees: [[-520, -220], [-560, 40], [520, -240], [560, 200], [-320, 300], [300, -260], [430, 320]],
      slots: { gate:{ x:0, y:350 }, board:{ x:-190, y:320 },
               npc:{ x:-60, y:-40 }, side:[{ x:200, y:-40 }, { x:-330, y:-40 }],
               villager:[{ x:-150, y:180 }, { x:230, y:300 }] },
    };
  };

  // 野営地: 中央の焚き火を囲む天幕の輪。囲いは無く、片隅に見張りの塚
  ARCH.camp = (b, r, cfg) => {
    const mound = { x0:b.x1 - 300, y0:b.y0 + 30, x1:b.x1 - 60, y1:-160, lv:1 };
    const ring = [];
    const spots = [[-330, -190], [330, -190], [-430, 90], [430, 90], [-180, 250], [200, 260]];
    for (let i = 0; i < spots.length; i++) {
      const [x, y] = spots[i];
      ring.push(bld(x, y, 190, 140, y > 40 ? 'n' : 's', { kind:'tent', fac: i < 3 ? i : undefined }));
    }
    return {
      levels: [mound],
      stairs: [{ x:b.x1 - 180, y:-146, w:110, h:48, lo:0, hi:1, dir:'n' }],
      buildings: ring,
      firepit: { x:0, y:20, r:70 },
      roads: [[[0, 340], [0, 100]], [[-330, -110], [0, 20], [330, -110]], [[-430, 90], [430, 90]]],
      slots: { gate:{ x:0, y:350 }, board:{ x:-330, y:345 },
               npc:{ x:-110, y:-90 }, side:[{ x:120, y:-90 }, { x:-300, y:-30 }],
               villager:[{ x:250, y:150 }, { x:-90, y:150 }] },
    };
  };

  // 崖の港町: 下の岸壁に倉庫、上の段に家並み、さらに上の台に灯台
  ARCH.cliffport = (b, r, cfg) => {
    const mid = { x0:b.x0 + 40, y0:b.y0 + 90, x1:b.x1 - 40, y1:-40, lv:1 };
    const top = { x0:b.x1 - 340, y0:b.y0 + 20, x1:b.x1 - 60, y1:b.y0 + 200, lv:2 };
    return {
      levels: [mid, top],
      stairs: [{ x:-330, y:-26, w:120, h:52, lo:0, hi:1, dir:'n' },
               { x:300, y:-26, w:120, h:52, lo:0, hi:1, dir:'n' },
               { x:b.x1 - 200, y:b.y0 + 218, w:110, h:48, lo:1, hi:2, dir:'n' }],
      buildings: [
        bld(b.x1 - 200, b.y0 + 108, 220, 150, 's', { lv:2, kind:'tower', fac:0 }),
        bld(-320, b.y0 + 190, 230, 160, 's', { lv:1, kind:'hall', fac:1 }),
        bld(60, b.y0 + 190, 230, 160, 's', { lv:1, kind:'hall', fac:2 }),
        bld(b.x0 + 170, 190, 210, 150, 'e', { kind:'ware' }),
        bld(b.x1 - 200, 200, 210, 150, 'w', { kind:'ware' }),
      ],
      roads: [[[0, 350], [0, 60]], [[-330, 10], [0, 60], [300, 10]]],
      slots: { gate:{ x:0, y:345 }, board:{ x:-170, y:330 },
               npc:{ x:-190, y:-70 }, side:[{ x:210, y:-70 }, { x:-250, y:60 }],
               villager:[{ x:-80, y:60 }, { x:180, y:330 }] },
    };
  };

  // 祠の村: 塀で囲った境内。奥の一段高い内陣へ、長い石段がまっすぐ伸びる
  ARCH.shrine = (b, r, cfg) => {
    const inner = { x0:-330, y0:b.y0 + 20, x1:330, y1:-140, lv:1 };
    const E = b.x0 + 70, W = b.x1 - 70;
    return {
      levels: [inner],
      stairs: [{ x:0, y:-120, w:130, h:60, lo:0, hi:1, dir:'n' }],
      buildings: [
        bld(0, b.y0 + 120, 280, 160, 's', { lv:1, kind:'shrine', fac:0 }),
        bld(E + 160, 40, 210, 150, 'e', { kind:'hall', fac:1 }),
        bld(W - 160, 40, 210, 150, 'w', { kind:'hall', fac:2 }),
      ],
      walls: [{ x0:E, y0:b.y0 + 10, x1:E + WT, y1:290 }, { x0:W - WT, y0:b.y0 + 10, x1:W, y1:290 },
              { x0:E, y0:290, x1:-80, y1:290 + WT }, { x0:80, y0:290, x1:W, y1:290 + WT }],
      roads: [[[0, 300], [0, -80]]],
      lanterns: [[-110, 210], [110, 210], [-110, 60], [110, 60], [-110, -80], [110, -80]],
      slots: { gate:{ x:0, y:345 }, board:{ x:-230, y:250 },
               npc:{ x:-130, y:-60 }, side:[{ x:130, y:-60 }, { x:-300, y:150 }],
               villager:[{ x:250, y:180 }, { x:-160, y:210 }] },
    };
  };

  // 観測の村: 台地の上にさらに観測台。石段は折り返しで、左右にずらして付く
  ARCH.observatory = (b, r, cfg) => {
    const pl = { x0:b.x0 + 50, y0:b.y0 + 90, x1:b.x1 - 50, y1:-60, lv:1 };
    const pad = { x0:-230, y0:b.y0 + 20, x1:230, y1:b.y0 + 190, lv:2 };
    return {
      levels: [pl, pad],
      stairs: [{ x:b.x0 + 210, y:-46, w:120, h:52, lo:0, hi:1, dir:'n' },
               { x:0, y:b.y0 + 208, w:120, h:50, lo:1, hi:2, dir:'n' }],
      buildings: [
        bld(0, b.y0 + 105, 250, 150, 's', { lv:2, kind:'tower', fac:0 }),
        bld(b.x0 + 200, b.y0 + 200, 220, 150, 's', { lv:1, kind:'hall', fac:1 }),
        bld(b.x1 - 200, b.y0 + 200, 220, 150, 's', { lv:1, kind:'hall', fac:2 }),
        bld(b.x1 - 220, 180, 200, 140, 'w', { kind:'house' }),
      ],
      roads: [[[0, 340], [b.x0 + 210, 60]], [[b.x0 + 210, -110], [0, b.y0 + 240]]],
      slots: { gate:{ x:0, y:345 }, board:{ x:-250, y:290 },
               npc:{ x:150, y:-130 }, side:[{ x:-150, y:-130 }, { x:380, y:60 }],
               villager:[{ x:-120, y:180 }, { x:150, y:240 }] },
    };
  };

  // 宿場町: 街道が一本通り、その両側に軒を接して宿と店が並ぶ
  ARCH.waystation = (b, r, cfg) => {
    const yard = { x0:b.x1 - 300, y0:-330, x1:b.x1 - 50, y1:-120, lv:1 };
    const row = [];
    const xs = [-430, -170, 90, 350];
    for (let i = 0; i < xs.length; i++) {
      row.push(bld(xs[i], -170, 210, 150, 's', { kind:'inn', fac: i < 3 ? i : undefined }));
      if (i < 3) row.push(bld(xs[i] + 60, 190, 190, 140, 'n', { kind:'house' }));
    }
    return {
      levels: [yard],
      stairs: [{ x:b.x1 - 175, y:-106, w:110, h:48, lo:0, hi:1, dir:'n' }],
      buildings: row,
      walls: [{ x0:b.x0 + 60, y0:-340, x1:b.x0 + 60 + WT, y1:-60 }],
      roads: [[[b.x0 + 40, 20], [b.x1 - 40, 20]], [[0, 330], [0, 40]]],
      slots: { gate:{ x:0, y:345 }, board:{ x:-300, y:60 },
               npc:{ x:-300, y:-40 }, side:[{ x:-40, y:-40 }, { x:220, y:-40 }],
               villager:[{ x:-140, y:80 }, { x:300, y:90 }] },
    };
  };

  // 雪の隠れ里: 雪堤を掘り込んだ半地下の家。狭い雪道が縫うように通る
  ARCH.frostvale = (b, r, cfg) => {
    const bankN = { x0:b.x0 + 40, y0:b.y0 + 20, x1:b.x1 - 40, y1:-90, lv:1 };
    const bankS = { x0:b.x0 + 200, y0:270, x1:b.x1 - 200, y1:390, lv:1 };
    return {
      levels: [bankN, bankS],
      stairs: [{ x:-300, y:-76, w:100, h:46, lo:0, hi:1, dir:'n' },
               { x:220, y:-76, w:100, h:46, lo:0, hi:1, dir:'n' },
               { x:0, y:256, w:110, h:46, lo:0, hi:1, dir:'s' }],
      buildings: [
        bld(-300, b.y0 + 110, 230, 150, 's', { lv:1, kind:'dug', fac:0 }),
        bld(200, b.y0 + 110, 230, 150, 's', { lv:1, kind:'dug', fac:1 }),
        bld(b.x1 - 150, b.y0 + 110, 190, 150, 'w', { lv:1, kind:'dug', fac:2 }),
        bld(0, 335, 230, 130, 'n', { lv:1, kind:'dug' }),
      ],
      roads: [[[0, 220], [-300, -30]], [[0, 220], [220, -30]], [[0, 340], [0, 220]]],
      slots: { gate:{ x:0, y:140 }, board:{ x:-260, y:140 },
               npc:{ x:-140, y:-20 }, side:[{ x:80, y:-20 }, { x:430, y:-20 }],
               villager:[{ x:-380, y:180 }, { x:330, y:200 }] },
    };
  };

  // 神殿都市: 三段の壇が正面に積み上がり、幅の広い階段が一直線に貫く
  ARCH.temple = (b, r, cfg) => {
    const l1 = { x0:b.x0 + 60, y0:b.y0 + 20, x1:b.x1 - 60, y1:150, lv:1 };
    const l2 = { x0:-380, y0:b.y0 + 20, x1:380, y1:-120, lv:2 };
    return {
      levels: [l1, l2],
      stairs: [{ x:0, y:168, w:220, h:56, lo:0, hi:1, dir:'n' },
               { x:0, y:-102, w:180, h:52, lo:1, hi:2, dir:'n' }],
      buildings: [
        bld(0, b.y0 + 120, 300, 170, 's', { lv:2, kind:'temple', fac:0 }),
        bld(b.x0 + 190, -30, 230, 150, 's', { lv:1, kind:'hall', fac:1 }),
        bld(b.x1 - 190, -30, 230, 150, 's', { lv:1, kind:'hall', fac:2 }),
      ],
      roads: [[[0, 350], [0, 180]]],
      pillars: [[-250, -230], [250, -230], [-500, 90], [500, 90], [-500, -230], [500, -230]],
      slots: { gate:{ x:0, y:355 }, board:{ x:-250, y:300 },
               npc:{ x:-130, y:-60 }, side:[{ x:130, y:-60 }, { x:-430, y:200 }],
               villager:[{ x:-180, y:200 }, { x:210, y:230 }] },
    };
  };

  // 最果ての城: 外郭・中庭・内郭・天守。門をくぐるたび一段上がる
  ARCH.castle = (b, r, cfg) => {
    const ward = { x0:b.x0 + 120, y0:b.y0 + 90, x1:b.x1 - 120, y1:-20, lv:1 };
    const keep = { x0:-250, y0:b.y0 + 20, x1:250, y1:b.y0 + 190, lv:2 };
    const E = b.x0 + 50, W = b.x1 - 50;
    return {
      levels: [ward, keep],
      stairs: [{ x:0, y:-6, w:140, h:54, lo:0, hi:1, dir:'n' },
               { x:0, y:b.y0 + 208, w:120, h:50, lo:1, hi:2, dir:'n' }],
      buildings: [
        bld(0, b.y0 + 105, 280, 150, 's', { lv:2, kind:'keep', fac:0 }),
        bld(b.x0 + 250, b.y0 + 190, 220, 150, 's', { lv:1, kind:'hall', fac:1 }),
        bld(b.x1 - 250, b.y0 + 190, 220, 150, 's', { lv:1, kind:'hall', fac:2 }),
      ],
      walls: [{ x0:E, y0:b.y0 + 10, x1:E + WT, y1:300 }, { x0:W - WT, y0:b.y0 + 10, x1:W, y1:300 },
              { x0:E, y0:300, x1:-80, y1:300 + WT }, { x0:80, y0:300, x1:W, y1:300 + WT },
              { x0:b.x0 + 120, y0:-20, x1:-90, y1:-20 + WT }, { x0:90, y0:-20, x1:b.x1 - 120, y1:-20 + WT }],
      roads: [[[0, 300], [0, -60]]],
      slots: { gate:{ x:0, y:350 }, board:{ x:-250, y:250 },
               npc:{ x:-150, y:-70 }, side:[{ x:150, y:-70 }, { x:-330, y:180 }],
               villager:[{ x:-150, y:200 }, { x:190, y:220 }] },
    };
  };

  // 港町: 東は海。岸に桟橋が伸び、西の一段高い土地に町家が並ぶ
  ARCH.harbor = (b, r, cfg) => {
    const town = { x0:b.x0 + 40, y0:b.y0 + 30, x1:-140, y1:340, lv:1 };
    // 町家は西の高台に一列。家の高さを先に決めてから、帯の中に等間隔で割りつける。
    // 間隔を決め打ちにすると背の高い家が下の家に食い込み、詰めすぎると路地を通れない
    const houses = [];
    const top = b.y0 + 100, bot = 240;
    const span = Math.max(200, bot - top);
    const GAP = 40;                                   // 人がすれ違える路地幅
    let n = Math.max(2, Math.min(5, Math.floor(span / 150)));
    const hs = [];
    for (let i = 0; i < n; i++) hs.push(118 + Math.floor(r() * 26));
    let totalH = hs.reduce((s, v) => s + v, 0);
    // 帯に収まらなければ軒数を減らす。はみ出すと門や船大工の立ち位置に家が乗る
    while (n > 2 && totalH + (n - 1) * GAP > span) { hs.pop(); n--; totalH = hs.reduce((s, v) => s + v, 0); }
    const gap = Math.max(GAP, (span - totalH) / Math.max(1, n - 1));
    const ware = bld(-330, 60, 220, 150, 'e', { lv:1, kind:'ware', fac:0 });
    let cy = top;
    for (let i = 0; i < n; i++) {
      const h = bld(b.x0 + 170 + Math.floor(r() * 60), cy + hs[i] / 2,
        176 + Math.floor(r() * 34), hs[i], 'e', { lv:1, kind:'house' });
      cy += hs[i] + gap;
      // 荷揚げ場(船大工の仕事場)の前は空けておく。ここに家が建つと、
      // 船大工が自分の建物の壁に埋まってしまう
      const near = Math.abs(h.x - ware.x) < (h.w + ware.w) / 2 + 40 &&
                   Math.abs(h.y - ware.y) < (h.h + ware.h) / 2 + 40;
      if (!near) houses.push(h);
    }
    return {
      levels: [town],
      stairs: [{ x:-120, y:-40, w:52, h:130, lo:0, hi:1, dir:'w' },
               { x:-120, y:230, w:52, h:120, lo:0, hi:1, dir:'w' }],
      buildings: [ware].concat(houses),
      water: [{ x0:70, y0:b.y0, x1:b.x1, y1:b.y1, kind:'sea' }],
      shore: { x0:34, y0:b.y0, x1:70, y1:b.y1 },
      pier: { x0:-80, y0:120, x1:330, y1:210 },
      roads: [[[-60, 340], [-60, -260]]],
      slots: { gate:{ x:-420, y:270 }, portnpc:{ x:-60, y:-60 }, trader:{ x:-60, y:-190 },
               villager:[{ x:240, y:165 }] },
    };
  };

  // ---------------- 街ごとの設定 ----------------
  // 骨組み・素材・種の3つで、同じ形の街がひとつも無いようにする
  const TOWN = {
    main:      { arch:'plaza',       mat:'soul' },
    b_north:   { arch:'fort',        mat:'stone',  stairX:-140 },
    b_east:    { arch:'ruin',        mat:'slate' },
    b_south:   { arch:'spring',      mat:'grass',  stairX:210 },
    b_west:    { arch:'forge',       mat:'ash' },
    b_dragon:  { arch:'camp',        mat:'bone' },
    b_spa:     { arch:'spring',      mat:'timber', stairX:-230 },
    b_white:   { arch:'cliffport',   mat:'stone' },
    b_forge:   { arch:'forge',       mat:'slate' },
    b_dusk:    { arch:'grove',       mat:'dirt' },
    b_black:   { arch:'shrine',      mat:'obsid' },
    b_bones:   { arch:'camp',        mat:'dirt' },
    b_moon:    { arch:'ruin',        mat:'obsid' },
    b_star:    { arch:'observatory', mat:'slate' },
    b_inn:     { arch:'waystation',  mat:'timber' },
    b_storm:   { arch:'fort',        mat:'slate',  stairX:180 },
    b_green:   { arch:'grove',       mat:'grass' },
    b_moss:    { arch:'grove',       mat:'timber' },
    b_grave:   { arch:'shrine',      mat:'bone' },
    b_mist:    { arch:'observatory', mat:'stone' },
    b_ember:   { arch:'camp',        mat:'ash' },
    b_frost:   { arch:'frostvale',   mat:'snow' },
    b_sun:     { arch:'temple',      mat:'gold' },
    b_void:    { arch:'shrine',      mat:'void_' },
    b_sea:     { arch:'cliffport',   mat:'obsid' },
    b_end:     { arch:'castle',      mat:'slate' },
  };

  // ---------------- 組み立て ----------------
  const cache = {};
  function plan(area, bnd){
    if (cache[area]) return cache[area];
    const isPort = area.startsWith('port:');
    const cfg = isPort ? { arch:'harbor', mat:'timber' } : (TOWN[area] || { arch:'camp', mat:'dirt' });
    const r = rngOf(seedOf(area));
    const p = ARCH[cfg.arch](bnd, r, cfg);
    p.mat = MAT[cfg.mat] || MAT.stone;
    p.arch = cfg.arch;
    p.levels = p.levels || []; p.stairs = p.stairs || []; p.buildings = p.buildings || [];
    p.walls = p.walls || []; p.water = p.water || []; p.roads = p.roads || [];
    // 建物の段は、建っている地面の段に合わせる(食い違うと浮いて見える)
    for (const bd of p.buildings) bd.lv = bd.lv || 0;
    // 壁の矩形をあらかじめ作っておく(毎フレーム作らない)
    for (const bd of p.buildings) bd.rects = wallRects(bd);
    p.bnd = bnd;
    cache[area] = p;
    return p;
  }

  // ---------------- 地形の問い合わせ ----------------
  const inRect = (x, y, r2) => x >= r2.x0 && x <= r2.x1 && y >= r2.y0 && y <= r2.y1;
  function levelAt(p, x, y){
    let lv = 0;
    for (const L of p.levels) if (inRect(x, y, L) && L.lv > lv) lv = L.lv;
    return lv;
  }
  function stairAt(p, x, y){
    for (const s of p.stairs) {
      if (Math.abs(x - s.x) <= s.w / 2 + 2 && Math.abs(y - s.y) <= s.h / 2 + 2) return s;
    }
    return null;
  }
  // 見た目の高さ: 石段の上では踏んだぶんだけ滑らかにせり上がる(上っている感じ)
  function elevAt(p, x, y){
    const s = stairAt(p, x, y);
    if (s) {
      let t;
      if (s.dir === 'n') t = (s.y + s.h / 2 - y) / s.h;
      else if (s.dir === 's') t = (y - (s.y - s.h / 2)) / s.h;
      else if (s.dir === 'w') t = (s.x + s.w / 2 - x) / s.w;
      else t = (x - (s.x - s.w / 2)) / s.w;
      t = Math.max(0, Math.min(1, t));
      return (s.lo + (s.hi - s.lo) * t) * ELEV;
    }
    return levelAt(p, x, y) * ELEV;
  }
  // 通れない矩形すべて(壁・塀・水)
  function solidsOf(p){
    if (p._solids) return p._solids;
    const out = [];
    for (const bd of p.buildings) for (const r2 of bd.rects) out.push(r2);
    for (const w of p.walls) out.push(w);
    for (const w of p.water) if (w.kind === 'pool') out.push(w);
    p._solids = out;
    return out;
  }
  // 円を矩形から押し出す(いちばん浅い辺へ逃がす → 壁沿いに滑る)
  function pushOut(pt, r2, rad){
    const cx = Math.max(r2.x0, Math.min(r2.x1, pt.x));
    const cy = Math.max(r2.y0, Math.min(r2.y1, pt.y));
    const dx = pt.x - cx, dy = pt.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 > rad * rad) return false;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      pt.x = cx + dx / d * rad; pt.y = cy + dy / d * rad;
      return true;
    }
    // 中に入り込んだ: いちばん近い辺へ
    const cand = [[r2.x0 - rad - pt.x, 0], [r2.x1 + rad - pt.x, 0], [0, r2.y0 - rad - pt.y], [0, r2.y1 + rad - pt.y]];
    cand.sort((a, b2) => (Math.abs(a[0]) + Math.abs(a[1])) - (Math.abs(b2[0]) + Math.abs(b2[1])));
    pt.x += cand[0][0]; pt.y += cand[0][1];
    return true;
  }

  // 移動を解決する: 壁で止まり、段差は石段からしか上り下りできない
  function move(p, pt, nx, ny, rad){
    const ox = pt.x, oy = pt.y;
    const lv0 = levelAt(p, ox, oy);
    const tryAxis = (tx, ty) => {
      const t = { x:tx, y:ty };
      // 一度押し出しただけだと、押し出した先がもう一つの壁の中ということがある。
      // 角や路地では、それで壁をすり抜けて建物の中へ入れてしまっていたので、
      // どこにも食い込まなくなるまで繰り返す
      for (let pass = 0; pass < 4; pass++) {
        let moved = false;
        for (const r2 of solidsOf(p)) if (pushOut(t, r2, rad)) moved = true;
        if (!moved) break;
      }
      // 段の乗り換えは石段の上だけ
      const lv1 = levelAt(p, t.x, t.y);
      if (lv1 !== lv0) {
        const st = stairAt(p, t.x, t.y) || stairAt(p, ox, oy);
        if (!st || Math.min(st.lo, st.hi) > Math.min(lv0, lv1) || Math.max(st.lo, st.hi) < Math.max(lv0, lv1)) return null;
      }
      return t;
    };
    let t = tryAxis(nx, ny);
    if (!t) t = tryAxis(nx, oy);      // 横だけ動く(崖沿いに滑る)
    if (!t) t = tryAxis(ox, ny);      // 縦だけ動く
    if (!t) return;
    pt.x = t.x; pt.y = t.y;
  }

  // ---------------- 造作ひとつひとつの絵 ----------------
  // どれも「その施設らしさ」が一目で分かる形。色は街の素材に馴染ませる
  const PROP = {
    dais(g, x, y, m){ g.fillStyle = m.wall; roundRect(g, x - 52, y - 22, 104, 44, 8); g.fill();
      g.fillStyle = m.top; roundRect(g, x - 44, y - 16, 88, 10, 5); g.fill(); },
    hearth(g, x, y, m){ g.fillStyle = '#2b2018'; roundRect(g, x - 34, y - 20, 68, 40, 14); g.fill();
      g.strokeStyle = m.wall; g.lineWidth = 7; roundRect(g, x - 34, y - 20, 68, 40, 14); g.stroke();
      g.fillStyle = '#e0803a'; g.beginPath(); g.ellipse(x, y, 17, 10, 0, 0, 7); g.fill(); },
    bedroll(g, x, y, m){ g.fillStyle = '#6b5a48'; roundRect(g, x - 20, y - 30, 40, 60, 10); g.fill();
      g.fillStyle = '#8e7a62'; roundRect(g, x - 15, y - 25, 30, 24, 8); g.fill(); },
    bed(g, x, y, m){ g.fillStyle = '#4a3826'; roundRect(g, x - 24, y - 34, 48, 68, 6); g.fill();
      g.fillStyle = '#6b5236'; g.fillRect(x - 24, y - 34, 48, 5); g.fillRect(x - 24, y + 29, 48, 5);
      g.fillStyle = '#8a5344'; roundRect(g, x - 19, y - 12, 38, 40, 5); g.fill();
      g.fillStyle = '#a36653'; for (let i = 0; i < 3; i++) g.fillRect(x - 19, y - 8 + i * 12, 38, 4);
      g.fillStyle = '#e6edf3'; roundRect(g, x - 16, y - 28, 32, 15, 5); g.fill(); },
    rubble(g, x, y, m){ g.fillStyle = m.wall;
      for (const [dx, dy, r] of [[-12, 4, 11], [8, -6, 14], [16, 10, 8]]) { g.beginPath(); g.arc(x + dx, y + dy, r, 0, 7); g.fill(); } },
    herbs(g, x, y, m){ g.fillStyle = '#2f4a2c'; roundRect(g, x - 26, y - 18, 52, 36, 6); g.fill();
      g.fillStyle = '#6d9a52';
      for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(x - 18 + i * 9, y - 4 + (i % 2) * 8, 4, 8, 0, 0, 7); g.fill(); } },
    target(g, x, y, m){ for (const [r, c] of [[22, '#d8dee6'], [15, '#c04a3a'], [7, '#d8dee6']]) {
        g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } },
    rope(g, x, y, m){ g.strokeStyle = '#a8905e'; g.lineWidth = 5;
      for (const r of [20, 13, 7]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); } },
    // ---- 立ち上がるもの(高さ26〜46) ----
    shelf(g, x, y, m){ const h = 44; g.fillStyle = '#3b2f22'; g.fillRect(x - 26, y - h, 52, h + 8);
      g.fillStyle = m.top; g.fillRect(x - 26, y - h, 52, 5);
      for (let i = 0; i < 3; i++) { g.fillStyle = '#5b4a33'; g.fillRect(x - 22, y - h + 10 + i * 12, 44, 3);
        for (let k = 0; k < 5; k++) { g.fillStyle = ['#c2704a', '#4a6f9a', '#8a6fae', '#6f9a5a', '#c2a44a'][(i * 5 + k) % 5];
          g.fillRect(x - 21 + k * 8, y - h + 3 + i * 12, 6, 7); } } },
    rack(g, x, y, m){ g.fillStyle = '#3b2f22'; g.fillRect(x - 28, y - 8, 56, 12);
      for (let i = 0; i < 4; i++) { const bx = x - 21 + i * 14;
        g.strokeStyle = '#8b949e'; g.lineWidth = 4; g.beginPath(); g.moveTo(bx, y - 6); g.lineTo(bx + 3, y - 44); g.stroke();
        g.fillStyle = '#c9d1d9'; g.beginPath(); g.arc(bx + 3, y - 46, 4, 0, 7); g.fill(); } },
    anvil(g, x, y, m){ g.fillStyle = '#2f2a26'; g.fillRect(x - 12, y - 16, 24, 18);
      g.fillStyle = '#4a4a52'; roundRect(g, x - 24, y - 30, 48, 16, 4); g.fill();
      g.fillStyle = '#6b6b76'; g.fillRect(x - 24, y - 30, 48, 4);
      g.fillStyle = '#4a4a52'; g.beginPath(); g.moveTo(x - 24, y - 24); g.lineTo(x - 38, y - 22); g.lineTo(x - 24, y - 16); g.fill(); },
    dummy(g, x, y, m){ g.fillStyle = '#5b4a33'; g.fillRect(x - 4, y - 40, 8, 44);
      g.fillStyle = '#8e7a62'; roundRect(g, x - 15, y - 44, 30, 26, 9); g.fill();
      g.fillStyle = '#6b5a48'; g.fillRect(x - 22, y - 36, 44, 6); },
    still(g, x, y, m){ g.fillStyle = '#6b5236'; g.fillRect(x - 20, y - 12, 40, 14);
      g.fillStyle = '#b08b53'; g.beginPath(); g.ellipse(x, y - 22, 15, 13, 0, 0, 7); g.fill();
      g.strokeStyle = '#b08b53'; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 12, y - 30); g.lineTo(x + 24, y - 42); g.stroke();
      g.fillStyle = '#76e3ea'; g.beginPath(); g.arc(x, y - 22, 6, 0, 7); g.fill(); },
    desk(g, x, y, m){ g.fillStyle = '#5b4a33'; roundRect(g, x - 32, y - 24, 64, 26, 4); g.fill();
      g.fillStyle = '#7a6547'; g.fillRect(x - 32, y - 24, 64, 5);
      g.fillStyle = '#e6edf3'; g.fillRect(x - 14, y - 20, 22, 14);
      g.fillStyle = '#3b2f22'; g.fillRect(x - 30, y + 2, 6, 12); g.fillRect(x + 24, y + 2, 6, 12); },
    bench(g, x, y, m){ g.fillStyle = '#5b4a33'; g.fillRect(x - 30, y - 20, 60, 20);
      g.fillStyle = '#7a6547'; g.fillRect(x - 30, y - 20, 60, 5);
      g.fillStyle = '#8b949e'; g.fillRect(x - 20, y - 30, 6, 10); g.fillRect(x + 6, y - 28, 14, 8); },
    table(g, x, y, m){ g.fillStyle = '#5b4a33'; roundRect(g, x - 26, y - 20, 52, 24, 6); g.fill();
      g.fillStyle = '#7a6547'; roundRect(g, x - 26, y - 20, 52, 6, 3); g.fill();
      g.fillStyle = '#c2a44a'; g.beginPath(); g.arc(x, y - 12, 5, 0, 7); g.fill(); },
    crate(g, x, y, m){ g.fillStyle = '#6b5236'; g.fillRect(x - 18, y - 30, 36, 34);
      g.fillStyle = '#8f7048'; g.fillRect(x - 18, y - 30, 36, 5);
      g.strokeStyle = '#3b2f22'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x - 18, y - 14); g.lineTo(x + 18, y - 14); g.stroke(); },
    barrel(g, x, y, m){ g.fillStyle = '#6b5236'; roundRect(g, x - 14, y - 32, 28, 36, 9); g.fill();
      g.fillStyle = '#8f7048'; g.beginPath(); g.ellipse(x, y - 30, 14, 6, 0, 0, 7); g.fill();
      g.strokeStyle = '#3b2f22'; g.lineWidth = 3;
      for (const yy of [-22, -10]) { g.beginPath(); g.moveTo(x - 14, y + yy); g.lineTo(x + 14, y + yy); g.stroke(); } },
    chest(g, x, y, m){ g.fillStyle = '#6b5236'; g.fillRect(x - 22, y - 24, 44, 28);
      g.fillStyle = '#8f7048'; roundRect(g, x - 22, y - 32, 44, 12, 5); g.fill();
      g.fillStyle = '#c2a44a'; g.fillRect(x - 5, y - 26, 10, 12); },
    pot(g, x, y, m){ g.fillStyle = '#5a4a3a'; g.beginPath(); g.ellipse(x, y - 12, 15, 16, 0, 0, 7); g.fill();
      g.fillStyle = '#7a6650'; g.beginPath(); g.ellipse(x, y - 24, 11, 5, 0, 0, 7); g.fill(); },
    banner(g, x, y, m, c){ g.fillStyle = '#3b2f22'; g.fillRect(x - 2, y - 48, 4, 50);
      g.fillStyle = c || '#8a3f36'; g.beginPath();
      g.moveTo(x + 2, y - 48); g.lineTo(x + 26, y - 44); g.lineTo(x + 20, y - 32); g.lineTo(x + 26, y - 20); g.lineTo(x + 2, y - 24); g.fill(); },
    timber(g, x, y, m){ g.fillStyle = '#6b5236';
      for (let i = 0; i < 3; i++) g.fillRect(x - 26, y - 10 - i * 9, 52, 8);
      g.fillStyle = '#8f7048'; for (let i = 0; i < 3; i++) g.fillRect(x - 26, y - 10 - i * 9, 52, 2); },
    shrine(g, x, y, m){ g.fillStyle = m.wall; g.fillRect(x - 26, y - 10, 52, 12);
      g.fillStyle = m.top; g.fillRect(x - 20, y - 34, 40, 24);
      g.fillStyle = m.wall; g.beginPath();
      g.moveTo(x - 30, y - 34); g.lineTo(x, y - 52); g.lineTo(x + 30, y - 34); g.fill();
      g.fillStyle = '#2b2f38'; g.fillRect(x - 8, y - 28, 16, 18); },
    brazier(g, x, y, m, c, t){ g.fillStyle = '#3b3f48'; g.fillRect(x - 4, y - 26, 8, 28);
      g.fillStyle = '#4a4f5a'; roundRect(g, x - 15, y - 36, 30, 14, 5); g.fill();
      const f = 8 + Math.sin((t || 0) * 4 + x) * 3;
      g.fillStyle = 'rgba(240,150,60,.85)'; g.beginPath(); g.ellipse(x, y - 42, 8, f, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,220,140,.55)'; g.beginPath(); g.ellipse(x, y - 40, 4, f * .6, 0, 0, 7); g.fill(); },
    basin(g, x, y, m){ g.fillStyle = m.wall; roundRect(g, x - 20, y - 22, 40, 26, 8); g.fill();
      g.fillStyle = '#2b6fb0'; g.beginPath(); g.ellipse(x, y - 16, 13, 7, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(x - 4, y - 18, 5, 2, 0, 0, 7); g.fill(); },
  };

  // ---------------- 描画 ----------------
  function roundRect(g, x, y, w, h, r){
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  const hash2 = (a, b2) => Math.abs(Math.sin(a * 127.1 + b2 * 311.7) * 43758.5) % 1;

  // 地面: 素材ごとのまだら。段の上は少し明るく、縁に土のこぼれが乗る
  function drawGround(g, p, camX, camY, W, H2, t){
    const m = p.mat, b = p.bnd;
    g.fillStyle = m.g; g.fillRect(0, 0, W, H2);
    const T = 26, x0 = Math.floor(camX / T), y0 = Math.floor(camY / T);
    g.fillStyle = m.g2; g.globalAlpha = .55;
    for (let iy = 0; iy <= Math.ceil(H2 / T) + 1; iy++)
      for (let ix = 0; ix <= Math.ceil(W / T) + 1; ix++) {
        const hh = hash2(x0 + ix, y0 + iy);
        if (hh < 0.62) continue;
        g.fillRect((x0 + ix) * T - camX + 1, (y0 + iy) * T - camY + 1, T - 2, T - 2);
      }
    g.globalAlpha = 1;
    g.save(); g.translate(-camX, -camY);

    // 水(泉・海)
    for (const w of p.water) {
      const rr = w.kind === 'sea' ? 0 : 40;
      g.fillStyle = w.kind === 'sea' ? '#0d2b3d' : '#1a5b7d';
      roundRect(g, w.x0, w.y0, w.x1 - w.x0, w.y1 - w.y0, rr); g.fill();
      g.strokeStyle = 'rgba(230,237,243,.22)'; g.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const wy = w.y0 + 30 + i * ((w.y1 - w.y0) / 6) + Math.sin(t * 1.3 + i) * 5;
        g.beginPath(); g.moveTo(w.x0 + 24 + (i % 3) * 40, wy); g.lineTo(w.x0 + 96 + (i % 3) * 40, wy + 3); g.stroke();
      }
      if (w.kind === 'pool') {   // 石で組んだ縁
        g.strokeStyle = m.wall; g.lineWidth = 13;
        roundRect(g, w.x0, w.y0, w.x1 - w.x0, w.y1 - w.y0, rr); g.stroke();
        g.strokeStyle = m.top; g.lineWidth = 4;
        roundRect(g, w.x0, w.y0, w.x1 - w.x0, w.y1 - w.y0, rr); g.stroke();
      }
    }
    // 渚: 砂の帯と、寄せては返す白い線
    if (p.shore) {
      const sh = p.shore;
      g.fillStyle = '#7a6a48'; g.fillRect(sh.x0, sh.y0, sh.x1 - sh.x0, sh.y1 - sh.y0);
      g.strokeStyle = 'rgba(230,237,243,.34)'; g.lineWidth = 2;
      g.beginPath();
      for (let sy = sh.y0; sy <= sh.y1; sy += 14) {
        const wx = sh.x1 + Math.sin(sy * 0.05 + t * 1.6) * 4;
        if (sy === sh.y0) g.moveTo(wx, sy); else g.lineTo(wx, sy);
      }
      g.stroke();
    }
    // 桟橋(港)
    if (p.pier) {
      const q = p.pier;
      g.fillStyle = '#6b4f2e'; g.fillRect(q.x0, q.y0, q.x1 - q.x0, q.y1 - q.y0);
      g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 2;
      for (let px = q.x0 + 20; px < q.x1; px += 38) { g.beginPath(); g.moveTo(px, q.y0 + 2); g.lineTo(px, q.y1 - 2); g.stroke(); }
    }
    // 道: 踏み固められた帯
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const pass of [{ c:m.wall, w:48 }, { c:m.road, w:40 }]) {
      g.strokeStyle = pass.c; g.lineWidth = pass.w;
      for (const rd of p.roads) {
        g.beginPath(); g.moveTo(rd[0][0], rd[0][1]);
        for (let i = 1; i < rd.length; i++) g.lineTo(rd[i][0], rd[i][1]);
        g.stroke();
      }
    }
    g.lineCap = 'butt';

    // 段: 低いほうから。崖肌(高さぶんの帯)を描いてから天端を乗せる
    const lv = p.levels.slice().sort((a, b2) => a.lv - b2.lv);
    for (const L of lv) {
      const E = L.lv * ELEV, w = L.x1 - L.x0, h = L.y1 - L.y0;
      // 崖肌(南面)
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(L.x0, L.y1 - E, w, E);
      g.fillStyle = 'rgba(255,255,255,.05)';
      for (let sx = L.x0 + 6; sx < L.x1 - 4; sx += 26) g.fillRect(sx, L.y1 - E + 3, 3, E - 6);
      // 天端
      g.fillStyle = m.g2; g.fillRect(L.x0, L.y0 - E, w, h);
      g.fillStyle = 'rgba(255,255,255,.055)'; g.fillRect(L.x0, L.y0 - E, w, h);
      // 縁の明るい線(高さのふち)
      g.fillStyle = m.top; g.fillRect(L.x0, L.y1 - E - 4, w, 4);
      // 東西の肌
      g.fillStyle = 'rgba(0,0,0,.4)';
      g.fillRect(L.x0 - 5, L.y0 - E, 5, h + E); g.fillRect(L.x1, L.y0 - E, 5, h + E);
    }
    // 石段: 踏み面を重ねて奥へ小さくする(上っていくのが見える)
    for (const s of p.stairs) {
      const N = 6, E0 = s.lo * ELEV, E1 = s.hi * ELEV;
      for (let i = 0; i < N; i++) {
        const f = i / N, f2 = (i + 1) / N;
        const e = E0 + (E1 - E0) * f2;
        let x, y, w, h;
        if (s.dir === 'n' || s.dir === 's') {
          const up = s.dir === 'n' ? -1 : 1;
          const sh = s.h / N;
          y = (s.dir === 'n' ? s.y + s.h / 2 - sh * (i + 1) : s.y - s.h / 2 + sh * i) - e;
          const shrink = f * 10;
          x = s.x - s.w / 2 + shrink; w = s.w - shrink * 2; h = sh + 1;
        } else {
          const sw = s.w / N;
          x = (s.dir === 'w' ? s.x + s.w / 2 - sw * (i + 1) : s.x - s.w / 2 + sw * i);
          const shrink = f * 8;
          y = s.y - s.h / 2 + shrink - e; h = s.h - shrink * 2; w = sw + 1;
        }
        g.fillStyle = i % 2 ? 'rgba(0,0,0,.35)' : 'rgba(0,0,0,.2)';
        g.fillRect(x, y + 3, w, h);
        g.fillStyle = i % 2 ? m.road : m.top;
        g.fillRect(x, y, w, h - 2);
      }
    }
    // 建物の中の床(段に合わせて持ち上がる)
    for (const bd of p.buildings) {
      const E = bd.lv * ELEV;
      const ix = bd.x - bd.w/2 + WT, iy = bd.y - bd.h/2 + WT - E, iw = bd.w - WT*2, ih = bd.h - WT*2;
      g.fillStyle = m.fl; g.fillRect(ix, iy, iw, ih);
      g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 1;
      for (let fy = iy + 15; fy < iy + ih; fy += 15) { g.beginPath(); g.moveTo(ix, fy); g.lineTo(ix + iw, fy); g.stroke(); }
      for (let fx = ix + 15; fx < ix + iw; fx += 15) { g.beginPath(); g.moveTo(fx, iy); g.lineTo(fx, iy + ih); g.stroke(); }
      // 軒の影(壁のすぐ内側が暗い ― 屋根の下だと分かる)
      const sh = g.createLinearGradient(0, iy, 0, iy + 26);
      sh.addColorStop(0, 'rgba(0,0,0,.42)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sh; g.fillRect(ix, iy, iw, 26);
      g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(ix, iy, 12, ih); g.fillRect(ix + iw - 12, iy, 12, ih);
      // 戸口の敷居(入口がどこか、床の色で分かる)
      const dw = Math.min(DOOR, (bd.door === 'n' || bd.door === 's' ? bd.w : bd.h) - WT*2 - 8);
      g.fillStyle = m.trim; g.globalAlpha = .5;
      if (bd.door === 's') g.fillRect(bd.x + (bd.doorOff||0) - dw/2, bd.y + bd.h/2 - WT - E, dw, WT);
      else if (bd.door === 'n') g.fillRect(bd.x + (bd.doorOff||0) - dw/2, bd.y - bd.h/2 - E, dw, WT);
      else if (bd.door === 'w') g.fillRect(bd.x - bd.w/2 - E*0, bd.y + (bd.doorOff||0) - dw/2 - E, WT, dw);
      else g.fillRect(bd.x + bd.w/2 - WT, bd.y + (bd.doorOff||0) - dw/2 - E, WT, dw);
      g.globalAlpha = 1;
      // 床に敷く造作(壇・炉床・寝床・薬草棚など)。用途ごとに置くものが違う
      g.save(); g.beginPath(); g.rect(ix, iy, iw, ih); g.clip();
      for (const f of fitsOf(bd)) {
        if (!FLAT[f.k] || !PROP[f.k]) continue;
        PROP[f.k](g, f.x, f.y - E, m, null, t);
      }
      g.restore();
    }
    // 焚き火の跡・灯籠の台・列柱の礎(骨組みごとの地面の飾り)
    if (p.firepit) {
      g.fillStyle = 'rgba(0,0,0,.35)';
      g.beginPath(); g.arc(p.firepit.x, p.firepit.y, p.firepit.r, 0, 7); g.fill();
      g.strokeStyle = m.top; g.lineWidth = 4;
      g.beginPath(); g.arc(p.firepit.x, p.firepit.y, p.firepit.r, 0, 7); g.stroke();
    }
    g.restore();
  }

  // 壁・柱・木など「人と前後する立体物」。y の順に並べて描くための一覧
  function items(p, t){
    if (p._items) return p._items;
    const m = p.mat, out = [];
    // 壁: 地面に足を置き、高さぶん持ち上がった天端と、こちらを向いた腹を描く
    const HGT = 34;
    const wallItem = (r2, lv, roof) => {
      const E = lv * ELEV, L = E + HGT, w = r2.x1 - r2.x0, h = r2.y1 - r2.y0;
      out.push({ sy: r2.y1, draw:(g) => {
        g.fillStyle = 'rgba(0,0,0,.4)';                          // 足元の影
        g.fillRect(r2.x0 + 4, r2.y1 - E - 3, w, 8);
        g.fillStyle = m.wall;                                     // 腹(高さ)
        g.fillRect(r2.x0, r2.y1 - L, w, HGT);
        const gr = g.createLinearGradient(0, r2.y1 - L, 0, r2.y1 - E);
        gr.addColorStop(0, 'rgba(255,255,255,.10)'); gr.addColorStop(1, 'rgba(0,0,0,.42)');
        g.fillStyle = gr; g.fillRect(r2.x0, r2.y1 - L, w, HGT);
        for (let bx = r2.x0 + 4; bx < r2.x1 - 3; bx += 22) {      // 石積み・板張りの目地
          g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(bx, r2.y1 - L + 4, 2, HGT - 8);
        }
        g.fillStyle = roof || m.wall;                             // 天端(屋根)
        g.fillRect(r2.x0, r2.y0 - L, w, h);
        g.fillStyle = m.top;
        g.fillRect(r2.x0, r2.y0 - L, w, 5);                       // 棟の明かり
        g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 2;       // 輪郭(壁として読める)
        g.strokeRect(r2.x0 + 1, r2.y0 - L + 1, w - 2, h + HGT - 2);
      } });
    };
    for (const bd of p.buildings) {
      const use = bd.use || bd.kind;
      for (const r2 of bd.rects) wallItem(r2, bd.lv, ROOF[use] || m.roof);
      // 立ち上がる造作(棚・武器架・金床・幟・火鉢など)は人と前後する
      for (const f of fitsOf(bd)) {
        if (FLAT[f.k] || !PROP[f.k]) continue;
        const E = bd.lv * ELEV;
        const cl = { x: bd.x - bd.w/2 + WT, y: bd.y - bd.h/2 + WT - E, w: bd.w - WT*2, h: bd.h - WT*2 };
        out.push({ sy: f.y, draw:(g) => {
          g.save(); g.beginPath(); g.rect(cl.x, cl.y, cl.w, cl.h); g.clip();
          PROP[f.k](g, f.x, f.y - E, m, null, performance.now() / 1000);
          g.restore();
        } });
      }
      // 戸口の上の看板 ― 外から何の建物か分かる
      const sg = SIGN[use];
      if (sg) {
        const d = { s:[0, 1], n:[0, -1], w:[-1, 0], e:[1, 0] }[bd.door] || [0, 1];
        const sx = bd.x + d[0] * (bd.w / 2 + 16), sy2 = bd.y + d[1] * (bd.h / 2 + 16);
        const E = bd.lv * ELEV;
        out.push({ sy: sy2 + 1, draw:(g) => {
          g.fillStyle = '#3b2f22'; roundRect(g, sx - 21, sy2 - E - 50, 42, 26, 5); g.fill();
          g.fillStyle = ROOF[use] || m.top; roundRect(g, sx - 18, sy2 - E - 47, 36, 20, 4); g.fill();
          g.fillStyle = '#0e1117'; g.font = 'bold 16px sans-serif'; g.textAlign = 'center';
          g.fillText(sg, sx, sy2 - E - 31);
        } });
      }
    }
    for (const w of p.walls) wallItem(w, 0, null);
    for (const c of (p.pillars || [])) out.push({ sy:c[1], draw:(g) => {
      g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(c[0], c[1] + 4, 20, 8, 0, 0, 7); g.fill();
      g.fillStyle = m.wall; g.fillRect(c[0] - 15, c[1] - 84, 30, 88);
      g.fillStyle = m.top; g.fillRect(c[0] - 19, c[1] - 92, 38, 10);
      g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(c[0] + 6, c[1] - 84, 9, 88);
    } });
    // 施設の建物には帳場(カウンター)がある ― 主はその奥に立つ
    for (const bd of p.buildings) {
      if (bd.fac === undefined) continue;
      const E = bd.lv * ELEV;
      const front = { s:[0, 1], n:[0, -1], w:[-1, 0], e:[1, 0] }[bd.door] || [0, 1];
      const cx = bd.slot.x + front[0] * 38, cy = bd.slot.y + front[1] * 38;
      const horiz = front[1] !== 0;
      const w = horiz ? Math.min(bd.w - WT * 2 - 20, 150) : 26;
      const h = horiz ? 26 : Math.min(bd.h - WT * 2 - 20, 130);
      out.push({ sy: cy + h / 2, draw:(g) => {
        g.fillStyle = 'rgba(0,0,0,.4)';
        g.fillRect(cx - w / 2 + 3, cy + h / 2 - E - 2, w, 7);
        g.fillStyle = m.wall; g.fillRect(cx - w / 2, cy - h / 2 - E - 14, w, h + 14);
        g.fillStyle = m.top;  g.fillRect(cx - w / 2, cy - h / 2 - E - 14, w, 5);
        g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 2;
        g.strokeRect(cx - w / 2 + 1, cy - h / 2 - E - 13, w - 2, h + 12);
      } });
    }
    for (const c of (p.trees || [])) out.push({ sy:c[1], draw:(g) => Sprites.draw(g, 'ob_tree', c[0], c[1] - 30, 84) });
    for (const c of (p.lanterns || [])) out.push({ sy:c[1], draw:(g) => {
      g.fillStyle = m.wall; g.fillRect(c[0] - 5, c[1] - 46, 10, 46);
      g.fillStyle = '#f0b849'; g.beginPath(); g.arc(c[0], c[1] - 54, 11, 0, 7); g.fill();
      g.fillStyle = 'rgba(240,184,73,.16)'; g.beginPath(); g.arc(c[0], c[1] - 54, 26, 0, 7); g.fill();
    } });
    p._items = out;
    return out;
  }

  // 焚き火の炎(毎フレーム動く)
  function drawAir(g, p, t){
    if (p.firepit) {
      const f = p.firepit;
      for (let i = 0; i < 6; i++) {
        const a = t * 2.4 + i, hh = 26 + Math.sin(a) * 12;
        g.fillStyle = `rgba(${240 - i * 12},${140 - i * 12},60,${0.5 - i * 0.06})`;
        g.beginPath(); g.ellipse(f.x + Math.sin(a * 1.7) * 9, f.y - hh / 2, 13 - i, hh / 2, 0, 0, 7); g.fill();
      }
    }
  }

  return { plan, MAT, ELEV, WT, DOOR, levelAt, stairAt, elevAt, solidsOf, move, wallRects, inRect,
           drawGround, items, drawAir, FIT, FLAT, ROOF, SIGN, PROP, fitsOf };
})();
