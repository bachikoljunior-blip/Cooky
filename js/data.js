// =============================================================
// data.js - 全ゲームデータ / バランス定義
// =============================================================
'use strict';

const DATA = {};

// ---------------- 素材 ----------------
// unlock: 魂の広場の研究所で解放しないと世界に出現しない素材
DATA.MATERIALS = {
  jelly:   { name:'スライムゼリー', color:'#7ee787', tier:0 },
  bone:    { name:'骨のかけら',     color:'#e6edf3', tier:0 },
  hide:    { name:'獣の毛皮',       color:'#b08968', tier:0 },
  wood:    { name:'木材',           color:'#8b5a2b', tier:0 },
  scrap:   { name:'鉄クズ',         color:'#9aa5b1', tier:1 },
  crystal: { name:'水晶',           color:'#a5d8ff', tier:1 },
  shell:   { name:'貝殻',           color:'#ffd6a5', tier:1, sea:true },
  magic:   { name:'魔石',           color:'#c084fc', tier:2, unlock:'lab_mat_magic' },
  coral:   { name:'珊瑚',           color:'#ff8fa3', tier:2, sea:true, unlock:'lab_mat_coral' },
  scale:   { name:'竜のうろこ',     color:'#2dd4bf', tier:3, unlock:'lab_mat_scale' },
  star:    { name:'星のかけら',     color:'#fde047', tier:3, unlock:'lab_mat_star' },
  abyss:   { name:'深淵の核',       color:'#a78bfa', tier:4, unlock:'lab_mat_abyss' },
};

// コスト生成ヘルパ: lv(1〜)に応じて素材要求が増え、高レベルで上位素材が混ざる
function matCost(lv, base, extras){
  // base: {mat: qty} lv1時 / extras: [{from: lv, mat, qty}]
  const c = {};
  const mul = 1 + (lv - 1) * 0.65;
  for (const m in base) c[m] = Math.ceil(base[m] * mul);
  if (extras) for (const e of extras) {
    if (lv >= e.from) c[e.mat] = Math.ceil(e.qty * (1 + (lv - e.from) * 0.5));
  }
  return c;
}

