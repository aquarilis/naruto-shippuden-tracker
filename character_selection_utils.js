/* ══════════════════════════════════════
   Character Selection — JS
   ══════════════════════════════════════ */

let roster = [];
let selectedCharacter = null;
let selectedOpponent = null;
let unlockPlayer = false;
let unlockOpponent = false;
let showStats = false;
let playerSwapped = false;
let opponentSwapped = false;

// ── View mode (list | carousel) ───────────────────────────
const _sharedMode = localStorage.getItem('viewMode') || 'carousel';
const viewModes = { player: _sharedMode, opponent: _sharedMode };

// carousel state per context
const carouselState = {
  player:   { items: [], index: 0, floatIndex: 0, momentum: null, selected: null },
  opponent: { items: [], index: 0, floatIndex: 0, momentum: null, selected: null }
};

const CAROUSEL_CFG = {
  cardWidth: 110,
  spread: 155,
  zStep: 60,
  rotY: 42,
  scaleStep: 0.18,
  opacityStep: 0.28
};

function buildCarousel(context, characters, currentTurn, onSelect, forceUnlock) {
  const cs = carouselState[context];
  const stageId   = context === 'player' ? 'characterCarouselStage' : 'opponentCarouselStage';
  const dotsId    = context === 'player' ? 'characterCarouselDots'  : 'opponentCarouselDots';
  const stage = document.getElementById(stageId);
  const dotsEl = document.getElementById(dotsId);
  stage.innerHTML = '';
  dotsEl.innerHTML = '';

  const sorted = sortCharacters([...characters], currentTurn, forceUnlock);
  cs.items = sorted;
  cs.index = 0;
  if (cs.selected) {
    const idx = sorted.findIndex(c => c.display_name === cs.selected.display_name);
    if (idx >= 0) cs.index = idx;
  }

  sorted.forEach((c, i) => {
    const isOpponentCtx = context === 'opponent';
    const sameAsPlayer = isOpponentCtx && isSameAsPlayer(c);
    const available = !sameAsPlayer && isAvailable(c, currentTurn, forceUnlock);
    const defeated = !forceUnlock && !sameAsPlayer && isDefeated(c);
    const notYet = !forceUnlock && !sameAsPlayer && !defeated && c.available_from_turn > currentTurn;
    const card = document.createElement('div');
    card.className = 'carousel-card' + (available ? '' : ' cc-unavailable');
    card.dataset.index = i;
    card.style.pointerEvents = 'none';

    const frame = document.createElement('div');
    frame.className = 'cc-frame';

    const img = document.createElement('img');
    img.src = c.roster_image ? `img/roster/${c.roster_image}` : '';
    img.alt = c.display_name;
    img.loading = 'lazy';
    frame.appendChild(img);

    if (sameAsPlayer) {
      const overlay = document.createElement('div');
      overlay.className = 'cc-chosen-overlay';
      overlay.innerHTML = '<span class="chosen-icon">🔒</span><span class="chosen-label">Déjà choisi</span>';
      frame.appendChild(overlay);
    } else if (defeated) {
      const overlay = document.createElement('div');
      overlay.className = 'cc-defeated-overlay';
      overlay.innerHTML = '<span class="defeated-x">💀</span><span class="defeated-label">Vaincu(e)</span>';
      frame.appendChild(overlay);
    } else if (notYet) {
      const overlay = document.createElement('div');
      overlay.className = 'cc-pending-overlay';
      overlay.innerHTML = '<span class="pending-icon">⏳</span><span class="pending-label">Hors tour</span>';
      frame.appendChild(overlay);
    }

    card.appendChild(frame);

    const tourLabel = document.createElement('div');
    tourLabel.className = 'cc-tour-label';
    const naturallyAvailable = isAvailable(c, currentTurn, false);
    tourLabel.textContent = (forceUnlock && !naturallyAvailable ? '🔓 ' : '') + availabilityLabel(c);
    card.appendChild(tourLabel);

    stage.appendChild(card);

    const dot = document.createElement('div');
    dot.className = 'carousel-dot';
    dot.dataset.index = i;
    dot.addEventListener('click', () => carouselGoTo(context, i));
    dotsEl.appendChild(dot);
  });

  stage.onclick = e => {
    const stageRect = stage.getBoundingClientRect();
    const clickX = e.clientX - stageRect.left - stageRect.width / 2;
    const cards = stage.querySelectorAll('.carousel-card');
    let nearest = cs.index, minDist = Infinity;
    cards.forEach((card, i) => {
      const offset = i - cs.index;
      const cardX = offset * CAROUSEL_CFG.spread;
      const dist = Math.abs(clickX - cardX);
      if (dist < minDist) { minDist = dist; nearest = i; }
    });
    if (nearest !== cs.index) carouselGoTo(context, nearest);
    const c = cs.items[nearest];
    const sameAsPlayer = context === 'opponent' && isSameAsPlayer(c);
    const available = !sameAsPlayer && isAvailable(c, currentTurn, forceUnlock);
    cards.forEach(el => el.classList.remove('cc-selected'));
    if (available) {
      cs.selected = c;
      onSelect(c);
      updateCarouselInfo(context, c, available, currentTurn);
      cards[nearest].classList.add('cc-selected');
    } else {
      cs.selected = null;
      const btn = document.getElementById(context === 'player' ? 'nextBtn' : 'startBtn');
      btn.disabled = true; btn.style.opacity = '';
      if (context === 'player') selectedCharacter = null;
      else selectedOpponent = null;
    }
  };

  carouselRender(context);
  setupCarouselSwipe(context);
}

function carouselGoTo(context, index) {
  const cs = carouselState[context];
  cs.index = Math.max(0, Math.min(cs.items.length - 1, index));
  carouselRender(context);
}

