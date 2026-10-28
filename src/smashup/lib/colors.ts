/** Six colours that stay apart on the dark page; a name always goes with one, so colour is never the only cue. */
export const PLAYER_COLORS = ["#60a5fa", "#f472b6", "#fb923c", "#4ade80", "#a78bfa", "#e5e5e5"];

export const playerColor = (index: number) => PLAYER_COLORS[index % PLAYER_COLORS.length];
