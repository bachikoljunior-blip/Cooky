// =============================================================
// hub.js - 魂の広場(死後のフィールド)
//   ・初期の広場: 祭壇/研究所/宿舎/書庫/武器庫/石碑 + 転送ゲート
//   ・転送ゲート(最初からある): 出撃地点の選択 と 解放済み基地への移動
//   ・解放済み基地は独自の小さなマップを持ち、その基地の特別強化施設がある
//   ・画面隅に施設マップを常時表示
// =============================================================
'use strict';

const Hub = (() => {
  const H = { player:{ x:0, y:80, dir:1 }, interact:null, area:'main' };

  // ---------------- エリアと施設配置 ----------------
  function bounds(){
    return H.area === 'main'
      ? { x0:-800, y0:-360, x1:800, y1:400 }
      : { x0:-640, y0:-380, x1:640, y1:400 };   // 住民が増えても全員に届く広さ
  }

  function stations(){
    if (H.area === 'main') {
      return [
        { kind:'meta', st:'altar',  x:-420, y:-170 },
        { kind:'meta', st:'lab',    x:-140, y:-170 },
        { kind:'meta', st:'camp',   x:140,  y:-170 },
        { kind:'meta', st:'lib',    x:420,  y:-170 },
        { kind:'armory', x:620, y:240 },
        { kind:'gate',   x:0,   y:260 },
        { kind:'stats',  x:-620, y:240 },
        // ストーリーで移り住んでくる住民たち
        ...((DATA.SIDEQUESTS && DATA.SIDEQUESTS.main) || []).filter(sq => Quest.sideVisible(sq))
          .map((sq, i) => ({ kind:'sidenpc', sq:sq.id, name:sq.npcName, spr:sq.npc, x:-450 + i * 300, y:40 })),
      ];
    }
    // 港町エリア: 船大工・(修理後)貿易商・住民・ゲート。船は実寸大で桟橋に停泊
    if (H.area.startsWith('port:')) {
      const pid = H.area.slice(5);
      const plist = [
        { kind:'portnpc', port: pid, x:-300, y:-60 },
        { kind:'gate', x:-420, y:250 },
        { kind:'villager', v: DATA.VILLAGERS[4], x:340, y:-120 },   // 渡りの漁師
      ];
      if (SaveSys.data.ports[pid]) plist.push({ kind:'trader', port: pid, x:-120, y:-140 });
      return plist;
    }
    // 基地エリア: 特別強化施設 + NPC + ゲート(周回中に転移してきた時も同じマップ)
    const list = [];
    const facs = Object.keys(DATA.BASE_FACS);
    const present = facs.filter(f => Object.values(DATA.META).some(d => d.st === H.area && d.fac === f));
    present.forEach((f, i) => {
      const x = (i - (present.length - 1) / 2) * 260;
      list.push({ kind:'meta', st:H.area, fac:f, x, y:-90 });
    });
    if (DATA.QUESTS[H.area]) list.push({ kind:'npc', base:H.area, x:0, y:-330 });
    // 住民(サイドクエスト): しに戻り後もここで依頼を受けられる
    // 住民は依頼NPC(x:0)と重ならないよう左右交互に並べる
    (DATA.SIDEQUESTS && DATA.SIDEQUESTS[H.area] || []).filter(sq => Quest.sideVisible(sq)).forEach((sq, i) => {
      const sx = (i % 2 === 0 ? 1 : -1) * (Math.floor(i / 2) + 1) * 260;
      list.push({ kind:'sidenpc', sq:sq.id, name:sq.npcName, spr:sq.npc, x:sx, y:-330 });
    });
    list.push({ kind:'board', x:-320, y:260 });   // 依頼板(周回ごとに変わる小口の依頼)
    list.push({ kind:'gate', x:0, y:260 });
    // 依頼を持たないふつうの住民(基地ごとに2人、顔ぶれは固定)
    {
      let h = 0; for (let i = 0; i < H.area.length; i++) h = (h * 31 + H.area.charCodeAt(i)) | 0;
      const n = DATA.VILLAGERS.length;
      const i1 = Math.abs(h) % n, i2 = (Math.abs(h >> 3) % (n - 1) + i1 + 1) % n;
      list.push({ kind:'villager', v: DATA.VILLAGERS[i1], x:-140, y:80 });
      list.push({ kind:'villager', v: DATA.VILLAGERS[i2], x:180, y:100 });
    }
    return list;
  }

  function areaName(){
    if (H.area === 'main') return '魂の広場';
    if (H.area.startsWith('port:')) {
      const pp = DATA.PORTS.find(p => p.id === H.area.slice(5));
      return pp ? '港町「' + pp.name + '」' : '港町';
    }
    const b = DATA.BASES.find(b => b.id === H.area);
    return b ? '拠点「' + b.name + '」' : '拠点';
  }

  function enter(){
    H.fromRun = false;
    H.area = 'main';
    H.player.x = 0; H.player.y = 80;
    SaveSys.checkAchievements();
    H.list = stations();
  }

  function travel(areaId){
    H.fromRun = false;
    H.area = areaId;
    H.list = stations();
    H.player.x = 0; H.player.y = 90;
    Sfx.skill();
  }

  // 周回中に基地へ着いた時の転移: 拠点マップ(ゲートから行けるマップと同じ)に入る。
  // 周回は裏で保持され、ゲートの「周回に戻る」で続きから再開する。
  function enterFromRun(areaId){
    H.fromRun = true;
    H.area = areaId;
    H.list = stations();
    H.player.x = 0; H.player.y = 200;
    Sfx.skill();
  }

  function update(dt){
    const p = H.player;
    // 施設一覧は状態変化(船の修理完了など)を拾うため定期的に組み直す
    H.listT = (H.listT || 0) + dt;
    if (H.listT > 1) { H.listT = 0; H.list = stations(); }
    const ax = Input.axis();
    const b = bounds();
    p.x += ax.x * 240 * dt;
    p.y += ax.y * 240 * dt;
    p.x = Math.max(b.x0 + 40, Math.min(b.x1 - 40, p.x));
    p.y = Math.max(b.y0 + 40, Math.min(b.y1 - 40, p.y));
    // 地形の障害(泉・大炉・岩など): 円で押し出す(縁に沿って滑る)
    const th = DATA.HUB_THEME && DATA.HUB_THEME[H.area];
    if (th && th.obst) for (const o of th.obst) {
      const dx = p.x - o.x, dy = p.y - o.y;
      const d = Math.hypot(dx, dy);
      if (d < o.r + 16 && d > 0.001) { p.x = o.x + dx / d * (o.r + 16); p.y = o.y + dy / d * (o.r + 16); }
    }
    if (ax.x) p.dir = ax.x < 0 ? -1 : 1;

    // 住民は定位置のまわりを行き来する(作業している感)
    H.time = (H.time || 0) + dt;
    for (const s of H.list) {
      if (s.kind === 'npc' || s.kind === 'sidenpc' || s.kind === 'villager') {
        s.ox = 0; s.oy = 0;   // 住民は定位置に立つ(ふらふら漂わない)
      }
    }
    H.interact = null;
    for (const s of H.list) {
      if (Math.hypot(p.x - (s.x + (s.ox || 0)), p.y - (s.y + (s.oy || 0))) < 75) { H.interact = s; break; }
    }
    const hint = document.getElementById('interact-hint');
    const actBtn = document.getElementById('btn-act');
    if (H.interact) {
      // 周回中と同じキーキャップ([E])表示
      hint.innerHTML = '<kbd>E</kbd><span></span>';
      hint.lastChild.textContent = interactLabel(H.interact);
      hint.classList.remove('no-key');
      hint.classList.remove('hidden');
      actBtn.classList.remove('hidden');
    } else { hint.classList.add('hidden'); actBtn.classList.add('hidden'); }
  }

  function interactLabel(s){
    if (s.kind === 'meta') {
      const st = DATA.STATIONS[s.st];
      const fac = s.fac && DATA.BASE_FACS[s.fac];
      const b = DATA.BASES.find(b => b.id === s.st);
      const name = st ? st.name : (b ? b.name + 'の' : '') + (fac ? fac.name : '特別強化');
      if (s.fac && !(SaveSys.data.quests2 || {})[s.st]) {
        return name + '(扉は固く閉ざされている)';
      }
      if (H.fromRun) return name + '(周回中は強化できない)';
      return st ? st.name : name + (fac ? '(' + fac.desc + ')' : '');
    }
    if (s.kind === 'npc') { const q = DATA.QUESTS[s.base]; return (q ? q.npcName : 'NPC') + 'と話す'; }
    if (s.kind === 'portnpc') return SaveSys.data.ports[s.port] ? '船大工と話す' : '船大工と話す(船の修理)';
    if (s.kind === 'trader') return '貿易商と取引(相場は周回ごとに変わる)';
    if (s.kind === 'sidenpc') return s.name + 'と話す';
    if (s.kind === 'villager') return s.v.name + 'と話す';
    if (s.kind === 'board') return (Run.state.boardDone || {})[H.area] ? '依頼板(今日の依頼は達成済み)' : '依頼板を見る';
    if (s.kind === 'armory') return '武器庫(攻撃手段の切替・強化)';
    if (s.kind === 'gate') return H.fromRun ? '転送ゲート(周回に戻る)' : '転送ゲート(出撃 / 基地へ移動)';
    if (s.kind === 'stats') return '記録の石碑を見る';
    return '調べる';
  }

  function doInteract(){
    const s = H.interact;
    if (!s) return;
    if (s.kind === 'meta') {
      // 基地の施設は施設クエスト(ゲート解放後にNPCから)を果たすまで使えない。
      // 調べた時は説明書きではなく、施設の状態そのものを描写する(直し方は村人の話から分かる)
      if (s.fac && !(SaveSys.data.quests2 || {})[s.st]) {
        const fs = (DATA.FAC_STATE || {})[s.st] || { look:['施設は静まり返り、なんの力も感じられない…'] };
        Game.dialog('', null, fs.look, null); return;
      }
      if (H.fromRun) { Game.dialog('', null, ['ここは戦いの最中。強化は しに戻ってから 落ち着いて行おう。'], null); return; }
      openMetaPanel(s.st, s.fac);
    }
    else if (s.kind === 'npc') {
      if (!SaveSys.data.bases[s.base]) Quest.offer('base', s.base);   // 未解放: 解放依頼(受注/報告)
      else Game.npcTalk(s.base);
    }
    else if (s.kind === 'portnpc') {
      if (!SaveSys.data.ports[s.port]) Quest.offer('port', s.port);   // 未修理: 修理依頼(納品)
      else { const q = DATA.QUESTS[s.port]; Game.dialog('船大工', 'npc_sailor', [q.done[1]], null); }   // 修理後は締めの一言
    }
    else if (s.kind === 'trader') Run.openTrade('port_' + s.port, '貿易商');
    else if (s.kind === 'sidenpc') Quest.offer('side', s.sq);
    else if (s.kind === 'villager') {
      // 豆知識は話者の口調と混ざらないよう、地の文(見聞きした噂)として添える
      const tip = DATA.NPC_TIPS[Math.floor(Math.random() * DATA.NPC_TIPS.length)];
      Game.dialog(s.v.name, s.v.spr, [s.v.line, '(別れ際、こんな噂話も聞かせてくれた ―「' + tip + '」)'], null);
    }
    else if (s.kind === 'board') {
      if ((Run.state.boardDone || {})[H.area]) Game.dialog('', null, ['(今日の依頼は済んでいる。また次の周回で新しい依頼が貼り出されるだろう)'], null);
      else Quest.offer('board', H.area);
    }
    else if (s.kind === 'armory') openArmoryPanel();
    else if (s.kind === 'gate') openGatePanel();
    else if (s.kind === 'stats') openStatsPanel();
  }

  // ---------------- 転送ゲート ----------------
  function openGatePanel(){
    Game.pauseFor('station');
    document.getElementById('station-title').textContent = '⛩ 転送ゲート';
    const body = document.getElementById('station-body');
    // 周回中に転移してきた時は「周回に戻る」だけ
    if (H.fromRun) {
      const b = DATA.BASES.find(b => b.id === H.area);
      body.innerHTML = `<p class="small">ここは周回中の拠点「${b ? b.name : ''}」。強化はしに戻ってから。</p>
        <div class="up-card"><div class="info">
          <div class="name">周回に戻る</div><div class="desc">この拠点の場所から探索を続ける</div></div>
          <button class="buy-btn" data-resume="1">戻る</button></div>`;
      body.querySelector('[data-resume]').onclick = () => { Sfx.buy(); Game.closeStation(); Game.resumeRun(); };
      return;
    }
    const unlocked = DATA.BASES.filter(b => SaveSys.data.bases[b.id]);
    let h = '<div class="sec-head">出撃する(出撃場所を選ぶ)</div>';
    h += `<div class="up-card"><div class="info">
      <div class="name">初期地点</div><div class="desc">始まりの大陸の中心から出撃する</div></div>
      <button class="buy-btn" data-depart="__origin">出撃</button></div>`;
    for (const b of unlocked) {
      h += `<div class="up-card"><div class="info">
        <div class="name">${b.name}</div><div class="desc">解放済みの基地から出撃する(危険度に注意)</div></div>
        <button class="buy-btn" data-depart="${b.id}">出撃</button></div>`;
    }
    // 船を直した港からも出撃できる(常夜灯にゲートの分け火が灯っている)
    for (const pt of DATA.PORTS.filter(p => SaveSys.data.ports[p.id])) {
      h += `<div class="up-card"><div class="info">
        <div class="name">⚓ ${pt.name}</div><div class="desc">船を直した港から出撃する(常夜灯の分け火)</div></div>
        <button class="buy-btn" data-depart="port:${pt.id}">出撃</button></div>`;
    }
    h += '<div class="sec-head">基地へ移動(それぞれの基地に特別強化の施設がある)</div>';
    if (H.area !== 'main') {
      h += `<div class="up-card"><div class="info">
        <div class="name">魂の広場</div><div class="desc">祭壇・研究所・宿舎・書庫・武器庫のある最初の広場へ戻る</div></div>
        <button class="buy-btn" data-travel="main">移動</button></div>`;
    }
    let anyTravel = false;
    for (const b of unlocked) {
      if (b.id === H.area) continue;
      anyTravel = true;
      const items = Object.values(DATA.META).filter(d => d.st === b.id);
      const facs = Object.keys(DATA.BASE_FACS).filter(f => items.some(d => d.fac === f))
        .map(f => DATA.BASE_FACS[f].name).join('・');
      h += `<div class="up-card"><div class="info">
        <div class="name">${b.name}</div><div class="desc">施設: ${facs || '?'}(${items.length}種の強化)</div></div>
        <button class="buy-btn" data-travel="${b.id}">移動</button></div>`;
    }
    if (!anyTravel && H.area === 'main') {
      h += '<p class="small">まだ移動できる基地がない。周回中に基地を解放すると、ここから行き来できるようになる。</p>';
    }
    body.innerHTML = h;
    body.querySelectorAll('[data-depart]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.depart;
        Sfx.buy();
        Game.closeStation();
        if (id === '__origin') Game.startRun({ x:0, y:0 });
        else if (id.startsWith('port:')) {
          const pp = World.ports.find(p => p.id === id.slice(5));
          Game.startRun({ x:pp.x, y:pp.y + 40 });
        }
        else { const b = DATA.BASES.find(b => b.id === id); Game.startRun({ x:b.x, y:b.y + 60 }); }
      };
    });
    body.querySelectorAll('[data-travel]').forEach(btn => {
      btn.onclick = () => {
        Game.closeStation();
        travel(btn.dataset.travel);
      };
    });
  }

  // ---------------- 武器庫(攻撃手段) ----------------
  function openArmoryPanel(){
    Game.pauseFor('station');
    renderArmory();
  }
  function renderArmory(){
    document.getElementById('station-title').textContent =
      '🗡 武器庫 ― 攻撃手段はここで選ぶ ― 🪙 ' + fmtNum(SaveSys.data.coins);
    const body = document.getElementById('station-body');
    let h = '<p class="small">主人公の攻撃手段は周回中のスキルでは手に入らない。ここで購入・強化し、どれか1つを選んで出撃する。</p>';
    for (const id in DATA.WEAPONS) {
      const def = DATA.WEAPONS[id];
      const lv = SaveSys.weaponLv(id);
      const max = SaveSys.weaponMax(id);
      const active = SaveSys.data.weapon === id;
      const iconUrl = Sprites.get(def.icon).toDataURL ? Sprites.get(def.icon).toDataURL() : '';
      // 実績ロック
      if (!lv && def.unlockAch && !SaveSys.data.ach[def.unlockAch]) {
        const ach = DATA.ACHIEVEMENTS.find(a => a.id === def.unlockAch);
        h += `<div class="up-card" style="opacity:.55"><div class="info">
          <div class="name">🔒 ???</div>
          <div class="desc">実績「${ach ? ach.name : '???'}」(${ach ? ach.desc : ''})で解放</div></div></div>`;
        continue;
      }
      if (!lv) {
        // 未購入
        const req = def.requires;
        const reqOk = !req || SaveSys.weaponLv(req.weapon) >= req.lv;
        const reqTxt = req ? `条件: ${DATA.WEAPONS[req.weapon].name} Lv${req.lv}` : '';
        const can = reqOk && SaveSys.data.coins >= def.buy;
        h += `<div class="up-card" ${reqOk ? '' : 'style="opacity:.6"'}>
          <img class="icon" src="${iconUrl}" alt="" style="width:34px;height:34px">
          <div class="info">
            <div class="name">${def.name}</div>
            <div class="desc">${def.desc}${reqTxt ? ' <span class="small">[' + reqTxt + ']</span>' : ''}</div>
          </div>
          <button class="buy-btn" data-wbuy="${id}" ${can ? '' : 'disabled'}>🪙 ${fmtNum(def.buy)}</button>
        </div>`;
        continue;
      }
      // 所持済み: 切替 + 強化
      const maxed = lv >= max;
      const cost = maxed ? 0 : def.up(lv);
      const canUp = !maxed && SaveSys.data.coins >= cost;
      const nextTxt = maxed ? '最大レベル' : 'Lv' + (lv + 1) + ': ' + (def.lvText[lv - 1] || '強化');
      h += `<div class="up-card" ${active ? 'style="border-color:#ffd766"' : ''}>
        <img class="icon" src="${iconUrl}" alt="" style="width:34px;height:34px">
        <div class="info">
          <div class="name">${active ? '⚔ ' : ''}${def.name} <span class="small">Lv ${lv}/${max}${active ? ' ― 選択中' : ''}</span></div>
          <div class="desc">${nextTxt}</div>
        </div>
        ${active ? '' : `<button class="buy-btn" data-wsel="${id}" style="background:#1f6feb">装備</button>`}
        <button class="buy-btn" data-wup="${id}" ${canUp ? '' : 'disabled'}>${maxed ? 'MAX' : '🪙 ' + fmtNum(cost)}</button>
      </div>`;
    }
    body.innerHTML = h;
    body.querySelectorAll('[data-wbuy]').forEach(b => {
      b.onclick = () => { if (SaveSys.buyWeapon(b.dataset.wbuy)) { Sfx.buy(); renderArmory(); } else Sfx.deny(); };
    });
    body.querySelectorAll('[data-wup]').forEach(b => {
      b.onclick = () => { if (SaveSys.upWeapon(b.dataset.wup)) { Sfx.buy(); renderArmory(); } else Sfx.deny(); };
    });
    body.querySelectorAll('[data-wsel]').forEach(b => {
      b.onclick = () => { if (SaveSys.setWeapon(b.dataset.wsel)) { Sfx.skill(); renderArmory(); } else Sfx.deny(); };
    });
  }

  // ---------------- 強化パネル ----------------
  function openMetaPanel(stKey, fac){
    Game.pauseFor('station');
    const stDef = DATA.STATIONS[stKey];
    const base = DATA.BASES.find(b => b.id === stKey);
    const facDef = fac && DATA.BASE_FACS[fac];
    document.getElementById('station-title').textContent =
      (stDef ? stDef.name : '✦ ' + (base ? base.name : '') + 'の' + (facDef ? facDef.name : '特別強化')) +
      ' ― 🪙 ' + fmtNum(SaveSys.data.coins);
    renderMetaList(stKey, fac);
  }

  function renderMetaList(stKey, fac){
    const body = document.getElementById('station-body');
    let h = '';
    if (fac && DATA.BASE_FACS[fac]) h += `<p class="small">${DATA.BASE_FACS[fac].desc}。施設は基地ごとに品揃えが違う。</p>`;
    if (stKey === 'lib') {
      // スキル系統図: 前提の連なり(どれを育てればどの道が開くか)
      const chains = Object.keys(DATA.SKILLS).filter(id => DATA.SKILLS[id].requires && DATA.SKILLS[id].requires.skill)
        .map(id => {
          const rq = DATA.SKILLS[id].requires;
          const from = DATA.SKILLS[rq.skill];
          return `${from ? from.name : rq.skill} Lv${rq.lv} → ${DATA.SKILLS[id].name}`;
        });
      if (chains.length) h += `<div class="sec-head">🌿 スキル系統図</div><p class="small">${chains.join('<br>')}</p>`;
    }
    for (const id in DATA.META) {
      const def = DATA.META[id];
      if (def.st !== stKey) continue;
      if (fac && def.fac !== fac) continue;
      // 実績で解放される項目
      if (def.unlockAch && !SaveSys.data.ach[def.unlockAch]) {
        const ach = DATA.ACHIEVEMENTS.find(a => a.id === def.unlockAch);
        h += `<div class="up-card" style="opacity:.55">
          <div class="info">
            <div class="name">🔒 ???</div>
            <div class="desc">実績「${ach ? ach.name : '???'}」(${ach ? ach.desc : ''})で解放</div>
          </div></div>`;
        continue;
      }
      // 基地の解放数で解放される項目(古い地図の修復など)
      if (def.unlockBases && Object.keys(SaveSys.data.bases).length < def.unlockBases) {
        h += `<div class="up-card" style="opacity:.55">
          <div class="info">
            <div class="name">🔒 ???</div>
            <div class="desc">周回中に基地を${def.unlockBases}つ解放すると現れる</div>
          </div></div>`;
        continue;
      }
      const lv = SaveSys.metaLv(id);
      const maxed = lv >= def.max;
      const cost = maxed ? 0 : def.cost(lv);
      const can = !maxed && SaveSys.data.coins >= cost;
      h += `<div class="up-card">
        <div class="info">
          <div class="name">${def.name} <span class="small">Lv ${lv}/${def.max}</span></div>
          <div class="desc">${def.desc}</div>
        </div>
        <button class="buy-btn" data-meta="${id}" ${can ? '' : 'disabled'}>
          ${maxed ? 'MAX' : '🪙 ' + fmtNum(cost)}</button>
      </div>`;
    }
    if (!h) h = '<p class="small">ここにはまだ強化がない。</p>';
    // 書庫: 周回中スキル表示の設定(解放したことのあるスキルを非表示にできる)
    if (stKey === 'lib') {
      const seen = SaveSys.data.skillsSeen || {};
      const ids = Object.keys(seen).filter(id => DATA.SKILLS[id]);
      if (ids.length) {
        h += '<div class="sec-head">周回中のスキル獲得設定(いらないスキルを獲得候補から外せる)</div>';
        for (const id of ids) {
          const hidden = SaveSys.data.skillHidden && SaveSys.data.skillHidden[id];
          h += `<div class="up-card"><div class="info">
            <div class="name">${DATA.SKILLS[id].name}</div>
            <div class="desc">${hidden ? '周回中は獲得できない(リストにも出ない)' : '周回中に獲得できる'}</div></div>
            <button class="buy-btn" data-hide="${id}" style="background:${hidden ? '#8b1e24' : '#1f6feb'}">${hidden ? '獲得しない' : '獲得する'}</button>
          </div>`;
        }
      }
    }
    body.innerHTML = h;
    body.querySelectorAll('[data-hide]').forEach(b => {
      b.onclick = () => {
        SaveSys.data.skillHidden = SaveSys.data.skillHidden || {};
        const id = b.dataset.hide;
        SaveSys.data.skillHidden[id] = !SaveSys.data.skillHidden[id];
        SaveSys.save();
        Sfx.buy();
        renderMetaList(stKey, fac);
      };
    });
    body.querySelectorAll('.buy-btn[data-meta]').forEach(b => {
      b.onclick = () => {
        if (SaveSys.buyMeta(b.dataset.meta)) {
          Sfx.buy();
          document.getElementById('station-title').textContent =
            document.getElementById('station-title').textContent.replace(/🪙 .+$/, '🪙 ' + fmtNum(SaveSys.data.coins));
          renderMetaList(stKey, fac);
        } else Sfx.deny();
      };
    });
  }

  function openStatsPanel(){
    Game.pauseFor('station');
    const s = SaveSys.data.stats;
    document.getElementById('station-title').textContent = '📜 記録の石碑';
    const basesN = Object.keys(SaveSys.data.bases).length;
    const portsN = Object.keys(SaveSys.data.ports).length;
    document.getElementById('station-body').innerHTML = `
      <div class="help-body">
        <p>周回数: <b>${s.runs}</b></p>
        <p>最長生存時間: <b>${fmtTime(s.bestTime)}</b> ${s.bestTime >= DATA.REAPER_AT ? '☠(終焉の刻を超えた!)' : ''}</p>
        <p>最遠到達距離: <b>${fmtNum(s.maxDist)}</b></p>
        <p>総撃破数: <b>${fmtNum(s.kills)}</b> / ボス撃破: <b>${s.bossKills}</b> / リーパー撃破: <b>${s.reaperKills}</b></p>
        <p>仲間にした数: <b>${s.recruits}</b></p>
        <p>総獲得コイン: <b>${fmtNum(s.totalCoins)}</b></p>
        <p>解放した基地: <b>${basesN} / ${DATA.BASES.length}</b></p>
        <p>修理した港: <b>${portsN} / ${DATA.PORTS.length}</b></p>
        <p>素材収集: <b>${fmtNum(s.matsCollected||0)}</b> / オブジェクト破壊: <b>${fmtNum(s.objectsDestroyed||0)}</b> / スキル取得: <b>${s.skillsAcquired||0}回</b></p>
        ${(SaveSys.data.story || {}).end_throne ? '<p style="color:#ffd766">👑 終焉の刻の、その先の物語を見届けた</p>' : ''}
        <div class="sec-head">🏆 実績 (${Object.keys(SaveSys.data.ach).length}/${DATA.ACHIEVEMENTS.length} ― 達成率 ${Math.round(Object.keys(SaveSys.data.ach).length / DATA.ACHIEVEMENTS.length * 100)}%)</div>
        ${achievementsHtml()}
        <div class="sec-head">📖 図鑑 (出会った魔物 ${Object.keys(SaveSys.data.dex || {}).length} 種)</div>
        ${dexHtml()}
      </div>`;
  }

  // 実績: カテゴリごとにまとめ、未達成は進捗つきで表示
  function achievementsHtml(){
    const CATS = [
      ['⚔ 戦い', ['ach_kill1','ach_kill2','ach_boss1','ach_reaper1','ach_die10','ach_time1','ach_time2']],
      ['🧭 探索', ['ach_dist1','ach_bases','ach_ports']],
      ['🎒 収集と成長', ['ach_mats1','ach_obj1','ach_coins','ach_skills','ach_recruit1','ach_allies20','ach_rare']],
    ];
    const st = SaveSys.data;
    const prog = (a) => {
      const P = {
        ach_kill1:[st.stats.kills,1000], ach_kill2:[st.stats.kills,10000], ach_boss1:[st.stats.bossKills,10],
        ach_reaper1:[st.stats.reaperKills,1], ach_die10:[st.stats.deaths||0,10],
        ach_time1:[Math.floor(st.stats.bestTime),1200], ach_time2:[Math.floor(st.stats.bestTime),1800],
        ach_dist1:[st.stats.maxDist,10000], ach_bases:[Object.keys(st.bases).length,5], ach_ports:[Object.keys(st.ports).length,3],
        ach_mats1:[st.stats.matsCollected||0,500], ach_obj1:[st.stats.objectsDestroyed||0,500],
        ach_coins:[st.stats.totalCoins,100000], ach_skills:[st.stats.skillsAcquired||0,50],
        ach_recruit1:[st.stats.recruits,100], ach_allies20:[st.stats.maxAlliesEver||0,20], ach_rare:[st.stats.rareKills||0,1],
      }[a.id];
      return P ? Math.min(100, Math.floor(P[0] / P[1] * 100)) + '%(' + fmtNum(P[0]) + '/' + fmtNum(P[1]) + ')' : '';
    };
    let h = '';
    for (const [cat, ids] of CATS) {
      h += `<p><b>${cat}</b></p>`;
      const items = ids.map(id => DATA.ACHIEVEMENTS.find(a => a.id === id)).filter(Boolean)
        .sort((a, b) => (SaveSys.data.ach[a.id] ? 1 : 0) - (SaveSys.data.ach[b.id] ? 1 : 0));
      for (const a of items) {
        const done = SaveSys.data.ach[a.id];
        h += `<p style="opacity:${done ? 1 : .55};margin-left:8px">${done ? '✅' : '⬜'} <b>${a.name}</b> ― ${a.desc}
          ${done ? '' : `<span class="small"> 進捗 ${prog(a)}</span>`}<br><span class="small">報酬: ${a.reward}</span></p>`;
      }
    }
    return h;
  }

  // 図鑑: 倒した魔物とそのドロップ+素材からの逆引き
  function dexHtml(){
    const dex = SaveSys.data.dex || {};
    const seen = Object.keys(DATA.ENEMIES).filter(k => dex[k]);
    if (!seen.length) return '<p class="small">まだ記録がない。魔物を倒すとここに刻まれていく。</p>';
    let h = seen.map(k => {
      const d = DATA.ENEMIES[k];
      const drops = (d.drops || []).filter(dr => Skills.matUnlocked(dr.m)).map(dr => DATA.MATERIALS[dr.m].name).join('・');
      return `<p style="margin-left:8px"><b>${d.name}</b> ×${fmtNum(dex[k])}<span class="small">${drops ? ' ― 落とす素材: ' + drops : ''}</span></p>`;
    }).join('');
    // 素材からの逆引き(欲しい素材をどの魔物が落とすか)
    const rev = {};
    for (const k of seen) for (const dr of DATA.ENEMIES[k].drops || []) {
      if (!Skills.matUnlocked(dr.m)) continue;
      (rev[dr.m] = rev[dr.m] || []).push(DATA.ENEMIES[k].name);
    }
    const revKeys = Object.keys(rev);
    if (revKeys.length) {
      h += '<p><b>素材の逆引き</b><span class="small">(出会った魔物のみ)</span></p>';
      h += revKeys.map(m => `<p class="small" style="margin-left:8px">${DATA.MATERIALS[m].name} ← ${[...new Set(rev[m])].join('・')}</p>`).join('');
    }
    return h;
  }

  // ---------------- 描画 ----------------
  function stationVisual(s){
    if (s.kind === 'portnpc') return { spr:'npc_sailor', label:'船大工', short:'船大工' };
    if (s.kind === 'trader') return { spr:'npc_scholar', label:'貿易商', short:'貿易' };
    if (s.kind === 'meta') {
      const stDef = DATA.STATIONS[s.st];
      if (stDef) return { spr: stDef.sprite, label: stDef.name, short: stDef.name.slice(-2) };
      const fac = s.fac && DATA.BASE_FACS[s.fac];
      if (fac) return { spr: fac.sprite, label: fac.name, short: fac.short };
      return { spr:'st_altar', label:'特別強化', short:'強化' };
    }
    if (s.kind === 'npc') { const q = DATA.QUESTS[s.base]; return { spr: (q && q.npc) || 'npc_elder', label: q ? q.npcName : 'NPC', short: 'NPC' }; }
    if (s.kind === 'sidenpc') return { spr: s.spr || 'npc_girl', label: s.name, short: '住民' };
    if (s.kind === 'villager') return { spr: s.v.spr, label: s.v.name, short: '住民' };
    if (s.kind === 'board') return { spr:'ob_house2', label:'依頼板', short:'依頼' };
    if (s.kind === 'armory') return { spr:'st_armory', label:'武器庫', short:'武器' };
    if (s.kind === 'gate') return { spr:'st_gate', label:'転送ゲート', short:'ゲート' };
    if (s.kind === 'stats') return { spr:'ob_rock', label:'記録の石碑', short:'石碑' };
    return { spr:'st_altar', label:'', short:'' };
  }
  // 施設マップ用の短い名前
  const SHORT_NAMES = { altar:'祭壇', lab:'研究所', camp:'宿舎', lib:'書庫' };

  // ---- 実景プロップの描画(HUB_THEME) ----
  // ストーリーに出てくるもの(泉・御神木・大炉・湯壺・歌碑・灯台…)を実物として描く
  function drawProp(g, pr, t){
    const x = pr.x, y = pr.y, s = pr.s || 60;
    switch (pr.k) {
      case 'sprite': Sprites.draw(g, pr.spr, x, y, s); break;
      case 'pool': {
        g.fillStyle = 'rgba(0,0,0,.25)';
        g.beginPath(); g.ellipse(x, y + 6, pr.rx + 6, pr.ry + 6, 0, 0, 7); g.fill();
        g.fillStyle = pr.c || '#2b7fb0';
        g.beginPath(); g.ellipse(x, y, pr.rx, pr.ry, 0, 0, 7); g.fill();
        if (!pr.frozen) {   // さざ波
          g.strokeStyle = 'rgba(230,237,243,.25)'; g.lineWidth = 1.5;
          for (let i = 0; i < 3; i++) {
            const ph = t * 0.7 + i * 2.1;
            const rr = ((ph % 2) / 2);
            g.globalAlpha = 0.5 * (1 - rr);
            g.beginPath(); g.ellipse(x, y, pr.rx * (0.3 + rr * 0.65), pr.ry * (0.3 + rr * 0.65), 0, 0, 7); g.stroke();
          }
          g.globalAlpha = 1;
        } else {   // 凍った面のひび
          g.strokeStyle = 'rgba(230,237,243,.35)'; g.lineWidth = 1.5;
          g.beginPath(); g.moveTo(x - pr.rx * 0.5, y - 8); g.lineTo(x + 14, y + 6); g.lineTo(x + pr.rx * 0.6, y - 10); g.stroke();
        }
        if (pr.steam) for (let i = 0; i < 4; i++) {   // 湯気
          const ph = (t * 0.35 + i * 0.63) % 1;
          g.fillStyle = 'rgba(230,237,243,' + (0.20 * (1 - ph)).toFixed(3) + ')';
          g.beginPath(); g.arc(x + Math.sin(t + i * 2.4) * pr.rx * 0.4, y - 12 - ph * 70, 10 + ph * 16, 0, 7); g.fill();
        }
        break;
      }
      case 'bigtree': {   // 御神木
        g.fillStyle = pr.mossy ? '#4c5a3a' : '#5a4630';
        g.fillRect(x - s * 0.08, y - s * 0.1, s * 0.16, s * 0.55);
        const cs = [[0, -s * 0.35, s * 0.42], [-s * 0.3, -s * 0.15, s * 0.3], [s * 0.3, -s * 0.18, s * 0.32], [0, -s * 0.62, s * 0.26]];
        for (const [dx, dy, r] of cs) {
          g.fillStyle = pr.mossy ? '#3f6b46' : '#2e6b3c';
          g.beginPath(); g.arc(x + dx, y + dy, r, 0, 7); g.fill();
        }
        g.fillStyle = 'rgba(255,255,255,.10)';
        g.beginPath(); g.arc(x - s * 0.12, y - s * 0.45, s * 0.18, 0, 7); g.fill();
        break;
      }
      case 'pillar': {   // 遺跡の柱
        const h = pr.broken ? s * 0.45 : s;
        g.fillStyle = pr.gold ? '#8a6d35' : '#6e7681';
        g.fillRect(x - s * 0.11, y - h, s * 0.22, h);
        g.fillStyle = pr.gold ? '#b0925a' : '#8b949e';
        g.fillRect(x - s * 0.15, y - h, s * 0.3, s * 0.08);
        if (!pr.broken) g.fillRect(x - s * 0.15, y - s * 0.08, s * 0.3, s * 0.08);
        if (pr.broken) { g.fillStyle = '#57606a'; g.beginPath(); g.moveTo(x - s * 0.11, y - h); g.lineTo(x + s * 0.11, y - h - s * 0.09); g.lineTo(x + s * 0.11, y - h); g.fill(); }
        break;
      }
      case 'wall': {   // 城壁・柵(石積み)
        const w = pr.w || 160, hh = 26;
        g.fillStyle = pr.ruined ? '#3a3038' : '#57606a';
        g.fillRect(x - w / 2, y - hh, w, hh);
        g.fillStyle = 'rgba(0,0,0,.25)';
        for (let bx = -w / 2; bx < w / 2; bx += 26) g.fillRect(x + bx, y - hh, 2, hh);
        if (!pr.ruined) { g.fillStyle = '#6e7681'; for (let bx = -w / 2; bx < w / 2 - 8; bx += 30) g.fillRect(x + bx, y - hh - 8, 16, 8); }
        break;
      }
      case 'tower': {   // 塔(灯台/物見/鐘楼)
        g.fillStyle = pr.c || '#8b949e';
        g.beginPath(); g.moveTo(x - s * 0.22, y); g.lineTo(x - s * 0.13, y - s); g.lineTo(x + s * 0.13, y - s); g.lineTo(x + s * 0.22, y); g.fill();
        g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x - s * 0.06, y - s * 0.45, s * 0.12, s * 0.14);
        g.fillStyle = '#30363d'; g.fillRect(x - s * 0.18, y - s * 1.06, s * 0.36, s * 0.1);
        if (pr.light) {   // 回る灯台の光
          const a = t * 0.9;
          const gr = g.createLinearGradient(x, y - s, x + Math.cos(a) * 240, y - s + Math.sin(a) * 90);
          gr.addColorStop(0, 'rgba(255,240,180,.5)'); gr.addColorStop(1, 'rgba(255,240,180,0)');
          g.fillStyle = gr;
          g.beginPath(); g.moveTo(x, y - s);
          g.lineTo(x + Math.cos(a - 0.14) * 250, y - s + Math.sin(a - 0.14) * 95);
          g.lineTo(x + Math.cos(a + 0.14) * 250, y - s + Math.sin(a + 0.14) * 95); g.fill();
          g.fillStyle = '#ffd766'; g.beginPath(); g.arc(x, y - s + 4, 6, 0, 7); g.fill();
        }
        if (pr.rod) {   // 避雷針とたまの雷光
          g.strokeStyle = '#c9d1d9'; g.lineWidth = 3;
          g.beginPath(); g.moveTo(x, y - s * 1.06); g.lineTo(x, y - s * 1.3); g.stroke();
          if (Math.sin(t * 1.7) > 0.985) {
            g.strokeStyle = '#fde047'; g.lineWidth = 2.5;
            g.beginPath(); g.moveTo(x, y - s * 1.7); g.lineTo(x + 10, y - s * 1.5); g.lineTo(x - 6, y - s * 1.42); g.lineTo(x, y - s * 1.3); g.stroke();
          }
        }
        break;
      }
      case 'furnace': {   // 大炉(赤い口と煙突、立ちのぼる煙)
        g.fillStyle = '#4d3a30'; g.fillRect(x - s * 0.4, y - s * 0.6, s * 0.8, s * 0.6);
        g.fillStyle = '#30363d'; g.fillRect(x + s * 0.12, y - s * 1.02, s * 0.16, s * 0.45);
        const fl = 0.75 + Math.sin(t * 6) * 0.25;
        g.fillStyle = 'rgba(255,120,50,' + (0.75 * fl).toFixed(2) + ')';
        g.beginPath(); g.arc(x, y - s * 0.18, s * 0.17, Math.PI, 0, true); g.fill();
        for (let i = 0; i < 3; i++) {
          const ph = (t * 0.3 + i * 0.33) % 1;
          g.fillStyle = 'rgba(160,160,170,' + (0.22 * (1 - ph)).toFixed(3) + ')';
          g.beginPath(); g.arc(x + s * 0.2 + Math.sin(t + i * 2) * 8, y - s * 1.05 - ph * 60, 8 + ph * 12, 0, 7); g.fill();
        }
        break;
      }
      case 'anvil':
        g.fillStyle = '#30363d'; g.fillRect(x - s * 0.5, y - s * 0.28, s, s * 0.2);
        g.fillRect(x - s * 0.18, y - s * 0.1, s * 0.36, s * 0.12);
        break;
      case 'crystal': {   // 結晶(氷・星・黒曜・虚無)
        g.fillStyle = pr.c || '#a5d8ff';
        g.globalAlpha = 0.9;
        g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * 0.3, y - s * 0.3); g.lineTo(x + s * 0.18, y); g.lineTo(x - s * 0.18, y); g.lineTo(x - s * 0.3, y - s * 0.35); g.fill();
        g.globalAlpha = 0.5;
        g.beginPath(); g.moveTo(x + s * 0.34, y - s * 0.6); g.lineTo(x + s * 0.52, y - s * 0.2); g.lineTo(x + s * 0.3, y); g.lineTo(x + s * 0.2, y - s * 0.16); g.fill();
        g.globalAlpha = 1;
        g.fillStyle = 'rgba(255,255,255,.35)';
        g.beginPath(); g.moveTo(x, y - s * 0.92); g.lineTo(x + s * 0.1, y - s * 0.4); g.lineTo(x - s * 0.06, y - s * 0.42); g.fill();
        break;
      }
      case 'stele': {   // 碑(歌碑・墓標の祭壇・最果ての碑)
        g.fillStyle = '#484f58';
        g.beginPath(); g.moveTo(x - s * 0.32, y); g.lineTo(x - s * 0.28, y - s * 0.85); g.arc(x, y - s * 0.85, s * 0.28, Math.PI, 0); g.lineTo(x + s * 0.32, y); g.fill();
        g.strokeStyle = pr.c || '#76e3ea'; g.lineWidth = 2;
        const gl = 0.5 + Math.sin(t * 1.4) * 0.3;
        g.globalAlpha = gl;
        for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x - s * 0.14, y - s * (0.3 + i * 0.2)); g.lineTo(x + s * 0.14, y - s * (0.3 + i * 0.2)); g.stroke(); }
        g.globalAlpha = 1;
        break;
      }
      case 'graves': {   // 小さな墓石の列
        const sc = pr.s || 1;
        for (let i = 0; i < 4; i++) {
          const gx = x + (i % 2) * 46 * sc + Math.floor(i / 2) * 24 * sc, gy = y + Math.floor(i / 2) * 40 * sc;
          g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(gx, gy + 4, 14 * sc, 5 * sc, 0, 0, 7); g.fill();
          g.fillStyle = pr.c || '#c9d1d9';
          g.fillRect(gx - 8 * sc, gy - 26 * sc, 16 * sc, 26 * sc);
          g.beginPath(); g.arc(gx, gy - 26 * sc, 8 * sc, Math.PI, 0); g.fill();
        }
        break;
      }
      case 'shrine': {   // 祠(小さな社)
        g.fillStyle = '#3d3630'; g.fillRect(x - s * 0.32, y - s * 0.42, s * 0.64, s * 0.42);
        g.fillStyle = '#57443a';
        g.beginPath(); g.moveTo(x - s * 0.46, y - s * 0.42); g.lineTo(x, y - s * 0.75); g.lineTo(x + s * 0.46, y - s * 0.42); g.fill();
        g.fillStyle = pr.c || '#76e3ea';
        const gl = 0.5 + Math.sin(t * 1.1) * 0.3;
        g.globalAlpha = gl; g.fillRect(x - s * 0.08, y - s * 0.3, s * 0.16, s * 0.2); g.globalAlpha = 1;
        break;
      }
      case 'fire': {   // 焚き火・かがり火
        g.fillStyle = '#57443a';
        g.fillRect(x - s * 0.4, y - 4, s * 0.8, 5);
        g.fillRect(x - s * 0.32, y - 9, s * 0.64, 5);
        const fl = 0.8 + Math.sin(t * 7 + x) * 0.2;
        g.fillStyle = 'rgba(255,150,60,' + (0.85 * fl).toFixed(2) + ')';
        g.beginPath(); g.moveTo(x - s * 0.2, y - 6); g.quadraticCurveTo(x, y - s * fl, x + s * 0.2, y - 6); g.fill();
        g.fillStyle = 'rgba(255,220,120,' + (0.8 * fl).toFixed(2) + ')';
        g.beginPath(); g.moveTo(x - s * 0.1, y - 6); g.quadraticCurveTo(x, y - s * 0.55 * fl, x + s * 0.1, y - 6); g.fill();
        break;
      }
      case 'lens': {   // 観測器(三脚+レンズ)
        g.strokeStyle = '#6e7681'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(x - s * 0.3, y); g.lineTo(x, y - s * 0.5); g.lineTo(x + s * 0.3, y); g.stroke();
        g.beginPath(); g.moveTo(x, y - s * 0.5); g.lineTo(x, y); g.stroke();
        g.save(); g.translate(x, y - s * 0.6); g.rotate(-0.6);
        g.fillStyle = '#30363d'; g.fillRect(-s * 0.09, -s * 0.34, s * 0.18, s * 0.4);
        g.fillStyle = '#76e3ea'; g.beginPath(); g.arc(0, -s * 0.36, s * 0.09, 0, 7); g.fill();
        g.restore();
        break;
      }
      case 'mirror': {   // 日輪の鏡
        g.fillStyle = '#57443a'; g.fillRect(x - 5, y - s * 0.55, 10, s * 0.55);
        const gl = 0.6 + Math.sin(t * 1.3 + x) * 0.25;
        g.fillStyle = '#b0925a'; g.beginPath(); g.arc(x, y - s * 0.75, s * 0.3, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,215,102,' + (0.75 * gl).toFixed(2) + ')';
        g.beginPath(); g.arc(x, y - s * 0.75, s * 0.22, 0, 7); g.fill();
        const grd = g.createRadialGradient(x, y - s * 0.75, s * 0.2, x, y - s * 0.75, s * 0.8);
        grd.addColorStop(0, 'rgba(255,215,102,' + (0.25 * gl).toFixed(2) + ')'); grd.addColorStop(1, 'rgba(255,215,102,0)');
        g.fillStyle = grd; g.beginPath(); g.arc(x, y - s * 0.75, s * 0.8, 0, 7); g.fill();
        break;
      }
      case 'moon': {   // 修道院の上の月
        const gl = 0.7 + Math.sin(t * 0.8) * 0.15;
        const grd = g.createRadialGradient(x, y, s * 0.2, x, y, s * 1.6);
        grd.addColorStop(0, 'rgba(165,216,255,' + (0.30 * gl).toFixed(2) + ')'); grd.addColorStop(1, 'rgba(165,216,255,0)');
        g.fillStyle = grd; g.beginPath(); g.arc(x, y, s * 1.6, 0, 7); g.fill();
        g.fillStyle = '#e7f0f8'; g.beginPath(); g.arc(x, y, s * 0.42, 0, 7); g.fill();
        g.fillStyle = 'rgba(140,160,190,.45)';
        g.beginPath(); g.arc(x - s * 0.12, y - s * 0.08, s * 0.09, 0, 7); g.fill();
        g.beginPath(); g.arc(x + s * 0.1, y + 6, s * 0.06, 0, 7); g.fill();
        break;
      }
      case 'herb': {   // 薬草園・畑
        const sc = pr.s || 1;
        g.fillStyle = '#3a2f26';
        g.fillRect(x - 70 * sc, y - 40 * sc, 140 * sc, 80 * sc);
        for (let r = 0; r < 3; r++) for (let cix = 0; cix < 5; cix++) {
          g.fillStyle = ['#57ab5a', '#7ee787', '#4a8f50'][((r + cix) % 3)];
          g.beginPath(); g.arc(x - 55 * sc + cix * 27 * sc, y - 24 * sc + r * 25 * sc, 6 * sc + ((r * 5 + cix) % 3), 0, 7); g.fill();
        }
        break;
      }
      case 'bonearch': {   // 竜骨のアーチ(集落のゲートの由来)
        g.strokeStyle = '#e6edf3'; g.lineWidth = 10; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x - s * 0.5, y); g.quadraticCurveTo(x, y - s * 0.85, x + s * 0.5, y); g.stroke();
        g.lineWidth = 5;
        for (let i = -2; i <= 2; i++) {
          const bx = x + i * s * 0.17, by = y - s * (0.62 - Math.abs(i) * 0.13);
          g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + (i < 0 ? -8 : 8), by + s * 0.16); g.stroke();
        }
        g.lineCap = 'butt';
        break;
      }
    }
  }
  // テーマの空気(霧・蛍・火の粉・星)
  function drawThemeAir(g, th, bnd, t){
    const bw = bnd.x1 - bnd.x0, bh = bnd.y1 - bnd.y0;
    if (th.mist) {
      for (let i = 0; i < 5; i++) {
        const mx = bnd.x0 + ((i * 373 + t * 18) % bw), my = bnd.y0 + 80 + (i * 217) % (bh - 140);
        g.fillStyle = 'rgba(180,195,185,.06)';
        g.beginPath(); g.ellipse(mx, my, 180, 60, 0, 0, 7); g.fill();
      }
    }
    if (th.fireflies || th.embers || th.stars || th.voidmist) {
      const col = th.fireflies ? '255,215,102' : th.embers ? '255,120,50' : th.stars ? '230,240,255' : '167,139,250';
      for (let i = 0; i < 14; i++) {
        const fx = bnd.x0 + ((i * 331) % bw) + Math.sin(t * 0.7 + i) * 26;
        const fy = bnd.y0 + ((i * 173 + (th.embers ? -t * 26 : t * 9)) % bh + bh) % bh;
        g.fillStyle = 'rgba(' + col + ',' + (0.25 + 0.2 * Math.sin(t * 2 + i * 1.7)).toFixed(2) + ')';
        g.beginPath(); g.arc(fx, fy, th.stars ? 1.4 : 2.2, 0, 7); g.fill();
      }
    }
    if (th.storm && Math.sin(t * 1.31) > 0.992) {
      g.fillStyle = 'rgba(253,224,71,.08)';
      g.fillRect(bnd.x0, bnd.y0, bw, bh);
    }
  }

  function draw(g, W, H2){
    const p = H.player;
    const camX = p.x - W/2, camY = p.y - H2/2;
    const bnd = bounds();
    const theme = DATA.HUB_THEME && DATA.HUB_THEME[H.area];
    // 床
    g.fillStyle = (theme && theme.floor) || (H.area === 'main' ? '#131a2b' : '#16202b');
    g.fillRect(0, 0, W, H2);
    // 床の質感: 市松ではなく決定論ノイズの石畳風のまだら
    const T = 48;
    const x0 = Math.floor(camX/T), y0 = Math.floor(camY/T);
    g.fillStyle = 'rgba(255,255,255,.025)';
    for (let iy = 0; iy <= Math.ceil(H2/T)+1; iy++) {
      for (let ix = 0; ix <= Math.ceil(W/T)+1; ix++) {
        const hh = Math.abs(Math.sin((x0+ix) * 127.1 + (y0+iy) * 311.7) * 43758.5) % 1;
        if (hh < 0.5) continue;
        g.fillRect((x0+ix)*T - camX, (y0+iy)*T - camY, T, T);
      }
    }
    g.save();
    g.translate(-camX, -camY);

    // 基地マップ: 集落の実景(中央に本殿=シンボルの元、周りに家々)。
    // 周回マップのシンボルはこの実景を縮小デフォルメしたもの。
    if (H.area.startsWith('port:')) {
      const pid = H.area.slice(5);
      const pp = DATA.PORTS.find(q => q.id === pid);
      // 右半分は海。桟橋が突き出し、船が実寸大で停泊している
      g.fillStyle = '#0d2b3d';
      g.fillRect(60, bnd.y0, bnd.x1 - 60, bnd.y1 - bnd.y0);
      g.strokeStyle = 'rgba(230,237,243,0.15)'; g.lineWidth = 2;
      const wt = performance.now() / 1000;
      for (let i = 0; i < 7; i++) {
        const wy = bnd.y0 + 60 + i * 100 + Math.sin(wt + i) * 6;
        g.beginPath(); g.moveTo(120 + (i % 3) * 60, wy); g.lineTo(200 + (i % 3) * 60, wy + 4); g.stroke();
      }
      // 桟橋(陸から海へ)
      g.fillStyle = '#6b4f2e'; g.fillRect(-80, 120, 400, 90);
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2;
      for (let px2 = -60; px2 < 320; px2 += 40) { g.beginPath(); g.moveTo(px2, 122); g.lineTo(px2, 208); g.stroke(); }
      // 船: 実寸大。修理済みなら帆船、未修理なら壊れた残骸
      Sprites.draw(g, SaveSys.data.ports[pid] ? 'boat' : 'ob_wreck', 400, 90, 300);
      // 陸側: 家々と積み荷
      Sprites.draw(g, 'ob_house', -470, bnd.y0 + 120, 104);
      Sprites.draw(g, 'ob_house2', -230, bnd.y0 + 108, 90);
      Sprites.draw(g, 'ob_crate', -360, 60, 34);
      Sprites.draw(g, 'ob_crate', -310, 84, 26);
      g.fillStyle = '#8b949e'; g.font = '13px sans-serif'; g.textAlign = 'center';
      g.fillText('― 港町「' + (pp ? pp.name : '') + '」 ―', -200, bnd.y0 + 200);
    }
    else if (H.area !== 'main') {
      const bd = DATA.BASES.find(b => b.id === H.area);
      if (bd) {
        Sprites.draw(g, bd.spr || 'st_warp', 0, bounds().y0 + 90, 190);
        Sprites.draw(g, 'ob_house', -370, bounds().y0 + 110, 90);
        Sprites.draw(g, 'ob_house2', 370, bounds().y0 + 104, 80);
        Sprites.draw(g, 'ob_house2', -390, 170, 72);
        Sprites.draw(g, 'ob_house', 390, 180, 78);
        g.fillStyle = '#8b949e'; g.font = '13px sans-serif'; g.textAlign = 'center';
        g.fillText('― ' + bd.name + '〈' + (bd.kind || '拠点') + '〉 ―', 0, bounds().y0 + 190);
      }
    }
    // 実景(HUB_THEME): 泉・御神木・大炉・湯壺・歌碑・灯台など、物語に出てくるもの
    if (theme) {
      const tt = performance.now() / 1000;
      // 奥のもの(y小)から手前へ
      const props = (theme.props || []).slice().sort((a, b2) => a.y - b2.y);
      for (const pr of props) drawProp(g, pr, tt);
      drawThemeAir(g, theme, bnd, tt);
    }
    // 広場の縁(装飾つき)
    g.strokeStyle = '#2b3654'; g.lineWidth = 6;
    g.strokeRect(bnd.x0, bnd.y0, bnd.x1 - bnd.x0, bnd.y1 - bnd.y0);
    g.strokeStyle = 'rgba(118,227,234,.14)'; g.lineWidth = 2;
    g.strokeRect(bnd.x0 + 14, bnd.y0 + 14, bnd.x1 - bnd.x0 - 28, bnd.y1 - bnd.y0 - 28);

    // 浮遊する魂の粒
    const hbT = performance.now() / 1000;
    const bw = bnd.x1 - bnd.x0, bh = bnd.y1 - bnd.y0;
    for (let i = 0; i < 26; i++) {
      const sx = bnd.x0 + 40 + ((i * 331) % (bw - 80));
      const sy = bnd.y0 + (((hbT * (8 + i % 5 * 4) + i * 197)) % bh);
      g.fillStyle = `hsla(${185 + (i % 3) * 30}, 80%, 70%, ${0.10 + (i % 3) * 0.06})`;
      g.beginPath(); g.arc(sx + Math.sin(hbT + i) * 14, bnd.y0 + bh - (sy - bnd.y0), 2 + (i % 3), 0, 7); g.fill();
    }

    // 施設
    for (const s of H.list) {
      const v = stationVisual(s);
      const glow = H.interact === s;
      const sx = s.x + (s.ox || 0), sy = s.y + (s.oy || 0);
      const gg = g.createRadialGradient(sx, sy + 20, 4, sx, sy + 20, 66);
      gg.addColorStop(0, glow ? 'rgba(255,215,102,.30)' : 'rgba(118,227,234,.12)');
      gg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gg;
      g.beginPath(); g.arc(sx, sy + 20, 66, 0, 7); g.fill();
      Sprites.draw(g, v.spr, sx, sy, 84);
      labelChip(g, sx, sy + 62, v.label, glow ? '#ffd766' : '#c9d1d9', 12);
    }

    // プレイヤー(魂verは少し透ける)
    g.globalAlpha = 0.92;
    Sprites.draw(g, 'player', p.x, p.y, 36, p.dir < 0);
    g.globalAlpha = 1;

    g.restore();

    drawVignette(g, W, H2);

    // 上部情報: HUDと同じ「暗いガラスのピル」
    g.font = 'bold 16px sans-serif'; g.textAlign = 'left';
    const leftTxt = areaName() + '  🪙 ' + fmtNum(SaveSys.data.coins);
    const lw = g.measureText(leftTxt).width + 26;
    g.fillStyle = 'rgba(8,12,22,.62)';
    rrPath(g, 10, 8, lw, 30, 15); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.10)'; g.lineWidth = 1;
    rrPath(g, 10, 8, lw, 30, 15); g.stroke();
    g.fillStyle = '#ffd766';
    g.fillText(leftTxt, 23, 29);
    g.font = '12.5px sans-serif'; g.textAlign = 'right';
    const rightTxt = '周回 ' + SaveSys.data.stats.runs + ' / 最長 ' + fmtTime(SaveSys.data.stats.bestTime);
    const rw = g.measureText(rightTxt).width + 24;
    g.fillStyle = 'rgba(8,12,22,.62)';
    rrPath(g, W - rw - 10, 10, rw, 26, 13); g.fill();
    g.fillStyle = '#8b949e';
    g.fillText(rightTxt, W - 22, 28);

    drawFacilityMap(g, W);
  }

  // 角丸長方形パス / 名札チップ / ビネット(周回画面と同じデザイン言語)
  function rrPath(g, x, y, w, h, r){
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function labelChip(g, x, y, text, color, size){
    const fs = size || 10.5;
    g.font = (fs >= 11 ? 'bold ' : '') + fs + 'px sans-serif';
    const w = g.measureText(text).width + 14;
    const h = fs + 9;
    g.fillStyle = 'rgba(8,12,22,.62)';
    rrPath(g, x - w / 2, y - h + 3, w, h, h / 2); g.fill();
    g.fillStyle = color; g.textAlign = 'center';
    g.fillText(text, x, y - 3);
  }
  let vigCache = null;
  function drawVignette(g, W, H2){
    if (!vigCache || vigCache.w !== W || vigCache.h !== H2) {
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H2;
      const c = cv.getContext('2d');
      const grd = c.createRadialGradient(W / 2, H2 / 2, Math.min(W, H2) * 0.44, W / 2, H2 / 2, Math.hypot(W, H2) / 2);
      grd.addColorStop(0, 'rgba(6,10,20,0)');
      grd.addColorStop(1, 'rgba(6,10,20,.30)');
      c.fillStyle = grd; c.fillRect(0, 0, W, H2);
      vigCache = { cv, w: W, h: H2 };
    }
    g.drawImage(vigCache.cv, 0, 0);
  }

  // 施設マップ: どこに何のパワーアップ施設があるか一目でわかる
  function drawFacilityMap(g, W){
    const bnd = bounds();
    const mw = Math.min(200, Math.floor(W * 0.36));
    const scale = mw / (bnd.x1 - bnd.x0);
    const mh = Math.ceil((bnd.y1 - bnd.y0) * scale);
    const x0 = W - mw - 10, y0 = 48;
    g.fillStyle = '#0c1120';   // 下の実景が透けないように不透明
    rrPath(g, x0 - 5, y0 - 5, mw + 10, mh + 27, 10); g.fill();
    g.fillStyle = '#070c16';
    rrPath(g, x0, y0, mw, mh, 6); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1;
    rrPath(g, x0, y0, mw, mh, 6); g.stroke();
    const pt = (wx, wy) => ({ x: x0 + (wx - bnd.x0) * scale, y: y0 + (wy - bnd.y0) * scale });
    g.textAlign = 'center';
    g.save();
    rrPath(g, x0, y0, mw, mh, 6); g.clip();   // ラベルが枠からはみ出さないように
    for (const s of H.list) {
      const q = pt(s.x, s.y);
      const col = s.kind === 'gate' ? '#76e3ea' : s.kind === 'stats' ? '#8b949e' : '#ffd766';
      g.fillStyle = col;
      g.beginPath(); g.arc(q.x, q.y, 3, 0, 7); g.fill();
      const v = stationVisual(s);
      const short = s.kind === 'meta' && SHORT_NAMES[s.st] ? SHORT_NAMES[s.st] : v.short;
      g.font = '9px sans-serif';
      g.fillStyle = H.interact === s ? '#ffd766' : '#c9d1d9';
      g.fillText(short, q.x, q.y - 6);
    }
    const pq = pt(H.player.x, H.player.y);
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(pq.x, pq.y, 3, 0, 7); g.fill();
    g.restore();
    g.fillStyle = '#8b949e'; g.font = '10px sans-serif'; g.textAlign = 'center';
    g.fillText('施設マップ', x0 + mw / 2, y0 + mh + 16);
  }

  return { enter, update, draw, doInteract, travel, enterFromRun, get state(){ return H; } };
})();