function carouselRenderVisual(context, floatIdx) {
  const stageId = context === 'player' ? 'characterCarouselStage' : 'opponentCarouselStage';
  const dotsId  = context === 'player' ? 'characterCarouselDots'  : 'opponentCarouselDots';
  const stage = document.getElementById(stageId);
  if (!stage) return;

  const cfg = CAROUSEL_CFG;
  const cards = stage.querySelectorAll('.carousel-card');
  const dots  = document.getElementById(dotsId).querySelectorAll('.carousel-dot');
  const nearestIdx = Math.round(floatIdx);

  cards.forEach((card, i) => {
    const offset = i - floatIdx;
    const absOffset = Math.abs(offset);
    const x = offset * cfg.spread;
    const z = -absOffset * cfg.zStep;
    const ry = -offset * cfg.rotY;
    const scale = Math.max(0.35, 1 - absOffset * cfg.scaleStep);
    const opacity = Math.max(0.1, 1 - absOffset * cfg.opacityStep);
    const zIndex = 100 - Math.floor(absOffset);

    card.style.transform = `translateX(${x}px) translateZ(${z}px) rotateY(${ry}deg) scale(${scale})`;
    card.style.opacity = opacity;
    card.style.zIndex = zIndex;
    card.classList.toggle('cc-center', i === nearestIdx);
  });

  dots.forEach((dot, i) => dot.classList.toggle('active', i === nearestIdx));
}

function carouselRender(context) {
  const cs = carouselState[context];
  const stageId = context === 'player' ? 'characterCarouselStage' : 'opponentCarouselStage';
  const stage = document.getElementById(stageId);
  if (!stage) return;

  cs.floatIndex = cs.index;
  carouselRenderVisual(context, cs.index);

  const cards = stage.querySelectorAll('.carousel-card');
  const gameData = getGameData();
  const currentTurn = gameData.turns.length + 1;
  const unlock = context === 'player' ? unlockPlayer : unlockOpponent;

  const c = cs.items[cs.index];
  if (c) {
    const sameAsPlayer = context === 'opponent' && isSameAsPlayer(c);
    const available = !sameAsPlayer && isAvailable(c, currentTurn, unlock);
    updateCarouselInfo(context, c, available, currentTurn, sameAsPlayer);
    const stageEl = document.getElementById(stageId);
    if (available) {
      cs.selected = c;
      if (context === 'player') {
        selectedCharacter = c;
        const btn = document.getElementById('nextBtn');
        btn.disabled = false; btn.style.opacity = '';
      } else {
        selectedOpponent = c;
        const btn = document.getElementById('startBtn');
        btn.disabled = false; btn.style.opacity = '';
      }
      stageEl.querySelectorAll('.carousel-card').forEach((card, i) => {
        card.classList.toggle('cc-selected', cs.items[i].display_name === c.display_name);
      });
    } else {
      cs.selected = null;
      if (context === 'player') {
        selectedCharacter = null;
        const btn = document.getElementById('nextBtn');
        btn.disabled = true; btn.style.opacity = '';
      } else {
        selectedOpponent = null;
        const btn = document.getElementById('startBtn');
        btn.disabled = true; btn.style.opacity = '';
      }
      stageEl.querySelectorAll('.carousel-card').forEach(el => el.classList.remove('cc-selected'));
    }
  }
}

function updateCarouselInfo(context, c, available, currentTurn, sameAsPlayer) {
  const prefix = context === 'player' ? 'character' : 'opponent';
  document.getElementById(`${prefix}CarouselStats`).textContent = showStats ? formatStats(c) : '';
}

function toggleStats() {
  showStats = !showStats;
  const label = showStats ? '👁 Stats ✓' : '👁 Stats';
  document.querySelectorAll('#statsToggleBtn, #statsToggleBtn2').forEach(b => b.textContent = label);

  const gameData = getGameData();
  const currentTurn = gameData.turns.length + 1;

  ['player', 'opponent'].forEach(context => {
    const cs = carouselState[context];
    if (cs && cs.items.length && viewModes[context] === 'carousel') {
      const c = cs.items[cs.index];
      const unlock = context === 'player' ? unlockPlayer : unlockOpponent;
      const sameAsPlayer = context === 'opponent' && isSameAsPlayer(c);
      const available = !sameAsPlayer && isAvailable(c, currentTurn, unlock);
      updateCarouselInfo(context, c, available, currentTurn, sameAsPlayer);
    }
    const prefix = context === 'player' ? 'character' : 'opponent';
    const listStats = document.getElementById(`${prefix}ListStats`);
    if (listStats && listStats.dataset.statsText) {
      listStats.textContent = showStats ? listStats.dataset.statsText : '';
    }
  });
}

