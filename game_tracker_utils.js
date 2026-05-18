/* ══════════════════════════════════════
   Game Tracker — JS
   ══════════════════════════════════════ */

function renderGameTracker() {
  const gameData = getGameData();

  if (!gameData.team) {
    document.getElementById('gameScreen').classList.add('hidden');
    document.getElementById('noDataScreen').classList.remove('hidden');
    return;
  }

  document.getElementById('teamLogo').src = getTeamLogoPath(gameData.team);
  document.getElementById('teamName').textContent = gameData.team === 'shinobi' ? 'Alliance Shinobi' : 'Akatsuki';

  const nextTour = gameData.turns.length + 1;
  document.getElementById('tourCount').textContent = nextTour;

  const totalXp = gameData.turns.reduce((sum, t) => {
    if (t.result === 'win' && t.exp) {
      return sum + (t.exp.xpCharacter || 0) + (t.exp.xpMission || 0) + (t.exp.xpSecondary || 0);
    }
    return sum;
  }, 0);
  document.getElementById('xpTotal').textContent = totalXp;

  const btnUndo = document.getElementById('btnUndoTurn');
  btnUndo.disabled = gameData.turns.length === 0;

  const historyList = document.getElementById('historyList');
  if (gameData.turns.length === 0) {
    historyList.innerHTML = '<div class="empty-state">Aucun tour pour l\'instant</div>';
  } else {
    historyList.innerHTML = [...gameData.turns].reverse().map(turn => {
      const resultClass = `result-${turn.result}`;
      const resultText = turn.result === 'win' ? 'Victoire' : turn.result === 'loss' ? 'Défaite' : 'Match nul';
      const xpBadge = turn.result === 'win' && turn.exp
        ? (() => {
            const total = (turn.exp.xpCharacter || 0) + (turn.exp.xpMission || 0) + (turn.exp.xpSecondary || 0);
            return total > 0 ? `<span class="xp-badge">+${total} XP</span>` : '';
          })()
        : '';

      const playerImgSrc = turn.playerCharacter.roster_image ? `img/roster/${turn.playerCharacter.roster_image}` : null;
      const opponentImgSrc = turn.opponentImage ? `img/roster/${turn.opponentImage}` : null;

      const playerImgHtml = playerImgSrc
        ? `<div class="history-char-block"><div class="history-char-img-wrap"><img src="${playerImgSrc}" alt="${turn.playerCharacter.name}">${turn.result === 'loss' ? '<div class="loser-overlay">💀</div>' : ''}</div></div>`
        : '';

      const opponentHtml = turn.opponent
        ? (opponentImgSrc
            ? `<span class="history-vs">vs</span><div class="history-char-block"><div class="history-char-img-wrap"><img src="${opponentImgSrc}" alt="${turn.opponent}">${turn.result === 'win' ? '<div class="loser-overlay">💀</div>' : ''}</div></div>`
            : `<span class="history-vs">vs</span>`)
        : '';

      const playerName = turn.playerCharacter.name;
      const namesLabel = turn.opponent
        ? `<span class="history-char-names">${playerName} vs ${turn.opponent}</span>`
        : `<span class="history-char-names">${playerName}</span>`;

      return `
        <div class="history-item" onclick="openLogModal(${turn.turnNumber})">
          <span class="history-item-turn">Tour ${turn.turnNumber}</span>
          <span class="history-item-character">${playerImgHtml}${opponentHtml}${namesLabel}</span>
          <span class="history-item-right">${xpBadge}<span class="history-item-result ${resultClass}">${resultText}</span></span>
        </div>
      `;
    }).join('');
  }
}

function startNewTurn() {
  window.location.href = 'character_selection.html';
}

function openUndoModal() {
  const gameData = getGameData();
  if (gameData.turns.length === 0) return;
  const last = gameData.turns[gameData.turns.length - 1];
  const matchup = `${last.playerCharacter.name}${last.opponent ? ` vs. ${last.opponent}` : ''}`;
  const resultText = last.result === 'win' ? 'Victoire' : last.result === 'loss' ? 'Défaite' : 'Match nul';
  let body = `Tour ${last.turnNumber} — ${matchup} (${resultText}) sera supprimé.`;
  if (last.result === 'win' && last.exp) {
    const total = (last.exp.xpCharacter || 0) + (last.exp.xpMission || 0) + (last.exp.xpSecondary || 0);
    if (total > 0) body += ` Les ${total} XP gagnés seront déduits.`;
  }
  document.getElementById('undoModalBody').textContent = body;
  document.getElementById('undoModal').classList.remove('hidden');
}

