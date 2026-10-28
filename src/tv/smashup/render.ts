import { playerColor } from "../../smashup/lib/colors";
import { factionName } from "../../smashup/lib/catalog";
import { activePlayer } from "../../smashup/lib/game";
import { breakpointOf, isReady, standings, totalPower } from "../../smashup/lib/scoring";
import type { BaseInPlay, GameState } from "../../smashup/types";
import { escapeHtml as esc } from "../lib/html";

/**
 * The Smash Up board drawn for a TV across the room, as an HTML fragment. It is
 * drawn here on the server so the TV's browser only has to swap it in: the
 * Ouya's browsers are old and its processor is slow. Plain blocks and inline
 * widths only, no flexbox or grid, for the same reason. The classes are styled
 * by the TV page.
 */

const LOG_LINES = 2;

const percent = (part: number, whole: number) => Math.max(0, Math.min(100, whole > 0 ? (part / whole) * 100 : 0));

function scoreboard(state: GameState): string {
  const active = activePlayer(state).id;
  const width = 100 / state.players.length;
  return state.players
    .map((player, index) => {
      const vp = state.vp[player.id] ?? 0;
      const madness = state.madness ? state.madness[player.id] ?? 0 : null;
      const factions = player.factions.map(factionName).join(" + ");
      return `<div class="player${player.id === active ? " active" : ""}" style="width:${width}%">
<div class="player-in" style="border-color:${playerColor(index)}">
<div class="name" style="color:${playerColor(index)}">${esc(player.name)}${player.id === active ? ' <span class="turn-tag">TURN</span>' : ""}</div>
<div class="factions">${esc(factions || " ")}</div>
<div class="vp">${vp}<span class="of"> / ${state.target}</span></div>
<div class="bar"><div class="fill" style="width:${percent(vp, state.target)}%;background:${playerColor(index)}"></div></div>
${madness !== null ? `<div class="madness">Madness ${madness}</div>` : ""}
</div></div>`;
    })
    .join("");
}

function baseCard(state: GameState, base: BaseInPlay, width: number): string {
  const total = totalPower(base);
  const breakpoint = breakpointOf(base);
  const ready = isReady(base);
  const rows = standings(base, state.players)
    .filter((row) => row.eligible)
    .map((row) => {
      const index = state.players.findIndex((player) => player.id === row.player);
      const player = state.players[index];
      return `<div class="row">
<span class="dot" style="background:${playerColor(index)}"></span><span class="who">${esc(player?.name ?? "")}</span>
<span class="pw">${row.power}</span>${row.place ? `<span class="place">${["1st", "2nd", "3rd"][row.place - 1]}</span>` : ""}
</div>`;
    })
    .join("");
  return `<div class="base" style="width:${width}%"><div class="base-in${ready ? " ready" : ""}">
<div class="base-name">${esc(base.base.name)}</div>
<div class="base-meta">${base.base.vps.join(" · ")} VP</div>
<div class="power"><span class="big">${total}</span> / ${breakpoint}${ready ? ' <span class="ready-tag">SCORE IT</span>' : ""}</div>
<div class="bar"><div class="fill" style="width:${percent(total, breakpoint)}%"></div></div>
${rows || '<div class="row empty">No minions yet</div>'}
</div></div>`;
}

function bases(state: GameState): string {
  const count = state.slots.length;
  // Up to five across, then two rows.
  const perRow = count <= 5 ? count : Math.ceil(count / 2);
  const width = 100 / Math.max(1, perRow);
  return state.slots
    .map((base) =>
      base
        ? baseCard(state, base, width)
        : `<div class="base" style="width:${width}%"><div class="base-in waiting"><div class="base-name">Next base…</div></div></div>`,
    )
    .join("");
}

function latest(state: GameState): string {
  const lines = state.log.filter((line) => line.status === "done").slice(-LOG_LINES).reverse();
  return lines.map((line, i) => `<div class="log-line${i === 0 ? " newest" : ""}">${esc(line.text)}</div>`).join("");
}

function result(state: GameState): string {
  const outcome = state.result;
  if (!outcome) return "";
  if (outcome.kind === "tied") {
    const names = outcome.leaders.map((id) => state.players.find((player) => player.id === id)?.name ?? "");
    return `<div class="banner tied">Tied at the top: ${esc(names.join(" and "))}. Play on!</div>`;
  }
  const names = outcome.winners.map((id) => state.players.find((player) => player.id === id)?.name ?? "");
  const verb = names.length > 1 ? "win" : "wins";
  return `<div class="banner won">${esc(names.join(" and "))} ${verb}!</div>`;
}

export function renderSmashUp(state: GameState, room: string): string {
  const active = activePlayer(state);
  return `<div class="top"><span class="game">SMASH UP</span> <span class="sub">Turn ${state.turn.number} · ${esc(active.name)} to play · first to ${state.target}</span><span class="room">Game ${esc(room)}</span></div>
${result(state)}
<div class="players">${scoreboard(state)}</div>
<div class="bases${state.slots.length > 5 ? " two-rows" : ""}">${bases(state)}</div>
<div class="log">${latest(state)}</div>`;
}