function setupCarouselSwipe(context) {
  const wrapId = context === 'player' ? 'characterCarouselWrap' : 'opponentCarouselWrap';
  const wrap = document.getElementById(wrapId);
  if (wrap._swipeBound) return;
  wrap._swipeBound = true;

  let touchStartX    = null;
  let touchStartY    = null;
  let touchStartIdx  = 0;
  let touchLastX     = null;
  let touchLastTime  = null;
  let lockAxis       = null;
  let velocityX      = 0;    // cards/sec (positive = rightward = decreasing index)

  const VELOCITY_CAP    = 18;   // max cards/sec
  const MOMENTUM_THRESH = 1.5;  // min cards/sec to trigger momentum
  const DECAY           = 0.97; // velocity multiplier per frame (~60fps)

  function setCardTransitions(stageId, enabled) {
    const stage = document.getElementById(stageId);
    if (!stage) return;
    stage.querySelectorAll('.carousel-card').forEach(card => {
      card.style.transition = enabled ? '' : 'none';
    });
  }

  function snapAndSelect() {
    const cs = carouselState[context];
    if (cs.momentum) {
      cancelAnimationFrame(cs.momentum);
      cs.momentum = null;
    }
    const stageId = context === 'player' ? 'characterCarouselStage' : 'opponentCarouselStage';
    setCardTransitions(stageId, true);
    cs.index = Math.round(Math.max(0, Math.min(cs.items.length - 1, cs.floatIndex)));
    cs.floatIndex = cs.index;
    carouselRender(context);
  }

  function launchMomentum(vel) {
    const cs = carouselState[context];
    const stageId = context === 'player' ? 'characterCarouselStage' : 'opponentCarouselStage';
    setCardTransitions(stageId, false);

    let lastTime = performance.now();

    function frame(now) {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      vel *= Math.pow(DECAY, dt * 60);
      cs.floatIndex += vel * dt;
      cs.floatIndex = Math.max(0, Math.min(cs.items.length - 1, cs.floatIndex));

      carouselRenderVisual(context, cs.floatIndex);

      const atEdge = cs.floatIndex <= 0 || cs.floatIndex >= cs.items.length - 1;
      if (Math.abs(vel) > 0.15 && !atEdge) {
        cs.momentum = requestAnimationFrame(frame);
      } else {
        snapAndSelect();
      }
    }

    cs.momentum = requestAnimationFrame(frame);
  }

  wrap.ontouchstart = e => {
    const cs = carouselState[context];
    if (cs.momentum) {
      snapAndSelect();
      // absorb this touch — don't start a new drag
      touchStartX = null;
      return;
    }
    const stageId = context === 'player' ? 'characterCarouselStage' : 'opponentCarouselStage';
    setCardTransitions(stageId, false);
    touchStartX   = e.touches[0].clientX;
    touchStartY   = e.touches[0].clientY;
    touchStartIdx = cs.floatIndex;
    touchLastX    = touchStartX;
    touchLastTime = performance.now();
    lockAxis      = null;
    velocityX     = 0;
  };

  wrap.addEventListener('touchmove', e => {
    if (touchStartX === null) return;
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;
    if (!lockAxis) {
      lockAxis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      if (lockAxis === 'h') window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
    if (lockAxis === 'h') {
      e.preventDefault();
      const now = performance.now();
      const dt  = (now - touchLastTime) / 1000;
      if (dt > 0.008) {
        const dxFromLast = e.touches[0].clientX - touchLastX;
        velocityX  = Math.max(-VELOCITY_CAP, Math.min(VELOCITY_CAP, -(dxFromLast / CAROUSEL_CFG.spread) / dt));
        touchLastX    = e.touches[0].clientX;
        touchLastTime = now;
      }
      const cs = carouselState[context];
      cs.floatIndex = Math.max(0, Math.min(cs.items.length - 1, touchStartIdx - dx / CAROUSEL_CFG.spread));
      carouselRenderVisual(context, cs.floatIndex);
    }
  }, { passive: false });

  wrap.ontouchend = e => {
    if (touchStartX === null) return;
    const stageId = context === 'player' ? 'characterCarouselStage' : 'opponentCarouselStage';
    if (lockAxis === 'h') {
      if (Math.abs(velocityX) > MOMENTUM_THRESH) {
        launchMomentum(velocityX);
      } else {
        snapAndSelect();
      }
    } else {
      setCardTransitions(stageId, true);
    }
    touchStartX = null;
    touchStartY = null;
    lockAxis    = null;
  };

  wrap.tabIndex = 0;
  wrap.onkeydown = e => {
    if (e.key === 'ArrowLeft')  carouselGoTo(context, carouselState[context].index - 1);
    if (e.key === 'ArrowRight') carouselGoTo(context, carouselState[context].index + 1);
  };

  let wheelTimer = null;
  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    if (wheelTimer) return;
    const dir = e.deltaY > 0 || e.deltaX > 0 ? 1 : -1;
    carouselGoTo(context, carouselState[context].index + dir);
    wheelTimer = setTimeout(() => { wheelTimer = null; }, 200);
  }, { passive: false });
}

function toggleViewMode(context) {
  const mode = viewModes[context] === 'list' ? 'carousel' : 'list';
  viewModes.player = mode;
  viewModes.opponent = mode;
  localStorage.setItem('viewMode', mode);
  const gameData = getGameData();
  const currentTurn = gameData.turns.length + 1;
  ['player', 'opponent'].forEach(ctx => {
    applyViewMode(ctx);
    const chars = getActiveRoster(ctx);
    const unlock = ctx === 'player' ? unlockPlayer : unlockOpponent;
    const onSel  = ctx === 'player' ? onCharacterSelect : onOpponentSelect;
    if (mode === 'carousel') {
      buildCarousel(ctx, chars, currentTurn, onSel, unlock);
    } else {
      const gridId = ctx === 'player' ? 'characterGrid' : 'opponentGrid';
      buildRosterGrid(gridId, chars, currentTurn, onSel, unlock);
      setupGridWheel(gridId);
    }
  });
}

function applyViewMode(context) {
  const mode = viewModes[context];
  const isPlayer = context === 'player';
  const gridEl      = document.getElementById(isPlayer ? 'characterGrid'     : 'opponentGrid');
  const carouselEl  = document.getElementById(isPlayer ? 'characterCarousel' : 'opponentCarousel');
  const toggleBtn   = document.getElementById(isPlayer ? 'viewTogglePlayer'  : 'viewToggleOpponent');
  const listInfoEl  = document.getElementById(isPlayer ? 'characterListInfo' : 'opponentListInfo');

  gridEl.style.display     = mode === 'list' ? '' : 'none';
  carouselEl.style.display = mode === 'carousel' ? '' : 'none';
  if (mode === 'carousel' && listInfoEl) listInfoEl.style.display = 'none';
  if (toggleBtn) {
    toggleBtn.textContent = mode === 'list' ? '◎ Vue carousel' : '⊞ Vue liste';
    toggleBtn.style.color       = '';
    toggleBtn.style.borderColor = '';
  }
}