// ---------------- スキル ----------------
// stats(lv) は run.js の各スキル実装が参照する数値群
// lvText[lv-2] = lv へ上げた時の強化説明(レベルごとに違う強化)
DATA.SKILLS = {
  bolt: {
    name:'マジックボルト', icon:'sk_bolt', innate:true,
    desc:'最も近い敵へ自動で魔弾を放つ。最初から持っている基本攻撃。',
    cost:(lv)=>matCost(lv,{jelly:3,bone:2},[{from:4,mat:crystalKey(),qty:2},{from:7,mat:'magic',qty:2}]),
    lvText:['威力+50%','2連射になる','連射間隔-20%','威力+60%','3連射になる','貫通+1','連射間隔-25%','威力+80%','4連射・弾速アップ'],
    stats:(lv)=>({ dmg:10*Math.pow(1.5,Math.min(lv-1,3))*(lv>=8?1.8:1)*(lv>=5?1.6:1),
      count:1+(lv>=2?1:0)+(lv>=5?1:0)+(lv>=9?1:0),
      cd:0.9*(lv>=3?0.8:1)*(lv>=7?0.75:1), pierce:(lv>=6?1:0), speed:420*(lv>=9?1.3:1) }),
  },
  homing: {
    name:'追尾ミサイル', icon:'sk_homing',
    desc:'敵を追尾する魔法ミサイルを放つ。',
    cost:(lv)=>matCost(lv,{bone:4,scrap:2},[{from:3,mat:'crystal',qty:2},{from:6,mat:'magic',qty:3}]),
    lvText:['同時発射+1','威力+70%','同時発射+1','追尾性能・弾速アップ','威力+80%','同時発射+2','爆発するようになる'],
    stats:(lv)=>({ dmg:14*Math.pow(1.75,(lv>=3?1:0)+(lv>=6?1:0)), count:1+(lv>=2?1:0)+(lv>=4?1:0)+(lv>=7?2:0),
      cd:1.6, turn:(lv>=5?7:3.5), speed:300*(lv>=5?1.3:1), blast:(lv>=8?70:0) }),
  },
  orbit: {
    name:'オービットオーブ', icon:'sk_orbit',
    desc:'自分の周囲を回るオーブ。触れた敵にダメージ。',
    cost:(lv)=>matCost(lv,{jelly:4,crystal:2},[{from:4,mat:'magic',qty:2},{from:7,mat:'star',qty:1}]),
    lvText:['オーブ+1','回転速度アップ','威力+75%','オーブ+1','範囲(半径)拡大','威力+80%','オーブ+2・巨大化'],
    stats:(lv)=>({ dmg:9*Math.pow(1.75,(lv>=4?1:0)+(lv>=7?1:0)), count:2+(lv>=2?1:0)+(lv>=5?1:0)+(lv>=8?2:0),
      radius:70+(lv>=6?35:0), spin:2+(lv>=3?1.2:0), size:12*(lv>=8?1.5:1) }),
  },
  chain: {
    name:'チェインライトニング', icon:'sk_chain',
    desc:'敵から敵へ連鎖する稲妻。集団に強い。',
    cost:(lv)=>matCost(lv,{scrap:4,crystal:3},[{from:3,mat:'magic',qty:2},{from:6,mat:'star',qty:1}]),
    lvText:['連鎖+2','威力+60%','連鎖+2','発動間隔-25%','威力+80%','連鎖+3・射程アップ'],
    stats:(lv)=>({ dmg:16*Math.pow(1.6,(lv>=3?1:0)+(lv>=6?1:0)), jumps:3+(lv>=2?2:0)+(lv>=4?2:0)+(lv>=7?3:0),
      cd:2.4*(lv>=5?0.75:1), range:240*(lv>=7?1.3:1) }),
  },
  flame: {
    name:'フレイムリング', icon:'sk_flame',
    desc:'周囲に炎の波動を放ち、触れた敵を燃やす。',
    cost:(lv)=>matCost(lv,{hide:4,wood:3},[{from:3,mat:'scrap',qty:3},{from:6,mat:'magic',qty:3}]),
    lvText:['範囲拡大','延焼ダメージ追加','威力+70%','発動間隔-30%','範囲拡大・威力+50%','延焼強化・威力+70%'],
    stats:(lv)=>({ dmg:12*Math.pow(1.7,(lv>=4?1:0))*(lv>=6?1.5:1)*(lv>=7?1.7:1),
      radius:90+(lv>=2?30:0)+(lv>=6?40:0), cd:2.2*(lv>=5?0.7:1), burn:(lv>=3?4:0)*(lv>=7?2.5:1) }),
  },
  nova: {
    name:'フロストノヴァ', icon:'sk_nova',
    desc:'氷の衝撃波で敵を減速させる。生存の要。',
    cost:(lv)=>matCost(lv,{crystal:4,jelly:3},[{from:4,mat:'shell',qty:3},{from:7,mat:'coral',qty:2}]),
    lvText:['減速強化','範囲拡大','威力+80%','短時間の凍結付与','発動間隔-30%','凍結時間+・威力+80%'],
    stats:(lv)=>({ dmg:8*Math.pow(1.8,(lv>=4?1:0)+(lv>=7?1:0)), radius:120+(lv>=3?50:0),
      slow:0.35+(lv>=2?0.2:0), slowDur:2.5, freeze:(lv>=5?0.6:0)+(lv>=7?0.6:0), cd:3.5*(lv>=6?0.7:1) }),
  },
  poison: {
    name:'ポイズンミスト', icon:'sk_poison',
    desc:'移動した跡に毒の霧を残す。触れた敵は継続ダメージ。',
    cost:(lv)=>matCost(lv,{jelly:5,hide:3},[{from:3,mat:'shell',qty:2},{from:6,mat:'coral',qty:2}]),
    lvText:['霧が大きくなる','持続時間+50%','毒ダメージ+80%','霧の発生間隔-40%','毒が敵の防御を下げる','毒ダメージ+100%・巨大化'],
    stats:(lv)=>({ dps:6*Math.pow(1.8,(lv>=4?1:0))*(lv>=7?2:1), size:46+(lv>=2?20:0)+(lv>=7?26:0),
      dur:4*(lv>=3?1.5:1), interval:0.55*(lv>=5?0.6:1), shred:(lv>=6?0.25:0) }),
  },
  axe: {
    name:'ブーメランアクス', icon:'sk_axe',
    desc:'投げた斧が戻ってくる。往復で2回当たる。',
    cost:(lv)=>matCost(lv,{wood:4,scrap:3},[{from:4,mat:'hide',qty:4},{from:7,mat:'scale',qty:1}]),
    lvText:['同時投擲+1','威力+65%','飛距離アップ','同時投擲+1','威力+80%','巨大な斧になる(範囲+)'],
    stats:(lv)=>({ dmg:20*Math.pow(1.65,(lv>=3?1:0)+(lv>=6?1:0)), count:1+(lv>=2?1:0)+(lv>=5?1:0),
      cd:2.0, range:260+(lv>=4?90:0), size:14*(lv>=7?1.7:1) }),
  },
  thunder: {
    name:'サンダーフォール', icon:'sk_thunder',
    desc:'ランダムな敵の頭上に落雷。単体高火力。',
    cost:(lv)=>matCost(lv,{crystal:5,magic:1},[{from:3,mat:'magic',qty:3},{from:6,mat:'star',qty:2}]),
    lvText:['落雷数+1','威力+70%','落雷数+1','範囲(爆風)追加','威力+90%','落雷数+2・爆風拡大'],
    stats:(lv)=>({ dmg:36*Math.pow(1.7,(lv>=3?1:0))*(lv>=6?1.9:1), count:1+(lv>=2?1:0)+(lv>=4?1:0)+(lv>=7?2:0),
      cd:2.8, blast:(lv>=5?60:26)*(lv>=7?1.5:1) }),
  },
  turret: {
    name:'オートタレット', icon:'sk_turret',
    desc:'その場に自動砲台を設置する。設置数に上限あり。',
    cost:(lv)=>matCost(lv,{scrap:6,wood:4},[{from:3,mat:'crystal',qty:3},{from:6,mat:'magic',qty:4}]),
    lvText:['設置上限+1','連射速度アップ','威力+70%','設置上限+1','射程アップ','威力+90%・2丁掃射'],
    stats:(lv)=>({ dmg:9*Math.pow(1.7,(lv>=4?1:0))*(lv>=7?1.9:1), maxTurrets:1+(lv>=2?1:0)+(lv>=5?1:0),
      fireCd:0.8*(lv>=3?0.6:1), range:280+(lv>=6?100:0), dual:(lv>=7), placeCd:9, life:20 }),
  },
  shield: {
    name:'ガーディアンシールド', icon:'sk_shield',
    desc:'ダメージを1回無効化するバリアを張る。',
    cost:(lv)=>matCost(lv,{bone:5,crystal:3},[{from:3,mat:'shell',qty:3},{from:6,mat:'scale',qty:1}]),
    lvText:['再展開が早くなる','バリア展開時に周囲を弾き飛ばす','ストック+1','再展開がさらに早く','割れた時に爆発ダメージ','ストック+1'],
    stats:(lv)=>({ stocks:1+(lv>=4?1:0)+(lv>=7?1:0), cd:14*(lv>=2?0.75:1)*(lv>=5?0.7:1),
      knock:(lv>=3), burst:(lv>=6?60:0) }),
  },
  sanctuary: {
    name:'サンクチュアリ', icon:'sk_sanct',
    desc:'自分と仲間のHPを徐々に回復するオーラ。',
    cost:(lv)=>matCost(lv,{jelly:6,shell:2},[{from:3,mat:'magic',qty:2},{from:6,mat:'coral',qty:3}]),
    lvText:['回復量+60%','範囲拡大(仲間に届きやすく)','回復量+60%','オーラ内の敵を微減速','回復量+80%・範囲拡大'],
    stats:(lv)=>({ hps:1.5*Math.pow(1.6,(lv>=2?1:0)+(lv>=4?1:0))*(lv>=6?1.8:1),
      radius:110+(lv>=3?50:0)+(lv>=6?50:0), slow:(lv>=5?0.15:0) }),
  },
  magnetSk: {
    name:'マグネットフィールド', icon:'sk_magnet',
    desc:'アイテムの回収範囲が広がる。',
    cost:(lv)=>matCost(lv,{scrap:3,jelly:3}),
    lvText:['回収範囲+40%','たまに全画面吸引(30秒毎)','回収範囲+50%','全画面吸引の間隔-10秒'],
    stats:(lv)=>({ mult:1.5+(lv>=2?0.4:0)+(lv>=4?0.5:0), vacuum:(lv>=3), vacuumCd:(lv>=5?20:30) }),
  },
  boots: {
    name:'ヘルメスの靴', icon:'sk_boots',
    desc:'移動速度が上がる。逃げる敵(ヒーラー等)を追うのに必須級。',
    cost:(lv)=>matCost(lv,{hide:4,bone:3}),
    lvText:['移動速度+8%','ダッシュの残像が敵にダメージ','移動速度+10%','移動速度+12%'],
    stats:(lv)=>({ mult:1.1+(lv>=2?0.08:0)+(lv>=4?0.10:0)+(lv>=5?0.12:0), trail:(lv>=3?5:0) }),
  },
  warbanner: {
    name:'ウォーバナー', icon:'sk_banner',
    desc:'仲間の攻撃力とHPを強化する軍旗。仲間主体の戦術に。',
    cost:(lv)=>matCost(lv,{hide:5,wood:5},[{from:3,mat:'magic',qty:2}]),
    lvText:['仲間攻撃+20%','仲間HP+30%','仲間攻撃+25%','仲間の移動速度+20%','仲間攻撃+35%・HP+35%'],
    stats:(lv)=>({ atk:1.2+(lv>=2?0.2:0)+(lv>=4?0.25:0)+(lv>=6?0.35:0),
      hp:1+(lv>=3?0.3:0)+(lv>=6?0.35:0), spd:(lv>=5?1.2:1) }),
  },
  // ---- 魂の広場で解放するスキル ----
  laser: {
    name:'プリズムレーザー', icon:'sk_laser', unlock:'lib_sk_laser',
    desc:'貫通する極太レーザーを一直線に放つ。【要解放】',
    cost:(lv)=>matCost(lv,{magic:4,crystal:6},[{from:4,mat:'star',qty:2}]),
    lvText:['威力+70%','照射時間+','2方向に発射','威力+90%','4方向に発射'],
    stats:(lv)=>({ dmg:30*Math.pow(1.7,(lv>=2?1:0))*(lv>=5?1.9:1), cd:4.5, dur:0.6*(lv>=3?1.6:1),
      beams:1+(lv>=4?1:0)+(lv>=6?2:0), width:18 }),
  },
  meteor: {
    name:'メテオストーム', icon:'sk_meteor', unlock:'lib_sk_meteor',
    desc:'広範囲に隕石を降らせる大火力スキル。【要解放】',
    cost:(lv)=>matCost(lv,{magic:5,scale:1},[{from:3,mat:'star',qty:2},{from:5,mat:'abyss',qty:1}]),
    lvText:['隕石+2','威力+80%','隕石+2','爆発範囲拡大','隕石+3・威力+100%'],
    stats:(lv)=>({ dmg:50*Math.pow(1.8,(lv>=3?1:0))*(lv>=6?2:1), count:3+(lv>=2?2:0)+(lv>=4?2:0)+(lv>=6?3:0),
      cd:6, blast:80*(lv>=5?1.4:1) }),
  },
  sands: {
    name:'時の砂', icon:'sk_sands', unlock:'lib_sk_sands',
    desc:'周期的に周囲の敵の時を遅らせる。終焉の刻の切り札。【要解放】',
    cost:(lv)=>matCost(lv,{star:2,magic:6},[{from:3,mat:'abyss',qty:1}]),
    lvText:['減速率アップ','効果時間+50%','範囲拡大','発動間隔-25%','ほぼ静止級の減速'],
    stats:(lv)=>({ slow:0.4+(lv>=2?0.15:0)+(lv>=6?0.25:0), dur:3*(lv>=3?1.5:1),
      radius:220+(lv>=4?120:0), cd:12*(lv>=5?0.75:1) }),
  },
  dragonbreath: {
    name:'ドラゴンブレス', icon:'sk_breath', unlock:'lib_sk_breath',
    desc:'移動方向へ焼き尽くす吐息を放つ。【要解放】',
    cost:(lv)=>matCost(lv,{scale:2,magic:4},[{from:4,mat:'abyss',qty:1}]),
    lvText:['威力+70%','範囲(角度)拡大','持続+','威力+90%','超射程・威力+80%'],
    stats:(lv)=>({ dps:35*Math.pow(1.7,(lv>=2?1:0))*(lv>=5?1.9:1)*(lv>=6?1.8:1),
      arc:0.6+(lv>=3?0.35:0), range:170+(lv>=6?130:0), dur:1.4*(lv>=4?1.5:1), cd:5 }),
  },
};
function crystalKey(){ return 'crystal'; }

