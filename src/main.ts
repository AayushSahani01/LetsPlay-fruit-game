import { BOMB_EMOJI, FRUITS } from "./fruits";
import { COLS, CrushGame, ROWS, findHint, type Pos, type Special, type Tile } from "./engine";
import { goalLabel } from "./levels";
import { loadSave, writeSave, type SaveData } from "./storage";
import { haptic, setupNative } from "./native";
import { sfxInvalid, sfxLose, sfxMatch, sfxSwap, sfxWin, unlockAudio } from "./audio";

const app = document.querySelector("#app")!;
let save: SaveData = loadSave();
let game: CrushGame | null = null;
let selected: Pos | null = null;
let busy = false;
let smashMode = false;
let hintPair: { a: Pos; b: Pos } | null = null;
let hintTimer = 0;
let toastTimer = 0;

function persist(): void {
  writeSave(save);
}

function fruitEmoji(tile: Tile): string {
  if (tile.special === "bomb") return BOMB_EMOJI;
  if (tile.fruit < 0) return "";
  return FRUITS[tile.fruit].emoji;
}

function specialBadge(special: Special): string {
  if (special === "stripeH") return "➡️";
  if (special === "stripeV") return "⬇️";
  if (special === "wrapped") return "💥";
  return "";
}

function toast(text: string): void {
  const el = document.querySelector(".toast");
  if (!el) return;
  el.textContent = text;
  el.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove("show"), 1800);
}

function renderHome(): void {
  game = null;
  smashMode = false;
  app.innerHTML = `
    <div class="screen">
      <div class="brand">
        <h1>Fruit Crush</h1>
        <p>Match 3, combo big, crush more</p>
      </div>
      <div class="fruit-row">🍎🍊🍋🍇🫐🍓</div>
      <div class="home-card">
        <div class="stat-grid">
          <div class="stat"><b>${save.level}</b><span>Current level</span></div>
          <div class="stat"><b>${save.coins}</b><span>Coins</span></div>
          <div class="stat"><b>${save.bestLevel}</b><span>Best level</span></div>
          <div class="stat"><b>${save.highScore.toLocaleString()}</b><span>Best score</span></div>
        </div>
        <button class="btn" id="play">Play level ${save.level}</button>
        <button class="btn secondary" id="help">How to play</button>
        <button class="btn ghost" id="reset-progress">Reset progress</button>
        <div class="toggles">
          <button id="sound" class="${save.sound ? "on" : ""}">Sound ${save.sound ? "on" : "off"}</button>
          <button id="haptics" class="${save.haptics ? "on" : ""}">Haptics ${save.haptics ? "on" : "off"}</button>
        </div>
      </div>
    </div>
    <div class="overlay ${save.seenHelp ? "hidden" : ""}" id="help-modal">
      <div class="panel help">
        <h2>How to crush</h2>
        <ol>
          <li>Swap two neighbors to make 3 or more of the same fruit.</li>
          <li>Match 4 for a striped fruit, L/T for a wrapped blast, 5 for a rainbow bomb.</li>
          <li>Use Hint, Shuffle, Hammer, or +5 moves when you need a lift.</li>
          <li>Works the same on Android, iOS, and the web.</li>
        </ol>
        <button class="btn" id="close-help">Let's play</button>
      </div>
    </div>
    <div class="toast"></div>
  `;

  document.querySelector("#play")?.addEventListener("click", () => startLevel(save.level));
  document.querySelector("#help")?.addEventListener("click", () => {
    document.querySelector("#help-modal")?.classList.remove("hidden");
  });
  document.querySelector("#close-help")?.addEventListener("click", () => {
    save.seenHelp = true;
    persist();
    document.querySelector("#help-modal")?.classList.add("hidden");
  });
  document.querySelector("#sound")?.addEventListener("click", () => {
    save.sound = !save.sound;
    persist();
    renderHome();
  });
  document.querySelector("#haptics")?.addEventListener("click", () => {
    save.haptics = !save.haptics;
    persist();
    renderHome();
  });
  document.querySelector("#reset-progress")?.addEventListener("click", () => {
    if (!confirm("Reset levels, coins, and boosters?")) return;
    save = {
      ...save,
      level: 1,
      bestLevel: 1,
      coins: 80,
      hammers: 3,
      shuffles: 3,
      extras: 2,
    };
    persist();
    renderHome();
  });
}

function startLevel(id: number): void {
  void unlockAudio();
  game = new CrushGame(id);
  selected = null;
  busy = false;
  smashMode = false;
  hintPair = null;
  renderPlay();
  armHint();
}

function progressPct(): number {
  if (!game) return 0;
  const p = game.goalProgress();
  return Math.max(0, Math.min(100, (p.current / p.target) * 100));
}