function getActiveRoster(context) {
  const gameData = getGameData();
  const myTeam = gameData.team.toLowerCase();
  const opponentTeam = myTeam === 'shinobi' ? 'akatsuki' : 'shinobi';
  if (context === 'player') {
    const team = playerSwapped ? opponentTeam : myTeam;
    return roster.filter(c => c.team.toLowerCase() === team);
  } else {
    const team = opponentSwapped ? myTeam : opponentTeam;
    return roster.filter(c => c.team.toLowerCase() === team);
  }
}

function swapRoster(context) {
  const gameData = getGameData();
  const currentTurn = gameData.turns.length + 1;
  if (context === 'player') {
    playerSwapped = !playerSwapped;
    unlockPlayer = false;
    selectedCharacter = null;
    carouselState.player.selected = null;
    const nextBtn = document.getElementById('nextBtn');
    nextBtn.disabled = true; nextBtn.style.opacity = '';
    buildView('player', getActiveRoster('player'), currentTurn, onCharacterSelect, false);
  } else {
    opponentSwapped = !opponentSwapped;
    unlockOpponent = false;
    selectedOpponent = null;
    carouselState.opponent.selected = null;
    const startBtn = document.getElementById('startBtn');
    startBtn.disabled = true; startBtn.style.opacity = '';
    buildView('opponent', getActiveRoster('opponent'), currentTurn, onOpponentSelect, false);
  }
  updateUnlockButtons();
  updateSwapButtons();
}

function updateSwapButtons() {
  const btn1 = document.querySelector('#step1Screen .swap-btn');
  const btn2 = document.querySelector('#step2Screen .swap-btn');
  if (btn1) {
    btn1.textContent = '⇄ Changer de camp';
    btn1.style.color = playerSwapped ? 'var(--orange)' : '';
    btn1.style.borderColor = playerSwapped ? 'var(--orange)' : '';
  }
  if (btn2) {
    btn2.textContent = '⇄ Changer de camp';
    btn2.style.color = opponentSwapped ? 'var(--orange)' : '';
    btn2.style.borderColor = opponentSwapped ? 'var(--orange)' : '';
  }
}

let defeatedNames = new Set();

function getDefeatedNames(gameData) {
  const names = new Set();
  for (const turn of (gameData.turns || [])) {
    if (turn.result === 'loss' && turn.playerCharacter?.name) names.add(turn.playerCharacter.name);
    if (turn.result === 'win' && turn.opponent) names.add(turn.opponent);
  }
  return names;
}

function formatStats(c) {
  const mp = c.mp || 0;
  const extra = c.extra_mp || 0;
  const total = mp + extra;
  const chakraStr = extra > 0 ? `${total} (${mp}+${extra}) PC` : `${total} PC`;
  return `💙 ${chakraStr} ❤️ ${c.hp} PV ⭐ ${c.xp ?? 0} XP`;
}

function isDefeated(c) {
  return defeatedNames.has(c.display_name);
}

function isAvailable(c, currentTurn, forceUnlock) {
  if (forceUnlock) return true;
  if (isDefeated(c)) return false;
  if (c.available_from_turn > currentTurn) return false;
  if (c.available_until_turn !== null && c.available_until_turn !== undefined && currentTurn > c.available_until_turn) return false;
  return true;
}

function isSameAsPlayer(c) {
  return selectedCharacter && c.display_name === selectedCharacter.display_name;
}

function availabilityLabel(c) {
  const from = c.available_from_turn;
  const until = c.available_until_turn;
  if (from === until) return `Tour ${from}`;
  if (until === null || until === undefined) return `Tour ${from}+`;
  return `Tour ${from} à ${until}`;
}

function unavailableReason(c, currentTurn) {
  if (c.available_from_turn > currentTurn) return `Disponible à partir du tour ${c.available_from_turn}`;
  return `Disponible jusqu'au tour ${c.available_until_turn}`;
}

function buildView(context, characters, currentTurn, onSelect, forceUnlock) {
  if (viewModes[context] === 'carousel') {
    buildCarousel(context, characters, currentTurn, onSelect, forceUnlock);
  } else {
    const gridId = context === 'player' ? 'characterGrid' : 'opponentGrid';
    buildRosterGrid(gridId, characters, currentTurn, onSelect, forceUnlock);
    setupGridWheel(gridId);
  }
  applyViewMode(context);
}

function setupGridWheel(gridId) {
  const grid = document.getElementById(gridId);
  if (!grid || grid._wheelBound) return;
  grid._wheelBound = true;
  grid.addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      grid.scrollLeft += e.deltaY;
    }
  }, { passive: false });
}

function buildRosterGrid(gridId, characters, currentTurn, onSelect, forceUnlock) {
  const grid = document.getElementById(gridId);
  grid.innerHTML = '';
  const sorted = sortCharacters([...characters], currentTurn, forceUnlock);
  sorted.forEach(c => {
    const isOpponentGrid = gridId === 'opponentGrid';
    const sameAsPlayer = isOpponentGrid && isSameAsPlayer(c);
    const available = !sameAsPlayer && isAvailable(c, currentTurn, forceUnlock);
    const defeated = !forceUnlock && !sameAsPlayer && isDefeated(c);
    const notYet = !forceUnlock && !sameAsPlayer && !defeated && c.available_from_turn > currentTurn;
    const card = document.createElement('div');
    card.className = 'roster-card' + (available ? '' : ' unavailable') + (defeated ? ' defeated' : '');
    card.dataset.name = c.display_name;

    const img = document.createElement('img');
    img.src = c.roster_image ? `img/roster/${c.roster_image}` : '';
    img.alt = c.display_name;
    img.loading = 'lazy';
    card.appendChild(img);

    if (sameAsPlayer) {
      const overlay = document.createElement('div');
      overlay.className = 'roster-card-chosen-overlay';
      overlay.innerHTML = '<span class="chosen-icon">🔒</span><span class="chosen-label">Déjà choisi</span>';
      card.appendChild(overlay);
    } else if (defeated) {
      const overlay = document.createElement('div');
      overlay.className = 'roster-card-defeated-overlay';
      overlay.innerHTML = '<span class="defeated-x">💀</span><span class="defeated-label">Vaincu(e)</span>';
      card.appendChild(overlay);
    } else if (notYet) {
      const overlay = document.createElement('div');
      overlay.className = 'roster-card-pending-overlay';
      overlay.innerHTML = '<span class="pending-icon">⏳</span><span class="pending-label">Hors tour</span>';
      card.appendChild(overlay);
    }

    const caption = document.createElement('div');
    caption.className = 'roster-card-caption';
    const naturallyAvail = isAvailable(c, currentTurn, false);
    caption.textContent = (forceUnlock && !naturallyAvail ? '🔓 ' : '') + availabilityLabel(c);
    card.appendChild(caption);

    card.addEventListener('click', () => onSelect(c, card, gridId));

    grid.appendChild(card);
  });
}

