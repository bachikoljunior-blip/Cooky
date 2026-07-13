// =============================================================
// run.js - 周回(戦闘)シーン本体
//   敵AI / 仲間AI / スキル実装 / ドロップ / 船 / 港 / 基地 /
//   スポーンディレクター / 描画 / HUD
// =============================================================
'use strict';

function fmtNum(n){
  n = Math.floor(n);
  if (n >= 1e8) return (n/1e8).toFixed(1) + '億';
  if (n >= 1e4) return (n/1e4).toFixed(1) + '万';
  return String(n);
}
function fmtTime(t){
  const m = Math.floor(t/60), s = Math.floor(t%60);
  return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
}

const Run = (() => {
  const R = {};   // 周回状態

  // ---------------- プレイヤーの派生ステータス(メタ強化反映) ----------------
  function calcStats(){
    const m = SaveSys.metaLv;
    const sun = 0.02*m('g_sun_grace');   // 太陽の恩寵: 全能力
    const st = {
      maxHp: (100 + 20*m('altar_hp') + 40*m('g_black_dark') + 10*m('g_forge_gear')) * (1 + sun),
      atk: (1 + 0.08*m('altar_atk')) * (1 + 0.05*m('g_west_fire')) * (1 + 0.10*m('g_black_dark'))
           * (1 + 0.06*m('g_forge_gear')) * (1 + sun) * (1 + 0.08*m('g_end_beyond')) * (1 + 0.02*m('m_war')),
      // 初期は足が遅い。健脚・太陽の恩寵・靴スキルで広大な世界を踏破する
      speed: 105 * (1 + 0.04*m('altar_speed')) * (1 + sun) * (1 + 0.02*m('m_pioneer')),
      boatSpeed: 560 * (1 + 0.08*m('lab_sail')) * (1 + 0.05*m('m_shipwright')),
      regen: 0.5*m('altar_regen') + 1*m('g_south_heal') + 1*m('m_grit'),
      armor: Math.min(0.6, 0.02*m('altar_armor')),
      wall: 0.03*m('g_north_wall'),
      crit: 0.02*m('altar_crit') + 0.015*m('m_ashura'),
      range: 1 + 0.04*m('altar_range'),   // 攻撃射程(眼力で強化)
      dodge: 0.01*m('g_mist_dodge'),
      invulnPlus: 0.06*m('g_moon_shadow'),
      burnChance: 0.04*m('g_ember_burn'),
      slowChance: 0.03*m('g_frost_slow'),
      stormDmg: 20*m('g_storm_bolt'),
      allyDeathBlast: 30*m('g_grave_blast'),
      cdr: Math.min(0.4, 0.02*m('lib_cdr') + 0.015*m('g_east_cdr') + 0.01*m('m_satori')),
      area: 1 + 0.04*m('g_east_area'),
      magnet: 42 * (1 + 0.12*m('lab_magnet')),
      recruit: 0.2 + 0.002*m('camp_recruit'),   // 仲間になりやすさ(基本20%)
      allyCap: 250,   // 上限なし(処理負荷の保険値のみ)
      allyAtkSpd: Math.min(0.5, 0.03*m('camp_fury')),
      allyHp: (1 + 0.15*m('camp_hp')) * (1 + 0.08*m('g_green_ally')) * (1 + 0.06*m('m_bond2')),
      allyAtk: (1 + 0.12*m('camp_atk')) * (1 + 0.08*m('g_green_ally')) * (1 + 0.06*m('m_legion')),
      allyRegen: 0.012 + 0.01*m('camp_heal'),   // 仲間は放っておいても回復していく
      allyReviveChance: m('camp_revive') * 0.06,
      coinMul: (1 + 0.1*m('lab_coin')) * (1 + 0.15*m('g_white_gold')) * (1 + 0.08*m('m_invest')),
      dropMul: 1 + 0.1*m('lab_drop'),
      luck2: 0.04*m('lab_luck'),
      thorns: 5*m('g_north_thorn'),
      bossDmg: (1 + 0.08*m('g_west_boss')) * (1 + 0.05*m('m_bosslore')),
      reaperRes: Math.min(0.92, 0.06*m('g_dragon_res') + 0.02*m('g_void_null') + 0.02*m('m_endbook')),
      reaperDmg: (1 + 0.15*m('g_dusk_slay') + 0.05*m('g_void_null')) * (1 + 0.04*m('m_reaplore')),
      timeMitig: Math.min(0.6, 0.03*m('g_star_time') + 0.02*m('g_end_beyond')),
      potion: 0.004*m('g_south_potion'),
      revives: m('altar_revive'),
      salvage: 0.08*m('m_salvage'),
      deathBonus: 1 + 0.10*m('m_deathlearn'),
      exploreRad: 1 + (m('m_cartography') >= 1 ? 1 : 0) + (m('m_cartography') >= 3 ? 1 : 0),
      killHeal: 0, lifesteal: 0,
    };
    // 汎用効果: effAdd/effMul を持つメタ強化はデータ定義だけで反映される(基地の施設群)
    for (const id in DATA.META) {
      const d = DATA.META[id];
      const lv = m(id);
      if (!lv) continue;
      if (d.effAdd) for (const k in d.effAdd) st[k] += d.effAdd[k] * lv;
      if (d.effMul) for (const k in d.effMul) st[k] *= 1 + d.effMul[k] * lv;
    }
    st.armor = Math.min(0.75, st.armor);
    st.dodge = Math.min(0.5, st.dodge);
    st.cdr = Math.min(0.5, st.cdr);
    st.reaperRes = Math.min(0.92, st.reaperRes);
    return st;
  }

  // 周回中に取ったスキルのパッシブ効果を毎フレーム反映する
  // (靴・磁力・武器研磨・共鳴・カリスマ・トレハン・吸血・集中詠唱など)
  function applyMods(b){
    const s = Object.assign({}, b);
    const bo = Skills.stat('boots');    if (bo) s.speed *= bo.mult;
    const mg = Skills.stat('magnetSk'); if (mg) s.magnet *= mg.mult;
    const sh = Skills.stat('sharpen');  if (sh) { s.atk *= sh.mult; s.crit += sh.crit; }
    const fo = Skills.stat('focus');    if (fo) { s.cdr = Math.min(0.6, s.cdr + fo.cdr); s.area *= fo.area; }
    const bd = Skills.stat('bond');     if (bd) {
      s.atk *= 1 + bd.atkPerAlly * R.allies.length;
      s.armor = Math.min(0.75, s.armor + bd.defPerAlly * R.allies.length);
    }
    const ch = Skills.stat('charisma'); if (ch) { s.recruit += ch.recruit; s.allyHp *= ch.allyMul; s.allyAtk *= ch.allyMul; }
    const tr = Skills.stat('treasure'); if (tr) { s.coinMul *= tr.coin; s.dropMul *= tr.drop; s.luck2 += tr.luck; }
    const va = Skills.stat('vampire');  if (va) { s.killHeal = va.killHeal; s.lifesteal = va.lifesteal; }
    // 「心得」パッシブスキル群
    for (const id in Skills.owned) {
      const stt = Skills.stat(id);
      if (!stt || !stt.passive) continue;
      const v = stt.passive.value;
      switch (stt.passive.key) {
        case 'maxHpAdd':    s.maxHp += v; break;
        case 'atkMul':      s.atk *= 1 + v; break;
        case 'speedMul':    s.speed *= 1 + v; break;
        case 'armorAdd':    s.armor = Math.min(0.8, s.armor + v); break;
        case 'regenAdd':    s.regen += v; break;
        case 'magnetMul':   s.magnet *= 1 + v; break;
        case 'coinMul':     s.coinMul *= 1 + v; break;
        case 'dropMul':     s.dropMul *= 1 + v; break;
        case 'critAdd':     s.crit += v; break;
        case 'cdrAdd':      s.cdr = Math.min(0.65, s.cdr + v); break;
        case 'areaMul':     s.area *= 1 + v; break;
        case 'bossMul':     s.bossDmg *= 1 + v; break;
        case 'reaperMul':   s.reaperDmg *= 1 + v; break;
        case 'reaperResAdd':s.reaperRes = Math.min(0.95, s.reaperRes + v); break;
        case 'allyAtkMul':  s.allyAtk *= 1 + v; break;
        case 'allyHpMul':   s.allyHp *= 1 + v; break;
        case 'allyRegenAdd':  s.allyRegen += v; break;
        case 'allyReviveAdd': s.allyReviveChance = Math.min(0.8, s.allyReviveChance + v); break;
        case 'allyAtkSpdAdd': s.allyAtkSpd = Math.min(0.6, s.allyAtkSpd + v); break;
        case 'recruitAdd':  s.recruit += v; break;
        case 'thornsAdd':   s.thorns += v; break;
        case 'boatMul':     s.boatSpeed *= 1 + v; break;
        case 'luckAdd':     s.luck2 += v; break;
        case 'burnAdd':     s.burnChance += v; break;
        case 'slowAdd':     s.slowChance += v; break;
        case 'stormAdd':    s.stormDmg += v; break;
        case 'dodgeAdd':    s.dodge = Math.min(0.5, s.dodge + v); break;
        case 'mitigAdd':    s.timeMitig = Math.min(0.7, s.timeMitig + v); break;
        case 'invulnAdd':   s.invulnPlus += v; break;
        case 'allMul':      s.atk *= 1 + v; s.maxHp *= 1 + v; s.speed *= 1 + v; break;
        case 'hpPctMul':    s.maxHp *= 1 + v; break;
      }
    }
    return s;
  }

  // ---------------- 周回開始 ----------------
  function start(startPos){
    Skills.reset();
    World.resetRun();
    Quest.reset();
    R.time = 0;
    R.player = { x:startPos.x, y:startPos.y, hp:1, dir:1, moveA:0,
                 onBoat:false, boatAnchor:null, invuln:0 };
    R.baseStats = calcStats();
    R.stats = R.baseStats;
    R.player.hp = R.stats.maxHp;
    R.coins = 0; R.kills = 0; R.recruits = 0; R.bossKills = 0; R.reaperKills = 0;
    R.rareKills = 0; R.matsGot = 0; R.objsDestroyed = 0; R.peakAllies = 0;
    R.usedRevives = 0;
    R.enemies = []; R.allies = []; R.projs = []; R.eprojs = []; R.pickups = [];
    R.turrets = []; R.zones = []; R.effects = []; R.popups = [];
    R.cd = {}; R.shield = { stocks:0, timer:0 };
    R.spawnAcc = 0; R.bossDone = {}; R.reaperAcc = 0;
    R.interact = null;
    R.vacuumT = 0; R.warnT = 0; R.warnMsg = '';
    R.maxDist = Math.hypot(startPos.x, startPos.y);
    R.bossAlive = null;
    R.mmWorld = false;   // ミニマップ: false=周辺 / true=全体
    R.over = false;
    lootFeed = []; if (lootEl) lootEl.innerHTML = '';
    // 骸骨の軍勢: 開始時から仲間を連れて出撃
    const army = Math.ceil(SaveSys.metaLv('g_bones_army') / 2);
    for (let i = 0; i < army; i++) {
      const def = DATA.ENEMIES.skeleton;
      R.allies.push({
        def, key:'skeleton',
        x: startPos.x + rnd(-70, 70), y: startPos.y + rnd(-70, 70),
        maxHp: 220 * R.stats.allyHp, hp: 220 * R.stats.allyHp,
        dmg: 14, speed: def.speed * 1.8,
        atkCd: 0, healCd: 0, shootCd: 0, waitAt: null, saved: false,
      });
    }
  }

  function walletTotal(){ return SaveSys.data.coins + R.coins; }
  function walletPay(amount){
    if (walletTotal() < amount) return false;
    const fromRun = Math.min(R.coins, amount);
    R.coins -= fromRun;
    SaveSys.data.coins -= (amount - fromRun);
    SaveSys.save();
    return true;
  }

  // ---------------- ダメージ処理 ----------------
  function dealDamage(e, dmg, opts = {}){
    const st = R.stats;
    let d = dmg * st.atk;
    if (Math.random() < st.crit) { d *= 2; opts.crit = true; }
    if (e.boss) d *= st.bossDmg;
    if (e.def.isReaper) d *= st.reaperDmg;
    if (e.shred) d *= (1 + e.shred);
    const armor = (e.def.armor || 0);
    d *= (1 - armor);
    e.hp -= d;
    e.flash = 0.08;
    // 吸血の刻印: 与ダメージの一部を回復
    if (st.lifesteal > 0) R.player.hp = Math.min(st.maxHp, R.player.hp + d * st.lifesteal);
    // 燃えさしの祝福 / 霜の吐息: 確率で炎上・氷結を付与
    if (st.burnChance > 0 && Math.random() < st.burnChance) { e.burn = Math.max(e.burn, d * 0.15); e.burnT = 3; }
    if (st.slowChance > 0 && Math.random() < st.slowChance) { e.slowUntil = R.time + 1.5; e.slowMul = 0.35; }
    Sfx.hit();
    popup(e.x, e.y - e.def.r - 6, fmtNum(d), opts.crit ? '#ffd766' : '#e6edf3');
    if (e.hp <= 0) killEnemy(e, opts);
    return d;
  }

  function popup(x, y, txt, color){
    if (R.popups.length > 60) R.popups.shift();
    R.popups.push({ x, y, txt, color, t:0.8 });
  }

  // 現在の攻撃手段(武器庫で選択)。key が選択中の武器ならそのレベルの性能を返す
  function wstat(key){
    if (SaveSys.data.weapon !== key) return null;
    const lv = SaveSys.weaponLv(key);
    return lv > 0 ? DATA.WEAPONS[key].stats(lv) : null;
  }

  function killEnemy(e, opts = {}){
    if (e.dead) return;
    e.dead = true;
    R.kills++;
    if (e.boss) { R.bossKills++; if (R.bossAlive === e) R.bossAlive = null; }
    if (e.def.isReaper) R.reaperKills++;
    if (e.def.rare) { R.rareKills++; R.warnMsg = '✨ レアモンスターを倒した!'; R.warnT = 3; }
    Quest.notifyKill(e.defKey);   // 討伐クエストの進行
    const st = R.stats;
    // コイン(遠くの敵ほど多く落とす: 遠征の資金源)
    const ring = World.ringOf(e.x, e.y);
    // 武器の成長がハブ(コイン)管理になったぶん、コインは気持ち多めに落ちる。
    // ただし同じ周回で狩り続けるほど相場が下がる(無限farm対策: 1200体で半減)
    const glut = 1 / (1 + R.kills / 1200);
    const valueMul = (e.boss || e.def.isReaper) ? 0.9 : (0.55 + Math.random() * 0.25) * glut;
    const c = Math.max(1, Math.round(e.coin * st.coinMul * (1 + ring * 0.22) * valueMul));
    dropPickup(e.x, e.y, { type:'coin', value:c });
    // 素材ドロップ(エリアの得意素材は2倍出やすい)
    const bmats = areaMats(e.x, e.y);
    for (const dr of e.def.drops || []) {
      if (!Skills.matUnlocked(dr.m)) continue;
      const boost = bmats.includes(dr.m) ? 2 : 1;
      if (Math.random() < dr.c * st.dropMul * boost) {
        const n = Math.random() < st.luck2 ? 2 : 1;
        for (let i = 0; i < n; i++) dropPickup(e.x + rnd(-14,14), e.y + rnd(-14,14), { type:'mat', mat:dr.m });
      }
    }
    // エリア固有のボーナスドロップ(欲しい素材のエリアへ遠征する価値)
    const bpool = bmats.filter(m => Skills.matUnlocked(m));
    if (bpool.length && Math.random() < 0.10 * st.dropMul) {
      dropPickup(e.x + rnd(-14,14), e.y + rnd(-14,14), { type:'mat', mat: bpool[Math.floor(Math.random() * bpool.length)] });
    }
    // ポーション
    if (Math.random() < st.potion) dropPickup(e.x, e.y, { type:'potion' });
    // 吸血の刻印: 撃破時回復
    if (st.killHeal > 0) R.player.hp = Math.min(st.maxHp, R.player.hp + st.killHeal);
    // 仲間勧誘(ボス/リーパー以外)。強い敵ほど仲間になりにくい
    const tf = [1, 0.7, 0.5, 0.35, 0.25][Math.min(4, e.def.tier || 0)];
    if (!e.boss && !e.def.isReaper && R.allies.length < st.allyCap && Math.random() < st.recruit * tf) {
      recruitAlly(e);
    }
    effect('burst', e.x, e.y, { color:e.def.isReaper ? '#f85149' : '#ffd766', r:e.def.r + 8 });
  }

  function recruitAlly(e){
    const wb = Skills.stat('warbanner');
    const bd = Skills.stat('bond');
    const st = R.stats;
    const hpMul = st.allyHp * (wb ? wb.hp : 1) * (bd ? bd.allyHp : 1);
    R.allies.push({
      def: e.def, key: e.defKey,
      x: e.x, y: e.y,
      maxHp: e.maxHp * 2.4 * hpMul,   // 仲間は元の敵よりずっと頑丈
      hp: e.maxHp * 2.4 * hpMul,
      dmg: e.dmg * 0.9,
      speed: e.def.speed * 1.4,
      atkCd: 0, healCd: 0, shootCd: 0,
      waitAt: null, saved: false,
    });
    R.recruits++;
    R.peakAllies = Math.max(R.peakAllies, R.allies.length);
    Sfx.recruit();
    popup(e.x, e.y - 22, '仲間になった!', '#7ee787');
  }

  function damagePlayer(dmg, src){
    const st = R.stats;
    const p = R.player;
    if (p.invuln > 0) return;
    // 霧隠れ: 完全回避
    if (st.dodge > 0 && Math.random() < st.dodge) {
      popup(p.x, p.y - 26, '回避!', '#76e3ea');
      p.invuln = 0.15;
      return;
    }
    // シールド
    if (R.shield.stocks > 0) {
      R.shield.stocks--;
      const sh = Skills.stat('shield');
      effect('ring', p.x, p.y, { color:'#58a6ff', r:60 });
      if (sh && sh.knock) knockback(p.x, p.y, 120, 260);
      if (sh && sh.burst) aoeDamage(p.x, p.y, 100, sh.burst);
      p.invuln = 0.4 + st.invulnPlus;
      return;
    }
    let d = dmg;
    // 威圧のオーラ: 範囲内の敵からの攻撃を弱体化
    const fe = Skills.stat('fear');
    if (fe && src && src.x !== undefined && Math.hypot(src.x - p.x, src.y - p.y) < fe.radius) {
      d *= (1 - fe.reduce);
    }
    let armor = st.armor;
    if (p.hp < st.maxHp * 0.3) armor = Math.min(0.85, armor + st.wall);
    d *= (1 - armor);
    if (src && src.def && src.def.isReaper) d *= (1 - st.reaperRes);
    p.hp -= d;
    p.invuln = 0.35 + st.invulnPlus; // 影歩き: 被弾後の無敵延長
    Sfx.hurt();
    // 茨の鎧
    if (st.thorns > 0 && src && !src.dead && src.hp !== undefined) {
      src.hp -= st.thorns * st.atk;
      if (src.hp <= 0) killEnemy(src);
    }
    if (p.hp <= 0) {
      if (R.usedRevives < st.revives) {
        R.usedRevives++;
        p.hp = st.maxHp * 0.5;
        p.invuln = 2.5;
        effect('ring', p.x, p.y, { color:'#ffd766', r:140 });
        knockback(p.x, p.y, 250, 400);
        popup(p.x, p.y - 30, '不死鳥の羽!', '#ffd766');
      } else {
        R.over = true;
        Sfx.die();
      }
    }
  }

  function knockback(x, y, radius, force){
    for (const e of R.enemies) {
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < radius && d > 1) {
        e.x += (e.x - x) / d * force * 0.12;
        e.y += (e.y - y) / d * force * 0.12;
      }
    }
  }
  function aoeDamage(x, y, radius, dmg){
    for (const e of R.enemies) {
      if (!e.dead && Math.hypot(e.x - x, e.y - y) < radius + e.def.r) dealDamage(e, dmg);
    }
    damageObjectsIn(x, y, radius, dmg);
  }

  function rnd(a, b){ return a + Math.random() * (b - a); }

  // その座標のエリアで「よく採れる」素材リスト(海は貝殻・珊瑚)
  function areaMats(x, y){
    const ti = World.tileAt(x, y);
    if (ti.t === 'sea' || ti.t === 'deep') return ['shell', 'coral'];
    return (DATA.BIOMES[ti.biome] || {}).mats || [];
  }

  function effect(type, x, y, opt){
    if (R.effects.length > 120) R.effects.shift();
    R.effects.push(Object.assign({ type, x, y, t:0 }, opt));
  }

  // ---------------- ドロップ / ピックアップ ----------------
  function dropPickup(x, y, p){
    if (R.pickups.length > 400) {
      // 一番古いコインを統合
      const old = R.pickups.find(q => q.type === 'coin');
      if (old && p.type === 'coin') { old.value += p.value; return; }
      R.pickups.shift();
    }
    R.pickups.push(Object.assign({ x, y, vx:rnd(-30,30), vy:rnd(-30,30), t:0 }, p));
  }

  function updatePickups(dt){
    const p = R.player, st = R.stats;
    const magnet = st.magnet * (p.onBoat ? 1.4 : 1);
    const mg = Skills.stat('magnetSk');
    if (mg && mg.vacuum) {
      R.vacuumT -= dt;
      if (R.vacuumT <= 0) {
        R.vacuumT = mg.vacuumCd;
        for (const pk of R.pickups) pk.vacuumed = true;
        effect('ring', p.x, p.y, { color:'#f778ba', r:260 });
      }
    }
    for (let i = R.pickups.length - 1; i >= 0; i--) {
      const pk = R.pickups[i];
      pk.t += dt;
      pk.x += pk.vx * dt; pk.y += pk.vy * dt;
      pk.vx *= 0.9; pk.vy *= 0.9;
      const d = Math.hypot(pk.x - p.x, pk.y - p.y);
      if (d < magnet || pk.vacuumed) {
        const sp = pk.vacuumed ? 700 : 380;
        pk.x += (p.x - pk.x) / (d || 1) * sp * dt;
        pk.y += (p.y - pk.y) / (d || 1) * sp * dt;
      }
      if (d < 26) {
        if (pk.type === 'coin') { R.coins += pk.value; Sfx.coin(); effect('spark', pk.x, pk.y, { color:'#ffd766' }); }
        else if (pk.type === 'mat') {
          Skills.addMat(pk.mat, 1); R.matsGot++; Sfx.mat();
          effect('spark', pk.x, pk.y, { color: DATA.MATERIALS[pk.mat].color });
          lootAdd(pk.mat);   // 画面左上の入手フィードに表示(戦闘の混雑に埋もれない)
        }
        else if (pk.type === 'potion') { p.hp = Math.min(st.maxHp, p.hp + st.maxHp * 0.2); popup(p.x, p.y-30, '+HP20%', '#7ee787'); }
        R.pickups.splice(i, 1);
      }
    }
  }

  // ---------------- スポーンディレクター ----------------
  function allowedTier(){
    const min = R.time / 60;
    const byTime = min < 3 ? 0 : min < 7 ? 1 : min < 12 ? 2 : min < 20 ? 3 : 4;
    const ring = World.ringOf(R.player.x, R.player.y);
    const byRing = Math.min(4, Math.floor(ring / 1.4));
    return Math.min(4, Math.max(byTime, byRing));
  }
  function timeMults(){
    const effMin = (R.time / 60) * (1 - R.stats.timeMitig);
    const ring = World.ringOf(R.player.x, R.player.y);
    return {
      hp: Math.pow(DATA.TIME_HP_GROWTH, effMin) * (1 + 0.55 * ring),
      dmg: Math.pow(DATA.TIME_DMG_GROWTH, effMin) * (1 + 0.22 * ring),
    };
  }

  function spawnEnemy(defKey, opts = {}){
    const def = DATA.ENEMIES[defKey];
    const p = R.player;
    const a = Math.random() * Math.PI * 2;
    const dist = opts.dist || rnd(560, 760);
    let x = p.x + Math.cos(a) * dist, y = p.y + Math.sin(a) * dist;
    // 環境の合う場所へ補正(数回試行)
    for (let i = 0; i < 6; i++) {
      const land = World.isLand(x, y);
      if ((def.env === 'land' && land) || (def.env === 'sea' && !land) || def.env === 'both') break;
      const a2 = Math.random() * Math.PI * 2;
      x = p.x + Math.cos(a2) * dist; y = p.y + Math.sin(a2) * dist;
      if (i === 5) return null;
    }
    const tm = opts.tm || timeMults();
    const e = {
      def, defKey,
      x, y,
      maxHp: def.hp * tm.hp * (opts.hpMul || 1),
      dmg: def.dmg * tm.dmg * (opts.dmgMul || 1),
      coin: opts.coin || def.coin,
      boss: !!opts.boss, bossName: opts.bossName,
      hp: 0, flash: 0, slowUntil: 0, slowMul: 1, frozenUntil: 0,
      burn: 0, burnT: 0, shred: 0, contactCd: 0, shootCd: rnd(0.5, 2), healCd: 1,
      orbitHit: 0, wander: Math.random() * 7,
    };
    e.hp = e.maxHp;
    // 強化ランク: 時間・距離で強くなった敵は見た目が変わる(大きさ+オーラ)
    const power = tm.hp * (opts.hpMul || 1) / (opts.boss ? 14 : 1);
    e.rank = power < 4 ? 0 : power < 15 ? 1 : power < 60 ? 2 : power < 250 ? 3 : 4;
    e.sizeMul = (opts.boss ? 2.2 : 1) * (1 + e.rank * 0.09);
    if (opts.boss) R.bossAlive = e;
    R.enemies.push(e);
    return e;
  }

  function director(dt){
    const min = R.time / 60;
    // 通常スポーン(序盤は少なく、時間と距離で徐々に増える)
    const isReaperTime = R.time >= DATA.REAPER_AT;
    const ring0 = Math.min(12, World.ringOf(R.player.x, R.player.y));
    const rate = (0.4 + min * 0.17 + ring0 * 0.13) * (isReaperTime ? 0.5 : 1);
    R.spawnAcc += dt * rate;
    const cap = Math.min(160, 16 + R.time * 0.4 + ring0 * 6);
    while (R.spawnAcc >= 1) {
      R.spawnAcc -= 1;
      if (R.enemies.length >= cap) break;   // 見切れた敵は反対側から登場し直すので圧は途切れない
      const tier = allowedTier();
      const onSea = !World.isLand(R.player.x, R.player.y);
      const pool = [];
      for (const k in DATA.ENEMIES) {
        const d = DATA.ENEMIES[k];
        if (d.isReaper) continue;
        if (d.tier > tier || d.tier < tier - 2) continue;
        if (onSea && d.env === 'land') continue;
        if (!onSea && d.env === 'sea') continue;
        // 高tierほど出やすく
        const w = 1 + d.tier * 1.6 + (d.tier === tier ? 2 : 0);
        pool.push({ k, w: d.heal ? w * 0.25 : w });
      }
      if (!pool.length) continue;
      let tw = 0; for (const q of pool) tw += q.w;
      let r = Math.random() * tw;
      let pick = pool[0].k;
      for (const q of pool) { r -= q.w; if (r <= 0) { pick = q.k; break; } }
      if (Math.random() < 0.006) pick = 'rainbow';   // レアモンスター
      // 討伐クエスト中は対象の敵が湧きやすい
      const qe = Quest.wantSpawn();
      if (qe && Math.random() < 0.35 && R.enemies.filter(e => e.defKey === qe).length < 6) pick = qe;
      spawnEnemy(pick);
    }
    // ボス
    for (const b of DATA.BOSSES) {
      if (min >= b.at && !R.bossDone[b.at]) {
        R.bossDone[b.at] = true;
        const e = spawnEnemy(b.base, { boss:true, bossName:b.name, hpMul:b.hpMul, dmgMul:b.dmgMul, coin:b.coin, dist:620 });
        if (e) { e.def = Object.assign({}, e.def, { sprite: b.sprite }); }
        R.warnMsg = '⚠ ' + b.name + ' が現れた!'; R.warnT = 4; R.warnColor = null;
        Sfx.boss();
      }
    }
    // 終焉の刻
    if (isReaperTime) {
      if (!R.reaperWarned) {
        R.reaperWarned = true;
        R.warnMsg = '☠ 終焉の刻 ― リーパーの大群が押し寄せる!'; R.warnT = 6; R.warnColor = null;
        Sfx.boss();
      }
      R.reaperAcc += dt;
      const interval = Math.max(1.2, 4 - (R.time - DATA.REAPER_AT) / 120);
      if (R.reaperAcc >= interval) {
        R.reaperAcc = 0;
        const over = (R.time - DATA.REAPER_AT) / 60;
        spawnEnemy('reaper', { tm: { hp: Math.pow(1.13, over), dmg: Math.pow(1.05, over) }, dist: rnd(500, 700) });
      }
    }
  }

  // ---------------- 敵の更新 ----------------
  function canStand(def, x, y){
    if (def.env === 'both') return true;
    const land = World.isLand(x, y);
    return def.env === 'land' ? land : !land;
  }

  function updateEnemies(dt){
    const p = R.player;
    for (let i = R.enemies.length - 1; i >= 0; i--) {
      const e = R.enemies[i];
      if (e.dead) { R.enemies.splice(i, 1); continue; }
      // 画面から見切れた敵は消えず、プレイヤーの反対側から登場し直す
      // (下限820: 出現直後の敵(560-760)が即座に巻き直されるのを防ぐ)
      let pd = Math.hypot(e.x - p.x, e.y - p.y);
      if (pd > Math.max(R.offscreenR || 950, 820) && !e.boss && !e.def.isReaper && !e.def.rare) {
        const nd = rnd(560, 760);
        for (let t = 0; t < 3; t++) {
          // 反対側(プレイヤーの向こう)へ。地形が合わなければ数回だけ別角度を試す
          const ang = t === 0 ? Math.atan2(p.y - e.y, p.x - e.x) : Math.random() * 7;
          const nx = p.x + Math.cos(ang) * nd, ny = p.y + Math.sin(ang) * nd;
          if (canStand(e.def, nx, ny)) { e.x = nx; e.y = ny; pd = nd; break; }
        }
      }
      e.flash = Math.max(0, e.flash - dt);
      e.contactCd = Math.max(0, e.contactCd - dt);
      // 燃焼・時間系
      if (e.burn > 0) { e.burnT -= dt; e.hp -= e.burn * dt * R.stats.atk; if (e.burnT <= 0) e.burn = 0;
        if (e.hp <= 0) { killEnemy(e); continue; } }
      let spd = e.def.speed;
      if (R.time < e.slowUntil) spd *= (1 - e.slowMul);
      if (R.time < e.frozenUntil) spd = 0;
      // 時の砂
      if (R.sandsUntil && R.time < R.sandsUntil && pd < R.sandsRadius) spd *= (1 - R.sandsSlow);
      // サンクチュアリ減速
      const sanct = Skills.stat('sanctuary');
      if (sanct && sanct.slow && pd < sanct.radius * R.stats.area) spd *= (1 - sanct.slow);

      // 行動
      let tx = p.x, ty = p.y;
      let vx = 0, vy = 0;
      const confused = R.time < (e.confusedUntil || 0);
      const fe = Skills.stat('fear');
      if (confused) {
        // 混沌の瘴気: 最寄りの別の敵を攻撃する
        let tgt = null, td = 1e9;
        for (const o of R.enemies) {
          if (o === e || o.dead) continue;
          const d = Math.hypot(o.x - e.x, o.y - e.y);
          if (d < td) { tgt = o; td = d; }
        }
        if (tgt) {
          const d = td || 1;
          vx = (tgt.x - e.x) / d; vy = (tgt.y - e.y) / d;
          if (td < e.def.r + tgt.def.r + 6 && e.contactCd <= 0) {
            e.contactCd = 0.6;
            tgt.hp -= e.dmg; tgt.flash = 0.08;
            if (tgt.hp <= 0) killEnemy(tgt);
          }
        } else { e.wander += dt; vx = Math.cos(e.wander); vy = Math.sin(e.wander); }
      } else if (fe && fe.flee && !e.boss && !e.def.isReaper &&
                 e.hp < e.maxHp * 0.25 && pd < fe.radius * 1.5) {
        // 威圧のオーラ: 瀕死の敵が逃げ出す
        vx = (e.x - p.x) / (pd || 1); vy = (e.y - p.y) / (pd || 1);
      } else if (e.def.move === 'kite') {
        // ヒーラー: 距離を保って逃げる + 回復
        const keep = 230;
        if (pd < keep) { vx = (e.x - p.x) / (pd||1); vy = (e.y - p.y) / (pd||1); }
        else if (pd > keep + 140) { vx = (p.x - e.x) / (pd||1); vy = (p.y - e.y) / (pd||1); spd *= 0.6; }
        else { e.wander += dt; vx = Math.cos(e.wander); vy = Math.sin(e.wander); spd *= 0.5; }
        e.healCd -= dt;
        if (e.healCd <= 0 && e.def.heal) {
          e.healCd = 1;
          const tm = timeMults();
          for (const o of R.enemies) {
            if (o !== e && !o.dead && o.hp < o.maxHp && Math.hypot(o.x-e.x, o.y-e.y) < e.def.heal.radius) {
              o.hp = Math.min(o.maxHp, o.hp + e.def.heal.hps * tm.hp);
              effect('healline', e.x, e.y, { x2:o.x, y2:o.y });
            }
          }
        }
      } else {
        // 仲間が近ければそちらを狙うこともある
        let tgt = null, td = pd;
        for (const a of R.allies) {
          const d = Math.hypot(a.x - e.x, a.y - e.y);
          if (d < td * 0.7) { tgt = a; td = d; }
        }
        if (tgt) { tx = tgt.x; ty = tgt.y; }
        const d = Math.hypot(tx - e.x, ty - e.y) || 1;
        vx = (tx - e.x) / d; vy = (ty - e.y) / d;
        // 射撃タイプは距離を取る
        if (e.def.ranged && d < e.def.ranged.range * 0.6) { vx = -vx * 0.5; vy = -vy * 0.5; }
      }
      const nx = e.x + vx * spd * dt, ny = e.y + vy * spd * dt;
      if (canStand(e.def, nx, ny)) { e.x = nx; e.y = ny; }
      else if (canStand(e.def, nx, e.y)) { e.x = nx; }
      else if (canStand(e.def, e.x, ny)) { e.y = ny; }

      // 接触ダメージ(プレイヤー) ※混乱中は敵を狙うので当たらない
      if (!confused && pd < e.def.r + 16 && e.contactCd <= 0) {
        e.contactCd = 0.6;
        damagePlayer(e.dmg, e);
      }
      // 接触ダメージ(仲間)
      if (!confused) for (const a of R.allies) {
        if (e.contactCd <= 0 && Math.hypot(a.x - e.x, a.y - e.y) < e.def.r + 14) {
          e.contactCd = 0.6;
          damageAlly(a, e.dmg * 0.35, e);  // 仲間への接触ダメージはかなり控えめ
          break;
        }
      }
      // 射撃
      if (e.def.ranged && !confused) {
        e.shootCd -= dt;
        if (e.shootCd <= 0 && pd < e.def.ranged.range) {
          e.shootCd = e.def.ranged.cd;
          const d = pd || 1;
          let pdmg = e.dmg;
          if (fe && pd < fe.radius) pdmg *= (1 - fe.reduce); // 威圧: 射撃も弱体化
          R.eprojs.push({ x:e.x, y:e.y, vx:(p.x-e.x)/d*e.def.ranged.pspeed, vy:(p.y-e.y)/d*e.def.ranged.pspeed,
                          dmg:pdmg, life:3, r:5 });
        }
      }
    }
    // 敵弾(プレイヤーにも仲間にも当たる)
    for (let i = R.eprojs.length - 1; i >= 0; i--) {
      const b = R.eprojs[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0) { R.eprojs.splice(i, 1); continue; }
      if (Math.hypot(b.x - p.x, b.y - p.y) < 16) { damagePlayer(b.dmg); R.eprojs.splice(i, 1); continue; }
      for (const a of R.allies) {
        if (a.waitAt || a.dead) continue;
        if (Math.hypot(b.x - a.x, b.y - a.y) < a.def.r + 5) {
          damageAlly(a, b.dmg * 0.35, b);   // 接触と同じく仲間への弾ダメージは控えめ
          R.eprojs.splice(i, 1);
          break;
        }
      }
    }
  }

  // ---------------- 仲間の更新 ----------------
  function damageAlly(a, dmg, src){
    // 威圧のオーラ: プレイヤーの近くなら仲間への攻撃も弱体化
    const fe = Skills.stat('fear');
    if (fe && src && Math.hypot(src.x - R.player.x, src.y - R.player.y) < fe.radius) {
      dmg *= (1 - fe.reduce);
    }
    a.hp -= dmg;
    if (a.hp <= 0) {
      if (!a.saved && Math.random() < R.stats.allyReviveChance) {
        a.hp = 1; a.saved = true;
        popup(a.x, a.y - 20, '踏みとどまった!', '#7ee787');
      } else {
        a.dead = true;
        effect('burst', a.x, a.y, { color:'#7ee787', r:16 });
        popup(a.x, a.y - 20, '仲間が倒れた…', '#f85149');
        // 弔いの爆炎: 倒れた仲間が敵を道連れにする
        if (R.stats.allyDeathBlast > 0) {
          effect('ring', a.x, a.y, { color:'#f0883e', r:110 });
          aoeDamage(a.x, a.y, 110, R.stats.allyDeathBlast);
        }
      }
    }
  }

  // 同心円スロット: リング0=密着(28px)、以降+17pxずつの密集陣形。定員はリングごとに増える
  function slotPos(i){
    let ring = 0, cap = 7, start = 0;
    while (i >= start + cap) { start += cap; ring++; cap = 7 + ring * 5; }
    const idx = i - start;
    const ang = idx / cap * Math.PI * 2 + ring * 0.5;
    const rad = 28 + ring * 17;
    return { x: Math.cos(ang) * rad, y: Math.sin(ang) * rad, rad };
  }
  function formationRadius(n){
    return n <= 0 ? 0 : slotPos(n - 1).rad;
  }

  function updateAllies(dt){
    const p = R.player;
    // 陣形スロット: 人数が変わったら「強い仲間ほど内側」に並べ直す
    if (R._slotN !== R.allies.length) {
      R._slotN = R.allies.length;
      const order = R.allies.slice().sort((x, y) => ((y.def.tier || 0) - (x.def.tier || 0)) || (y.maxHp - x.maxHp));
      order.forEach((a2, idx) => { a2.slot = idx; });
    }
    const wb = Skills.stat('warbanner');
    const atkMul = R.stats.allyAtk * (wb ? wb.atk : 1);
    const spdMul = (wb ? wb.spd : 1);
    const n = R.allies.length;
    for (let i = R.allies.length - 1; i >= 0; i--) {
      const a = R.allies[i];
      if (a.dead) { R.allies.splice(i, 1); continue; }
      // 自動回復
      if (R.stats.allyRegen > 0) a.hp = Math.min(a.maxHp, a.hp + a.maxHp * R.stats.allyRegen * dt);
      // 待機中(乗船で置いていかれた等)
      if (a.waitAt) {
        const envOk = a.def.env === 'both' ||
          (a.def.env === 'land' && !p.onBoat && World.isLand(p.x, p.y)) ||
          (a.def.env === 'sea' && (p.onBoat || !World.isLand(p.x, p.y)));
        if (envOk && Math.hypot(p.x - a.waitAt.x, p.y - a.waitAt.y) < 340) {
          a.waitAt = null;
          a.x = p.x + rnd(-40, 40); a.y = p.y + rnd(-40, 40);
          popup(a.x, a.y - 20, '合流!', '#7ee787');
        } else continue;
      }
      // ターゲット探索: 陣形に触れるほど近づいた敵だけ迎撃(追いかけ回さず、常に主人公の周りにいる)
      const formR = formationRadius(n);
      const leash = formR + 12;
      let tgt = null, td = leash;
      for (const e of R.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) > leash) continue;
        const d = Math.hypot(e.x - a.x, e.y - a.y);
        if (d < td) { tgt = e; td = d; }
      }
      // 主人公が敵と反対方向へ動いた瞬間、戦闘をやめて即座についてくる
      if (tgt) {
        const ax2 = R.botAxis || Input.axis();
        if (ax2.x || ax2.y) {
          const dx = tgt.x - p.x, dy = tgt.y - p.y;
          const dl = Math.hypot(dx, dy) || 1;
          const al = Math.hypot(ax2.x, ax2.y) || 1;
          if ((dx * ax2.x + dy * ax2.y) / (dl * al) < -0.15) tgt = null;
        }
      }
      let dest, spd = a.speed * spdMul;
      if (tgt) {
        dest = tgt;
        // 射撃タイプの仲間
        if (a.def.ranged) {
          a.shootCd -= dt;
          if (td < a.def.ranged.range) {
            if (a.shootCd <= 0) {
              a.shootCd = a.def.ranged.cd * (1 - R.stats.allyAtkSpd);
              const d = td || 1;
              R.projs.push({ x:a.x, y:a.y, vx:(tgt.x-a.x)/d*a.def.ranged.pspeed*1.2, vy:(tgt.y-a.y)/d*a.def.ranged.pspeed*1.2,
                             dmg: a.dmg * atkMul / R.stats.atk, life:2.5, size:5, pierce:0, ally:true });
            }
            dest = null; // 距離維持
          }
        }
        // 接触攻撃
        a.atkCd -= dt;
        if (dest && td < tgt.def.r + 16) {
          if (a.atkCd <= 0) {
            a.atkCd = 0.7 * (1 - R.stats.allyAtkSpd);   // 鬨の声: 攻撃間隔短縮
            dealDamage(tgt, a.dmg * atkMul / R.stats.atk); // dealDamage内でatk倍されるため相殺
          }
          dest = null;
        }
      } else {
        // 敵がいなければ、陣形が触れているオブジェクトを壊す(素材集めを手伝う)
        const ot = nearestObject(a.x, a.y, 52);
        if (ot && Math.hypot(ot.x - p.x, ot.y - p.y) < formR + 64) {
          a.atkCd -= dt;
          const od = Math.hypot(ot.x - a.x, ot.y - a.y);
          if (od < (ot.r || 18) + 16) {
            if (a.atkCd <= 0) {
              a.atkCd = 0.7 * (1 - R.stats.allyAtkSpd);
              hitObject(ot, a.dmg * atkMul / R.stats.atk);   // hitObject内でatk倍されるため相殺
            }
            dest = null;   // その場で叩く
          } else dest = ot;
        }
        if (dest === undefined) {
          // 同心円陣形: 最初は密着、仲間が増えるとリングが外へ広がる(強い仲間ほど内側)
          const sp2 = slotPos(a.slot !== undefined ? a.slot : i);
          dest = { x: p.x + sp2.x, y: p.y + sp2.y };
          const d = Math.hypot(dest.x - a.x, dest.y - a.y);
          if (d < 6) dest = null;
          spd = Math.max(spd, R.stats.speed * 1.3);   // 陣形追従は主人公に置いていかれない速度
        }
      }
      if (dest) {
        const d = Math.hypot(dest.x - a.x, dest.y - a.y) || 1;
        const step2 = Math.min(d, spd * dt);
        const nx = a.x + (dest.x - a.x) / d * step2;
        const ny = a.y + (dest.y - a.y) / d * step2;
        if (canStand(a.def, nx, ny)) { a.x = nx; a.y = ny; }
        else if (canStand(a.def, nx, a.y)) a.x = nx;
        else if (canStand(a.def, a.x, ny)) a.y = ny;
      }
      // ハードリーシュ: 陣形のほんの少し外まで。敵を追って主人公から離れることはない
      {
        const maxD = formR + 16;
        const dd = Math.hypot(a.x - p.x, a.y - p.y);
        if (dd > maxD) {
          a.x = p.x + (a.x - p.x) / dd * maxD;
          a.y = p.y + (a.y - p.y) / dd * maxD;
        }
      }
      // ヒーラー仲間: プレイヤーと仲間を回復
      if (a.def.heal) {
        a.healCd -= dt;
        if (a.healCd <= 0) {
          a.healCd = 1;
          const pw = a.def.heal.hps * atkMul;
          if (Math.hypot(p.x - a.x, p.y - a.y) < a.def.heal.radius && p.hp < R.stats.maxHp) {
            p.hp = Math.min(R.stats.maxHp, p.hp + pw);
            effect('healline', a.x, a.y, { x2:p.x, y2:p.y });
          }
          for (const o of R.allies) {
            if (o !== a && o.hp < o.maxHp && Math.hypot(o.x-a.x, o.y-a.y) < a.def.heal.radius) {
              o.hp = Math.min(o.maxHp, o.hp + pw);
            }
          }
        }
      }
    }
  }

  // ---------------- ユニット分離(敵・仲間・自分が重ならない = 合戦の戦線) ----------------
  // 押し合いは質量ベース: 同格同士は均等に押し合い、強い(tierが高い/ボス)ほど押されにくい
  function separateUnits(){
    const units = [];
    for (const e of R.enemies) if (!e.dead) {
      e._r = e.def.r * (e.sizeMul || 1);
      e._m = 1 + (e.def.tier || 0) * 0.6 + (e.boss ? 8 : 0) + (e.def.isReaper ? 2 : 0);
      units.push(e);
    }
    for (const a of R.allies) if (!a.waitAt && !a.dead) {
      a._r = a.def.r;
      a._m = 1 + (a.def.tier || 0) * 0.6;
      units.push(a);
    }
    // 主人公にも当たり判定(船上は除く)。質量は高めで押されにくい
    const pl = R.player;
    if (!pl.onBoat) { pl._r = 12; pl._m = 2.5; units.push(pl); }
    if (units.length < 2) return;
    const cell = 64, grid = new Map();
    for (const u of units) {
      const k = ((u.x / cell) | 0) + ',' + ((u.y / cell) | 0);
      const arr = grid.get(k);
      if (arr) arr.push(u); else grid.set(k, [u]);
    }
    for (const u of units) {
      const gx = (u.x / cell) | 0, gy = (u.y / cell) | 0;
      for (let ix = gx - 1; ix <= gx + 1; ix++) {
        for (let iy = gy - 1; iy <= gy + 1; iy++) {
          const arr = grid.get(ix + ',' + iy);
          if (!arr) continue;
          for (const v of arr) {
            if (v === u) continue;
            const dx = v.x - u.x, dy = v.y - u.y;
            const rr = (u._r + v._r) * 0.9;
            const d2 = dx * dx + dy * dy;
            if (d2 >= rr * rr) continue;
            if (d2 === 0) { u.x += Math.random() - 0.5; u.y += Math.random() - 0.5; continue; }
            const d = Math.sqrt(d2), tot = (rr - d) * 0.32;
            const mu = u._m || 1, mv = v._m || 1;
            const nx = dx / d, ny = dy / d;
            // 質量の逆比で分配: 重い(強い)方はあまり動かない
            u.x -= nx * tot * (mv / (mu + mv)); u.y -= ny * tot * (mv / (mu + mv));
            v.x += nx * tot * (mu / (mu + mv)); v.y += ny * tot * (mu / (mu + mv));
          }
        }
      }
    }
  }

  // ---------------- スキル発動 ----------------
  // 射程: 強化を反映しつつ画面外には伸びない(画面に収まらない分はズームで吸収)
  function effRange(base){
    const r = base * R.stats.range;
    const cap = R.rangeCapPx || 460;
    return Math.min(r, cap);
  }

  function cdReady(id, base){
    const cd = base * (1 - R.stats.cdr);
    if ((R.cd[id] || 0) <= R.time) { R.cd[id] = R.time + cd; return true; }
    return false;
  }
  function nearestEnemy(x, y, maxD){
    let best = null, bd = maxD || 1e9;
    for (const e of R.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bd) { best = e; bd = d; }
    }
    return best;
  }
  // 敵がいない時は岩や木箱などの破壊可能オブジェクトを狙う
  function nearestObject(x, y, maxD){
    let best = null, bd = maxD || 300;
    for (const o of R.objects || []) {
      const d = Math.hypot(o.x - x, o.y - y);
      if (d < bd) { best = o; bd = d; }
    }
    return best;
  }

  function updateSkills(dt){
    const p = R.player, st = R.stats, area = st.area;
    // --- マジックボルト ---
    const bolt = wstat('bolt');
    if (bolt && cdReady('bolt', bolt.cd)) {
      const tgt = nearestEnemy(p.x, p.y, effRange(360)) || nearestObject(p.x, p.y, effRange(280));
      if (tgt) {
        Sfx.shoot();
        for (let i = 0; i < bolt.count; i++) {
          const spread = (i - (bolt.count-1)/2) * 0.12;
          const d = Math.hypot(tgt.x-p.x, tgt.y-p.y) || 1;
          const a = Math.atan2(tgt.y-p.y, tgt.x-p.x) + spread;
          R.projs.push({ x:p.x, y:p.y, vx:Math.cos(a)*bolt.speed, vy:Math.sin(a)*bolt.speed,
                         dmg:bolt.dmg, life:1.6, size:6, pierce:bolt.pierce, color:'#58a6ff' });
        }
      } else R.cd['bolt'] = R.time + 0.15;
    }
    // --- 追尾ミサイル ---
    const hom = wstat('homing');
    if (hom && cdReady('homing', hom.cd)) {
      for (let i = 0; i < hom.count; i++) {
        const a = Math.random() * Math.PI * 2;
        R.projs.push({ x:p.x, y:p.y, vx:Math.cos(a)*hom.speed, vy:Math.sin(a)*hom.speed,
                       dmg:hom.dmg, life:3.2, size:6, pierce:0, homing:hom.turn, hspeed:hom.speed,
                       blast:hom.blast, color:'#f0883e' });
      }
    }
    // --- ブーメランアクス ---
    const axe = wstat('axe');
    if (axe && cdReady('axe', axe.cd)) {
      for (let i = 0; i < axe.count; i++) {
        const tgt = nearestEnemy(p.x, p.y, effRange(420));
        const a = tgt ? Math.atan2(tgt.y-p.y, tgt.x-p.x) + (i-(axe.count-1)/2)*0.4 : Math.random()*7;
        R.projs.push({ x:p.x, y:p.y, vx:Math.cos(a)*330, vy:Math.sin(a)*330,
                       dmg:axe.dmg, life:axe.range/330*2, size:axe.size, pierce:99, boomerang:true,
                       phase:0, maxT:axe.range/330, color:'#9aa5b1' });
      }
    }
    // --- チェインライトニング ---
    const ch = wstat('chain');
    if (ch && cdReady('chain', ch.cd)) {
      let cur = nearestEnemy(p.x, p.y, ch.range * area) || nearestObject(p.x, p.y, ch.range * area * 0.6);
      const hit = new Set();
      let px = p.x, py = p.y;
      for (let j = 0; j <= ch.jumps && cur; j++) {
        effect('bolt', px, py, { x2:cur.x, y2:cur.y });
        if (cur.type) hitObject(cur, ch.dmg); else dealDamage(cur, ch.dmg);
        hit.add(cur);
        px = cur.x; py = cur.y;
        let nxt = null, bd = 220 * area;
        for (const e of R.enemies) {
          if (e.dead || hit.has(e)) continue;
          const d = Math.hypot(e.x - px, e.y - py);
          if (d < bd) { nxt = e; bd = d; }
        }
        if (!nxt) for (const o of R.objects || []) {   // 敵が尽きたらオブジェクトへ連鎖
          if (hit.has(o)) continue;
          const d = Math.hypot(o.x - px, o.y - py);
          if (d < bd) { nxt = o; bd = d; }
        }
        cur = nxt;
      }
    }
    // --- フレイムリング ---
    const fl = wstat('flame');
    if (fl && cdReady('flame', fl.cd)) {
      const rad = fl.radius * area;
      effect('flamering', p.x, p.y, { r:rad });
      for (const e of R.enemies) {
        if (!e.dead && Math.hypot(e.x-p.x, e.y-p.y) < rad + e.def.r) {
          dealDamage(e, fl.dmg);
          if (fl.burn) { e.burn = fl.burn; e.burnT = 3; }
        }
      }
      damageObjectsIn(p.x, p.y, rad, fl.dmg);
    }
    // --- フロストノヴァ ---
    const nv = wstat('nova');
    if (nv && cdReady('nova', nv.cd)) {
      const rad = nv.radius * area;
      effect('ring', p.x, p.y, { color:'#76e3ea', r:rad });
      for (const e of R.enemies) {
        if (!e.dead && Math.hypot(e.x-p.x, e.y-p.y) < rad + e.def.r) {
          dealDamage(e, nv.dmg);
          e.slowUntil = R.time + nv.slowDur; e.slowMul = nv.slow;
          if (nv.freeze) e.frozenUntil = R.time + nv.freeze;
        }
      }
      damageObjectsIn(p.x, p.y, rad, nv.dmg);
    }
    // --- ポイズンミスト ---
    const po = wstat('poison');
    if (po && cdReady('poison', po.interval)) {
      R.zones.push({ x:p.x, y:p.y, size:po.size * area, until:R.time + po.dur, dps:po.dps, shred:po.shred });
      if (R.zones.length > 40) R.zones.shift();
    }
    // --- サンダーフォール ---
    const th = wstat('thunder');
    if (th && cdReady('thunder', th.cd)) {
      const thR = effRange(400);
      const cands = R.enemies.filter(e => !e.dead && Math.hypot(e.x-p.x, e.y-p.y) < thR);
      for (const o of R.objects || []) {
        if (Math.hypot(o.x-p.x, o.y-p.y) < thR * 0.9) cands.push(o);
      }
      for (let i = 0; i < th.count && cands.length; i++) {
        const e = cands[Math.floor(Math.random() * cands.length)];
        effect('thunder', e.x, e.y, {});
        const rad = th.blast * area;
        if (e.type) hitObject(e, th.dmg);
        for (const o of R.enemies) {
          if (!o.dead && Math.hypot(o.x-e.x, o.y-e.y) < rad + o.def.r) dealDamage(o, th.dmg);
        }
        damageObjectsIn(e.x, e.y, rad, th.dmg * 0.7);
      }
    }
    // --- オートタレット ---
    const tu = wstat('turret');
    if (tu) {
      if (cdReady('turret', tu.placeCd) && R.turrets.length < tu.maxTurrets) {
        R.turrets.push({ x:p.x, y:p.y, until:R.time + tu.life, fireCd:0 });
      }
      for (let i = R.turrets.length - 1; i >= 0; i--) {
        const t = R.turrets[i];
        if (R.time > t.until) { R.turrets.splice(i, 1); continue; }
        t.fireCd -= dt;
        if (t.fireCd <= 0) {
          const tgt = nearestEnemy(t.x, t.y, tu.range * area * st.range) || nearestObject(t.x, t.y, 260);
          if (tgt) {
            t.fireCd = tu.fireCd * (1 - st.cdr);
            const d = Math.hypot(tgt.x-t.x, tgt.y-t.y) || 1;
            const shots = tu.dual ? 2 : 1;
            for (let s = 0; s < shots; s++) {
              const a = Math.atan2(tgt.y-t.y, tgt.x-t.x) + (s ? 0.15 : 0);
              R.projs.push({ x:t.x, y:t.y, vx:Math.cos(a)*500, vy:Math.sin(a)*500,
                             dmg:tu.dmg, life:1.2, size:4, pierce:0, color:'#8b949e' });
            }
          }
        }
      }
    } else R.turrets.length = 0;
    // --- ガーディアンシールド ---
    const sh = Skills.stat('shield');
    if (sh) {
      if (R.shield.stocks < sh.stocks) {
        R.shield.timer -= dt;
        if (R.shield.timer <= 0) { R.shield.stocks++; R.shield.timer = sh.cd * (1 - st.cdr); }
      }
    } else R.shield.stocks = 0;
    // --- サンクチュアリ ---
    const sa = Skills.stat('sanctuary');
    if (sa) {
      p.hp = Math.min(st.maxHp, p.hp + sa.hps * dt);
      for (const a of R.allies) {
        if (!a.waitAt && Math.hypot(a.x-p.x, a.y-p.y) < sa.radius * area)
          a.hp = Math.min(a.maxHp, a.hp + sa.hps * dt);
      }
    }
    // --- プリズムレーザー ---
    const la = wstat('laser');
    if (la && cdReady('laser', la.cd)) {
      const dirs = la.beams === 1 ? [p.moveA] :
                   la.beams === 2 ? [p.moveA, p.moveA + Math.PI] :
                   [0, Math.PI/2, Math.PI, Math.PI*1.5];
      const laLen = effRange(440);
      for (const a of dirs) {
        effect('laser', p.x, p.y, { angle:a, len:laLen, w:la.width, dur:la.dur });
        beamHit(p.x, p.y, a, laLen, la.width, la.dmg);
      }
    }
    // --- メテオストーム ---
    const me = wstat('meteor');
    if (me && cdReady('meteor', me.cd)) {
      for (let i = 0; i < me.count; i++) {
        const x = p.x + rnd(-380, 380), y = p.y + rnd(-280, 280);
        effect('meteor', x, y, { delay:0.7 + i*0.1, blast:me.blast * area, dmg:me.dmg });
      }
    }
    // --- 時の砂 ---
    const sd = Skills.stat('sands');
    if (sd && cdReady('sands', sd.cd)) {
      R.sandsUntil = R.time + sd.dur;
      R.sandsRadius = sd.radius * area;
      R.sandsSlow = sd.slow;
      effect('ring', p.x, p.y, { color:'#d29922', r:R.sandsRadius });
    }
    // --- ドラゴンブレス ---
    const br = wstat('dragonbreath');
    if (br) {
      if (cdReady('breath', br.cd)) { R.breathUntil = R.time + br.dur; }
      if (R.breathUntil && R.time < R.breathUntil) {
        const a = p.moveA;
        effect('breath', p.x, p.y, { angle:a, range:br.range * area, arc:br.arc });
        for (const e of R.enemies) {
          if (e.dead) continue;
          const d = Math.hypot(e.x-p.x, e.y-p.y);
          if (d > br.range * area) continue;
          const ea = Math.atan2(e.y-p.y, e.x-p.x);
          let diff = Math.abs(ea - a); if (diff > Math.PI) diff = Math.PI*2 - diff;
          if (diff < br.arc) { e.hp -= br.dps * st.atk * dt; e.flash = 0.05; if (e.hp <= 0) killEnemy(e); }
        }
        for (const o of R.objects || []) {
          const d = Math.hypot(o.x-p.x, o.y-p.y);
          if (d > br.range * area) continue;
          const oa = Math.atan2(o.y-p.y, o.x-p.x);
          let diff = Math.abs(oa - a); if (diff > Math.PI) diff = Math.PI*2 - diff;
          if (diff < br.arc) hitObject(o, br.dps * dt);
        }
      }
    }
    // --- 虹の奔流(実績解放: 回転する虹光線) ---
    const przz = wstat('prism_ray');
    if (przz && cdReady('prism_ray', przz.cd)) {
      for (let i = 0; i < przz.beams; i++) {
        const a = R.time * przz.spin + i / przz.beams * Math.PI * 2;
        const prLen = effRange(przz.len);
        effect('laser', p.x, p.y, { angle:a, len:prLen, w:przz.width, dur:0.5, rainbow:true });
        beamHit(p.x, p.y, a, prLen, przz.width, przz.dmg);
      }
    }
    // --- 嵐の加護(基地強化: 自動落雷) ---
    if (st.stormDmg > 0 && (R.cd['gstorm'] || 0) <= R.time) {
      const tgt = nearestEnemy(p.x, p.y, 420) || nearestObject(p.x, p.y, 300);
      if (tgt) {
        R.cd['gstorm'] = R.time + 9;
        effect('thunder', tgt.x, tgt.y, {});
        if (tgt.type) hitObject(tgt, st.stormDmg / st.atk); else dealDamage(tgt, st.stormDmg / st.atk);
      } else R.cd['gstorm'] = R.time + 0.5;
    }
    // --- 混沌の瘴気(敵を混乱させ同士討ち) ※対象がいない時は保留 ---
    const cf = Skills.stat('confuse');
    if (cf && (R.cd['confuse'] || 0) <= R.time) {
      const cands = R.enemies.filter(e => !e.dead && !e.boss && !e.def.isReaper &&
        Math.hypot(e.x - p.x, e.y - p.y) < cf.radius * area);
      if (cands.length >= 2) {   // 同士討ちには2体以上必要
        R.cd['confuse'] = R.time + cf.cd * (1 - st.cdr);
        for (let i = 0; i < cf.count && cands.length; i++) {
          const e = cands.splice(Math.floor(Math.random() * cands.length), 1)[0];
          e.confusedUntil = R.time + cf.dur;
          popup(e.x, e.y - e.def.r - 10, '混乱!', '#c084fc');
        }
        effect('ring', p.x, p.y, { color:'#c084fc', r:cf.radius * area });
      } else R.cd['confuse'] = R.time + 0.3;
    }
    // --- 衰弱の呪印(被ダメ増+減速の呪い) ※対象がいない時は保留 ---
    const cu = Skills.stat('curse');
    if (cu && (R.cd['curse'] || 0) <= R.time) {
      const rad = cu.radius * area;
      let n = 0;
      for (const e of R.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) < rad + e.def.r) {
          e.shred = Math.max(e.shred, cu.shred);
          e.slowUntil = Math.max(e.slowUntil, R.time + cu.dur);
          e.slowMul = cu.slow;
          e.cursedUntil = R.time + cu.dur;
          n++;
        }
      }
      if (n > 0) {
        R.cd['curse'] = R.time + cu.cd * (1 - st.cdr);
        effect('ring', p.x, p.y, { color:'#a78bfa', r:rad });
      } else R.cd['curse'] = R.time + 0.3;
    }
    // --- ヘルメスの靴(残像) ---
    const bo = Skills.stat('boots');
    if (bo && bo.trail && (Math.abs(p.vx) > 10 || Math.abs(p.vy) > 10)) {
      if (cdReady('bootstrail', 0.25)) {
        R.zones.push({ x:p.x, y:p.y, size:20, until:R.time + 0.8, dps:bo.trail, shred:0, trail:true });
      }
    }
    // --- オービットオーブ(常時, updateProjectilesで処理) ---
    // 毒沼ゾーン処理
    for (let i = R.zones.length - 1; i >= 0; i--) {
      const z = R.zones[i];
      if (R.time > z.until) { R.zones.splice(i, 1); continue; }
      for (const e of R.enemies) {
        if (!e.dead && Math.hypot(e.x-z.x, e.y-z.y) < z.size + e.def.r) {
          e.hp -= z.dps * st.atk * dt;
          if (z.shred) e.shred = z.shred;
          e.flash = Math.max(e.flash, 0.03);
          if (e.hp <= 0) killEnemy(e);
        }
      }
      for (const o of R.objects || []) {
        if (Math.hypot(o.x-z.x, o.y-z.y) < z.size + o.r) hitObject(o, z.dps * dt);
      }
    }
  }

  // ビーム(直線)判定: 敵とオブジェクトの両方に命中
  function beamHit(x, y, angle, len, width, dmg){
    const ca = Math.cos(angle), sa = Math.sin(angle);
    for (const e of R.enemies) {
      if (e.dead) continue;
      const rx = e.x - x, ry = e.y - y;
      const proj = rx * ca + ry * sa;
      if (proj < 0 || proj > len) continue;
      if (Math.abs(-rx * sa + ry * ca) < width + e.def.r) dealDamage(e, dmg);
    }
    for (const o of R.objects || []) {
      const rx = o.x - x, ry = o.y - y;
      const proj = rx * ca + ry * sa;
      if (proj < 0 || proj > len) continue;
      if (Math.abs(-rx * sa + ry * ca) < width + o.r) hitObject(o, dmg);
    }
  }

  // オブジェクトへのダメージ
  function damageObjectsIn(x, y, radius, dmg){
    for (const o of R.objects || []) {
      if (Math.hypot(o.x - x, o.y - y) < radius + o.r) hitObject(o, dmg);
    }
  }
  function hitObject(o, dmg){
    o.hp -= dmg * R.stats.atk;
    World.setObjHp(o.key, o.hp);   // 削ったHPは保持(回復しない)
    if (o.hp <= 0) {
      World.destroyObject(o.key);
      R.objsDestroyed++;
      const drops = World.objectDrops(o.type, Skills.matUnlocked);
      if (drops.length && Math.random() < R.stats.salvage) drops.push(drops[0]);   // 解体術: 追加素材
      const opool = areaMats(o.x, o.y).filter(m => Skills.matUnlocked(m));
      if (opool.length && Math.random() < 0.3) drops.push(opool[Math.floor(Math.random() * opool.length)]);
      for (const m of drops) {
        const n = Math.random() < R.stats.luck2 ? 2 : 1;
        for (let i = 0; i < n; i++) dropPickup(o.x + rnd(-10,10), o.y + rnd(-10,10), { type:'mat', mat:m });
      }
      if (Math.random() < 0.25) dropPickup(o.x, o.y, { type:'coin', value:Math.ceil(1 * R.stats.coinMul) });
      effect('burst', o.x, o.y, { color:'#b08968', r:18 });
    }
  }

  // ---------------- 弾の更新 ----------------
  function updateProjectiles(dt){
    const p = R.player;
    // オービット
    const ob = wstat('orbit');
    if (ob) {
      R.orbitA = (R.orbitA || 0) + ob.spin * dt;
      for (let i = 0; i < ob.count; i++) {
        const a = R.orbitA + i / ob.count * Math.PI * 2;
        const ox = p.x + Math.cos(a) * ob.radius * R.stats.area;
        const oy = p.y + Math.sin(a) * ob.radius * R.stats.area;
        for (const e of R.enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x-ox, e.y-oy) < ob.size + e.def.r && R.time - e.orbitHit > 0.5) {
            e.orbitHit = R.time;
            dealDamage(e, ob.dmg);
          }
        }
        for (const o of R.objects || []) {
          if (Math.hypot(o.x-ox, o.y-oy) < ob.size + o.r && R.time - (o._orbHit || 0) > 0.5) {
            o._orbHit = R.time;
            hitObject(o, ob.dmg);
          }
        }
      }
    }
    for (let i = R.projs.length - 1; i >= 0; i--) {
      const b = R.projs[i];
      b.life -= dt;
      if (b.life <= 0) { R.projs.splice(i, 1); continue; }
      // 追尾
      if (b.homing) {
        const tgt = nearestEnemy(b.x, b.y, 400);
        if (tgt) {
          const want = Math.atan2(tgt.y-b.y, tgt.x-b.x);
          let cur = Math.atan2(b.vy, b.vx);
          let diff = want - cur;
          while (diff > Math.PI) diff -= Math.PI*2;
          while (diff < -Math.PI) diff += Math.PI*2;
          cur += Math.max(-b.homing*dt, Math.min(b.homing*dt, diff));
          b.vx = Math.cos(cur) * b.hspeed; b.vy = Math.sin(cur) * b.hspeed;
        }
      }
      // ブーメラン
      if (b.boomerang) {
        b.phase += dt;
        if (b.phase > b.maxT) {
          const d = Math.hypot(p.x-b.x, p.y-b.y) || 1;
          b.vx = (p.x-b.x)/d * 400; b.vy = (p.y-b.y)/d * 400;
          if (d < 30) { R.projs.splice(i, 1); continue; }
        }
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      // 命中
      let hit = false;
      for (const e of R.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x-b.x, e.y-b.y) < b.size + e.def.r) {
          if (b.boomerang) {
            if (!e._axeT || R.time - e._axeT > 0.5) { e._axeT = R.time; dealDamage(e, b.dmg); }
            continue;
          }
          dealDamage(e, b.dmg);
          if (b.blast) {
            effect('ring', b.x, b.y, { color:'#f0883e', r:b.blast });
            for (const o of R.enemies)
              if (!o.dead && o !== e && Math.hypot(o.x-b.x, o.y-b.y) < b.blast + o.def.r) dealDamage(o, b.dmg * 0.7);
          }
          if (b.pierce > 0) { b.pierce--; }
          else { hit = true; }
          break;
        }
      }
      if (hit) { R.projs.splice(i, 1); continue; }
      // オブジェクト命中
      for (const o of R.objects || []) {
        if (Math.hypot(o.x-b.x, o.y-b.y) < b.size + o.r) {
          hitObject(o, b.dmg);
          if (!b.boomerang && !(b.pierce-- > 0)) { R.projs.splice(i, 1); }
          break;
        }
      }
    }
    // エフェクト更新(メテオ着弾)
    for (const ef of R.effects) {
      if (ef.type === 'meteor' && !ef.hitDone) {
        ef.t += 0; // tはdraw側で加算
        if (ef.t >= ef.delay) {
          ef.hitDone = true;
          for (const e of R.enemies)
            if (!e.dead && Math.hypot(e.x-ef.x, e.y-ef.y) < ef.blast + e.def.r) dealDamage(e, ef.dmg);
          damageObjectsIn(ef.x, ef.y, ef.blast, ef.dmg);
        }
      }
    }
  }

  // ---------------- 港・基地・船 ----------------
  function updateInteractions(dt){
    const p = R.player;
    R.interact = null;
    // クエスト帰還直後は少しの間インタラクト無効(勝手に話しかけない)
    if (R.noInteractT > 0) { R.noInteractT -= dt; return; }

    // 基地: 未解放ならクエストへ(E)。解放済みはNPCと再会話でき、安全地帯(微回復)
    for (const b of World.bases) {
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      if (d < 90 && !SaveSys.data.bases[b.id]) {
        const qa = Quest.activeFor('base', b.id);
        const lbl = qa && Quest.active.phase === 'return' ? 'E: 報告する ❗'
                  : qa ? 'E: ' + DATA.QUESTS[b.id].npcName + 'と話す(依頼進行中)'
                  : 'E: 「' + b.name + '」を調べる';
        R.interact = { type:'basequest', base:b, label:lbl };
      } else if (d < 90 && SaveSys.data.bases[b.id] && DATA.QUESTS[b.id]) {
        const q2ret = Quest.activeFor('base2', b.id) && Quest.active.phase === 'return';
        const q2left = DATA.QUESTS2[b.id] && !(SaveSys.data.quests2 && SaveSys.data.quests2[b.id]);
        R.interact = { type:'npctalk', base:b,
          label: q2ret ? 'E: 報告する ❗'
               : 'E: ' + DATA.QUESTS[b.id].npcName + 'と話す' + (q2left && !Quest.active ? ' ❗依頼あり' : '') };
      }
      if (d < 150 && SaveSys.data.bases[b.id]) {
        p.hp = Math.min(R.stats.maxHp, p.hp + 3 * dt);
      }
    }

    // 港
    if (!p.onBoat) {
      for (const port of World.ports) {
        const d = Math.hypot(p.x - port.x, p.y - port.y);
        if (d < 80) {
          if (SaveSys.data.ports[port.id]) {
            R.interact = { type:'board', port, label:'E: 「' + port.name + '」から出航する' };
          } else {
            R.interact = { type:'portquest', port, label:'E: 船大工と話す(' + port.name + ')' };
          }
          break;
        }
      }
      // 停泊中のボート
      if (!R.interact && p.boatAnchor) {
        const d = Math.hypot(p.x - p.boatAnchor.x, p.y - p.boatAnchor.y);
        if (d < 90) R.interact = { type:'reboard', label:'E: 船に乗る' };
      }
    } else {
      R.interact = { type:'land', label:'陸に近づくと自動で上陸する' };
    }
  }

  function doInteract(){
    const p = R.player;
    const it = R.interact;
    if (!it) return;
    if (it.type === 'portquest') Quest.offer('port', it.port.id);
    else if (it.type === 'basequest') Quest.offer('base', it.base.id);
    else if (it.type === 'npctalk') Game.npcTalk(it.base.id);
    else if (it.type === 'board') boardBoat(it.port.seaX, it.port.seaY, it.port);
    else if (it.type === 'reboard') boardBoat(p.boatAnchor.x, p.boatAnchor.y, null);
  }

  function boardBoat(x, y, port){
    const p = R.player;
    p.onBoat = true;
    p.x = x; p.y = y;
    p.boatAnchor = null;
    Sfx.boat();
    // 陸の仲間は待機
    const spot = port ? { x:port.x, y:port.y } : { x:p.x, y:p.y };
    for (const a of R.allies) {
      if (a.def.env === 'land') {
        a.waitAt = { x:spot.x + rnd(-30,30), y:spot.y + rnd(-30,30) };
        a.x = a.waitAt.x; a.y = a.waitAt.y;
      } else if (a.waitAt && a.def.env === 'sea') {
        a.waitAt = null; a.x = p.x + rnd(-40,40); a.y = p.y + rnd(-40,40);
      }
    }
    popup(p.x, p.y - 30, '出航!(陸の仲間は待機)', '#76e3ea');
  }
  function disembark(lx, ly, wx, wy){
    const p = R.player;
    p.onBoat = false;
    p.boatAnchor = { x:wx, y:wy };
    p.x = lx; p.y = ly;
    Sfx.boat();
    // 海の仲間は沿岸で待機
    for (const a of R.allies) {
      if (a.def.env === 'sea') {
        a.waitAt = { x:wx + rnd(-30,30), y:wy + rnd(-30,30) };
        a.x = a.waitAt.x; a.y = a.waitAt.y;
      } else if (a.waitAt && a.def.env === 'land') {
        // 近ければ合流はupdateAlliesで
      }
    }
    popup(p.x, p.y - 30, '上陸!(海の仲間は沿岸で待機)', '#7ee787');
  }

  // ---------------- 更新メイン ----------------
  function update(dt){
    if (R.over) return;
    R.time += dt;
    R.stats = applyMods(R.baseStats);   // スキルのパッシブ効果をライブ反映
    const p = R.player, st = R.stats;
    p.invuln = Math.max(0, p.invuln - dt);

    // 移動(botAxisは自動テストプレイ用フック)
    const ax = R.botAxis || Input.axis();
    const spd = p.onBoat ? st.boatSpeed : st.speed;
    p.vx = ax.x * spd; p.vy = ax.y * spd;
    if (ax.x || ax.y) {
      p.moveA = Math.atan2(ax.y, ax.x);
      p.dir = ax.x < 0 ? -1 : (ax.x > 0 ? 1 : p.dir);
    }
    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
    if (p.onBoat) {
      const landHit = World.isLand(nx, ny);
      if (!landHit) { p.x = nx; p.y = ny; }
      else {
        // 上陸: 少し陸側へ進めた位置に降りる
        const a = Math.atan2(ny - p.y, nx - p.x);
        disembark(nx + Math.cos(a)*30, ny + Math.sin(a)*30, p.x, p.y);
      }
    } else {
      const isOnLand = World.isLand(nx, ny);
      if (isOnLand) { p.x = nx; p.y = ny; }
      else {
        if (World.isLand(nx, p.y)) p.x = nx;
        else if (World.isLand(p.x, ny)) p.y = ny;
      }
    }
    R.maxDist = Math.max(R.maxDist, Math.hypot(p.x, p.y));

    // 自然回復
    if (st.regen > 0) p.hp = Math.min(st.maxHp, p.hp + st.regen * dt);

    // オブジェクトキャッシュ(破壊後は時間経過でリスポーン)
    World.tick(dt);
    R.objects = World.nearbyObjects(p.x, p.y, 900);

    // 探索記録(行ったことのある場所がマップに残る)
    R.exploreAcc = (R.exploreAcc || 0) - dt;
    if (R.exploreAcc <= 0) {
      R.exploreAcc = 0.4;
      World.recordExplore(p.x, p.y, st.exploreRad);
      // 基地・港の発見記録(近づくとマップに載る)
      SaveSys.data.seen = SaveSys.data.seen || {};
      for (const b of World.bases) {
        if (!SaveSys.data.seen[b.id] && Math.hypot(p.x - b.x, p.y - b.y) < 900) SaveSys.data.seen[b.id] = true;
      }
      for (const pt of World.ports) {
        if (!SaveSys.data.seen[pt.id] && Math.hypot(p.x - pt.x, p.y - pt.y) < 900) SaveSys.data.seen[pt.id] = true;
      }
      // エリア進入バナー(大陸名・バイオーム・得意素材)
      const L = World.landAt(p.x, p.y);
      const cid = L ? L.cont.id : 'sea';
      R.curBiome = L ? (L.cont.biome || 'grass') : 'sea';
      if (cid !== R.curCont) {
        R.curCont = cid;
        if (L) {
          const bio = DATA.BIOMES[L.cont.biome] || DATA.BIOMES.grass;
          const mm = (bio.mats || []).filter(m => Skills.matUnlocked(m)).map(m => DATA.MATERIALS[m].name).join('・');
          R.warnMsg = '― ' + L.cont.name + ' <' + bio.name + '> ―' + (mm ? ' よく採れる: ' + mm : '');
        } else {
          R.warnMsg = '― 海域 ― よく採れる: ' + ['shell','coral'].filter(m => Skills.matUnlocked(m)).map(m => DATA.MATERIALS[m].name).join('・');
        }
        R.warnColor = '#a5d8ff';
        R.warnT = 4;
      }
    }
    R.peakAllies = Math.max(R.peakAllies, R.allies.length);

    // カメラ: 仲間が全員映る最小の視界。最初は狭く、軍勢が育つほど広がる
    const formR = formationRadius(R.allies.filter(a => !a.waitAt).length);
    const need = Math.max(250, formR + 190);
    const zTarget = Math.max(0.5, Math.min(1.35, (R.viewMin || 800) / (2 * need)));
    R.zoom = (R.zoom || 1) + (zTarget - (R.zoom || 1)) * Math.min(1, dt * 1.6);
    // 射程は見えている範囲まで(視界が広がると射程も活きる)
    R.rangeCapPx = (R.viewMin || 800) / (2 * (R.zoom || 1)) - 40;

    Quest.tick(dt);   // 防衛クエストの進行
    director(dt);
    updateEnemies(dt);
    updateAllies(dt);
    separateUnits();   // 敵・仲間が重ならない(合戦の戦線を形成)
    updateSkills(dt);
    updateProjectiles(dt);
    updatePickups(dt);
    updateInteractions(dt);

    // エフェクト時間
    for (let i = R.effects.length - 1; i >= 0; i--) {
      const ef = R.effects[i];
      ef.t += dt;
      const life = ef.type === 'meteor' ? (ef.delay + 0.4) : ef.type === 'laser' ? ef.dur : 0.5;
      if (ef.t > life) R.effects.splice(i, 1);
    }
    for (let i = R.popups.length - 1; i >= 0; i--) {
      const pp = R.popups[i];
      pp.t -= dt; pp.y -= 28 * dt;
      if (pp.t <= 0) R.popups.splice(i, 1);
    }
    R.warnT = Math.max(0, R.warnT - dt);
  }

  // ---------------- 描画 ----------------
  const TILE = 36;
  function tileHash(ix, iy){
    let h = (ix * 73856093 ^ iy * 19349663) >>> 0;
    return (h % 1000) / 1000;
  }
  let vignette = null;
  function draw(g, W, H){
    const p = R.player;
    R.viewMin = Math.min(W, H);
    const z = R.zoom || 1;
    const effW = W / z, effH = H / z;
    const camX = p.x - effW/2, camY = p.y - effH/2;
    R.offscreenR = Math.hypot(effW, effH) / 2 + 140;   // これより遠い敵は「見切れた」扱い

    g.save();
    g.scale(z, z);

    // 地形(バイオームごとに見た目が変わる)
    const x0 = Math.floor(camX / TILE), y0 = Math.floor(camY / TILE);
    const nx = Math.ceil(effW / TILE) + 1, ny = Math.ceil(effH / TILE) + 1;
    const waveT = Math.floor(R.time * 1.6) % 2;   // 海のゆらぎ
    const decoList = [];
    for (let iy = 0; iy <= ny; iy++) {
      for (let ix = 0; ix <= nx; ix++) {
        const wx = (x0 + ix) * TILE, wy = (y0 + iy) * TILE;
        const ti = World.tileAt(wx + TILE/2, wy + TILE/2);
        const bio = DATA.BIOMES[ti.biome] || DATA.BIOMES.grass;
        let c;
        const chk = ((x0+ix) + (y0+iy)) % 2 === 0;
        if (ti.t === 'grass') c = chk ? bio.g1 : bio.g2;
        else if (ti.t === 'sand') c = chk ? bio.s1 : bio.s2;
        else if (ti.t === 'sea') c = (chk !== (waveT === 1)) ? '#173a66' : '#194070';
        else c = (chk !== (waveT === 1)) ? '#0e2647' : '#102a4e';
        g.fillStyle = c;
        g.fillRect(wx - camX, wy - camY, TILE + 1, TILE + 1);
        // 地面の装飾(草・花・岩粒など、バイオーム色)
        if (ti.t === 'grass') {
          const hsh = tileHash(x0 + ix, y0 + iy);
          if (hsh < 0.14) decoList.push({ x: wx + hsh * 900 % TILE, y: wy + hsh * 1300 % TILE,
            c: bio.deco[Math.floor(hsh * 71) % bio.deco.length], big: hsh < 0.03 });
        }
      }
    }
    g.translate(-camX, -camY);
    // 装飾を描く
    for (const d of decoList) {
      g.fillStyle = d.c;
      g.globalAlpha = 0.5;
      if (d.big) { g.beginPath(); g.arc(d.x, d.y, 3, 0, 7); g.fill(); }
      else g.fillRect(d.x, d.y, 2.5, 2.5);
    }
    g.globalAlpha = 1;
    // 影(ユニットの足元)
    g.fillStyle = 'rgba(0,0,0,.25)';
    for (const e of R.enemies) { g.beginPath(); g.ellipse(e.x, e.y + e.def.r * (e.sizeMul||1) * 0.9, e.def.r * (e.sizeMul||1) * 0.8, 4, 0, 0, 7); g.fill(); }
    for (const a of R.allies) { if (!a.waitAt) { g.beginPath(); g.ellipse(a.x, a.y + a.def.r * 0.9, a.def.r * 0.7, 3.5, 0, 0, 7); g.fill(); } }
    g.beginPath(); g.ellipse(p.x, p.y + 15, 12, 4, 0, 0, 7); g.fill();

    // ゾーン(毒沼)
    for (const z of R.zones) {
      g.fillStyle = z.trail ? 'rgba(255,215,102,.18)' : 'rgba(126,231,135,.20)';
      g.beginPath(); g.arc(z.x, z.y, z.size, 0, 7); g.fill();
    }
    // 時の砂
    if (R.sandsUntil && R.time < R.sandsUntil) {
      g.strokeStyle = 'rgba(210,153,34,.5)'; g.lineWidth = 3;
      g.beginPath(); g.arc(p.x, p.y, R.sandsRadius, 0, 7); g.stroke();
    }
    // サンクチュアリ
    const sa = Skills.stat('sanctuary');
    if (sa) {
      g.strokeStyle = 'rgba(63,185,80,.35)'; g.lineWidth = 2;
      g.beginPath(); g.arc(p.x, p.y, sa.radius * R.stats.area, 0, 7); g.stroke();
    }
    // 威圧のオーラ
    const feD = Skills.stat('fear');
    if (feD) {
      g.strokeStyle = 'rgba(248,81,73,.25)'; g.lineWidth = 2;
      g.setLineDash([8, 8]);
      g.beginPath(); g.arc(p.x, p.y, feD.radius, 0, 7); g.stroke();
      g.setLineDash([]);
    }

    // オブジェクト(レアは金色に輝く)
    for (const o of R.objects || []) {
      if (o.rare) {
        g.strokeStyle = 'hsl(' + ((R.time * 120) % 360) + ',90%,65%)';
        g.globalAlpha = 0.7; g.lineWidth = 2.5;
        g.beginPath(); g.arc(o.x, o.y, 24 + Math.sin(R.time * 4) * 3, 0, 7); g.stroke();
        g.globalAlpha = 1;
      }
      Sprites.draw(g, o.sprite, o.x, o.y, 40);
      if (o.hp < o.maxHp) drawBar(g, o.x, o.y - 26, 28, o.hp / o.maxHp, '#b08968');
    }

    // 港・基地・停泊船
    for (const port of World.ports) {
      Sprites.draw(g, 'ob_dock', port.x, port.y, 56);
      Sprites.draw(g, 'npc_sailor', port.x + 36, port.y - 14, 30);
      if (SaveSys.data.ports[port.id]) Sprites.draw(g, 'boat', port.seaX, port.seaY, 44);
      else Sprites.draw(g, 'ob_wreck', port.seaX, port.seaY, 44);
      g.fillStyle = '#e6edf3'; g.font = '11px sans-serif'; g.textAlign = 'center';
      g.fillText((SaveSys.data.ports[port.id] ? '⚓ ' : '🛠 ') + port.name, port.x, port.y - 34);
    }
    for (const b of World.bases) {
      const un = SaveSys.data.bases[b.id];
      Sprites.draw(g, 'ob_flag', b.x, b.y, 48);
      if (un && DATA.QUESTS[b.id]) {
        Sprites.draw(g, DATA.QUESTS[b.id].npc, b.x + 42, b.y + 8, 34);
        if (DATA.QUESTS2[b.id] && !(SaveSys.data.quests2 && SaveSys.data.quests2[b.id])) {
          g.fillStyle = '#ffd766'; g.font = 'bold 14px sans-serif'; g.textAlign = 'center';
          g.fillText('❗', b.x + 42, b.y - 16);
        }
      }
      if (un) {
        g.strokeStyle = 'rgba(88,166,255,.5)'; g.lineWidth = 2;
        g.beginPath(); g.arc(b.x, b.y, 150, 0, 7); g.stroke();
      }
      g.fillStyle = un ? '#7ee787' : '#8b949e'; g.font = '11px sans-serif'; g.textAlign = 'center';
      g.fillText((un ? '✦ ' : '') + b.name, b.x, b.y - 32);
    }
    if (p.boatAnchor) Sprites.draw(g, 'boat', p.boatAnchor.x, p.boatAnchor.y, 44);

    // ピックアップ
    for (const pk of R.pickups) {
      const bob = Math.sin(pk.t * 5) * 3;
      if (pk.type === 'coin') Sprites.draw(g, 'coin', pk.x, pk.y + bob, 16);
      else if (pk.type === 'potion') Sprites.draw(g, 'potion', pk.x, pk.y + bob, 18);
      else Sprites.draw(g, 'mat_' + pk.mat, pk.x, pk.y + bob, 16);
    }

    // タレット
    const tu = wstat('turret');
    for (const t of R.turrets) {
      Sprites.draw(g, 'sk_turret', t.x, t.y, 30);
    }

    // 仲間
    for (const a of R.allies) {
      if (a.waitAt) g.globalAlpha = 0.7;
      Sprites.draw(g, a.def.sprite, a.x, a.y, a.def.r * 2.6);
      if (a.hp < a.maxHp) drawBar(g, a.x, a.y - a.def.r - 12, 26, a.hp / a.maxHp, '#7ee787');
      if (a.waitAt) {
        g.fillStyle = '#7ee787'; g.font = '10px sans-serif'; g.textAlign = 'center';
        g.fillText('待機中', a.x, a.y - a.def.r - 16);
      }
      g.globalAlpha = 1;
    }

    // 敵
    const RANK_COLORS = [null, '#c9d1d9', '#ffd766', '#f85149', '#c084fc'];
    for (const e of R.enemies) {
      const sz = e.def.r * 2.6 * (e.sizeMul || 1);
      // 強化ランクのオーラ(強い個体ほど禍々しい)
      if (e.rank > 0) {
        const rc = RANK_COLORS[e.rank];
        g.strokeStyle = rc; g.globalAlpha = 0.55; g.lineWidth = 1.5 + e.rank;
        g.beginPath(); g.arc(e.x, e.y + 3, e.def.r * (e.sizeMul || 1) + 5, 0, 7); g.stroke();
        if (e.rank >= 3) {
          g.globalAlpha = 0.18; g.fillStyle = rc;
          g.beginPath(); g.arc(e.x, e.y + 3, e.def.r * (e.sizeMul || 1) + 9, 0, 7); g.fill();
        }
        g.globalAlpha = 1;
      }
      if (e.def.rare) {   // レアモンスターは虹色に輝く
        g.strokeStyle = 'hsl(' + ((R.time * 240) % 360) + ',95%,65%)';
        g.globalAlpha = 0.8; g.lineWidth = 3;
        g.beginPath(); g.arc(e.x, e.y + 3, e.def.r + 7 + Math.sin(R.time * 6) * 2, 0, 7); g.stroke();
        g.globalAlpha = 1;
      }
      if (e.flash > 0) { g.globalAlpha = 0.6; }
      Sprites.draw(g, e.def.sprite, e.x, e.y, sz, e.x > p.x);
      g.globalAlpha = 1;
      if (R.time < e.frozenUntil) {
        g.fillStyle = 'rgba(118,227,234,.4)';
        g.beginPath(); g.arc(e.x, e.y, e.def.r + 4, 0, 7); g.fill();
      }
      if (e.hp < e.maxHp && !e.boss) drawBar(g, e.x, e.y - e.def.r - 10, e.def.r * 2, e.hp / e.maxHp, '#f85149');
      if (e.def.heal) {
        g.fillStyle = '#7ee787'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center';
        g.fillText('✚', e.x, e.y - e.def.r - 12);
      }
      if (R.time < (e.confusedUntil || 0)) {
        g.fillStyle = '#c084fc'; g.font = 'bold 14px sans-serif'; g.textAlign = 'center';
        g.fillText('?', e.x, e.y - e.def.r - 14);
      } else if (R.time < (e.cursedUntil || 0)) {
        g.fillStyle = '#a78bfa'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center';
        g.fillText('†', e.x, e.y - e.def.r - 14);
      }
    }

    // プレイヤー
    if (p.invuln > 0 && Math.floor(R.time * 12) % 2 === 0) g.globalAlpha = 0.4;
    if (p.onBoat) Sprites.draw(g, 'boat', p.x, p.y, 52, p.dir < 0);
    else Sprites.draw(g, 'player', p.x, p.y, 36, p.dir < 0);
    g.globalAlpha = 1;
    // シールド表示
    if (R.shield.stocks > 0) {
      g.strokeStyle = 'rgba(88,166,255,.7)'; g.lineWidth = 2 + R.shield.stocks;
      g.beginPath(); g.arc(p.x, p.y, 24, 0, 7); g.stroke();
    }

    // オービット描画
    const ob = wstat('orbit');
    if (ob) {
      for (let i = 0; i < ob.count; i++) {
        const a = (R.orbitA || 0) + i / ob.count * Math.PI * 2;
        const ox = p.x + Math.cos(a) * ob.radius * R.stats.area;
        const oy = p.y + Math.sin(a) * ob.radius * R.stats.area;
        g.fillStyle = '#c084fc';
        g.beginPath(); g.arc(ox, oy, ob.size, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,.5)';
        g.beginPath(); g.arc(ox - 3, oy - 3, ob.size * 0.3, 0, 7); g.fill();
      }
    }

    // 弾
    for (const b of R.projs) {
      g.fillStyle = b.color || '#58a6ff';
      g.beginPath(); g.arc(b.x, b.y, b.size, 0, 7); g.fill();
    }
    for (const b of R.eprojs) {
      g.fillStyle = '#f85149';
      g.beginPath(); g.arc(b.x, b.y, b.r, 0, 7); g.fill();
    }

    // エフェクト
    drawEffects(g);

    // ダメージポップ
    g.font = 'bold 13px sans-serif'; g.textAlign = 'center';
    for (const pp of R.popups) {
      g.globalAlpha = Math.min(1, pp.t * 2);
      g.fillStyle = pp.color;
      g.fillText(pp.txt, pp.x, pp.y);
    }
    g.globalAlpha = 1;

    g.restore();   // translate + scale を戻す

    // ビネット(画面端をしっとり暗く)
    if (!vignette || vignette.w !== W || vignette.h !== H) {
      const vg = g.createRadialGradient(W/2, H/2, Math.min(W,H)*0.45, W/2, H/2, Math.max(W,H)*0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.38)');
      vignette = { grad: vg, w: W, h: H };
    }
    g.fillStyle = vignette.grad;
    g.fillRect(0, 0, W, H);
    // 低HP警告パルス
    const hpR = Math.max(0, p.hp / R.stats.maxHp);
    if (hpR < 0.35) {
      g.fillStyle = `rgba(220,40,40,${(0.35 - hpR) * 0.6 * (0.6 + 0.4 * Math.sin(R.time * 6))})`;
      g.fillRect(0, 0, W, H);
    }
    // 終焉の刻: 空気が赤黒く染まる
    if (R.time >= DATA.REAPER_AT) {
      g.fillStyle = 'rgba(110,0,30,0.10)';
      g.fillRect(0, 0, W, H);
    } else if (R.time >= DATA.REAPER_AT - 120) {
      g.fillStyle = `rgba(110,0,30,${0.10 * (1 - (DATA.REAPER_AT - R.time) / 120)})`;
      g.fillRect(0, 0, W, H);
    }

    // ボスHPバー(小画面ではHUDと重ならない位置に)
    if (R.bossAlive && !R.bossAlive.dead) {
      const e = R.bossAlive;
      const bw = Math.min(440, W - 40);
      const by = W < 700 ? 108 : 54;
      g.fillStyle = 'rgba(0,0,0,.6)';
      g.fillRect(W/2 - bw/2, by, bw, 26);
      g.fillStyle = '#8b1e24';
      g.fillRect(W/2 - bw/2 + 4, by + 4, (bw - 8) * Math.max(0, e.hp / e.maxHp), 18);
      g.fillStyle = '#fff'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center';
      g.fillText(e.bossName || 'BOSS', W/2, by + 18);
    }

    drawMinimap(g, W);
  }

  function drawBar(g, x, y, w, ratio, color){
    g.fillStyle = 'rgba(0,0,0,.6)';
    g.fillRect(x - w/2, y, w, 4);
    g.fillStyle = color;
    g.fillRect(x - w/2, y, w * Math.max(0, Math.min(1, ratio)), 4);
  }

  function drawEffects(g){
    for (const ef of R.effects) {
      const pr = ef.t / 0.5;
      switch(ef.type){
        case 'spark': {
          g.strokeStyle = ef.color; g.globalAlpha = 1 - pr; g.lineWidth = 2;
          const sr = 4 + pr * 10;
          g.beginPath();
          g.moveTo(ef.x - sr, ef.y); g.lineTo(ef.x + sr, ef.y);
          g.moveTo(ef.x, ef.y - sr); g.lineTo(ef.x, ef.y + sr);
          g.stroke(); break; }
        case 'burst':
          g.strokeStyle = ef.color; g.globalAlpha = 1 - pr; g.lineWidth = 3;
          g.beginPath(); g.arc(ef.x, ef.y, ef.r * (0.5 + pr), 0, 7); g.stroke(); break;
        case 'ring':
          g.strokeStyle = ef.color; g.globalAlpha = 1 - pr; g.lineWidth = 4;
          g.beginPath(); g.arc(ef.x, ef.y, ef.r * pr, 0, 7); g.stroke(); break;
        case 'flamering':
          g.strokeStyle = '#f85149'; g.globalAlpha = 1 - pr; g.lineWidth = 10;
          g.beginPath(); g.arc(ef.x, ef.y, ef.r * pr, 0, 7); g.stroke();
          g.strokeStyle = '#ffa657'; g.lineWidth = 4;
          g.beginPath(); g.arc(ef.x, ef.y, ef.r * pr * 0.9, 0, 7); g.stroke(); break;
        case 'bolt':
          g.strokeStyle = '#fde047'; g.globalAlpha = 1 - pr; g.lineWidth = 3;
          g.beginPath(); g.moveTo(ef.x, ef.y);
          g.lineTo((ef.x+ef.x2)/2 + rnd(-14,14), (ef.y+ef.y2)/2 + rnd(-14,14));
          g.lineTo(ef.x2, ef.y2); g.stroke(); break;
        case 'healline':
          g.strokeStyle = '#7ee787'; g.globalAlpha = (1 - pr) * 0.6; g.lineWidth = 2;
          g.beginPath(); g.moveTo(ef.x, ef.y); g.lineTo(ef.x2, ef.y2); g.stroke(); break;
        case 'thunder':
          g.strokeStyle = '#fde047'; g.globalAlpha = 1 - pr; g.lineWidth = 5;
          g.beginPath(); g.moveTo(ef.x + rnd(-8,8), ef.y - 300);
          g.lineTo(ef.x + rnd(-10,10), ef.y - 120); g.lineTo(ef.x, ef.y); g.stroke();
          g.fillStyle = '#fff8c5'; g.globalAlpha = (1-pr) * 0.6;
          g.beginPath(); g.arc(ef.x, ef.y, 22 * (1-pr) + 6, 0, 7); g.fill(); break;
        case 'laser': {
          const a2 = ef.t / ef.dur;
          g.strokeStyle = ef.rainbow ? 'hsl(' + ((R.time * 300 + ef.angle * 90) % 360) + ',90%,65%)' : '#d2a8ff';
          g.globalAlpha = 1 - a2; g.lineWidth = ef.w * 2 * (1 - a2 * 0.5);
          g.beginPath(); g.moveTo(ef.x, ef.y);
          g.lineTo(ef.x + Math.cos(ef.angle) * ef.len, ef.y + Math.sin(ef.angle) * ef.len); g.stroke();
          g.strokeStyle = '#fff'; g.lineWidth = ef.w * 0.6;
          g.beginPath(); g.moveTo(ef.x, ef.y);
          g.lineTo(ef.x + Math.cos(ef.angle) * ef.len, ef.y + Math.sin(ef.angle) * ef.len); g.stroke(); break; }
        case 'meteor': {
          if (ef.t < ef.delay) {
            const fall = ef.t / ef.delay;
            g.strokeStyle = 'rgba(248,81,73,.5)'; g.globalAlpha = 0.6; g.lineWidth = 2;
            g.beginPath(); g.arc(ef.x, ef.y, ef.blast, 0, 7); g.stroke();
            g.fillStyle = '#f0883e';
            g.beginPath(); g.arc(ef.x + (1-fall) * 180, ef.y - (1-fall) * 420, 10, 0, 7); g.fill();
          } else {
            const pr2 = (ef.t - ef.delay) / 0.4;
            g.fillStyle = '#ffa657'; g.globalAlpha = (1 - pr2) * 0.7;
            g.beginPath(); g.arc(ef.x, ef.y, ef.blast * (0.4 + pr2 * 0.6), 0, 7); g.fill();
          } break; }
        case 'breath': {
          g.fillStyle = 'rgba(248,81,73,.25)'; g.globalAlpha = 1;
          g.beginPath(); g.moveTo(ef.x, ef.y);
          g.arc(ef.x, ef.y, ef.range, ef.angle - ef.arc, ef.angle + ef.arc);
          g.closePath(); g.fill(); break; }
      }
      g.globalAlpha = 1;
    }
  }

  function drawMinimap(g, W){
    // マップは書庫の「古い地図の修復」を買うまで存在しない(地図は最初の基地の解放で入手)
    if (!SaveSys.metaLv('lib_map')) return;
    const sz = Math.min(World.MM_SIZE, Math.floor(W * 0.34));
    const x0 = W - sz - 10, y0 = 10;
    const view = World.minimapView(R.player.x, R.player.y, R.mmWorld ? 'world' : 'local');
    g.globalAlpha = 0.92;
    g.drawImage(view.img, view.sx, view.sy, view.sw, view.sw, x0, y0, sz, sz);
    // 霧: 行ったことのある場所だけ地形が見える
    g.drawImage(World.fogCanvas(), view.sx, view.sy, view.sw, view.sw, x0, y0, sz, sz);
    g.globalAlpha = 1;
    g.strokeStyle = '#30363d'; g.strokeRect(x0, y0, sz, sz);
    const mmScale = sz / World.MM_SIZE;
    const dot = (wx, wy, c, r) => {
      if (!view.inView(wx, wy)) return;
      const q = view.toMM(wx, wy);
      if (q.x < 0 || q.x > World.MM_SIZE || q.y < 0 || q.y > World.MM_SIZE) return;
      g.fillStyle = c;
      g.beginPath(); g.arc(x0 + q.x * mmScale, y0 + q.y * mmScale, r || 2, 0, 7); g.fill();
    };
    // 基地・港は「発見済み」か「解放済み」だけ表示(行くまでわからない)
    const seen = SaveSys.data.seen || {};
    for (const b of World.bases) {
      if (SaveSys.data.bases[b.id]) dot(b.x, b.y, '#7ee787', 2.5);
      else if (SaveSys.data.nextHint === b.id) {
        // 地図に記された「次の拠点」: 点滅する目印
        if (view.inView(b.x, b.y)) {
          const q = view.toMM(b.x, b.y);
          if (q.x >= 0 && q.x <= World.MM_SIZE && q.y >= 0 && q.y <= World.MM_SIZE) {
            g.fillStyle = '#ffd766';
            g.globalAlpha = 0.6 + 0.4 * Math.sin(R.time * 5);
            g.beginPath(); g.arc(x0 + q.x * mmScale, y0 + q.y * mmScale, 4, 0, 7); g.fill();
            g.globalAlpha = 1;
            g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#ffd766';
            g.fillText('?', x0 + q.x * mmScale, y0 + q.y * mmScale + 3);
          }
        }
      }
      else if (seen[b.id]) dot(b.x, b.y, '#8b949e', 2.5);
    }
    for (const port of World.ports) {
      if (SaveSys.data.ports[port.id]) dot(port.x, port.y, '#76e3ea', 2.5);
      else if (seen[port.id]) dot(port.x, port.y, '#d29922', 2.5);
    }
    if (R.player.boatAnchor) dot(R.player.boatAnchor.x, R.player.boatAnchor.y, '#b08968', 3);
    dot(R.player.x, R.player.y, '#fff', 3.5);
    g.fillStyle = '#8b949e'; g.font = '10px sans-serif'; g.textAlign = 'center';
    g.fillText(R.mmWorld ? '全体図 [タップで切替]' : '周辺図 [タップで切替]', x0 + sz / 2, y0 + sz + 12);
  }
  function toggleMap(){ R.mmWorld = !R.mmWorld; }

  // ---------------- HUD (DOM) ----------------
  const hpBar = document.getElementById('hp-bar');
  const hpText = document.getElementById('hp-text');
  const timerEl = document.getElementById('timer');
  const coinEl = document.getElementById('coin-text');
  const allyView = document.getElementById('ally-view');
  const lootEl = document.getElementById('loot-feed');
  const warnEl = document.getElementById('warn-banner');
  const hintEl = document.getElementById('interact-hint');
  let hudAcc = 0;
  let lootFeed = [];   // 素材入手フィード { mat, n, t }

  function lootAdd(mat){
    const e = lootFeed.find(l => l.mat === mat);
    if (e) { e.n++; e.t = 2.4; }
    else { lootFeed.push({ mat, n: 1, t: 2.4 }); if (lootFeed.length > 5) lootFeed.shift(); }
  }
  function renderLoot(){
    let h = '';
    for (const l of lootFeed) {
      const md = DATA.MATERIALS[l.mat];
      h += `<div class="loot-line" style="opacity:${Math.min(1, l.t * 1.5).toFixed(2)}">
        <span class="mat-dot" style="background:${md.color}"></span>${md.name}${l.n > 1 ? ' ×' + l.n : ''} を手に入れた</div>`;
    }
    lootEl.innerHTML = h;
  }

  function updateHud(dt){
    // 入手フィードの減衰は毎フレーム(表示の消え際をなめらかに)
    let lootDirty = lootFeed.length > 0;
    for (let i = lootFeed.length - 1; i >= 0; i--) {
      lootFeed[i].t -= dt;
      if (lootFeed[i].t <= 0) lootFeed.splice(i, 1);
    }
    if (lootDirty) renderLoot();
    hudAcc -= dt;
    if (hudAcc > 0) return;
    hudAcc = 0.15;
    const p = R.player, st = R.stats;
    hpBar.style.width = Math.max(0, p.hp / st.maxHp * 100) + '%';
    hpBar.style.background = p.hp / st.maxHp > 0.35 ? '' : 'linear-gradient(#f85149,#8b1e24)';
    hpText.textContent = Math.ceil(Math.max(0, p.hp)) + ' / ' + st.maxHp;
    timerEl.textContent = fmtTime(R.time);
    timerEl.style.color = R.time >= DATA.REAPER_AT ? '#f85149' : (R.time >= DATA.REAPER_AT - 60 ? '#ffd766' : '');
    coinEl.textContent = fmtNum(R.coins);
    // 危険度: 初期地点から離れるほど上がる(敵の強さの指標)
    const danger = World.ringOf(p.x, p.y) + 1;
    const dEl = document.getElementById('danger-view');
    dEl.textContent = '☠ 危険度 ' + danger;
    dEl.style.color = danger <= 2 ? '#7ee787' : danger <= 4 ? '#ffd766' : danger <= 8 ? '#f85149' : '#c084fc';
    document.getElementById('dist-view').textContent = '📍 ' + fmtNum(Math.hypot(p.x, p.y));
    const waiting = R.allies.filter(a => a.waitAt).length;
    allyView.textContent = waiting ? '待機中の仲間 ' + waiting : '';
    // スキルボタン: 「まだ見ていない」取得可能スキルがあれば光る(開けば消える)
    const rc = Skills.unseenReadyCount();
    const skBtn = document.getElementById('btn-skill');
    skBtn.classList.toggle('ready', rc > 0);
    document.getElementById('skill-badge').textContent = rc > 0 ? rc : '';
    // マップ内クエストの目標表示
    const qObj = document.getElementById('quest-obj');
    if (Quest.active) {
      qObj.textContent = Quest.objText();
      qObj.classList.remove('hidden');
    } else qObj.classList.add('hidden');
    if (R.warnT > 0) {
      warnEl.textContent = R.warnMsg;
      warnEl.style.color = R.warnColor || '';
      warnEl.classList.remove('hidden');
    } else { warnEl.classList.add('hidden'); R.warnColor = null; }
    if (R.interact && R.interact.type !== 'land') {
      hintEl.textContent = R.interact.label;
      hintEl.classList.remove('hidden');
      document.getElementById('btn-act').classList.remove('hidden');
    } else {
      hintEl.classList.add('hidden');
      document.getElementById('btn-act').classList.add('hidden');
    }
  }

  // 周回結果を確定して銀行へ
  function finishRun(retired){
    const s = SaveSys.data;
    // 余り素材はお金に変換
    let matBonus = 0;
    const mats = Skills.mats();
    for (const m in mats) {
      matBonus += (mats[m] || 0) * (DATA.MATERIALS[m].tier + 1);
    }
    let total = R.coins + matBonus;
    // 死中の活: 力尽きた時の持ち帰りが増える
    if (!retired) total = Math.round(total * R.stats.deathBonus);
    s.coins += total;
    s.stats.runs++;
    s.stats.kills += R.kills;
    s.stats.totalCoins += total;
    s.stats.recruits += R.recruits;
    s.stats.bossKills += R.bossKills;
    s.stats.reaperKills += R.reaperKills;
    s.stats.rareKills += R.rareKills;
    s.stats.matsCollected += R.matsGot;
    s.stats.objectsDestroyed += R.objsDestroyed;
    s.stats.maxAlliesEver = Math.max(s.stats.maxAlliesEver || 0, R.peakAllies);
    if (!retired) s.stats.deaths = (s.stats.deaths || 0) + 1;
    s.stats.bestTime = Math.max(s.stats.bestTime, R.time);
    s.stats.maxDist = Math.max(s.stats.maxDist, Math.round(R.maxDist));
    s.explored = World.exploredArray();   // 行った場所を保存
    const newAchs = SaveSys.checkAchievements();
    if (newAchs.length) Sfx.unlock();
    SaveSys.save();
    return { coins:R.coins, matBonus, total, time:R.time, kills:R.kills,
             recruits:R.recruits, retired, dist:Math.round(R.maxDist), newAchs };
  }

  return { start, update, draw, updateHud, doInteract, finishRun, toggleMap,
           get state(){ return R; } };
})();