function renderPlay(): void {
  if (!game) return;
  const p = game.goalProgress();
  const goal = game.goal();
  const goalIcon = goal.kind === "collect" ? FRUITS[goal.fruit].emoji : "⭐";
  app.innerHTML = `
    <div class="screen play ${busy ? "busy" : ""} ${smashMode ? "smash-mode" : ""}">
      <div class="hud">
        <button class="icon-btn" id="home" aria-label="Home">⌂</button>
        <div class="hud-main">
          <div class="hud-top">
            <span>Level <strong>${game.level.id}</strong></span>
            <span>${goalIcon} ${p.current}/${p.target}</span>
          </div>
          <div class="meter"><i style="width:${progressPct()}%"></i></div>
        </div>
        <button class="icon-btn" id="help-play" aria-label="Help">?</button>
      </div>
      <div class="chips">
        <div class="chip"><b>${game.moves}</b>Moves</div>
        <div class="chip"><b>${game.score.toLocaleString()}</b>Score</div>
        <div class="chip"><b>${save.coins}</b>Coins</div>
      </div>
      <div class="board-wrap">
        <div class="board" id="board"></div>
      </div>
      <div class="boosters">
        <button class="booster" id="hint">💡 Hint<small>free</small></button>
        <button class="booster ${smashMode ? "active" : ""}" id="hammer">🔨 Hammer<small>${save.hammers}</small></button>
        <button class="booster" id="shuffle">🔀 Shuffle<small>${save.shuffles}</small></button>
        <button class="booster" id="extra">➕ +5<small>${save.extras}</small></button>
      </div>
    </div>
    <div class="overlay hidden" id="end-modal"></div>
    <div class="overlay hidden" id="help-modal">
      <div class="panel help">
        <h2>Tips</h2>
        <ol>
          <li>Swipe or tap two neighboring fruits.</li>
          <li>Specials chain: rainbow + fruit clears every fruit of that kind.</li>
          <li>Hint pulses a valid move. Hammer smashes one tile.</li>
        </ol>
        <button class="btn" id="close-help">Close</button>
      </div>
    </div>
    <div class="toast"></div>
  `;
  paintBoard();
  bindPlay();
  maybeEnd();
}

function paintBoard(): void {
  if (!game) return;
  const boardEl = document.querySelector("#board");
  if (!boardEl) return;
  const html: string[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = game.board[r][c];
      const sel = selected && selected.r === r && selected.c === c ? "selected" : "";
      const hint =
        hintPair &&
        ((hintPair.a.r === r && hintPair.a.c === c) || (hintPair.b.r === r && hintPair.b.c === c))
          ? "hint"
          : "";
      const badge = specialBadge(t.special);
      html.push(
        `<button class="tile ${sel} ${hint}" data-r="${r}" data-c="${c}" aria-label="tile">${fruitEmoji(t)}${badge ? `<span class="badge">${badge}</span>` : ""}</button>`,
      );
    }
  }
  boardEl.innerHTML = html.join("");
}

function bindPlay(): void {
  document.querySelector("#home")?.addEventListener("click", renderHome);
  document.querySelector("#help-play")?.addEventListener("click", () => {
    document.querySelector("#help-modal")?.classList.remove("hidden");
  });
  document.querySelector("#close-help")?.addEventListener("click", () => {
    document.querySelector("#help-modal")?.classList.add("hidden");
  });
  document.querySelector("#hint")?.addEventListener("click", showHint);
  document.querySelector("#hammer")?.addEventListener("click", () => {
    if (save.hammers <= 0) {
      toast("Need a hammer — win levels to earn more");
      return;
    }
    smashMode = !smashMode;
    selected = null;
    document.querySelector(".screen")?.classList.toggle("smash-mode", smashMode);
    document.querySelector("#hammer")?.classList.toggle("active", smashMode);
    toast(smashMode ? "Tap a fruit to smash" : "Hammer cancelled");
  });
  document.querySelector("#shuffle")?.addEventListener("click", () => {
    if (!game || busy) return;
    if (save.shuffles <= 0) {
      toast("No shuffles left");
      return;
    }
    save.shuffles -= 1;
    persist();
    game.shuffle();
    hintPair = null;
    renderPlay();
    toast("Board shuffled");
    void haptic("medium", save.haptics);
  });
  document.querySelector("#extra")?.addEventListener("click", () => {
    if (!game || busy) return;
    if (save.extras <= 0) {
      toast("No extra-move boosters");
      return;
    }
    save.extras -= 1;
    persist();
    game.addMoves(5);
    renderPlay();
    toast("+5 moves");
    void haptic("light", save.haptics);
  });

  const board = document.querySelector("#board");
  if (!board) return;
  let start: Pos | null = null;

  board.addEventListener("pointerdown", (ev) => {
    const pos = posFromPoint(ev as PointerEvent);
    if (!pos) return;
    start = pos;
  });
  board.addEventListener("pointerup", (ev) => {
    const pos = posFromPoint(ev as PointerEvent);
    if (!pos || !start) return;
    if (start.r === pos.r && start.c === pos.c) void onTap(pos);
    else void tryMove(start, pos);
    start = null;
  });
}

function posFromPoint(ev: PointerEvent): Pos | null {
  const tile = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".tile") as HTMLElement | null;
  if (!tile) return null;
  return { r: Number(tile.dataset.r), c: Number(tile.dataset.c) };
}

