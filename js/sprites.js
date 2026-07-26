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
    en_skel:    { kind:'undead',  c:'#e6edf3', a:'#8b949e', opt:{bones:true} },
    en_wolf:    { kind:'beast',   c:'#b08968', a:'#6e4c30' },
    en_goblin:  { kind:'caster',  c:'#57ab5a', a:'#8b5a2b', opt:{bow:true} },
    en_shaman:  { kind:'caster',  c:'#c084fc', a:'#7ee787', opt:{staff:true,skullstaff:true} },
    en_crab:    { kind:'crab',    c:'#f0883e', a:'#9aa5b1' },
    en_orc:     { kind:'brute',   c:'#3fb950', a:'#8b1e24', opt:{big:true,tusk:true} },
    en_golem:   { kind:'golem',   c:'#9aa5b1', a:'#58a6ff' },
    en_wisp:    { kind:'ghost',   c:'#a5d8ff', a:'#ffffff' },
    en_jelly:   { kind:'jellyfish',c:'#d2a8ff',a:'#f778ba' },
    en_shark:   { kind:'fish',    c:'#8b949e', a:'#e6edf3', opt:{fin:true} },
    en_siren:   { kind:'caster',  c:'#76e3ea', a:'#f778ba', opt:{staff:true,fintail:true} },
    en_lizard:  { kind:'saurian', c:'#2dd4bf', a:'#116329', opt:{} },
    en_ogre:    { kind:'brute',   c:'#d29922', a:'#8b1e24', opt:{big:true,oneeye:true} },
    en_knight:  { kind:'armor',   c:'#484f58', a:'#f85149' },
    en_necro:   { kind:'caster',  c:'#6e40c9', a:'#7ee787', opt:{staff:true,skullstaff:true,hood:true} },
    en_serpent: { kind:'serpent', c:'#1f6feb', a:'#76e3ea' },
    en_whelp:   { kind:'dragon',  c:'#2dd4bf', a:'#ffd766' },
    en_dragon:  { kind:'dragon',  c:'#f85149', a:'#ffd766', opt:{big:true} },
    en_demon:   { kind:'demon',   c:'#da3633', a:'#ffa657' },
    en_abyss:   { kind:'demon',   c:'#6e40c9', a:'#76e3ea', opt:{big:true,abyss:true} },
    en_reaper:  { kind:'reaper',  c:'#0d1117', a:'#f85149' },
    en_rainbow: { kind:'rainbowblob', c:'#e879f9', a:'#fde047' },
    // --- バイオドーム別の敵(既存kindを配色替えして種類を増やす) ---
    en_boar:     { kind:'beast',    c:'#8b5a2b', a:'#5a3a1b', opt:{big:true,boar:true} },
    en_mush:     { kind:'blob',     c:'#f0883e', a:'#7ee787', opt:{mush:true} },
    en_iceslime: { kind:'blob',     c:'#a5d8ff', a:'#58a6ff', opt:{icy:true} },
    en_frostwolf:{ kind:'beast',    c:'#cbe6f0', a:'#5a7585', opt:{frost:true} },
    en_yeti:     { kind:'brute',    c:'#e6edf3', a:'#8fa8b5', opt:{big:true,fur:true} },
    en_icewisp:  { kind:'ghost',    c:'#a5d8ff', a:'#ffffff', opt:{icy:true} },
    en_lavaslime:{ kind:'blob',     c:'#ff6b35', a:'#8b1e24', opt:{lava:true} },
    en_emberbat: { kind:'flying',   c:'#f85149', a:'#ffa657', opt:{ember:true} },
    en_fireimp:  { kind:'demon',    c:'#ff6b35', a:'#ffd766', opt:{imp:true} },
    en_magmagolem:{kind:'golem',    c:'#733220', a:'#ff6b35', opt:{crack:true} },
    en_scarab:   { kind:'crab',     c:'#d29922', a:'#8a6d35', opt:{scarab:true} },
    en_mummy:    { kind:'undead',   c:'#b8b098', a:'#8a6d35', opt:{wrap:true} },
    en_sandwurm: { kind:'serpent',  c:'#b09252', a:'#d29922', opt:{wurm:true} },
    en_shade:    { kind:'ghost',    c:'#6e40c9', a:'#c084fc', opt:{hood:true,tatter:true} },
    en_voidwisp: { kind:'ghost',    c:'#a78bfa', a:'#76e3ea', opt:{voidEye:true} },
    en_hornedimp:{ kind:'demon',    c:'#8b1e24', a:'#c084fc', opt:{bighorn:true} },
    en_stormwisp:{ kind:'ghost',    c:'#fde047', a:'#8b949e', opt:{bolt:true} },
    en_galehound:{ kind:'beast',    c:'#8b949e', a:'#76e3ea', opt:{gale:true} },
    en_kingslime: { kind:'blob',     c:'#2ea043', a:'#7ee787', opt:{king:true} },
    en_frostgiant:{ kind:'brute',    c:'#a5d8ff', a:'#5a7585', opt:{big:true,icicle:true} },
    en_magmatitan:{ kind:'golem',    c:'#8b1e24', a:'#ff6b35', opt:{arms:true} },
    en_voidtitan: { kind:'golem',    c:'#2d1b4e', a:'#a78bfa', opt:{shards:true} },

    boss_golem: { kind:'golem',   c:'#d29922', a:'#f85149', opt:{big:true} },
    boss_fenrir:{ kind:'beast',   c:'#484f58', a:'#f85149', opt:{big:true} },
    boss_lich:  { kind:'ghost',   c:'#3fb950', a:'#c084fc', opt:{hood:true,big:true} },
    boss_levia: { kind:'serpent', c:'#0d419d', a:'#f778ba', opt:{big:true} },
    boss_demon: { kind:'demon',   c:'#8b1e24', a:'#ffd766', opt:{big:true} },

    ob_tree:    { kind:'tree',    c:'#2ea043', a:'#8b5a2b' },
    ob_tree_dry: { kind:'drytree', c:'#8a6d4a', a:'#5a4632' },
    ob_tree_snow:{ kind:'tree',    c:'#dfe9f0', a:'#6e5c48', opt:{snow:true} },
    ob_rock:    { kind:'rock',    c:'#8b949e', a:'#484f58' },
    ob_crate:   { kind:'crate',   c:'#b08968', a:'#6e4c30' },
    ob_wreck:   { kind:'wreck',   c:'#6e4c30', a:'#9aa5b1' },
    ob_coral:   { kind:'coralob', c:'#ff8fa3', a:'#f778ba' },
    ob_goldtree:{ kind:'tree',    c:'#f59e0b', a:'#92600a', opt:{gold:true} },
    ob_pearl:   { kind:'pearlobj',c:'#f1f5f9', a:'#ffd6a5' },
    ob_flag:    { kind:'flag',    c:'#58a6ff', a:'#e6edf3' },
    ob_dock:    { kind:'dock',    c:'#8b5a2b', a:'#e6edf3' },

    coin:       { kind:'coin',    c:'#ffd766', a:'#d29922' },
    potion:     { kind:'potion',  c:'#f85149', a:'#e6edf3' },

    npc_elder:  { kind:'humanoid',c:'#8b949e', a:'#e6edf3', opt:{staff:true,beard:true} },
    npc_smith:  { kind:'humanoid',c:'#f0883e', a:'#6e4c30', opt:{big:true,apron:true} },
    npc_miko:   { kind:'humanoid',c:'#f1f5f9', a:'#f85149', opt:{staff:true,miko:true} },
    npc_sailor: { kind:'humanoid',c:'#1f6feb', a:'#e6edf3', opt:{cap:true} },
    npc_sage:   { kind:'ghost',   c:'#6e40c9', a:'#d2a8ff', opt:{hood:true,lamp:true} },
    npc_scholar:{ kind:'humanoid',c:'#3fb950', a:'#a5d8ff', opt:{specs:true} },
    npc_girl:   { kind:'humanoid',c:'#f778ba', a:'#ffd6a5', opt:{braid:true} },
    npc_boy:    { kind:'humanoid',c:'#57ab5a', a:'#a5d8ff', opt:{tuft:true} },
    npc_mapper: { kind:'humanoid',c:'#d29922', a:'#e6edf3', opt:{staff:true,scroll:true} },
    npc_miner:  { kind:'humanoid',c:'#8b5a2b', a:'#9aa5b1', opt:{big:true,helm:true} },
    // 基地の転移シンボル(集落の特色に合わせた建造物)
    base_fort:    { kind:'settlement', c:'#9aa5b1', a:'#58a6ff', opt:{v:'fort'} },
    base_academy: { kind:'settlement', c:'#e6d9b8', a:'#3fb950', opt:{v:'academy'} },
    base_spring:  { kind:'settlement', c:'#8fa8b5', a:'#76e3ea', opt:{v:'spring'} },
    base_forge:   { kind:'settlement', c:'#6e4c30', a:'#ff6b35', opt:{v:'forge'} },
    base_lodge:   { kind:'settlement', c:'#b08968', a:'#e6edf3', opt:{v:'lodge'} },
    base_camp:    { kind:'settlement', c:'#8f8a78', a:'#e6edf3', opt:{v:'camp'} },
    base_poet:    { kind:'settlement', c:'#5c4a5e', a:'#f778ba', opt:{v:'hut'} },
    base_hermit:  { kind:'settlement', c:'#33244a', a:'#a78bfa', opt:{v:'hermit'} },
    base_star:    { kind:'settlement', c:'#3a4468', a:'#a5d8ff', opt:{v:'observatory'} },
    base_mist:    { kind:'settlement', c:'#6e7a6a', a:'#a5d8ff', opt:{v:'mistobs'} },
    base_grove:   { kind:'settlement', c:'#2ea043', a:'#7ee787', opt:{v:'grove'} },
    base_port:    { kind:'settlement', c:'#e6edf3', a:'#f85149', opt:{v:'lighthouse'} },
    base_shrine:  { kind:'settlement', c:'#484f58', a:'#2dd4bf', opt:{v:'abbey'} },
    base_frost:   { kind:'settlement', c:'#8fa8b5', a:'#a5d8ff', opt:{v:'frostshrine'} },
    base_ember:   { kind:'settlement', c:'#5c3a28', a:'#ff6b35', opt:{v:'emberforge'} },
    base_factory: { kind:'settlement', c:'#484f58', a:'#fde047', opt:{v:'factory'} },
    base_abbey:   { kind:'settlement', c:'#3a4468', a:'#f1f5f9', opt:{v:'abbeytower'} },
    base_tower:   { kind:'settlement', c:'#5a655c', a:'#9aa5b1', opt:{v:'tower'} },
    base_grave:   { kind:'settlement', c:'#8b949e', a:'#ffd766', opt:{v:'grave'} },
    base_temple:  { kind:'settlement', c:'#a8894a', a:'#ffd766', opt:{v:'temple'} },
    base_portal:  { kind:'settlement', c:'#6e40c9', a:'#76e3ea', opt:{v:'portal'} },
    base_castle:  { kind:'settlement', c:'#54242c', a:'#ffd766', opt:{v:'castle'} },
    base_spa:     { kind:'settlement', c:'#7fd1c9', a:'#9be3db', opt:{v:'spa'} },
    base_sunken:  { kind:'settlement', c:'#2dd4bf', a:'#76e3ea', opt:{v:'sunken'} },
    ob_house:   { kind:'building',c:'#8b5a2b', a:'#e6edf3' },
    ob_house2:  { kind:'building',c:'#6e7681', a:'#ffd766', opt:{row:true} },
    ob_well:    { kind:'building',c:'#8fa8b5', a:'#76e3ea', opt:{well:true} },
    // 広場の施設は「その施設にしか見えない」専用の造形(祭壇・研究小屋・宿営・書庫塔・鍛冶場)
    st_altar:   { kind:'altarb',  c:'#9aa5b1', a:'#ffd766' },
    st_lab:     { kind:'labb',    c:'#3fb950', a:'#7ee787' },
    st_camp:    { kind:'campb',   c:'#58a6ff', a:'#a5d8ff' },
    st_lib:     { kind:'libb',    c:'#c084fc', a:'#d2a8ff' },
    st_armory:  { kind:'armoryb', c:'#8b949e', a:'#f85149' },
    st_stone:   { kind:'steleb',  c:'#768390', a:'#76e3ea' },
    st_board:   { kind:'boardk',  c:'#6e4c30', a:'#e6d2b5' },
    // 基地の特別強化施設も専用の造形(武練場・生命の祠・秘宝の蔵)
    st_war:     { kind:'warb',  c:'#da3633', a:'#ffb3ad' },
    st_life:    { kind:'lifeb', c:'#2ea043', a:'#7ee787' },
    st_lore:    { kind:'loreb', c:'#d29922', a:'#ffd766' },
    st_gate:    { kind:'gate',    c:'#ffd766', a:'#f0883e' },
    st_warp:    { kind:'gate',    c:'#76e3ea', a:'#1f6feb', opt:{warp:true} },

    sk_bolt:    { kind:'icon', c:'#58a6ff', a:'#a5d8ff', opt:{sym:'●' } },
    sk_homing:  { kind:'icon', c:'#f0883e', a:'#ffd766', opt:{sym:'➤' } },
    sk_orbit:   { kind:'icon', c:'#c084fc', a:'#d2a8ff', opt:{sym:'◎' } },
    sk_chain:   { kind:'icon', c:'#ffd766', a:'#fff8c5', opt:{sym:'⛓' } },
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
    sk_charisma:{ kind:'icon', c:'#f778ba', a:'#ffd6a5', opt:{sym:'♪' } },
    sk_bond:    { kind:'icon', c:'#3fb950', a:'#7ee787', opt:{sym:'∞' } },
    sk_fear:    { kind:'icon', c:'#da3633', a:'#ffa657', opt:{sym:'!' } },
    sk_area:    { kind:'icon', c:'#76e3ea', a:'#a5d8ff', opt:{sym:'◍' } },
    sk_ember:   { kind:'icon', c:'#ff6b35', a:'#ffd766', opt:{sym:'✸' } },
    sk_frostaura:{ kind:'icon', c:'#a5d8ff', a:'#e6edf3', opt:{sym:'❆' } },
    sk_bonecall:{ kind:'icon', c:'#e6edf3', a:'#8b949e', opt:{sym:'☠' } },
    sk_pulse:   { kind:'icon', c:'#9aa5b1', a:'#a5d8ff', opt:{sym:'✦' } },
    sk_spring:  { kind:'icon', c:'#7ee787', a:'#e6edf3', opt:{sym:'♨' } },
    sk_forgefire:{ kind:'icon', c:'#ff6b35', a:'#9aa5b1', opt:{sym:'⚒' } },
    sk_dscale:  { kind:'icon', c:'#2dd4bf', a:'#e6edf3', opt:{sym:'⛊' } },
    sk_veil:    { kind:'icon', c:'#f778ba', a:'#8b949e', opt:{sym:'☾' } },
    sk_starluck:{ kind:'icon', c:'#fde047', a:'#e6edf3', opt:{sym:'✧' } },
    sk_wildcall:{ kind:'icon', c:'#b08968', a:'#7ee787', opt:{sym:'♣' } },
    sk_beacon:  { kind:'icon', c:'#f1f5f9', a:'#ffd766', opt:{sym:'☀' } },
    sk_pact:    { kind:'icon', c:'#484f58', a:'#ffd766', opt:{sym:'契' } },
    sk_mistwalk:{ kind:'icon', c:'#8b949e', a:'#a5d8ff', opt:{sym:'〜' } },
    sk_fguard:  { kind:'icon', c:'#9aa5b1', a:'#58a6ff', opt:{sym:'⛉' } },
    sk_moonrush:{ kind:'icon', c:'#a5d8ff', a:'#f1f5f9', opt:{sym:'☽' } },
    sk_stormcall:{ kind:'icon', c:'#fde047', a:'#8b949e', opt:{sym:'Ϟ' } },
    sk_gravemark:{ kind:'icon', c:'#c084fc', a:'#e6edf3', opt:{sym:'✝' } },
    sk_sunburst:{ kind:'icon', c:'#d29922', a:'#ff6b35', opt:{sym:'❂' } },
    sk_voidgrip:{ kind:'icon', c:'#6e40c9', a:'#76e3ea', opt:{sym:'◉' } },
    sk_endpact: { kind:'icon', c:'#8b1e24', a:'#ffd766', opt:{sym:'終' } },
    sk_sharpen: { kind:'icon', c:'#f0883e', a:'#e6edf3', opt:{sym:'⌃' } },
    sk_focus:   { kind:'icon', c:'#1f6feb', a:'#a5d8ff', opt:{sym:'⊙' } },
    sk_vampire: { kind:'icon', c:'#8b1e24', a:'#f85149', opt:{sym:'♥' } },
    sk_treasure:{ kind:'icon', c:'#d29922', a:'#ffd766', opt:{sym:'$' } },
    sk_confuse: { kind:'icon', c:'#c084fc', a:'#e6edf3', opt:{sym:'?' } },
    sk_curse:   { kind:'icon', c:'#6e40c9', a:'#a78bfa', opt:{sym:'†' } },
    sk_prism:   { kind:'icon', c:'#e879f9', a:'#fde047', opt:{sym:'✳' } },
    sk_oath:    { kind:'icon', c:'#8b949e', a:'#ffd766', opt:{sym:'誓' } },
    sk_relic:   { kind:'icon', c:'#3fb950', a:'#a5d8ff', opt:{sym:'遺' } },
    sk_laser:   { kind:'icon', c:'#d2a8ff', a:'#ffffff', opt:{sym:'≡' } },
    sk_meteor:  { kind:'icon', c:'#f0883e', a:'#f85149', opt:{sym:'☄' } },
    sk_sands:   { kind:'icon', c:'#d29922', a:'#fde047', opt:{sym:'⌛' } },
    sk_breath:  { kind:'icon', c:'#2dd4bf', a:'#f85149', opt:{sym:'〰' } },
  };
  // 素材ピックアップ: mat_<id> ― 素材ごとに形が違い、一目で見分けられる
  const MAT_KINDS = {
    jelly:'m_drop', bone:'m_bone', hide:'m_fur', wood:'m_log', scrap:'m_gear',
    crystal:'m_shard', shell:'m_shell', magic:'m_orb', coral:'m_coral',
    scale:'m_scale', star:'m_star', abyss:'m_abyss',
    prism:'m_prism', amber:'m_amber', pearl:'m_pearl',
    // 以前は全て同じ菱形(gem)だった素材にも固有の形を与える
    cinder:'m_cinder', iceshard:'m_ice', soulshard:'m_soul', relic:'m_relic',
    dew:'m_dew', duskveil:'m_veil', stardust:'m_dust', beastfang:'m_fang',
    obsidshard:'m_obsid', sunstone:'m_sun',
  };
  for (const m in DATA.MATERIALS) {
    DEFS['mat_' + m] = { kind: MAT_KINDS[m] || 'gem', c:DATA.MATERIALS[m].color, a:'#ffffff' };
  }
  // 心得(パッシブ)スキル等、専用アイコン未定義のスキルは素材色の◆アイコンを自動生成
  // 心得(パッシブ)は内容の分かる固有の記号にする(全部◆の使い回しにしない)
  const PASSIVE_SYM = {
    sk_p_shepherd:'☘', sk_p_vanguard:'⛬', sk_p_warcry:'⌇', sk_p_mend:'✜',
    sk_p_stand:'⩕', sk_p_recruit:'⚭', sk_p_swift:'⤳',
  };
  let symFallback = 0;
  const SPARE_SYM = ['◈','⬖','⬗','⬘','⬙','⧫','⬢','⬣','⬠','⬡','⌾','⍟','⏣','☖','☗'];
  for (const sid in DATA.SKILLS) {
    const def = DATA.SKILLS[sid];
    if (!DEFS[def.icon]) {
      const cost = def.cost(1);
      const m0 = Object.keys(cost)[0];
      const sym = PASSIVE_SYM[def.icon] || SPARE_SYM[symFallback++ % SPARE_SYM.length];
      DEFS[def.icon] = { kind:'icon', c:(DATA.MATERIALS[m0] || {color:'#8b949e'}).color, a:'#e6edf3', opt:{sym} };
    }
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
      case 'blob': {
        const bw=o.king?18:16, bh=o.king?12:13;
        if(o.icy){                                   // 氷: 角ばった結晶の体
          g.fillStyle=c; g.beginPath();
          g.moveTo(-16,10); g.lineTo(-11,-6); g.lineTo(-3,-12); g.lineTo(7,-9);
          g.lineTo(15,3); g.lineTo(12,15); g.lineTo(-11,16); g.closePath(); g.fill();
          g.fillStyle='rgba(255,255,255,.35)'; g.beginPath();
          g.moveTo(-8,-2); g.lineTo(-2,-10); g.lineTo(2,-2); g.closePath(); g.fill();
        } else {
          g.fillStyle=c; g.beginPath(); g.ellipse(0,4,bw,bh,0,0,7); g.fill();
        }
        g.fillStyle=a; g.beginPath(); g.ellipse(0,7,bw*0.68,7,0,0,7); g.fill();
        if(o.mush){                                  // キノコ: 体より広い傘(輪郭でキノコと分かる)
          g.fillStyle=a; g.beginPath();
          g.moveTo(-22,-4); g.quadraticCurveTo(0,-24,22,-4); g.lineTo(14,-1); g.lineTo(-14,-1); g.closePath(); g.fill();
          g.fillStyle='#fff8e7';
          for(const[dx,dy,r2]of[[-8,-10,2.6],[0,-14,3.2],[8,-9,2.4]]){g.beginPath();g.arc(dx,dy,r2,0,7);g.fill();}
        }
        if(o.lava){                                  // 溶岩: 体の割れ目と滴り
          g.strokeStyle=a; g.lineWidth=2.2; g.lineCap='round';
          g.beginPath(); g.moveTo(-11,-2); g.lineTo(-4,4); g.lineTo(-7,10); g.stroke();
          g.beginPath(); g.moveTo(9,-3); g.lineTo(4,5); g.stroke(); g.lineCap='butt';
          g.fillStyle=a; g.beginPath(); g.arc(-9,16,2.4,0,7); g.arc(7,17,1.8,0,7); g.fill();
        }
        if(o.king){                  // 王: 幅広の体の上に、小さな体を三つ積み上げた輪郭
          g.fillStyle=c;
          g.beginPath(); g.ellipse(-11,-9,7.5,6,0,0,7); g.fill();
          g.beginPath(); g.ellipse(2,-13,6,5,0,0,7); g.fill();
          g.beginPath(); g.ellipse(13,-8,5,4.2,0,0,7); g.fill();
          g.fillStyle=a; g.beginPath(); g.ellipse(-11,-8,4.6,3,0,0,7); g.fill();
          g.fillStyle='#0d1117'; g.beginPath(); g.arc(-13,-10,1.3,0,7); g.arc(-8.6,-10,1.3,0,7); g.fill();
        }
        eye(-5,0); eye(5,0); break; }
      case 'flying':
        g.fillStyle=c;
        g.beginPath(); g.moveTo(0,0); g.lineTo(-20,-8); g.lineTo(-12,4); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(0,0); g.lineTo(20,-8); g.lineTo(12,4); g.closePath(); g.fill();
        g.fillStyle=a; g.beginPath(); g.arc(0,0,8,0,7); g.fill();
        if(o.ember){                  // 燃えさし: 翼から散る火の粉と裂けた翼端
          g.fillStyle=c;
          g.beginPath(); g.moveTo(-20,-8); g.lineTo(-24,-1); g.lineTo(-17,-3); g.closePath(); g.fill();
          g.beginPath(); g.moveTo(20,-8); g.lineTo(24,-1); g.lineTo(17,-3); g.closePath(); g.fill();
          g.fillStyle='#ffb066';
          for(const[dx,dy,r2]of[[-15,7,2.2],[-9,11,1.6],[14,8,2],[8,12,1.4]]){
            g.beginPath(); g.arc(dx,dy,r2,0,7); g.fill(); }
        }
        eye(-3,-1,2); eye(3,-1,2); break;
      // 重量級(殴る): 肩が異様に張った台形の胴。頭は肩に沈み、腕は膝まで垂れる。
      // 遠目でも「近づかれたら潰される」と分かる骨格
      case 'brute': {
        g.fillStyle=c;
        g.beginPath(); g.moveTo(-15,-6); g.lineTo(15,-6); g.lineTo(11,17); g.lineTo(-11,17); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(-16,-9); g.quadraticCurveTo(0,-15,16,-9); g.lineTo(15,-4); g.lineTo(-15,-4); g.closePath(); g.fill();
        g.beginPath(); g.arc(0,-13,6.6,0,7); g.fill();                 // 肩に沈んだ小さな頭
        g.fillStyle=c;
        for(const sx of[-1,1]){ g.beginPath(); g.moveTo(sx*14,-6); g.lineTo(sx*20,-4);
          g.lineTo(sx*18,13); g.lineTo(sx*12,12); g.closePath(); g.fill(); }   // 垂れた太い腕
        g.fillStyle='rgba(0,0,0,.18)'; g.fillRect(-11,4,22,3);         // 胴の帯(重心を下に見せる)
        if(o.fur){ g.fillStyle=c;                                      // 毛むくじゃら: 肩の輪郭がギザギザ
          for(let i=-5;i<=5;i++){ g.beginPath();
            g.moveTo(i*3-1.6,-9); g.lineTo(i*3,-15); g.lineTo(i*3+1.6,-9); g.closePath(); g.fill(); } }
        if(o.icicle){ g.fillStyle='#cfeaf5';                           // 肩当てから下がる氷柱
          for(const sx of[-1,1]) for(let i=0;i<2;i++){ g.beginPath();
            g.moveTo(sx*(14+i*4),12); g.lineTo(sx*(16+i*4),22); g.lineTo(sx*(18+i*4),12); g.closePath(); g.fill(); } }
        if(o.tusk){ g.fillStyle='#f0f4f8';                             // 下あごから跳ね上がる2本牙
          for(const sx of[-1,1]){ g.beginPath();
            g.moveTo(sx*3,-9); g.lineTo(sx*5,-17); g.lineTo(sx*6.4,-9); g.closePath(); g.fill(); } }
        if(o.oneeye){                                                  // 一つ目の鬼: 単眼と担いだ棍棒
          g.fillStyle='#6e4c30'; g.save(); g.translate(20,0); g.rotate(-0.35);
          g.fillRect(-3.4,-18,7,28); g.fillStyle='#8b5a2b'; rr(g,-7,-25,14,11,3); g.restore();
          g.fillStyle='#fff'; g.beginPath(); g.arc(0,-13,4.4,0,7); g.fill();
          g.fillStyle='#0d1117'; g.beginPath(); g.arc(0,-13,2.2,0,7); g.fill();
        } else { eye(-3,-13,2.2); eye(3,-13,2.2); }
        break; }
      // 不死(よろめく): 縦に細く、肩が落ち、胴に隙間が空いて向こうが透ける
      case 'undead': {
        g.fillStyle=c;
        g.beginPath(); g.moveTo(-7,-6); g.lineTo(7,-6); g.lineTo(6,16); g.lineTo(-6,16); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(-9,-5); g.quadraticCurveTo(0,-9,9,-5); g.lineTo(8,-2); g.lineTo(-8,-2); g.closePath(); g.fill();
        g.beginPath(); g.arc(0,-14,7.2,0,7); g.fill();                 // 頭は大きめ(骨と頭蓋)
        g.strokeStyle=c; g.lineWidth=2.6; g.lineCap='round';            // 細い垂れた腕
        for(const sx of[-1,1]){ g.beginPath(); g.moveTo(sx*8,-3); g.lineTo(sx*12,9); g.stroke(); }
        g.lineCap='butt';
        g.globalCompositeOperation='destination-out';                   // 胴に空く隙間(向こうが透ける)
        for(let i=0;i<3;i++){ g.fillRect(-4,0+i*5,8,2); }
        g.globalCompositeOperation='source-over';
        if(o.bones){ g.strokeStyle=a; g.lineWidth=1.5;                  // 骨: あばらと背骨
          for(let i=0;i<3;i++){ g.beginPath(); g.moveTo(-5,1+i*5); g.lineTo(5,1+i*5); g.stroke(); }
          g.beginPath(); g.moveTo(0,-1); g.lineTo(0,15); g.stroke(); }
        if(o.wrap){ g.strokeStyle='#e6dcc4'; g.lineWidth=2.2;           // 包帯: 斜めの巻きと垂れた端
          for(let i=0;i<4;i++){ g.beginPath(); g.moveTo(-7,-2+i*5); g.lineTo(7,-4+i*5); g.stroke(); }
          g.beginPath(); g.moveTo(-6,-16); g.lineTo(5,-12); g.stroke();
          g.fillStyle='#e6dcc4'; g.fillRect(6,-1,2.2,13); }
        g.fillStyle='#0d1117'; g.beginPath(); g.arc(-2.8,-15,2,0,7); g.arc(2.8,-15,2,0,7); g.fill();   // 落ちくぼんだ眼窩
        break; }
      // 術者(遠くから撃つ・癒す): 細身に、体の外へ大きく突き出る得物と広がった裾
      case 'caster': {
        g.fillStyle=c;
        g.beginPath(); g.moveTo(-6,-8); g.lineTo(6,-8); g.lineTo(13,18); g.lineTo(-13,18); g.closePath(); g.fill();  // 広がる裾
        g.beginPath(); g.arc(0,-14,7,0,7); g.fill();
        g.fillStyle=a; g.beginPath();                                   // 肩の掛け布(左右非対称で術者と分かる)
        g.moveTo(-8,-8); g.lineTo(8,-8); g.lineTo(4,-1); g.lineTo(-4,-1); g.closePath(); g.fill();
        if(o.fintail){ g.fillStyle=a; g.beginPath();                    // 脚ではなく尾ひれ
          g.moveTo(-13,16); g.lineTo(0,12); g.lineTo(13,16);
          g.lineTo(18,25); g.lineTo(0,19); g.lineTo(-18,25); g.closePath(); g.fill(); }
        if(o.staff){ g.strokeStyle=a; g.lineWidth=3;                    // 体の外へ長く突き出る杖
          g.beginPath(); g.moveTo(15,-24); g.lineTo(15,14); g.stroke();
          if(o.skullstaff){ g.fillStyle='#e6edf3'; g.beginPath(); g.arc(15,-25,5,0,7); g.fill();
            g.fillStyle='#0d1117'; g.beginPath(); g.arc(13.3,-25.6,1.4,0,7); g.arc(16.7,-25.6,1.4,0,7); g.fill();
            g.fillRect(14,-23,2,2.2);
          } else { g.fillStyle=a; g.beginPath(); g.arc(15,-24,4.4,0,7); g.fill(); } }
        if(o.bow){ g.strokeStyle=a; g.lineWidth=2.6;                    // 大きく張った弓
          g.beginPath(); g.arc(15,-2,12,-1.25,1.25); g.stroke();
          g.strokeStyle='#e6dcc4'; g.lineWidth=1; g.beginPath();
          g.moveTo(19,-13); g.lineTo(19,10); g.stroke(); }
        eye(-3,-14,2.2); eye(3,-14,2.2); break; }
      // 竜人(前かがみ・尾): 首が前に出て、後ろへ長い尾が伸びる
      case 'saurian': {
        g.fillStyle=c;
        g.beginPath(); g.moveTo(-10,-2); g.lineTo(8,-4); g.lineTo(10,16); g.lineTo(-8,16); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(-9,2); g.quadraticCurveTo(-24,6,-22,-6);   // 太い尾
        g.quadraticCurveTo(-14,0,-8,-2); g.closePath(); g.fill();
        g.beginPath(); g.ellipse(7,-11,9,6.5,0.25,0,7); g.fill();       // 前へ突き出た頭
        g.fillStyle=a; g.beginPath();                                   // 背びれ
        for(let i=0;i<3;i++){ g.moveTo(-4+i*5,-4); g.lineTo(-2+i*5,-11); g.lineTo(0+i*5,-4); }
        g.fill();
        eye(9,-12,2.2); break; }
      // 重装(硬い): 角ばった鎧。兜のスリット・張り出した肩当て・構えた長剣
      case 'armor': {
        g.fillStyle=c;
        g.beginPath(); g.moveTo(-11,-4); g.lineTo(11,-4); g.lineTo(8,18); g.lineTo(-8,18); g.closePath(); g.fill();
        for(const sx of[-1,1]){ g.beginPath();                          // 張り出した肩当て(角つき)
          g.moveTo(sx*9,-8); g.lineTo(sx*21,-5); g.lineTo(sx*19,4); g.lineTo(sx*10,2); g.closePath(); g.fill(); }
        g.beginPath(); g.moveTo(-8,-20); g.lineTo(8,-20); g.lineTo(7,-6); g.lineTo(-7,-6); g.closePath(); g.fill();  // 兜
        g.fillStyle='#0d1117'; g.fillRect(-6,-15,12,3.4);               // 面頬のスリット
        g.fillStyle=a; g.fillRect(-6.5,-14.4,4,2.2);                    // 隙間から覗く眼光
        g.fillStyle='#9aa5b1';                                          // 長剣(体の外へ長く突き出る)
        g.save(); g.translate(17,2); g.rotate(-0.28);
        g.fillRect(-2,-26,4,32); g.fillStyle=a; g.fillRect(-5,4,10,3); g.restore();
        g.fillStyle='rgba(255,255,255,.14)'; g.fillRect(-8,0,16,2.6);   // 胸当ての光
        break; }
      case 'humanoid':
        g.fillStyle=c; rr(g,-9,-4,18,20,5);
        g.beginPath(); g.arc(0,-12,8,0,7); g.fill();
        if(o.fur){                                   // 毛むくじゃら: 輪郭のギザギザ
          g.fillStyle=c;
          for(let i=-4;i<=4;i++){ g.beginPath();
            g.moveTo(i*2.6-1.4,-4); g.lineTo(i*2.6,-9); g.lineTo(i*2.6+1.4,-4); g.closePath(); g.fill(); }
          for(const sx of[-1,1]) for(let i=0;i<3;i++){ g.beginPath();
            g.moveTo(sx*9,-1+i*6); g.lineTo(sx*14,1+i*6); g.lineTo(sx*9,4+i*6); g.closePath(); g.fill(); }
        }
        eye(-3,-12,2.4); eye(3,-12,2.4);
        if(o.bones){                                 // 骨: 肋骨の線
          g.strokeStyle='#8b949e'; g.lineWidth=1.6;
          for(let i=0;i<3;i++){ g.beginPath(); g.moveTo(-6,1+i*5); g.lineTo(6,1+i*5); g.stroke(); }
          g.beginPath(); g.moveTo(0,0); g.lineTo(0,12); g.stroke();
        }
        if(o.wrap){                                  // 包帯: 斜めに巻いた帯と垂れ
          g.strokeStyle='#e6dcc4'; g.lineWidth=2.6;
          for(let i=0;i<4;i++){ g.beginPath(); g.moveTo(-9,-1+i*5); g.lineTo(9,-3+i*5); g.stroke(); }
          g.beginPath(); g.moveTo(-8,-15); g.lineTo(6,-10); g.stroke();
          g.fillStyle='#e6dcc4'; g.fillRect(7,-2,2.4,10);
        }
        if(o.tusk){                                  // 牙: 下あごから突き出る2本
          g.fillStyle='#f0f4f8';
          for(const sx of[-1,1]){ g.beginPath();
            g.moveTo(sx*3,-8); g.lineTo(sx*4.6,-14); g.lineTo(sx*6,-8); g.closePath(); g.fill(); }
        }
        if(o.oneeye){                                // 一つ目の鬼: 単眼と担いだ棍棒
          g.fillStyle='#6e4c30';
          g.save(); g.translate(15,-2); g.rotate(-0.35);
          g.fillRect(-3,-16,6,26); g.fillStyle='#8b5a2b'; rr(g,-6,-22,12,10,3); g.restore();
          g.fillStyle=c; g.beginPath(); g.arc(0,-12,8,0,7); g.fill();
          g.fillStyle='#fff'; g.beginPath(); g.arc(0,-12,5,0,7); g.fill();
          g.fillStyle='#0d1117'; g.beginPath(); g.arc(0,-12,2.4,0,7); g.fill();
        }
        if(o.icicle){                                // 氷柱: 肩から下がる氷
          g.fillStyle='#cfeaf5';
          for(const sx of[-1,1]){ g.beginPath();
            g.moveTo(sx*7,-3); g.lineTo(sx*9,8); g.lineTo(sx*11,-3); g.closePath(); g.fill(); }
        }
        if(o.cap){                                   // 船乗り帽
          g.fillStyle='#0d2b3d'; g.beginPath(); g.arc(0,-15,8.5,Math.PI,0); g.closePath(); g.fill();
          g.fillStyle=a; g.fillRect(-10,-16,20,2.6);
        }
        if(o.specs){                                 // 丸眼鏡と本
          g.strokeStyle='#0d1117'; g.lineWidth=1.4;
          g.beginPath(); g.arc(-3,-12,3.6,0,7); g.arc(3,-12,3.6,0,7); g.stroke();
          g.beginPath(); g.moveTo(0,-12); g.lineTo(0,-12); g.stroke();
          g.fillStyle=a; rr(g,7,2,9,11,1.5); g.fillStyle='#fff'; g.fillRect(9,4,5,1.6);
        }
        if(o.braid){                                 // おさげ
          g.fillStyle=a;
          for(const sx of[-1,1]){ g.beginPath(); g.ellipse(sx*9,-9,3,7,sx*0.3,0,7); g.fill();
            g.beginPath(); g.arc(sx*10,-2,2.6,0,7); g.fill(); }
        }
        if(o.tuft){                                  // 跳ねた髪
          g.fillStyle=a; g.beginPath();
          g.moveTo(-5,-18); g.quadraticCurveTo(0,-25,6,-19); g.quadraticCurveTo(1,-19,-5,-18); g.fill();
        }
        if(o.apron){                                 // 鍛冶の前掛けと槌
          g.fillStyle='#57443a'; rr(g,-7,0,14,15,2);
          g.strokeStyle='#8b5a2b'; g.lineWidth=2; g.beginPath(); g.moveTo(-6,0); g.lineTo(6,0); g.stroke();
          g.strokeStyle='#6e4c30'; g.lineWidth=2.6; g.beginPath(); g.moveTo(13,-14); g.lineTo(13,2); g.stroke();
          g.fillStyle='#8b949e'; rr(g,8,-19,11,6,1.5);
        }
        if(o.helm){                                  // 坑夫のヘルメットとつるはし
          g.fillStyle='#d29922'; g.beginPath(); g.arc(0,-14,8.6,Math.PI,0); g.closePath(); g.fill();
          g.fillStyle='#fff8c5'; g.beginPath(); g.arc(0,-18,2.4,0,7); g.fill();
          g.strokeStyle='#6e4c30'; g.lineWidth=2.4; g.beginPath(); g.moveTo(-13,4); g.lineTo(-11,-14); g.stroke();
          g.strokeStyle='#9aa5b1'; g.lineWidth=2.6;
          g.beginPath(); g.moveTo(-18,-12); g.quadraticCurveTo(-11,-18,-5,-12); g.stroke();
        }
        if(o.staff){ g.strokeStyle=a; g.lineWidth=3; g.beginPath(); g.moveTo(12,-20); g.lineTo(12,10); g.stroke();
          if(o.skullstaff){            // 杖の先が髑髏
            g.fillStyle='#e6edf3'; g.beginPath(); g.arc(12,-21,4.6,0,7); g.fill();
            g.fillStyle='#0d1117'; g.beginPath(); g.arc(10.4,-21.6,1.3,0,7); g.arc(13.6,-21.6,1.3,0,7); g.fill();
            g.fillRect(11,-18.6,2,2);
          } else if(o.miko){           // 巫女: 紙垂(しで)の付いた幣
            g.fillStyle='#fff'; 
            for(let i=0;i<3;i++) g.fillRect(8+i*3,-22+i*1.5,2.2,7);
          } else if(o.scroll){         // 地図職人: 杖ではなく巻物を抱える
            g.fillStyle='#0d1117'; g.clearRect(9,-22,6,34);
            g.fillStyle='#e6dcc4'; rr(g,6,-2,15,7,3);
            g.strokeStyle='#8b5a2b'; g.lineWidth=1.4;
            g.beginPath(); g.moveTo(8,1.5); g.lineTo(19,1.5); g.stroke();
          } else {
            g.fillStyle=a; g.beginPath(); g.arc(12,-20,4,0,7); g.fill();
          }
        }
        if(o.beard){                   // 長老: 長い白髭
          g.fillStyle='#e6edf3'; g.beginPath();
          g.moveTo(-6,-8); g.quadraticCurveTo(0,10,6,-8); g.quadraticCurveTo(0,-4,-6,-8); g.fill();
        }
        if(o.miko){                    // 巫女: 緋袴と白衣の切り替え
          g.fillStyle='#d1495b'; rr(g,-9,4,18,12,3);
          g.fillStyle='#fff'; g.fillRect(-9,2,18,2.6);
        }
        if(o.fintail){                 // セイレーン: 脚ではなく尾ひれ
          g.fillStyle=a; g.beginPath();
          g.moveTo(-8,14); g.lineTo(0,10); g.lineTo(8,14);
          g.lineTo(13,22); g.lineTo(0,17); g.lineTo(-13,22); g.closePath(); g.fill();
        }
        if(o.bow){ g.strokeStyle=a; g.lineWidth=2.5; g.beginPath(); g.arc(13,-2,9,-1.2,1.2); g.stroke(); }
        if(o.tail){ g.strokeStyle=c; g.lineWidth=5; g.beginPath(); g.moveTo(-8,12); g.quadraticCurveTo(-20,14,-18,4); g.stroke(); }
        break;
      case 'beast':
        if(o.gale){                   // 疾風犬: 後方に流れる風の筋
          g.strokeStyle='rgba(230,237,243,.5)'; g.lineWidth=1.8; g.lineCap='round';
          for(let i=0;i<3;i++){ g.beginPath(); g.moveTo(-22,-6+i*7); g.lineTo(-9,-5+i*7); g.stroke(); }
          g.lineCap='butt';
        }
        // 横向きのオオカミ(右向き)。脚・尻尾・突き出た口吻・尖った耳で犬科に見せる
        g.strokeStyle=a; g.lineWidth=3.4; g.lineCap='round';
        g.beginPath();
        g.moveTo(-8,5); g.lineTo(-9,14); g.moveTo(-2,6); g.lineTo(-2,15);
        g.moveTo(6,6); g.lineTo(6,15); g.moveTo(11,5); g.lineTo(12,14);
        g.stroke();
        // ふさふさの尻尾(後方)
        g.fillStyle=c; g.beginPath(); g.moveTo(-11,-1);
        g.quadraticCurveTo(-23,-4,-21,-15); g.quadraticCurveTo(-14,-9,-10,-4); g.closePath(); g.fill();
        // 胴体
        g.beginPath(); g.ellipse(-1,1,15,8,0,0,7); g.fill();
        // 首〜頭
        g.beginPath(); g.moveTo(5,-2); g.lineTo(11,-11); g.lineTo(17,-8); g.lineTo(15,0); g.closePath(); g.fill();
        g.beginPath(); g.arc(14,-6,7,0,7); g.fill();
        // 突き出た口吻(マズル)
        g.beginPath(); g.moveTo(18,-8); g.lineTo(26,-3); g.lineTo(18,-0.5); g.closePath(); g.fill();
        // 尖った耳×2
        g.beginPath(); g.moveTo(8,-10); g.lineTo(10,-20); g.lineTo(15,-12); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(14,-12); g.lineTo(19,-20); g.lineTo(20,-10); g.closePath(); g.fill();
        // 差し色: 腹の陰影・鼻先・耳の内側
        g.fillStyle=a; g.beginPath(); g.ellipse(-2,4,9,4,0,0,7); g.fill();
        g.beginPath(); g.arc(25.5,-3,1.8,0,7); g.fill();   // 鼻
        if(o.frost){                  // 霜狼: 背に生える氷の板
          g.fillStyle='#cfeaf5';
          for(const[dx,dy,h]of[[-4,-9,7],[3,-11,9],[9,-9,6]]){
            g.beginPath(); g.moveTo(dx-3,dy); g.lineTo(dx,dy-h); g.lineTo(dx+3,dy); g.closePath(); g.fill(); }
        }
        if(o.gale){                   // 疾風犬: 長く後ろへ流れる耳
          g.fillStyle=c; g.beginPath();
          g.moveTo(10,-12); g.quadraticCurveTo(-2,-24,-10,-18);
          g.quadraticCurveTo(2,-16,12,-9); g.closePath(); g.fill();
        }
        if(o.boar){                   // 猪: 上を向く牙と平たい鼻
          g.fillStyle='#f0f4f8';
          for(const[dx,dy]of[[21,-2],[23,0]]){ g.beginPath();
            g.moveTo(dx,dy); g.quadraticCurveTo(dx+5,dy-4,dx+3,dy-9);
            g.quadraticCurveTo(dx+1,dy-4,dx-1,dy); g.closePath(); g.fill(); }
          g.fillStyle=a; g.beginPath(); g.ellipse(25.5,-3,3.2,2.4,0,0,7); g.fill();
        }
        eye(15,-6,2.2); break;
      case 'crab':
        g.fillStyle=c; g.beginPath(); g.ellipse(0,2,15,10,0,0,7); g.fill();
        g.strokeStyle=c; g.lineWidth=3;
        for(const s of[-1,1]){ g.beginPath(); g.moveTo(10*s,6); g.lineTo(18*s,12); g.stroke();
          g.beginPath(); g.moveTo(12*s,0); g.lineTo(20*s,2); g.stroke();
          g.fillStyle=a; g.beginPath(); g.arc(16*s,-8,5,0,7); g.fill(); g.fillStyle=c; }
        if(o.scarab){                 // スカラベ: 甲の合わせ目と一本角
          g.strokeStyle=a; g.lineWidth=1.6;
          g.beginPath(); g.moveTo(0,-7); g.lineTo(0,11); g.stroke();
          g.beginPath(); g.moveTo(-11,0); g.lineTo(11,0); g.stroke();
          g.fillStyle=a; g.beginPath();
          g.moveTo(-2,-8); g.lineTo(0,-18); g.lineTo(2,-8); g.closePath(); g.fill();
        }
        eye(-4,-2,2.4); eye(4,-2,2.4); break;
      case 'golem':
        if(o.shards){                 // 虚無: 台形の胴の周りに欠片が浮く
          g.fillStyle=c; g.globalAlpha=.9; g.beginPath();
          g.moveTo(-10,-14); g.lineTo(10,-14); g.lineTo(15,15); g.lineTo(-15,15); g.closePath(); g.fill();
          g.globalAlpha=1;
          g.fillStyle=a;
          for(const[dx,dy,r2]of[[-21,-8,4.4],[20,-12,3.8],[18,9,3.4],[-19,12,3.8],[0,-22,3.4]]){
            g.beginPath(); g.moveTo(dx,dy-r2); g.lineTo(dx+r2,dy); g.lineTo(dx,dy+r2); g.lineTo(dx-r2,dy); g.closePath(); g.fill(); }
        } else if(o.arms){            // 巨腕: 台形の胴から、地面近くまで届く極太の腕
          g.fillStyle=c; g.beginPath();
          g.moveTo(-9,-14); g.lineTo(9,-14); g.lineTo(13,14); g.lineTo(-13,14); g.closePath(); g.fill();
          for(const sx of[-1,1]){ g.beginPath();
            g.moveTo(sx*10,-12); g.lineTo(sx*26,-7); g.lineTo(sx*23,18); g.lineTo(sx*12,16); g.closePath(); g.fill(); }
          g.fillStyle='rgba(255,255,255,.12)'; rr(g,-24,0,8,6,2); rr(g,16,0,8,6,2);
        } else {
          // 岩の巨人: 上が狭く下が広い台形の胴に、地面近くまで垂れる太い腕。
          // ただの角丸四角だと「四角い塊」以上の情報がなく、他の敵と区別できない
          g.fillStyle=c;
          g.beginPath(); g.moveTo(-11,-15); g.lineTo(11,-15); g.lineTo(16,16); g.lineTo(-16,16); g.closePath(); g.fill();
          for(const sx of[-1,1]){ g.beginPath();
            g.moveTo(sx*11,-12); g.lineTo(sx*23,-9); g.lineTo(sx*21,15); g.lineTo(sx*13,14); g.closePath(); g.fill(); }
          g.fillStyle='rgba(0,0,0,.20)';                                // 岩の継ぎ目
          g.fillRect(-10,-2,20,2.4); g.fillRect(-13,8,26,2.4);
        }
        if(o.crack){                  // 溶岩: 体を走る割れ目と、足元へ滴る溶岩
          g.fillStyle=a;
          g.beginPath(); g.moveTo(-9,14); g.lineTo(-7,22); g.lineTo(-4,14); g.closePath(); g.fill();
          g.beginPath(); g.arc(8,19,2.6,0,7); g.fill();
          g.strokeStyle=a; g.lineWidth=2.4; g.lineCap='round';
          g.beginPath(); g.moveTo(-10,-12); g.lineTo(-3,-2); g.lineTo(-8,8); g.stroke();
          g.beginPath(); g.moveTo(8,-10); g.lineTo(3,0); g.lineTo(9,10); g.stroke();
          g.lineCap='butt';
        }
        g.fillStyle=a; rr(g,-8,-6,6,6,2); rr(g,2,-6,6,6,2);
        g.fillStyle='#0d1117'; rr(g,-6,6,12,4,2); break;
      case 'ghost':
        g.fillStyle=c; g.beginPath(); g.arc(0,-4,13,Math.PI,0);
        g.lineTo(13,12); g.lineTo(8,7); g.lineTo(3,12); g.lineTo(-3,7); g.lineTo(-8,12); g.lineTo(-13,7);
        g.closePath(); g.fill();
        if(o.voidEye){            // 虚無: 外へ伸びる触手
          g.strokeStyle=c; g.lineWidth=3; g.lineCap='round';
          for(const sx of[-1,1]){ g.beginPath(); g.moveTo(sx*11,4);
            g.quadraticCurveTo(sx*22,6,sx*19,17); g.stroke(); }
          g.lineCap='butt';
        }
        if(o.bolt){               // 嵐: 外へ走る稲妻
          g.strokeStyle='#fde047'; g.lineWidth=2;
          g.beginPath(); g.moveTo(11,-8); g.lineTo(20,-14); g.lineTo(16,-11); g.lineTo(25,-17); g.stroke();
          g.beginPath(); g.moveTo(-11,-6); g.lineTo(-19,-13); g.stroke();
        }
        if(o.hood){               // 死霊術師: 袖から覗く骨の手
          g.strokeStyle='#e6edf3'; g.lineWidth=2; g.lineCap='round';
          for(const sx of[-1,1]){ g.beginPath(); g.moveTo(sx*10,2); g.lineTo(sx*18,-6); g.stroke();
            for(let i=-1;i<=1;i++){ g.beginPath(); g.moveTo(sx*18,-6);
              g.lineTo(sx*22+i*1.5,-11+i*3); g.stroke(); } }
          g.lineCap='butt';
        }
        if(o.tatter){             // 影: 裾が大きく裂ける
          g.fillStyle='#0d1117'; g.beginPath();
          g.moveTo(-13,7); g.lineTo(-6,16); g.lineTo(0,6); g.lineTo(6,17); g.lineTo(13,7);
          g.lineTo(13,14); g.lineTo(-13,14); g.closePath(); g.fill();
        }
        if(o.hood){ g.fillStyle='#0d1117'; g.beginPath(); g.arc(0,-5,8,0,7); g.fill(); }
        if(o.icy){                  // 氷: 周囲に舞う氷の粒
          g.fillStyle='#dff4fb';
          for(const[dx,dy]of[[-14,-12],[13,-14],[16,2],[-16,3]]){
            g.beginPath(); g.moveTo(dx,dy-3); g.lineTo(dx+2.4,dy); g.lineTo(dx,dy+3); g.lineTo(dx-2.4,dy); g.closePath(); g.fill(); }
        }
        if(o.bolt){                 // 嵐: 体を走る稲妻
          g.strokeStyle='#fde047'; g.lineWidth=2.2;
          g.beginPath(); g.moveTo(-6,-14); g.lineTo(1,-4); g.lineTo(-3,-2); g.lineTo(4,10); g.stroke();
        }
        if(o.lamp){                 // 賢者: 手元の静かな灯り
          g.strokeStyle='#8b949e'; g.lineWidth=1.6;
          g.beginPath(); g.moveTo(14,-10); g.lineTo(14,-2); g.stroke();
          g.fillStyle='#ffd766'; g.beginPath(); g.arc(14,2,4,0,7); g.fill();
          g.fillStyle='rgba(255,215,102,.35)'; g.beginPath(); g.arc(14,2,7.5,0,7); g.fill();
        }
        if(o.voidEye){              // 虚無: 大きな縦長の単眼
          g.fillStyle='#0d1117'; g.beginPath(); g.ellipse(0,-5,7,9,0,0,7); g.fill();
          g.fillStyle=a; g.beginPath(); g.ellipse(0,-5,2.6,6,0,0,7); g.fill();
        } else {
          g.fillStyle=a; g.beginPath(); g.arc(-4,-5,2.5,0,7); g.arc(5,-5,2.5,0,7); g.fill();
        }
        break;
      case 'jellyfish':
        // 傘より触手を主役にする。細い線だと輪郭に出ず、ただのドームに見えてしまう
        g.strokeStyle=c; g.lineWidth=4.6; g.lineCap='round';
        for(let i=-2;i<=2;i++){ g.beginPath(); g.moveTo(i*5,-2);
          g.quadraticCurveTo(i*7+5,10,i*8,22); g.stroke(); }
        g.lineCap='butt';
        g.fillStyle=c; g.beginPath(); g.arc(0,-3,13,Math.PI,0); g.closePath(); g.fill();
        g.strokeStyle=a; g.lineWidth=2; g.beginPath(); g.arc(0,-3,9,Math.PI,0); g.stroke();
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
        if(o.wurm){                   // 砂蟲: 体の節と、丸く開いた口
          g.strokeStyle=a; g.lineWidth=1.8;
          for(const[x1,y1,x2,y2]of[[-12,-2,-9,8],[-2,-6,1,4],[8,0,11,10]]){
            g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke(); }
          g.fillStyle='#0d1117'; g.beginPath(); g.arc(19,-9,4.6,0,7); g.fill();
          g.fillStyle=a; g.beginPath(); g.arc(19,-9,2.2,0,7); g.fill();
          break;
        }
        eye(18,-10,2.2); break;
      case 'dragon':
        g.fillStyle=c; g.beginPath(); g.ellipse(0,2,14,11,0,0,7); g.fill();
        g.beginPath(); g.moveTo(-4,-6); g.lineTo(-18,-18); g.lineTo(-2,-12); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(4,-6); g.lineTo(18,-18); g.lineTo(2,-12); g.closePath(); g.fill();
        g.fillStyle=a; g.beginPath(); g.arc(0,-8,7,0,7); g.fill();
        g.fillStyle=c; g.beginPath(); g.moveTo(-3,-13); g.lineTo(0,-20); g.lineTo(3,-13); g.closePath(); g.fill();
        eye(-3,-8,2); eye(3,-8,2); break;
      case 'demon':
        if(o.abyss){                  // 深淵: 体の下から伸びる触腕
          g.strokeStyle=c; g.lineWidth=4; g.lineCap='round';
          for(const sx of[-1,1]){ g.beginPath(); g.moveTo(sx*6,14);
            g.quadraticCurveTo(sx*18,18,sx*15,26); g.stroke(); }
          g.lineCap='butt';
        }
        g.fillStyle=c; rr(g,-11,-8,22,24,6);
        if(o.bighorn){                // 大角: 太く外へ巻く角
          g.beginPath(); g.moveTo(-9,-8); g.lineTo(-24,-24); g.lineTo(-3,-13); g.closePath(); g.fill();
          g.beginPath(); g.moveTo(9,-8); g.lineTo(24,-24); g.lineTo(3,-13); g.closePath(); g.fill();
        } else {
          g.beginPath(); g.moveTo(-9,-8); g.lineTo(-15,-20); g.lineTo(-4,-12); g.closePath(); g.fill();
          g.beginPath(); g.moveTo(9,-8); g.lineTo(15,-20); g.lineTo(4,-12); g.closePath(); g.fill();
        }
        if(o.imp){                    // 小鬼: 炎の尾
          g.fillStyle=a; g.beginPath();
          g.moveTo(10,10); g.quadraticCurveTo(22,10,20,0);
          g.quadraticCurveTo(24,8,14,15); g.closePath(); g.fill();
        }
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
        g.beginPath(); g.arc(-9,0,9,0,7); g.fill(); g.beginPath(); g.arc(9,0,9,0,7); g.fill();
        if(o.snow){                   // 雪: 枝葉に積もる白
          g.fillStyle='#f2f8fc';
          g.beginPath(); g.arc(0,-13,9,Math.PI,0); g.closePath(); g.fill();
          g.beginPath(); g.arc(-11,-3,5.5,Math.PI,0); g.closePath(); g.fill();
          g.beginPath(); g.arc(11,-3,5.5,Math.PI,0); g.closePath(); g.fill();
        }
        if(o.gold){                   // 金の古木: 垂れ下がる金の枝と実
          g.strokeStyle=a; g.lineWidth=2.2; g.lineCap='round';
          for(const sx of[-1,1]){ g.beginPath(); g.moveTo(sx*12,-4);
            g.quadraticCurveTo(sx*21,0,sx*19,9); g.stroke();
            g.fillStyle='#fff3b0'; g.beginPath(); g.arc(sx*19,12,3,0,7); g.fill(); }
          g.lineCap='butt';
          g.fillStyle='#fff3b0';
          for(const[dx,dy]of[[-7,-11],[6,-13],[0,-3],[11,2],[-11,1]]){
            g.beginPath(); g.arc(dx,dy,2.8,0,7); g.fill(); }
        }
        break;
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
      // ---- 素材の固有形状 ----
      case 'm_cinder':  // 燃えさし: 火の粉を散らす炭
        g.fillStyle='#3a2a24'; g.beginPath();
        g.moveTo(-9,6); g.lineTo(-4,-4); g.lineTo(4,-6); g.lineTo(9,4); g.lineTo(2,10); g.closePath(); g.fill();
        g.fillStyle=c; g.beginPath(); g.moveTo(-4,3); g.lineTo(0,-2); g.lineTo(4,3); g.closePath(); g.fill();
        g.fillStyle='#ffb066';
        for(const[dx,dy,r2]of[[-8,-8,1.8],[5,-11,1.4],[10,-4,1.2]]){g.beginPath();g.arc(dx,dy,r2,0,7);g.fill();}
        break;
      case 'm_ice':     // 氷片: 六方の結晶
        g.strokeStyle=c; g.lineWidth=3; g.lineCap='round';
        for(let i=0;i<3;i++){ const t2=i*Math.PI/3;
          g.beginPath(); g.moveTo(-Math.cos(t2)*11,-Math.sin(t2)*11);
          g.lineTo(Math.cos(t2)*11,Math.sin(t2)*11); g.stroke(); }
        g.strokeStyle='rgba(255,255,255,.7)'; g.lineWidth=1.4;
        for(let i=0;i<3;i++){ const t2=i*Math.PI/3;
          g.beginPath(); g.moveTo(Math.cos(t2)*7,Math.sin(t2)*7);
          g.lineTo(Math.cos(t2)*7+3,Math.sin(t2)*7-3); g.stroke(); }
        g.lineCap='butt'; break;
      case 'm_soul':    // 魂のかけら: 尾を引く炎の粒
        g.fillStyle=c; g.beginPath();
        g.moveTo(0,-12); g.quadraticCurveTo(8,-2,4,6);
        g.quadraticCurveTo(0,12,-4,6); g.quadraticCurveTo(-8,-2,0,-12); g.fill();
        g.fillStyle='rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(0,1,2.6,4,0,0,7); g.fill(); break;
      case 'm_relic':   // 遺物: 欠けた歯車つきの円盤
        g.fillStyle=c; g.beginPath(); g.arc(0,0,10,0.5,6.0); g.closePath(); g.fill();
        g.fillStyle='#0d1117'; g.beginPath(); g.arc(0,0,3.6,0,7); g.fill();
        g.fillStyle=c;
        for(let i=0;i<5;i++){ const t2=1+i*1.05;
          g.beginPath(); g.arc(Math.cos(t2)*11,Math.sin(t2)*11,2.2,0,7); g.fill(); }
        break;
      case 'm_dew':     // 雫: 葉に載った露
        g.fillStyle='#2ea043'; g.beginPath();
        g.moveTo(-11,6); g.quadraticCurveTo(0,12,11,4); g.quadraticCurveTo(0,2,-11,6); g.fill();
        g.fillStyle=c; g.beginPath();
        g.moveTo(0,-11); g.quadraticCurveTo(7,-2,0,3); g.quadraticCurveTo(-7,-2,0,-11); g.fill();
        g.fillStyle='rgba(255,255,255,.8)'; g.beginPath(); g.arc(-2,-3,1.8,0,7); g.fill(); break;
      case 'm_veil':    // 帳(とばり): たなびく薄布
        g.fillStyle=c; g.globalAlpha=.85; g.beginPath();
        g.moveTo(-11,-8); g.quadraticCurveTo(0,-3,11,-9);
        g.lineTo(11,5); g.quadraticCurveTo(4,11,-2,5);
        g.quadraticCurveTo(-7,10,-11,4); g.closePath(); g.fill(); g.globalAlpha=1;
        g.strokeStyle='rgba(255,255,255,.5)'; g.lineWidth=1.2;
        g.beginPath(); g.moveTo(-6,-6); g.lineTo(-5,5); g.moveTo(5,-7); g.lineTo(6,4); g.stroke(); break;
      case 'm_dust':    // 星屑: 大小の粒が散る
        g.fillStyle=c;
        for(const[dx,dy,r2]of[[0,-7,3.4],[-8,3,2.4],[7,4,2.8],[-3,9,1.6],[9,-5,1.6]]){
          g.beginPath(); g.arc(dx,dy,r2,0,7); g.fill(); }
        g.fillStyle='rgba(255,255,255,.85)'; g.beginPath(); g.arc(0,-7,1.4,0,7); g.fill(); break;
      case 'm_fang':    // 獣の牙: 反った一本牙
        g.fillStyle=c; g.beginPath();
        g.moveTo(-4,-11); g.quadraticCurveTo(6,-4,3,11);
        g.quadraticCurveTo(-1,2,-6,-6); g.closePath(); g.fill();
        g.fillStyle='rgba(255,255,255,.5)'; g.beginPath();
        g.moveTo(-3,-9); g.quadraticCurveTo(2,-4,1,2); g.quadraticCurveTo(-2,-3,-4,-7); g.fill(); break;
      case 'm_obsid':   // 黒曜: 鋭く割れた黒い刃
        g.fillStyle=c; g.beginPath();
        g.moveTo(-2,-12); g.lineTo(7,-1); g.lineTo(2,12); g.lineTo(-7,2); g.closePath(); g.fill();
        g.fillStyle='rgba(255,255,255,.4)'; g.beginPath();
        g.moveTo(-2,-12); g.lineTo(7,-1); g.lineTo(-1,-2); g.closePath(); g.fill(); break;
      case 'm_sun':     // 陽の石: 光条をもつ円
        g.fillStyle=c; g.beginPath(); g.arc(0,0,7,0,7); g.fill();
        g.strokeStyle=c; g.lineWidth=2.2; g.lineCap='round';
        for(let i=0;i<8;i++){ const t2=i*Math.PI/4;
          g.beginPath(); g.moveTo(Math.cos(t2)*9,Math.sin(t2)*9);
          g.lineTo(Math.cos(t2)*12.5,Math.sin(t2)*12.5); g.stroke(); }
        g.lineCap='butt';
        g.fillStyle='rgba(255,255,255,.7)'; g.beginPath(); g.arc(-2,-2,2.4,0,7); g.fill(); break;
      case 'm_drop':   // ゼリー: しずく
        g.fillStyle=c; g.beginPath(); g.moveTo(0,-13); g.quadraticCurveTo(11,2,7,8);
        g.arc(0,8,8,0,Math.PI); g.quadraticCurveTo(-11,2,0,-13); g.fill();
        g.fillStyle='rgba(255,255,255,.5)'; g.beginPath(); g.arc(-3,4,3,0,7); g.fill(); break;
      case 'm_bone':   // 骨: 両端にコブ
        g.strokeStyle=c; g.lineWidth=5; g.beginPath(); g.moveTo(-7,7); g.lineTo(7,-7); g.stroke();
        g.fillStyle=c;
        for (const s2 of [[-9,5],[-5,9],[9,-5],[5,-9]]) { g.beginPath(); g.arc(s2[0],s2[1],4,0,7); g.fill(); } break;
      case 'm_fur':    // 毛皮: ふさふさの三角
        g.fillStyle=c; g.beginPath(); g.moveTo(-11,-8); g.lineTo(11,-8);
        g.lineTo(8,2); g.lineTo(5,-2); g.lineTo(3,6); g.lineTo(0,1); g.lineTo(-3,9);
        g.lineTo(-6,0); g.lineTo(-9,4); g.closePath(); g.fill();
        g.fillStyle=a; g.globalAlpha=.3; g.fillRect(-11,-8,22,3); g.globalAlpha=1; break;
      case 'm_log':    // 木材: 丸太
        g.fillStyle=c; rr(g,-11,-6,22,12,3);
        g.fillStyle=a; g.globalAlpha=.7; g.beginPath(); g.ellipse(-11,0,3,6,0,0,7); g.fill(); g.globalAlpha=1;
        g.strokeStyle='rgba(0,0,0,.3)'; g.lineWidth=1.5;
        g.beginPath(); g.moveTo(-4,-6); g.lineTo(-4,6); g.moveTo(4,-6); g.lineTo(4,6); g.stroke(); break;
      case 'm_gear':   // 鉄クズ: 歯車
        g.fillStyle=c;
        for (let i=0;i<6;i++){ g.save(); g.rotate(i*Math.PI/3); g.fillRect(-2.5,-12,5,24); g.restore(); }
        g.beginPath(); g.arc(0,0,8,0,7); g.fill();
        g.fillStyle='#0d1117'; g.beginPath(); g.arc(0,0,3.5,0,7); g.fill(); break;
      case 'm_shard':  // 水晶: 細長い結晶
        g.fillStyle=c; g.beginPath(); g.moveTo(0,-13); g.lineTo(6,-4); g.lineTo(4,12); g.lineTo(-4,12); g.lineTo(-6,-4); g.closePath(); g.fill();
        g.fillStyle='rgba(255,255,255,.6)'; g.beginPath(); g.moveTo(0,-13); g.lineTo(6,-4); g.lineTo(1,-2); g.closePath(); g.fill(); break;
      case 'm_shell':  // 貝殻: 扇
        g.fillStyle=c; g.beginPath(); g.moveTo(0,10);
        g.arc(0,-2,12,Math.PI*0.15,Math.PI*0.85,true); g.closePath(); g.fill();
        g.strokeStyle='rgba(0,0,0,.25)'; g.lineWidth=1.5;
        for (const d2 of [-0.5,0,0.5]) { g.beginPath(); g.moveTo(0,10); g.lineTo(Math.sin(d2)*11,-2-Math.cos(d2)*8); g.stroke(); } break;
      case 'm_orb':    // 魔石: 光る球
        g.fillStyle=c; g.beginPath(); g.arc(0,0,10,0,7); g.fill();
        g.strokeStyle=a; g.globalAlpha=.6; g.lineWidth=2; g.beginPath(); g.arc(0,0,13,0,7); g.stroke(); g.globalAlpha=1;
        g.fillStyle='#fff'; g.beginPath(); g.arc(-3,-3,3,0,7); g.fill(); break;
      case 'm_coral':  // 珊瑚: 枝
        g.strokeStyle=c; g.lineWidth=4.5; g.lineCap='round';
        g.beginPath(); g.moveTo(0,12); g.lineTo(0,-2); g.moveTo(0,4); g.lineTo(-7,-7); g.moveTo(0,0); g.lineTo(7,-9);
        g.moveTo(-7,-7); g.lineTo(-10,-12); g.stroke(); break;
      case 'm_scale':  // 竜のうろこ: 盾型
        g.fillStyle=c; g.beginPath(); g.moveTo(0,-12); g.quadraticCurveTo(12,-6,10,4);
        g.quadraticCurveTo(6,12,0,13); g.quadraticCurveTo(-6,12,-10,4); g.quadraticCurveTo(-12,-6,0,-12); g.fill();
        g.strokeStyle='rgba(0,0,0,.3)'; g.lineWidth=2; g.beginPath(); g.moveTo(0,-10); g.lineTo(0,11); g.stroke(); break;
      case 'm_star':   // 星のかけら: 五芒星
        g.fillStyle=c; g.beginPath();
        for (let i=0;i<10;i++){ const rr2=i%2===0?12:5, an=-Math.PI/2+i*Math.PI/5;
          const px2=Math.cos(an)*rr2, py2=Math.sin(an)*rr2; i===0?g.moveTo(px2,py2):g.lineTo(px2,py2); }
        g.closePath(); g.fill();
        g.fillStyle='rgba(255,255,255,.6)'; g.beginPath(); g.arc(0,-2,2.5,0,7); g.fill(); break;
      case 'm_prism':  // 虹のかけら: 多色ダイヤ
        for (let i=0;i<4;i++){
          g.fillStyle=['#f85149','#fde047','#7ee787','#58a6ff'][i];
          g.save(); g.rotate(i*Math.PI/2);
          g.beginPath(); g.moveTo(0,0); g.lineTo(10,-10); g.lineTo(0,-13); g.closePath(); g.fill(); g.restore();
        }
        g.fillStyle='#fff'; g.beginPath(); g.arc(0,0,3.5,0,7); g.fill(); break;
      case 'm_amber':  // 太古の琥珀: 虫入りの飴色玉
        g.fillStyle=c; g.beginPath(); g.ellipse(0,0,10,12,0.3,0,7); g.fill();
        g.fillStyle='rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(1,1,3,2,0.5,0,7); g.fill();
        g.fillStyle='rgba(255,255,255,.5)'; g.beginPath(); g.arc(-4,-5,2.5,0,7); g.fill(); break;
      case 'm_pearl':  // 真珠: 白い光沢玉
        g.fillStyle=c; g.beginPath(); g.arc(0,0,9,0,7); g.fill();
        g.fillStyle='rgba(180,200,255,.4)'; g.beginPath(); g.arc(2,3,6,0,7); g.fill();
        g.fillStyle='#fff'; g.beginPath(); g.arc(-3,-3,3,0,7); g.fill(); break;
      case 'pearlobj': // 真珠貝(オブジェクト)
        g.fillStyle=a; g.beginPath(); g.moveTo(0,10); g.arc(0,-2,14,Math.PI*0.1,Math.PI*0.9,true); g.closePath(); g.fill();
        g.fillStyle=c; g.beginPath(); g.arc(0,-2,6,0,7); g.fill();
        g.fillStyle='#fff'; g.beginPath(); g.arc(-2,-4,2,0,7); g.fill(); break;
      case 'rainbowblob': // レインボースライム
        for (let i=0;i<5;i++){
          g.fillStyle=['#f85149','#f0883e','#fde047','#7ee787','#58a6ff'][i];
          g.globalAlpha=0.85;
          g.beginPath(); g.ellipse(0,4,16-i*2.6,13-i*2.2,0,0,7); g.fill();
        }
        g.globalAlpha=1;
        g.fillStyle='#fff'; g.globalAlpha=.9;   // 外へ散る虹の輝き
        for(const[dx,dy,r2]of[[-20,-8,2.4],[19,-11,2],[22,4,1.8],[-18,9,2.2],[0,-19,2.6]]){
          g.beginPath(); g.arc(dx,dy,r2,0,7); g.fill(); }
        g.globalAlpha=1;
        g.fillStyle='#0d1117'; g.beginPath(); g.arc(-5,0,3,0,7); g.arc(5,0,3,0,7); g.fill();
        g.fillStyle='#fff'; g.beginPath(); g.arc(-6,-1,1.2,0,7); g.arc(4,-1,1.2,0,7); g.fill(); break;
      case 'm_abyss':  // 深淵の核: 暗黒球+紫リング
        g.fillStyle='#0d1117'; g.beginPath(); g.arc(0,0,9,0,7); g.fill();
        g.strokeStyle=c; g.lineWidth=3; g.beginPath(); g.ellipse(0,0,13,5,-0.5,0,7); g.stroke();
        g.fillStyle=c; g.beginPath(); g.arc(0,0,3,0,7); g.fill(); break;
      case 'settlement': {
        const v = o.v;
        if (v === 'fort') {          // 砦: 石塔+銃眼+旗
          g.fillStyle=c; rr(g,-14,-14,28,36,3);
          g.fillStyle=c; for(let i=-14;i<=8;i+=8) g.fillRect(i,-20,6,7);
          g.fillStyle='#0d1117'; rr(g,-5,8,10,14,3);
          g.strokeStyle='#6e4c30'; g.lineWidth=2; g.beginPath(); g.moveTo(12,-20); g.lineTo(12,-32); g.stroke();
          g.fillStyle=a; g.beginPath(); g.moveTo(12,-32); g.lineTo(24,-28); g.lineTo(12,-24); g.closePath(); g.fill();
        } else if (v === 'academy') { // 学術都市: 柱廊+ペディメント+書
          g.fillStyle=c; g.beginPath(); g.moveTo(-22,-8); g.lineTo(0,-22); g.lineTo(22,-8); g.closePath(); g.fill();
          g.fillStyle=c; for(let i=-18;i<=12;i+=10) g.fillRect(i,-6,5,24);
          g.fillStyle=c; g.fillRect(-22,18,44,5);
          g.fillStyle=a; rr(g,-7,-19,14,9,2);
        } else if (v === 'spring') {  // 泉: 水盤+噴水
          g.fillStyle=c; g.beginPath(); g.ellipse(0,12,22,9,0,0,7); g.fill();
          g.fillStyle=a; g.beginPath(); g.ellipse(0,11,17,6,0,0,7); g.fill();
          g.strokeStyle=a; g.lineWidth=3; g.beginPath(); g.moveTo(0,10); g.quadraticCurveTo(-3,-12,0,-18); g.stroke();
          g.fillStyle=a; g.beginPath(); g.arc(0,-18,4,0,7); g.fill();
          g.fillStyle=a; g.globalAlpha=.6; g.beginPath(); g.arc(-8,-6,2,0,7); g.arc(8,-8,2,0,7); g.fill(); g.globalAlpha=1;
        } else if (v === 'forge') {   // 鍛冶: 炉屋+煙突+火
          g.fillStyle=c; rr(g,-20,-4,40,26,3);
          g.fillStyle=c; g.fillRect(8,-20,9,18);
          g.fillStyle='#8b949e'; g.globalAlpha=.7; g.beginPath(); g.arc(13,-24,4,0,7); g.arc(17,-29,3,0,7); g.fill(); g.globalAlpha=1;
          g.fillStyle='#0d1117'; rr(g,-12,4,16,18,7);
          g.fillStyle=a; g.beginPath(); g.moveTo(-9,20); g.quadraticCurveTo(-4,6,0,20); g.quadraticCurveTo(-4,14,-9,20); g.fill();
        } else if (v === 'lodge') {   // 狩人・野営: テント+骨柱
          g.fillStyle=c; g.beginPath(); g.moveTo(-20,18); g.lineTo(0,-18); g.lineTo(20,18); g.closePath(); g.fill();
          g.fillStyle='#0d1117'; g.beginPath(); g.moveTo(-7,18); g.lineTo(0,2); g.lineTo(7,18); g.closePath(); g.fill();
          g.strokeStyle=a; g.lineWidth=2; g.beginPath(); g.moveTo(-4,-16); g.lineTo(-10,-26); g.moveTo(4,-16); g.lineTo(10,-26); g.stroke();
        } else if (v === 'emberforge') {  // 火の民: 岩の裂け目から噴く御神火
          g.fillStyle='#3a2a24'; g.beginPath();
          g.moveTo(-20,18); g.lineTo(-12,-6); g.lineTo(-4,4); g.lineTo(6,-10); g.lineTo(20,18); g.closePath(); g.fill();
          g.fillStyle=a; g.beginPath();
          g.moveTo(-6,6); g.quadraticCurveTo(-2,-10,1,-20); g.quadraticCurveTo(6,-8,8,6); g.closePath(); g.fill();
          g.fillStyle='#ffe0a8'; g.beginPath();
          g.moveTo(-2,6); g.quadraticCurveTo(0,-4,2,-12); g.quadraticCurveTo(4,-4,5,6); g.closePath(); g.fill();
        } else if (v === 'factory') {     // 工房都市: 並ぶ煙突と歯車
          g.fillStyle=c; rr(g,-22,-2,44,22,2);
          g.fillStyle='#57606a';
          for(const x of[-14,-2,10]) g.fillRect(x,-16,7,16);
          g.fillStyle='rgba(139,148,158,.55)';
          for(const[dx,dy,r2]of[[-11,-22,4],[-5,-28,3],[13,-21,3.4]]){g.beginPath();g.arc(dx,dy,r2,0,7);g.fill();}
          g.strokeStyle=a; g.lineWidth=2.4; g.beginPath(); g.arc(12,10,6,0,7); g.stroke();
          for(let i=0;i<6;i++){const t2=i/6*6.28; g.beginPath();
            g.moveTo(12+Math.cos(t2)*6,10+Math.sin(t2)*6);
            g.lineTo(12+Math.cos(t2)*9,10+Math.sin(t2)*9); g.stroke();}
        } else if (v === 'frostshrine') { // 霜の祠: 氷柱に覆われた小祠
          g.fillStyle='#5b6b78'; rr(g,-14,-2,28,20,2);
          g.fillStyle='#8fa8b5'; g.beginPath();
          g.moveTo(-19,-2); g.lineTo(0,-16); g.lineTo(19,-2); g.closePath(); g.fill();
          g.fillStyle=a;
          for(const[dx,h]of[[-13,9],[-6,13],[2,10],[10,14]]){ g.beginPath();
            g.moveTo(dx-2.4,-2); g.lineTo(dx,-2+h); g.lineTo(dx+2.4,-2); g.closePath(); g.fill(); }
          g.fillStyle='#0d1117'; rr(g,-4,6,8,12,1.5);
        } else if (v === 'abbeytower') {  // 修道院: 高い鐘楼
          g.fillStyle=c; rr(g,-8,-18,16,36,2);
          g.fillStyle=a; g.beginPath();
          g.moveTo(-11,-18); g.lineTo(0,-30); g.lineTo(11,-18); g.closePath(); g.fill();
          g.fillStyle='#0d1117'; g.beginPath(); g.arc(0,-11,4.6,Math.PI,0); g.closePath(); g.fill();
          g.fillStyle=a; g.beginPath(); g.arc(0,-11,2.4,0,7); g.fill();
          g.fillStyle=c; rr(g,-18,4,36,14,2);
        } else if (v === 'sunken') {      // 沈み都: 水面下に沈む尖塔と気泡
          g.fillStyle='rgba(120,190,215,.30)'; g.fillRect(-24,-8,48,28);
          g.fillStyle=c; g.beginPath();
          g.moveTo(-10,18); g.lineTo(-6,-12); g.lineTo(0,-22); g.lineTo(6,-12); g.lineTo(10,18); g.closePath(); g.fill();
          g.fillStyle=a; rr(g,-18,8,36,10,2);
          g.fillStyle='rgba(255,255,255,.5)';
          for(const[dx,dy,r2]of[[-14,-2,2.4],[13,-6,2],[8,-14,1.6]]){g.beginPath();g.arc(dx,dy,r2,0,7);g.fill();}
        } else if (v === 'camp') {        // 宿場: 並ぶ天幕と焚き火
          g.fillStyle=c;
          g.beginPath(); g.moveTo(-22,16); g.lineTo(-11,-6); g.lineTo(0,16); g.closePath(); g.fill();
          g.beginPath(); g.moveTo(2,16); g.lineTo(11,-2); g.lineTo(20,16); g.closePath(); g.fill();
          g.fillStyle='#0d1117';
          g.beginPath(); g.moveTo(-15,16); g.lineTo(-11,5); g.lineTo(-7,16); g.closePath(); g.fill();
          g.fillStyle=a; g.beginPath();
          g.moveTo(-3,18); g.quadraticCurveTo(0,8,3,18); g.closePath(); g.fill();
        } else if (v === 'hermit') {      // 庵: 岩室と一本の細道
          g.fillStyle='#4a5260'; g.beginPath();
          g.moveTo(-20,18); g.lineTo(-14,-6); g.lineTo(2,-14); g.lineTo(18,-2); g.lineTo(20,18); g.closePath(); g.fill();
          g.fillStyle='#0d1117'; g.beginPath(); g.arc(0,10,7,Math.PI,0); g.closePath(); g.fill();
          g.fillStyle=a; g.globalAlpha=.6; g.beginPath(); g.arc(0,12,3,0,7); g.fill(); g.globalAlpha=1;
          g.strokeStyle='rgba(214,192,148,.5)'; g.lineWidth=2.4;
          g.beginPath(); g.moveTo(0,18); g.lineTo(-4,24); g.stroke();
        } else if (v === 'mistobs') {     // 霧の観測所: 霧に沈む観測窓と霧笛
          g.fillStyle=c; rr(g,-16,-6,32,24,2);
          g.fillStyle='#0d1117'; g.beginPath(); g.arc(0,0,7,0,7); g.fill();
          g.fillStyle=a; g.beginPath(); g.arc(-2,-2,3,0,7); g.fill();
          g.fillStyle='#57606a'; g.beginPath();
          g.moveTo(11,-6); g.lineTo(20,-14); g.lineTo(20,-4); g.closePath(); g.fill();
          g.fillStyle='rgba(200,214,220,.45)';
          for(const[dy,w]of[[10,22],[15,17]]){ g.beginPath(); g.ellipse(0,dy,w,3.4,0,0,7); g.fill(); }
        } else if (v === 'spa') {     // 湯治場: 岩組みの湯壺+湯気+のれん
          g.fillStyle='#57606a'; g.beginPath(); g.ellipse(0,12,22,10,0,0,7); g.fill();
          g.fillStyle=a; g.beginPath(); g.ellipse(0,10,17,7,0,0,7); g.fill();
          g.strokeStyle='rgba(230,237,243,.65)'; g.lineWidth=2;
          g.beginPath(); g.moveTo(-7,4); g.quadraticCurveTo(-10,-6,-6,-14); g.stroke();
          g.beginPath(); g.moveTo(6,4); g.quadraticCurveTo(9,-8,5,-16); g.stroke();
          g.strokeStyle='#6e4c30'; g.lineWidth=2;
          g.beginPath(); g.moveTo(-16,-14); g.lineTo(-16,-26); g.moveTo(16,-14); g.lineTo(16,-26);
          g.moveTo(-16,-26); g.lineTo(16,-26); g.stroke();
          g.fillStyle=c; g.fillRect(-13,-26,26,7);
          g.fillStyle='#e6edf3'; g.font='7px sans-serif'; g.textAlign='center'; g.fillText('ゆ',0,-20);
        } else if (v === 'hut') {     // 隠れ里・庵: 丸屋根の庵
          g.fillStyle=a; g.beginPath(); g.arc(0,0,18,Math.PI,0); g.fill();
          g.fillStyle=c; rr(g,-16,0,32,20,3);
          g.fillStyle='#0d1117'; rr(g,-5,6,10,14,4);
          g.fillStyle='#ffd766'; g.beginPath(); g.arc(10,8,3,0,7); g.fill();
        } else if (v === 'observatory') { // 観測: ドーム+望遠鏡
          g.fillStyle=c; rr(g,-16,-2,32,24,3);
          g.fillStyle=a; g.beginPath(); g.arc(0,-2,16,Math.PI,0); g.fill();
          g.strokeStyle='#0d1117'; g.lineWidth=4; g.beginPath(); g.moveTo(2,-8); g.lineTo(14,-24); g.stroke();
        } else if (v === 'grove') {   // 森の社: 大樹+注連縄
          g.fillStyle='#6e4c30'; g.fillRect(-4,0,8,22);
          g.fillStyle=c; g.beginPath(); g.arc(0,-8,18,0,7); g.fill();
          g.fillStyle=a; g.beginPath(); g.arc(-9,-14,7,0,7); g.arc(10,-10,6,0,7); g.fill();
          g.strokeStyle='#e6edf3'; g.lineWidth=2; g.beginPath(); g.moveTo(-14,4); g.lineTo(14,4); g.stroke();
          g.fillStyle='#e6edf3'; g.fillRect(-8,4,3,6); g.fillRect(5,4,3,6);
        } else if (v === 'lighthouse') { // 港街: 縞の灯台
          g.fillStyle=c; g.beginPath(); g.moveTo(-10,22); g.lineTo(-6,-14); g.lineTo(6,-14); g.lineTo(10,22); g.closePath(); g.fill();
          g.fillStyle=a; g.beginPath(); g.moveTo(-9,14); g.lineTo(9,14); g.lineTo(8,6); g.lineTo(-8,6); g.closePath(); g.fill();
          g.beginPath(); g.moveTo(-7,-2); g.lineTo(7,-2); g.lineTo(6,-8); g.lineTo(-6,-8); g.closePath(); g.fill();
          g.fillStyle='#ffd766'; rr(g,-6,-22,12,8,2);
          g.globalAlpha=.35; g.beginPath(); g.moveTo(6,-18); g.lineTo(26,-26); g.lineTo(26,-10); g.closePath(); g.fill(); g.globalAlpha=1;
        } else if (v === 'abbey') {   // 修道院: 尖塔+三日月
          g.fillStyle=c; rr(g,-16,-6,32,28,3);
          g.fillStyle=c; g.beginPath(); g.moveTo(-16,-6); g.lineTo(0,-26); g.lineTo(16,-6); g.closePath(); g.fill();
          g.fillStyle='#0d1117'; g.beginPath(); g.arc(0,8,6,Math.PI,0); g.fill(); g.fillRect(-6,8,12,14);
          g.fillStyle=a; g.beginPath(); g.arc(0,-30,5,0,7); g.fill();
          g.fillStyle=c; g.beginPath(); g.arc(2,-31,4.5,0,7); g.fill();
        } else if (v === 'tower') {   // 塔の街: 高塔+避雷針
          g.fillStyle=c; g.beginPath(); g.moveTo(-12,22); g.lineTo(-7,-18); g.lineTo(7,-18); g.lineTo(12,22); g.closePath(); g.fill();
          g.fillStyle=a; rr(g,-9,-24,18,8,2);
          g.strokeStyle=a; g.lineWidth=2; g.beginPath(); g.moveTo(0,-24); g.lineTo(0,-32); g.stroke();
          g.fillStyle='#fde047'; g.beginPath(); g.moveTo(0,-32); g.lineTo(4,-27); g.lineTo(1,-27); g.lineTo(5,-21); g.stroke();
          g.fillStyle='#0d1117'; rr(g,-4,6,8,16,3);
        } else if (v === 'grave') {   // 弔いの村: 墓碑+蝋燭
          g.fillStyle=c; g.beginPath(); g.arc(-6,-6,9,Math.PI,0); g.fill(); g.fillRect(-15,-6,18,26);
          g.strokeStyle='#0d1117'; g.lineWidth=2; g.beginPath(); g.moveTo(-6,-8); g.lineTo(-6,4); g.moveTo(-11,-3); g.lineTo(-1,-3); g.stroke();
          g.fillStyle='#e6edf3'; g.fillRect(10,4,5,14);
          g.fillStyle=a; g.beginPath(); g.ellipse(12.5,0,3,5,0,0,7); g.fill();
        } else if (v === 'temple') {  // 神殿都市: 日輪の神殿
          g.fillStyle=a; g.beginPath(); g.arc(0,-16,8,0,7); g.fill();
          g.strokeStyle=a; g.lineWidth=2;
          for(let i=0;i<8;i++){ const t=i/8*Math.PI*2; g.beginPath(); g.moveTo(Math.cos(t)*10,-16+Math.sin(t)*10); g.lineTo(Math.cos(t)*14,-16+Math.sin(t)*14); g.stroke(); }
          g.fillStyle=c; g.fillRect(-20,-4,40,4); for(let i=-16;i<=11;i+=9) g.fillRect(i,0,5,18); g.fillRect(-20,18,40,5);
        } else if (v === 'portal') {  // 虚無: 渦の門
          g.strokeStyle=c; g.lineWidth=5; g.beginPath(); g.ellipse(0,0,14,20,0,0,7); g.stroke();
          g.strokeStyle=a; g.lineWidth=2;
          g.beginPath(); g.arc(0,0,9,0,4.5); g.stroke();
          g.beginPath(); g.arc(0,0,5,2,6.5); g.stroke();
          g.fillStyle=a; g.beginPath(); g.arc(0,0,2,0,7); g.fill();
        } else if (v === 'castle') {  // 最果ての城: 天守+双塔
          g.fillStyle=c; rr(g,-22,-4,12,26,2); rr(g,10,-4,12,26,2);
          for(const x of [-22,10]) for(let i=0;i<2;i++) g.fillRect(x+i*7,-9,5,5);
          g.fillStyle=c; rr(g,-12,-18,24,40,2);
          for(let i=-12;i<=6;i+=8) g.fillRect(i,-23,5,5);
          g.fillStyle='#0d1117'; g.beginPath(); g.arc(0,10,6,Math.PI,0); g.fill(); g.fillRect(-6,10,12,12);
          g.fillStyle=a; g.beginPath(); g.moveTo(0,-23); g.lineTo(0,-33); g.lineTo(10,-30); g.lineTo(0,-27); g.fill();
        }
        break; }
      case 'building':
        if(o.well){                  // 井戸: 石積みと屋根を支える柱・釣瓶
          g.fillStyle='#57606a'; rr(g,-13,2,26,16,3);
          g.strokeStyle='#3d4650'; g.lineWidth=1.4;
          g.beginPath(); g.moveTo(-13,9); g.lineTo(13,9); g.moveTo(0,2); g.lineTo(0,9); g.stroke();
          g.fillStyle='#6e4c30'; g.fillRect(-11,-14,3.4,17); g.fillRect(7.6,-14,3.4,17);
          g.fillStyle=c; g.beginPath();
          g.moveTo(-16,-14); g.lineTo(0,-24); g.lineTo(16,-14); g.closePath(); g.fill();
          g.strokeStyle=a; g.lineWidth=1.4; g.beginPath(); g.moveTo(0,-14); g.lineTo(0,-4); g.stroke();
          g.fillStyle='#6e4c30'; rr(g,-4,-6,8,6,1);
          break;
        }
        if(o.row){                   // 集合家屋: 二棟が寄り添う切妻
          g.fillStyle=c; rr(g,-20,-4,22,20,2);
          g.beginPath(); g.moveTo(-23,-4); g.lineTo(-9,-17); g.lineTo(5,-4); g.closePath(); g.fill();
          g.fillStyle='#5b626b'; rr(g,2,0,18,16,2);
          g.beginPath(); g.moveTo(0,0); g.lineTo(11,-11); g.lineTo(22,0); g.closePath(); g.fill();
          g.fillStyle=a; g.fillRect(-14,2,6,6); g.fillRect(8,5,5,5);
          g.fillStyle='#0d1117'; rr(g,-5,6,7,10,1.5);
          g.fillStyle='#57606a'; g.fillRect(-4,-22,4,6);   // 煙突
          break;
        }
        g.fillStyle=c; rr(g,-18,-8,36,24,4);   // 一軒家
        g.beginPath(); g.moveTo(-22,-8); g.lineTo(0,-24); g.lineTo(22,-8); g.closePath(); g.fill();
        g.fillStyle='#0d1117'; rr(g,-6,2,12,14,3);
        g.fillStyle=a; g.fillRect(-15,-2,7,7); g.fillRect(8,-2,7,7);   // 灯りの窓
        g.fillStyle='#57606a'; g.fillRect(9,-22,5,8);                  // 煙突
        break;
      case 'altarb':   // 強化の祭壇: 段のある石壇+魂の炎(先人オウが築いたもの)
        g.fillStyle='#57606a'; rr(g,-24,14,48,9,3);
        g.fillStyle=c;         rr(g,-18,6,36,10,3);
        g.fillStyle='#adbac7'; rr(g,-11,-2,22,10,3);
        g.fillStyle=a;
        g.beginPath(); g.moveTo(-7,-2); g.quadraticCurveTo(0,-26,7,-2); g.closePath(); g.fill();
        g.fillStyle='#fff8c5';
        g.beginPath(); g.moveTo(-3,-2); g.quadraticCurveTo(0,-15,3,-2); g.closePath(); g.fill(); break;
      case 'labb':     // 素材研究所: 丸屋根の工房+蒸留器の煙突
        g.fillStyle='#6e4c30'; rr(g,-19,-2,38,20,3);
        g.fillStyle=c;
        g.beginPath(); g.moveTo(-22,-2); g.quadraticCurveTo(0,-26,22,-2); g.closePath(); g.fill();
        g.fillStyle='#0d1117'; rr(g,-5,4,10,14,3);
        g.fillStyle='#57606a'; g.fillRect(12,-18,5,14);
        g.fillStyle=a; g.beginPath(); g.arc(14.5,-21,4.5,0,7); g.fill();
        g.fillStyle='#fff'; g.globalAlpha=.6; g.beginPath(); g.arc(13.5,-22,1.5,0,7); g.fill(); g.globalAlpha=1; break;
      case 'campb':    // 仲間の宿舎: 大小の天幕
        g.fillStyle='#3d4a63';
        g.beginPath(); g.moveTo(6,4); g.lineTo(17,-12); g.lineTo(27,4); g.closePath(); g.fill();
        g.fillStyle=c;
        g.beginPath(); g.moveTo(-26,16); g.lineTo(-4,-20); g.lineTo(18,16); g.closePath(); g.fill();
        g.fillStyle='#0d1117';
        g.beginPath(); g.moveTo(-10,16); g.lineTo(-4,3); g.lineTo(2,16); g.closePath(); g.fill();
        g.strokeStyle=a; g.lineWidth=2;
        g.beginPath(); g.moveTo(-4,-20); g.lineTo(-4,-27); g.stroke();
        g.fillStyle=a; g.beginPath(); g.moveTo(-4,-27); g.lineTo(6,-24); g.lineTo(-4,-21); g.closePath(); g.fill(); break;
      case 'libb':     // スキル書庫: 本の詰まった塔
        g.fillStyle='#57443a'; rr(g,-14,-16,28,36,3);
        g.fillStyle=c;
        g.beginPath(); g.moveTo(-18,-16); g.lineTo(0,-28); g.lineTo(18,-16); g.closePath(); g.fill();
        for (let i=0;i<3;i++){
          g.fillStyle='#2b2622'; g.fillRect(-11,-12+i*11,22,8);
          const bc=['#f0883e',a,'#7ee787','#58a6ff','#ffd766'];
          for (let j=0;j<5;j++){ g.fillStyle=bc[(i*2+j)%bc.length]; g.fillRect(-10+j*4.3,-11+i*11,3.2,6); }
        } break;
      case 'armoryb':  // 武器庫: 石造りの武具庫+交差する剣
        g.fillStyle=c; rr(g,-20,-6,40,24,3);
        g.fillStyle='#484f58';
        g.beginPath(); g.moveTo(-23,-6); g.lineTo(0,-18); g.lineTo(23,-6); g.closePath(); g.fill();
        g.fillStyle='#0d1117'; rr(g,-6,2,12,16,3);
        g.save(); g.translate(0,-22);
        g.strokeStyle='#c9d1d9'; g.lineWidth=3;
        g.beginPath(); g.moveTo(-8,-7); g.lineTo(8,7); g.moveTo(8,-7); g.lineTo(-8,7); g.stroke();
        g.strokeStyle=a; g.lineWidth=2;
        g.beginPath(); g.moveTo(-5,3); g.lineTo(-8,7); g.moveTo(5,3); g.lineTo(8,7); g.stroke();
        g.restore(); break;
      case 'warb':     // 武練場: 稽古場の的と交差した槍
        g.fillStyle='#57443a'; rr(g,-22,12,44,8,2);
        g.strokeStyle='#8b5a2b'; g.lineWidth=3;
        g.beginPath(); g.moveTo(-14,14); g.lineTo(6,-22); g.moveTo(14,14); g.lineTo(-6,-22); g.stroke();
        g.fillStyle=c; g.beginPath(); g.moveTo(6,-22); g.lineTo(9,-29); g.lineTo(11,-21); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(-6,-22); g.lineTo(-9,-29); g.lineTo(-11,-21); g.closePath(); g.fill();
        g.fillStyle='#e6d2b5'; g.beginPath(); g.arc(0,-2,10,0,7); g.fill();
        g.fillStyle=c; g.beginPath(); g.arc(0,-2,6.5,0,7); g.fill();
        g.fillStyle='#e6d2b5'; g.beginPath(); g.arc(0,-2,3,0,7); g.fill(); break;
      case 'lifeb':    // 生命の祠: 苔むした小祠と灯り
        g.fillStyle='#57606a'; rr(g,-16,-4,32,22,3);
        g.fillStyle='#2a2f36'; rr(g,-6,2,12,16,3);
        g.fillStyle='#6e4c30';
        g.beginPath(); g.moveTo(-21,-4); g.lineTo(0,-18); g.lineTo(21,-4); g.closePath(); g.fill();
        g.fillStyle=c; rr(g,-16,10,10,8,2); rr(g,8,-2,8,6,2);   // 苔
        g.fillStyle=a; g.globalAlpha=.85; rr(g,-3,4,6,9,2); g.globalAlpha=1; break;
      case 'loreb':    // 秘宝の蔵: 白壁の蔵に金の飾り
        g.fillStyle='#c9d1d9'; rr(g,-17,-8,34,26,2);
        g.fillStyle='#57606a';
        g.beginPath(); g.moveTo(-21,-8); g.lineTo(0,-22); g.lineTo(21,-8); g.closePath(); g.fill();
        g.fillStyle='#8b949e'; rr(g,-17,12,34,6,2);
        g.fillStyle='#0d1117'; rr(g,-6,-2,12,18,2);
        g.fillStyle=a; g.beginPath(); g.arc(0,4,3.4,0,7); g.fill();
        g.fillStyle=c; g.fillRect(-17,-8,34,2.5); break;
      case 'steleb':   // 記録の石碑: 刻まれた立石
        g.fillStyle='#57606a'; rr(g,-15,16,30,7,2);
        g.fillStyle=c; rr(g,-11,-22,22,40,4);
        g.fillStyle=a; g.globalAlpha=.8;
        for (let i=0;i<4;i++) g.fillRect(-6,-16+i*8,12,2.5);
        g.globalAlpha=1; break;
      case 'boardk':   // 依頼板: 2本柱+横板+貼り紙(家ではなく掲示板に見えるように)
        g.fillStyle=c; g.fillRect(-16,-8,4,28); g.fillRect(12,-8,4,28);
        g.fillStyle='#8b5a2b'; rr(g,-21,-18,42,18,2);
        g.fillStyle=a; g.fillRect(-16,-15,13,11); g.fillRect(2,-16,13,12);
        g.fillStyle='#57443a';
        g.fillRect(-13,-12,7,1.6); g.fillRect(-13,-9,7,1.6);
        g.fillRect(5,-13,8,1.6); g.fillRect(5,-10,8,1.6); break;
      case 'drytree':
        g.strokeStyle=a; g.lineWidth=5; g.lineCap='round';
        g.beginPath(); g.moveTo(0,24); g.lineTo(0,-4); g.stroke();
        g.lineWidth=3;
        g.beginPath(); g.moveTo(0,-2); g.lineTo(-12,-16); g.moveTo(-12,-16); g.lineTo(-16,-24); g.moveTo(-12,-16); g.lineTo(-4,-22); g.stroke();
        g.beginPath(); g.moveTo(0,2); g.lineTo(12,-10); g.moveTo(12,-10); g.lineTo(18,-18); g.moveTo(12,-10); g.lineTo(8,-20); g.stroke();
        g.strokeStyle=c; g.lineWidth=2;
        g.beginPath(); g.moveTo(0,10); g.lineTo(8,4); g.stroke();
        g.lineCap='butt'; break;
      case 'gate':
        g.strokeStyle=c; g.lineWidth=5;
        g.beginPath(); g.ellipse(0,0,13,19,0,0,7); g.stroke();
        g.fillStyle=a; g.globalAlpha=.5; g.beginPath(); g.ellipse(0,0,9,15,0,0,7); g.fill(); g.globalAlpha=1;
        if(o.warp){                   // 転移の渦(魂の広場のゲートとは別物)。外側にもう一つ環
          g.strokeStyle=c; g.lineWidth=2;
          g.beginPath(); g.ellipse(0,0,19,25,0,0,7); g.stroke();
          g.strokeStyle=a; g.lineWidth=2;
          g.beginPath();
          for(let i=0;i<=40;i++){ const t2=i/40*4.2, r2=1.2+t2*2.1;
            const x2=Math.cos(t2)*r2*0.7, y2=Math.sin(t2)*r2;
            i?g.lineTo(x2,y2):g.moveTo(x2,y2); }
          g.stroke();
        }
        break;
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

  // キャラの周りに細い暗色の縁取りを焼き込む(密集時に個体の区切りが見えるように)。
  // シルエットを8方向に1px弱ずらして下に敷くだけ ― 見た目は普通のドット絵の輪郭線
  function outline(src){
    const sil = document.createElement('canvas'); sil.width = S; sil.height = S;
    const sg = sil.getContext('2d');
    sg.drawImage(src, 0, 0);
    sg.globalCompositeOperation = 'source-in';
    sg.fillStyle = 'rgba(13,17,23,0.9)';
    sg.fillRect(0, 0, S, S);
    const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const g = cv.getContext('2d');
    const o = 2;   // 64px基準の2px ≈ 画面上約1px
    for (const [dx, dy] of [[o,0],[-o,0],[0,o],[0,-o],[o,o],[o,-o],[-o,o],[-o,-o]]) g.drawImage(sil, dx, dy);
    g.drawImage(src, 0, 0);
    return cv;
  }

  // 統一ライティング: どのスプライトも「上からの淡い光+足元の落ち影」を
  // 生成時に一度だけ焼き込む ― 全ての絵が同じ光の中にいる質感になる
  function shadePass(cv){
    const g = cv.getContext('2d');
    g.save();
    g.globalCompositeOperation = 'source-atop';
    const gr = g.createLinearGradient(0, 0, 0, S);
    gr.addColorStop(0, 'rgba(255,255,255,.16)');
    gr.addColorStop(0.42, 'rgba(255,255,255,0)');
    gr.addColorStop(1, 'rgba(8,10,20,.20)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    g.restore();
    return cv;
  }

  function gen(id){
    const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const g = cv.getContext('2d');
    painter(g, DEFS[id] || { kind:'?', c:'#f0f', a:'#fff' });
    shadePass(cv);
    // 輪郭はキャラ(敵・仲間に使う en_/boss_ と主人公)だけ。オブジェクトやUIアイコンはそのまま
    if (/^(en_|boss_)/.test(id) || id === 'player') return outline(cv);
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

  // 色合成した派生スプライト(色違い・味方の色分けに使う)。
  // 「色相だけ」を乗せて明暗は残す ― 目・口・輪郭が塗り潰されず、
  // 色違いでもキャラの顔がちゃんと見える(ベタ塗りの丸になるのを防ぐ)
  const tintCache = {};
  function tinted(id, color, strength){
    const key = id + '|' + color + '|' + (strength || 0.5);
    if (tintCache[key]) return tintCache[key];
    const src = get(id);
    const cv = document.createElement('canvas');
    cv.width = src.width || 64; cv.height = src.height || 64;
    const c = cv.getContext('2d');
    c.drawImage(src, 0, 0, cv.width, cv.height);
    c.globalCompositeOperation = 'color';   // 色相・彩度だけ変える(明暗=顔のパーツは残る)
    c.globalAlpha = Math.min(1, (strength || 0.5) * 1.8);
    c.fillStyle = color;
    c.fillRect(0, 0, cv.width, cv.height);
    c.globalCompositeOperation = 'destination-in';   // キャラの形に切り抜き直す
    c.globalAlpha = 1;
    c.drawImage(src, 0, 0, cv.width, cv.height);
    tintCache[key] = cv;
    return cv;
  }
  function drawTinted(g, id, x, y, size, flip, color, strength){
    const im = tinted(id, color, strength);
    g.save(); g.translate(x, y);
    if (flip) g.scale(-1, 1);
    g.drawImage(im, -size/2, -size/2, size, size);
    g.restore();
  }

  // ---- 色違い(段階)・大きさ(段階)ごとの固有の姿 ----
  // 色を塗る/拡大するだけでは「同じ魔物」に見えてしまう。段階ごとに**体そのもの**を
  // 変える ― 角や王冠のような「付け足した物」は置かない。
  // 変えるのは (1) 体つき(縦横の比率) (2) 体の表面の質 (3) 輪郭の硬さ の3つだけで、
  // どれも体の内側に収まる。生成は一度だけでキャッシュする。
  //   色違い: 1金=body硬化(厚い縁で装甲のような体) / 2紅=膨れて体に赤熱の亀裂 /
  //           3紫=細く伸び、下半身が影に溶ける / 4青白=体が結晶の面に割れる
  //   大きさ: 1大=肉厚(横に張り、下半分が重く沈む) / 2巨=岩のような粗い肌
  const RANK_BODY = [
    null,
    { sx:0.96, sy:1.06, edge:'#8a6a1e', glow:null },              // 金: 硬化
    { sx:1.07, sy:1.06, edge:null,      glow:'#ff7b4a' },         // 紅: 膨張と亀裂
    { sx:0.92, sy:1.14, edge:null,      glow:null },              // 紫: 細く伸びる
    { sx:1.00, sy:1.00, edge:'#bfefff', glow:null },              // 青白: 結晶化
  ];
  const SIZE_BODY = [null, { sx:1.13, sy:0.95 }, { sx:1.21, sy:0.90 }];

  // 体つき(縦横比)を変えて描く。付け足しではなく、体そのものの形が変わる
  function drawBody(g, src, rank, tier){
    const r = RANK_BODY[rank] || null, t = SIZE_BODY[tier] || null;
    const sx = (r ? r.sx : 1) * (t ? t.sx : 1);
    const sy = (r ? r.sy : 1) * (t ? t.sy : 1);
    // 金: 体の縁を厚くして装甲のような肌にする(輪郭を体の一部として太らせる)
    if (r && r.edge && rank === 1) {
      g.save(); g.translate(S / 2, S / 2); g.scale(sx, sy);
      g.globalAlpha = 0.85;
      for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1.5, -1.5], [1.5, 1.5]])
        g.drawImage(src, -S / 2 + dx, -S / 2 + dy, S, S);
      g.globalCompositeOperation = 'source-atop';
      g.globalAlpha = 0.55; g.fillStyle = r.edge; g.fillRect(-S / 2, -S / 2, S, S);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.restore();
    }
    g.save(); g.translate(S / 2, S / 2); g.scale(sx, sy);
    g.drawImage(src, -S / 2, -S / 2, S, S);
    g.restore();
  }

  // 体の表面の質を変える。source-atop で「体の中だけ」に乗るので、
  // 貼り付けた物には見えず、その魔物の肌そのものが変わったように見える
  function skinOf(g, rank, tier){
    g.save();
    g.globalCompositeOperation = 'source-atop';
    g.translate(S / 2, S / 2);
    if (rank === 2) {                    // 紅: 体を走る赤熱の亀裂
      g.strokeStyle = 'rgba(255,120,70,.85)'; g.lineWidth = 2; g.lineCap = 'round';
      for (const p2 of [[[-13, -8], [-5, 0], [-9, 9]], [[8, -11], [3, -1], [11, 6]], [[-2, 6], [4, 13]]]) {
        g.beginPath(); g.moveTo(p2[0][0], p2[0][1]);
        for (let i = 1; i < p2.length; i++) g.lineTo(p2[i][0], p2[i][1]);
        g.stroke();
      }
      g.strokeStyle = 'rgba(255,220,150,.55)'; g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(-13, -8); g.lineTo(-5, 0); g.lineTo(-9, 9); g.stroke();
    } else if (rank === 3) {             // 紫: 下半身が影に溶ける(体の存在が薄れる)
      const gr = g.createLinearGradient(0, 2, 0, 24);
      gr.addColorStop(0, 'rgba(60,30,90,0)');
      gr.addColorStop(1, 'rgba(30,12,50,.72)');
      g.fillStyle = gr; g.fillRect(-S / 2, 2, S, S / 2 - 2);
    } else if (rank === 4) {             // 青白: 体が結晶の面に割れる
      g.fillStyle = 'rgba(235,252,255,.30)';
      for (const p2 of [[[-14, -6], [-4, -12], [-2, 2], [-12, 6]], [[3, -10], [13, -3], [8, 8], [1, 3]],
                        [[-7, 8], [2, 6], [0, 17], [-8, 15]]]) {
        g.beginPath(); g.moveTo(p2[0][0], p2[0][1]);
        for (let i = 1; i < p2.length; i++) g.lineTo(p2[i][0], p2[i][1]);
        g.closePath(); g.fill();
      }
      g.strokeStyle = 'rgba(160,230,255,.6)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-4, -12); g.lineTo(-2, 2); g.lineTo(2, 6); g.stroke();
    }
    if (tier === 1) {                    // 大: 下半分が重く沈む(肉の厚み)
      const gr = g.createLinearGradient(0, 0, 0, 22);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.38)');
      g.fillStyle = gr; g.fillRect(-S / 2, 0, S, S / 2);
    } else if (tier === 2) {             // 巨: 岩のような粗い肌
      g.fillStyle = 'rgba(0,0,0,.26)';
      for (const [x, y, r2] of [[-12, -4, 4.5], [5, -9, 3.6], [10, 4, 5.2], [-6, 9, 4.2], [1, 15, 3.4]]) {
        g.beginPath(); g.arc(x, y, r2, 0, 7); g.fill();
      }
      g.fillStyle = 'rgba(255,255,255,.12)';
      for (const [x, y, r2] of [[-14, -6, 2.6], [3, -11, 2.2], [8, 2, 3], [-8, 7, 2.4]]) {
        g.beginPath(); g.arc(x, y, r2, 0, 7); g.fill();
      }
    }
    g.restore();
  }

  // 仲間の色: 敵だった時の色をそのまま残し、全員に同じ量の緑を一枚重ねるだけ。
  // source-atop で体の内側にしか乗らないので、形は変わらず、
  // 元が赤い魔物は「赤みの残る緑」、青い魔物は「青みの残る緑」になる。
  const ALLY_TINT = '#3fb950', ALLY_ALPHA = 0.34;

  // 段階つきの姿(キャッシュ付き)。tint は色違いの体色、ally は仲間の重ね色
  const varCache = {};
  let varCount = 0;
  function variant(id, rank, sizeTier, tint, strength, ally){
    const key = id + '|' + (rank || 0) + '|' + (sizeTier || 0) + '|' + (tint || '') +
                '|' + (strength || '') + '|' + (ally ? 'a' : '');
    if (varCache[key]) return varCache[key];
    const base = tint ? tinted(id, tint, strength) : get(id);
    if (!rank && !sizeTier && !ally) return (varCache[key] = base);
    // 種類が増えすぎたら一度捨てる(長時間の周回でも画像が積み上がらない)
    if (varCount > 900) { for (const k in varCache) delete varCache[k]; varCount = 0; }
    const cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    const g = cv.getContext('2d');
    drawBody(g, base, rank || 0, sizeTier || 0);   // 体つきそのものを変える
    skinOf(g, rank || 0, sizeTier || 0);           // 体の表面の質を変える
    if (ally) {                                    // 仲間: 全員に同じ量の緑を一枚
      g.globalCompositeOperation = 'source-atop';
      g.globalAlpha = ALLY_ALPHA; g.fillStyle = ALLY_TINT;
      g.fillRect(0, 0, S, S);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    }
    varCount++;
    return (varCache[key] = cv);
  }
  function drawVariant(g, id, x, y, size, flip, rank, sizeTier, tint, strength, ally){
    const im = variant(id, rank, sizeTier, tint, strength, ally);
    g.save(); g.translate(x, y);
    if (flip) g.scale(-1, 1);
    g.drawImage(im, -size / 2, -size / 2, size, size);
    g.restore();
  }

  return { get, draw, tinted, drawTinted, variant, drawVariant, loadOverrides, DEFS };
})();
