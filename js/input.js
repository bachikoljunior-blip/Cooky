// =============================================================
// input.js - キーボード + 仮想スティック(タッチ)
// =============================================================
'use strict';

const Input = (() => {
  const keys = {};
  let stick = { active:false, id:null, ox:0, oy:0, dx:0, dy:0 };
  const pressedOnce = {};   // 1フレーム限りのキー押下

  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    keys[e.code] = true;
    pressedOnce[e.code] = true;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab','Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  // ---- 仮想スティック ----
  const zone = document.getElementById('stick-zone');
  const base = document.getElementById('stick-base');
  const knob = document.getElementById('stick-knob');
  const R = 45;

  function stickStart(x, y, id){
    stick.active = true; stick.id = id; stick.ox = x; stick.oy = y; stick.dx = 0; stick.dy = 0;
    base.style.display = 'block';
    base.style.left = (x - 60) + 'px'; base.style.top = (y - 60) + 'px';
    knob.style.left = '35px'; knob.style.top = '35px';
  }
  function stickMove(x, y){
    let dx = x - stick.ox, dy = y - stick.oy;
    const len = Math.hypot(dx, dy);
    if (len > R) { dx = dx / len * R; dy = dy / len * R; }
    stick.dx = dx / R; stick.dy = dy / R;
    knob.style.left = (35 + dx) + 'px'; knob.style.top = (35 + dy) + 'px';
  }
  function stickEnd(){
    stick.active = false; stick.id = null; stick.dx = 0; stick.dy = 0;
    base.style.display = 'none';
  }

  zone.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.changedTouches[0];
    if (!stick.active) stickStart(t.clientX, t.clientY, t.identifier);
    document.body.classList.add('touch-mode');
    document.getElementById('touch-buttons').classList.remove('hidden');
  }, { passive:false });
  zone.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === stick.id) stickMove(t.clientX, t.clientY);
  }, { passive:false });
  const endH = e => { for (const t of e.changedTouches) if (t.identifier === stick.id) stickEnd(); };
  zone.addEventListener('touchend', endH);
  zone.addEventListener('touchcancel', endH);

  // マウスでもスティック操作可能(デバッグ用)
  zone.addEventListener('mousedown', e => { stickStart(e.clientX, e.clientY, 'mouse'); });
  window.addEventListener('mousemove', e => { if (stick.active && stick.id === 'mouse') stickMove(e.clientX, e.clientY); });
  window.addEventListener('mouseup', () => { if (stick.id === 'mouse') stickEnd(); });

  // 移動ベクトル取得 (-1..1)
  function axis(){
    let x = 0, y = 0;
    if (keys['KeyW'] || keys['ArrowUp']) y -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) y += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) x -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) x += 1;
    if (x || y) { const l = Math.hypot(x, y); return { x:x/l, y:y/l }; }
    if (stick.active) return { x: stick.dx, y: stick.dy };
    return { x:0, y:0 };
  }

  function once(code){ const v = !!pressedOnce[code]; pressedOnce[code] = false; return v; }
  function endFrame(){ for (const k in pressedOnce) pressedOnce[k] = false; }

  return { axis, once, endFrame, keys };
})();
