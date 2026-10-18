export type Goal =
  | { kind: "score"; target: number }
  | { kind: "collect"; fruit: number; target: number };

export interface LevelDef {
  id: number;
  moves: number;
  fruitCount: number;
  goal: Goal;
}

export const LEVELS: LevelDef[] = [
  { id: 1, moves: 25, fruitCount: 5, goal: { kind: "score", target: 1800 } },
  { id: 2, moves: 24, fruitCount: 5, goal: { kind: "collect", fruit: 0, target: 18 } },
  { id: 3, moves: 24, fruitCount: 5, goal: { kind: "score", target: 2800 } },
  { id: 4, moves: 22, fruitCount: 5, goal: { kind: "collect", fruit: 1, target: 22 } },
  { id: 5, moves: 22, fruitCount: 6, goal: { kind: "score", target: 3600 } },
  { id: 6, moves: 22, fruitCount: 6, goal: { kind: "collect", fruit: 5, target: 24 } },
  { id: 7, moves: 20, fruitCount: 6, goal: { kind: "score", target: 4500 } },
  { id: 8, moves: 20, fruitCount: 6, goal: { kind: "collect", fruit: 3, target: 26 } },
  { id: 9, moves: 20, fruitCount: 6, goal: { kind: "score", target: 5400 } },
  { id: 10, moves: 18, fruitCount: 6, goal: { kind: "collect", fruit: 2, target: 28 } },
  { id: 11, moves: 18, fruitCount: 6, goal: { kind: "score", target: 6500 } },
  { id: 12, moves: 18, fruitCount: 6, goal: { kind: "collect", fruit: 4, target: 30 } },
  { id: 13, moves: 16, fruitCount: 6, goal: { kind: "score", target: 7200 } },
  { id: 14, moves: 16, fruitCount: 6, goal: { kind: "collect", fruit: 0, target: 32 } },
  { id: 15, moves: 16, fruitCount: 6, goal: { kind: "score", target: 8500 } },
];

export function getLevel(id: number): LevelDef {
  const last = LEVELS[LEVELS.length - 1];
  if (id <= LEVELS.length) return LEVELS[id - 1];
  const extra = id - LEVELS.length;
  return {
    id,
    moves: Math.max(14, last.moves - Math.floor(extra / 2)),
    fruitCount: 6,
    goal:
      extra % 2 === 1
        ? { kind: "score", target: last.goal.kind === "score" ? last.goal.target + extra * 400 : 8000 + extra * 400 }
        : { kind: "collect", fruit: extra % 6, target: 30 + extra * 2 },
  };
}

export function goalLabel(goal: Goal): string {
  if (goal.kind === "score") return `Score ${goal.target.toLocaleString()}`;
  const names = ["Apples", "Oranges", "Lemons", "Grapes", "Berries", "Strawberries"];
  return `Collect ${goal.target} ${names[goal.fruit]}`;
}
