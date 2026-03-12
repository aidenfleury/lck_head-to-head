let matchData = [];
let playerData = [];

document.addEventListener("DOMContentLoaded", () => {
  Promise.all([
    fetch("data/competitive_scores_calculated.csv").then(r => r.text()),
    fetch("data/clean_players.csv").then(r => r.text())
  ]).then(([teamsCSV, playersCSV]) => {
    matchData = parseCSV(teamsCSV);
    playerData = parseCSV(playersCSV);
    populateDropdowns(matchData);
  });
});


function parseCSV(csvText) {
  const lines = csvText.trim().split("\n");
  const headers = lines[0].split(",");

  return lines.slice(1).map(line => {
    const values = line.split(",");
    const row = {};
    headers.forEach((header, i) => {
      row[header.trim()] = values[i]?.trim();
    });
    return row;
  });
}

function populateDropdowns(data) {
  const teamMap = {};
  data.forEach(row => {
    teamMap[row.teamid] = row.teamname;
  });

  const selectX = document.getElementById("team-x");
  const selectY = document.getElementById("team-y");

  Object.entries(teamMap)
    .sort((a, b) => a[1].localeCompare(b[1]))
    .forEach(([id, name]) => {
      selectX.innerHTML += `<option value="${id}">${name}</option>`;
      selectY.innerHTML += `<option value="${id}">${name}</option>`;
    });
}

document.getElementById("search-btn").addEventListener("click", () => {
  const teamX = document.getElementById("team-x").value;
  const teamY = document.getElementById("team-y").value;

  if (!teamX || !teamY || teamX === teamY) {
    document.getElementById("results").innerHTML =
      `<p style="color:#888; text-align:center;">두 팀을 선택해주세요.</p>`;
    return;
  }

  const nameX = matchData.find(r => r.teamid === teamX)?.teamname || teamX;
  const nameY = matchData.find(r => r.teamid === teamY)?.teamname || teamY;

  const recentMatches = getRecentMatches(teamX, teamY);
  renderResults(recentMatches, teamX, teamY, nameX, nameY);
});

function getRecentMatches(teamX, teamY) {
  const pairKey = [teamX, teamY].sort().join("_");

  // Build gameid → [teamids] lookup
  const gamePairMap = {};
  matchData.forEach(row => {
    if (!gamePairMap[row.gameid]) gamePairMap[row.gameid] = [];
    gamePairMap[row.gameid].push(row.teamid);
  });

  // Find gameids where both teams are exactly our pair
  const validGameIds = new Set(
    Object.entries(gamePairMap)
      .filter(([, ids]) => [...ids].sort().join("_") === pairKey)
      .map(([gameid]) => gameid)
  );

  const pairGames = matchData.filter(row => validGameIds.has(row.gameid));

  // Group into series by match_id
  const matchMap = {};
  pairGames.forEach(row => {
    const matchId = `${row.date}_${pairKey}_${row.league}`;
    if (!matchMap[matchId]) {
      matchMap[matchId] = {
        date: row.date,
        year: row.year,
        league: row.league,
        split: row.split,
        playoffs: row.playoffs,
        games: []
      };
    }
    matchMap[matchId].games.push(row);
  });


  // Sort by date descending → last 10
  return Object.entries(matchMap)
    .sort((a, b) => new Date(b[1].date) - new Date(a[1].date))
    .slice(0, 10);
}

