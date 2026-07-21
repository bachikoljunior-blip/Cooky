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

  // 敵数のゲーム的な上限は撤廃(近傍グリッド化・LOD・描画カリングで大群でも軽い)。
  // これはメモリ暴走を防ぐ最終保険で、通常プレイでは届かない値
  const ENEMY_BACKSTOP = 6000;

  // ---------------- プレイヤーの派生ステータス(メタ強化反映) ----------------
  function calcStats(){
    const m = SaveSys.metaLv;
    const sun = 0.02*m('g_sun_grace');   // 太陽の恩寵: 全能力
    const st = {
      maxHp: (100 + 20*m('altar_hp') + 40*m('g_black_dark') + 10*m('g_forge_gear')) * (1 + sun),
      atk: (1 + 0.08*m('altar_atk')) * (1 + 0.05*m('g_west_fire')) * (1 + 0.10*m('g_black_dark'))
           * (1 + 0.06*m('g_forge_gear')) * (1 + sun) * (1 + 0.08*m('g_end_beyond')) * (1 + 0.02*m('m_war')),
      // 初期は足が遅い。健脚・太陽の恩寵・靴スキルで広大な世界を踏破する
      speed: 42 * (1 + 0.04*m('altar_speed')) * (1 + sun) * (1 + 0.02*m('m_pioneer')),
      boatSpeed: 42 * (1 + 0.08*m('lab_sail')) * (1 + 0.05*m('m_shipwright')),   // 素の船足は徒歩と同じ。速さは帆の強化と「航路の早瀬」で得る
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
      allyCap: Infinity,   // 仲間数は無制限(近傍グリッド化で大軍でも処理が破綻しない)
      allyAtkSpd: Math.min(0.5, 0.03*m('camp_fury')),
      allyHp: (1 + 0.015*m('camp_hp')) * (1 + 0.08*m('g_green_ally')) * (1 + 0.06*m('m_bond2')),
      allyAtk: (1 + 0.012*m('camp_atk')) * (1 + 0.08*m('g_green_ally')) * (1 + 0.06*m('m_legion')),
      allyRegen: 0.012 + 0.01*m('camp_heal'),   // 仲間は放っておいても回復していく
      allySpeed: (1 + 0.05*m('camp_swift')),    // 仲間の移動速度(パワーアップ・スキルで加速)
      allyReviveChance: m('camp_revive') * 0.06,
      coinMul: (1 + 0.1*m('lab_coin')) * (1 + 0.15*m('g_white_gold')) * (1 + 0.08*m('m_invest')),
      dropMul: 6 * (0.1 + 0.02*m('lab_drop')),   // 素材ドロップ率(初期60%)。パワーアップは+2%/Lv、心得は乗算で効く
      luck2: 0.04*m('lab_luck'),
      thorns: 5*m('g_north_thorn'),
      bossDmg: (1 + 0.08*m('g_west_boss')) * (1 + 0.05*m('m_bosslore')),
      reaperRes: Math.min(0.92, 0.06*m('g_dragon_res') + 0.02*m('g_void_null') + 0.02*m('m_endbook')),
      reaperDmg: (1 + 0.15*m('g_dusk_slay') + 0.05*m('g_void_null')) * (1 + 0.04*m('m_reaplore')),
      timeMitig: Math.min(0.6, 0.03*m('g_star_time') + 0.02*m('g_end_beyond')),
      potion: 0.004*m('g_south_potion'),
      revives: m('altar_revive'),
      cheatDeath: m('altar_hp') >= 15,   // 節目Lv15: 周回ごとに一度、致死ダメージをHP1で耐える
      morale: m('camp_atk') >= 15,       // 節目Lv15: 仲間が10体以上いると仲間攻撃+10%
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
    // 主人公のステータスを上げるスキル(武器研磨・速撃・共鳴・トレハン等)は廃止。
    // 残るのは移動速度(靴)・マグネット・特殊能力・仲間強化のみ。
    const bo = Skills.stat('boots');    if (bo) s.speed *= bo.mult;
    const mg = Skills.stat('magnetSk'); if (mg) s.magnet *= mg.mult;
    const ch = Skills.stat('charisma'); if (ch) { s.recruit += ch.recruit; s.allyHp *= ch.allyMul; s.allyAtk *= ch.allyMul; }
    const va = Skills.stat('vampire');  if (va) { s.killHeal = va.killHeal; s.lifesteal = va.lifesteal; }
    // スキルごとの効果量増幅(各基地のパワーアップ)。以降のstat()読み取り全てに効く
    {
      const mv = (id) => SaveSys.metaLv(id);
      const pm = {
        sanctuary: 1 + 0.04*mv('g_south_sanct'),  fear:      1 + 0.04*mv('g_north_fear'),
        vampire:   1 + 0.04*mv('g_black_vamp'),   confuse:   1 + 0.04*mv('g_mist_confuse'),
        curse:     1 + 0.04*mv('g_grave_curse'),  sands:     1 + 0.04*mv('g_star_sands'),
        charisma:  1 + 0.04*mv('g_green_charisma'), warbanner: 1 + 0.04*mv('g_forge_banner'),
        magnetSk:  1 + 0.04*mv('g_white_magnet'), boots:     1 + 0.03*mv('g_storm_boots'),
        shield:    1 + 0.05*mv('g_west_shield'),
      };
      const kk = 1 + 0.04*mv('g_dragon_kokoroe');   // 心得はまとめて増幅
      for (const id in DATA.SKILLS) if (id.startsWith('p_') || id === 'oath') pm[id] = kk;
      Skills.setPow(pm);
    }
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
        case 'luck2Add':    s.luck2 += v; break;
        case 'dropMul':     s.dropMul *= 1 + v; break;
        case 'critAdd':     s.crit += v; break;
        case 'cdrAdd':      s.cdr = Math.min(0.65, s.cdr + v); break;
        case 'areaMul':     s.area *= 1 + v; break;
        case 'bossMul':     s.bossDmg *= 1 + v; break;
        case 'reaperMul':   s.reaperDmg *= 1 + v; break;
        case 'reaperResAdd':s.reaperRes = Math.min(0.95, s.reaperRes + v); break;
        case 'allyAtkMul':  s.allyAtk *= 1 + v; break;
        case 'allyHpMul':   s.allyHp *= 1 + v; break;
        case 'allySpeedMul': s.allySpeed = (s.allySpeed || 1) * (1 + v); break;
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
    // 保管庫: 前の周回から持ち越した素材を受け取る(研究所のパワーアップで枠が増える)
    if (SaveSys.data.stash) {
      for (const m in SaveSys.data.stash) Skills.addMat(m, SaveSys.data.stash[m]);
      SaveSys.data.stash = null; SaveSys.save();
    }
    World.resetRun();
    Quest.reset();
    // 拠点を一つでも解放済みなら、次の拠点ヒントを常に一つ表示(既存セーブ救済)
    if (Object.keys(SaveSys.data.bases).length > 0) Quest.refreshHint();
    R.time = 0;
    R.settled = null;
    R.player = { x:startPos.x, y:startPos.y, hp:1, dir:1, moveA:0,
                 onBoat:false, boatAnchor:null, invuln:0 };
    R.baseStats = calcStats();
    R.stats = R.baseStats;
    R.player.hp = R.stats.maxHp;
    R.coins = 0; R.kills = 0; R.recruits = 0; R.bossKills = 0; R.reaperKills = 0;
    R.rareKills = 0; R.matsGot = 0; R.objsDestroyed = 0; R.peakAllies = 0;
    R.usedRevives = 0; R.usedCheatDeath = false;
    R.enemies = []; R.allies = []; R.projs = []; R.eprojs = []; R.pickups = [];
    R.turrets = []; R.zones = []; R.effects = []; R.popups = [];
    R.cd = {}; R.shield = { stocks:0, timer:0 };
    R.spawnAcc = 0; R.bossDone = {}; R.reaperAcc = 0; R.hordeT = rnd(60, 90); R.hordeWaves = [];
    R.clearedCells = new Map();   // 倒した場所 cellKey -> リスポーン解禁時刻(1分間は湧かない)
    R.dmgLog = []; R.hitFlashT = 0; R.hitDir = null; R.traitBursts = [];
    R.sigCd = 0; R.sigUntil = 0; R.bioFxT = 0; R.bioFxColors = null; R.boardDone = {}; R.escort = null;
    // 周回ごとの世界イベント: 世界の様子が毎回少し違う(開始時に告知される)
    {
      // 世界イベントは基本を覚えた頃(3周回目)から現れる(要素の導入を分散)
      const roll = SaveSys.data.stats.runs < 2 ? 0 : Math.random();
      if (roll < 0.25) R.worldEvent = 'none';
      else if (roll < 0.5) {
        R.worldEvent = 'migration';
        const cand = ['wolf','boar','skeleton','goblin','orc','bat'];
        R.evSpecies = cand[Math.floor(Math.random() * cand.length)];
      }
      else if (roll < 0.75) R.worldEvent = 'variant';
      else R.worldEvent = 'calm';
      const evMsg = {
        migration: () => '🌍 今日の世界: 魔物の大移動 ― ' + DATA.ENEMIES[R.evSpecies].name + 'の群れが多い',
        variant:   () => '🌍 今日の世界: 色違いの活性 ― 色を変えた魔物が現れやすい',
        calm:      () => '🌍 今日の世界: 凪 ― 海が穏やかで、潮の流れが速い',
      }[R.worldEvent];
      // 告知枠が空くのを待ってから出す(発見の報せ等、他の大事な告知を上書きしない)
      if (evMsg) {
        const tryAnnounce = () => {
          if (R.over) return;
          if ((R.warnT || 0) > 0.3) { setTimeout(tryAnnounce, 1200); return; }
          R.warnMsg = evMsg(); R.warnColor = '#a5d8ff'; R.warnT = 5;
        };
        setTimeout(tryAnnounce, 2500);
      }
    }
    R.foeMap = new Map();         // マップ用の敵目撃情報 cellKey -> {x,y,t,boss}(離れて消えても保持)
    R.foeScanT = 0;
    R.interact = null;
    R.vacuumT = 0; R.warnT = 0; R.warnMsg = '';
    R.maxDist = Math.hypot(startPos.x, startPos.y);
    R.bossAlive = null;
    R.mapFull = false;   // 全画面の全体図を開いているか(ミニマップは常に周辺図)
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
        dmg: 14, speed: R.stats.speed,   // 主人公と同じくらいの速さ
        atkCd: 0, healCd: 0, shootCd: 0, waitAt: null, saved: false,
      });
    }
    seedInitialEnemies();   // スタート地点のまわりを目標密度まで埋める(至近には置かない)
  }

  // 開始直後にスタート地点のまわり(画面の縁〜近傍)を目標密度まで埋める。
  // 至近(主人公の真横)には置かないが、周りがスカスカにならないよう最初から分布させる。
  function seedInitialEnemies(){
    const p = R.player;
    const offR = R.offscreenR || 500;
    const ring0 = Math.min(12, World.ringOf(p.x, p.y));
    const target = Math.round(192 + ring0 * 12);   // directorの目標数と同じ(最初から通常の密度)
    let placed = 0;
    for (let i = 0; i < target * 3 && placed < target; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = rnd(115, offR + 240);   // 画面の縁〜近傍(退場圏内)に散らす。至近には置かない
      const ex = p.x + Math.cos(a) * d, ey = p.y + Math.sin(a) * d;
      const key = pickEnemyKey(); if (!key) break;
      if (!canStand(DATA.ENEMIES[key], ex, ey)) continue;
      if (spawnEnemy(key, { x: ex, y: ey })) placed++;   // madにしない(近づくまで襲わない)
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
    const armor = Math.min(0.75, (e.def.armor || 0) + (e.traitArmor || 0));
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
    if (!e.boss && !e.def.isReaper) markCleared(e.x, e.y);   // 倒した場所は1分間リスポーンしない
    R.kills++;
    if (e.boss) { R.bossKills++; if (R.bossAlive === e) R.bossAlive = null; }
    if (e.def.isReaper) R.reaperKills++;
    if (e.def.rare) R.rareKills++;
    Quest.notifyKill(e.defKey, e.rank || 0, e.markId);   // 討伐クエストの進行(色違い/指名討伐にも対応)
    const st = R.stats;
    // コイン(遠くの敵ほど多く落とす: 遠征の資金源)
    const ring = World.ringOf(e.x, e.y);
    // 武器の成長がハブ(コイン)管理になったぶん、コインは気持ち多めに落ちる。
    // ただし同じ周回で狩り続けるほど相場が下がる(無限farm対策: 1200体で半減)
    const glut = 1 / (1 + R.kills / 1200);
    const valueMul = (e.boss || e.def.isReaper) ? 0.9 : (0.55 + Math.random() * 0.25) * glut;
    const c = Math.max(1, Math.round(e.coin * st.coinMul * (1 + ring * 0.22) * valueMul));
    dropPickup(e.x, e.y, { type:'coin', value:c });
    // 素材ドロップ: その敵自身のドロップテーブルのみ。バイオドームごとの素材の違いは
    // 敵の顔ぶれ(BIOME_FAUNA)から自然に生まれる ― 場所によるドロップ率の細工はしない
    for (const dr of e.def.drops || []) {
      if (!Skills.matUnlocked(dr.m)) continue;
      if (Math.random() < dr.c * st.dropMul) {
        const n = Math.random() < st.luck2 ? 2 : 1;
        for (let i = 0; i < n; i++) dropPickup(e.x + rnd(-14,14), e.y + rnd(-14,14), { type:'mat', mat:dr.m });
      }
    }
    // ポーション
    if (Math.random() < st.potion) dropPickup(e.x, e.y, { type:'potion' });
    // 吸血の刻印: 撃破時回復
    if (st.killHeal > 0) R.player.hp = Math.min(st.maxHp, R.player.hp + st.killHeal);
    // 仲間勧誘(リーパー以外)。強い敵ほど仲間になりにくく、ボスはさらに低確率
    const tf = e.boss ? 0.12 : [1, 0.7, 0.5, 0.35, 0.25][Math.min(4, e.def.tier || 0)];
    if (!e.def.isReaper && R.allies.length < st.allyCap && Math.random() < st.recruit * tf) {
      recruitAlly(e);
    }
    effect('burst', e.x, e.y, { color:e.def.isReaper ? '#f85149' : '#ffd766', r:e.def.r + 8 });
    // 図鑑: 倒した魔物と回数を記録(ドロップの逆引きに使う)
    SaveSys.data.dex = SaveSys.data.dex || {};
    SaveSys.data.dex[e.defKey] = (SaveSys.data.dex[e.defKey] || 0) + 1;
    // 色違いの特性(死亡時): 弾ける(予兆つき爆発)/仲間を呼んで果てる
    if (e.trait === 'burst') {
      R.traitBursts = R.traitBursts || [];
      const br = (46 + 26 * e.rank) * 0.25;   // 爆発の範囲は控えめ(元の1/4)
      R.traitBursts.push({ x:e.x, y:e.y, t:0.55, r:br, dmg:e.dmg * 1.4 });
      effect('ring', e.x, e.y, { color:'#f85149', r:br });
    }
    if (e.trait === 'summon' && R.enemies.length < ENEMY_BACKSTOP) {
      for (let i = 0; i < Math.min(3, 1 + e.rank); i++)
        spawnEnemy(e.defKey, { x:e.x + rnd(-26,26), y:e.y + rnd(-26,26), rank:0, mad:true });
    }
  }

  function recruitAlly(e){
    const wb = Skills.stat('warbanner');
    const st = R.stats;
    const hpMul = st.allyHp * (wb ? wb.hp : 1);
    R.allies.push({
      def: e.def, key: e.defKey, bossName: e.bossName,
      rank: e.rank || 0, sizeMul: e.sizeMul || 1,   // 色違いと大きさは仲間になっても保つ(ボスはボスの姿のまま)
      x: e.x, y: e.y,
      // 初期値は敵だった時と同じHP・攻撃。ただし速さは主人公と同じくらいにして
      // 置いていかれないように(以降はパワーアップ/スキルの仲間強化が乗る)。
      maxHp: e.maxHp * hpMul,
      hp: e.maxHp * hpMul,
      dmg: e.dmg,
      speed: st.speed,
      atkCd: 0, healCd: 0, shootCd: 0,
      waitAt: null, saved: false, slot: undefined,
      joining: true,   // 倒した位置から主人公のところへ駆けつける
    });
    assignSlot(R.allies[R.allies.length - 1]);
    R.recruits++;
    R.peakAllies = Math.max(R.peakAllies, R.allies.length);
    Sfx.recruit();
    popup(e.x, e.y - 22, e.bossName ? '「' + e.bossName + '」が軍門に降った!' : '仲間になった!', '#7ee787');
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
    if (fe && src && src.x !== undefined && Math.hypot(src.x - p.x, src.y - p.y) < fe.radius * st.area) {
      d *= (1 - fe.reduce);
    }
    let armor = st.armor;
    if (p.hp < st.maxHp * 0.3) armor = Math.min(0.85, armor + st.wall);
    d *= (1 - armor);
    if (src && src.def && src.def.isReaper) d *= (1 - st.reaperRes);
    p.hp -= d;
    p.invuln = 0.55 + st.invulnPlus; // 被弾後は少しの間無敵(点滅)。連撃で溶けないための反応猶予
    Sfx.hurt();
    // 被弾の記録(死因リキャップ用)と、被弾方向の画面フラッシュ
    R.dmgLog = R.dmgLog || [];
    R.dmgLog.push({ t:R.time, d:Math.round(d),
      name: src ? (src.bossName || (src.def && ((src.rank > 0 ? '色違いの' : '') + src.def.name)) || '???') : '???' });
    while (R.dmgLog.length > 60) R.dmgLog.shift();
    R.hitFlashT = 0.35;
    R.hitDir = (src && src.x !== undefined) ? Math.atan2(src.y - p.y, src.x - p.x) : null;
    // 茨の鎧
    if (st.thorns > 0 && src && !src.dead && src.hp !== undefined) {
      src.hp -= st.thorns * st.atk;
      if (src.hp <= 0) killEnemy(src);
    }
    if (p.hp <= 0) {
      // 節目の護り(生命力Lv15): 周回ごとに一度だけ、致死ダメージをHP1で踏みとどまる
      if (st.cheatDeath && !R.usedCheatDeath) {
        R.usedCheatDeath = true;
        p.hp = 1; p.invuln = 1.6;
        effect('ring', p.x, p.y, { color:'#7ee787', r:120 });
        popup(p.x, p.y - 30, '死線の護り!', '#7ee787');
        return;
      }
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

  // 突撃の号令: 手動発動(CD25秒)。4秒間、武器の連射と軍勢の攻撃・足が速まる
  function warcry(){
    if (R.over) return;
    if ((R.sigCd || 0) > R.time) return;
    R.sigCd = R.time + 25;
    R.sigUntil = R.time + 4;
    effect('ring', R.player.x, R.player.y, { color:'#ffd766', r:220 });
    popup(R.player.x, R.player.y - 34, '突撃の号令!', '#ffd766');
    Sfx.skill();
    // 周囲の敵は一瞬ひるむ
    knockback(R.player.x, R.player.y, 160, 180);
  }
  function sigActive(){ return (R.sigUntil || 0) > R.time; }

  function knockback(x, y, radius, force){
    // 近傍グリッドで対象を集めてから動かす(動かしながら走査すると同じ敵を2度押しうる)
    const hits = [];
    forEachFoeNear(x, y, radius, (e) => {
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < radius && d > 1) hits.push([e, d]);
      return false;
    });
    for (const [e, d] of hits) {
      e.x += (e.x - x) / d * force * 0.12;
      e.y += (e.y - y) / d * force * 0.12;
    }
  }
  function aoeDamage(x, y, radius, dmg){
    forEachFoeNear(x, y, radius + (R.maxFoeR || 60), (e) => {
      if (Math.hypot(e.x - x, e.y - y) < radius + e.def.r) dealDamage(e, dmg);
      return false;
    });
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
        // 全画面吸引: 落ちているドロップを全て、5秒以内に手元へ引き寄せる
        for (const pk of R.pickups) { pk.vacuumed = true; pk.vacDeadline = R.time + 5; }
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
        let sp = pk.vacuumed ? 700 : 380;
        // 護符による全回収は締切(5秒以内)までに必ず届くよう、距離に応じて加速する
        if (pk.vacDeadline) sp = Math.max(sp, d / Math.max(0.15, pk.vacDeadline - R.time));
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
  // 敵の強さは「種類+色違いランク」で固定。時間・危険度で個体は強くならず、
  // 色違いのランク個体がラダー式に出る: 各段は初期から「かなり小さい割合(3%)」で存在し、
  // 時間・危険度と共に割合が育つ。前の段が育つ頃、次の段がまた小さい割合で現れる…のループ。
  // rank1=金(HP4倍) rank2=紅(16倍) rank3=紫(64倍) rank4=青白(256倍)。同じ種類+ランクなら常に同じ強さ。
  const RANK_HP = [1, 4, 16, 64, 256], RANK_DMG = [1, 1.7, 2.9, 4.9, 8.3];
  const RANK_MAX = 4;
  function escalNow(){
    const min = R.time / 60;
    const ring = World.ringOf(R.player.x, R.player.y);
    return (min / 8 + ring * 0.6) * (1 - R.stats.timeMitig) + (R.worldEvent === 'variant' ? 0.4 : 0);   // 星読みの加護で緩和/色違いの活性
  }
  function pickRank(){
    const escal = escalNow();
    let rank = 0;
    for (let k = 1; k <= RANK_MAX; k++) {
      // 段kの通過率: 初期3%、進行(escal)が段の高さを越えるごとに+22%/段、最大55%
      const p = Math.min(0.55, 0.03 + Math.max(0, escal - (k - 1)) * 0.22);
      if (Math.random() < p) rank = k; else break;
    }
    return rank;
  }
  // 大きさの段階(並/大/巨)。時間・危険度で大きい個体が増える。
  // 色(rank)と組み合わさって強さのグラデーションを作る:
  //   並r0=1 < 大r0=1.9 < 巨r0=3.4 < 並r1=4 < 大r1=7.6 < 巨r1=13.6 < 並r2=16 …(HP比)
  const SIZE_VIS = [1, 1.32, 1.65];      // 見た目の倍率
  const SIZE_HP  = [1, 1.9, 3.4];
  const SIZE_DMG = [1, 1.35, 1.8];
  const SIZE_COIN = [1, 1.4, 2];
  function pickSize(){
    const escal = escalNow();
    if (Math.random() < Math.min(0.28, 0.01 + Math.max(0, escal - 0.8) * 0.07)) return 2;   // 巨
    if (Math.random() < Math.min(0.5, 0.04 + escal * 0.11)) return 1;                        // 大
    return 0;
  }

  function spawnEnemy(defKey, opts = {}){
    const def = DATA.ENEMIES[defKey];
    const p = R.player;
    let x, y;
    if (opts.x !== undefined) { x = opts.x; y = opts.y; }
    else {
      const a = opts.ang !== undefined ? opts.ang : Math.random() * Math.PI * 2;
      const dist = opts.dist || rnd(560, 760);
      x = p.x + Math.cos(a) * dist; y = p.y + Math.sin(a) * dist;
      // 環境の合う場所へ補正(海岸沿いでは半分が海に落ちるため、多めに試行)
      for (let i = 0; i < 14; i++) {
        const land = World.isLand(x, y);
        if ((def.env === 'land' && land) || (def.env === 'sea' && !land) || def.env === 'both') break;
        const a2 = Math.random() * Math.PI * 2;
        x = p.x + Math.cos(a2) * dist; y = p.y + Math.sin(a2) * dist;
        if (i === 13) return null;
      }
      // 掃討したばかりの場所(1分以内)には環境の敵を湧かせない
      if (opts.ambient && isClearedCell(x, y)) return null;
    }
    let rank = (opts.boss || def.isReaper) ? 0 : (opts.rank !== undefined ? opts.rank : pickRank());
    // 色違いの討伐依頼中: 依頼対象として湧く個体は依頼のランク以上で出る(対象が出ない事故を防ぐ)
    if (opts.qMinRank && rank < opts.qMinRank) rank = Math.min(RANK_MAX, opts.qMinRank);
    // 大きさの段階(ボス・リーパーは対象外。ボスは元々巨躯)
    const sizeTier = (opts.boss || def.isReaper) ? 0 : (opts.sizeTier !== undefined ? opts.sizeTier : pickSize());
    const e = {
      def, defKey,
      x, y,
      maxHp: def.hp * RANK_HP[rank] * SIZE_HP[sizeTier] * (opts.hpMul || 1),
      dmg: def.dmg * RANK_DMG[rank] * SIZE_DMG[sizeTier] * (opts.dmgMul || 1),
      coin: (opts.coin || def.coin) * SIZE_COIN[sizeTier],
      boss: !!opts.boss, bossName: opts.bossName,
      hp: 0, flash: 0, slowUntil: 0, slowMul: 1, frozenUntil: 0,
      burn: 0, burnT: 0, shred: 0, contactCd: 0, shootCd: rnd(0.5, 2), healCd: 1,
      orbitHit: 0, wander: Math.random() * 7,
      // うろつき/群れ/気づき(アグロ)。hordeやbossは最初から追跡状態
      wanderDir: Math.random() * Math.PI * 2, wanderT: rnd(0.6, 2.5),
      mad: !!opts.mad || !!opts.boss, aggro: opts.aggro || rnd(75, 115),
      herd: opts.herd || null,
      fromHorde: !!opts.fromHorde,   // 時間ごとの大群: 置いていかれても近くの画面外へ回り込む
    };
    e.hp = e.maxHp;
    e.rank = rank;   // 色違いランク(見た目は色+大きさで表現)
    e.sizeTier = sizeTier;
    e.sizeMul = (opts.boss ? 2.2 : 1) * (1 + rank * 0.2) * SIZE_VIS[sizeTier];   // 色違い×大きさで見た目も段階的に
    // 色違いの特性: 種類×色×大きさの組み合わせで決まる(同じ組は常に同じ特性)。
    // 「金のウルフは疾いが、金のゴーレムは弾ける」― 出会いながら覚えられる
    if (rank > 0 && !opts.boss && !def.isReaper) {
      e.trait = variantTrait(defKey, rank, def);
      if (e.trait === 'swift') e.spdMul = 1 + Math.min(0.6, 0.12 * rank);
      if (e.trait === 'tough') e.traitArmor = Math.min(0.6, (0.10 + def.r * 0.004) * rank);
      if (e.trait === 'regen') e.traitRegen = 0.006 * rank;
    }
    if (opts.boss) R.bossAlive = e;
    R.enemies.push(e);
    return e;
  }

  // 色違いの特性テーブル: 小柄な種は機動系、大柄な種は重厚系に寄る
  const TRAITS_SMALL = ['swift','regen','summon'];
  const TRAITS_BIG   = ['tough','burst','regen'];
  function traitHash(str, rank){
    let h = rank * 131;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  function variantTrait(key, rank, def){
    const pool = def.r >= 15 ? TRAITS_BIG : TRAITS_SMALL;
    return pool[traitHash(key, rank) % pool.length];
  }

  // その時・その場所に湧く敵の種類を1体ぶん抽選する。
  // 顔ぶれは土地(バイオドーム)ごと。時間・危険度で上のティアの種類が「加わって」いき、
  // 一度出た種類が出なくなることはない(種類は増える一方)。
  // 個体の強さの変化は色違い(pickRank)と大きさ(pickSize)が担う
  function pickEnemyKey(){
    const tier = allowedTier();
    const onSea = !World.isLand(R.player.x, R.player.y);
    let keys;
    if (onSea) keys = (DATA.SEA_BIOMES[World.seaBiomeAt(R.player.x, R.player.y)] || {}).fauna || DATA.SEA_FAUNA;
    else {
      const bd = World.biodomeAt(R.player.x, R.player.y);
      keys = DATA.BIOME_FAUNA[bd.biome] || Object.keys(DATA.ENEMIES);
    }
    const okKey = k => { const d = DATA.ENEMIES[k]; return d && !d.isReaper && !d.rare &&
      (d.tier || 0) <= tier && (onSea ? d.env !== 'land' : d.env !== 'sea'); };
    // 逃げる敵(ヒーラー等)はあくまで「一部」: 生存数が上限に達していたら湧かせない
    // (逃げ回って死なずに溜まり、まわりが回復役だらけになるのを防ぐ)。
    // 数え上げは1フレームに1回だけ(スポーンのたびに全敵を走査しない)
    if (R._kiteCacheT !== R.time) {
      R._kiteCacheT = R.time;
      let kn = 0;
      for (const e of R.enemies) if (!e.dead && e.def.move === 'kite' && !e.def.rare) kn++;
      R._kiteAlive = kn;
    }
    const kiteAlive = R._kiteAlive;
    let candidates = keys.filter(okKey);
    if (kiteAlive >= 3) candidates = candidates.filter(k => DATA.ENEMIES[k].move !== 'kite');
    if (!candidates.length) candidates = Object.keys(DATA.ENEMIES).filter(okKey);   // フォールバック
    const pool = [];
    const kites = [];   // 逃げる敵(ヒーラー等 move:'kite')は別枠で希少に
    let baseW = 0;
    for (const k of candidates) {
      const d = DATA.ENEMIES[k];
      const w = 1 + (d.tier || 0) * 1.6 + ((d.tier || 0) === tier ? 2 : 0);   // 解禁されたばかりの種類が主役に。古株も出続ける
      if (d.move === 'kite') kites.push({ k, w });
      else { pool.push({ k, w }); baseW += w; }
    }
    // 逃げる敵は全体の約1/50だけ(通常敵の合計重みの1/49を分け合う)
    if (kites.length && baseW > 0) {
      let kw = 0; for (const q of kites) kw += q.w;
      for (const q of kites) pool.push({ k: q.k, w: baseW / 49 * q.w / kw });
    } else if (kites.length) for (const q of kites) pool.push(q);
    if (!pool.length) return null;
    let tw = 0; for (const q of pool) tw += q.w;
    let r = Math.random() * tw, pick = pool[0].k;
    for (const q of pool) { r -= q.w; if (r <= 0) { pick = q.k; break; } }
    if (Math.random() < 0.006) return 'rainbow';   // レアモンスター
    // 討伐クエスト中は対象が湧きやすい(全対象からランダム。土地の顔ぶれに無い敵でも必ず出る)
    const qts = Quest.wantSpawn();
    if (qts && Math.random() < 0.35) {
      const qe = qts[Math.floor(Math.random() * qts.length)];
      let cnt = 0;
      for (const e of R.enemies) if (e.defKey === qe && ++cnt >= 6) break;
      if (cnt < 6) return qe;
    }
    return pick;
  }
  // 画面の外(確実に見えない位置)を返す
  function offscreenPoint(){
    const a = Math.random() * Math.PI * 2;
    const d = (R.offscreenR || 950) + rnd(120, 520);
    return { x: R.player.x + Math.cos(a) * d, y: R.player.y + Math.sin(a) * d };
  }
  // 大群の敵を「プレイヤーのすぐ画面外」へ回り込ませる。進行方向のやや前方に寄せる。
  function relocateOffscreen(e){
    const p = R.player;
    const base = (R.offscreenR || 950) + rnd(30, 160);
    // 移動方向があればその前方寄り、なければ全方位から
    const moveA = (Math.abs(p.vx) + Math.abs(p.vy) > 1) ? Math.atan2(p.vy, p.vx) : Math.random() * Math.PI * 2;
    for (let k = 0; k < 6; k++) {
      const a = moveA + rnd(-1.4, 1.4);
      const nx = p.x + Math.cos(a) * base, ny = p.y + Math.sin(a) * base;
      if (canStand(e.def, nx, ny)) { e.x = nx; e.y = ny; e.mad = true; return true; }
    }
    return false;
  }
  // 群れ: 同種の敵が画面外の1点に固まって湧き、一緒にうろつく。
  // alerted: 1体でも気づくと群れ全体が襲ってくる(updateEnemiesで連鎖)。
  // 群れ: 同種で構成される。種はその土地の顔ぶれのうち解禁済みティアから、
  // 通常湧きと同じ重み(新しく加わった種類が主役・古株も出る)で選ぶ。
  function spawnHerd(mad){
    const top = allowedTier();
    const onSea = !World.isLand(R.player.x, R.player.y);
    const keys = (onSea ? ((DATA.SEA_BIOMES[World.seaBiomeAt(R.player.x, R.player.y)] || {}).fauna || DATA.SEA_FAUNA)
      : DATA.BIOME_FAUNA[World.biodomeAt(R.player.x, R.player.y).biome] || Object.keys(DATA.ENEMIES))
      .filter(k => { const dd = DATA.ENEMIES[k];
        return dd && !dd.isReaper && !dd.rare && dd.move !== 'kite' && (dd.tier || 0) <= top &&
               (onSea ? dd.env !== 'land' : dd.env !== 'sea'); });
    if (!keys.length) return;
    const ws = keys.map(k => { const t = DATA.ENEMIES[k].tier || 0; return 1 + t * 1.6 + (t === top ? 2 : 0); });
    let rw = Math.random() * ws.reduce((x, y) => x + y, 0);
    let pickIdx = 0;
    for (let i = 0; i < keys.length; i++) { rw -= ws[i]; if (rw <= 0) { pickIdx = i; break; } }
    const tier = DATA.ENEMIES[keys[pickIdx]].tier || 0;
    const offR = R.offscreenR || 500;
    const a = Math.random() * Math.PI * 2, hd = offR + rnd(30, 200);   // 画面外だが近く(退場圏内)
    const c = { x: R.player.x + Math.cos(a) * hd, y: R.player.y + Math.sin(a) * hd };
    const herd = { x: c.x, y: c.y, dir: Math.random() * Math.PI * 2, t: rnd(2, 5), alerted: !!mad };
    const mig = R.worldEvent === 'migration' && R.evSpecies && !onSea &&
                keys.includes(R.evSpecies);   // その土地に居る種の大移動だけ
    let n = Math.max(4, 8 - tier) + Math.floor(Math.random() * 4) + (mig ? 3 : 0);   // 低ティアほど大所帯/大移動は+3
    const herdKey = keys[pickIdx];   // 群れは同種で構成(上で抽選済み)
    for (let i = 0; i < n; i++) {
      const key = (mig && Math.random() < 0.7) ? R.evSpecies : herdKey;
      const ex = c.x + rnd(-70, 70), ey = c.y + rnd(-70, 70);
      if (!canStand(DATA.ENEMIES[key], ex, ey)) continue;
      spawnEnemy(key, { x: ex, y: ey, herd, mad });
    }
  }
  // 大群イベント: すぐ画面外の一方向から一斉に、猛スピードで押し寄せる
  function spawnHorde(){
    const base = (R.offscreenR || 950) + rnd(10, 70);   // ぎりぎり画面外(すぐ届く)
    const dir = Math.random() * Math.PI * 2;
    const n = 14 + Math.floor(Math.random() * 12);
    let placed = 0;
    for (let i = 0; i < n * 2 && placed < n; i++) {
      const a = dir + rnd(-0.9, 0.9);
      const d = base + rnd(0, 110);
      const ex = R.player.x + Math.cos(a) * d, ey = R.player.y + Math.sin(a) * d;
      const key = pickEnemyKey(); if (!key) break;
      if (!canStand(DATA.ENEMIES[key], ex, ey)) continue;
      // aggro最大で諦めない(速度は他の敵と同じ。置いていかれたら前方へ回り込む)
      if (spawnEnemy(key, { x: ex, y: ey, mad: true, aggro: 3600, fromHorde: true })) placed++;
    }
    if (placed > 0) { R.warnMsg = '⚔ 敵の大群が押し寄せてくる!'; R.warnColor = '#ff7b72'; R.warnT = 4; Sfx.horde(); }
  }
  // 大群イベント: 何波にも分けて、時間経過ほど大量に押し寄せる。
  function startHordeEvent(){
    const min = R.time / 60;
    const total = Math.round(20 * (1 + min));   // 初回~45体、時間経過(分×1)でどんどん増える
    const waves = Math.min(14, 1 + Math.floor(min / 4));   // 最初は一波のみ、時間経過で波数が増える
    const perWave = Math.ceil(total / waves);
    const dir0 = Math.random() * Math.PI * 2;              // 主に片側から
    R.hordeWaves = R.hordeWaves || [];
    for (let w = 0; w < waves; w++) {
      R.hordeWaves.push({ t: w * rnd(0.7, 1.4), count: perWave, dir: dir0 + rnd(-0.7, 0.7) });
    }
    R.warnMsg = '⚔ 敵の大群が押し寄せてくる!(' + waves + '波)'; R.warnColor = '#ff7b72'; R.warnT = 4; Sfx.horde();
  }
  // 1波ぶんを、すぐ画面外から一斉に
  function spawnHordeWave(wave){
    if (R.enemies.length >= ENEMY_BACKSTOP) return;   // 最終保険: メモリ暴走防止のみ
    // 回り込みのしきい値(offR+180)より内側に湧かせる(湧いた直後に再配置されない)
    const base = (R.offscreenR || 950) + rnd(10, 80);
    let placed = 0;
    for (let i = 0; i < wave.count * 2 && placed < wave.count; i++) {
      const a = wave.dir + rnd(-0.7, 0.7);
      const d = base + rnd(0, 80);
      const ex = R.player.x + Math.cos(a) * d, ey = R.player.y + Math.sin(a) * d;
      const key = pickEnemyKey(); if (!key) break;
      if (!canStand(DATA.ENEMIES[key], ex, ey)) continue;
      if (spawnEnemy(key, { x: ex, y: ey, mad: true, aggro: 3600, fromHorde: true })) placed++;
    }
  }

  // 倒した場所の格子(この中は1分間リスポーンしない)
  const CLR_CELL = 340;
  function clrKey(x, y){ return Math.floor(x / CLR_CELL) + ',' + Math.floor(y / CLR_CELL); }
  function markCleared(x, y){ if (R.clearedCells) R.clearedCells.set(clrKey(x, y), R.time + 60); }
  function isClearedCell(x, y){
    if (!R.clearedCells) return false;
    const t = R.clearedCells.get(clrKey(x, y));
    if (t === undefined) return false;
    if (R.time >= t) { R.clearedCells.delete(clrKey(x, y)); return false; }
    return true;
  }
  // マップ用の敵目撃情報を記録(離れて消えても、この情報だけは残してマップに出す)
  const FOE_CELL = 900;
  function stampFoe(e){
    if (!R.foeMap) return;
    const k = Math.floor(e.x / FOE_CELL) + ',' + Math.floor(e.y / FOE_CELL);
    const cur = R.foeMap.get(k);
    R.foeMap.set(k, { x: e.x, y: e.y, t: R.time, boss: !!(e.boss || (cur && cur.boss && R.time - cur.t < 8)) });
  }

  function director(dt){
    const p = R.player;
    const min = R.time / 60;
    const isReaperTime = R.time >= DATA.REAPER_AT;
    const ring0 = Math.min(12, World.ringOf(R.player.x, R.player.y));

    // マップ用の敵位置スキャン(重くならないよう間引き)。生存中の敵の格子を記録し、
    // 離れて間引かれても「最後に見た敵の分布」としてマップに残す。
    R.foeScanT = (R.foeScanT || 0) - dt;
    if (R.foeScanT <= 0) {
      R.foeScanT = 0.7;
      for (const e of R.enemies) if (!e.dead && !e.fromHorde) stampFoe(e);
      // 古い目撃情報(90秒より前)は捨てる
      if (R.foeMap) for (const [k, v] of R.foeMap) if (R.time - v.t > 90) R.foeMap.delete(k);
    }

    // --- 環境人口: 画面のまわりに常に一定数の敵をうろつかせる(どこへ行っても同じ分布) ---
    // 画面内には湧かないが、近く(画面まわり)の数を目標値に保つよう画面外から補充する。
    const offR = R.offscreenR || 500;
    const nearR = offR + 260;   // 画面まわり〜退場距離。この範囲の敵数を目標値に保つ
    let nearTarget = Math.round((192 + min * 12 + ring0 * 12) * (isReaperTime ? 0.4 : 1));
    // 直前に通って倒した場所は1分間リスポーンしない ― 周辺の「掃討済み」格子の割合ぶん目標数を下げる
    if (R.clearedCells && R.clearedCells.size) {
      let tot = 0, clr = 0;
      const c0x = Math.floor((p.x - nearR) / CLR_CELL), c1x = Math.floor((p.x + nearR) / CLR_CELL);
      const c0y = Math.floor((p.y - nearR) / CLR_CELL), c1y = Math.floor((p.y + nearR) / CLR_CELL);
      for (let cx = c0x; cx <= c1x; cx++) for (let cy = c0y; cy <= c1y; cy++) {
        tot++;
        const t = R.clearedCells.get(cx + ',' + cy);
        if (t !== undefined && R.time < t) clr++;
      }
      if (tot > 0) nearTarget = Math.round(nearTarget * (1 - clr / tot));
    }
    const calmMul = (R.worldEvent === 'calm' && !World.isLand(p.x, p.y)) ? 0.65 : 1;
    // 移動中は前方の分が間引かれていくぶん補充を速める(移動しても敵密度が薄くならない)
    const pSpd = Math.hypot(p.vx || 0, p.vy || 0);
    const moveBoost = 1 + Math.min(2.2, pSpd / 60);
    R.spawnAcc += dt * (12 + min * 0.7 + ring0 * 0.5) * (isReaperTime ? 0.5 : 1) * calmMul * moveBoost;
    const questTgts = Quest.wantSpawn() || [];   // 討伐依頼中の対象は向かってくる(達成しやすく)
    let nearN = 0;
    {
      const nearR2 = nearR * nearR;
      for (const e of R.enemies) {
        if (e.dead || e.fromHorde) continue;
        const dx = e.x - p.x, dy = e.y - p.y;
        if (dx * dx + dy * dy < nearR2) nearN++;
      }
    }
    const moveA = pSpd > 20 ? Math.atan2(p.vy, p.vx) : null;
    while (R.spawnAcc >= 1) {
      R.spawnAcc -= 1;
      if (nearN >= nearTarget || R.enemies.length >= ENEMY_BACKSTOP) break;
      if (Math.random() < (R.worldEvent === 'migration' ? 0.22 : 0.12)) { spawnHerd(false); nearN += 5; }   // 時々、群れ
      // 画面外だが範囲内(offR〜offR+240)に湧かせる ― すぐ数が数えられ、画面へ寄ってくる
      // 移動中は進行方向の前方に多めに湧かせる(置いていった敵の分を前で補う)
      else {
        const k = pickEnemyKey();
        const ang = (moveA !== null && Math.random() < 0.7) ? moveA + rnd(-1.3, 1.3) : undefined;
        if (k && spawnEnemy(k, { mad: questTgts.includes(k), qMinRank: Quest.wantRank ? Quest.wantRank(k) : 0,
                                 dist: offR + rnd(15, 240), ang, ambient: true })) nearN++;
      }
    }
    if (R.spawnAcc > 12) R.spawnAcc = 12;

    // --- ティアごとの群れ: 密度と関係なく定期的に必ず出会う(その土地のティアで構成) ---
    if (R.herdT === undefined) R.herdT = rnd(14, 22);
    R.herdT -= dt;
    if (R.herdT <= 0 && !isReaperTime && R.enemies.length < ENEMY_BACKSTOP) {
      spawnHerd(false);
      R.herdT = rnd(20, 34) * (R.worldEvent === 'migration' ? 0.6 : 1);
    }

    // --- 時間ごとの大群(何波にも分けて押し寄せる) ---
    if (R.hordeT === undefined) R.hordeT = rnd(60, 90);
    if (!isReaperTime) {
      R.hordeT -= dt;
      if (R.hordeT <= 0) { startHordeEvent(); R.hordeT = rnd(75, 120); }
    }
    // 予約された波を順次発生
    if (R.hordeWaves && R.hordeWaves.length) {
      for (let i = R.hordeWaves.length - 1; i >= 0; i--) {
        R.hordeWaves[i].t -= dt;
        if (R.hordeWaves[i].t <= 0) { spawnHordeWave(R.hordeWaves[i]); R.hordeWaves.splice(i, 1); }
      }
    }
    // ボス
    for (const b of DATA.BOSSES) {
      if (min >= b.at && !R.bossDone[b.at]) {
        R.bossDone[b.at] = true;
        // ボスは告知なしで現れる(名前は頭上に出る。BGMも変えない)
        const e = spawnEnemy(b.base, { boss:true, bossName:b.name, hpMul:b.hpMul, dmgMul:b.dmgMul, coin:b.coin, dist:620 });
        if (e) { e.def = Object.assign({}, e.def, { sprite: b.sprite }); }
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
        spawnEnemy('reaper', { dist: rnd(500, 700) });
      }
    }
  }

  // ---------------- 敵の近傍グリッド(弾の当たり判定・仲間の索敵を近傍だけにする) ----------------
  // キーは整数(上位16bit=cx / 下位16bit=cy)。文字列連結よりMapアクセスがずっと速い
  const HIT_CELL = 96;
  const gkey = (cx, cy) => (cx << 16) | (cy & 0xffff);
  let hitGrid = new Map();
  function rebuildFoeGrid(){
    hitGrid.clear();
    let mr = 20;   // 生存中の敵の最大半径(範囲クエリの余白に使う)
    for (const e of R.enemies) {
      if (e.dead) continue;
      const k = gkey((e.x / HIT_CELL) | 0, (e.y / HIT_CELL) | 0);
      const arr = hitGrid.get(k);
      if (arr) arr.push(e); else hitGrid.set(k, [e]);
      const r = e.def.r * (e.sizeMul || 1);
      if (r > mr) mr = r;
    }
    R.maxFoeR = mr;
  }
  function forEachFoeNear(x, y, rad, cb){
    const c0x = ((x - rad) / HIT_CELL) | 0, c1x = ((x + rad) / HIT_CELL) | 0;
    const c0y = ((y - rad) / HIT_CELL) | 0, c1y = ((y + rad) / HIT_CELL) | 0;
    for (let cx = c0x; cx <= c1x; cx++) for (let cy = c0y; cy <= c1y; cy++) {
      const arr = hitGrid.get(gkey(cx, cy));
      if (arr) for (const e of arr) { if (!e.dead && cb(e)) return; }
    }
  }
  // 仲間の近傍グリッド: 敵→仲間の接触・索敵・アグロを「全仲間ループ」でなく近傍だけにする。
  // 仲間は陣形で密集するのでセルは小さめ。待機中(waitAt)の仲間も入れる(接触対象のため)
  const ALLY_CELL = 48;
  let allyGrid = new Map();
  function rebuildAllyGrid(){
    allyGrid.clear();
    let mr = 12;
    for (const a of R.allies) {
      if (a.dead) continue;
      const k = gkey((a.x / ALLY_CELL) | 0, (a.y / ALLY_CELL) | 0);
      const arr = allyGrid.get(k);
      if (arr) arr.push(a); else allyGrid.set(k, [a]);
      const r = a.def.r * (a.sizeMul || 1);
      if (r > mr) mr = r;
    }
    R.maxAllyR = mr;
  }
  function forEachAllyNear(x, y, rad, cb){
    const c0x = ((x - rad) / ALLY_CELL) | 0, c1x = ((x + rad) / ALLY_CELL) | 0;
    const c0y = ((y - rad) / ALLY_CELL) | 0, c1y = ((y + rad) / ALLY_CELL) | 0;
    for (let cx = c0x; cx <= c1x; cx++) for (let cy = c0y; cy <= c1y; cy++) {
      const arr = allyGrid.get(gkey(cx, cy));
      if (arr) for (const a of arr) { if (!a.dead && cb(a)) return; }
    }
  }

  // ---------------- 敵の更新 ----------------
  // 陸海判定のキャッシュ: 地形は静的なので40px格子で結果を貯める。
  // 敵・仲間の移動判定は毎フレーム数百回呼ばれるが、海岸線の距離計算は格子ごとに1回で済む
  const landCache = new Map();
  function isLandCached(x, y){
    const k = ((x / 40) | 0) + ',' + ((y / 40) | 0);
    let v = landCache.get(k);
    if (v === undefined) {
      if (landCache.size > 30000) landCache.clear();
      v = World.isLand(x, y);
      landCache.set(k, v);
    }
    return v;
  }
  function canStand(def, x, y){
    if (def.env === 'both') return true;
    const land = isLandCached(x, y);
    return def.env === 'land' ? land : !land;
  }

  function updateEnemies(dt){
    const p = R.player;
    const baseDt = dt;
    R.lodTick = (R.lodTick || 0) + 1;
    const lodR = (R.offscreenR || 500) + 160;   // 画面の外にいる敵は判定を粗くする
    rebuildAllyGrid();   // 敵→仲間の判定を近傍だけにする(大軍でも軽い)
    const maxAllyR = R.maxAllyR || 12;
    // オーラ系スキルは1フレームに1回だけ読む(敵ごとに読むとオブジェクト生成が敵数ぶん走る)
    const sanct = Skills.stat('sanctuary');
    const fa = Skills.stat('frostaura');
    const fe = Skills.stat('fear');
    for (let i = R.enemies.length - 1; i >= 0; i--) {
      const e = R.enemies[i];
      if (e.dead) { R.enemies.splice(i, 1); continue; }
      // 遠く離れた敵は退場(追跡中の敵は粘る)。環境の敵はプレイヤーの近く(画面まわり)に
      // 保つため退場距離を短く ― どこへ行っても同じくらいの分布にする。
      const pdx = e.x - p.x, pdy = e.y - p.y;
      const pd = Math.sqrt(pdx * pdx + pdy * pdy);
      // 粗い更新の対象: 画面外の敵、および画面内でも「まだ気づいておらず(非mad)、
      // 追撃圏から十分離れている」敵。さらに大きく離れた敵は4フレームに1回だけ更新する。
      // 飛ばした時間は次回まとめて進めるので、動きの速さ・タイマーは変わらない ― 判定だけ粗くなる
      let stride = 1;
      if (!e.boss) {
        if (pd > 1600) stride = 4;
        else if (pd > lodR || (!e.mad && pd > 240)) stride = 2;
      }
      if (stride > 1 && ((i + R.lodTick) % stride) !== 0) { e._lodDt = (e._lodDt || 0) + baseDt; continue; }
      dt = baseDt + (e._lodDt || 0); e._lodDt = 0;
      // 大群とボスは消えず、完全に画面外へ出た(見えなくなった)瞬間に前方へ回り込む。
      // しきい値は回り込み先(offR+30〜160)より外なので、回り込み直後に再発動しない
      if ((e.fromHorde || e.boss) && pd > (R.offscreenR || 500) + 180) {
        if (relocateOffscreen(e)) continue;
      }
      const despawnR = e.mad ? 3200 : ((R.offscreenR || 500) + 260);
      if (!e.boss && !e.def.isReaper && pd > despawnR) {
        if (e.fromHorde && relocateOffscreen(e)) continue;   // 回り込み先が見つからなくても粘る
        if (!e.fromHorde) stampFoe(e);   // 間引く前に最後の位置をマップ情報として残す
        R.enemies.splice(i, 1); continue;
      }
      e.flash = Math.max(0, e.flash - dt);
      e.contactCd = Math.max(0, e.contactCd - dt);
      // 燃焼・時間系
      if (e.burn > 0) { e.burnT -= dt; e.hp -= e.burn * dt * R.stats.atk; if (e.burnT <= 0) e.burn = 0;
        if (e.hp <= 0) { killEnemy(e); continue; } }
      let spd = e.def.speed * (e.fromHorde ? 1.4 : 1) * (e.spdMul || 1);   // 大群は少し速い/疾風の色違いも速い
      if (R.time < e.slowUntil) spd *= (1 - e.slowMul);
      if (R.time < e.frozenUntil) spd = 0;
      // 時の砂
      if (R.sandsUntil && R.time < R.sandsUntil && pd < R.sandsRadius) spd *= (1 - R.sandsSlow);
      // サンクチュアリ減速
      if (sanct && sanct.slow && pd < sanct.radius * R.stats.area) spd *= (1 - sanct.slow);
      // 霜のオーラ: 範囲内の敵を絶えず減速
      if (fa && pd < fa.radius * R.stats.area) spd *= (1 - fa.slow);

      // 行動
      let tx = p.x, ty = p.y;
      let vx = 0, vy = 0;
      const confused = R.time < (e.confusedUntil || 0);
      if (confused) {
        // 混沌の瘴気: 近く(320px)の別の敵を攻撃する。見つからなければ徘徊
        // (全敵から最寄りを探すのはやめた ― 敵が密集する混乱時は結果は同じで、ずっと軽い)
        let tgt = null, td = 1e9;
        forEachFoeNear(e.x, e.y, 320, (o) => {
          if (o === e) return false;
          const d = Math.hypot(o.x - e.x, o.y - e.y);
          if (d < td) { tgt = o; td = d; }
          return false;
        });
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
                 e.hp < e.maxHp * 0.25 && pd < fe.radius * R.stats.area * 1.5) {
        // 威圧のオーラ: 瀕死の敵が逃げ出す
        vx = (e.x - p.x) / (pd || 1); vy = (e.y - p.y) / (pd || 1);
      } else {
        // 気づき(アグロ): 近づくと追ってくる。一度気づけば追い続け、離れすぎると諦める
        if (pd < e.aggro) e.mad = true;
        else if (e.mad && pd > e.aggro + 520) e.mad = false;
        if (!e.mad) forEachAllyNear(e.x, e.y, e.aggro, (a) => {   // 仲間が至近にいれば気づく
          if (!a.waitAt && Math.hypot(a.x - e.x, a.y - e.y) < e.aggro) { e.mad = true; return true; }
          return false;
        });
        // 群れの連鎖: 1体が気づいたら群れ全体が襲ってくる
        if (e.herd) { if (e.mad) e.herd.alerted = true; else if (e.herd.alerted) e.mad = true; }
        if (!e.mad) {
          // うろつき: ゆっくり徘徊。群れは共有アンカーの周りに留まって一緒に移動する
          if (e.herd && e.herd.lastT !== R.time) {
            e.herd.lastT = R.time;
            e.herd.t -= dt;
            if (e.herd.t <= 0) { e.herd.dir = Math.random() * Math.PI * 2; e.herd.t = rnd(2, 5); }
            e.herd.x += Math.cos(e.herd.dir) * 12 * dt;
            e.herd.y += Math.sin(e.herd.dir) * 12 * dt;
          }
          if (e.wanderT === undefined) { e.wanderDir = Math.random() * Math.PI * 2; e.wanderT = rnd(1.2, 3.5); }
          e.wanderT -= dt;
          if (e.wanderT <= 0) { e.wanderDir = Math.random() * Math.PI * 2; e.wanderT = rnd(1.2, 3.5); }
          let wx = Math.cos(e.wanderDir), wy = Math.sin(e.wanderDir);
          if (e.herd) {
            const hx = e.herd.x - e.x, hy = e.herd.y - e.y, hd = Math.hypot(hx, hy);
            if (hd > 90) { wx += hx / hd * 1.6; wy += hy / hd * 1.6; }   // 群れの中心へ緩く戻る
          }
          const wl = Math.hypot(wx, wy) || 1;
          vx = wx / wl; vy = wy / wl; spd *= 0.4;
        } else if (e.def.move === 'kite') {
          // ヒーラー: 距離を保って逃げる + 回復
          const keep = 230;
          if (pd < keep) { vx = (e.x - p.x) / (pd||1); vy = (e.y - p.y) / (pd||1); }
          else if (pd > keep + 140) { vx = (p.x - e.x) / (pd||1); vy = (p.y - e.y) / (pd||1); spd *= 0.6; }
          else { e.wander += dt; vx = Math.cos(e.wander); vy = Math.sin(e.wander); spd *= 0.5; }
          e.healCd -= dt;
          if (e.healCd <= 0 && e.def.heal) {
            e.healCd = 1;
            forEachFoeNear(e.x, e.y, e.def.heal.radius, (o) => {
              if (o !== e && o.hp < o.maxHp && Math.hypot(o.x-e.x, o.y-e.y) < e.def.heal.radius) {
                o.hp = Math.min(o.maxHp, o.hp + e.def.heal.hps * RANK_HP[e.rank || 0]);
                effect('healline', e.x, e.y, { x2:o.x, y2:o.y });
              }
              return false;
            });
          }
        } else {
          // 追跡: 仲間が近ければそちらを狙うこともある(狙い直しは0.15秒ごと=負荷を抑える)。
          // 探索は近傍グリッドで、半径は最大280px ― それより遠い仲間狙いは主人公狙いと
          // 進行方向がほぼ同じなので省いても行動は変わらない(大軍でも軽い)
          e._alT = (e._alT === undefined ? Math.random() * 0.15 : e._alT) - dt;
          if (e._alT <= 0) {
            e._alT = 0.15;
            e._aTgt = null;
            let bd = pd;
            const sr = Math.min(pd * 0.7, 280);
            if (sr > 0) forEachAllyNear(e.x, e.y, sr, (a) => {
              if (a.waitAt) return false;
              const d = Math.hypot(a.x - e.x, a.y - e.y);
              if (d < bd * 0.7) { e._aTgt = a; bd = d; }
              return false;
            });
          }
          const tgt = (e._aTgt && !e._aTgt.dead && !e._aTgt.waitAt) ? e._aTgt : null;
          if (tgt) { tx = tgt.x; ty = tgt.y; }
          const d = Math.hypot(tx - e.x, ty - e.y) || 1;
          vx = (tx - e.x) / d; vy = (ty - e.y) / d;
          // 射撃タイプは距離を取る
          if (e.def.ranged && d < e.def.ranged.range * 0.6) { vx = -vx * 0.5; vy = -vy * 0.5; }
        }
      }
      const nx = e.x + vx * spd * dt, ny = e.y + vy * spd * dt;
      if (canStand(e.def, nx, ny)) { e.x = nx; e.y = ny; }
      else if (canStand(e.def, nx, e.y)) { e.x = nx; }
      else if (canStand(e.def, e.x, ny)) { e.y = ny; }

      // 体の大きさ(ゴーレム・ボス等はsizeMulで大きい)を考慮した接触半径
      const er = e.def.r * (e.sizeMul || 1);
      // 接触ダメージ(プレイヤー) ※混乱中は敵を狙うので当たらない
      if (!confused && pd < er + 16 && e.contactCd <= 0) {
        e.contactCd = 0.6;
        damagePlayer(e.dmg, e);
      }
      // 接触ダメージ(仲間)。合流中は無敵なので狙わない
      if (!confused && e.contactCd <= 0) forEachAllyNear(e.x, e.y, er + maxAllyR + 4, (a) => {
        if (a.joining) return false;
        if (Math.hypot(a.x - e.x, a.y - e.y) < er + a.def.r + 4) {
          e.contactCd = 0.6;
          damageAlly(a, e.dmg * 0.35, e);  // 仲間への接触ダメージはかなり控えめ
          return true;
        }
        return false;
      });
      // 範囲攻撃(スラム): 大型エリートが「攻撃対象の足元」へ振り下ろす。
      // 潰れる範囲は敵の体より小さい(slam.radiusは「届く距離」として使う)
      if (e.def.slam && !confused && e.mad) {
        if (e.slamCd === undefined) e.slamCd = rnd(1, 2);
        e.slamCd -= dt;
        if (e.slamCd <= 0) {
          const reach = e.def.slam.radius * (e.sizeMul || 1);   // 腕の届く距離
          const rad = e.def.r * (e.sizeMul || 1) * 0.85;        // 潰れる範囲(体より小さい)
          // 攻撃対象: 届く範囲で一番近い相手(主人公か仲間)。近傍グリッドで探す
          let tgt = null, td2 = reach + 14;
          if (pd < td2) { tgt = p; td2 = pd; }
          forEachAllyNear(e.x, e.y, reach + 14, (a) => {
            if (a.waitAt || a.joining) return false;
            const d2 = Math.hypot(a.x - e.x, a.y - e.y);
            if (d2 < td2) { tgt = a; td2 = d2; }
            return false;
          });
          if (tgt) {   // 対象の足元に振り下ろす
            e.slamCd = e.def.slam.cd;
            effect('ring', tgt.x, tgt.y, { color:'#ffa657', r: rad });
            if (Math.hypot(p.x - tgt.x, p.y - tgt.y) < rad + 10) damagePlayer(e.dmg, e);
            forEachAllyNear(tgt.x, tgt.y, rad + maxAllyR, (a) => {
              if (!a.waitAt && !a.joining && Math.hypot(a.x - tgt.x, a.y - tgt.y) < rad + a.def.r) damageAlly(a, e.dmg * 0.35, e);
              return false;
            });
          } else e.slamCd = 0.3;
        }
      }
      // 射撃(気づいている敵のみ)
      if (e.def.ranged && !confused && e.mad) {
        e.shootCd -= dt;
        if (e.shootCd <= 0 && pd < e.def.ranged.range) {
          e.shootCd = e.def.ranged.cd;
          const d = pd || 1;
          let pdmg = e.dmg;
          if (fe && pd < fe.radius * R.stats.area) pdmg *= (1 - fe.reduce); // 威圧: 射撃も弱体化
          R.eprojs.push({ x:e.x, y:e.y, vx:(p.x-e.x)/d*e.def.ranged.pspeed, vy:(p.y-e.y)/d*e.def.ranged.pspeed,
                          dmg:pdmg, life:3, r:5 });
        }
      }
    }
    dt = baseDt;   // 敵ループ内のLODで書き換えたdtを戻す(以降は等倍)
    // 敵弾: 仲間の壁で必ず止まる(貫通しない)。仲間を先に判定 → その後プレイヤー
    for (let i = R.eprojs.length - 1; i >= 0; i--) {
      const b = R.eprojs[i];
      const px0 = b.x, py0 = b.y;
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0) { R.eprojs.splice(i, 1); continue; }
      // 仲間の壁: この1フレームの弾道が仲間に触れたら消滅(高速でもすり抜けない)。
      // 弾道の中点まわりの近傍グリッドだけ見る(仲間が何百体いても弾のコストは一定)
      let blocked = false;
      const segR = Math.hypot(b.x - px0, b.y - py0) / 2 + (R.maxAllyR || 12) + 6;
      forEachAllyNear((px0 + b.x) / 2, (py0 + b.y) / 2, segR, (a) => {
        if (a.waitAt || a.joining) return false;   // 合流中はすり抜ける(無敵・壁にならない)
        if (segCircleHit(px0, py0, b.x, b.y, a.x, a.y, a.def.r * (a.sizeMul || 1) + 5)) {
          damageAlly(a, b.dmg * 0.35, b);   // 仲間への弾ダメージは控えめ
          blocked = true; return true;
        }
        return false;
      });
      if (blocked) { R.eprojs.splice(i, 1); continue; }
      if (segCircleHit(px0, py0, b.x, b.y, p.x, p.y, 16)) { damagePlayer(b.dmg); R.eprojs.splice(i, 1); }
    }
  }

  // ---------------- 仲間の更新 ----------------
  function damageAlly(a, dmg, src){
    if (a.joining) return;   // 合流中(勧誘直後、主人公の元へ駆けつけるまで)は無敵
    const ds = Skills.stat('dragonscale');
    if (ds) dmg *= (1 - ds.res);   // 竜鱗の陣: 仲間の被ダメ軽減
    // 威圧のオーラ: プレイヤーの近くなら仲間への攻撃も弱体化
    const fe = Skills.stat('fear');
    if (fe && src && Math.hypot(src.x - R.player.x, src.y - R.player.y) < fe.radius * R.stats.area) {
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

  // 同心円スロット: 密集陣形(従来の2倍の密度)。定員はリングごとに増える。
  // スロット位置は不変なのでインデックスごとにメモ化(大軍では毎フレーム数千回呼ばれる)
  const slotCache = [];
  function slotPos(i){
    const c = slotCache[i];
    if (c) return c;
    let ring = 0, cap = 7, start = 0;
    while (i >= start + cap) { start += cap; ring++; cap = 7 + ring * 5; }
    const idx = i - start;
    const ang = idx / cap * Math.PI * 2 + ring * 0.5;
    // 当たり判定が体の1/3なので、この間隔でも中心は重ならない(密集感は保ちつつ少し緩め)
    const rad = 20 + ring * 17;
    return (slotCache[i] = { x: Math.cos(ang) * rad, y: Math.sin(ang) * rad, rad });
  }
  function formationRadius(n){
    return n <= 0 ? 0 : slotPos(n - 1).rad;
  }

  // スロット割当: 既存の仲間の配置は動かさない(陣形が回転しない)。
  // 新入りは一番外の空きスロットに入り、内側の自分より弱い仲間とだけ場所を交換する
  // (動くのは新入りと交換相手の2体だけ)
  function allyStrength(a){ return (a.def.tier || 0) * 1e6 + a.maxHp; }
  function assignSlot(a){
    let maxSlot = -1;
    for (const o of R.allies) if (o !== a && o.slot !== undefined) maxSlot = Math.max(maxSlot, o.slot);
    a.slot = maxSlot + 1;
    // 自分より弱い仲間のうち最も内側の1体とだけ場所を交換(連鎖させない=陣形が回転しない)
    let inner = null;
    for (const o of R.allies) {
      if (o === a || o.slot === undefined || o.slot >= a.slot) continue;
      if (allyStrength(o) < allyStrength(a) && (!inner || o.slot < inner.slot)) inner = o;
    }
    if (inner) { const t = a.slot; a.slot = inner.slot; inner.slot = t; }
  }
  // 仲間が倒れた時: 空いたスロットに一番外の仲間だけを移す(全体は動かない)
  function freeSlot(s){
    if (s === undefined) return;
    let outer = null;
    for (const o of R.allies) if (o.slot !== undefined && (!outer || o.slot > outer.slot)) outer = o;
    if (outer && outer.slot > s) outer.slot = s;
  }

  function updateAllies(dt){
    const p = R.player;
    const wb = Skills.stat('warbanner');
    const atkMul = R.stats.allyAtk * (wb ? wb.atk : 1) * (R.stats.morale && R.allies.length >= 10 ? 1.1 : 1);   // 士気(節目)
    const spdMul = (wb ? wb.spd : 1) * (R.stats.allySpeed || 1) *
      ((R.speedBurst && R.time < R.speedBurst.until) ? R.speedBurst.mult : 1);   // 月光の疾走
    const n = R.allies.length;
    const formR = formationRadius(n);   // 陣形半径は全員共通(ループ外で1回だけ)
    for (let i = R.allies.length - 1; i >= 0; i--) {
      const a = R.allies[i];
      if (a.dead) { const s = a.slot; R.allies.splice(i, 1); freeSlot(s); continue; }
      if (a.slot === undefined) assignSlot(a);   // 開始時の軍勢・合流など
      a.inForm = false;   // このフレームで陣形整列中かどうか(振動防止の分離除外に使う)
      if (a.atkAnim > 0) a.atkAnim = Math.max(0, a.atkAnim - dt);   // 攻撃モーションの減衰
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
      // 勧誘直後: 倒した位置から主人公のところへ駆けつける(陣形に入るまではリーシュ免除)
      if (a.joining) {
        const sp2 = slotPos(a.slot !== undefined ? a.slot : i);
        const dx = p.x + sp2.x - a.x, dy = p.y + sp2.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const jspd = a.speed * spdMul * 2;   // 合流中は2倍速で駆けつける(無敵・非戦闘の間だけ)
        const step = Math.min(d, jspd * dt);
        a.x += dx / d * step; a.y += dy / d * step;
        if (Math.hypot(a.x - p.x, a.y - p.y) < formR + 20) a.joining = false;
        continue;
      }
      // ターゲット探索。近接: 「その仲間に近づいた敵」を追尾(縁距離)。
      // 弓兵: 襲ってきている敵(mad)だけを、敵の射撃と同じ基準(中心距離<射程)で狙う。
      // うろついているだけの画面外の敵を狙って「何もない方へ撃つ」ことはない。
      // 全走査は0.12秒ごと(大軍でも軽い)。手持ちの標的は毎フレーム距離だけ検算する
      let tgt = null, td = 1e9;
      const c0 = a._tgt;
      if (c0 && !c0.dead && (!a.def.ranged || c0.mad)) {
        if (a.def.ranged) {
          const d = Math.hypot(c0.x - a.x, c0.y - a.y);
          if (d < a.def.ranged.range) { tgt = c0; td = d; }
        } else {
          const d = Math.hypot(c0.x - a.x, c0.y - a.y) - c0.def.r * (c0.sizeMul || 1);
          if (d <= a.def.r + 24 + (a.def.tier || 0) * 4) { tgt = c0; td = d; }
        }
      }
      a._retgtT = (a._retgtT === undefined ? Math.random() * 0.12 : a._retgtT) - dt;
      if (a._retgtT <= 0 || !tgt) {
        a._retgtT = 0.12;
        tgt = null; td = 1e9;
        if (a.def.ranged) {
          forEachFoeNear(a.x, a.y, a.def.ranged.range + 40, (e) => {
            if (!e.mad) return false;
            const d = Math.hypot(e.x - a.x, e.y - a.y);
            if (d < a.def.ranged.range && d < td) { tgt = e; td = d; }
            return false;
          });
        } else {
          const engageR = a.def.r + 24 + (a.def.tier || 0) * 4;   // 追尾範囲は狭め(すぐそばの敵だけ)
          forEachFoeNear(a.x, a.y, engageR + 90, (e) => {
            const er = e.def.r * (e.sizeMul || 1);
            const d = Math.hypot(e.x - a.x, e.y - a.y) - er;   // 仲間から敵の縁までの距離
            if (d <= engageR && d < td) { tgt = e; td = d; }
            return false;
          });
        }
        a._tgt = tgt;
      }
      // 主人公が敵と反対方向へ動いた瞬間、戦闘をやめて即座についてくる。
      // ただし射撃タイプ(弓など)は逃げながらでも撃ち続ける。
      if (tgt && !a.def.ranged) {
        const ax2 = R.botAxis || Input.axis();
        if (ax2.x || ax2.y) {
          const dx = tgt.x - p.x, dy = tgt.y - p.y;
          const dl = Math.hypot(dx, dy) || 1;
          const al = Math.hypot(ax2.x, ax2.y) || 1;
          if ((dx * ax2.x + dy * ax2.y) / (dl * al) < -0.15) tgt = null;
        }
      }
      let dest, spd = a.speed * spdMul * (sigActive() ? 1.3 : 1) * (R.rampMul || 1);   // 突撃の号令/歩きの加速: 足も速まる
      if (tgt && a.def.ranged) {
        // 弓兵は敵を追いかけず、陣形へ戻りながら(移動しながら)撃つ。destは決めない=陣形追従
        a.shootCd -= dt;
        if (a.shootCd <= 0) {
          a.shootCd = a.def.ranged.cd * (1 - R.stats.allyAtkSpd);
          const d = td || 1;
          R.projs.push({ x:a.x, y:a.y, vx:(tgt.x-a.x)/d*a.def.ranged.pspeed*1.2, vy:(tgt.y-a.y)/d*a.def.ranged.pspeed*1.2,
                         dmg: a.dmg * atkMul / R.stats.atk, life:2.5, size:5, pierce:0, ally:true });
          a.atkAnim = 0.2; a.atkDir = Math.atan2(tgt.y - a.y, tgt.x - a.x); a.atkBack = true;   // 射撃の反動
        }
      } else if (tgt) {
        dest = tgt;
        // 接触攻撃(tdは敵の体の縁までの距離)。間合いは敵の接触攻撃(+4)と同じ
        a.atkCd -= dt;
        if (td < a.def.r * (a.sizeMul || 1) + 4) {
          if (a.atkCd <= 0) {
            a.atkCd = 0.7 * (1 - R.stats.allyAtkSpd) * (sigActive() ? 0.55 : 1);   // 鬨の声/突撃の号令
            dealDamage(tgt, a.dmg * atkMul * (sigActive() ? 1.3 : 1) / R.stats.atk); // dealDamage内でatk倍されるため相殺
            const ff = Skills.stat('forgefire');   // 鍛冶の心火: 確率で炎上
            if (ff && Math.random() < ff.chance) { tgt.burn = Math.max(tgt.burn, ff.burn); tgt.burnT = 3; }
            a.atkAnim = 0.24; a.atkDir = Math.atan2(tgt.y - a.y, tgt.x - a.x); a.atkBack = false;   // 斬りかかるモーション
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
      }
      if (dest === undefined) {
        // 同心円陣形: 主人公の周りに定位置。主人公が動けば陣形もついていく
        // (弓兵は敵がいてもここに来る=陣形へ戻りながら撃つ)
        const sp2 = slotPos(a.slot !== undefined ? a.slot : i);
        dest = { x: p.x + sp2.x, y: p.y + sp2.y };
        const d = Math.hypot(dest.x - a.x, dest.y - a.y);
        if (d < 3) { dest = null; a.x = p.x + sp2.x; a.y = p.y + sp2.y; }   // 定位置にスナップ(揺れ防止)
        // 陣形追従もステータス速度どおり(早送りしない)。遅い仲間は自然に後ろへ流れる
        a.inForm = true;
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
      // ハードリーシュ(安全網): 主人公から離れられる範囲。広め(戻ってくるまでの距離が長い)。
      {
        const maxD = formR + 150;
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
    // 体の当たり判定は見た目の1/3 ― 密集して互いにめり込めるが、中心は重ならない
    const units = [];
    for (const e of R.enemies) if (!e.dead) {
      e._r = e.def.r * (e.sizeMul || 1) * 0.75;   // 敵は体の3/4で押し合う(あまり重ならない)
      e._m = 1 + (e.def.tier || 0) * 0.6 + (e.boss ? 8 : 0) + (e.def.isReaper ? 2 : 0);
      units.push(e);
    }
    let asi = 0;
    for (const a of R.allies) if (!a.waitAt && !a.dead && !a.joining) {   // 合流中はすり抜け
      a._si = asi++;
      // 一番小さい仲間は従来どおりの密集度。体の大きい仲間ほど当たり判定が広がり、
      // 巨体同士が全身重なることはない
      const re = a.def.r * (a.sizeMul || 1);
      a._r = re / 3 + Math.max(0, re - 12) * 0.35;
      a._m = 1 + (a.def.tier || 0) * 0.6;
      a._ally = true;
      units.push(a);
    }
    // 主人公にも当たり判定(船上は除く)。質量は極大 ― 仲間や敵に押されず、
    // 逆に周りをどかす(止まっていても仲間に押されない)
    const pl = R.player;
    if (!pl.onBoat) { pl._r = 4; pl._m = 1e7; units.push(pl); }
    if (units.length < 2) return;
    // グリッドには全員入れるが、ペアを列挙するのは仲間と主人公だけ。
    // 敵は列挙しない=敵同士のペアはそもそも発生しない(大群でも軽い)。
    // 敵↔仲間のペアは仲間側の列挙で1回だけ処理されるので、押し量は2倍で補正
    // (従来は両側から2回処理していた)
    const cell = 64, grid = new Map();   // キーは整数(gkey)。文字列連結より速い
    for (const u of units) {
      const k = gkey((u.x / cell) | 0, (u.y / cell) | 0);
      const arr = grid.get(k);
      if (arr) arr.push(u); else grid.set(k, [u]);
    }
    const movers = units.filter(u => u._ally || u === pl);
    for (const u of movers) {
      const gx = (u.x / cell) | 0, gy = (u.y / cell) | 0;
      for (let ix = gx - 1; ix <= gx + 1; ix++) {
        for (let iy = gy - 1; iy <= gy + 1; iy++) {
          const arr = grid.get(gkey(ix, iy));
          if (!arr) continue;
          for (const v of arr) {
            if (v === u) continue;
            // 主人公は敵をすり抜ける(主人公と敵は当たり判定なし。仲間とは押し合う)
            if (u === pl && !v._ally) continue;
            const dx = v.x - u.x, dy = v.y - u.y;
            const rr = (u._r + v._r) * 0.9;
            const d2 = dx * dx + dy * dy;
            if (d2 >= rr * rr) continue;
            if (d2 === 0) { if (v !== pl) { u.x += Math.random() - 0.5; u.y += Math.random() - 0.5; } continue; }
            const sameSide = v !== pl && u !== pl && !!u._ally === !!v._ally;
            if (sameSide && u._si > v._si) continue;   // 仲間同士のペアは片側だけ処理(係数2倍で等価)
            // 主人公↔仲間=両側から2回処理される(従来どおりの係数)。
            // 仲間同士・敵↔仲間=1回だけ処理なので2倍で補正
            const d = Math.sqrt(d2), tot = (rr - d) * (sameSide ? 0.12 : (u === pl || v === pl ? 0.32 : 0.64));
            const mu = u._m || 1, mv = v._m || 1;
            const nx = dx / d, ny = dy / d;
            // 主人公は絶対に押されない(敵にも味方にも押し負けず、相手を全部どかす)
            const uImm = u === pl, vImm = v === pl;
            // 敵が押し合いで主人公へ押し込まれない: 主人公の近くでは、
            // 主人公方向への押し成分を消す(後ろの群れが前の敵を擦り付けてくるのを防ぐ)
            const push = (ent, fx, fy) => {
              if (!ent._ally && ent !== pl) {
                const dxp = pl.x - ent.x, dyp = pl.y - ent.y;
                const dp2 = dxp * dxp + dyp * dyp;
                if (dp2 < 120 * 120) {
                  const dl = Math.sqrt(dp2) || 1;
                  const tw = (fx * dxp + fy * dyp) / dl;
                  if (tw > 0) { fx -= dxp / dl * tw; fy -= dyp / dl * tw; }
                }
              }
              ent.x += fx; ent.y += fy;
            };
            if (!uImm) { const f = vImm ? 1 : mv / (mu + mv); push(u, -nx * tot * f, -ny * tot * f); }
            if (!vImm) { const f = uImm ? 1 : mu / (mu + mv); push(v, nx * tot * f, ny * tot * f); }
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
    if ((R.sigUntil || 0) > R.time && DATA.WEAPONS[id]) base *= 0.4;   // 突撃の号令: 連射強化
    const cd = base * (1 - R.stats.cdr);
    if ((R.cd[id] || 0) <= R.time) { R.cd[id] = R.time + cd; return true; }
    return false;
  }
  function nearestEnemy(x, y, maxD){
    // 索敵半径が狭い(武器射程など)なら近傍グリッドで探す ― 敵の総数と無関係に軽い
    if (maxD && maxD <= 560) {
      let best = null, bd2 = maxD * maxD;
      forEachFoeNear(x, y, maxD, (e) => {
        const dx = e.x - x, dy = e.y - y, d2 = dx * dx + dy * dy;
        if (d2 < bd2) { best = e; bd2 = d2; }
        return false;
      });
      return best;
    }
    let best = null, bd2 = maxD ? maxD * maxD : Infinity;
    for (const e of R.enemies) {
      if (e.dead) continue;
      const dx = e.x - x, dy = e.y - y, d2 = dx * dx + dy * dy;
      if (d2 < bd2) { best = e; bd2 = d2; }
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
          // 飛距離は射程(狙える距離)+少しの余裕まで。強化で弾数や貫通が増えても
          // 射程の外まで飛んで遠くの敵に当たることはない(射程は眼力などで伸ばす)
          R.projs.push({ x:p.x, y:p.y, vx:Math.cos(a)*bolt.speed, vy:Math.sin(a)*bolt.speed,
                         dmg:bolt.dmg, life:1.6, maxFly:effRange(360) + 60,
                         size:6, pierce:bolt.pierce, color:'#58a6ff' });
        }
      } else R.cd['bolt'] = R.time + 0.15;
    }
    // --- 追尾ミサイル ---
    const hom = wstat('homing');
    if (hom && cdReady('homing', hom.cd)) {
      for (let i = 0; i < hom.count; i++) {
        const a = Math.random() * Math.PI * 2;
        // さまよう性質は保ちつつ、主人公の射程圏から離れすぎたら消える(遠距離狙撃防止)
        R.projs.push({ x:p.x, y:p.y, vx:Math.cos(a)*hom.speed, vy:Math.sin(a)*hom.speed,
                       dmg:hom.dmg, life:3.2, leash:R.rangeCapPx * 2 + 90,
                       size:6, pierce:0, homing:hom.turn, hspeed:hom.speed,
                       blast:hom.blast, color:'#f0883e' });
      }
    }
    // --- ブーメランアクス ---
    const axe = wstat('axe');
    if (axe && cdReady('axe', axe.cd)) {
      const arange = effRange(axe.range);   // 飛距離も初期画面内に収める
      for (let i = 0; i < axe.count; i++) {
        const tgt = nearestEnemy(p.x, p.y, effRange(420)) || nearestObject(p.x, p.y, effRange(420));
        const a = tgt ? Math.atan2(tgt.y-p.y, tgt.x-p.x) + (i-(axe.count-1)/2)*0.4 : Math.random()*7;
        R.projs.push({ x:p.x, y:p.y, vx:Math.cos(a)*330, vy:Math.sin(a)*330,
                       dmg:axe.dmg, life:arange/330*2, size:axe.size, pierce:99, boomerang:true,
                       phase:0, maxT:arange/330, color:'#9aa5b1' });
      }
    }
    // --- チェインライトニング ---
    const ch = wstat('chain');
    if (ch && cdReady('chain', ch.cd)) {
      let cur = nearestEnemy(p.x, p.y, effRange(ch.range * area)) || nearestObject(p.x, p.y, effRange(ch.range * area * 0.6));
      const hit = new Set();
      let px = p.x, py = p.y;
      for (let j = 0; j <= ch.jumps && cur; j++) {
        effect('bolt', px, py, { x2:cur.x, y2:cur.y });
        if (cur.type) hitObject(cur, ch.dmg); else dealDamage(cur, ch.dmg);
        hit.add(cur);
        px = cur.x; py = cur.y;
        let nxt = null, bd = 220 * area;
        forEachFoeNear(px, py, bd, (e) => {
          if (hit.has(e)) return false;
          const d = Math.hypot(e.x - px, e.y - py);
          if (d < bd) { nxt = e; bd = d; }
          return false;
        });
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
      forEachFoeNear(p.x, p.y, rad + (R.maxFoeR || 60), (e) => {
        if (Math.hypot(e.x-p.x, e.y-p.y) < rad + e.def.r) {
          dealDamage(e, fl.dmg);
          if (fl.burn) { e.burn = fl.burn; e.burnT = 3; }
        }
        return false;
      });
      damageObjectsIn(p.x, p.y, rad, fl.dmg);
    }
    // --- フロストノヴァ ---
    const nv = wstat('nova');
    if (nv && cdReady('nova', nv.cd)) {
      const rad = nv.radius * area;
      effect('ring', p.x, p.y, { color:'#76e3ea', r:rad });
      forEachFoeNear(p.x, p.y, rad + (R.maxFoeR || 60), (e) => {
        if (Math.hypot(e.x-p.x, e.y-p.y) < rad + e.def.r) {
          dealDamage(e, nv.dmg);
          e.slowUntil = R.time + nv.slowDur; e.slowMul = nv.slow;
          if (nv.freeze) e.frozenUntil = R.time + nv.freeze;
        }
        return false;
      });
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
      const cands = [];
      forEachFoeNear(p.x, p.y, thR, (e) => {
        if (Math.hypot(e.x-p.x, e.y-p.y) < thR) cands.push(e);
        return false;
      });
      for (const o of R.objects || []) {
        if (Math.hypot(o.x-p.x, o.y-p.y) < thR * 0.9) cands.push(o);
      }
      for (let i = 0; i < th.count && cands.length; i++) {
        const e = cands[Math.floor(Math.random() * cands.length)];
        effect('thunder', e.x, e.y, {});
        const rad = th.blast * area;
        if (e.type) hitObject(e, th.dmg);
        forEachFoeNear(e.x, e.y, rad + (R.maxFoeR || 60), (o) => {
          if (Math.hypot(o.x-e.x, o.y-e.y) < rad + o.def.r) dealDamage(o, th.dmg);
          return false;
        });
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
          const tgt = nearestEnemy(t.x, t.y, effRange(tu.range * area)) || nearestObject(t.x, t.y, effRange(260));
          if (tgt) {
            t.fireCd = tu.fireCd * (1 - st.cdr);
            const d = Math.hypot(tgt.x-t.x, tgt.y-t.y) || 1;
            const shots = tu.dual ? 2 : 1;
            for (let s = 0; s < shots; s++) {
              const a = Math.atan2(tgt.y-t.y, tgt.x-t.x) + (s ? 0.15 : 0);
              R.projs.push({ x:t.x, y:t.y, vx:Math.cos(a)*500, vy:Math.sin(a)*500,
                             dmg:tu.dmg, life:1.2, maxFly:effRange(tu.range * area) + 60,
                             size:4, pierce:0, color:'#8b949e' });
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
      const mr = effRange(380);   // 落下範囲も初期画面内に
      for (let i = 0; i < me.count; i++) {
        const x = p.x + rnd(-mr, mr), y = p.y + rnd(-mr*0.74, mr*0.74);
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
        const brange = effRange(br.range * area);   // 吐息の到達も初期画面内に
        effect('breath', p.x, p.y, { angle:a, range:brange, arc:br.arc });
        forEachFoeNear(p.x, p.y, brange, (e) => {
          const d = Math.hypot(e.x-p.x, e.y-p.y);
          if (d > brange) return false;
          const ea = Math.atan2(e.y-p.y, e.x-p.x);
          let diff = Math.abs(ea - a); if (diff > Math.PI) diff = Math.PI*2 - diff;
          if (diff < br.arc) { e.hp -= br.dps * st.atk * dt; e.flash = 0.05; if (e.hp <= 0) killEnemy(e); }
          return false;
        });
        for (const o of R.objects || []) {
          const d = Math.hypot(o.x-p.x, o.y-p.y);
          if (d > brange) continue;
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
      const tgt = nearestEnemy(p.x, p.y, effRange(420)) || nearestObject(p.x, p.y, effRange(300));
      if (tgt) {
        R.cd['gstorm'] = R.time + 9;
        effect('thunder', tgt.x, tgt.y, {});
        if (tgt.type) hitObject(tgt, st.stormDmg / st.atk); else dealDamage(tgt, st.stormDmg / st.atk);
      } else R.cd['gstorm'] = R.time + 0.5;
    }
    // --- 混沌の瘴気(敵を混乱させ同士討ち) ※対象がいない時は保留 ---
    // --- 遺跡の脈動: 弾き飛ばし+短時間停止 ---
    const pu = Skills.stat('pulse');
    if (pu && cdReady('pulse', pu.cd)) {
      let n = 0;
      // 対象を集めてから動かす(押し出し先のセルで同じ敵を2度処理しないように)
      const hits = [];
      forEachFoeNear(p.x, p.y, pu.radius * area, (e) => {
        if (e.boss || e.def.isReaper) return false;
        const dd = Math.hypot(e.x - p.x, e.y - p.y);
        if (dd <= pu.radius * area) hits.push([e, dd]);
        return false;
      });
      for (const [e, dd] of hits) {
        const nx = e.x + (e.x - p.x) / (dd || 1) * pu.push, ny = e.y + (e.y - p.y) / (dd || 1) * pu.push;
        if (canStand(e.def, nx, ny)) { e.x = nx; e.y = ny; }
        e.frozenUntil = Math.max(e.frozenUntil, R.time + pu.freeze);
        n++;
      }
      if (n > 0) effect('ring', p.x, p.y, { color:'#a5d8ff', r: pu.radius * area });
      else R.cd['pulse'] = R.time + 0.3;
    }
    // --- 命の泉水: 自分と仲間をまとめて回復 ---
    const sw = Skills.stat('spring');
    if (sw && (R.cd['spring'] || 0) <= R.time) {
      const hurt = p.hp < st.maxHp || R.allies.some(a => !a.waitAt && a.hp < a.maxHp);
      if (hurt) {
        R.cd['spring'] = R.time + sw.cd * (1 - st.cdr);
        p.hp = Math.min(st.maxHp, p.hp + sw.heal);
        for (const a of R.allies) if (!a.waitAt) a.hp = Math.min(a.maxHp, a.hp + sw.heal);
        effect('ring', p.x, p.y, { color:'#7ee787', r: 120 });
      } else R.cd['spring'] = R.time + 0.5;
    }
    // --- 黄昏の帳: 敵弾消去+射撃封印 ---
    const vl = Skills.stat('veil');
    if (vl && (R.cd['veil'] || 0) <= R.time) {
      if (R.eprojs.length > 0) {
        R.cd['veil'] = R.time + vl.cd * (1 - st.cdr);
        R.eprojs.length = 0;
        forEachFoeNear(p.x, p.y, vl.radius * area, (e) => {
          if (e.def.ranged && Math.hypot(e.x - p.x, e.y - p.y) < vl.radius * area)
            e.shootCd = Math.max(e.shootCd, vl.seal);
          return false;
        });
        effect('ring', p.x, p.y, { color:'#f778ba', r: vl.radius * area });
      } else R.cd['veil'] = R.time + 0.4;
    }
    // --- 野生の呼び声: 近くの敵を仲間に引き入れる ---
    const wc = Skills.stat('wildcall');
    if (wc && R.allies.length < st.allyCap && (R.cd['wildcall'] || 0) <= R.time) {
      let pick = null, pd2 = 1e9;
      forEachFoeNear(p.x, p.y, wc.radius * area, (e) => {
        if (e.boss || e.def.isReaper || e.def.rare) return false;
        if ((e.def.tier || 0) > wc.tier) return false;
        const dd = Math.hypot(e.x - p.x, e.y - p.y);
        if (dd < wc.radius * area && dd < pd2) { pick = e; pd2 = dd; }
        return false;
      });
      if (pick) {
        R.cd['wildcall'] = R.time + wc.cd * (1 - st.cdr);
        recruitAlly(pick);
        pick.dead = true;   // ドロップ無しで敵から外す(仲間into)
        popup(pick.x, pick.y - 20, '仲間になった!', '#7ee787');
      } else R.cd['wildcall'] = R.time + 0.5;
    }
    // --- 白亜の灯: 画面中のアイテムを引き寄せ ---
    const bc = Skills.stat('beacon');
    if (bc && (R.cd['beacon'] || 0) <= R.time) {
      if (R.pickups.length > 0) {
        R.cd['beacon'] = R.time + bc.cd * (1 - st.cdr);
        for (const pk of R.pickups) { pk.vacuumed = true; pk.vacDeadline = R.time + bc.dur; }
        effect('ring', p.x, p.y, { color:'#ffd766', r: 140 });
      } else R.cd['beacon'] = R.time + 0.5;
    }
    // --- 月光の疾走: 自分と仲間の加速バースト ---
    const mr = Skills.stat('moonrush');
    if (mr && cdReady('moonrush', mr.cd)) {
      R.speedBurst = { until: R.time + mr.dur, mult: mr.mult };
      effect('ring', p.x, p.y, { color:'#a5d8ff', r: 90 });
    }
    // --- 雷雲の呼び声: 周囲の敵を感電停止 ---
    const sc = Skills.stat('stormcall');
    if (sc && (R.cd['stormcall'] || 0) <= R.time) {
      let n = 0;
      forEachFoeNear(p.x, p.y, sc.radius * area, (e) => {
        if (e.boss || e.def.isReaper) return false;
        if (Math.hypot(e.x - p.x, e.y - p.y) < sc.radius * area) { e.frozenUntil = Math.max(e.frozenUntil, R.time + sc.dur); n++; }
        return false;
      });
      if (n > 0) {
        R.cd['stormcall'] = R.time + sc.cd * (1 - st.cdr);
        effect('ring', p.x, p.y, { color:'#fde047', r: sc.radius * area });
      } else R.cd['stormcall'] = R.time + 0.3;
    }
    // --- 太陽の熱波: 広範囲をまとめて炎上 ---
    const sb = Skills.stat('sunburst');
    if (sb && (R.cd['sunburst'] || 0) <= R.time) {
      let n = 0;
      forEachFoeNear(p.x, p.y, sb.radius * area, (e) => {
        if (Math.hypot(e.x - p.x, e.y - p.y) < sb.radius * area) {
          e.burn = Math.max(e.burn, sb.burn); e.burnT = sb.dur; n++;
        }
        return false;
      });
      if (n > 0) {
        R.cd['sunburst'] = R.time + sb.cd * (1 - st.cdr);
        effect('ring', p.x, p.y, { color:'#d29922', r: sb.radius * area });
      } else R.cd['sunburst'] = R.time + 0.3;
    }
    // --- 虚無の引力: 周囲の敵を引き寄せる ---
    const vg = Skills.stat('voidgrip');
    if (vg && (R.cd['voidgrip'] || 0) <= R.time) {
      let n = 0;
      // 対象を集めてから引き寄せる(移動先のセルで同じ敵を2度処理しないように)
      const hits = [];
      forEachFoeNear(p.x, p.y, vg.radius * area, (e) => {
        if (e.boss || e.def.isReaper) return false;
        const dd = Math.hypot(e.x - p.x, e.y - p.y);
        if (dd <= vg.radius * area && dd >= 110) hits.push([e, dd]);
        return false;
      });
      for (const [e, dd] of hits) {
        const nd = Math.max(110, dd * vg.pull);
        const nx = p.x + (e.x - p.x) / dd * nd, ny = p.y + (e.y - p.y) / dd * nd;
        if (canStand(e.def, nx, ny)) { e.x = nx; e.y = ny; e.mad = true; n++; }
      }
      if (n > 0) {
        R.cd['voidgrip'] = R.time + vg.cd * (1 - st.cdr);
        effect('ring', p.x, p.y, { color:'#6e40c9', r: vg.radius * area });
      } else R.cd['voidgrip'] = R.time + 0.4;
    }
    // --- 火の粉: 周囲の敵を炎上させる ---
    const em = Skills.stat('ember');
    if (em && (R.cd['ember'] || 0) <= R.time) {
      let n = 0;
      forEachFoeNear(p.x, p.y, em.radius * area, (e) => {
        if (Math.hypot(e.x - p.x, e.y - p.y) < em.radius * area) {
          e.burn = Math.max(e.burn, em.burn); e.burnT = em.dur;
          if (++n >= em.count) return true;
        }
        return false;
      });
      if (n > 0) {
        R.cd['ember'] = R.time + em.cd * (1 - st.cdr);
        effect('ring', p.x, p.y, { color:'#ff6b35', r: em.radius * area });
      } else R.cd['ember'] = R.time + 0.3;
    }
    // --- 骨の呼び声: 骸骨の仲間を召喚 ---
    const bw = Skills.stat('bonewall');
    if (bw && R.allies.length < st.allyCap && cdReady('bonewall', bw.cd)) {
      const def = DATA.ENEMIES.skeleton;
      const hp = def.hp * bw.hpMul * st.allyHp;
      R.allies.push({ def, key:'skeleton', x: p.x + rnd(-30, 30), y: p.y + rnd(-30, 30),
        maxHp: hp, hp, dmg: def.dmg, speed: st.speed,
        atkCd: 0, healCd: 0, shootCd: 0, waitAt: null, saved: false, slot: undefined });
      assignSlot(R.allies[R.allies.length - 1]);
      popup(p.x, p.y - 30, '骸骨を召喚!', '#e6edf3');
      Sfx.recruit();
    }
    const cf = Skills.stat('confuse');
    if (cf && (R.cd['confuse'] || 0) <= R.time) {
      const cands = [];
      forEachFoeNear(p.x, p.y, cf.radius * area, (e) => {
        if (!e.boss && !e.def.isReaper && Math.hypot(e.x - p.x, e.y - p.y) < cf.radius * area) cands.push(e);
        return false;
      });
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
      forEachFoeNear(p.x, p.y, rad + (R.maxFoeR || 60), (e) => {
        if (Math.hypot(e.x - p.x, e.y - p.y) < rad + e.def.r) {
          e.shred = Math.max(e.shred, cu.shred);
          e.slowUntil = Math.max(e.slowUntil, R.time + cu.dur);
          e.slowMul = cu.slow;
          e.cursedUntil = R.time + cu.dur;
          n++;
        }
        return false;
      });
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
      forEachFoeNear(z.x, z.y, z.size + (R.maxFoeR || 60), (e) => {
        if (Math.hypot(e.x-z.x, e.y-z.y) < z.size + e.def.r) {
          e.hp -= z.dps * st.atk * dt;
          if (z.shred) e.shred = z.shred;
          e.flash = Math.max(e.flash, 0.03);
          if (e.hp <= 0) killEnemy(e);
        }
        return false;
      });
      for (const o of R.objects || []) {
        if (Math.hypot(o.x-z.x, o.y-z.y) < z.size + o.r) hitObject(o, z.dps * dt);
      }
    }
  }

  // ビーム(直線)判定: 敵とオブジェクトの両方に命中
  // 線分(x0,y0)-(x1,y1) が半径rの円(cx,cy)に触れるか(弾のすり抜け防止)
  function segCircleHit(x0, y0, x1, y1, cx, cy, r){
    const dx = x1 - x0, dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((cx - x0) * dx + (cy - y0) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = x0 + dx * t, py = y0 + dy * t;
    return (px - cx) * (px - cx) + (py - cy) * (py - cy) < r * r;
  }

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
      for (const m of drops) {
        if (Math.random() >= R.stats.dropMul) continue;   // オブジェクトのドロップ率も dropMul(初期60%)を反映
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
        forEachFoeNear(ox, oy, ob.size + (R.maxFoeR || 60), (e) => {
          if (Math.hypot(e.x-ox, e.y-oy) < ob.size + e.def.r && R.time - (e.orbitHit || 0) > 0.5) {
            e.orbitHit = R.time;
            dealDamage(e, ob.dmg);
          }
          return false;
        });
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
      // 射程の外へは飛ばない: maxFly=飛距離の上限 / leash=主人公からの距離の上限(追尾弾)
      if (b.maxFly != null) {
        b.flew = (b.flew || 0) + Math.hypot(b.vx, b.vy) * dt;
        if (b.flew > b.maxFly) { R.projs.splice(i, 1); continue; }
      }
      if (b.leash != null && Math.hypot(b.x - R.player.x, b.y - R.player.y) > b.leash) {
        R.projs.splice(i, 1); continue;
      }
      // 追尾(敵がいなければオブジェクトも狙う)
      if (b.homing) {
        const tgt = nearestEnemy(b.x, b.y, effRange(400)) || nearestObject(b.x, b.y, effRange(400));
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
      // 命中(近傍グリッドだけ見る ― 敵が何百体いても弾のコストは一定)
      let hit = false;
      forEachFoeNear(b.x, b.y, b.size + 60, (e) => {
        if (b._pierced && b._pierced.includes(e)) return false;   // 貫通済みの敵に再ヒットしない
        if (Math.hypot(e.x-b.x, e.y-b.y) < b.size + e.def.r) {
          if (b.boomerang) {
            if (!e._axeT || R.time - e._axeT > 0.5) { e._axeT = R.time; dealDamage(e, b.dmg); }
            return false;   // 斧は貫通して回り続ける
          }
          dealDamage(e, b.dmg);
          if (b.blast) {
            // 爆発は「当たった敵」を起点に広がる(弾の接触点=敵の縁ではなく敵の中心から)
            effect('ring', e.x, e.y, { color:'#f0883e', r:b.blast });
            forEachFoeNear(e.x, e.y, b.blast + 60, (o) => {
              if (o !== e && Math.hypot(o.x-e.x, o.y-e.y) < b.blast + o.def.r) dealDamage(o, b.dmg * 0.7);
              return false;
            });
          }
          if (b.pierce > 0) { b.pierce--; (b._pierced = b._pierced || []).push(e); return false; }
          hit = true; return true;
        }
        return false;
      });
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
          forEachFoeNear(ef.x, ef.y, ef.blast + (R.maxFoeR || 60), (e) => {
            if (Math.hypot(e.x-ef.x, e.y-ef.y) < ef.blast + e.def.r) dealDamage(e, ef.dmg);
            return false;
          });
          damageObjectsIn(ef.x, ef.y, ef.blast, ef.dmg);
        }
      }
    }
  }

  // ---------------- 港・基地・船 ----------------
  // 基地の中に用事があるか(未解放の解放依頼・報告待ち・受けられる住民の依頼)
  function baseHasBusiness(b){
    const un = SaveSys.data.bases[b.id];
    if (!un) { const a = Quest.activeFor('base', b.id); if (!a || a.phase === 'return') return true; }
    const q2a = Quest.activeFor('base2', b.id);
    if (q2a && q2a.phase === 'return') return true;
    if (un && DATA.QUESTS2[b.id] && !(SaveSys.data.quests2 && SaveSys.data.quests2[b.id]) && !q2a) return true;
    for (const sq of (DATA.SIDEQUESTS && DATA.SIDEQUESTS[b.id]) || []) {
      if (!Quest.sideVisible(sq)) continue;   // 旅立った/まだ来ていない住民は数えない
      const a = Quest.activeFor('side', sq.id);
      if (a && a.phase === 'return') return true;
      if (!a && !(SaveSys.data.sideDone || {})[sq.id] &&
          (!sq.requiresStory || (SaveSys.data.story || {})[sq.requiresStory])) return true;
    }
    return false;
  }

  function updateInteractions(dt){
    const p = R.player;
    R.interact = null;
    // クエスト帰還直後は少しの間インタラクト無効(勝手に話しかけない)
    if (R.noInteractT > 0) { R.noInteractT -= dt; return; }

    // 基地(村・街): 転移シンボルから中に入る。依頼も住民も全て中にある
    for (const b of World.bases) {
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      if (d < 90) {
        R.interact = { type:'enterbase', base:b,
          label: 'E: 「' + b.name + '」に入る' + (baseHasBusiness(b) ? ' ❗' : '') };
      }
      if (d < 150 && SaveSys.data.bases[b.id]) {
        p.hp = Math.min(R.stats.maxHp, p.hp + 3 * dt);   // 解放済みの村の近くは安全地帯
      }
    }

    // 港: 近づくと港町マップへ転移(船大工・貿易商は町の中)。
    // 修理済みの船には桟橋の先(海側)から乗る
    if (!p.onBoat) {
      for (const port of World.ports) {
        if (Math.hypot(p.x - port.x, p.y - port.y) < 110) {
          R.interact = { type:'enterport', port, label:'E: 港町「' + port.name + '」に入る' };
          break;
        }
        if (SaveSys.data.ports[port.id] && Math.hypot(p.x - port.seaX, p.y - port.seaY) < 100) {
          R.interact = { type:'board', port, label:'E: 「' + port.name + '」から出航する' };
          break;
        }
      }
      // 基地の小道を歩く行商人
      if (!R.interact) {
        for (const b of World.bases) {
          if (Math.abs(p.x - b.x) > 4200 || Math.abs(p.y - b.y) > 4200) continue;
          const pp = peddlerPos(b);
          if (pp && Math.hypot(p.x - pp.x, p.y - pp.y) < 60) {
            R.interact = { type:'peddler', base:b, label:'E: 行商人と取引' };
            break;
          }
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
    if (it.type === 'enterport') Game.enterPortFromRun(it.port.id);
    else if (it.type === 'trader') openTrade('port_' + it.port.id, '貿易商');
    else if (it.type === 'peddler') openTrade('ped_' + it.base.id, '行商人');
    else if (it.type === 'enterbase') Game.enterBaseFromRun(it.base.id);
    else if (it.type === 'board') boardBoat(it.port.seaX, it.port.seaY, it.port);
    else if (it.type === 'reboard') boardBoat(p.boatAnchor.x, p.boatAnchor.y, null);
  }

  // 素材⇄コインの取引(港の貿易商/小道の行商人)。相場は周回と場所で変わる
  function openTrade(seedKey, who){
    let h = SaveSys.data.stats.runs * 97;
    for (let i = 0; i < seedKey.length; i++) h = (h * 31 + seedKey.charCodeAt(i)) | 0;
    h = Math.abs(h);
    const pool = Object.keys(DATA.MATERIALS).filter(m => Skills.matUnlocked(m) && (DATA.MATERIALS[m].tier || 0) <= 3);
    if (!pool.length) return;
    const buyMat = pool[h % pool.length];
    const bt = DATA.MATERIALS[buyMat].tier || 0;
    const buyPrice = Math.round((bt + 1) * 45 * (0.8 + (h % 5) * 0.1));   // 相場: ±20%
    // 売り: いま一番持っている素材を10個
    const mats = Skills.mats();
    let sellMat = null, most = 9;
    for (const m in mats) if (mats[m] > most) { most = mats[m]; sellMat = m; }
    const sellPrice = sellMat ? Math.round(((DATA.MATERIALS[sellMat].tier || 0) + 1) * 4 * 10 * (0.8 + ((h >> 3) % 5) * 0.1)) : 0;
    const wallet = SaveSys.data.coins + R.coins;
    const opts = [
      { label:'買う: ' + DATA.MATERIALS[buyMat].name + '×5(🪙' + buyPrice + ')', disabled: wallet < buyPrice,
        cb(){
          const fromRun = Math.min(R.coins, buyPrice);
          R.coins -= fromRun; SaveSys.data.coins -= (buyPrice - fromRun); SaveSys.save();
          Skills.addMat(buyMat, 5); Sfx.buy();
          popup(R.player.x, R.player.y - 30, DATA.MATERIALS[buyMat].name + '×5を仕入れた', '#7ee787');
        } },
    ];
    if (sellMat) opts.push({ label:'売る: ' + DATA.MATERIALS[sellMat].name + '×10(🪙' + sellPrice + ')',
      cb(){ Skills.mats()[sellMat] -= 10; R.coins += sellPrice; Sfx.buy();
            popup(R.player.x, R.player.y - 30, '🪙' + sellPrice + 'で売れた', '#ffd766'); } });
    opts.push({ label:'やめる', sub:true });
    // 港の貿易商と街道の行商人は別人。口上も別に(口調の使い回しをしない)
    const greeting = who === '行商人'
      ? 'へい、いらっしゃい。歩き売りの身でね、荷は軽いが目利きは確かだよ。今日はこれだ。'
      : '見ての通り、相場は日々変わる。今日の取引はこれだ。';
    Game.dialogChoice(who || '貿易商', 'npc_scholar', greeting, opts);
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
  // ---- 指名討伐: 印の場所に「名前つきの色違い」が現れる ----
  function hasMark(tag){ return R.enemies.some(e => e.markId === tag && !e.dead); }
  // 防衛クエストの襲撃ウェーブ: 対象種のmad個体を画面外から差し向ける
  function spawnQuestWave(enemyKey, n){
    for (let i = 0; i < n; i++) {
      spawnEnemy(enemyKey, { mad: true, dist: (R.offscreenR || 500) + rnd(20, 160) });
    }
  }
  function spawnMark(tag, def){
    const e = spawnEnemy(def.enemy, { x:def.mark.x + rnd(-60, 60), y:def.mark.y + rnd(-60, 60),
      rank: def.rank || 1, aggro: 260 });
    if (e) { e.markId = tag; e.bossName = def.markName; e.sizeMul *= 1.15; }
    return !!e;
  }

  // ---- 護送: 依頼主の元から目的地まで歩くNPCを守る ----
  function startEscort(tag, from, def){
    R.escort = { tag, x:(from ? from.x : R.player.x) + 40, y:(from ? from.y : R.player.y) + 40,
      hp: def.ehp || 260, maxHp: def.ehp || 260,
      dest: def.dest, spr: def.escortSpr || 'npc_girl', state:'go' };
  }
  function escortState(tag){
    if (!R.escort || R.escort.tag !== tag) return 'gone';
    return R.escort.state;
  }
  function updateEscort(dt){
    const es = R.escort;
    if (!es || es.state !== 'go') return;
    const d = Math.hypot(es.dest.x - es.x, es.dest.y - es.y);
    if (d < 90) { es.state = 'arrived'; popup(es.x, es.y - 26, '着いた!ありがとう!', '#7ee787'); setTimeout(() => { if (R.escort === es) R.escort = null; }, 50); return; }
    // プレイヤーが離れすぎていたら待つ(置き去りにしない)
    const pd = Math.hypot(R.player.x - es.x, R.player.y - es.y);
    if (pd < 420) { es.x += (es.dest.x - es.x) / d * 58 * dt; es.y += (es.dest.y - es.y) / d * 58 * dt; }
    // 触れている敵から削られる(守り甲斐)
    forEachFoeNear(es.x, es.y, (R.maxFoeR || 60) + 16, (e) => {
      if (Math.hypot(e.x - es.x, e.y - es.y) < e.def.r * (e.sizeMul || 1) + 16) es.hp -= e.dmg * 0.45 * dt;
      return false;
    });
    if (es.hp <= 0) { es.state = 'dead'; effect('burst', es.x, es.y, { color:'#f85149', r:20 }); setTimeout(() => { if (R.escort === es) R.escort = null; }, 50); }
  }

  // プレイヤーが今いる小道(近くの基地の道で40px以内)を返す
  function nearestRoadBase(x, y){
    for (const b of World.bases) {
      if (Math.abs(x - b.x) > 4200 || Math.abs(y - b.y) > 4200) continue;
      const rd = World.roadOf(b.id);
      if (rd && World.roadDist(rd, x, y) < 40) return b;
    }
    return null;
  }
  // 行商人の位置(基地の小道の途中に立って店を広げている。動き回らない)
  function peddlerPos(b){
    const rd = World.roadOf(b.id);
    if (!rd) return null;
    return { x: rd.x1 + (rd.x2 - rd.x1) * 0.55, y: rd.y1 + (rd.y2 - rd.y1) * 0.55, rd };
  }

  function update(dt){
    // 突撃の号令(Space / ボタン)
    if (Input.takeSig && Input.takeSig()) warcry();
    // 被弾フラッシュ・色違いの爆発予兆・越境の演出タイマー
    if (R.hitFlashT > 0) R.hitFlashT -= dt;
    if (R.bioFxT > 0) R.bioFxT -= dt;
    updateEscort(dt);
    if (R.traitBursts && R.traitBursts.length) {
      for (const tb of R.traitBursts) {
        tb.t -= dt;
        if (tb.t <= 0) {
          effect('burst', tb.x, tb.y, { color:'#f85149', r:tb.r });
          const p0 = R.player;
          // 爆発は「避けなかった罰」程度: 主人公へのダメージは最大10まで。
          // 群れをまとめて倒した時に何発も連続で食らわないよう、2秒に1発まで
          if (Math.hypot(p0.x - tb.x, p0.y - tb.y) < tb.r + 10 && R.time - (R.lastBurstHitT || -9) > 2) {
            R.lastBurstHitT = R.time;
            damagePlayer(Math.min(10, tb.dmg), { x:tb.x, y:tb.y, def:{ name:'弾ける色違いの爆発' } });
          }
        }
      }
      R.traitBursts = R.traitBursts.filter(tb => tb.t > 0);
    }
    if (R.over) return;
    R.time += dt;
    R.stats = applyMods(R.baseStats);   // スキルのパッシブ効果をライブ反映
    const p = R.player, st = R.stats;
    p.invuln = Math.max(0, p.invuln - dt);

    // 移動(botAxisは自動テストプレイ用フック)
    const ax = R.botAxis || Input.axis();
    // 主人公は敵をすり抜ける。対敵中でも速度は落とさない(常にステータス速度で動ける)
    const rushMul = (R.speedBurst && R.time < R.speedBurst.until) ? R.speedBurst.mult : 1;   // 月光の疾走
    let terrMul = 1;
    if (p.onBoat) {
      // 航路の早瀬(海の道): 乗ると潮が船を大きく押す ― 素の船足でも大陸間を渡れる。
      // 自然の潮(帯状のむら)は従来どおり控えめな追い風
      const rc = World.routeCurrentAt(p.x, p.y);
      const cur = World.currentAt(p.x, p.y);
      terrMul = 1 + rc * (R.worldEvent === 'calm' ? 5.5 : 4.5) + cur * 0.45;
    } else {
      // 基地から延びる小道の上は歩きやすい
      const nb = nearestRoadBase(p.x, p.y);
      if (nb) terrMul = 1.1;
    }
    // 歩き続けると足が乗ってくる: 4秒かけて最大+30%(立ち止まるとリセット。船は海流が担当)
    if ((ax.x || ax.y) && !p.onBoat) R.moveRampT = Math.min(4, (R.moveRampT || 0) + dt);
    else R.moveRampT = 0;
    const rampMul = 1 + (R.moveRampT / 4) * 0.3;
    R.rampMul = rampMul;   // 仲間も同じ歩調で加速する(軍勢が置いていかれない)
    const spd = (p.onBoat ? st.boatSpeed : st.speed * rampMul) * rushMul * terrMul;
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
      // 基地・港の発見記録。「見つけた」と言うのは実際に画面に映った時だけ
      // (近くを通っただけでは見つけたことにならない ― 体験とテキストを一致させる)
      SaveSys.data.seen = SaveSys.data.seen || {};
      const dvw = (R.viewHalfW || 640) - 40, dvh = (R.viewHalfH || 360) - 40;
      for (const b of World.bases) {
        if (!SaveSys.data.seen[b.id] && Math.abs(p.x - b.x) < dvw && Math.abs(p.y - b.y) < dvh) {
          SaveSys.data.seen[b.id] = true;
          if (SaveSys.data.hints) delete SaveSys.data.hints[b.id];   // 見当(?)は実際の発見で確定に変わる
          R.warnMsg = '🏘「' + b.name + '」を見つけた!';
          R.warnColor = '#7ee787'; R.warnT = 5;
          Sfx.skill();
        }
      }
      for (const pt of World.ports) {
        if (!SaveSys.data.seen[pt.id] && Math.abs(p.x - pt.x) < dvw && Math.abs(p.y - pt.y) < dvh) {
          SaveSys.data.seen[pt.id] = true;
          if (SaveSys.data.hints) delete SaveSys.data.hints[pt.id];
          R.warnMsg = '⚓「' + pt.name + '」を見つけた!';
          R.warnColor = '#76e3ea'; R.warnT = 5;
          Sfx.skill();
        }
      }
      // バイオドーム進入バナー(≈1分ごとに別のバイオドームへ入ると表示)
      const L = World.landAt(p.x, p.y);
      const bd = World.biodomeAt(p.x, p.y);
      const seaKey = L ? null : World.seaBiomeAt(p.x, p.y);
      const cid = L ? ('b' + bd.cx + '_' + bd.cy) : ('s_' + seaKey);
      R.curBiome = L ? bd.biome : 'sea';
      if (cid !== R.curCont) {
        R.curCont = cid;
        // 発見や依頼の報せが出ている間は、環境バナーで上書きしない(頻出の情報より重要)
        const warnBusy = (R.warnT || 0) > 0.3 && !/^―/.test(R.warnMsg || '');
        // 表示する素材はその土地の敵(fauna)のドロップテーブル由来 ― 実際に出るものだけ
        const faunaMats = (keys) => [...new Set(keys.flatMap(k => (DATA.ENEMIES[k].drops || []).map(d => d.m)))]
          .filter(m => Skills.matUnlocked(m)).slice(0, 4).map(m => DATA.MATERIALS[m].name).join('・');
        if (L) {
          const bio = DATA.BIOMES[bd.biome] || DATA.BIOMES.grass;
          const mm = faunaMats(DATA.BIOME_FAUNA[bd.biome] || []);
          if (!warnBusy) R.warnMsg = '― バイオドーム <' + bio.name + '> ―' + (mm ? ' 出る素材: ' + mm : '');
          R.bioFxT = 2.4; R.bioFxColors = bio.deco;   // 越境の演出(その土地の色の粒子)
        } else {
          const sb = DATA.SEA_BIOMES[seaKey] || { name:'海', fauna: DATA.SEA_FAUNA };
          const mm = faunaMats(sb.fauna || []);
          if (!warnBusy) R.warnMsg = '― 海域 <' + sb.name + '> ―' + (mm ? ' 出る素材: ' + mm : '');
          R.bioFxT = 2.4; R.bioFxColors = ['#e6edf3', sb.c1 || '#58a6ff', '#76e3ea'];
        }
        if (!warnBusy) { R.warnColor = '#a5d8ff'; R.warnT = 4; }
      }
    }
    R.peakAllies = Math.max(R.peakAllies, R.allies.length);

    // カメラ: 仲間が全員映る最小の視界。初期画面はぐっと狭く(視界半径 INIT_R。
    // 従来の約1/2.24=面積で約1/5)、軍勢が育つほど広がる。視界半径=need(world px)。
    const INIT_R = 158;
    const formR = formationRadius(R.allies.filter(a => !a.waitAt).length);
    const need = Math.max(120, formR + INIT_R);
    const zTarget = Math.max(0.36, Math.min(3.0, (R.viewMin || 800) / (2 * need)));   // 大軍時はより広く引ける
    R.zoom = (R.zoom || 1) + (zTarget - (R.zoom || 1)) * Math.min(1, dt * 1.6);
    // 攻撃射程は「敵が追尾してくる距離(アグロ 75〜115)より少し短い」68pxを基準に、
    // しに戻り後の射程強化(眼力=altar_range)で伸びる。初期は敵のアグロ圏内でしか
    // 攻撃できない(近づかないと届かない)。
    R.rangeCapPx = 68 * (R.stats.range || 1);

    Quest.tick(dt);   // 防衛クエストの進行
    director(dt);
    rebuildFoeGrid();   // 湧いた直後の敵も近傍グリッドに載せる(敵AI内のグリッド参照用)
    updateEnemies(dt);
    rebuildFoeGrid();   // 移動後の位置で近傍グリッドを組み直す
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

  // ---- キャラ1体ぶんの描画(Yソート描画から呼ばれる) ----
  function drawAllyUnit(g, a){
    if (a.waitAt) g.globalAlpha = 0.7;
    else if (a.joining) g.globalAlpha = 0.75;   // 合流中(無敵・非戦闘)は少し透ける
    // 攻撃モーション: 斬りかかる時は的へ踏み込み、射撃時はのけぞる反動(sinで出て戻る)
    let ax = a.x, ay = a.y;
    if (a.atkAnim > 0) {
      const lunge = Math.sin((a.atkAnim / 0.24) * Math.PI) * (a.atkBack ? -5 : 9);
      ax += Math.cos(a.atkDir) * lunge; ay += Math.sin(a.atkDir) * lunge;
    }
    // 仲間は全員統一の緑がかった色で描く ― 敵の色違い(金/紅/紫/青白)と被らず、
    // 混戦でも敵味方がひと目で分かる。大きさ(sizeMul)は敵だった時のまま
    const asz = a.def.r * 2.6 * (a.sizeMul || 1);
    Sprites.drawTinted(g, a.def.sprite, ax, ay, asz, false, '#2ea043', 0.42);
    const atop = a.def.r * (a.sizeMul || 1);
    if (a.hp < a.maxHp) drawBar(g, a.x, a.y - atop - 12, 26, a.hp / a.maxHp, '#7ee787');
    if (a.waitAt) {
      g.fillStyle = '#7ee787'; g.font = '10px sans-serif'; g.textAlign = 'center';
      g.fillText('待機中', a.x, a.y - atop - 16);
    }
    g.globalAlpha = 1;
  }

  const RANK_COLORS = [null, '#ffd766', '#f85149', '#c084fc', '#a5f3fc'];   // 色違い: 金/紅/紫/青白
  function drawEnemyUnit(g, e){
    const p = R.player;
    const sz = e.def.r * 2.6 * (e.sizeMul || 1);
    // 強化ランクは体の大きさ(sizeMul)だけで表現する。丸枠のオーラは鬱陶しいので描かない
    if (e.def.rare) {   // レアモンスターは虹色に輝く
      g.strokeStyle = 'hsl(' + ((R.time * 240) % 360) + ',95%,65%)';
      g.globalAlpha = 0.8; g.lineWidth = 3;
      g.beginPath(); g.arc(e.x, e.y + 3, e.def.r + 7 + Math.sin(R.time * 6) * 2, 0, 7); g.stroke();
      g.globalAlpha = 1;
    }
    if (e.flash > 0) { g.globalAlpha = 0.6; }
    if (e.rank > 0) Sprites.drawTinted(g, e.def.sprite, e.x, e.y, sz, e.x > p.x, RANK_COLORS[e.rank], 0.4);
    else Sprites.draw(g, e.def.sprite, e.x, e.y, sz, e.x > p.x);
    g.globalAlpha = 1;
    if (R.time < e.frozenUntil) {
      g.fillStyle = 'rgba(118,227,234,.4)';
      g.beginPath(); g.arc(e.x, e.y, e.def.r + 4, 0, 7); g.fill();
    }
    // HPゲージはボスも含め全モンスター共通仕様(頭上に表示。通常敵は一定幅、ボスは体の大きさぶん)
    if (e.hp < e.maxHp) {
      const bw = e.boss ? Math.max(48, e.def.r * (e.sizeMul || 1) * 1.3) : 28;
      drawBar(g, e.x, e.y - e.def.r * (e.sizeMul || 1) - 12, bw, e.hp / e.maxHp, '#f85149');
    }
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

  function drawPlayerUnit(g, p){
    if (p.invuln > 0 && Math.floor(R.time * 12) % 2 === 0) g.globalAlpha = 0.4;
    if (p.onBoat) Sprites.draw(g, 'boat', p.x, p.y, 52, p.dir < 0);
    else Sprites.draw(g, 'player', p.x, p.y, 52, p.dir < 0);
    g.globalAlpha = 1;
    // シールド表示
    if (R.shield.stocks > 0) {
      g.strokeStyle = 'rgba(88,166,255,.7)'; g.lineWidth = 2 + R.shield.stocks;
      g.beginPath(); g.arc(p.x, p.y, 24, 0, 7); g.stroke();
    }
  }

  function draw(g, W, H){
    const p = R.player;
    R.viewMin = Math.min(W, H);
    const z = R.zoom || 1;
    const effW = W / z, effH = H / z;
    const camX = p.x - effW/2, camY = p.y - effH/2;
    R.offscreenR = Math.hypot(effW, effH) / 2 + 140;   // これより遠い敵は「見切れた」扱い
    R.viewHalfW = effW / 2; R.viewHalfH = effH / 2;    // 発見判定用: 実際に画面に映っている範囲

    // 描画カリング: 画面(+余白)に映っている敵・仲間だけ描く。
    // 追跡中の敵は画面から3200pxまで生存するため、無条件に全描画すると
    // 見えない敵に描画時間を食われる ― 大群戦で効く
    const cullL = camX - 140, cullRt = camX + effW + 140;
    const cullT = camY - 160, cullB = camY + effH + 140;
    const visFoes = [];
    for (const e of R.enemies) {
      if (e.x > cullL && e.x < cullRt && e.y > cullT && e.y < cullB) visFoes.push(e);
    }
    const visAllies = [];
    for (const a of R.allies) {
      if (a.x > cullL && a.x < cullRt && a.y > cullT && a.y < cullB) visAllies.push(a);
    }

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
        else if (ti.t === 'sea') { const sb = DATA.SEA_BIOMES[ti.sea] || DATA.SEA_BIOMES.open;
          c = (chk !== (waveT === 1)) ? sb.c1 : sb.c2;
          if (chk && World.currentAt(wx, wy) > 0.45) decoList.push({ x:wx + 6, y:wy + 10, cur:true }); }
        else { const sb = DATA.SEA_BIOMES[ti.sea] || DATA.SEA_BIOMES.open;
          c = (chk !== (waveT === 1)) ? sb.d1 : sb.d2; }
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
      if (d.cur) {   // 海流の筋(流れの向きに走る白い線)
        g.strokeStyle = 'rgba(230,237,243,0.28)'; g.lineWidth = 1.5;
        const fx = Math.sin(d.y * 0.0007) * 8;
        g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.x + 18 + fx, d.y + 6); g.stroke();
        continue;
      }
      g.fillStyle = d.c;
      g.globalAlpha = 0.5;
      if (d.big) { g.beginPath(); g.arc(d.x, d.y, 3, 0, 7); g.fill(); }
      else g.fillRect(d.x, d.y, 2.5, 2.5);
    }
    g.globalAlpha = 1;
    // 影(ユニットの足元)。画面内のユニットのみ。
    // 超過密(合戦)時は通常サイズの影を省く ― 体が折り重なって影は見えないため
    // 見た目はほぼ変わらず、楕円パス生成のコストだけが消える(ボス・巨体は描く)
    g.fillStyle = 'rgba(0,0,0,.25)';
    const shadowLod = visFoes.length + visAllies.length > 420;
    for (const e of visFoes) {
      if (shadowLod && !e.boss && (e.sizeMul || 1) < 1.5) continue;
      g.beginPath(); g.ellipse(e.x, e.y + e.def.r * (e.sizeMul||1) * 0.9, e.def.r * (e.sizeMul||1) * 0.8, 4, 0, 0, 7); g.fill();
    }
    for (const a of visAllies) {
      if (a.waitAt || (shadowLod && (a.sizeMul || 1) < 1.5)) continue;
      g.beginPath(); g.ellipse(a.x, a.y + a.def.r * 0.9, a.def.r * 0.7, 3.5, 0, 0, 7); g.fill();
    }
    g.beginPath(); g.ellipse(p.x, p.y + 20, 16, 5, 0, 0, 7); g.fill();

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
      g.beginPath(); g.arc(p.x, p.y, feD.radius * R.stats.area, 0, 7); g.stroke();
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

    // 基地から延びる小道と名所(井戸)。道の上を行商人が歩いている
    for (const b of World.bases) {
      if (Math.abs(R.player.x - b.x) > 5200 || Math.abs(R.player.y - b.y) > 5200) continue;
      const rd = World.roadOf(b.id);
      if (!rd) continue;
      g.fillStyle = 'rgba(139,115,85,0.42)';
      const segs = 26;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const rx = rd.x1 + (rd.x2 - rd.x1) * t + Math.sin(t * 9 + b.x) * 22;
        const ry = rd.y1 + (rd.y2 - rd.y1) * t + Math.cos(t * 7 + b.y) * 22;
        g.beginPath(); g.ellipse(rx, ry, 26, 18, 0, 0, 7); g.fill();
      }
      Sprites.draw(g, 'ob_well', rd.x2, rd.y2, 40);
      const pp = peddlerPos(b);
      if (pp) {
        Sprites.draw(g, 'npc_scholar', pp.x, pp.y - 6, 30);
        g.fillStyle = '#e6edf3'; g.font = '10px sans-serif'; g.textAlign = 'center';
        g.fillText('行商人', pp.x, pp.y - 28);
      }
    }
    // 訪問依頼の目的地: 実体のある目印(石積みの標)を立てる。📍だけの何もない空き地にしない
    // (「測量点を調べてきた」「墓標に祈った」が、実際にそこに在るものへの行動になる)
    for (const vt of Quest.visitTargets()) {
      if (vt.t === 'mark') continue;   // 指名討伐は敵そのものが現れる(標は立てない)
      if (Math.abs(vt.x - R.player.x) > 1500 || Math.abs(vt.y - R.player.y) > 1000) continue;
      g.fillStyle = '#57606a';
      g.beginPath(); g.ellipse(vt.x, vt.y + 9, 17, 7, 0, 0, 7); g.fill();
      g.fillStyle = '#768390';
      g.beginPath(); g.ellipse(vt.x - 6, vt.y + 3, 8, 6, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(vt.x + 6, vt.y + 2, 7, 6, 0, 0, 7); g.fill();
      g.fillStyle = '#adbac7';
      g.beginPath(); g.ellipse(vt.x, vt.y - 6, 7, 9, 0, 0, 7); g.fill();
      if (vt.label) {
        g.fillStyle = '#e6edf3'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center';
        g.fillText(vt.label, vt.x, vt.y - 22);
      }
    }
    // 護送中のNPC
    if (R.escort && R.escort.state === 'go') {
      Sprites.draw(g, R.escort.spr, R.escort.x, R.escort.y, 30);
      drawBar(g, R.escort.x, R.escort.y - 26, 30, R.escort.hp / R.escort.maxHp, '#7ee787');
      g.fillStyle = '#7ee787'; g.font = '10px sans-serif'; g.textAlign = 'center';
      g.fillText('護衛中', R.escort.x, R.escort.y - 32);
    }
    // 色違い(弾ける)の爆発予兆
    for (const tb of (R.traitBursts || [])) {
      g.strokeStyle = 'rgba(248,81,73,' + (0.4 + 0.5 * Math.sin(R.time * 20)) + ')';
      g.lineWidth = 2.5;
      g.beginPath(); g.arc(tb.x, tb.y, tb.r, 0, 7); g.stroke();
    }

    // 灯台の光: 港の灯りは夜通し回っていて、長い光の筋が地を掃く。
    // 海岸や海から光の筋を「目で見て」港を見つけるための目印(地図やテキストに頼らない)
    const lighthouses = World.ports.slice();
    { const wl = World.bases.find(b => b.id === 'b_white'); if (wl) lighthouses.push(wl); }
    for (const lh of lighthouses) {
      const ld = Math.hypot(lh.x - p.x, lh.y - p.y);
      if (ld > 3800) continue;
      const la = R.time * 0.4 + (lh.angle !== undefined ? lh.angle * 3.7 : 1.3);
      const beamLen = 3000;
      g.save();
      g.globalCompositeOperation = 'lighter';
      // 港全体のほのかな灯り(光条の合間でも「あそこに何かある」と分かる)
      const amb = g.createRadialGradient(lh.x, lh.y, 10, lh.x, lh.y, 260);
      amb.addColorStop(0, 'rgba(255,224,130,0.20)');
      amb.addColorStop(1, 'rgba(255,224,130,0)');
      g.fillStyle = amb;
      g.beginPath(); g.arc(lh.x, lh.y, 260, 0, 7); g.fill();
      // 対の光条(灯台の双眼レンズ): 反対向きの2本が回る
      const grad = g.createRadialGradient(lh.x, lh.y, 24, lh.x, lh.y, beamLen);
      grad.addColorStop(0, 'rgba(255,236,160,0.42)');
      grad.addColorStop(0.5, 'rgba(255,236,160,0.15)');
      grad.addColorStop(1, 'rgba(255,236,160,0)');
      g.fillStyle = grad;
      for (const ba of [la, la + Math.PI]) {
        g.beginPath();
        g.moveTo(lh.x, lh.y);
        g.arc(lh.x, lh.y, beamLen, ba - 0.085, ba + 0.085);
        g.closePath(); g.fill();
      }
      // 灯室の明かり
      g.fillStyle = 'rgba(255,236,160,' + (0.5 + 0.2 * Math.sin(R.time * 3 + lh.x)) + ')';
      g.beginPath(); g.arc(lh.x, lh.y - 30, 7, 0, 7); g.fill();
      g.restore();
    }
    // 集落の炊事の煙: 村や基地からは煙の柱が高く立ちのぼり、風で横に流れる。
    // 画面(±290×±160程度)の何倍もの規模で描く ― 数画面離れていても目に入る目印
    for (const b of World.bases) {
      if (Math.abs(b.x - p.x) > 3400 || Math.abs(b.y - p.y) > 3400) continue;
      for (let i = 0; i < 7; i++) {
        const ph = (R.time * 0.04 + i * 0.143 + (b.x % 7) * 0.1) % 1;
        const sx = b.x + 20 + Math.sin(ph * 8 + i * 2) * 26 + ph * 420;   // 風に流れる
        const sy = b.y - 44 - ph * 1500;
        g.fillStyle = 'rgba(206,212,220,' + ((1 - ph) * 0.34).toFixed(3) + ')';
        g.beginPath(); g.arc(sx, sy, 12 + ph * 60, 0, 7); g.fill();
      }
    }

    // 港町・基地・停泊船
    for (const port of World.ports) {
      // 港は船着き場だけでなく小さな港町: 内陸側に家々、桟橋のそばに積み荷
      const pa = Math.atan2(port.y - port.seaY, port.x - port.seaX);   // 海→陸の向き
      const ix = Math.cos(pa), iy = Math.sin(pa);
      Sprites.draw(g, 'ob_house',  port.x + ix * 95 - 42, port.y + iy * 95 - 18, 52);
      Sprites.draw(g, 'ob_house2', port.x + ix * 125 + 46, port.y + iy * 125 + 8, 48);
      Sprites.draw(g, 'ob_crate', port.x + 24, port.y + 26, 22);
      Sprites.draw(g, 'ob_crate', port.x - 32, port.y + 18, 18);
      Sprites.draw(g, 'ob_dock', port.x, port.y, 56);
      Sprites.draw(g, 'npc_sailor', port.x + 36, port.y - 14, 30);
      if (SaveSys.data.ports[port.id]) {   // 修理済みの港町には貿易商が店を開く
        Sprites.draw(g, 'ob_crate', port.x - 132, port.y + 42, 20);
        Sprites.draw(g, 'npc_scholar', port.x - 118, port.y + 28, 30);
        g.fillStyle = '#c9d1d9'; g.font = '10px sans-serif'; g.textAlign = 'center';
        g.fillText('貿易商', port.x - 118, port.y + 8);
      }
      if (SaveSys.data.ports[port.id]) Sprites.draw(g, 'boat', port.seaX, port.seaY, 44);
      else Sprites.draw(g, 'ob_wreck', port.seaX, port.seaY, 44);
      g.fillStyle = '#e6edf3'; g.font = '11px sans-serif'; g.textAlign = 'center';
      g.fillText((SaveSys.data.ports[port.id] ? '⚓ ' : '🛠 ') + port.name, port.x, port.y - 34);
    }
    for (const b of World.bases) {
      const un = SaveSys.data.bases[b.id];
      // 周回マップ上の基地は「特色に合わせた転移シンボル」だけ。
      // 村の暮らし・住民・依頼は、転移した先の基地マップにある。
      Sprites.draw(g, b.spr || 'st_warp', b.x, b.y, 78);
      if (un) {
        g.strokeStyle = 'rgba(88,166,255,.5)'; g.lineWidth = 2;
        g.beginPath(); g.arc(b.x, b.y, 150, 0, 7); g.stroke();
      }
      g.fillStyle = un ? '#7ee787' : '#c9d1d9'; g.font = '11px sans-serif'; g.textAlign = 'center';
      g.fillText((un ? '✦ ' : '') + b.name + (b.kind ? '〈' + b.kind + '〉' : ''), b.x, b.y - 54);
      // 中に用事(未解放クエスト・報告・住民の依頼)があれば ❗
      if (baseHasBusiness(b)) {
        g.fillStyle = '#ffd766'; g.font = 'bold 15px sans-serif';
        g.fillText('❗', b.x + 30, b.y - 30);
      }
    }
    if (p.boatAnchor) Sprites.draw(g, 'boat', p.boatAnchor.x, p.boatAnchor.y, 44);

    // ピックアップ
    for (const pk of R.pickups) {
      const bob = Math.sin(pk.t * 5) * 3;
      if (pk.type === 'coin') Sprites.draw(g, 'coin', pk.x, pk.y + bob, 22);
      else if (pk.type === 'potion') Sprites.draw(g, 'potion', pk.x, pk.y + bob, 26);
      else Sprites.draw(g, 'mat_' + pk.mat, pk.x, pk.y + bob, 26);   // 素材は大きく(光らせない)
    }

    // タレット
    const tu = wstat('turret');
    for (const t of R.turrets) {
      Sprites.draw(g, 'sk_turret', t.x, t.y, 30);
    }

    // レイヤー順: [主人公+仲間](同じレイヤーでYソート) → 敵。
    // 同じレイヤー内では手前(画面の下)にいるキャラが上に重なる
    const friendly = visAllies.sort((A, B) => A.y - B.y);
    let pDrawn = false;
    for (const a of friendly) {
      if (!pDrawn && p.y <= a.y) { drawPlayerUnit(g, p); pDrawn = true; }
      drawAllyUnit(g, a);
    }
    if (!pDrawn) drawPlayerUnit(g, p);
    const enemySorted = visFoes.sort((A, B) => A.y - B.y);
    for (const e of enemySorted) drawEnemyUnit(g, e);

    // オービット描画
    const ob = wstat('orbit');
    if (ob) {
      for (let i = 0; i < ob.count; i++) {
        const a = (R.orbitA || 0) + i / ob.count * Math.PI * 2;
        const ox = p.x + Math.cos(a) * ob.radius * R.stats.area;
        const oy = p.y + Math.sin(a) * ob.radius * R.stats.area;
        // ベタ塗りの丸ではなく「光る魔法のオーブ」: 白い核から紫へ、外は淡く発光
        const og = g.createRadialGradient(ox - ob.size * 0.25, oy - ob.size * 0.25, 1, ox, oy, ob.size * 1.35);
        og.addColorStop(0, '#ffffff');
        og.addColorStop(0.35, '#d8b4fe');
        og.addColorStop(0.8, 'rgba(160,90,240,0.55)');
        og.addColorStop(1, 'rgba(160,90,240,0)');
        g.fillStyle = og;
        g.beginPath(); g.arc(ox, oy, ob.size * 1.35, 0, 7); g.fill();
        g.strokeStyle = 'rgba(216,180,254,0.8)'; g.lineWidth = 1.5;
        g.beginPath(); g.arc(ox, oy, ob.size * 0.85, 0, 7); g.stroke();
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
    // 深海圏: 何もない沖へ出るほど、海と空気が深く暗く沈む(テキストなしの体感警告)。
    // 画面中央と四辺で深さを測り、濃くなる方向へ滑らかなグラデーションをかける
    {
      const vf = World.voidFactorAt;
      const fc = vf(p.x, p.y);
      const fxp = vf(p.x + effW / 2, p.y), fxm = vf(p.x - effW / 2, p.y);
      const fyp = vf(p.x, p.y + effH / 2), fym = vf(p.x, p.y - effH / 2);
      const fmax = Math.max(fc, fxp, fxm, fyp, fym);
      if (fmax > 0.02) {
        const alpha = (f) => Math.max(0, Math.min(0.62, f * 0.085));
        const gx = (fxp - fxm) / 2, gy = (fyp - fym) / 2;
        const gl = Math.hypot(gx, gy);
        if (gl < 0.05) {
          g.fillStyle = `rgba(4,3,14,${alpha(fc).toFixed(3)})`;
          g.fillRect(0, 0, W, H);
        } else {
          const ux = gx / gl, uy = gy / gl;
          const lg = g.createLinearGradient(W/2 - ux * W/2, H/2 - uy * H/2, W/2 + ux * W/2, H/2 + uy * H/2);
          lg.addColorStop(0, `rgba(4,3,14,${alpha(fc - gl).toFixed(3)})`);
          lg.addColorStop(1, `rgba(4,3,14,${alpha(fc + gl).toFixed(3)})`);
          g.fillStyle = lg;
          g.fillRect(0, 0, W, H);
        }
      }
    }
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

    // 被弾方向のフラッシュ(どっちから殴られたかが分かる)
    if (R.hitFlashT > 0) {
      const a = Math.min(0.4, R.hitFlashT * 1.3);
      if (R.hitDir === null) {
        g.fillStyle = `rgba(248,81,73,${a * 0.5})`;
        g.fillRect(0, 0, W, H);
      } else {
        const cx2 = W / 2 + Math.cos(R.hitDir) * W * 0.55, cy2 = H / 2 + Math.sin(R.hitDir) * H * 0.55;
        const gr = g.createRadialGradient(cx2, cy2, 40, cx2, cy2, Math.max(W, H) * 0.6);
        gr.addColorStop(0, `rgba(248,81,73,${a})`);
        gr.addColorStop(1, 'rgba(248,81,73,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, W, H);
      }
    }
    // 越境の演出: その土地の色の粒子が画面を流れる
    if (R.bioFxT > 0 && R.bioFxColors) {
      const life = R.bioFxT / 2.4;
      for (let i = 0; i < 26; i++) {
        const sd = (i * 137.5) % 1;
        const px2 = ((sd * 7919 + R.time * (30 + sd * 60)) % (W + 40)) - 20;
        const py2 = ((sd * 104729) % H + Math.sin(R.time * 2 + i) * 30 + H) % H;
        g.globalAlpha = Math.min(0.7, life) * (0.4 + sd * 0.6);
        g.fillStyle = R.bioFxColors[i % R.bioFxColors.length];
        g.beginPath(); g.arc(px2, py2, 1.5 + sd * 2.5, 0, 7); g.fill();
      }
      g.globalAlpha = 1;
    }

    // ボスのHPと名前は頭上に表示(他のモンスターと同じ仕様)。専用の上部バーは廃止

    drawMinimap(g, W);
    drawFullMap(g, W, H);   // 全画面の全体図(開いている時のみ)
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

  // 地図の描画本体(小さな周辺図・全画面の全体図で共用)。mk=マーカー拡大率
  function drawMapInto(g, x0, y0, sz, mode){
    const view = World.minimapView(R.player.x, R.player.y, mode);
    g.globalAlpha = 0.92;
    g.drawImage(view.img, view.sx, view.sy, view.sw, view.sw, x0, y0, sz, sz);
    // 霧: 行ったことのある場所だけ地形が見える(ヒントの「?」は霧の上に描くので見える)
    g.drawImage(World.fogCanvas(), view.sx, view.sy, view.sw, view.sw, x0, y0, sz, sz);
    g.globalAlpha = 1;
    g.strokeStyle = '#30363d'; g.strokeRect(x0, y0, sz, sz);
    const mmScale = sz / World.MM_SIZE;
    const mk = Math.max(1, sz / 180);   // 全画面ではマーカーも大きく
    const dot = (wx, wy, c, r) => {
      if (!view.inView(wx, wy)) return;
      const q = view.toMM(wx, wy);
      if (q.x < 0 || q.x > World.MM_SIZE || q.y < 0 || q.y > World.MM_SIZE) return;
      g.fillStyle = c;
      g.beginPath(); g.arc(x0 + q.x * mmScale, y0 + q.y * mmScale, (r || 2) * mk, 0, 7); g.fill();
    };
    // 敵の分布: 黒塗りから解放した(探索済みの)場所にだけ、最後に見た敵位置を小さく表示。
    // 離れて間引かれた敵も情報だけ残してあるので、行った場所の敵の居どころが分かる。
    if (R.foeMap) for (const v of R.foeMap.values()) {
      if (!World.isExplored(v.x, v.y)) continue;
      if (!view.inView(v.x, v.y)) continue;
      const q = view.toMM(v.x, v.y);
      if (q.x < 0 || q.x > World.MM_SIZE || q.y < 0 || q.y > World.MM_SIZE) continue;
      const fade = Math.max(0.28, 1 - (R.time - v.t) / 90);
      g.globalAlpha = fade;
      g.fillStyle = v.boss ? '#ffb000' : '#f85149';
      g.beginPath(); g.arc(x0 + q.x * mmScale, y0 + q.y * mmScale, (v.boss ? 2.6 : 1.4) * mk, 0, 7); g.fill();
      g.globalAlpha = 1;
    }
    // 基地・港は「発見済み」か「解放済み」だけ表示(行くまでわからない)。
    // 場所を知る手段は物語のヒント(?)・visit依頼の📍・実際に画面で見ること、だけ。
    // 見つけた場所は霧の上でもはっきり見える印+全体図では名前つき
    const marker = (wx, wy, c, r, label) => {
      if (!view.inView(wx, wy)) return;
      const q = view.toMM(wx, wy);
      if (q.x < 0 || q.x > World.MM_SIZE || q.y < 0 || q.y > World.MM_SIZE) return;
      const mx = x0 + q.x * mmScale, my = y0 + q.y * mmScale;
      g.fillStyle = c;
      g.strokeStyle = '#0b0f1a'; g.lineWidth = Math.max(1, 1.2 * mk);
      g.beginPath(); g.arc(mx, my, (r || 3.5) * mk, 0, 7); g.fill(); g.stroke();
      if (label && mode === 'world') {
        g.font = 'bold ' + Math.round(8.5 * mk) + 'px sans-serif'; g.textAlign = 'center';
        g.fillStyle = '#0b0f1a'; g.fillText(label, mx + 1, my - 5.5 * mk + 1);   // 影(霧の上でも読める)
        g.fillStyle = c; g.fillText(label, mx, my - 5.5 * mk);
      }
    };
    const seen = SaveSys.data.seen || {};
    const hintSet = Object.assign({}, SaveSys.data.hints || {});
    if (SaveSys.data.nextHint) hintSet[SaveSys.data.nextHint] = true;
    const hints = [];
    for (const b of World.bases) {
      if (SaveSys.data.bases[b.id]) marker(b.x, b.y, '#7ee787', 4, '✦' + b.name);
      else if (seen[b.id]) marker(b.x, b.y, '#c9d1d9', 3.5, b.name);   // 実際に見つけた場所は正確な印
      else if (hintSet[b.id]) hints.push(b);   // 聞いただけの場所は見当(?)。最後に大きく描く
    }
    for (const port of World.ports) {
      if (SaveSys.data.ports[port.id]) marker(port.x, port.y, '#76e3ea', 4, '⚓' + port.name);
      else if (seen[port.id]) marker(port.x, port.y, '#d29922', 3.5, '⚓' + port.name);
      else if (hintSet[port.id]) hints.push(port);
    }
    if (R.player.boatAnchor) marker(R.player.boatAnchor.x, R.player.boatAnchor.y, '#b08968', 4, '船');
    // 進行中のvisit依頼の目的地(📍): ここへ行くと自然と新しい場所が見つかる
    for (const t of Quest.visitTargets()) {
      if (!view.inView(t.x, t.y)) continue;
      const q = view.toMM(t.x, t.y);
      if (q.x < 0 || q.x > World.MM_SIZE || q.y < 0 || q.y > World.MM_SIZE) continue;
      g.fillStyle = '#ff7b72'; g.font = 'bold ' + Math.round(10 * mk) + 'px sans-serif'; g.textAlign = 'center';
      g.fillText('📍', x0 + q.x * mmScale, y0 + q.y * mmScale + 3);
    }
    dot(R.player.x, R.player.y, '#fff', 3.5);
    // 拠点ヒント: 話に聞いただけの場所は「おおよその見当」。正確な位置ではなく
    // 少しずれた所に?を描く ― 現地では煙や灯台の光を目で探して見つける
    const pulse = 0.65 + 0.35 * Math.sin(R.time * 5);
    for (const b of hints) {
      const off = hintOffset(b.id);
      const bx = b.x + off.x, by = b.y + off.y;
      if (!view.inView(bx, by)) continue;
      const q = view.toMM(bx, by);
      if (q.x < 0 || q.x > World.MM_SIZE || q.y < 0 || q.y > World.MM_SIZE) continue;
      const hx = x0 + q.x * mmScale, hy = y0 + q.y * mmScale, hr = 8 * mk;
      const isPort = !!b.repair;   // 港エントリはrepairを持つ
      g.globalAlpha = pulse; g.fillStyle = isPort ? '#76e3ea' : '#ffd766';
      g.beginPath(); g.arc(hx, hy, hr, 0, 7); g.fill();
      g.globalAlpha = 1;
      g.lineWidth = Math.max(1.5, 2 * mk); g.strokeStyle = isPort ? '#062a2e' : '#3d2b00';
      g.beginPath(); g.arc(hx, hy, hr, 0, 7); g.stroke();
      g.fillStyle = isPort ? '#062a2e' : '#3d2b00'; g.font = 'bold ' + Math.round(11 * mk) + 'px sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(isPort ? '⚓' : '?', hx, hy + 0.5);
      g.textBaseline = 'alphabetic';
    }
  }
  // 「聞いただけの場所」の地図上の見当のずらし幅(場所ごとに決まった方向へ350〜650ずれる)。
  // 画面に映る範囲(±290×±160程度)に対して「数画面ぶん探せば必ず見つかる」広さに収める ―
  // 見当の地点に着いたら、煙・灯台の光を目で探して確定させる
  function hintOffset(id){
    let h = 0;
    for (let i = 0; i < id.length; i++) h = ((h * 131) + id.charCodeAt(i)) >>> 0;
    const ang = (h % 628) / 100;
    const dist = 350 + (h % 300);
    return { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist };
  }
  function drawMinimap(g, W){
    // マップは最初から所持している
    const sz = Math.min(World.MM_SIZE, Math.floor(W * 0.34));
    const x0 = W - sz - 10, y0 = 10;
    drawMapInto(g, x0, y0, sz, 'local');   // ミニマップは周辺図のみ
    g.fillStyle = '#8b949e'; g.font = '10px sans-serif'; g.textAlign = 'center';
    g.fillText('周辺図 [タップで全体図]', x0 + sz / 2, y0 + sz + 12);
  }
  // タップで開く全画面の全体図
  function drawFullMap(g, W, H){
    if (!R.mapFull) return;
    g.fillStyle = 'rgba(5,8,14,0.85)'; g.fillRect(0, 0, W, H);
    const sz = Math.min(W, H) - 56;
    const x0 = (W - sz) / 2, y0 = (H - sz) / 2;
    drawMapInto(g, x0, y0, sz, 'world');
    g.fillStyle = '#c9d1d9'; g.font = 'bold 15px sans-serif'; g.textAlign = 'center';
    g.fillText('全体図 [タップで閉じる]', W / 2, y0 + sz + 28);
    // 見当ピンの読み方(ヒントを持っている間だけ表示。場所は教えず「探し方」だけ教える)
    if (Object.keys(SaveSys.data.hints || {}).length || SaveSys.data.nextHint) {
      g.fillStyle = 'rgba(5,8,14,0.72)';
      g.fillRect(x0, y0 + sz - 26, sz, 26);
      g.fillStyle = '#adbac7'; g.font = '12px sans-serif';
      g.fillText('?・⚓は聞いた話の見当。近くの煙や灯台の光が目印', W / 2, y0 + sz - 9);
    }
  }
  function toggleMap(){ R.mapFull = !R.mapFull; }
  // ミニマップ/全体図のタップ処理(処理したらtrue)
  function tapMap(cx, cy, W){
    if (R.mapFull) { R.mapFull = false; return true; }   // 全画面はどこをタップしても閉じる
    const sz = Math.min(World.MM_SIZE, Math.floor(W * 0.34));
    if (cx > W - sz - 10 && cy < sz + 24) { R.mapFull = true; return true; }
    return false;
  }

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
    // スキルボタン: 今その場で取得/強化できるスキルがある限り光り、数を表示する
    const rc = Skills.readyCount();
    const skBtn = document.getElementById('btn-skill');
    skBtn.classList.toggle('ready', rc > 0);
    document.getElementById('skill-badge').textContent = rc > 0 ? rc : '';
    // マップ内クエストの目標表示
    const qObj = document.getElementById('quest-obj');
    if (Quest.hasActive()) {
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
    if (R.settled) return R.settled;   // 二重精算(コイン二重加算)の防止
    const s = SaveSys.data;
    // 保管庫(研究所): 高ティアの素材から次の周回へ持ち越す。残りは換金
    const mats = Skills.mats();
    const stashCap = SaveSys.metaLv('m_stash') * 4;
    if (stashCap > 0) {
      const keep = {};
      let left = stashCap;
      const order = Object.keys(mats).filter(m => mats[m] > 0)
        .sort((a, b) => (DATA.MATERIALS[b].tier || 0) - (DATA.MATERIALS[a].tier || 0));
      for (const m of order) {
        if (!left) break;
        const k = Math.min(mats[m], left);
        keep[m] = k; mats[m] -= k; left -= k;
      }
      s.stash = keep;
    }
    // 余り素材はお金に変換
    let matBonus = 0;
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
    // 死因リキャップ: 直前10秒に受けたダメージの内訳(何にやられたか分かるように)
    let recap = null;
    if (!retired && (R.dmgLog || []).length) {
      const recent = R.dmgLog.filter(l => R.time - l.t < 10);
      const by = {};
      for (const l of recent) by[l.name] = (by[l.name] || 0) + l.d;
      recap = { killer: R.dmgLog[R.dmgLog.length - 1].name,
                list: Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 3) };
    }
    R.settled = { coins:R.coins, matBonus, total, time:R.time, kills:R.kills,
                  recruits:R.recruits, retired, dist:Math.round(R.maxDist), newAchs, recap };
    return R.settled;
  }

  return { start, update, draw, updateHud, doInteract, finishRun, toggleMap, tapMap, openTrade,
           warcry, startEscort, escortState, hasMark, spawnMark, spawnQuestWave,
           get state(){ return R; } };
})();