function sortCharacters(characters, currentTurn, forceUnlock) {
  return characters.sort((a, b) => {
    const aAvail = isAvailable(a, currentTurn, forceUnlock) ? 0 : 1;
    const bAvail = isAvailable(b, currentTurn, forceUnlock) ? 0 : 1;
    if (aAvail !== bAvail) return aAvail - bAvail;
    switch (sortKey) {
      case 'name': return a.sorting_name.localeCompare(b.sorting_name);
      case 'hp':   return (b.hp || 0) - (a.hp || 0);
      case 'mp':   return ((b.mp || 0) + (b.extra_mp || 0)) - ((a.mp || 0) + (a.extra_mp || 0));
      case 'xp':   return (b.xp || 0) - (a.xp || 0);
      default:     return (a.available_from_turn || 0) - (b.available_from_turn || 0);
    }
  });
}

function onCharacterSelect(c, card, gridId) {
  const gameData = getGameData();
  const currentTurn = gameData.turns.length + 1;
  const available = isAvailable(c, currentTurn, unlockPlayer);
  selectedCharacter = available ? c : null;
  if (card) {
    document.querySelectorAll('#characterGrid .roster-card').forEach(el => el.classList.remove('selected'));
    card.classList.add('selected');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    const listStats = document.getElementById('characterListStats');
    listStats.dataset.statsText = formatStats(c);
    listStats.textContent = showStats ? formatStats(c) : '';
    document.getElementById('characterListInfo').style.display = '';
  }
  const nextBtn = document.getElementById('nextBtn');
  nextBtn.disabled = !available;
  nextBtn.style.opacity = '';
}

function onOpponentSelect(c, card, gridId) {
  const gameData = getGameData();
  const currentTurn = gameData.turns.length + 1;
  const sameAsPlayer = isSameAsPlayer(c);
  const available = !sameAsPlayer && isAvailable(c, currentTurn, unlockOpponent);
  selectedOpponent = available ? c : null;
  if (card) {
    document.querySelectorAll('#opponentGrid .roster-card').forEach(el => el.classList.remove('selected'));
    card.classList.add('selected');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    const listStats = document.getElementById('opponentListStats');
    listStats.dataset.statsText = formatStats(c);
    listStats.textContent = showStats ? formatStats(c) : '';
    document.getElementById('opponentListInfo').style.display = '';
  }
  const startBtn = document.getElementById('startBtn');
  startBtn.disabled = !available;
  startBtn.style.opacity = '';
}

function syncCarouselSelection(context) {
  if (viewModes[context] !== 'carousel') return;
  const cs = carouselState[context];
  if (!cs.items.length) return;
  const gameData = getGameData();
  const currentTurn = gameData.turns.length + 1;
  const unlock = context === 'player' ? unlockPlayer : unlockOpponent;
  const c = cs.items[cs.index];
  const available = isAvailable(c, currentTurn, unlock);
  if (context === 'player') selectedCharacter = available ? c : null;
  else selectedOpponent = available ? c : null;
}

function makeBadges(c, swapped, unlocked, currentTurn) {
  const badges = [];
  if (swapped) badges.push({ cls: 'confirm-badge-swap', text: '⇄' });
  if (unlocked && !isAvailable(c, currentTurn, false)) badges.push({ cls: 'confirm-badge-unlock', text: '🔓' });
  return badges;
}

function renderBadges(containerId, badges) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  badges.forEach(b => {
    const span = document.createElement('span');
    span.className = `confirm-badge ${b.cls}`;
    span.textContent = b.text;
    el.appendChild(span);
  });
}

function goToConfirm() {
  syncCarouselSelection('player');
  syncCarouselSelection('opponent');
  if (!selectedCharacter || !selectedOpponent) return;

  const currentTurn = getGameData().turns.length + 1;

  document.getElementById('confirmPlayerImg').src = selectedCharacter.roster_image
    ? `img/roster/${selectedCharacter.roster_image}` : '';
  document.getElementById('confirmPlayerStats').textContent = formatStats(selectedCharacter);
  renderBadges('confirmPlayerBadges', makeBadges(selectedCharacter, playerSwapped, unlockPlayer, currentTurn));

  document.getElementById('confirmOpponentImg').src = selectedOpponent.roster_image
    ? `img/roster/${selectedOpponent.roster_image}` : '';
  document.getElementById('confirmOpponentStats').textContent = formatStats(selectedOpponent);
  renderBadges('confirmOpponentBadges', makeBadges(selectedOpponent, opponentSwapped, unlockOpponent, currentTurn));

  document.getElementById('step2Screen').classList.add('hidden');
  document.getElementById('step3Screen').classList.remove('hidden');
  window.scrollTo(0, 0);
}