async function onTap(pos: Pos): Promise<void> {
  if (!game || busy) return;
  if (smashMode) {
    smashMode = false;
    const smashed = game.smash(pos);
    if (smashed.ok) {
      save.hammers -= 1;
      persist();
    }
    await playResult(smashed);
    return;
  }
  if (!selected) {
    selected = pos;
    paintBoard();
    return;
  }
  if (selected.r === pos.r && selected.c === pos.c) {
    selected = null;
    paintBoard();
    return;
  }
  const from = selected;
  selected = null;
  await tryMove(from, pos);
}

async function tryMove(a: Pos, b: Pos): Promise<void> {
  if (!game || busy) return;
  const dr = b.r - a.r;
  const dc = b.c - a.c;
  if (Math.abs(dr) + Math.abs(dc) !== 1) {
    selected = b;
    paintBoard();
    return;
  }
  sfxSwap(save.sound);
  await playResult(game.trySwap(a, b));
}

async function playResult(result: ReturnType<CrushGame["trySwap"]>): Promise<void> {
  if (!game) return;
  if (result.invalid) {
    sfxInvalid(save.sound);
    void haptic("light", save.haptics);
    const board = document.querySelector("#board");
    board?.querySelectorAll(".tile").forEach((el) => el.classList.add("shake"));
    toast("Need a match of 3");
    return;
  }
  if (!result.ok) return;
  busy = true;
  document.querySelector(".screen")?.classList.add("busy");
  hintPair = null;
  window.clearTimeout(hintTimer);
  for (const step of result.steps) {
    game.board = step.board;
    game.collected = step.collected;
    paintBoard();
    updateHud();
    if (step.cleared.length) {
      sfxMatch(step.combo, save.sound);
      void haptic(step.combo > 2 ? "heavy" : "medium", save.haptics);
      for (const p of step.cleared) {
        const el = document.querySelector(`.tile[data-r="${p.r}"][data-c="${p.c}"]`);
        el?.classList.add("pop");
      }
      await wait(220);
    } else {
      await wait(140);
    }
  }
  busy = false;
  renderPlay();
  armHint();
}

function updateHud(): void {
  if (!game) return;
  const meter = document.querySelector(".meter > i") as HTMLElement | null;
  if (meter) meter.style.width = `${progressPct()}%`;
  const chips = document.querySelectorAll(".chip b");
  if (chips[0]) chips[0].textContent = String(game.moves);
  if (chips[1]) chips[1].textContent = game.score.toLocaleString();
}

function armHint(): void {
  window.clearTimeout(hintTimer);
  hintTimer = window.setTimeout(() => {
    if (!game || busy || game.won || game.lost) return;
    toast("Need a nudge? Hint is free");
  }, 8000);
}

function showHint(): void {
  if (!game || busy) return;
  const hint = findHint(game.board);
  if (!hint) {
    toast("No moves — shuffling");
    game.shuffle();
    renderPlay();
    return;
  }
  hintPair = hint;
  paintBoard();
  toast("Those two can crush");
  void haptic("light", save.haptics);
}

function maybeEnd(): void {
  if (!game) return;
  if (!game.won && !game.lost) return;
  const modal = document.querySelector("#end-modal");
  if (!modal) return;
  if (game.won) {
    sfxWin(save.sound);
    void haptic("heavy", save.haptics);
    const reward = 40 + Math.floor(game.score / 400);
    save.coins += reward;
    save.level = game.level.id + 1;
    save.bestLevel = Math.max(save.bestLevel, save.level);
    save.highScore = Math.max(save.highScore, game.score);
    if (game.level.id % 2 === 0) save.hammers += 1;
    if (game.level.id % 3 === 0) save.shuffles += 1;
    if (game.level.id % 4 === 0) save.extras += 1;
    persist();
    modal.innerHTML = `
      <div class="panel">
        <h2>Sweet win!</h2>
        <p>Score ${game.score.toLocaleString()} · +${reward} coins</p>
        <button class="btn" id="next">Level ${save.level}</button>
        <button class="btn ghost" id="home-end">Home</button>
      </div>`;
    modal.classList.remove("hidden");
    document.querySelector("#next")?.addEventListener("click", () => startLevel(save.level));
    document.querySelector("#home-end")?.addEventListener("click", renderHome);
    return;
  }
  sfxLose(save.sound);
  modal.innerHTML = `
    <div class="panel">
      <h2>Out of moves</h2>
      <p>${goalLabel(game.goal())} was the target.</p>
      <button class="btn" id="retry">Try again</button>
      <button class="btn secondary" id="continue">Continue for 80 coins</button>
      <button class="btn ghost" id="home-end">Home</button>
    </div>`;
  modal.classList.remove("hidden");
  document.querySelector("#retry")?.addEventListener("click", () => startLevel(game!.level.id));
  document.querySelector("#continue")?.addEventListener("click", () => {
    if (save.coins < 80) {
      toast("Need 80 coins");
      return;
    }
    save.coins -= 80;
    persist();
    game!.addMoves(5);
    renderPlay();
  });
  document.querySelector("#home-end")?.addEventListener("click", renderHome);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

void setupNative();
renderHome();
