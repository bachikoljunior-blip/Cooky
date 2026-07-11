// =============================================================
// sprites.js - 仮置きスプライト自動生成 + 画像差し替えシステム
//
// すべての絵は ID で管理される(一覧は ASSETS.md 参照)。
// assets/img/manifest.json に ID を列挙し assets/img/<ID>.png を
// 置くと、自動でその画像に差し替わる。無ければコード生成の
// プレースホルダーが使われる。
// =============================================================
'use strict';

const Sprites = (() => {
  const cache = {};   // id -> canvas or Image
  const S = 64;       // 生成キャンバスサイズ

  // ---- 生成定義: id -> {kind, c(基本色), a(差し色), opt} ----
  const DEFS = {
    player:     { kind:'hero',    c:'#58a6ff', a:'#ffd766' },
    boat:       { kind:'boat',    c:'#8b5a2b', a:'#e6edf3' },

    en_slime:   { kind:'blob',    c:'#7ee787', a:'#2ea043' },
    en_bat:     { kind:'flying',  c:'#8b949e', a:'#c9d1d9' },
    en_skel:    { kind:'humanoid',c:'#e6edf3', a:'#8b949e' },
    en_wolf:    { kind:'beast',   c:'#b08968', a:'#6e4c30' },
    en_goblin:  { kind:'humanoid',c:'#57ab5a', a:'#8b5a2b', opt:{bow:true} },
    en_shaman:  { kind:'humanoid',c:'#c084fc', a:'#7ee787', opt:{staff:true} },
    en_crab:    { kind:'crab',    c:'#f0883e', a:'#9aa5b1' },
    en_orc:     { kind:'humanoid',c:'#3fb950', a:'#8b1e24', opt:{big:true} },
    en_golem:   { kind:'golem',   c:'#9aa5b1', a:'#58a6ff' },
    en_wisp:    { kind:'ghost',   c:'#a5d8ff', a:'#ffffff' },
    en_jelly:   { kind:'jellyfish',c:'#d2a8ff',a:'#f778ba' },
    en_shark:   { kind:'fish',    c:'#8b949e', a:'#e6edf3', opt:{fin:true} },
    en_siren:   { kind:'humanoid',c:'#76e3ea', a:'#f778ba', opt:{staff:true} },
    en_lizard:  { kind:'humanoid',c:'#2dd4bf', a:'#116329', opt:{tail:true} },
    en_ogre:    { kind:'humanoid',c:'#d29922', a:'#8b1e24', opt:{big:true} },
    en_knight:  { kind:'armor',   c:'#484f58', a:'#f85149' },
    en_necro:   { kind:'ghost',   c:'#6e40c9', a:'#7ee787', opt:{hood:true} },
    en_serpent: { kind:'serpent', c:'#1f6feb', a:'#76e3ea' },
    en_whelp:   { kind:'dragon',  c:'#2dd4bf', a:'#ffd766' },
    en_dragon:  { kind:'dragon',  c:'#f85149', a:'#ffd766', opt:{big:true} },
    en_demon:   { kind:'demon',   c:'#da3633', a:'#ffa657' },
    en_abyss:   { kind:'demon',   c:'#6e40c9', a:'#76e3ea', opt:{big:true} },
    en_reaper:  { kind:'reaper',  c:'#0d1117', a:'#f85149' },

    boss_golem: { kind:'golem',   c:'#d29922', a:'#f85149', opt:{big:true} },
    boss_fenrir:{ kind:'beast',   c:'#484f58', a:'#f85149', opt:{big:true} },
    boss_lich:  { kind:'ghost',   c:'#3fb950', a:'#c084fc', opt:{hood:true,big:true} },
    boss_levia: { kind:'serpent', c:'#0d419d', a:'#f778ba', opt:{big:true} },
    boss_demon: { kind:'demon',   c:'#8b1e24', a:'#ffd766', opt:{big:true} },

    ob_tree:    { kind:'tree',    c:'#2ea043', a:'#8b5a2b' },
    ob_rock:    { kind:'rock',    c:'#8b949e', a:'#484f58' },
    ob_crate:   { kind:'crate',   c:'#b08968', a:'#6e4c30' },
    ob_wreck:   { kind:'wreck',   c:'#6e4c30', a:'#9aa5b1' },
    ob_coral:   { kind:'coralob', c:'#ff8fa3', a:'#f778ba' },
    ob_flag:    { kind:'flag',    c:'#58a6ff', a:'#e6edf3' },
    ob_dock:    { kind:'dock',    c:'#8b5a2b', a:'#e6edf3' },

    coin:       { kind:'coin',    c:'#ffd766', a:'#d29922' },
    potion:     { kind:'potion',  c:'#f85149', a:'#e6edf3' },

    st_altar:   { kind:'building',c:'#f0883e', a:'#ffd766', opt:{sym:'⚔'} },
    st_lab:     { kind:'building',c:'#3fb950', a:'#7ee787', opt:{sym:'⚗'} },
    st_camp:    { kind:'building',c:'#58a6ff', a:'#a5d8ff', opt:{sym:'🏕'} },
    st_lib:     { kind:'building',c:'#c084fc', a:'#d2a8ff', opt:{sym:'📖'} },
    st_gate:    { kind:'gate',    c:'#ffd766', a:'#f0883e' },
    st_warp:    { kind:'gate',    c:'#76e3ea', a:'#1f6feb' },

    sk_bolt:    { kind:'icon', c:'#58a6ff', a:'#a5d8ff', opt:{sym:'●' } },
    sk_homing:  { kind:'icon', c:'#f0883e', a:'#ffd766', opt:{sym:'➤' } },
    sk_orbit:   { kind:'icon', c:'#c084fc', a:'#d2a8ff', opt:{sym:'◎' } },
    sk_chain:   { kind:'icon', c:'#ffd766', a:'#fff8c5', opt:{sym:'⚡' } },
    sk_flame:   { kind:'icon', c:'#f85149', a:'#ffa657', opt:{sym:'✹' } },
    sk_nova:    { kind:'icon', c:'#76e3ea', a:'#a5d8ff', opt:{sym:'❄' } },
    sk_poison:  { kind:'icon', c:'#7ee787', a:'#2ea043', opt:{sym:'☁' } },
    sk_axe:     { kind:'icon', c:'#9aa5b1', a:'#e6edf3', opt:{sym:'⛏' } },
    sk_thunder: { kind:'icon', c:'#fde047', a:'#ffffff', opt:{sym:'⚡' } },
    sk_turret:  { kind:'icon', c:'#8b949e', a:'#58a6ff', opt:{sym:'⌖' } },
    sk_shield:  { kind:'icon', c:'#58a6ff', a:'#e6edf3', opt:{sym:'⛨' } },
    sk_sanct:   { kind:'icon', c:'#3fb950', a:'#7ee787', opt:{sym:'✚' } },
    sk_magnet:  { kind:'icon', c:'#f778ba', a:'#ffd6a5', opt:{sym:'U' } },
    sk_boots:   { kind:'icon', c:'#b08968', a:'#ffd766', opt:{sym:'♞' } },
    sk_banner:  { kind:'icon', c:'#da3633', a:'#ffd766', opt:{sym:'⚑' } },
    sk_laser:   { kind:'icon', c:'#d2a8ff', a:'#ffffff', opt:{sym:'≡' } },
    sk_meteor:  { kind:'icon', c:'#f0883e', a:'#f85149', opt:{sym:'☄' } },
    sk_sands:   { kind:'icon', c:'#d29922', a:'#fde047', opt:{sym:'⌛' } },
    sk_breath:  { kind:'icon', c:'#2dd4bf', a:'#f85149', opt:{sym:'〰' } },
  };
  // 素材ピックアップ: mat_<id>
  for (const m in DATA.MATERIALS) {
    DEFS['mat_' + m] = { kind:'gem', c:DATA.MATERIALS[m].color, a:'#ffffff' };
  }

  // ---- 形状ペインタ ----
  function painter(g, d){
    const c=d.c, a=d.a, o=d.opt||{}, M=S/2;
    const big = o.big?1.25:1;
    g.save(); g.translate(M,M); g.scale(big,big);
    const eye=(x,y,r=3)=>{ g.fillStyle='#0d1117'; g.beginPath(); g.arc(x,y,r,0,7); g.fill();
      g.fillStyle='#fff'; g.beginPath(); g.arc(x-1,y-1,r*0.35,0,7); g.fill(); };
    switch(d.kind){
      case 'hero':
        g.fillStyle=c; rr(g,-10,-6,20,22,6);                       // 体
        g.fillStyle='#ffe0bd'; g.beginPath(); g.arc(0,-13,9,0,7); g.fill(); // 顔
        g.fillStyle=a; rr(g,-10,-24,20,8,4);                       // 帽子
        eye(-3,-13); eye(3,-13);
        g.fillStyle=a; rr(g,10,-4,4,14,2); break;                  // 杖
      case 'blob':
        g.fillStyle=c; g.beginPath(); g.ellipse(0,4,16,13,0,0,7); g.fill();
        g.fillStyle=a; g.beginPath(); g.ellipse(0,7,11,7,0,0,7); g.fill();
        eye(-5,0); eye(5,0); break;
      case 'flying':
        g.fillStyle=c;
        g.beginPath(); g.moveTo(0,0); g.lineTo(-20,-8); g.lineTo(-12,4); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(0,0); g.lineTo(20,-8); g.lineTo(12,4); g.closePath(); g.fill();
        g.fillStyle=a; g.beginPath(); g.arc(0,0,8,0,7); g.fill(); eye(-3,-1,2); eye(3,-1,2); break;
      case 'humanoid':
        g.fillStyle=c; rr(g,-9,-4,18,20,5);
        g.beginPath(); g.arc(0,-12,8,0,7); g.fill();
        eye(-3,-12,2.4); eye(3,-12,2.4);
        if(o.staff){ g.strokeStyle=a; g.lineWidth=3; g.beginPath(); g.moveTo(12,-20); g.lineTo(12,10); g.stroke();
          g.fillStyle=a; g.beginPath(); g.arc(12,-20,4,0,7); g.fill(); }
        if(o.bow){ g.strokeStyle=a; g.lineWidth=2.5; g.beginPath(); g.arc(13,-2,9,-1.2,1.2); g.stroke(); }
        if(o.tail){ g.strokeStyle=c; g.lineWidth=5; g.beginPath(); g.moveTo(-8,12); g.quadraticCurveTo(-20,14,-18,4); g.stroke(); }
        break;
      case 'beast':
        g.fillStyle=c; g.beginPath(); g.ellipse(0,2,17,10,0,0,7); g.fill();
        g.beginPath(); g.arc(12,-6,8,0,7); g.fill();
        g.beginPath(); g.moveTo(8,-12); g.lineTo(11,-19); g.lineTo(14,-12); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(13,-12); g.lineTo(16,-19); g.lineTo(19,-12); g.closePath(); g.fill();
        g.fillStyle=a; g.beginPath(); g.ellipse(-4,3,9,5,0,0,7); g.fill();
        eye(13,-7,2.2); break;
      case 'crab':
        g.fillStyle=c; g.beginPath(); g.ellipse(0,2,15,10,0,0,7); g.fill();
        g.strokeStyle=c; g.lineWidth=3;
        for(const s of[-1,1]){ g.beginPath(); g.moveTo(10*s,6); g.lineTo(18*s,12); g.stroke();
          g.beginPath(); g.moveTo(12*s,0); g.lineTo(20*s,2); g.stroke();
          g.fillStyle=a; g.beginPath(); g.arc(16*s,-8,5,0,7); g.fill(); g.fillStyle=c; }
        eye(-4,-2,2.4); eye(4,-2,2.4); break;
      case 'golem':
        g.fillStyle=c; rr(g,-14,-14,28,28,6);
        g.fillStyle=a; rr(g,-8,-6,6,6,2); rr(g,2,-6,6,6,2);
        g.fillStyle='#0d1117'; rr(g,-6,6,12,4,2); break;
      case 'ghost':
        g.fillStyle=c; g.beginPath(); g.arc(0,-4,13,Math.PI,0);
        g.lineTo(13,12); g.lineTo(8,7); g.lineTo(3,12); g.lineTo(-3,7); g.lineTo(-8,12); g.lineTo(-13,7);
        g.closePath(); g.fill();
        if(o.hood){ g.fillStyle='#0d1117'; g.beginPath(); g.arc(0,-5,8,0,7); g.fill(); }
        g.fillStyle=a; g.beginPath(); g.arc(-4,-5,2.5,0,7); g.arc(5,-5,2.5,0,7); g.fill(); break;
      case 'jellyfish':
        g.fillStyle=c; g.beginPath(); g.arc(0,-3,13,Math.PI,0); g.closePath(); g.fill();
        g.strokeStyle=a; g.lineWidth=2.5;
        for(let i=-2;i<=2;i++){ g.beginPath(); g.moveTo(i*5,-2); g.quadraticCurveTo(i*5+3,8,i*5,15); g.stroke(); }
        eye(-4,-6,2); eye(4,-6,2); break;
      case 'fish':
        g.fillStyle=c; g.beginPath(); g.ellipse(0,0,17,9,0,0,7); g.fill();
        g.beginPath(); g.moveTo(-14,0); g.lineTo(-23,-8); g.lineTo(-23,8); g.closePath(); g.fill();
        if(o.fin){ g.beginPath(); g.moveTo(0,-7); g.lineTo(5,-17); g.lineTo(9,-7); g.closePath(); g.fill(); }
        g.fillStyle=a; g.beginPath(); g.moveTo(14,2); g.lineTo(8,6); g.lineTo(14,6); g.closePath(); g.fill();
        eye(10,-3,2.4); break;
      case 'serpent':
        g.strokeStyle=c; g.lineWidth=9; g.lineCap='round';
        g.beginPath(); g.moveTo(-18,10); g.quadraticCurveTo(-8,-14,2,2); g.quadraticCurveTo(10,14,16,-6); g.stroke();
        g.fillStyle=c; g.beginPath(); g.arc(16,-8,8,0,7); g.fill();
        g.fillStyle=a; g.beginPath(); g.moveTo(-16,12); g.lineTo(-24,18); g.lineTo(-14,18); g.closePath(); g.fill();
        eye(18,-10,2.2); break;
      case 'dragon':
        g.fillStyle=c; g.beginPath(); g.ellipse(0,2,14,11,0,0,7); g.fill();
        g.beginPath(); g.moveTo(-4,-6); g.lineTo(-18,-18); g.lineTo(-2,-12); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(4,-6); g.lineTo(18,-18); g.lineTo(2,-12); g.closePath(); g.fill();
        g.fillStyle=a; g.beginPath(); g.arc(0,-8,7,0,7); g.fill();
        g.fillStyle=c; g.beginPath(); g.moveTo(-3,-13); g.lineTo(0,-20); g.lineTo(3,-13); g.closePath(); g.fill();
        eye(-3,-8,2); eye(3,-8,2); break;
      case 'demon':
        g.fillStyle=c; rr(g,-11,-8,22,24,6);
        g.beginPath(); g.moveTo(-9,-8); g.lineTo(-15,-20); g.lineTo(-4,-12); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(9,-8); g.lineTo(15,-20); g.lineTo(4,-12); g.closePath(); g.fill();
        g.fillStyle=a; g.beginPath(); g.arc(-4,-2,3,0,7); g.arc(5,-2,3,0,7); g.fill();
        g.strokeStyle=a; g.lineWidth=2; g.beginPath(); g.moveTo(-5,8); g.lineTo(5,8); g.stroke(); break;
      case 'reaper':
        g.fillStyle=c; g.strokeStyle=a; g.lineWidth=2;
        g.beginPath(); g.arc(0,-4,13,Math.PI,0); g.lineTo(13,14); g.lineTo(-13,14); g.closePath(); g.fill(); g.stroke();
        g.fillStyle=a; g.beginPath(); g.arc(-4,-5,3,0,7); g.arc(5,-5,3,0,7); g.fill();
        g.strokeStyle='#e6edf3'; g.lineWidth=3; g.beginPath(); g.moveTo(14,-22); g.lineTo(14,12); g.stroke();
        g.beginPath(); g.moveTo(14,-22); g.quadraticCurveTo(0,-26,-4,-18); g.stroke(); break;
      case 'boat':
        g.fillStyle=c; g.beginPath(); g.moveTo(-20,2); g.lineTo(20,2); g.lineTo(12,14); g.lineTo(-12,14); g.closePath(); g.fill();
        g.strokeStyle=c; g.lineWidth=3; g.beginPath(); g.moveTo(0,2); g.lineTo(0,-20); g.stroke();
        g.fillStyle=a; g.beginPath(); g.moveTo(0,-20); g.lineTo(16,-8); g.lineTo(0,-8); g.closePath(); g.fill(); break;
      case 'tree':
        g.fillStyle=a; rr(g,-4,2,8,16,2);
        g.fillStyle=c; g.beginPath(); g.arc(0,-8,14,0,7); g.fill();
        g.beginPath(); g.arc(-9,0,9,0,7); g.fill(); g.beginPath(); g.arc(9,0,9,0,7); g.fill(); break;
      case 'rock':
        g.fillStyle=c; g.beginPath(); g.moveTo(-14,12); g.lineTo(-10,-6); g.lineTo(0,-13); g.lineTo(12,-4); g.lineTo(14,12); g.closePath(); g.fill();
        g.fillStyle=a; g.beginPath(); g.moveTo(-2,-10); g.lineTo(6,-4); g.lineTo(0,2); g.closePath(); g.fill(); break;
      case 'crate':
        g.fillStyle=c; rr(g,-13,-13,26,26,3);
        g.strokeStyle=a; g.lineWidth=3; g.strokeRect(-13,-13,26,26);
        g.beginPath(); g.moveTo(-13,-13); g.lineTo(13,13); g.moveTo(13,-13); g.lineTo(-13,13); g.stroke(); break;
      case 'wreck':
        g.fillStyle=c; g.beginPath(); g.moveTo(-18,6); g.lineTo(14,2); g.lineTo(8,14); g.lineTo(-12,14); g.closePath(); g.fill();
        g.strokeStyle=a; g.lineWidth=3; g.beginPath(); g.moveTo(-2,4); g.lineTo(6,-16); g.stroke();
        g.beginPath(); g.moveTo(-10,4); g.lineTo(-16,-8); g.stroke(); break;
      case 'coralob':
        g.strokeStyle=c; g.lineWidth=5; g.lineCap='round';
        g.beginPath(); g.moveTo(0,14); g.lineTo(0,-2); g.moveTo(0,4); g.lineTo(-9,-8); g.moveTo(0,2); g.lineTo(9,-10); g.stroke();
        g.fillStyle=a; g.beginPath(); g.arc(-9,-9,3,0,7); g.arc(9,-11,3,0,7); g.arc(0,-4,3,0,7); g.fill(); break;
      case 'flag':
        g.strokeStyle=a; g.lineWidth=3; g.beginPath(); g.moveTo(-4,16); g.lineTo(-4,-18); g.stroke();
        g.fillStyle=c; g.beginPath(); g.moveTo(-4,-18); g.lineTo(14,-12); g.lineTo(-4,-6); g.closePath(); g.fill(); break;
      case 'dock':
        g.fillStyle=c; rr(g,-16,-4,32,10,2);
        g.fillStyle=a; rr(g,-14,-2,4,6,1); rr(g,-2,-2,4,6,1); rr(g,10,-2,4,6,1);
        g.strokeStyle=c; g.lineWidth=3; g.beginPath(); g.moveTo(-12,6); g.lineTo(-12,16); g.moveTo(12,6); g.lineTo(12,16); g.stroke(); break;
      case 'coin':
        g.fillStyle=c; g.beginPath(); g.arc(0,0,10,0,7); g.fill();
        g.strokeStyle=a; g.lineWidth=2; g.beginPath(); g.arc(0,0,7,0,7); g.stroke(); break;
      case 'potion':
        g.fillStyle=a; rr(g,-3,-14,6,6,1);
        g.fillStyle=c; g.beginPath(); g.arc(0,2,9,0,7); g.fill(); rr(g,-3,-9,6,8,1); break;
      case 'gem':
        g.fillStyle=c; g.beginPath(); g.moveTo(0,-11); g.lineTo(9,0); g.lineTo(0,11); g.lineTo(-9,0); g.closePath(); g.fill();
        g.fillStyle='rgba(255,255,255,.55)'; g.beginPath(); g.moveTo(0,-11); g.lineTo(9,0); g.lineTo(0,0); g.closePath(); g.fill(); break;
      case 'building':
        g.fillStyle=c; rr(g,-18,-8,36,24,4);
        g.beginPath(); g.moveTo(-22,-8); g.lineTo(0,-24); g.lineTo(22,-8); g.closePath(); g.fill();
        g.fillStyle='#0d1117'; rr(g,-6,2,12,14,3);
        g.fillStyle=a; g.font='12px sans-serif'; g.textAlign='center'; g.fillText(o.sym||'?',0,-10); break;
      case 'gate':
        g.strokeStyle=c; g.lineWidth=5;
        g.beginPath(); g.ellipse(0,0,13,19,0,0,7); g.stroke();
        g.fillStyle=a; g.globalAlpha=.5; g.beginPath(); g.ellipse(0,0,9,15,0,0,7); g.fill(); g.globalAlpha=1; break;
      case 'icon':
        g.fillStyle='#161b22'; rr(g,-22,-22,44,44,10);
        g.strokeStyle=c; g.lineWidth=3; strokeRR(g,-22,-22,44,44,10);
        g.fillStyle=a; g.font='bold 24px sans-serif'; g.textAlign='center'; g.textBaseline='middle';
        g.fillText(o.sym||'?',0,1); break;
      default:
        g.fillStyle=c; g.beginPath(); g.arc(0,0,14,0,7); g.fill();
    }
    g.restore();
  }
  function rr(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); g.fill(); }
  function strokeRR(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); g.stroke(); }

  function gen(id){
    const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const g = cv.getContext('2d');
    painter(g, DEFS[id] || { kind:'?', c:'#f0f', a:'#fff' });
    return cv;
  }

  function get(id){
    if (!cache[id]) cache[id] = gen(id);
    return cache[id];
  }

  // 画像差し替え: assets/img/manifest.json = ["player","en_slime",...]
  async function loadOverrides(){
    try {
      const res = await fetch('assets/img/manifest.json');
      if (!res.ok) return;
      const list = await res.json();
      for (const id of list) {
        const img = new Image();
        img.src = 'assets/img/' + id + '.png';
        img.onload = () => { cache[id] = img; };
      }
    } catch(e) { /* マニフェスト無し = 全部プレースホルダー */ }
  }

  // 描画ヘルパ: 中心(x,y)にサイズsizeで描く(向きflip対応)
  function draw(g, id, x, y, size, flip){
    const im = get(id);
    g.save(); g.translate(x, y);
    if (flip) g.scale(-1, 1);
    g.drawImage(im, -size/2, -size/2, size, size);
    g.restore();
  }

  return { get, draw, loadOverrides, DEFS };
})();
