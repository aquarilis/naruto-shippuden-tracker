/* ══════════════════════════════════════
   Team Selection — JS
   ══════════════════════════════════════ */

function selectTeam(team) {
  const gameData = { team, turns: [] };
  sessionStorage.setItem('gameData', JSON.stringify(gameData));
  window.location.href = 'game_tracker.html';
}