function goBackToStep2() {
  unlockOpponent = false;
  opponentSwapped = false;
  selectedOpponent = null;
  carouselState.opponent.selected = null;
  const startBtn = document.getElementById('startBtn');
  startBtn.disabled = true; startBtn.style.opacity = '';
  document.getElementById('opponentListInfo').style.display = 'none';
  const gameData = getGameData();
  const currentTurn = gameData.turns.length + 1;
  const myTeam = gameData.team.toLowerCase();
  const opponentTeam = myTeam === 'shinobi' ? 'akatsuki' : 'shinobi';
  const opponentRoster = roster.filter(c => c.team.toLowerCase() === opponentTeam);
  buildView('opponent', opponentRoster, currentTurn, onOpponentSelect, false);
  updateUnlockButtons();
  updateSwapButtons();
  document.getElementById('step3Screen').classList.add('hidden');
  document.getElementById('step2Screen').classList.remove('hidden');
  window.scrollTo(0, 0);
}

function initializePage() {
  const gameData = getGameData();

  if (!gameData.team) {
    window.location.href = 'index.html';
    return;
  }

  defeatedNames = getDefeatedNames(gameData);

  const logoPath = getTeamLogoPath(gameData.team);
  document.getElementById('teamLogo1').src = logoPath;
  document.getElementById('teamLogo2').src = logoPath;
  document.getElementById('teamLogo3').src = logoPath;

  const currentTurn = gameData.turns.length + 1;
  const tourLabel = `Tour ${currentTurn}`;
  document.getElementById('step1Subtitle').textContent = tourLabel;
  document.getElementById('step2Subtitle').textContent = tourLabel;
  document.getElementById('step3Subtitle').textContent = tourLabel;

  const myTeam = gameData.team.toLowerCase();
  const opponentTeam = myTeam === 'shinobi' ? 'akatsuki' : 'shinobi';

  document.getElementById('playerCardLabel').textContent =
    myTeam === 'shinobi' ? "Ninja de l'Alliance Shinobi" : "Ninja de l'Akatsuki";
  document.getElementById('opponentCardLabel').textContent =
    opponentTeam === 'shinobi' ? "Ninja de l'Alliance Shinobi" : "Ninja de l'Akatsuki";

  const myRoster = roster.filter(c => c.team.toLowerCase() === myTeam);
  const opponentRoster = roster.filter(c => c.team.toLowerCase() === opponentTeam);

  if (myRoster.length === 0) {
    document.getElementById('noCharMsg').style.display = 'block';
  } else {
    buildView('player', myRoster, currentTurn, onCharacterSelect, unlockPlayer);
  }

  if (opponentRoster.length === 0) {
    document.getElementById('noOpponentMsg').style.display = 'block';
  } else {
    buildView('opponent', opponentRoster, currentTurn, onOpponentSelect, unlockOpponent);
  }
  updateUnlockButtons();
  updateSwapButtons();
}

function goToStep2() {
  syncCarouselSelection('player');
  if (!selectedCharacter) return;

  document.getElementById('summaryImg').src = selectedCharacter.roster_image
    ? `img/roster/${selectedCharacter.roster_image}` : '';
  document.getElementById('summaryName').textContent = selectedCharacter.display_name;
  document.getElementById('summaryStats').textContent = formatStats(selectedCharacter);

  document.getElementById('step1Screen').classList.add('hidden');
  document.getElementById('step2Screen').classList.remove('hidden');
  window.scrollTo(0, 0);
}

let sortKey = 'availability';
let sortGridId = null;

function openSortMenu(gridId, btn) {
  sortGridId = gridId;
  const menu = document.getElementById('sortMenu');
  menu.querySelectorAll('.sort-option').forEach(el => {
    el.classList.toggle('active', el.getAttribute('onclick').includes(`'${sortKey}'`));
  });
  const rect = btn.getBoundingClientRect();
  menu.style.top = (rect.bottom + window.scrollY + 4) + 'px';
  menu.style.left = (rect.left + window.scrollX) + 'px';
  menu.style.display = 'block';
  setTimeout(() => document.addEventListener('click', closeSortMenu, { once: true }), 0);
}

function closeSortMenu() {
  document.getElementById('sortMenu').style.display = 'none';
}

function applySort(key) {
  sortKey = key;
  closeSortMenu();
  if (!sortGridId) return;
  const gameData = getGameData();
  const currentTurn = gameData.turns.length + 1;
  const context = sortGridId === 'characterGrid' ? 'player' : 'opponent';

  if (context === 'player') {
    const prev = selectedCharacter ? selectedCharacter.display_name : null;
    selectedCharacter = null;
    const nextBtn = document.getElementById('nextBtn');
    nextBtn.disabled = true; nextBtn.style.opacity = '';
    buildView('player', getActiveRoster('player'), currentTurn, onCharacterSelect, unlockPlayer);
    if (prev && viewModes.player === 'list') {
      const card = document.querySelector(`#characterGrid [data-name="${CSS.escape(prev)}"]`);
      if (card && !card.classList.contains('unavailable')) {
        const c = roster.find(r => r.display_name === prev);
        if (c) { selectedCharacter = c; card.classList.add('selected'); nextBtn.disabled = false; nextBtn.style.opacity = ''; }
      }
    }
  } else {
    const prev = selectedOpponent ? selectedOpponent.display_name : null;
    selectedOpponent = null;
    const startBtn = document.getElementById('startBtn');
    startBtn.disabled = true; startBtn.style.opacity = '';
    buildView('opponent', getActiveRoster('opponent'), currentTurn, onOpponentSelect, unlockOpponent);
    if (prev && viewModes.opponent === 'list') {
      const card = document.querySelector(`#opponentGrid [data-name="${CSS.escape(prev)}"]`);
      if (card && !card.classList.contains('unavailable')) {
        const c = roster.find(r => r.display_name === prev);
        if (c) { selectedOpponent = c; card.classList.add('selected'); startBtn.disabled = false; startBtn.style.opacity = ''; }
      }
    }
  }
}

function updateUnlockButtons() {
  const btn1 = document.querySelector('#step1Screen .unlock-btn');
  const btn2 = document.querySelector('#step2Screen .unlock-btn');
  if (btn1) { btn1.textContent = unlockPlayer ? '🔒 Verrouiller personnages' : '🔓 Déverrouiller personnages'; btn1.disabled = false; }
  if (btn2) { btn2.textContent = unlockOpponent ? '🔒 Verrouiller personnages' : '🔓 Déverrouiller personnages'; btn2.disabled = false; }
}

