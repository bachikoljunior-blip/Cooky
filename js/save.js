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
      stats: { runs:0, kills:0, bestTime:0, totalCoins:0, recruits:0, bossKills:0, reaperKills:0, maxDist:0 },
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

  return {
    get data(){ return data; },
    load, save, wipe, metaLv, buyMeta,
  };
})();
