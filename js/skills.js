// =============================================================
// skills.js - 周回内スキルシステム + スキルパネルUI
//   ・素材を集めるとスキルリストに出現(集めるまで非表示)
//   ・取得後も素材リストが更新され、集めて再取得するとレベルUP
// =============================================================
'use strict';

const Skills = (() => {
  let owned = {};      // id -> lv
  let mats = {};       // mat -> count
  let revealed = {};   // 一度素材が揃って表示されたスキル(SaveSysに永続化: 周回をまたいでも表示され続ける)
  let seenReady = {};  // パネルを開いた時点で取得可能だったもの(バッジの既読管理)
  let pinned = [];     // 一番上に固定表示するスキル(先頭ほど上。新しく固定するほど前のは下へ)
  let listSeen = {};   // 一度リストで見たスキル。まだ見ていない(=ピン後に新登場)スキルは最上段に出す
  let shownThisOpen = {};  // このパネル表示中に一覧へ出したスキル(閉じる時に既読化)
  let tab = 'new';     // 強化 up / 新規 new / 効果 info / ステータス st
  let catByTab = { up: 'all', new: 'all' };   // カテゴリフィルタはタブごとに保存
  function curCat(){ return catByTab[tab] || 'all'; }

  // ピンは押すたびに必ず一番上へ。他をピンすると相対的に下がるが、もう一度押せばまた最上位に
  function togglePin(id){
    const i = pinned.indexOf(id);
    if (i >= 0) pinned.splice(i, 1);   // 今の位置から外して…
    pinned.unshift(id);                // …必ず先頭(一番上)へ
    SaveSys.data.skillPins = pinned;
    SaveSys.save();
  }
  // pinned順(先頭が上)を保ちつつ、固定を先頭に寄せる
  function applyPins(ids){
    const set = new Set(ids);
    const top = pinned.filter(id => set.has(id));
    const rest = ids.filter(id => !pinned.includes(id));
    return top.concat(rest);
  }

  function reset(){
    owned = {};   // 攻撃手段は武器庫(魂の広場)管理になり、スキルは補助・仲間・敵干渉・心得
    mats = {};
    SaveSys.data.skillsRevealed = SaveSys.data.skillsRevealed || {};
    revealed = SaveSys.data.skillsRevealed;
    SaveSys.data.skillPins = SaveSys.data.skillPins || [];
    pinned = SaveSys.data.skillPins;
    SaveSys.data.skillsListSeen = SaveSys.data.skillsListSeen || {};
    listSeen = SaveSys.data.skillsListSeen;
    seenReady = {};
    tab = 'new';
    // カテゴリ選択はタブごとに保存し、周回をまたいでも維持する
    SaveSys.data.skillCatByTab = SaveSys.data.skillCatByTab || { up: 'all', new: 'all' };
    catByTab = SaveSys.data.skillCatByTab;
    // 出撃支度+保存術: 基本素材を持って開始
    const s = SaveSys.metaLv('lab_starter') * 2 + SaveSys.metaLv('m_preserve');
    if (s > 0) for (const m of ['jelly','bone','hide','wood']) mats[m] = s;
  }

  function cap(){ return Math.min(DATA.SKILL_CAP_MAX, DATA.SKILL_BASE_CAP + SaveSys.metaLv('lib_cap')); }
  function lv(id){ return owned[id] || 0; }
  // スキル効果量の増幅(しに戻り後の基地パワーアップ、スキルごと)。範囲・CD・個数は
  // 対象外で、回復量・弱体量・持続時間・吸収量・倍率のボーナス部分などだけ増幅する
  let powMap = null;
  function setPow(map){ powMap = map || null; return map; }
  // 全スキル共通の効果量倍率(範囲・射程・CD・個数・押し出し距離は対象外)
  const EFFECT_AMP = 2;
  function stat(id){
    const l = lv(id); if (l <= 0) return null;
    const st = DATA.SKILLS[id].stats(l);
    // 基地ポテンシー(powMap) × 全体倍率。範囲/射程系のフィールドには掛けない
    const amp = EFFECT_AMP * (powMap ? (powMap[id] || 1) : 1);
    if (st.hps) st.hps *= amp;                                   // サンクチュアリ回復
    if (st.burst) st.burst *= amp;                               // シールド爆発
    if (st.reduce) st.reduce = Math.min(0.9, st.reduce * amp);   // 威圧の弱体
    if (st.killHeal) st.killHeal *= amp;                         // 吸血
    if (st.lifesteal) st.lifesteal *= amp;
    if (st.dur) st.dur *= amp;                                   // 混乱・呪い・砂の持続
    if (st.shred) st.shred *= amp;                               // 呪印の被ダメ増
    if (st.slow) st.slow = Math.min(0.95, st.slow * amp);        // 減速率
    if (st.recruit) st.recruit *= amp;                           // カリスマ
    if (st.trail) st.trail *= amp;                               // 靴の残像ダメージ
    if (st.freeze) st.freeze *= amp;                             // パルスの凍結時間
    if (st.heal) st.heal *= amp;                                 // 妖精の泉の回復量
    if (st.burn) st.burn *= amp;                                 // 炎上ダメージ
    if (st.chance) st.chance = Math.min(1, st.chance * amp);     // 鍛冶の心火の発動率
    if (st.res) st.res = Math.min(0.8, st.res * amp);            // 竜鱗の被ダメ軽減
    // 倍率系はボーナス部分だけ。magnetSkのmultは「範囲」なので全体倍率の対象外
    if (st.mult) st.mult = 1 + (st.mult - 1) * (id === 'magnetSk' ? (powMap ? (powMap[id] || 1) : 1) : amp);
    if (st.atk) st.atk = 1 + (st.atk - 1) * amp;                 // ウォーバナー
    if (st.hp) st.hp = 1 + (st.hp - 1) * amp;
    if (st.spd) st.spd = 1 + (st.spd - 1) * amp;
    if (st.hpMul) st.hpMul = 1 + (st.hpMul - 1) * amp;           // 骨の壁のHP
    if (st.allyMul) st.allyMul = 1 + (st.allyMul - 1) * amp;
    if (st.passive) {
      // 範囲系のパッシブ(効果範囲・磁石)は全体倍率の対象外(範囲は2倍しない約束)
      const rangeKey = st.passive.key === 'areaMul' || st.passive.key === 'magnetMul';
      const pAmp = rangeKey ? (powMap ? (powMap[id] || 1) : 1) : amp;
      st.passive = { key: st.passive.key, value: st.passive.value * pAmp };   // 心得
    }
    return st;
  }
  function matCount(m){ return mats[m] || 0; }
  function addMat(m, n){ mats[m] = (mats[m] || 0) + (n || 1); }
  function matUnlocked(m){
    const def = DATA.MATERIALS[m];
    return !def.unlock || SaveSys.metaLv(def.unlock) > 0;
  }
  function skillUnlocked(id){
    const def = DATA.SKILLS[id];
    if (!def) return false;   // 廃止済みのスキルid(古いセーブのピン等)は無視
    if (def.unlockAch && !SaveSys.data.ach[def.unlockAch]) return false;   // 実績で解放
    if (def.unlockQuest && !(SaveSys.data.quests2 && SaveSys.data.quests2[def.unlockQuest])) return false; // クエスト報酬
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
  function readyIds(){
    const out = [];
    for (const id in DATA.SKILLS) {
      if (!skillUnlocked(id) || !reqMet(id) || hiddenByUser(id)) continue;
      const cost = nextCost(id);
      if (cost && costMet(cost)) out.push(id);
    }
    return out;
  }
  function readyCount(){ return readyIds().length; }
  // バッジ用: まだパネルで見ていない取得可能スキルの数(開いたら既読になる)
  function unseenReadyCount(){
    return readyIds().filter(id => !seenReady[id]).length;
  }
  // 素材が揃ったスキルを開示済みに記録(以後は素材が減っても・周回をまたいでも表示され続ける)
  function refreshRevealed(){
    let changed = false;
    for (const id in DATA.SKILLS) {
      if (revealed[id]) continue;
      if (lv(id) > 0) { revealed[id] = true; changed = true; continue; }
      if (!skillUnlocked(id)) continue;   // 前提スキル未達でも、素材が揃えば一覧に現れる
      const cost = nextCost(id);
      if (cost && costMet(cost)) { revealed[id] = true; changed = true; }
    }
    if (changed) SaveSys.save();
  }

  function acquire(id){
    if (!skillUnlocked(id) || !reqMet(id) || hiddenByUser(id)) return false;   // 書庫で「獲得しない」設定は取れない
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

  // 必要なもの: 素材と「前提スキル」を同じ並びで見せる。
  // 前提スキルは素材と同じく「持っている量/必要な量」で表示し、
  // 前提の要らないスキルと同じ場所・同じ形で並ぶ(隠さない)
  function costHtml(cost, id){
    let h = '<div class="cost-line">';
    const rq = id && DATA.SKILLS[id] && DATA.SKILLS[id].requires;
    if (rq) {
      const rdef = DATA.SKILLS[rq.skill];
      const have = lv(rq.skill);
      h += `<span class="cost-item ${have >= rq.lv ? 'ok' : 'ng'}">
        <img class="cost-icon" src="${Sprites.get(rdef.icon).toDataURL()}" alt="">${rdef.name} Lv${have}/${rq.lv}</span>`;
    }
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
    // 前提スキルは素材と同じ「必要なもの」― 揃うまで取得できないのも素材と同じ扱い
    const can = cost && costMet(cost) && reqMet(id);
    const nextTxt = l === 0 ? def.desc : (cost ? 'Lv' + (l+1) + ': ' + (def.lvText[l-1] || '強化') : '最大レベル');
    const iconUrl = Sprites.get(def.icon).toDataURL ? Sprites.get(def.icon).toDataURL() : '';
    return `<div class="skill-card ${can ? 'ready' : ''}">
      <img class="icon" src="${iconUrl}" alt="">
      <div class="info">
        <div class="name">${def.name} ${l > 0 ? 'Lv' + l + (cost ? ' → Lv' + (l+1) : ' (MAX)') : '<span class="small">(新規)</span>'}</div>
        <div class="desc">${nextTxt}</div>
        ${cost ? costHtml(cost, id) : ''}
      </div>
      <div class="card-btns">
        <button class="pin-btn" data-pin="${id}" title="一番上に表示">📌</button>
        ${cost ? `<button class="buy-btn" data-skill="${id}" ${can ? '' : 'disabled'}>${l > 0 ? 'レベルUP' : '取得'}</button>` : ''}
      </div>
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

  // 素材タブ: 所持素材の一覧(ゲームは止まったまま)
  function matsHtml(){
    let h = '<div class="sec-head">所持素材</div><div class="st-grid">';
    let any = false;
    for (const m in DATA.MATERIALS) {
      const n = matCount(m);
      if (!matUnlocked(m) && !n) continue;
      any = true;
      const md = DATA.MATERIALS[m];
      h += `<div class="st-cell"><span class="st-k"><span class="mat-dot" style="background:${md.color};display:inline-block;margin-right:4px"></span>${md.name}</span><span class="st-v">${n}</span></div>`;
    }
    h += '</div>';
    if (!any) h += '<p class="small" style="padding:8px 4px">まだ素材がない。敵やオブジェクトを壊すと手に入る。</p>';
    else h += '<p class="small" style="padding:8px 4px">土地ごとに採れやすい素材が違う。レア素材は特定のレア魔物・オブジェクトだけが落とす。</p>';
    return h;
  }

  // ステータスタブ: 現在の能力値(ゲームは止まったまま)
  function statusHtml(){
    const st = (typeof Run !== 'undefined' && Run.state && Run.state.stats) ? Run.state.stats : null;
    if (!st) return '<p class="small" style="padding:20px">周回中のみ表示できる。</p>';
    const R = Run.state;
    const pct = v => { const p2 = Math.round((v - 1) * 100); return (p2 >= 0 ? '+' : '') + p2 + '%'; };
    const rows = [
      ['HP', Math.ceil(Math.max(0, R.player.hp)) + ' / ' + Math.round(st.maxHp)],
      ['攻撃倍率', pct(st.atk)],
      ['移動速度', Math.round(st.speed) + ' (px/秒)'],
      ['射程', pct(st.range)],
      ['効果範囲', pct(st.area)],
      ['攻撃間隔短縮', Math.round(st.cdr * 100) + '%'],
      ['会心率', Math.round(st.crit * 100) + '%'],
      ['被ダメ軽減', Math.round(st.armor * 100) + '%'],
      ['回避率', Math.round(st.dodge * 100) + '%'],
      ['HP自動回復', st.regen.toFixed(1) + '/秒'],
      ['回収範囲', Math.round(st.magnet) + ' (px)'],
      ['勧誘率', (st.recruit * 100).toFixed(1) + '%'],
      ['仲間攻撃/HP', pct(st.allyAtk) + ' / ' + pct(st.allyHp)],
      ['コイン倍率', pct(st.coinMul)],
      // ドロップ率は倍率ではなく「出る確率」そのもの。倍率と同じ書き方(±%)にすると、
      // 初期値の60%が「-40%」と出て、覚えのない罰のように見えてしまう
      ['素材ドロップ率', Math.round(st.dropMul * 100) + '%'],
      ['リーパー被ダメ減/与ダメ増', Math.round(st.reaperRes * 100) + '% / ' + pct(st.reaperDmg)],
      ['仲間の数', R.allies.length + '体'],
    ];
    let h = '<div class="sec-head">ステータス</div><div class="st-grid">';
    for (const [k, v] of rows) h += `<div class="st-cell"><span class="st-k">${k}</span><span class="st-v">${v}</span></div>`;
    return h + '</div>';
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
      if (!skillUnlocked(id) || hiddenByUser(id)) continue;   // 前提スキル未達でも並べる
      if (revealed[id]) newIds.push(id);
    }
    // 取得可能を先頭に
    const sortReady = ids => ids.sort((a, b) => {
      const ca = nextCost(a), cb = nextCost(b);
      return ((cb && costMet(cb)) ? 1 : 0) - ((ca && costMet(ca)) ? 1 : 0);
    });
    sortReady(upIds); sortReady(newIds);

    const isReady = id => { const c = nextCost(id); return c && costMet(c); };
    // 並び: 未見(新登場) → 今すぐ取得/強化できるもの → それ以外。
    // 素材が揃ったスキルはピン止めと同じ扱いで最上段に固定される(各ブロック内はピン順)。
    // 初回閲覧(まだ何も見ていない)時は全部が未見なので、通常どおりピン順で並べる。
    const engaged = Object.keys(listSeen).length > 0;
    const pinnedTop = ids => {
      const fresh = engaged ? ids.filter(id => !listSeen[id]) : [];
      const rest = engaged ? ids.filter(id => listSeen[id]) : ids;
      const ready = rest.filter(isReady);
      const notReady = rest.filter(id => !isReady(id));
      return fresh.concat(applyPins(ready), applyPins(notReady));
    };
    // バッジは「今、取得/強化できる数」を常に反映する(素材が揃っている限り表示)
    const upBadge = upIds.filter(isReady).length;
    const newBadge = newIds.filter(isReady).length;

    // タブバー(バッジ=今その場で取得/強化できる数)
    tabsEl.innerHTML = `
      <button class="stab ${tab==='up'?'on':''}" data-tab="up">強化 <span class="stab-n">${upIds.length}</span>${upBadge ? '<span class="stab-badge">'+upBadge+'</span>' : ''}</button>
      <button class="stab ${tab==='new'?'on':''}" data-tab="new">新規 <span class="stab-n">${newIds.length}</span>${newBadge ? '<span class="stab-badge">'+newBadge+'</span>' : ''}</button>
      <button class="stab ${tab==='info'?'on':''}" data-tab="info">効果一覧</button>
      <button class="stab ${tab==='mat'?'on':''}" data-tab="mat">素材</button>
      <button class="stab ${tab==='st'?'on':''}" data-tab="st">ステータス</button>`;
    tabsEl.querySelectorAll('.stab').forEach(b => b.onclick = () => { tab = b.dataset.tab; render(); });

    // カテゴリタブ(取得/強化できるものがあるカテゴリには●)
    if (tab === 'info' || tab === 'st' || tab === 'mat') { catsEl.innerHTML = ''; }
    else {
      const cat = curCat();
      const ids = tab === 'up' ? upIds : newIds;
      let ch = `<button class="scat ${cat==='all'?'on':''}" data-cat="all">全て${catCount('all', ids) ? '<span class="scat-dot"></span>' : ''}</button>`;
      for (const ck in DATA.SKILL_CATS) {
        ch += `<button class="scat ${cat===ck?'on':''}" data-cat="${ck}">${DATA.SKILL_CATS[ck]}${catCount(ck, ids) ? '<span class="scat-dot"></span>' : ''}</button>`;
      }
      catsEl.innerHTML = ch;
      catsEl.querySelectorAll('.scat').forEach(b => b.onclick = () => {
        catByTab[tab] = b.dataset.cat; SaveSys.save(); render();   // タブごとに保存
      });
    }

    // 本文
    let h = '';
    if (tab === 'st') {
      h = statusHtml();
    } else if (tab === 'mat') {
      h = matsHtml();
    } else if (tab === 'info') {
      const ids = Object.keys(owned);
      h = ids.length ? ids.map(infoCard).join('') : '<p class="small" style="padding:20px">まだスキルがない。</p>';
    } else {
      const cat = curCat();
      const ids = pinnedTop((tab === 'up' ? upIds : newIds).filter(id => cat === 'all' || DATA.SKILLS[id].cat === cat));
      for (const id of ids) shownThisOpen[id] = true;   // 表示したものは閉じる時に既読化
      if (ids.length) h = ids.map(id => skillCard(id)).join('');
      else h = tab === 'up'
        ? '<p class="small" style="padding:20px">このカテゴリの取得済みスキルはまだない。</p>'
        : '<p class="small" style="padding:20px">スキルは無数にある。素材が揃ったものから、ここに現れる(一度現れたら残り続ける)。</p>';
    }
    listEl.innerHTML = h;
    listEl.querySelectorAll('.pin-btn').forEach(b => {
      b.onclick = () => { togglePin(b.dataset.pin); render(); };
    });
    listEl.querySelectorAll('.buy-btn').forEach(b => {
      b.onclick = () => { if (acquire(b.dataset.skill)) render(); };
    });

    // 所持サマリ。画面の一番下に離れて出るので、何の一覧かを必ず添える
    let oh = '';
    for (const id in owned) oh += `<span class="owned-chip">${DATA.SKILLS[id].name} Lv${owned[id]}</span>`;
    ownedEl.innerHTML = '<span class="small owned-head">この周回で取ったスキル:</span>' +
      (oh || '<span class="small">まだなし</span>');
  }

  function open(){
    render();
    // 見出しの但し書きは状況に合わせる(街では時間は動いていない)
    const note = panel.querySelector('h2 .small');
    if (note) note.textContent = Game.state === 'run' ? '(一時停止中)' : '(街で確認中)';
    panel.classList.remove('hidden');
    // 開いた時点の取得可能スキルを既読にする(バッジが消える)
    for (const id of readyIds()) seenReady[id] = true;
  }
  function close(){
    panel.classList.add('hidden');
    // 今回表示したスキルを既読化(次に開く時は最上段ではなく通常/固定位置へ)
    let changed = false;
    for (const id in shownThisOpen) if (!listSeen[id]) { listSeen[id] = true; changed = true; }
    shownThisOpen = {};
    if (changed) SaveSys.save();
  }
  function isOpen(){ return !panel.classList.contains('hidden'); }

  return { reset, lv, stat, setPow, cap, mats: () => mats, matCount, addMat, matUnlocked, skillUnlocked,
           nextCost, costMet, acquire, open, close, isOpen, render, readyCount, unseenReadyCount, reqMet, refreshRevealed,
           get owned(){ return owned; } };
})();