let unlockContext = null;

function openUnlockModal(context) {
  unlockContext = context;
  document.getElementById('unlockModal').classList.remove('hidden');
}

function closeUnlockModal() {
  document.getElementById('unlockModal').classList.add('hidden');
}

function confirmUnlock() {
  closeUnlockModal();
  doUnlock(unlockContext);
}

function toggleUnlock(context) {
  const isUnlocked = context === 'player' ? unlockPlayer : unlockOpponent;
  if (isUnlocked) {
    doLock(context);
  } else {
    openUnlockModal(context);
  }
}

function doUnlock(context) {
  const gameData = getGameData();
  const currentTurn = gameData.turns.length + 1;
  if (context === 'player') {
    unlockPlayer = true;
    selectedCharacter = null;
    const nextBtn = document.getElementById('nextBtn');
    nextBtn.disabled = true; nextBtn.style.opacity = '';
    buildView('player', getActiveRoster('player'), currentTurn, onCharacterSelect, true);
    document.getElementById('characterListInfo').style.display = 'none';
  } else {
    unlockOpponent = true;
    selectedOpponent = null;
    const startBtn = document.getElementById('startBtn');
    startBtn.disabled = true; startBtn.style.opacity = '';
    buildView('opponent', getActiveRoster('opponent'), currentTurn, onOpponentSelect, true);
    document.getElementById('opponentListInfo').style.display = 'none';
  }
  updateUnlockButtons();
}

function doLock(context) {
  const gameData = getGameData();
  const currentTurn = gameData.turns.length + 1;
  if (context === 'player') {
    unlockPlayer = false;
    selectedCharacter = null;
    const nextBtn = document.getElementById('nextBtn');
    nextBtn.disabled = true; nextBtn.style.opacity = '';
    buildView('player', getActiveRoster('player'), currentTurn, onCharacterSelect, false);
    document.getElementById('characterListInfo').style.display = 'none';
  } else {
    unlockOpponent = false;
    selectedOpponent = null;
    const startBtn = document.getElementById('startBtn');
    startBtn.disabled = true; startBtn.style.opacity = '';
    buildView('opponent', getActiveRoster('opponent'), currentTurn, onOpponentSelect, false);
    document.getElementById('opponentListInfo').style.display = 'none';
  }
  updateUnlockButtons();
}

function goBackToStep1() {
  unlockPlayer = false;
  playerSwapped = false;
  selectedCharacter = null;
  carouselState.player.selected = null;
  const nextBtn = document.getElementById('nextBtn');
  nextBtn.disabled = true; nextBtn.style.opacity = '';
  document.getElementById('characterListInfo').style.display = 'none';
  const gameData = getGameData();
  const currentTurn = gameData.turns.length + 1;
  const myTeam = gameData.team.toLowerCase();
  const myRoster = roster.filter(c => c.team.toLowerCase() === myTeam);
  buildView('player', myRoster, currentTurn, onCharacterSelect, false);
  updateUnlockButtons();
  updateSwapButtons();
  document.getElementById('step2Screen').classList.add('hidden');
  document.getElementById('step1Screen').classList.remove('hidden');
  window.scrollTo(0, 0);
}

function startCombat() {
  if (!selectedCharacter || !selectedOpponent) return;

  const totalChakra = (selectedCharacter.mp || 0) + (selectedCharacter.extra_mp || 0);
  const params = new URLSearchParams({
    name: selectedCharacter.display_name,
    hp: selectedCharacter.hp,
    chakra: totalChakra,
    opponent: selectedOpponent.display_name,
    opponentXp: selectedOpponent.xp ?? 0,
    playerImage: selectedCharacter.roster_image ?? '',
    opponentImage: selectedOpponent.roster_image ?? ''
  });

  window.location.href = `combat.html?${params.toString()}`;
}

