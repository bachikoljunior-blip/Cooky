// =============================================================
// save.js - 永続データ (localStorage)
// =============================================================
'use strict';

const SaveSys = (() => {
  const KEY = 'cooky_survivors_v1';

  function fresh(){
    return {
      coins: 0,                    // 銀行(魂の広場で使うお金)
      meta: {},                    // メタ強化 id -> lv
      weapon: 'bolt',              // 現在の攻撃手段(武器庫で切り替え)
      weapons: { bolt: 1 },        // 所持している攻撃手段 id -> lv
      bases: {},                   // 解放済み基地 id -> true
      ports: {},                   // 修理済み港 id -> true
      stats: { runs:0, kills:0, bestTime:0, totalCoins:0, recruits:0, bossKills:0, reaperKills:0, maxDist:0,
               matsCollected:0, objectsDestroyed:0, skillsAcquired:0, rareKills:0, maxAlliesEver:0, deaths:0 },
      ach: {},        // 解放済み実績 id -> true
      quests2: {},    // クリア済みの2段階目クエスト id -> true
      questsActive: [],  // 進行中のクエスト(複数同時可・周回を跨いで保持)
      story: {},         // ストーリーフラグ(サイドクエストで進む)
      sideDone: {},      // 達成済みサイドクエスト id -> true
      nextHint: 'b_north',   // 最初からマップに一つだけ、初期以外の基地の場所を記す
      skillsRevealed: {},  // 一度リストに現れたスキル(素材が減っても・周回をまたいでも表示)
      skillPins: [],       // 一番上に固定表示するスキル(先頭ほど上)
      skillsListSeen: {},  // 一度一覧で見たスキル(未見=ピン後の新登場は最上段に出す)
      skillCatByTab: { up:'all', new:'all' },   // スキル画面のカテゴリ選択(タブごと)
      explored: [],   // 行ったことのある場所(霧マップ用セル)
      // 移動パネルの既定は auto ― 画面に触れた端末では出るが、鍵盤で遊ぶ机上の画面には
      // 使わない輪と釦が居座らない。表示/非表示に固定したい人はタイトルの足元で切り替える
      settings: { pad:'auto', mute:false },   // 移動パネル: on/off/auto、ミュートも再開後に保持
      seenHelp: false,
      introSeen: false,   // プロローグ(最初の印の基地を目指す)を見たか
    };
  }

  let data = fresh();

  function load(){
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        data = Object.assign(fresh(), d);
        data.stats = Object.assign(fresh().stats, d.stats || {});
        data.settings = Object.assign(fresh().settings, d.settings || {});
        data.weapons = Object.assign(fresh().weapons, d.weapons || {});
        if (!DATA.WEAPONS[data.weapon] || !data.weapons[data.weapon]) data.weapon = 'bolt';
      }
    } catch(e) { console.warn('save load failed', e); }
    return data;
  }
  function save(){
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch(e){}
  }
  function wipe(){ data = fresh(); save(); }

  function metaLv(id){ return data.meta[id] || 0; }
  function buyMeta(id){
    const def = DATA.META[id]; if (!def) return false;
    if (def.unlockAch && !data.ach[def.unlockAch]) return false;
    if (def.unlockBases && Object.keys(data.bases).length < def.unlockBases) return false;
    const lv = metaLv(id);
    if (lv >= def.max) return false;
    const cost = def.cost(lv);
    if (data.coins < cost) return false;
    data.coins -= cost;
    data.meta[id] = lv + 1;
    save();
    return true;
  }

  // ---- 攻撃手段(武器庫) ----
  function weaponLv(id){ return data.weapons[id] || 0; }
  function weaponMax(id){ const d = DATA.WEAPONS[id]; return d ? d.lvText.length + 1 : 0; }
  function weaponBuyable(id){
    const def = DATA.WEAPONS[id];
    if (!def || weaponLv(id) > 0) return false;
    if (def.unlockAch && !data.ach[def.unlockAch]) return false;
    if (def.requires && weaponLv(def.requires.weapon) < def.requires.lv) return false;
    return true;
  }
  function buyWeapon(id){
    const def = DATA.WEAPONS[id];
    if (!weaponBuyable(id) || data.coins < def.buy) return false;
    data.coins -= def.buy;
    data.weapons[id] = 1;
    save();
    return true;
  }
  function upWeapon(id){
    const def = DATA.WEAPONS[id];
    const lv = weaponLv(id);
    if (!def || lv < 1 || lv >= weaponMax(id)) return false;
    const c = def.up(lv);
    if (data.coins < c) return false;
    data.coins -= c;
    data.weapons[id] = lv + 1;
    save();
    return true;
  }
  function setWeapon(id){
    if (weaponLv(id) < 1) return false;
    data.weapon = id;
    save();
    return true;
  }

  // 実績判定: 新たに達成した実績のリストを返す(保存もする)
  function checkAchievements(){
    const newly = [];
    for (const a of DATA.ACHIEVEMENTS) {
      if (data.ach[a.id]) continue;
      try { if (a.cond(data)) { data.ach[a.id] = true; newly.push(a); } } catch(e){}
    }
    if (newly.length) save();
    return newly;
  }

  return {
    get data(){ return data; },
    load, save, wipe, metaLv, buyMeta, checkAchievements,
    weaponLv, weaponMax, weaponBuyable, buyWeapon, upWeapon, setWeapon,
  };
})();