DATA.SKILL_BASE_CAP = 5; // 書庫の上限解放で +1 ずつ(最大10)
DATA.SKILL_CAP_MAX = 10;

// ---------------- 敵 ----------------
// env: land / sea / both, move: chase / kite / wander
// heal: {radius, hps} を持つ敵はヒーラー(kite挙動で距離を保つ)
DATA.ENEMIES = {
  slime:    { name:'スライム',        hp:12,  dmg:6,  speed:55,  r:12, tier:0, env:'land', move:'chase', coin:1, sprite:'en_slime',  drops:[{m:'jelly',c:.4}] },
  bat:      { name:'コウモリ',        hp:8,   dmg:5,  speed:95,  r:10, tier:0, env:'both', move:'chase', coin:1, sprite:'en_bat',    drops:[{m:'hide',c:.3}] },
  skeleton: { name:'スケルトン',      hp:20,  dmg:9,  speed:60,  r:13, tier:0, env:'land', move:'chase', coin:2, sprite:'en_skel',   drops:[{m:'bone',c:.45}] },
  wolf:     { name:'ウルフ',          hp:26,  dmg:11, speed:120, r:13, tier:1, env:'land', move:'chase', coin:3, sprite:'en_wolf',   drops:[{m:'hide',c:.45}] },
  goblin:   { name:'ゴブリン弓兵',    hp:22,  dmg:8,  speed:70,  r:12, tier:1, env:'land', move:'chase', ranged:{range:260,cd:2.2,pspeed:200}, coin:3, sprite:'en_goblin', drops:[{m:'wood',c:.35},{m:'scrap',c:.2}] },
  shaman:   { name:'回復シャーマン',  hp:34,  dmg:5,  speed:178,  r:13, tier:1, env:'land', move:'kite',  heal:{radius:220,hps:6}, coin:8, sprite:'en_shaman', drops:[{m:'crystal',c:.5},{m:'magic',c:.25}] },
  crab:     { name:'アイアンクラブ',  hp:40,  dmg:10, speed:50,  r:14, tier:1, env:'both', move:'chase', armor:.3, coin:4, sprite:'en_crab',  drops:[{m:'shell',c:.5}] },
  orc:      { name:'オーク',          hp:60,  dmg:16, speed:75,  r:16, tier:2, env:'land', move:'chase', coin:5, sprite:'en_orc',    drops:[{m:'hide',c:.4},{m:'scrap',c:.3}] },
  golem:    { name:'ストーンゴーレム',hp:150, dmg:24, speed:40,  r:20, tier:2, env:'land', move:'chase', armor:.4, coin:9, sprite:'en_golem', drops:[{m:'scrap',c:.5},{m:'crystal',c:.3}] },
  wisp:     { name:'ウィスプ',        hp:30,  dmg:13, speed:150, r:10, tier:2, env:'both', move:'chase', coin:5, sprite:'en_wisp',   drops:[{m:'crystal',c:.4},{m:'magic',c:.2}] },
  jellyfish:{ name:'クラゲ',          hp:30,  dmg:12, speed:65,  r:13, tier:1, env:'sea',  move:'chase', coin:4, sprite:'en_jelly',  drops:[{m:'shell',c:.4},{m:'jelly',c:.3}] },
  shark:    { name:'シャーク',        hp:80,  dmg:20, speed:135, r:16, tier:2, env:'sea',  move:'chase', coin:7, sprite:'en_shark',  drops:[{m:'hide',c:.4},{m:'coral',c:.3}] },
  siren:    { name:'セイレーン',      hp:60,  dmg:8,  speed:188, r:13, tier:2, env:'sea',  move:'kite',  heal:{radius:240,hps:12}, coin:14, sprite:'en_siren', drops:[{m:'coral',c:.5},{m:'star',c:.15}] },
  lizard:   { name:'リザードマン',    hp:90,  dmg:20, speed:95,  r:15, tier:2, env:'both', move:'chase', coin:7, sprite:'en_lizard', drops:[{m:'scale',c:.3},{m:'hide',c:.3}] },
  ogre:     { name:'オーガ',          hp:220, dmg:32, speed:65,  r:20, tier:3, env:'land', move:'chase', coin:12, sprite:'en_ogre',  drops:[{m:'hide',c:.5},{m:'magic',c:.3}] },
  knight:   { name:'ダークナイト',    hp:280, dmg:36, speed:85,  r:16, tier:3, env:'land', move:'chase', armor:.35, coin:15, sprite:'en_knight', drops:[{m:'scrap',c:.6},{m:'magic',c:.35}] },
  necro:    { name:'ネクロマンサー',  hp:180, dmg:12, speed:195, r:14, tier:3, env:'land', move:'kite', heal:{radius:260,hps:25}, coin:25, sprite:'en_necro', drops:[{m:'magic',c:.6},{m:'star',c:.2}] },
  serpent:  { name:'シーサーペント',  hp:320, dmg:38, speed:110, r:20, tier:3, env:'sea',  move:'chase', coin:16, sprite:'en_serpent', drops:[{m:'coral',c:.5},{m:'scale',c:.35}] },
  whelp:    { name:'ドラゴンチャイルド', hp:260, dmg:30, speed:105, r:15, tier:3, env:'both', move:'chase', ranged:{range:240,cd:2.5,pspeed:240}, coin:18, sprite:'en_whelp', drops:[{m:'scale',c:.5},{m:'star',c:.2}] },
  dragon:   { name:'エンシェントドラゴン', hp:900, dmg:55, speed:90, r:24, tier:4, env:'both', move:'chase', ranged:{range:300,cd:2.2,pspeed:280}, coin:45, sprite:'en_dragon', drops:[{m:'scale',c:.7},{m:'abyss',c:.25}] },
  demon:    { name:'デーモン',        hp:700, dmg:60, speed:110, r:20, tier:4, env:'land', move:'chase', coin:40, sprite:'en_demon', drops:[{m:'magic',c:.6},{m:'abyss',c:.25}] },
  abysslord:{ name:'アビスロード',    hp:1200,dmg:70, speed:95,  r:24, tier:4, env:'sea',  move:'chase', armor:.3, coin:60, sprite:'en_abyss', drops:[{m:'abyss',c:.5},{m:'star',c:.4}] },
  reaper:   { name:'終焉のリーパー',  hp:45000, dmg:160, speed:130, r:24, tier:9, env:'both', move:'chase', coin:250, sprite:'en_reaper', isReaper:true, drops:[{m:'abyss',c:.8},{m:'star',c:.8}] },
};

