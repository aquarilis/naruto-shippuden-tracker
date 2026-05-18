/* ══════════════════════════════════════
   Combat — JS
   ══════════════════════════════════════ */

// ── State ──────────────────────────────────────────────
let G = {};

function startCombatWithParams(name, maxHP, maxChakra, opponent, opponentXp, playerImage, opponentImage) {
  G = {
    name,
    maxHP,
    maxChakra,
    hp: maxHP,
    chakra: maxChakra,
    opponent: opponent || null,
    opponentXp: opponentXp || 0,
    playerImage: playerImage || null,
    opponentImage: opponentImage || null,
    round: 1,
    action: 1,
    log: [],
    history: []
  };
  _prevHP = null;
  _prevChakra = null;

  document.getElementById('log').innerHTML = '';
  show('combatScreen');
  hide('endScreen');
  hide('roundOverlay');
  hide('recordScreen');
  hide('actionModal');

  renderCombat();
}

// ── Render ─────────────────────────────────────────────
let _prevHP = null, _prevChakra = null;

function flashBar(barId, fxClass) {
  const track = document.getElementById(barId).parentElement;
  track.classList.remove('fx-damage', 'fx-heal');
  void track.offsetWidth;
  track.classList.add(fxClass);
  track.addEventListener('animationend', () => track.classList.remove(fxClass), { once: true });
}

function flashImage(fxClass) {
  const img = document.getElementById('playerImage');
  if (!img || !G.playerImage) return;
  img.classList.remove('img-fx-damage', 'img-fx-heal', 'img-fx-chakra');
  void img.offsetWidth;
  img.classList.add(fxClass);
  img.addEventListener('animationend', () => img.classList.remove(fxClass), { once: true });
}

function applyBlinkClass(barId, ratio) {
  const bar = document.getElementById(barId);
  bar.classList.remove('fx-blink-slow', 'fx-blink-medium', 'fx-blink-fast');
  if      (ratio < 0.10) bar.classList.add('fx-blink-fast');
  else if (ratio < 0.25) bar.classList.add('fx-blink-medium');
  else if (ratio < 0.50) bar.classList.add('fx-blink-slow');
}

function renderCombat() {
  document.getElementById('combatTitle').textContent = G.opponent ? `${G.name} vs. ${G.opponent}` : G.name;

  const imgWrap = document.getElementById('playerImageWrap');
  const imgEl = document.getElementById('playerImage');
  if (G.playerImage) {
    imgEl.src = `img/roster/${G.playerImage}`;
    imgWrap.style.display = 'flex';
  } else {
    imgWrap.style.display = 'none';
  }
  document.getElementById('labelRounds').textContent = `Rounds ${G.round}/3`;
  document.getElementById('labelActions').textContent = `Action ${G.action}/3`;
  document.getElementById('actionLabel').textContent = G.action;

  document.getElementById('dispHP').textContent = G.hp;
  document.getElementById('dispMaxHP').textContent = G.maxHP;
  {
    const total = Math.max(G.hp, G.maxHP);
    const basePct = pct(Math.min(G.hp, G.maxHP), total);
    const overPct = G.hp > G.maxHP ? pct(G.hp - G.maxHP, total) : 0;
    document.getElementById('barHP').style.width = basePct + '%';
    document.getElementById('barHPOver').style.width = overPct + '%';
  }
  if (_prevHP !== null && G.hp !== _prevHP) {
    flashBar('barHP', G.hp < _prevHP ? 'fx-damage' : 'fx-heal');
  }
  applyBlinkClass('barHP', G.hp / G.maxHP);

  document.getElementById('dispChakra').textContent = G.chakra;
  document.getElementById('dispMaxChakra').textContent = G.maxChakra;
  {
    const total = Math.max(G.chakra, G.maxChakra);
    const basePct = pct(Math.min(G.chakra, G.maxChakra), total);
    const overPct = G.chakra > G.maxChakra ? pct(G.chakra - G.maxChakra, total) : 0;
    document.getElementById('barChakra').style.width = basePct + '%';
    document.getElementById('barChakraOver').style.width = overPct + '%';
  }
  if (_prevChakra !== null && G.chakra !== _prevChakra) {
    flashBar('barChakra', G.chakra < _prevChakra ? 'fx-damage' : 'fx-heal');
  }
  applyBlinkClass('barChakra', G.chakra / G.maxChakra);

  if (_prevHP !== null) {
    const damaged      = G.hp      < _prevHP;
    const healed       = G.hp      > _prevHP || G.chakra > _prevChakra;
    const chakraSpent  = G.chakra  < _prevChakra && G.hp === _prevHP;
    if      (damaged)     flashImage('img-fx-damage');
    else if (chakraSpent) flashImage('img-fx-chakra');
    else if (healed)      flashImage('img-fx-heal');
  }

  _prevHP = G.hp;
  _prevChakra = G.chakra;

  renderPips('roundPips', 3, G.round);
  renderPips('actionPips', 3, G.action);

  const undoBtn = document.getElementById('undoBtn');
  if (undoBtn) undoBtn.disabled = G.history.length === 0;

  resetInputs();
  renderLog();
}