function renderResults(matches, teamX, teamY, nameX, nameY) {
  const resultsDiv = document.getElementById("results");

  if (matches.length === 0) {
    resultsDiv.innerHTML =
      `<p style="color:#888; text-align:center;">경기 기록이 없습니다.</p>`;
    return;
  }

  const POSITIONS = ["top", "jng", "mid", "bot", "sup"];

  function getWinColor(wins, losses) {
    if (wins/(wins+losses) < 0.4) return "#FF99A9";
    if (wins/(wins+losses) <= 0.6) return "#FFF06B";
    return "#64E987";
  }

  function getScoreColor(score) {
    if (score < 40) return "#FF99A9";
    if (score <= 60) return "#FFF06B";
    return "#64E987";
  }

  // matches tally
  let totalXWins = 0;
  let totalYWins = 0;

  matches.forEach(([, match]) => {
    const xGamesWon = match.games.filter(g => g.teamid === teamX && g.result === "1").length;
    const yGamesWon = match.games.filter(g => g.teamid === teamY && g.result === "1").length;
    if (xGamesWon > yGamesWon) totalXWins++;
    else if (yGamesWon > xGamesWon) totalYWins++;
  });

  const totalMatches = totalXWins + totalYWins;

  const allXScores = matches.flatMap(([, match]) =>
    match.games.filter(g => g.teamid === teamX).map(g => parseFloat(g.competitive_score))
  );
  const overallXScore = Math.round(allXScores.reduce((a, b) => a + b, 0) / allXScores.length);

  const winColor = getWinColor(totalXWins, totalYWins);
  const scoreColor = getScoreColor(overallXScore);

  const summaryHtml = `
    <div style="
      font-size: 1.25rem;
      font-weight: 600;
      line-height: 1.8;
      margin-bottom: 20px;
      color: #ccc;
    ">
      ${nameX}는 ${nameY}와의 최근 ${totalMatches}경기에서
      <span style="color:${winColor}; font-weight:700;">${totalXWins}승 ${totalYWins}패</span>
      중입니다.<br>
      평균 경쟁 지수
      :
      <span style="color:${scoreColor}; font-weight:700;">${overallXScore}</span>
    </div>
  `;


  let html = `
    <table style="width:100%; border-collapse:collapse; font-size:0.85rem; table-layout:fixed;">
      <colgroup>
        <col style="width:34%">
        <col style="width:33%">
        <col style="width:33%">
      </colgroup>
      <thead>
        <tr style="color:#888; border-bottom:1px solid #333;">
          <th style="padding:8px 4px; text-align:left;">매치 (날짜)</th>
          <th style="padding:8px 4px; text-align:center;">${nameX}</th>
          <th style="padding:8px 4px; text-align:center;">${nameY}</th>
        </tr>
      </thead>
      <tbody>
  `;

  matches.forEach(([matchId, match]) => {
    const games = match.games;

    const xWins = games.filter(g => g.teamid === teamX && g.result === "1").length;
    const yWins = games.filter(g => g.teamid === teamY && g.result === "1").length;
    const xScore = avg(games.filter(g => g.teamid === teamX).map(g => parseFloat(g.competitive_score)));
    const yScore = avg(games.filter(g => g.teamid === teamY).map(g => parseFloat(g.competitive_score)));
    const xBold = xWins > yWins ? "color:#ffffff; font-weight:700;" : "color:#888;";
    const yBold = yWins > xWins ? "color:#ffffff; font-weight:700;" : "color:#888;";

    // Get all unique gameids in this series, sorted by game number
    const gameIds = [...new Set(games.map(g => g.gameid))];

    // Build per-game score rows
    let gameRowsHtml = "";
    gameIds.forEach((gid, idx) => {
      const gamesInGame = games.filter(g => g.gameid === gid);
      const gxScore = parseFloat(gamesInGame.find(g => g.teamid === teamX)?.competitive_score || 0);
      const gyScore = parseFloat(gamesInGame.find(g => g.teamid === teamY)?.competitive_score || 0);
      gameRowsHtml += `
        <tr style="border-bottom:1px solid #1a1a1a;">
          <td style="padding:6px 4px; color:#666;">${idx + 1}세트</td>
          <td style="padding:6px 4px; text-align:center; color:#aaa;">${gxScore}</td>
          <td style="padding:6px 4px; text-align:center; color:#aaa;">${gyScore}</td>
        </tr>
      `;
    });

    // Build roster rows (use the FIRST game in the series for the roster)
    const firstGameId = gameIds[0];
    const lastGamePlayers = playerData.filter(p => p.gameid === firstGameId);

    let rosterRowsHtml = `
      <tr>
        <td colspan="3" style="padding:8px 4px 4px 4px;">
          <hr style="border:none;">
        </td>
      </tr>
    `;
    POSITIONS.forEach(pos => {
      const xPlayer = lastGamePlayers.find(p => p.teamid === teamX && p.position === pos);
      const yPlayer = lastGamePlayers.find(p => p.teamid === teamY && p.position === pos);
      rosterRowsHtml += `
        <tr>
          <td style="padding:4px 4px; color:#555; font-size:0.75rem; text-transform:uppercase;">${pos}</td>
          <td style="padding:4px 4px; text-align:center; color:#999;">${xPlayer?.playername || "—"}</td>
          <td style="padding:4px 4px; text-align:center; color:#999;">${yPlayer?.playername || "—"}</td>
        </tr>
      `;
    });

    // Wrap everything in a <details> toggle
    html += `
      <tr>
        <td colspan="3" style="padding:0;">
          <details style="width:100%;">
            <summary style="
              display:grid;
              grid-template-columns: 34% 33% 33%;
              padding:10px 4px;
              cursor:pointer;
              border-bottom:1px solid #1f1f1f;
              list-style:none;
            ">
              <span style="text-align:left; color:#aaa; font-size:0.8rem; line-height:1.4;">${formatMatchLabel(match)}</span>
              <span style="text-align:center; ${xBold}">${xWins} (${xScore})</span>
              <span style="text-align:center; ${yBold}">${yWins} (${yScore})</span>
            </summary>
            <table style="width:100%; border-collapse:collapse; font-size:0.8rem; background:#141414; table-layout:fixed;">
              <colgroup>
                <col style="width:34%">
                <col style="width:33%">
                <col style="width:33%">
              </colgroup>
              ${gameRowsHtml}
              ${rosterRowsHtml}
            </table>
          </details>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  resultsDiv.innerHTML = summaryHtml + html;
}


function avg(arr) {
  if (arr.length === 0) return "—";
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.round(mean); // ← was .toFixed(1), now rounds to integer
}

function formatMatchLabel(match) {
  const leagueDisplay = match.league === "WLDs" ? "Worlds" : match.league;
  const splitPart = match.split ? ` ${match.split}` : "";
  const playoffPart = match.playoffs === "1" ? "Playoffs " : "";
  return `${match.year} ${leagueDisplay}${splitPart}<br><span style="color:#555; font-size:0.75rem;">${playoffPart}(${match.date})</span>`;
}

// 모바일 터치 툴팁
document.addEventListener("click", (e) => {
  const wrap = e.target.closest(".tooltip-wrap");

  // 툴팁 밖 클릭 시 모두 닫기
  document.querySelectorAll(".tooltip-wrap").forEach(el => {
    el.classList.remove("tooltip-active");
  });

  // 툴팁 클릭 시 토글
  if (wrap) {
    wrap.classList.add("tooltip-active");
    e.stopPropagation();
  }
});