const ROSTER_FALLBACK = [
  {"display_name":"Kakuzu","sorting_name":"Kakuzu","team":"akatsuki","xp":3,"mp":15,"hp":48,"extra_mp":null,"available_from_turn":1,"available_until_turn":4,"roster_image":"akatsuki_kakuzu.png"},
  {"display_name":"Kisame","sorting_name":"Kisame","team":"akatsuki","xp":3,"mp":21,"hp":54,"extra_mp":null,"available_from_turn":1,"available_until_turn":4,"roster_image":"akatsuki_kisame.png"},
  {"display_name":"Deidara","sorting_name":"Deidara","team":"akatsuki","xp":3,"mp":15,"hp":45,"extra_mp":null,"available_from_turn":1,"available_until_turn":5,"roster_image":"akatsuki_deidara.png"},
  {"display_name":"Uchiwa Itachi","sorting_name":"Itachi Uchiwa","team":"akatsuki","xp":4,"mp":18,"hp":61,"extra_mp":null,"available_from_turn":1,"available_until_turn":5,"roster_image":"akatsuki_itachi.png"},
  {"display_name":"Nagato","sorting_name":"Nagato","team":"akatsuki","xp":4,"mp":22,"hp":68,"extra_mp":null,"available_from_turn":1,"available_until_turn":5,"roster_image":"akatsuki_nagato.png"},
  {"display_name":"Orochimaru","sorting_name":"Orochimaru","team":"akatsuki","xp":4,"mp":17,"hp":58,"extra_mp":null,"available_from_turn":1,"available_until_turn":5,"roster_image":"akatsuki_orochimaru.png"},
  {"display_name":"Sasori","sorting_name":"Sasori","team":"akatsuki","xp":3,"mp":16,"hp":52,"extra_mp":null,"available_from_turn":1,"available_until_turn":5,"roster_image":"akatsuki_sasori.png"},
  {"display_name":"Uchiwa Sasuke (deck 1)","sorting_name":"Sasuke Uchiwa (deck 1)","team":"akatsuki","xp":3,"mp":18,"hp":59,"extra_mp":null,"available_from_turn":1,"available_until_turn":7,"roster_image":"akatsuki_sasuke_deck_1.png"},
  {"display_name":"Yakushi Kabuto","sorting_name":"Kabuto Yakushi","team":"akatsuki","xp":4,"mp":20,"hp":70,"extra_mp":null,"available_from_turn":5,"available_until_turn":5,"roster_image":"akatsuki_kabuto.png"},
  {"display_name":"Uchiwa Madara (deck 1)","sorting_name":"Madara Uchiwa (deck 1)","team":"akatsuki","xp":5,"mp":23,"hp":82,"extra_mp":null,"available_from_turn":5,"available_until_turn":6,"roster_image":"akatsuki_madara_deck_1.png"},
  {"display_name":"Uchiwa Obito (deck 1)","sorting_name":"Obito Uchiwa (deck 1)","team":"akatsuki","xp":4,"mp":18,"hp":60,"extra_mp":null,"available_from_turn":5,"available_until_turn":6,"roster_image":"akatsuki_obito_deck_1.png"},
  {"display_name":"Jûbi","sorting_name":"Jûbi","team":"akatsuki","xp":7,"mp":30,"hp":120,"extra_mp":null,"available_from_turn":6,"available_until_turn":6,"roster_image":"akatsuki_jubi.png"},
  {"display_name":"Uchiwa Madara - Rikudô - Réceptacle de Jûbi (deck 2)","sorting_name":"Madara Uchiwa - Rikudô (deck 2)","team":"akatsuki","xp":6,"mp":25,"hp":110,"extra_mp":null,"available_from_turn":7,"available_until_turn":7,"roster_image":"akatsuki_madara_deck_2.png"},
  {"display_name":"Uchiwa Obito - Réceptacle de Jûbi (deck 2)","sorting_name":"Obito Uchiwa - Réceptacle de Jûbi (deck 2)","team":"akatsuki","xp":5,"mp":23,"hp":90,"extra_mp":null,"available_from_turn":7,"available_until_turn":7,"roster_image":"akatsuki_obito_deck_2.png"},
  {"display_name":"Ôtsotsuki Kaguya ","sorting_name":"Kaguya Ôtsotsuki","team":"akatsuki","xp":6,"mp":28,"hp":115,"extra_mp":null,"available_from_turn":8,"available_until_turn":8,"roster_image":"akatsuki_kaguya.png"},
  {"display_name":"Jiraya","sorting_name":"Jiraya","team":"shinobi","xp":4,"mp":19,"hp":62,"extra_mp":null,"available_from_turn":1,"available_until_turn":4,"roster_image":"shinobi_jiraya.png"},
  {"display_name":"A - 4e Raikage","sorting_name":"A - 4e Raikage","team":"shinobi","xp":4,"mp":20,"hp":65,"extra_mp":null,"available_from_turn":1,"available_until_turn":6,"roster_image":"shinobi_a_raikage.png"},
  {"display_name":"Gaara - 5e Kazekage","sorting_name":"Gaara - 5e Kazekage","team":"shinobi","xp":3,"mp":15,"hp":50,"extra_mp":1,"available_from_turn":1,"available_until_turn":6,"roster_image":"shinobi_gaara.png"},
  {"display_name":"Ônoki","sorting_name":"Ônoki","team":"shinobi","xp":4,"mp":19,"hp":63,"extra_mp":null,"available_from_turn":1,"available_until_turn":6,"roster_image":"shinobi_onoki.png"},
  {"display_name":"Maito Gaï","sorting_name":"Gaï Maito","team":"shinobi","xp":3,"mp":16,"hp":57,"extra_mp":null,"available_from_turn":1,"available_until_turn":7,"roster_image":"shinobi_gai_maito.png"},
  {"display_name":"Hatake Kakashi","sorting_name":"Kakashi Hatake","team":"shinobi","xp":3,"mp":16,"hp":57,"extra_mp":null,"available_from_turn":1,"available_until_turn":7,"roster_image":"shinobi_kakashi.png"},
  {"display_name":"Killer Bee","sorting_name":"Killer Bee","team":"shinobi","xp":4,"mp":14,"hp":68,"extra_mp":8,"available_from_turn":1,"available_until_turn":7,"roster_image":"shinobi_killer_bee.png"},
  {"display_name":"Uzumaki Naruto (deck 1)","sorting_name":"Naruto Uzumaki (deck 1)","team":"shinobi","xp":3,"mp":11,"hp":60,"extra_mp":9,"available_from_turn":1,"available_until_turn":7,"roster_image":"shinobi_naruto_deck_1.png"},
  {"display_name":"Haruno Sakura","sorting_name":"Sakura Haruno","team":"shinobi","xp":3,"mp":16,"hp":55,"extra_mp":null,"available_from_turn":1,"available_until_turn":7,"roster_image":"shinobi_sakura.png"},
  {"display_name":"Uzumaki Naruto - Ermite de Rikudô (deck 2)","sorting_name":"Naruto Uzumaki - Ermite de Rikudô (deck 2)","team":"shinobi","xp":5,"mp":16,"hp":85,"extra_mp":9,"available_from_turn":7,"available_until_turn":9,"roster_image":"shinobi_naruto_deck_2.png"},
  {"display_name":"Uchiwa Sasuke - Ermite de Rikudô (deck 2)","sorting_name":"Sasuke Uchiwa - Ermite de Rikudô (deck 2)","team":"shinobi","xp":5,"mp":23,"hp":84,"extra_mp":null,"available_from_turn":7,"available_until_turn":9,"roster_image":"shinobi_sasuke_deck_2.png"}
];

window.addEventListener('load', () => {
  fetch('roster.json')
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(data => {
      roster = data;
      initializePage();
    })
    .catch(() => {
      roster = ROSTER_FALLBACK;
      initializePage();
    });
});