function renderPips(id, total, current) {
  const el = document.getElementById(id);
  el.innerHTML = '';
  for (let i = 1; i <= total; i++) {
    const d = document.createElement('div');
    d.className = 'pip' + (i < current ? ' done' : i === current ? ' active' : '');
    el.appendChild(d);
  }
}

function renderLog() {
  const el = document.getElementById('log');
  if (G.log.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = [...G.log].reverse()
    .map(e => `<div class="log-entry">${e}</div>`)
    .join('');
}

function resetInputs() {
  document.getElementById('inputChakra').value = 0;
  document.getElementById('inputDmg').value = 0;
  document.getElementById('chakraWarn').style.display = 'none';
}

// ── Undo ─────────────────────────────────────────────────
function pushSnapshot() {
  G.history.push({ hp: G.hp, chakra: G.chakra, round: G.round, action: G.action, log: [...G.log] });
}

function undoLastAction() {
  if (G.history.length === 0) return;
  const snap = G.history.pop();
  G.hp     = snap.hp;
  G.chakra = snap.chakra;
  G.round  = snap.round;
  G.action = snap.action;
  G.log    = snap.log;
  renderCombat();
}

// ── Action logic ─────────────────────────────────────────
function confirmAction() {
  const chakraSpent = Math.max(0, parseInt(document.getElementById('inputChakra').value) || 0);
  const dmg         = Math.max(0, parseInt(document.getElementById('inputDmg').value) || 0);

  closeActionModal();
  pushSnapshot();

  const warn = document.getElementById('chakraWarn');
  if (chakraSpent > G.chakra) {
    warn.style.display = 'block';
  }

  G.chakra = Math.max(0, G.chakra - chakraSpent);
  G.hp = Math.max(0, G.hp - dmg);

  const parts = [];
  if (chakraSpent > 0) parts.push(`<span class="c-chakra">−${chakraSpent} PC</span>`);
  if (dmg > 0)         parts.push(`<span class="c-hp">−${dmg} PV</span>`);
  const effect = parts.length ? parts.join(', ') : 'aucun effet';
  G.log.push(`<b>Round ${G.round} - Action ${G.action}</b> ${effect} → ❤️${G.hp} 💙${G.chakra}`);

  if (G.hp <= 0) {
    endCombat('ko');
    return;
  }

  if (G.action < 3) {
    G.action++;
    renderCombat();
  } else {
    endOfRound();
  }
}

function endOfRound() {
  if (G.round >= 3) {
    endCombat('egalite');
    return;
  }

  const before = G.chakra;
  G.chakra += G.maxChakra;
  const nextRound = G.round + 1;

  document.getElementById('overlayTitle').textContent = `Round ${nextRound} !`;
  document.getElementById('overlayBody').innerHTML =
    `Fin du Round <strong>${G.round}</strong>.<br><br>` +
    `<span class="c-chakra">Recharge chakra</span> : ${before} + ${G.maxChakra} = <strong>${G.chakra} PC</strong><br><br>` +
    `Les PV ne sont pas rechargés entre les rounds.`;

  G.log.push(`<span class="c-round">── Fin Round ${G.round} • Début Round ${nextRound} • Chakra : ${before} + ${G.maxChakra} = ${G.chakra} PC ──</span>`);

  G.round = nextRound;
  G.action = 1;

  show('roundOverlay');
}

function closeOverlay() {
  hide('roundOverlay');
  renderCombat();
}

// ── End ────────────────────────────────────────────────
function endCombat(reason) {
  renderCombat();
  hide('combatScreen');
  hide('roundOverlay');

  if (reason === 'ko') {
    show('defeatModal');
  } else {
    show('recordScreen');
    document.getElementById('teamLogoRecord').src = getTeamLogoPath(getGameData().team);
  }
}

// ── Helpers ────────────────────────────────────────────
function pct(val, max) {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, (val / max) * 100));
}

