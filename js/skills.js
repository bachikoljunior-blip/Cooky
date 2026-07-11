// =============================================================
// skills.js - 周回内スキルシステム + スキルパネルUI
//   ・素材を集めるとスキルリストに出現(集めるまで非表示)
//   ・取得後も素材リストが更新され、集めて再取得するとレベルUP
// =============================================================
'use strict';

const Skills = (() => {
  let owned = {};   // id -> lv
  let mats = {};    // mat -> count

  function reset(){
    owned = { bolt: 1 };
    mats = {};
    // 出撃支度: 基本素材を持って開始
    const s = SaveSys.metaLv('lab_starter');
    if (s > 0) for (const m of ['jelly','bone','hide','wood']) mats[m] = s * 2;
  }

  function cap(){ return Math.min(DATA.SKILL_CAP_MAX, DATA.SKILL_BASE_CAP + SaveSys.metaLv('lib_cap')); }
  function lv(id){ return owned[id] || 0; }
  function stat(id){ const l = lv(id); return l > 0 ? DATA.SKILLS[id].stats(l) : null; }
  function matCount(m){ return mats[m] || 0; }
  function addMat(m, n){ mats[m] = (mats[m] || 0) + (n || 1); }
  function matUnlocked(m){
    const def = DATA.MATERIALS[m];
    return !def.unlock || SaveSys.metaLv(def.unlock) > 0;
  }
  function skillUnlocked(id){
    const def = DATA.SKILLS[id];
    return def.innate || !def.unlock || SaveSys.metaLv(def.unlock) > 0;
  }

  // 次レベルの素材コスト(上限到達なら null)
  function nextCost(id){
    const l = lv(id);
    if (l >= cap()) return null;
    return DATA.SKILLS[id].cost(l + 1);
  }
  function costMet(cost){
    for (const m in cost) if (matCount(m) < cost[m]) return false;
    return true;
  }
  // 表示条件: 所持済み or 必要素材のどれかを1つ以上持っている
  function revealed(id, cost){
    if (lv(id) > 0) return true;
    for (const m in cost) if (matCount(m) > 0) return true;
    return false;
  }

  function acquire(id){
    const cost = nextCost(id);
    if (!cost || !costMet(cost)) return false;
    for (const m in cost) mats[m] -= cost[m];
    owned[id] = lv(id) + 1;
    Sfx.skill();
    return true;
  }

  // ---------------- パネルUI ----------------
  const panel = document.getElementById('skill-panel');
  const listEl = document.getElementById('skill-list');
  const ownedEl = document.getElementById('skill-owned');

  function costHtml(cost){
    let h = '<div class="cost-line">';
    for (const m in cost) {
      const have = matCount(m), need = cost[m];
      const md = DATA.MATERIALS[m];
      h += `<span class="cost-item ${have >= need ? 'ok' : 'ng'}">
        <span class="mat-dot" style="background:${md.color}"></span>${md.name} ${have}/${need}</span>`;
    }
    return h + '</div>';
  }

  function render(){
    // 所持スキル一覧
    let oh = '';
    for (const id in owned) {
      oh += `<span class="owned-chip">${DATA.SKILLS[id].name} Lv${owned[id]}</span>`;
    }
    ownedEl.innerHTML = oh || '<span class="small">まだスキルなし</span>';

    // 取得可能・進行中
    const ready = [], progress = [], maxed = [];
    for (const id in DATA.SKILLS) {
      if (!skillUnlocked(id)) continue;
      const cost = nextCost(id);
      if (cost === null) { if (lv(id) > 0) maxed.push(id); continue; }
      if (!revealed(id, cost)) continue;
      (costMet(cost) ? ready : progress).push({ id, cost });
    }

    let h = '';
    const card = (e, isReady) => {
      const def = DATA.SKILLS[e.id];
      const l = lv(e.id);
      const nextTxt = l === 0 ? def.desc : ('Lv' + (l+1) + ': ' + (def.lvText[l-1] || '強化'));
      const iconUrl = Sprites.get(def.icon).toDataURL ? Sprites.get(def.icon).toDataURL() : '';
      return `<div class="skill-card ${isReady ? 'ready' : ''}">
        <img class="icon" src="${iconUrl}" alt="">
        <div class="info">
          <div class="name">${def.name} ${l > 0 ? 'Lv' + l + ' → Lv' + (l+1) : '<span class="small">(新規)</span>'}</div>
          <div class="desc">${nextTxt}</div>
          ${costHtml(e.cost)}
        </div>
        ${isReady ? `<button class="buy-btn" data-skill="${e.id}">${l > 0 ? 'レベルUP' : '取得'}</button>` : ''}
      </div>`;
    };
    if (ready.length) {
      h += '<div class="sec-head">✦ 素材が揃った!</div>';
      for (const e of ready) h += card(e, true);
    }
    if (progress.length) {
      h += '<div class="sec-head">素材あつめ中…</div>';
      for (const e of progress) h += card(e, false);
    }
    if (maxed.length) {
      h += '<div class="sec-head">上限到達(書庫で上限解放可能)</div>';
      for (const id of maxed) h += `<div class="skill-card"><div class="info"><div class="name">${DATA.SKILLS[id].name} Lv${lv(id)} (MAX)</div></div></div>`;
    }
    if (!h) h = '<p class="small" style="padding:20px">敵やオブジェクトを壊して素材を集めよう。素材が集まり始めたスキルがここに表示される。</p>';
    listEl.innerHTML = h;

    listEl.querySelectorAll('.buy-btn').forEach(b => {
      b.onclick = () => { if (acquire(b.dataset.skill)) render(); };
    });
  }

  function open(){ render(); panel.classList.remove('hidden'); }
  function close(){ panel.classList.add('hidden'); }
  function isOpen(){ return !panel.classList.contains('hidden'); }

  return { reset, lv, stat, cap, mats: () => mats, matCount, addMat, matUnlocked, skillUnlocked,
           nextCost, costMet, acquire, open, close, isOpen, render, get owned(){ return owned; } };
})();