// ボス: minute = 出現時刻(分)
DATA.BOSSES = [
  { at:5,  base:'golem',   name:'巨壁のゴーレム',   hpMul:14, dmgMul:1.6, coin:80,  sprite:'boss_golem' },
  { at:10, base:'wolf',    name:'牙王フェンリル',   hpMul:90, dmgMul:2.2, coin:150, sprite:'boss_fenrir' },
  { at:15, base:'necro',   name:'冥府公リッチ',     hpMul:45, dmgMul:2.5, coin:250, sprite:'boss_lich' },
  { at:20, base:'serpent', name:'海淵のリヴァイア', hpMul:40, dmgMul:2.5, coin:350, sprite:'boss_levia' },
  { at:25, base:'demon',   name:'魔王グリモワール', hpMul:35, dmgMul:2.8, coin:500, sprite:'boss_demon' },
];

// ---------------- 世界 ----------------
DATA.CONTINENTS = [
  { id:'main',  x:0,     y:0,     r:2600, seed:11, name:'始まりの大陸' },
  { id:'east',  x:6400,  y:300,   r:1700, seed:23, name:'竜骨の大陸' },
  { id:'west',  x:-6400, y:-500,  r:1700, seed:37, name:'黄昏の大陸' },
  { id:'north', x:500,   y:-6400, r:1600, seed:41, name:'星降りの大陸' },
  { id:'south', x:-400,  y:6400,  r:1600, seed:53, name:'深緑の大陸' },
  { id:'ne',    x:4800,  y:-4800, r:1300, seed:67, name:'白亜の島' },
  { id:'sw',    x:-4800, y:4800,  r:1300, seed:71, name:'黒曜の島' },
];