function step(id, delta) {
  const el = document.getElementById(id);
  el.value = Math.max(0, (parseInt(el.value) || 0) + delta);
  if (id === 'inputChakra') {
    const warn = document.getElementById('chakraWarn');
    warn.style.display = (parseInt(el.value) || 0) > G.chakra ? 'block' : 'none';
  }
}

function openRenforcementModal() {
  document.getElementById('renforcementHeal').value = 0;
  document.getElementById('renforcementChakra').value = 0;
  show('renforcementModal');
}

function closeRenforcementModal() { hide('renforcementModal'); }

function openImageZoom(src) {
  document.getElementById('imageZoomImg').src = src;
  show('imageZoomModal');
}

function closeImageZoom() { hide('imageZoomModal'); }

function confirmRenfort() {
  const hpHeal = Math.max(0, parseInt(document.getElementById('renforcementHeal').value) || 0);
  const pcHeal = Math.max(0, parseInt(document.getElementById('renforcementChakra').value) || 0);
  closeRenforcementModal();

  if (hpHeal === 0 && pcHeal === 0) return;

  pushSnapshot();

  G.hp     += hpHeal;
  G.chakra += pcHeal;

  const parts = [];
  if (hpHeal > 0) parts.push(`<span class="c-heal">+${hpHeal} PV</span>`);
  if (pcHeal > 0) parts.push(`<span class="c-chakra">+${pcHeal} PC</span>`);
  G.log.push(`<b>💚 Renfort</b> (Round ${G.round}) ${parts.join(', ')} → ❤️${G.hp} 💙${G.chakra}`);

  renderCombat();
}

function openEndCombatModal() { show('endCombatModal'); }
function closeEndCombatModal() { hide('endCombatModal'); }

function confirmEndCombat() {
  closeEndCombatModal();
  openXpModal();
}

function openActionModal() { show('actionModal'); }
function closeActionModal() { hide('actionModal'); }

function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }

function openXpModal() {
  document.getElementById('xpCharacter').value = G.opponentXp || 0;
  document.getElementById('xpMission').value = 0;
  document.getElementById('xpSecondary').value = 0;
  show('xpModal');
}

function closeXpModal() { hide('xpModal'); }

function confirmXpAndSave() {
  const xpCharacter = Math.max(0, parseInt(document.getElementById('xpCharacter').value) || 0);
  const xpMission   = Math.max(0, parseInt(document.getElementById('xpMission').value) || 0);
  const xpSecondary = Math.max(0, parseInt(document.getElementById('xpSecondary').value) || 0);
  closeXpModal();
  recordResult('win', { xpCharacter, xpMission, xpSecondary });
}

function recordResult(result, xp) {
  const gameData = getGameData();
  const turn = {
    turnNumber: gameData.turns.length + 1,
    playerCharacter: {
      name: G.name,
      hp: G.maxHP,
      chakra: G.maxChakra,
      roster_image: G.playerImage || null
    },
    opponent: G.opponent || null,
    opponentImage: G.opponentImage || null,
    result: result,
    combatRounds: G.round,
    combatLog: [...G.log],
    exp: result === 'win' ? (xp || null) : null
  };
  gameData.turns.push(turn);
  sessionStorage.setItem('gameData', JSON.stringify(gameData));

  window.location.href = 'game_tracker.html';
}

function resetGame() {
  window.location.href = 'character_selection.html';
}

function initFromURL() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('name') || 'Ninja';
  const hp = parseInt(params.get('hp')) || 0;
  const chakra = parseInt(params.get('chakra')) || 0;
  const opponent = params.get('opponent') || null;
  const opponentXp = parseInt(params.get('opponentXp')) || 0;
  const playerImage = params.get('playerImage') || null;
  const opponentImage = params.get('opponentImage') || null;

  const gameData = getGameData();
  const team = gameData.team || null;

  if (!team || hp <= 0 || chakra <= 0) {
    window.location.href = 'index.html';
    return;
  }

  const teamLogoElem = document.getElementById('teamLogo');
  if (teamLogoElem) teamLogoElem.src = getTeamLogoPath(team);

  startCombatWithParams(name, hp, chakra, opponent, opponentXp, playerImage, opponentImage);
}

window.addEventListener('load', initFromURL);
