const KEY = "fruit-crush-save-v1";

export interface SaveData {
  level: number;
  bestLevel: number;
  highScore: number;
  coins: number;
  hammers: number;
  shuffles: number;
  extras: number;
  sound: boolean;
  haptics: boolean;
  seenHelp: boolean;
}

const DEFAULT_SAVE: SaveData = {
  level: 1,
  bestLevel: 1,
  highScore: 0,
  coins: 80,
  hammers: 3,
  shuffles: 3,
  extras: 2,
  sound: true,
  haptics: true,
  seenHelp: false,
};

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SAVE };
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return { ...DEFAULT_SAVE, ...parsed };
  } catch {
    return { ...DEFAULT_SAVE };
  }
}

export function writeSave(save: SaveData): void {
  localStorage.setItem(KEY, JSON.stringify(save));
}
