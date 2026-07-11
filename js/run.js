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
    const boots = Skills.stat('boots');
    const magnetSk = Skills.stat('magnetSk');
    return {
      maxHp: 100 + 20*m('altar_hp') + 40*m('g_black_dark'),
      atk: (1 + 0.08*m('altar_atk')) * (1 + 0.05*m('g_west_fire')) * (1 + 0.10*m('g_black_dark')),
      speed: 190 * (1 + 0.03*m('altar_speed')) * (boots ? boots.mult : 1),
      regen: 0.5*m('altar_regen') + 1*m('g_south_heal'),
      armor: Math.min(0.6, 0.02*m('altar_armor')),
      wall: 0.03*m('g_north_wall'),
      crit: 0.02*m('altar_crit'),
      cdr: Math.min(0.4, 0.02*m('lib_cdr') + 0.015*m('g_east_cdr')),
      area: 1 + 0.04*m('g_east_area'),
      magnet: 42 * (1 + 0.12*m('lab_magnet')) * (magnetSk ? magnetSk.mult : 1),
      recruit: 0.03 + 0.01*m('camp_recruit'),
      allyCap: 3 + m('camp_cap'),
      allyHp: (1 + 0.15*m('camp_hp')) * (1 + 0.08*m('g_green_ally')),
      allyAtk: (1 + 0.12*m('camp_atk')) * (1 + 0.08*m('g_green_ally')),
      allyRegen: 0.01*m('camp_heal'),
      allyRevive: 0.3 * Math.min(1, m('camp_revive')/5*1) * (m('camp_revive')>0?1:0),
      allyReviveChance: m('camp_revive') * 0.06,
      coinMul: (1 + 0.1*m('lab_coin')) * (1 + 0.15*m('g_white_gold')),
      dropMul: 1 + 0.1*m('lab_drop'),
      luck2: 0.04*m('lab_luck'),
      thorns: 5*m('g_north_thorn'),
      bossDmg: 1 + 0.08*m('g_west_boss'),
      reaperRes: Math.min(0.9, 0.06*m('g_dragon_res')),
      reaperDmg: 1 + 0.15*m('g_dusk_slay'),
      timeMitig: Math.min(0.45, 0.03*m('g_star_time')),
      potion: 0.004*m('g_south_potion'),
      revives: m('altar_revive'),
    };
  }

  // ---------------- 周回開始 ----------------
  function start(startPos){
    Skills.reset();
    World.resetRun();
    R.time = 0;
    R.player = { x:startPos.x, y:startPos.y, hp:1, dir:1, moveA:0,
                 onBoat:false, boatAnchor:null, invuln:0 };
    R.stats = calcStats();
    R.player.hp = R.stats.maxHp;
    R.coins = 0; R.kills = 0; R.recruits = 0; R.bossKills = 0; R.reaperKills = 0;
    R.usedRevives = 0;
    R.enemies = []; R.allies = []; R.projs = []; R.eprojs = []; R.pickups = [];
    R.turrets = []; R.zones = []; R.effects = []; R.popups = [];
    R.cd = {}; R.shield = { stocks:0, timer:0 };
    R.spawnAcc = 0; R.bossDone = {}; R.reaperAcc = 0;
    R.baseChannel = null;
    R.interact = null;
    R.vacuumT = 0; R.warnT = 0; R.warnMsg = '';
    R.maxDist = Math.hypot(startPos.x, startPos.y);
    R.bossAlive = null;
    R.over = false;
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
    Sfx.hit();
    popup(e.x, e.y - e.def.r - 6, fmtNum(d), opts.crit ? '#ffd766' : '#e6edf3');
    if (e.hp <= 0) killEnemy(e, opts);
    return d;
  }

  function popup(x, y, txt, color){
    if (R.popups.length > 60) R.popups.shift();
    R.popups.push({ x, y, txt, color, t:0.8 });
  }

  function killEnemy(e, opts = {}){
    if (e.dead) return;
    e.dead = true;
    R.kills++;
    if (e.boss) { R.bossKills++; if (R.bossAlive === e) R.bossAlive = null; }
    if (e.def.isReaper) R.reaperKills++;
    const st = R.stats;
    // コイン
    const c = Math.max(1, Math.round(e.coin * st.coinMul * (0.8 + Math.random()*0.4)));
    dropPickup(e.x, e.y, { type:'coin', value:c });
    // 素材ドロップ
    for (const dr of e.def.drops || []) {
      if (!Skills.matUnlocked(dr.m)) continue;
      if (Math.random() < dr.c * st.dropMul) {
        const n = Math.random() < st.luck2 ? 2 : 1;
        for (let i = 0; i < n; i++) dropPickup(e.x + rnd(-14,14), e.y + rnd(-14,14), { type:'mat', mat:dr.m });
      }
    }
    // ポーション
    if (Math.random() < st.potion) dropPickup(e.x, e.y, { type:'potion' });
    // 仲間勧誘(ボス/リーパー以外)
    if (!e.boss && !e.def.isReaper && R.allies.length < st.allyCap && Math.random() < st.recruit) {
      recruitAlly(e);
    }
    effect('burst', e.x, e.y, { color:e.def.isReaper ? '#f85149' : '#ffd766', r:e.def.r + 8 });
  }

  function recruitAlly(e){
    const wb = Skills.stat('warbanner');
    const st = R.stats;
    const hpMul = st.allyHp * (wb ? wb.hp : 1);
    R.allies.push({
      def: e.def, key: e.defKey,
      x: e.x, y: e.y,
      maxHp: e.maxHp * 0.8 * hpMul,
      hp: e.maxHp * 0.8 * hpMul,
      dmg: e.dmg * 0.9,
      speed: e.def.speed * 1.15,
      atkCd: 0, healCd: 0, shootCd: 0,
      waitAt: null, saved: false,
    });
    R.recruits++;
    Sfx.recruit();
    popup(e.x, e.y - 22, '仲間になった!', '#7ee787');
  }

  function damagePlayer(dmg, src){
    const st = R.stats;
    const p = R.player;
    if (p.invuln > 0) return;
    // シールド
    if (R.shield.stocks > 0) {
      R.shield.stocks--;
      const sh = Skills.stat('shield');
      effect('ring', p.x, p.y, { color:'#58a6ff', r:60 });
      if (sh && sh.knock) knockback(p.x, p.y, 120, 260);
      if (sh && sh.burst) aoeDamage(p.x, p.y, 100, sh.burst);
      p.invuln = 0.4;
      return;
    }
    let d = dmg;
    let armor = st.armor;
    if (p.hp < st.maxHp * 0.3) armor = Math.min(0.85, armor + st.wall);
    d *= (1 - armor);
    if (src && src.def && src.def.isReaper) d *= (1 - st.reaperRes);
    p.hp -= d;
    p.invuln = 0.35;
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
        e.x += (e.x - x) / d * force * 0.3;
        e.y += (e.y - y) / d * force * 0.3;
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
        if (pk.type === 'coin') { R.coins += pk.value; Sfx.coin(); }
        else if (pk.type === 'mat') { Skills.addMat(pk.mat, 1); Sfx.mat(); }
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
    if (opts.boss) { e.sizeMul = 2.2; R.bossAlive = e; }
    R.enemies.push(e);
    return e;
  }

  function director(dt){
    const min = R.time / 60;
    // 通常スポーン
    const isReaperTime = R.time >= DATA.REAPER_AT;
    const rate = (0.9 + min * 0.10 + World.ringOf(R.player.x, R.player.y) * 0.18) * (isReaperTime ? 0.5 : 1);
    R.spawnAcc += dt * rate;
    const cap = 150;
    while (R.spawnAcc >= 1) {
      R.spawnAcc -= 1;
      if (R.enemies.length >= cap) break;
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
      spawnEnemy(pick);
    }
    // ボス
    for (const b of DATA.BOSSES) {
      if (min >= b.at && !R.bossDone[b.at]) {
        R.bossDone[b.at] = true;
        const e = spawnEnemy(b.base, { boss:true, bossName:b.name, hpMul:b.hpMul, dmgMul:b.dmgMul, coin:b.coin, dist:620 });
        if (e) { e.def = Object.assign({}, e.def, { sprite: b.sprite }); }
        R.warnMsg = '⚠ ' + b.name + ' が現れた!'; R.warnT = 4;
        Sfx.boss();
      }
    }
    // 終焉の刻
    if (isReaperTime) {
      if (!R.reaperWarned) {
        R.reaperWarned = true;
        R.warnMsg = '☠ 終焉の刻 ― リーパーの大群が押し寄せる!'; R.warnT = 6;
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
      // 遠すぎたら消滅(ボスは除く)
      const pd = Math.hypot(e.x - p.x, e.y - p.y);
      if (pd > 1500 && !e.boss) { R.enemies.splice(i, 1); continue; }
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
      if (e.def.move === 'kite') {
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

      // 接触ダメージ(プレイヤー)
      if (pd < e.def.r + 16 && e.contactCd <= 0) {
        e.contactCd = 0.6;
        damagePlayer(e.dmg, e);
      }
      // 接触ダメージ(仲間)
      for (const a of R.allies) {
        if (e.contactCd <= 0 && Math.hypot(a.x - e.x, a.y - e.y) < e.def.r + 14) {
          e.contactCd = 0.6;
          damageAlly(a, e.dmg * 0.8);
          break;
        }
      }
      // 射撃
      if (e.def.ranged) {
        e.shootCd -= dt;
        if (e.shootCd <= 0 && pd < e.def.ranged.range) {
          e.shootCd = e.def.ranged.cd;
          const d = pd || 1;
          R.eprojs.push({ x:e.x, y:e.y, vx:(p.x-e.x)/d*e.def.ranged.pspeed, vy:(p.y-e.y)/d*e.def.ranged.pspeed,
                          dmg:e.dmg, life:3, r:5 });
        }
      }
    }
    // 敵弾
    for (let i = R.eprojs.length - 1; i >= 0; i--) {
      const b = R.eprojs[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0) { R.eprojs.splice(i, 1); continue; }
      if (Math.hypot(b.x - p.x, b.y - p.y) < 16) { damagePlayer(b.dmg); R.eprojs.splice(i, 1); }
    }
  }

  // ---------------- 仲間の更新 ----------------
  function damageAlly(a, dmg){
    a.hp -= dmg;
    if (a.hp <= 0) {
      if (!a.saved && Math.random() < R.stats.allyReviveChance) {
        a.hp = 1; a.saved = true;
        popup(a.x, a.y - 20, '踏みとどまった!', '#7ee787');
      } else {
        a.dead = true;
        effect('burst', a.x, a.y, { color:'#7ee787', r:16 });
        popup(a.x, a.y - 20, '仲間が倒れた…', '#f85149');
      }
    }
  }

  function updateAllies(dt){
    const p = R.player;
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
      // ターゲット探索
      let tgt = null, td = 300;
      for (const e of R.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - a.x, e.y - a.y);
        if (d < td) { tgt = e; td = d; }
      }
      let dest, spd = a.speed * spdMul;
      if (tgt) {
        dest = tgt;
        // 射撃タイプの仲間
        if (a.def.ranged) {
          a.shootCd -= dt;
          if (td < a.def.ranged.range) {
            if (a.shootCd <= 0) {
              a.shootCd = a.def.ranged.cd;
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
            a.atkCd = 0.7;
            dealDamage(tgt, a.dmg * atkMul / R.stats.atk); // dealDamage内でatk倍されるため相殺
          }
          dest = null;
        }
      } else {
        // 隊列位置へ追従
        const ang = (i / Math.max(1, n)) * Math.PI * 2 + R.time * 0.15;
        dest = { x: p.x + Math.cos(ang) * 55, y: p.y + Math.sin(ang) * 55 };
        const d = Math.hypot(dest.x - a.x, dest.y - a.y);
        if (d < 12) dest = null;
        if (d > 500) { a.x = p.x + rnd(-30, 30); a.y = p.y + rnd(-30, 30); dest = null; } // ワープ追従
      }
      if (dest) {
        const d = Math.hypot(dest.x - a.x, dest.y - a.y) || 1;
        const nx = a.x + (dest.x - a.x) / d * spd * dt;
        const ny = a.y + (dest.y - a.y) / d * spd * dt;
        if (canStand(a.def, nx, ny)) { a.x = nx; a.y = ny; }
        else if (canStand(a.def, nx, a.y)) a.x = nx;
        else if (canStand(a.def, a.x, ny)) a.y = ny;
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

  // ---------------- スキル発動 ----------------
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

  function updateSkills(dt){
    const p = R.player, st = R.stats, area = st.area;
    // --- マジックボルト ---
    const bolt = Skills.stat('bolt');
    if (bolt && cdReady('bolt', bolt.cd)) {
      const tgt = nearestEnemy(p.x, p.y, 480);
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
    const hom = Skills.stat('homing');
    if (hom && cdReady('homing', hom.cd)) {
      for (let i = 0; i < hom.count; i++) {
        const a = Math.random() * Math.PI * 2;
        R.projs.push({ x:p.x, y:p.y, vx:Math.cos(a)*hom.speed, vy:Math.sin(a)*hom.speed,
                       dmg:hom.dmg, life:3.2, size:6, pierce:0, homing:hom.turn, hspeed:hom.speed,
                       blast:hom.blast, color:'#f0883e' });
      }
    }
    // --- ブーメランアクス ---
    const axe = Skills.stat('axe');
    if (axe && cdReady('axe', axe.cd)) {
      for (let i = 0; i < axe.count; i++) {
        const tgt = nearestEnemy(p.x, p.y, 500);
        const a = tgt ? Math.atan2(tgt.y-p.y, tgt.x-p.x) + (i-(axe.count-1)/2)*0.4 : Math.random()*7;
        R.projs.push({ x:p.x, y:p.y, vx:Math.cos(a)*330, vy:Math.sin(a)*330,
                       dmg:axe.dmg, life:axe.range/330*2, size:axe.size, pierce:99, boomerang:true,
                       phase:0, maxT:axe.range/330, hitSet:{}, color:'#9aa5b1' });
      }
    }
    // --- チェインライトニング ---
    const ch = Skills.stat('chain');
    if (ch && cdReady('chain', ch.cd)) {
      let cur = nearestEnemy(p.x, p.y, ch.range * area);
      const hit = new Set();
      let px = p.x, py = p.y;
      for (let j = 0; j <= ch.jumps && cur; j++) {
        effect('bolt', px, py, { x2:cur.x, y2:cur.y });
        dealDamage(cur, ch.dmg);
        hit.add(cur);
        px = cur.x; py = cur.y;
        let nxt = null, bd = 220 * area;
        for (const e of R.enemies) {
          if (e.dead || hit.has(e)) continue;
          const d = Math.hypot(e.x - px, e.y - py);
          if (d < bd) { nxt = e; bd = d; }
        }
        cur = nxt;
      }
    }
    // --- フレイムリング ---
    const fl = Skills.stat('flame');
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
    const nv = Skills.stat('nova');
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
    }
    // --- ポイズンミスト ---
    const po = Skills.stat('poison');
    if (po && cdReady('poison', po.interval)) {
      R.zones.push({ x:p.x, y:p.y, size:po.size * area, until:R.time + po.dur, dps:po.dps, shred:po.shred });
      if (R.zones.length > 40) R.zones.shift();
    }
    // --- サンダーフォール ---
    const th = Skills.stat('thunder');
    if (th && cdReady('thunder', th.cd)) {
      const cands = R.enemies.filter(e => !e.dead && Math.hypot(e.x-p.x, e.y-p.y) < 460);
      for (let i = 0; i < th.count && cands.length; i++) {
        const e = cands[Math.floor(Math.random() * cands.length)];
        effect('thunder', e.x, e.y, {});
        const rad = th.blast * area;
        for (const o of R.enemies) {
          if (!o.dead && Math.hypot(o.x-e.x, o.y-e.y) < rad + o.def.r) dealDamage(o, th.dmg);
        }
      }
    }
    // --- オートタレット ---
    const tu = Skills.stat('turret');
    if (tu) {
      if (cdReady('turret', tu.placeCd) && R.turrets.length < tu.maxTurrets) {
        R.turrets.push({ x:p.x, y:p.y, until:R.time + tu.life, fireCd:0 });
      }
      for (let i = R.turrets.length - 1; i >= 0; i--) {
        const t = R.turrets[i];
        if (R.time > t.until) { R.turrets.splice(i, 1); continue; }
        t.fireCd -= dt;
        if (t.fireCd <= 0) {
          const tgt = nearestEnemy(t.x, t.y, tu.range * area);
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
    const la = Skills.stat('laser');
    if (la && cdReady('laser', la.cd)) {
      const dirs = la.beams === 1 ? [p.moveA] :
                   la.beams === 2 ? [p.moveA, p.moveA + Math.PI] :
                   [0, Math.PI/2, Math.PI, Math.PI*1.5];
      for (const a of dirs) {
        effect('laser', p.x, p.y, { angle:a, len:520, w:la.width, dur:la.dur });
        for (const e of R.enemies) {
          if (e.dead) continue;
          const rx = e.x - p.x, ry = e.y - p.y;
          const proj = rx * Math.cos(a) + ry * Math.sin(a);
          if (proj < 0 || proj > 520) continue;
          const perp = Math.abs(-rx * Math.sin(a) + ry * Math.cos(a));
          if (perp < la.width + e.def.r) dealDamage(e, la.dmg);
        }
      }
    }
    // --- メテオストーム ---
    const me = Skills.stat('meteor');
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
    const br = Skills.stat('dragonbreath');
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
      }
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
    if (o.hp <= 0) {
      World.destroyObject(o.key);
      const drops = World.objectDrops(o.type, Skills.matUnlocked);
      for (const m of drops) {
        const n = Math.random() < R.stats.luck2 ? 2 : 1;
        for (let i = 0; i < n; i++) dropPickup(o.x + rnd(-10,10), o.y + rnd(-10,10), { type:'mat', mat:m });
      }
      if (Math.random() < 0.3) dropPickup(o.x, o.y, { type:'coin', value:Math.ceil(2 * R.stats.coinMul) });
      effect('burst', o.x, o.y, { color:'#b08968', r:18 });
    }
  }

  // ---------------- 弾の更新 ----------------
  function updateProjectiles(dt){
    const p = R.player;
    // オービット
    const ob = Skills.stat('orbit');
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
        if (b.boomerang && b.hitSet[e.defKey + e.x] !== undefined) continue;
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

    // 基地
    R.baseChannel = null;
    for (const b of World.bases) {
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      if (d < 90) {
        if (!SaveSys.data.bases[b.id]) {
          // チャネリング解放
          b._ch = (b._ch || 0) + dt;
          R.baseChannel = { base:b, t:b._ch, need:8 };
          if (b._ch >= 8) {
            SaveSys.data.bases[b.id] = true;
            SaveSys.save();
            Sfx.unlock();
            R.warnMsg = '✦ 基地「' + b.name + '」を解放した!魂の広場にゲートが開いた'; R.warnT = 5;
          }
        }
      } else if (b._ch) b._ch = 0;
      // 解放済み基地は安全地帯(微回復)
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
            R.interact = { type:'repair', port, label:'E: 壊れた船を調べる(' + port.name + ')' };
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
    if (it.type === 'repair') openRepairPanel(it.port);
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

  // 修理パネル
  function openRepairPanel(port){
    Game.pauseFor('station');
    const body = document.getElementById('station-body');
    document.getElementById('station-title').textContent = '🛠 ' + port.name + ' ― 壊れた船の修理';
    const rep = port.repair;
    let matsH = '<div class="cost-line">';
    let ok = walletTotal() >= rep.coins;
    matsH += `<span class="cost-item ${walletTotal() >= rep.coins ? 'ok':'ng'}">🪙 ${fmtNum(walletTotal())}/${fmtNum(rep.coins)}</span>`;
    for (const m in rep.mats) {
      const have = Skills.matCount(m);
      const md = DATA.MATERIALS[m];
      if (have < rep.mats[m]) ok = false;
      matsH += `<span class="cost-item ${have >= rep.mats[m] ? 'ok':'ng'}">
        <span class="mat-dot" style="background:${md.color}"></span>${md.name} ${have}/${rep.mats[m]}</span>`;
    }
    matsH += '</div>';
    body.innerHTML = `<div class="up-card"><div class="info">
      <div class="name">修理条件</div>
      <div class="desc">お金と素材を集めて船を直そう。修理は恒久的(次の周回でも使える)。所持金は銀行残高+今回の獲得分。</div>
      ${matsH}</div>
      <button class="buy-btn" id="repair-btn" ${ok ? '' : 'disabled'}>修理する</button></div>`;
    document.getElementById('repair-btn').onclick = () => {
      if (!ok) return;
      for (const m in rep.mats) Skills.mats()[m] -= rep.mats[m];
      walletPay(rep.coins);
      SaveSys.data.ports[port.id] = true;
      SaveSys.save();
      Sfx.unlock();
      R.warnMsg = '⚓ ' + port.name + 'の船を修理した!出航できるぞ'; R.warnT = 5;
      Game.closeStation();
    };
  }

  // ---------------- 更新メイン ----------------
  function update(dt){
    if (R.over) return;
    R.time += dt;
    const p = R.player, st = R.stats;
    p.invuln = Math.max(0, p.invuln - dt);

    // 移動
    const ax = Input.axis();
    const spd = p.onBoat ? 260 : st.speed;
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

    // オブジェクトキャッシュ
    R.objects = World.nearbyObjects(p.x, p.y, 900);

    director(dt);
    updateEnemies(dt);
    updateAllies(dt);
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
  function draw(g, W, H){
    const p = R.player;
    const camX = p.x - W/2, camY = p.y - H/2;

    // 地形
    const x0 = Math.floor(camX / TILE), y0 = Math.floor(camY / TILE);
    const nx = Math.ceil(W / TILE) + 1, ny = Math.ceil(H / TILE) + 1;
    for (let iy = 0; iy <= ny; iy++) {
      for (let ix = 0; ix <= nx; ix++) {
        const wx = (x0 + ix) * TILE, wy = (y0 + iy) * TILE;
        const t = World.terrainAt(wx + TILE/2, wy + TILE/2);
        let c;
        const chk = ((x0+ix) + (y0+iy)) % 2 === 0;
        if (t === 'grass') c = chk ? '#274d33' : '#2a5237';
        else if (t === 'sand') c = chk ? '#8a7a50' : '#93835a';
        else if (t === 'sea') c = chk ? '#173a66' : '#194070';
        else c = chk ? '#0e2647' : '#102a4e';
        g.fillStyle = c;
        g.fillRect(wx - camX, wy - camY, TILE + 1, TILE + 1);
      }
    }

    g.save();
    g.translate(-camX, -camY);

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

    // オブジェクト
    for (const o of R.objects || []) {
      Sprites.draw(g, o.sprite, o.x, o.y, 40);
      if (o.hp < o.maxHp) drawBar(g, o.x, o.y - 26, 28, o.hp / o.maxHp, '#b08968');
    }

    // 港・基地・停泊船
    for (const port of World.ports) {
      Sprites.draw(g, 'ob_dock', port.x, port.y, 56);
      if (SaveSys.data.ports[port.id]) Sprites.draw(g, 'boat', port.seaX, port.seaY, 44);
      else Sprites.draw(g, 'ob_wreck', port.seaX, port.seaY, 44);
      g.fillStyle = '#e6edf3'; g.font = '11px sans-serif'; g.textAlign = 'center';
      g.fillText((SaveSys.data.ports[port.id] ? '⚓ ' : '🛠 ') + port.name, port.x, port.y - 34);
    }
    for (const b of World.bases) {
      const un = SaveSys.data.bases[b.id];
      Sprites.draw(g, 'ob_flag', b.x, b.y, 48);
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
    const tu = Skills.stat('turret');
    for (const t of R.turrets) {
      Sprites.draw(g, 'sk_turret', t.x, t.y, 30);
    }

    // 仲間
    for (const a of R.allies) {
      if (a.waitAt) g.globalAlpha = 0.7;
      g.strokeStyle = '#7ee787'; g.lineWidth = 2;
      g.beginPath(); g.arc(a.x, a.y + 4, a.def.r + 5, 0, 7); g.stroke();
      Sprites.draw(g, a.def.sprite, a.x, a.y, a.def.r * 2.6);
      drawBar(g, a.x, a.y - a.def.r - 12, 26, a.hp / a.maxHp, '#7ee787');
      if (a.waitAt) {
        g.fillStyle = '#7ee787'; g.font = '10px sans-serif'; g.textAlign = 'center';
        g.fillText('待機中', a.x, a.y - a.def.r - 16);
      }
      g.globalAlpha = 1;
    }

    // 敵
    for (const e of R.enemies) {
      const sz = e.def.r * 2.6 * (e.sizeMul || 1);
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
    // 基地チャネリング
    if (R.baseChannel) {
      const bc = R.baseChannel;
      g.strokeStyle = '#ffd766'; g.lineWidth = 5;
      g.beginPath(); g.arc(p.x, p.y - 40, 14, -Math.PI/2, -Math.PI/2 + bc.t/bc.need * Math.PI*2); g.stroke();
      g.fillStyle = '#ffd766'; g.font = '12px sans-serif'; g.textAlign = 'center';
      g.fillText('基地解放中… ' + Math.ceil(bc.need - bc.t) + 's', p.x, p.y - 62);
    }

    // オービット描画
    const ob = Skills.stat('orbit');
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

    g.restore();

    // ボスHPバー
    if (R.bossAlive && !R.bossAlive.dead) {
      const e = R.bossAlive;
      g.fillStyle = 'rgba(0,0,0,.6)';
      g.fillRect(W/2 - 220, 54, 440, 26);
      g.fillStyle = '#8b1e24';
      g.fillRect(W/2 - 216, 58, 432 * Math.max(0, e.hp / e.maxHp), 18);
      g.fillStyle = '#fff'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center';
      g.fillText(e.bossName || 'BOSS', W/2, 72);
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
          g.strokeStyle = '#d2a8ff'; g.globalAlpha = 1 - a2; g.lineWidth = ef.w * 2 * (1 - a2 * 0.5);
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
    const mm = World.minimap();
    const sz = World.MM_SIZE;
    const x0 = W - sz - 12, y0 = 12;
    g.globalAlpha = 0.9;
    g.drawImage(mm, x0, y0);
    g.globalAlpha = 1;
    g.strokeStyle = '#30363d'; g.strokeRect(x0, y0, sz, sz);
    const dot = (wx, wy, c, r) => {
      const q = World.worldToMM(wx, wy);
      if (q.x < 0 || q.x > sz || q.y < 0 || q.y > sz) return;
      g.fillStyle = c;
      g.beginPath(); g.arc(x0 + q.x, y0 + q.y, r || 2, 0, 7); g.fill();
    };
    for (const b of World.bases) dot(b.x, b.y, SaveSys.data.bases[b.id] ? '#7ee787' : '#8b949e', 2.5);
    for (const port of World.ports) dot(port.x, port.y, SaveSys.data.ports[port.id] ? '#76e3ea' : '#d29922', 2.5);
    if (R.player.boatAnchor) dot(R.player.boatAnchor.x, R.player.boatAnchor.y, '#b08968', 3);
    dot(R.player.x, R.player.y, '#fff', 3.5);
  }

  // ---------------- HUD (DOM) ----------------
  const hpBar = document.getElementById('hp-bar');
  const hpText = document.getElementById('hp-text');
  const timerEl = document.getElementById('timer');
  const coinEl = document.getElementById('coin-text');
  const matStrip = document.getElementById('mat-strip');
  const allyView = document.getElementById('ally-view');
  const warnEl = document.getElementById('warn-banner');
  const hintEl = document.getElementById('interact-hint');
  let hudAcc = 0;

  function updateHud(dt){
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
    // 素材チップ
    let h = '';
    const mats = Skills.mats();
    for (const m in mats) {
      if (!mats[m]) continue;
      const md = DATA.MATERIALS[m];
      h += `<span class="mat-chip"><span class="mat-dot" style="background:${md.color}"></span>${mats[m]}</span>`;
    }
    matStrip.innerHTML = h;
    const waiting = R.allies.filter(a => a.waitAt).length;
    allyView.textContent = '仲間 ' + R.allies.length + '/' + st.allyCap + (waiting ? '(待機' + waiting + ')' : '');
    if (R.warnT > 0) { warnEl.textContent = R.warnMsg; warnEl.classList.remove('hidden'); }
    else warnEl.classList.add('hidden');
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
      matBonus += (mats[m] || 0) * (DATA.MATERIALS[m].tier + 1) * 2;
    }
    const total = R.coins + matBonus;
    s.coins += total;
    s.stats.runs++;
    s.stats.kills += R.kills;
    s.stats.totalCoins += total;
    s.stats.recruits += R.recruits;
    s.stats.bossKills += R.bossKills;
    s.stats.reaperKills += R.reaperKills;
    s.stats.bestTime = Math.max(s.stats.bestTime, R.time);
    s.stats.maxDist = Math.max(s.stats.maxDist, Math.round(R.maxDist));
    SaveSys.save();
    return { coins:R.coins, matBonus, total, time:R.time, kills:R.kills,
             recruits:R.recruits, retired, dist:Math.round(R.maxDist) };
  }

  return { start, update, draw, updateHud, doInteract, finishRun,
           get state(){ return R; } };
})();