function closeUndoModal(event) {
  if (event.target === document.getElementById('undoModal')) {
    document.getElementById('undoModal').classList.add('hidden');
  }
}

function confirmUndoLastTurn() {
  const gameData = getGameData();
  if (gameData.turns.length === 0) return;
  gameData.turns.pop();
  sessionStorage.setItem('gameData', JSON.stringify(gameData));
  document.getElementById('undoModal').classList.add('hidden');
  renderGameTracker();
}

function openLogModal(turnNumber) {
  const gameData = getGameData();
  const turn = gameData.turns.find(t => t.turnNumber === turnNumber);
  if (!turn) return;

  const matchup = `${turn.playerCharacter.name}${turn.opponent ? ` vs. ${turn.opponent}` : ''}`;
  const resultText = turn.result === 'win' ? 'Victoire' : turn.result === 'loss' ? 'Défaite' : 'Match nul';

  document.getElementById('logModalTitle').textContent = `Tour ${turn.turnNumber} — ${matchup}`;
  document.getElementById('logModalSubtitle').textContent = `${resultText} · ${turn.combatRounds} round${turn.combatRounds > 1 ? 's' : ''}`;

  const playerImgSrc   = turn.playerCharacter.roster_image ? `img/roster/${turn.playerCharacter.roster_image}` : null;
  const opponentImgSrc = turn.opponentImage ? `img/roster/${turn.opponentImage}` : null;
  const playerWon      = turn.result === 'win';
  const opponentWon    = turn.result === 'loss';
  const isDraw         = turn.result === 'draw';

  const labelClass = (won) => won ? 'winner' : isDraw ? 'draw' : 'loser';
  const labelText  = (won) => won ? '🏆 Vainqueur' : isDraw ? '— Match nul' : '☠️ Vaincu';

  let fightersHtml = '';
  if (playerImgSrc) {
    fightersHtml += `<div class="log-modal-fighter">
      <img src="${playerImgSrc}" alt="${turn.playerCharacter.name}">
      <span class="log-modal-fighter-label ${labelClass(playerWon)}">${labelText(playerWon)}</span>
    </div>`;
  }
  if (opponentImgSrc) {
    fightersHtml += `<div class="log-modal-vs">VS</div>`;
    fightersHtml += `<div class="log-modal-fighter">
      <img src="${opponentImgSrc}" alt="${turn.opponent}">
      <span class="log-modal-fighter-label ${labelClass(opponentWon)}">${labelText(opponentWon)}</span>
    </div>`;
  }
  document.getElementById('logModalFighters').innerHTML = fightersHtml;

  const entries = document.getElementById('logModalEntries');
  let html = '';

  if (turn.result === 'win' && turn.exp) {
    const { xpCharacter = 0, xpMission = 0, xpSecondary = 0 } = turn.exp;
    const total = xpCharacter + xpMission + xpSecondary;
    if (total > 0) {
      html += `<div class="xp-breakdown">`;
      html += `<div class="xp-breakdown-title">🌟 XP gagnés</div>`;
      if (xpCharacter > 0) html += `<div>⭐ Personnage : <strong class="xp-value">+${xpCharacter}</strong></div>`;
      if (xpMission   > 0) html += `<div>🎯 Mission : <strong class="xp-value">+${xpMission}</strong></div>`;
      if (xpSecondary > 0) html += `<div>📋 Mission(s) secondaire(s) : <strong class="xp-value">+${xpSecondary}</strong></div>`;
      html += `<div class="xp-breakdown-total">Total : <strong class="xp-value">+${total} XP</strong></div>`;
      html += `</div>`;
    }
  }

  if (!turn.combatLog || turn.combatLog.length === 0) {
    html += '<div class="log-modal-empty">Aucun historique disponible</div>';
  } else {
    html += turn.combatLog.map(line => `<div>${line}</div>`).join('');
  }

  entries.innerHTML = html;

  document.getElementById('logModal').classList.remove('hidden');
}

function closeLogModal(event) {
  if (event.target === document.getElementById('logModal')) {
    document.getElementById('logModal').classList.add('hidden');
  }
}

window.addEventListener('load', renderGameTracker);
