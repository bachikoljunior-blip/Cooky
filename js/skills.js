// =============================================================
// skills.js - 周回内スキルシステム + スキルパネルUI
//   ・素材を集めるとスキルリストに出現(集めるまで非表示)
//   ・取得後も素材リストが更新され、集めて再取得するとレベルUP
// =============================================================
'use strict';

const Skills = (() => {
  let owned = {};      // id -> lv
  let mats = {};       // mat -> count
  let revealed = {};   // 一度素材が揃って表示されたスキル(素材が減っても表示され続ける)
  let tab = 'new';     // 強化 up / 新規 new / 効果 info
  let cat = 'all';     // カテゴリフィルタ

  function reset(){
    owned = { bolt: 1 };
    mats = {};
    revealed = {};
    tab = 'new'; cat = 'all';
    // 出撃支度+保存術: 基本素材を持って開始
    const s = SaveSys.metaLv('lab_starter') * 2 + SaveSys.metaLv('m_preserve');
    if (s > 0) for (const m of ['jelly','bone','hide','wood']) mats[m] = s;
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
    if (def.unlockAch && !SaveSys.data.ach[def.unlockAch]) return false;   // 実績で解放
    return def.innate || !def.unlock || SaveSys.metaLv(def.unlock) > 0;
  }
  // 前提スキル: 特定スキルを育てていないと出現しないスキル
  function reqMet(id){
    const rq = DATA.SKILLS[id].requires;
    return !rq || lv(rq.skill) >= rq.lv;
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
  // 取得可能(=素材が全部揃っている)スキルの数。HUDのボタン通知に使う
  function hiddenByUser(id){
    return lv(id) === 0 && SaveSys.data.skillHidden && SaveSys.data.skillHidden[id];
  }
  function readyCount(){
    let n = 0;
    for (const id in DATA.SKILLS) {
      if (!skillUnlocked(id) || !reqMet(id) || hiddenByUser(id)) continue;
      const cost = nextCost(id);
      if (cost && costMet(cost)) n++;
    }
    return n;
  }
  // 素材が揃ったスキルを開示済みに記録(以後は素材が減っても表示され続ける)
  function refreshRevealed(){
    for (const id in DATA.SKILLS) {
      if (revealed[id] || lv(id) > 0) continue;
      if (!skillUnlocked(id) || !reqMet(id)) continue;
      const cost = nextCost(id);
      if (cost && costMet(cost)) revealed[id] = true;
    }
  }

  function acquire(id){
    if (!skillUnlocked(id) || !reqMet(id)) return false;
    const cost = nextCost(id);
    if (!cost || !costMet(cost)) return false;
    for (const m in cost) mats[m] -= cost[m];
    owned[id] = lv(id) + 1;
    SaveSys.data.stats.skillsAcquired = (SaveSys.data.stats.skillsAcquired || 0) + 1;   // 実績用
    SaveSys.data.skillsSeen = SaveSys.data.skillsSeen || {};
    SaveSys.data.skillsSeen[id] = true;   // 生涯解放記録(基地の表示設定に使う)
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

  const tabsEl = document.getElementById('skill-tabs');
  const catsEl = document.getElementById('skill-cats');

  function skillCard(id, opts = {}){
    const def = DATA.SKILLS[id];
    const l = lv(id);
    const cost = nextCost(id);
    const can = cost && costMet(cost);
    const nextTxt = l === 0 ? def.desc : (cost ? 'Lv' + (l+1) + ': ' + (def.lvText[l-1] || '強化') : '最大レベル');
    const iconUrl = Sprites.get(def.icon).toDataURL ? Sprites.get(def.icon).toDataURL() : '';
    return `<div class="skill-card ${can ? 'ready' : ''}">
      <img class="icon" src="${iconUrl}" alt="">
      <div class="info">
        <div class="name">${def.name} ${l > 0 ? 'Lv' + l + (cost ? ' → Lv' + (l+1) : ' (MAX)') : '<span class="small">(新規)</span>'}</div>
        <div class="desc">${nextTxt}</div>
        ${cost ? costHtml(cost) : ''}
      </div>
      ${cost ? `<button class="buy-btn" data-skill="${id}" ${can ? '' : 'disabled'}>${l > 0 ? 'レベルUP' : '取得'}</button>` : ''}
    </div>`;
  }

  // 効果タブ: 取得済みスキルの既存効果一覧
  function infoCard(id){
    const def = DATA.SKILLS[id];
    const l = lv(id);
    const iconUrl = Sprites.get(def.icon).toDataURL ? Sprites.get(def.icon).toDataURL() : '';
    let fx = '<div class="fx-line">Lv1: ' + def.desc + '</div>';
    for (let i = 2; i <= l; i++) fx += '<div class="fx-line">Lv' + i + ': ' + (def.lvText[i-2] || '強化') + '</div>';
    return `<div class="skill-card">
      <img class="icon" src="${iconUrl}" alt="">
      <div class="info"><div class="name">${def.name} Lv${l}</div>${fx}</div>
    </div>`;
  }

  function catCount(catKey, ids){
    return ids.filter(id => catKey === 'all' || DATA.SKILLS[id].cat === catKey)
              .filter(id => { const c = nextCost(id); return c && costMet(c); }).length;
  }

  function render(){
    refreshRevealed();
    // 対象リスト
    const upIds = [], newIds = [];
    for (const id in DATA.SKILLS) {
      if (lv(id) > 0) { upIds.push(id); continue; }
      if (!skillUnlocked(id) || !reqMet(id) || hiddenByUser(id)) continue;
      if (revealed[id]) newIds.push(id);
    }
    // 取得可能を先頭に
    const sortReady = ids => ids.sort((a, b) => {
      const ca = nextCost(a), cb = nextCost(b);
      return ((cb && costMet(cb)) ? 1 : 0) - ((ca && costMet(ca)) ? 1 : 0);
    });
    sortReady(upIds); sortReady(newIds);

    const upReady = upIds.filter(id => { const c = nextCost(id); return c && costMet(c); }).length;
    const newReady = newIds.filter(id => { const c = nextCost(id); return c && costMet(c); }).length;

    // タブバー
    tabsEl.innerHTML = `
      <button class="stab ${tab==='up'?'on':''}" data-tab="up">強化 <span class="stab-n">${upIds.length}</span>${upReady ? '<span class="stab-badge">'+upReady+'</span>' : ''}</button>
      <button class="stab ${tab==='new'?'on':''}" data-tab="new">新規 <span class="stab-n">${newIds.length}</span>${newReady ? '<span class="stab-badge">'+newReady+'</span>' : ''}</button>
      <button class="stab ${tab==='info'?'on':''}" data-tab="info">効果一覧</button>`;
    tabsEl.querySelectorAll('.stab').forEach(b => b.onclick = () => { tab = b.dataset.tab; render(); });

    // カテゴリタブ(取得/強化できるものがあるカテゴリには●)
    if (tab === 'info') { catsEl.innerHTML = ''; }
    else {
      const ids = tab === 'up' ? upIds : newIds;
      let ch = `<button class="scat ${cat==='all'?'on':''}" data-cat="all">全て${catCount('all', ids) ? '<span class="scat-dot"></span>' : ''}</button>`;
      for (const ck in DATA.SKILL_CATS) {
        ch += `<button class="scat ${cat===ck?'on':''}" data-cat="${ck}">${DATA.SKILL_CATS[ck]}${catCount(ck, ids) ? '<span class="scat-dot"></span>' : ''}</button>`;
      }
      catsEl.innerHTML = ch;
      catsEl.querySelectorAll('.scat').forEach(b => b.onclick = () => { cat = b.dataset.cat; render(); });
    }

    // 本文
    let h = '';
    if (tab === 'info') {
      const ids = Object.keys(owned);
      h = ids.length ? ids.map(infoCard).join('') : '<p class="small" style="padding:20px">まだスキルがない。</p>';
    } else {
      const ids = (tab === 'up' ? upIds : newIds).filter(id => cat === 'all' || DATA.SKILLS[id].cat === cat);
      if (ids.length) h = ids.map(id => skillCard(id)).join('');
      else h = tab === 'up'
        ? '<p class="small" style="padding:20px">このカテゴリの取得済みスキルはまだない。</p>'
        : '<p class="small" style="padding:20px">スキルは無数にある。素材を集めると、素材が揃ったスキルがここに現れる(一度現れたスキルは残り続ける)。</p>';
    }
    listEl.innerHTML = h;
    listEl.querySelectorAll('.buy-btn').forEach(b => {
      b.onclick = () => { if (acquire(b.dataset.skill)) render(); };
    });

    // 所持サマリ
    let oh = '';
    for (const id in owned) oh += `<span class="owned-chip">${DATA.SKILLS[id].name} Lv${owned[id]}</span>`;
    ownedEl.innerHTML = oh || '<span class="small">まだスキルなし</span>';
  }

  function open(){ render(); panel.classList.remove('hidden'); }
  function close(){ panel.classList.add('hidden'); }
  function isOpen(){ return !panel.classList.contains('hidden'); }

  return { reset, lv, stat, cap, mats: () => mats, matCount, addMat, matUnlocked, skillUnlocked,
           nextCost, costMet, acquire, open, close, isOpen, render, readyCount, reqMet, refreshRevealed,
           get owned(){ return owned; } };
})();
