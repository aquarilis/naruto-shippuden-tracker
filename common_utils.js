/* ══════════════════════════════════════
   Naruto Shippuden Tracker — Shared JS
   ══════════════════════════════════════ */

const APP_VERSION = '1.1';

function getGameData() {
  return JSON.parse(sessionStorage.getItem('gameData')) || { team: null, turns: [] };
}

function getTeamLogoPath(team) {
  return team === 'shinobi' ? 'img/alliance_shinobi.svg' : 'img/akatsuki.svg';
}