// 基地: unlock条件=8秒チャネリング。gateStation = 魂の広場の専用強化
DATA.BASES = [
  { id:'b_north', name:'北の砦',     x:60,    y:-1500, cont:'main' },
  { id:'b_east',  name:'東の遺跡',   x:1650,  y:850,   cont:'main' },
  { id:'b_south', name:'南の泉',     x:-250,  y:1750,  cont:'main' },
  { id:'b_west',  name:'西の炉',     x:-1800, y:-350,  cont:'main' },
  { id:'b_dragon',name:'竜骨の前哨', x:6400,  y:300,   cont:'east' },
  { id:'b_dusk',  name:'黄昏の前哨', x:-6400, y:-500,  cont:'west' },
  { id:'b_star',  name:'星降りの祭壇', x:500, y:-6400, cont:'north' },
  { id:'b_green', name:'深緑の社',   x:-400,  y:6400,  cont:'south' },
  { id:'b_white', name:'白亜の灯台', x:4800,  y:-4800, cont:'ne' },
  { id:'b_black', name:'黒曜の祠',   x:-4800, y:4800,  cont:'sw' },
];

// 港: 始まりの大陸の沿岸8方位。ship修理条件は港ごとに異なる
DATA.PORTS = [
  { id:'p_e',  name:'東の港',   angle:0,           repair:{ coins:150,  mats:{wood:15, scrap:8} } },
  { id:'p_ne', name:'北東の港', angle:-Math.PI/4,  repair:{ coins:300,  mats:{wood:20, scrap:12, shell:6} } },
  { id:'p_n',  name:'北の港',   angle:-Math.PI/2,  repair:{ coins:500,  mats:{wood:25, crystal:10, shell:10} } },
  { id:'p_nw', name:'北西の港', angle:-Math.PI*3/4,repair:{ coins:800,  mats:{wood:30, scrap:20, magic:5} } },
  { id:'p_w',  name:'西の港',   angle:Math.PI,     repair:{ coins:1200, mats:{wood:35, crystal:15, magic:8} } },
  { id:'p_sw', name:'南西の港', angle:Math.PI*3/4, repair:{ coins:1800, mats:{wood:40, shell:20, coral:6} } },
  { id:'p_s',  name:'南の港',   angle:Math.PI/2,   repair:{ coins:2500, mats:{wood:50, coral:10, scale:3} } },
  { id:'p_se', name:'南東の港', angle:Math.PI/4,   repair:{ coins:4000, mats:{wood:60, scale:6, star:3} } },
];

