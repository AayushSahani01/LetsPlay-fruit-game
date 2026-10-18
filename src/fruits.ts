export interface FruitDef {
  id: number;
  emoji: string;
  name: string;
  color: string;
  glow: string;
}

export const FRUITS: FruitDef[] = [
  { id: 0, emoji: "🍎", name: "Apple", color: "#ff4d6d", glow: "#ff8fab" },
  { id: 1, emoji: "🍊", name: "Orange", color: "#ff9f1c", glow: "#ffbf69" },
  { id: 2, emoji: "🍋", name: "Lemon", color: "#ffd60a", glow: "#ffe66d" },
  { id: 3, emoji: "🍇", name: "Grape", color: "#7b2cbf", glow: "#c77dff" },
  { id: 4, emoji: "🫐", name: "Berry", color: "#4cc9f0", glow: "#90e0ef" },
  { id: 5, emoji: "🍓", name: "Strawberry", color: "#e63946", glow: "#ff758f" },
];

export const BOMB_EMOJI = "🌈";
