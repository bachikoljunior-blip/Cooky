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
    en_rainbow: { kind:'rainbowblob', c:'#e879f9', a:'#fde047' },
    // --- バイオドーム別の敵(既存kindを配色替えして種類を増やす) ---
    en_boar:     { kind:'beast',    c:'#8b5a2b', a:'#5a3a1b', opt:{big:true} },
    en_mush:     { kind:'blob',     c:'#f0883e', a:'#7ee787' },
    en_iceslime: { kind:'blob',     c:'#a5d8ff', a:'#58a6ff' },
    en_frostwolf:{ kind:'beast',    c:'#cbe6f0', a:'#5a7585' },
    en_yeti:     { kind:'humanoid', c:'#e6edf3', a:'#8fa8b5', opt:{big:true} },
    en_icewisp:  { kind:'ghost',    c:'#a5d8ff', a:'#ffffff' },
    en_lavaslime:{ kind:'blob',     c:'#ff6b35', a:'#8b1e24' },
    en_emberbat: { kind:'flying',   c:'#f85149', a:'#ffa657' },
    en_fireimp:  { kind:'demon',    c:'#ff6b35', a:'#ffd766' },
    en_magmagolem:{kind:'golem',    c:'#733220', a:'#ff6b35' },
    en_scarab:   { kind:'crab',     c:'#d29922', a:'#8a6d35' },
    en_mummy:    { kind:'humanoid', c:'#b8b098', a:'#8a6d35' },
    en_sandwurm: { kind:'serpent',  c:'#b09252', a:'#d29922' },
    en_shade:    { kind:'ghost',    c:'#6e40c9', a:'#c084fc', opt:{hood:true} },
    en_voidwisp: { kind:'ghost',    c:'#a78bfa', a:'#76e3ea' },
    en_hornedimp:{ kind:'demon',    c:'#8b1e24', a:'#c084fc' },
    en_stormwisp:{ kind:'ghost',    c:'#fde047', a:'#8b949e' },
    en_galehound:{ kind:'beast',    c:'#8b949e', a:'#76e3ea' },
    en_kingslime: { kind:'blob',     c:'#2ea043', a:'#7ee787' },
    en_frostgiant:{ kind:'humanoid', c:'#a5d8ff', a:'#5a7585', opt:{big:true} },
    en_magmatitan:{ kind:'golem',    c:'#8b1e24', a:'#ff6b35' },
    en_voidtitan: { kind:'golem',    c:'#2d1b4e', a:'#a78bfa' },

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
    ob_goldtree:{ kind:'tree',    c:'#f59e0b', a:'#92600a' },
    ob_pearl:   { kind:'pearlobj',c:'#f1f5f9', a:'#ffd6a5' },
    ob_flag:    { kind:'flag',    c:'#58a6ff', a:'#e6edf3' },
    ob_dock:    { kind:'dock',    c:'#8b5a2b', a:'#e6edf3' },

    coin:       { kind:'coin',    c:'#ffd766', a:'#d29922' },
    potion:     { kind:'potion',  c:'#f85149', a:'#e6edf3' },

    npc_elder:  { kind:'humanoid',c:'#8b949e', a:'#e6edf3', opt:{staff:true} },
    npc_smith:  { kind:'humanoid',c:'#f0883e', a:'#6e4c30', opt:{big:true} },
    npc_miko:   { kind:'humanoid',c:'#f1f5f9', a:'#f85149', opt:{staff:true} },
    npc_sailor: { kind:'humanoid',c:'#1f6feb', a:'#e6edf3', opt:{} },
    npc_sage:   { kind:'ghost',   c:'#6e40c9', a:'#d2a8ff', opt:{hood:true} },
    npc_scholar:{ kind:'humanoid',c:'#3fb950', a:'#a5d8ff', opt:{} },
    npc_girl:   { kind:'humanoid',c:'#f778ba', a:'#ffd6a5', opt:{} },
    npc_boy:    { kind:'humanoid',c:'#57ab5a', a:'#a5d8ff', opt:{} },
    npc_mapper: { kind:'humanoid',c:'#d29922', a:'#e6edf3', opt:{staff:true} },
    npc_miner:  { kind:'humanoid',c:'#8b5a2b', a:'#9aa5b1', opt:{big:true} },
    // 基地の転移シンボル(集落の特色に合わせた建造物)
    base_fort:    { kind:'settlement', c:'#9aa5b1', a:'#58a6ff', opt:{v:'fort'} },
    base_academy: { kind:'settlement', c:'#e6d9b8', a:'#3fb950', opt:{v:'academy'} },
    base_spring:  { kind:'settlement', c:'#8fa8b5', a:'#76e3ea', opt:{v:'spring'} },
    base_forge:   { kind:'settlement', c:'#6e4c30', a:'#ff6b35', opt:{v:'forge'} },
    base_lodge:   { kind:'settlement', c:'#b08968', a:'#e6edf3', opt:{v:'lodge'} },
    base_camp:    { kind:'settlement', c:'#8f8a78', a:'#e6edf3', opt:{v:'lodge'} },
    base_poet:    { kind:'settlement', c:'#5c4a5e', a:'#f778ba', opt:{v:'hut'} },
    base_hermit:  { kind:'settlement', c:'#33244a', a:'#a78bfa', opt:{v:'hut'} },
    base_star:    { kind:'settlement', c:'#3a4468', a:'#a5d8ff', opt:{v:'observatory'} },
    base_mist:    { kind:'settlement', c:'#6e7a6a', a:'#a5d8ff', opt:{v:'observatory'} },
    base_grove:   { kind:'settlement', c:'#2ea043', a:'#7ee787', opt:{v:'grove'} },
    base_port:    { kind:'settlement', c:'#e6edf3', a:'#f85149', opt:{v:'lighthouse'} },
    base_shrine:  { kind:'settlement', c:'#484f58', a:'#2dd4bf', opt:{v:'abbey'} },
    base_frost:   { kind:'settlement', c:'#8fa8b5', a:'#a5d8ff', opt:{v:'abbey'} },
    base_ember:   { kind:'settlement', c:'#5c3a28', a:'#ff6b35', opt:{v:'forge'} },
    base_factory: { kind:'settlement', c:'#484f58', a:'#fde047', opt:{v:'forge'} },
    base_abbey:   { kind:'settlement', c:'#3a4468', a:'#f1f5f9', opt:{v:'abbey'} },
    base_tower:   { kind:'settlement', c:'#5a655c', a:'#9aa5b1', opt:{v:'tower'} },
    base_grave:   { kind:'settlement', c:'#8b949e', a:'#ffd766', opt:{v:'grave'} },
    base_temple:  { kind:'settlement', c:'#a8894a', a:'#ffd766', opt:{v:'temple'} },
    base_portal:  { kind:'settlement', c:'#6e40c9', a:'#76e3ea', opt:{v:'portal'} },
    base_castle:  { kind:'settlement', c:'#54242c', a:'#ffd766', opt:{v:'castle'} },
    base_sunken:  { kind:'settlement', c:'#2dd4bf', a:'#76e3ea', opt:{v:'spring'} },
    ob_house:   { kind:'building',c:'#8b5a2b', a:'#e6edf3', opt:{sym:'🏠'} },
    ob_house2:  { kind:'building',c:'#6e7681', a:'#ffd766', opt:{sym:'🏘'} },
    ob_well:    { kind:'building',c:'#8fa8b5', a:'#76e3ea', opt:{sym:'⛲'} },
    st_altar:   { kind:'building',c:'#f0883e', a:'#ffd766', opt:{sym:'⚔'} },
    st_lab:     { kind:'building',c:'#3fb950', a:'#7ee787', opt:{sym:'⚗'} },
    st_camp:    { kind:'building',c:'#58a6ff', a:'#a5d8ff', opt:{sym:'🏕'} },
    st_lib:     { kind:'building',c:'#c084fc', a:'#d2a8ff', opt:{sym:'📖'} },
    st_armory:  { kind:'building',c:'#f85149', a:'#ffa198', opt:{sym:'🗡'} },
    st_war:     { kind:'building',c:'#da3633', a:'#ffb3ad', opt:{sym:'⚔'} },
    st_life:    { kind:'building',c:'#2ea043', a:'#7ee787', opt:{sym:'❤'} },
    st_lore:    { kind:'building',c:'#d29922', a:'#ffd766', opt:{sym:'📦'} },
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
    sk_charisma:{ kind:'icon', c:'#f778ba', a:'#ffd6a5', opt:{sym:'♪' } },
    sk_bond:    { kind:'icon', c:'#3fb950', a:'#7ee787', opt:{sym:'∞' } },
    sk_fear:    { kind:'icon', c:'#da3633', a:'#ffa657', opt:{sym:'!' } },
    sk_area:    { kind:'icon', c:'#76e3ea', a:'#a5d8ff', opt:{sym:'◎' } },
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
    sk_fguard:  { kind:'icon', c:'#9aa5b1', a:'#58a6ff', opt:{sym:'⛨' } },
    sk_moonrush:{ kind:'icon', c:'#a5d8ff', a:'#f1f5f9', opt:{sym:'♞' } },
    sk_stormcall:{ kind:'icon', c:'#fde047', a:'#8b949e', opt:{sym:'⚡' } },
    sk_gravemark:{ kind:'icon', c:'#c084fc', a:'#e6edf3', opt:{sym:'✝' } },
    sk_sunburst:{ kind:'icon', c:'#d29922', a:'#ff6b35', opt:{sym:'☀' } },
    sk_voidgrip:{ kind:'icon', c:'#6e40c9', a:'#76e3ea', opt:{sym:'◉' } },
    sk_endpact: { kind:'icon', c:'#8b1e24', a:'#ffd766', opt:{sym:'終' } },
    sk_sharpen: { kind:'icon', c:'#f0883e', a:'#e6edf3', opt:{sym:'⚒' } },
    sk_focus:   { kind:'icon', c:'#1f6feb', a:'#a5d8ff', opt:{sym:'◉' } },
    sk_vampire: { kind:'icon', c:'#8b1e24', a:'#f85149', opt:{sym:'♥' } },
    sk_treasure:{ kind:'icon', c:'#d29922', a:'#ffd766', opt:{sym:'$' } },
    sk_confuse: { kind:'icon', c:'#c084fc', a:'#e6edf3', opt:{sym:'?' } },
    sk_curse:   { kind:'icon', c:'#6e40c9', a:'#a78bfa', opt:{sym:'†' } },
    sk_prism:   { kind:'icon', c:'#e879f9', a:'#fde047', opt:{sym:'✧' } },
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
  };
  for (const m in DATA.MATERIALS) {
    DEFS['mat_' + m] = { kind: MAT_KINDS[m] || 'gem', c:DATA.MATERIALS[m].color, a:'#ffffff' };
  }
  // 心得(パッシブ)スキル等、専用アイコン未定義のスキルは素材色の◆アイコンを自動生成
  for (const sid in DATA.SKILLS) {
    const def = DATA.SKILLS[sid];
    if (!DEFS[def.icon]) {
      const cost = def.cost(1);
      const m0 = Object.keys(cost)[0];
      DEFS[def.icon] = { kind:'icon', c:(DATA.MATERIALS[m0] || {color:'#8b949e'}).color, a:'#e6edf3', opt:{sym:'◆'} };
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
        eye(15,-6,2.2); break;
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
      // ---- 素材の固有形状 ----
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

  function gen(id){
    const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const g = cv.getContext('2d');
    painter(g, DEFS[id] || { kind:'?', c:'#f0f', a:'#fff' });
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

  // 色合成した派生スプライト(味方の色分けなどに使う)。スプライトの形だけ色を乗せる
  const tintCache = {};
  function tinted(id, color, strength){
    const key = id + '|' + color + '|' + (strength || 0.5);
    if (tintCache[key]) return tintCache[key];
    const src = get(id);
    const cv = document.createElement('canvas');
    cv.width = src.width || 64; cv.height = src.height || 64;
    const c = cv.getContext('2d');
    c.drawImage(src, 0, 0, cv.width, cv.height);
    c.globalCompositeOperation = 'source-atop';   // 既に描かれた画素(=キャラの形)にだけ色を乗せる
    c.globalAlpha = strength || 0.5;
    c.fillStyle = color;
    c.fillRect(0, 0, cv.width, cv.height);
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

  return { get, draw, tinted, drawTinted, loadOverrides, DEFS };
})();