// ---------------- 魂の広場(死後フィールド)の恒久強化 ----------------
// cost(lv): 次のレベルの金額 (lv=現在Lv, 0開始)
function gcost(base, growth){ return (lv)=>Math.floor(base*Math.pow(growth,lv)); }

DATA.META = {
  // --- 強化の祭壇(戦闘) ---
  altar_hp:     { st:'altar', name:'生命力',       desc:'最大HP +20',            max:40, cost:gcost(15,1.32),  },
  altar_atk:    { st:'altar', name:'攻撃力',       desc:'全ダメージ +8%',        max:40, cost:gcost(20,1.34),  },
  altar_speed:  { st:'altar', name:'健脚',         desc:'移動速度 +3%',          max:15, cost:gcost(30,1.5),   },
  altar_regen:  { st:'altar', name:'自然治癒',     desc:'HP自動回復 +0.5/秒',    max:20, cost:gcost(40,1.42),  },
  altar_armor:  { st:'altar', name:'鉄の皮膚',     desc:'被ダメージ -2%(最大60%)', max:30, cost:gcost(35,1.4) },
  altar_crit:   { st:'altar', name:'会心の心得',   desc:'クリティカル率 +2%(2倍ダメージ)', max:25, cost:gcost(50,1.42) },
  altar_revive: { st:'altar', name:'不死鳥の羽',   desc:'周回中に1回復活(HP50%)', max:3,  cost:gcost(3000,6) },
  // --- 素材研究所(経済) ---
  lab_drop:     { st:'lab', name:'採集の心得',     desc:'素材ドロップ率 +10%',   max:30, cost:gcost(25,1.36) },
  lab_coin:     { st:'lab', name:'金運',           desc:'コイン獲得量 +10%',     max:30, cost:gcost(25,1.36) },
  lab_magnet:   { st:'lab', name:'磁力',           desc:'アイテム回収範囲 +12%', max:15, cost:gcost(20,1.45) },
  lab_luck:     { st:'lab', name:'幸運',           desc:'素材が2個落ちる確率 +4%', max:20, cost:gcost(60,1.4) },
  lab_starter:  { st:'lab', name:'出撃支度',       desc:'開始時に基本素材を+2ずつ所持', max:10, cost:gcost(100,1.6) },
  lab_mat_magic:{ st:'lab', name:'【解放】魔石',   desc:'新素材「魔石」が世界に出現する', max:1, cost:gcost(400,1) },
  lab_mat_coral:{ st:'lab', name:'【解放】珊瑚',   desc:'新素材「珊瑚」が海域に出現する', max:1, cost:gcost(1500,1) },
  lab_mat_scale:{ st:'lab', name:'【解放】竜のうろこ', desc:'新素材「竜のうろこ」が出現する', max:1, cost:gcost(6000,1) },
  lab_mat_star: { st:'lab', name:'【解放】星のかけら', desc:'新素材「星のかけら」が出現する', max:1, cost:gcost(15000,1) },
  lab_mat_abyss:{ st:'lab', name:'【解放】深淵の核', desc:'新素材「深淵の核」が出現する', max:1, cost:gcost(50000,1) },
  // --- 仲間の宿舎 ---
  camp_recruit: { st:'camp', name:'カリスマ',      desc:'敵が仲間になる確率 +1%(基本3%)', max:22, cost:gcost(40,1.38) },
  camp_cap:     { st:'camp', name:'隊列拡張',      desc:'仲間の同時上限 +1(基本3)', max:12, cost:gcost(80,1.75) },
  camp_hp:      { st:'camp', name:'仲間の生命',    desc:'仲間HP +15%',           max:30, cost:gcost(30,1.35) },
  camp_atk:     { st:'camp', name:'仲間の闘志',    desc:'仲間攻撃力 +12%',       max:30, cost:gcost(30,1.35) },
  camp_heal:    { st:'camp', name:'仲間介抱',      desc:'仲間HP自動回復 +1%/秒', max:10, cost:gcost(120,1.6) },
  camp_revive:  { st:'camp', name:'魂の絆',        desc:'倒れた仲間が30%で踏みとどまる(HP1)', max:5, cost:gcost(500,2.2) },
  // --- スキル書庫 ---
  lib_sk_laser: { st:'lib', name:'【解放】プリズムレーザー', desc:'スキル「プリズムレーザー」が出現候補になる', max:1, cost:gcost(800,1) },
  lib_sk_meteor:{ st:'lib', name:'【解放】メテオストーム', desc:'スキル「メテオストーム」が出現候補になる', max:1, cost:gcost(2500,1) },
  lib_sk_breath:{ st:'lib', name:'【解放】ドラゴンブレス', desc:'スキル「ドラゴンブレス」が出現候補になる', max:1, cost:gcost(8000,1) },
  lib_sk_sands: { st:'lib', name:'【解放】時の砂', desc:'スキル「時の砂」が出現候補になる', max:1, cost:gcost(20000,1) },
  lib_cap:      { st:'lib', name:'スキル上限解放', desc:'全スキルの最大レベル +1(基本5)', max:5, cost:gcost(1000,3.2) },
  lib_cdr:      { st:'lib', name:'詠唱加速',       desc:'スキルの発動間隔 -2%(最大40%)', max:20, cost:gcost(80,1.42) },
  // --- 基地ゲート専用強化(基地を解放すると買えるようになる) ---
  g_north_thorn: { st:'b_north', name:'茨の鎧',    desc:'接触してきた敵に反撃ダメージ +5', max:20, cost:gcost(150,1.4) },
  g_north_wall:  { st:'b_north', name:'城壁の加護',desc:'HPが30%以下の時、被ダメージ -3%', max:15, cost:gcost(200,1.45) },
  g_east_cdr:    { st:'b_east', name:'古代の叡智', desc:'スキル発動間隔 -1.5%(書庫と加算)', max:20, cost:gcost(180,1.42) },
  g_east_area:   { st:'b_east', name:'魔力増幅',   desc:'スキルの効果範囲 +4%',  max:20, cost:gcost(180,1.42) },
  g_south_heal:  { st:'b_south', name:'癒しの水',  desc:'HP自動回復 +1/秒',      max:15, cost:gcost(220,1.45) },
  g_south_potion:{ st:'b_south', name:'霊薬精製',  desc:'敵が回復ポーション(HP20%)を落とす確率 +0.4%', max:10, cost:gcost(300,1.5) },
  g_west_fire:   { st:'b_west', name:'業火の刻印', desc:'全ダメージ +5%(祭壇と加算)', max:25, cost:gcost(250,1.4) },
  g_west_boss:   { st:'b_west', name:'巨人殺し',   desc:'ボスへのダメージ +8%',  max:20, cost:gcost(300,1.42) },
  g_dragon_res:  { st:'b_dragon', name:'竜鱗の守り', desc:'リーパーからの被ダメージ -6%(最大90%)', max:15, cost:gcost(2000,1.5) },
  g_dusk_slay:   { st:'b_dusk', name:'終焉狩り',   desc:'リーパーへのダメージ +15%', max:20, cost:gcost(2000,1.5) },
  g_star_time:   { st:'b_star', name:'星読みの加護', desc:'敵の時間経過による強化を3%緩和(最大45%)', max:15, cost:gcost(3000,1.55) },
  g_green_ally:  { st:'b_green', name:'森の恵み',  desc:'仲間の全能力 +8%',      max:15, cost:gcost(2500,1.5) },
  g_white_gold:  { st:'b_white', name:'白亜の商才', desc:'コイン獲得量 +15%(金運と加算)', max:15, cost:gcost(3000,1.5) },
  g_black_dark:  { st:'b_black', name:'黒曜の契約', desc:'全ダメージ+10% / 最大HP+40', max:15, cost:gcost(4000,1.55) },
};

DATA.STATIONS = {
  altar: { name:'強化の祭壇',   sprite:'st_altar', desc:'基礎能力を鍛える' },
  lab:   { name:'素材研究所',   sprite:'st_lab',   desc:'素材と経済の研究' },
  camp:  { name:'仲間の宿舎',   sprite:'st_camp',  desc:'仲間を強くする' },
  lib:   { name:'スキル書庫',   sprite:'st_lib',   desc:'スキルの解放と上限' },
};

// 時間による敵強化(分あたり)。星読みで緩和可能
DATA.TIME_HP_GROWTH = 1.115;   // HP: ×1.115^分 (30分で約26倍)
DATA.TIME_DMG_GROWTH = 1.055;  // ダメージ: 30分で約5倍
DATA.DIST_RING = 1150;         // 距離リング幅(px)
DATA.REAPER_AT = 1800;         // 終焉の刻(秒)
