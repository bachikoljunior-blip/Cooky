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
      bases: {},                   // 解放済み基地 id -> true
      ports: {},                   // 修理済み港 id -> true
      stats: { runs:0, kills:0, bestTime:0, totalCoins:0, recruits:0, bossKills:0, reaperKills:0, maxDist:0,
               matsCollected:0, objectsDestroyed:0, skillsAcquired:0, rareKills:0, maxAlliesEver:0, deaths:0 },
      ach: {},        // 解放済み実績 id -> true
      quests2: {},    // クリア済みの2段階目クエスト id -> true
      explored: [],   // 行ったことのある場所(霧マップ用セル)
      settings: { pad:'on' },   // 移動パネル: on(スマホ標準) / off / auto
      seenHelp: false,
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
    const lv = metaLv(id);
    if (lv >= def.max) return false;
    const cost = def.cost(lv);
    if (data.coins < cost) return false;
    data.coins -= cost;
    data.meta[id] = lv + 1;
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
  };
})();
