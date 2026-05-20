const STORAGE_KEY = 'jaxonsPottyTime2';
const PRIME_STICKERS = ['2', '3', '5', '7', '11', '13', '17', '19', '23', '29', '31', '37'];
const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
const FIBS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
const defaultState = {
  stickers: 0,
  today: 0,
  missions: 0,
  mathWins: 0,
  combo: 0,
  streak: 0,
  lastDay: '',
  sound: true,
  reminder: 30,
  phrase: 'Signal noticed. Approach run complete.',
  calmMode: false,
  effectLevel: 'flash',
  numberLevel: 'beast',
  signal: 18
};

let state = loadState();
let reminderTimer = null;
let currentChallenge = null;
let pointerTrailReady = 0;
let lastFrame = 0;
const game = {
  active: false,
  mode: 'Ready',
  score: 0,
  goal: 8,
  time: 30,
  combo: 0,
  rule: null,
  tiles: new Map(),
  raf: null,
  spawnTimer: null,
  tickTimer: null
};

const $ = (id) => document.getElementById(id);
const els = {
  today: $('todayCount'),
  stickers: $('stickerCount'),
  mathWins: $('mathWinCount'),
  grid: $('stickerGrid'),
  fill: $('signalFill'),
  signalText: $('signalText'),
  title: $('missionTitle'),
  text: $('missionText'),
  icon: $('missionIcon'),
  face: $('face'),
  floatLayer: $('floatLayer'),
  numberRain: $('numberRain'),
  bowlGlow: $('bowlGlow'),
  toast: $('toast'),
  flashLayer: $('flashLayer'),
  settings: $('settingsDialog'),
  missionNumber: $('missionNumber'),
  nextPrimeNumber: $('nextPrimeNumber'),
  factorCode: $('factorCode'),
  comboCount: $('comboCount'),
  numberStrip: $('numberStrip'),
  challengeType: $('challengeType'),
  challengeLevel: $('challengeLevel'),
  heroChallengeType: $('heroChallengeType'),
  heroChallengeLine: $('heroChallengeLine'),
  numberQuestion: $('numberQuestion'),
  numberChoices: $('numberChoices'),
  gameMode: $('gameMode'),
  gameTime: $('gameTime'),
  gameScore: $('gameScore'),
  gameGoal: $('gameGoal'),
  gameBanner: $('gameBanner')
};

function loadState() {
  try {
    return { ...defaultState, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return { ...defaultState };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function dayStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function syncDay() {
  const today = dayStamp();
  if (!state.lastDay) state.lastDay = today;
  if (state.lastDay !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    state.streak = state.today > 0 && state.lastDay === dayStamp(yesterday) ? state.streak + 1 : 0;
    state.today = 0;
    state.combo = 0;
    state.lastDay = today;
    saveState();
  }
}

function render() {
  syncDay();
  els.today.textContent = state.today;
  els.stickers.textContent = state.stickers;
  els.mathWins.textContent = state.mathWins;
  els.comboCount.textContent = state.combo || 0;
  els.fill.style.width = `${Math.max(8, Math.min(100, state.signal))}%`;
  els.signalText.textContent = signalLabel(state.signal);
  document.body.classList.toggle('low-stim', state.calmMode);
  $('soundBtn').textContent = state.sound ? 'Sound' : 'Quiet';
  $('reminderInput').value = state.reminder;
  $('phraseInput').value = state.phrase;
  $('calmModeInput').checked = state.calmMode;
  $('effectLevelInput').value = state.effectLevel;
  $('numberLevelInput').value = state.numberLevel;
  renderNumberFacts();
  renderStickers();
  updateGameHud();
}

function renderStickers() {
  els.grid.innerHTML = '';
  for (let i = 0; i < 24; i += 1) {
    const item = document.createElement('div');
    item.className = `sticker${i < state.stickers ? ' earned' : ''}`;
    item.textContent = i < state.stickers ? PRIME_STICKERS[i % PRIME_STICKERS.length] : i + 1;
    els.grid.appendChild(item);
  }
}

function renderNumberFacts() {
  const missions = Number(state.missions || 0);
  const stickersEarned = Number(state.stickers || 0);
  const factorTarget = Math.max(1, missions + stickersEarned + (state.combo || 0));
  els.missionNumber.textContent = missions;
  els.nextPrimeNumber.textContent = nextPrimeAfter(Math.max(1, stickersEarned));
  els.factorCode.textContent = factorCode(factorTarget);
  renderNumberStrip(factorTarget);
}

function renderNumberStrip(seed) {
  const sequence = smartSequence(seed).slice(0, 12);
  els.numberStrip.innerHTML = '';
  sequence.forEach((value, index) => {
    const cell = document.createElement('span');
    cell.textContent = value;
    cell.style.setProperty('--i', index);
    els.numberStrip.appendChild(cell);
  });
}

function signalLabel(value) {
  if (value < 30) return 'calm body';
  if (value < 58) return 'small signal';
  if (value < 82) return 'signal soon';
  return 'go now signal';
}

function chooseSignal(type) {
  startGame(type);
}

function modeConfig(type) {
  const level = levelRank();
  const factorTarget = [18, 24, 30, 36, 42, 48, 60][(state.missions + state.stickers) % 7];
  const multipleTarget = 3 + ((state.mathWins + level) % 7);
  const modes = {
    pee: {
      name: 'Bladder Prime Run',
      icon: 'PRIME',
      face: 'PRIME',
      signal: 72,
      goal: 8 + level,
      duration: 30,
      countsPotty: true,
      reward: 1,
      prompt: 'Tap prime numbers. Correct primes move the bladder signal to the toilet target.',
      accepts: (n) => isPrime(n),
      correct: () => pick(PRIMES),
      wrong: () => randomComposite(4, 99)
    },
    poop: {
      name: 'Bowel Factor Run',
      icon: 'FACT',
      face: 'FACT',
      signal: 86,
      goal: 9 + level,
      duration: 35,
      countsPotty: true,
      reward: 2,
      prompt: `Tap factors of ${factorTarget}. Correct factors move to the toilet target.`,
      accepts: (n) => factorTarget % n === 0,
      correct: () => pick(factors(factorTarget)),
      wrong: () => randomNonFactor(factorTarget)
    },
    try: {
      name: 'Approach Fibonacci Run',
      icon: 'FIBO',
      face: 'FIB',
      signal: 55,
      goal: 7 + level,
      duration: 30,
      countsPotty: true,
      reward: 1,
      prompt: 'Tap Fibonacci numbers. This is an approach run.',
      accepts: (n) => FIBS.includes(n),
      correct: () => pick(FIBS),
      wrong: () => randomNonMember(FIBS, 2, 99)
    },
    calm: {
      name: 'Number Rush',
      icon: 'RUSH',
      face: 'RUSH',
      signal: 40,
      goal: 12 + level,
      duration: 40,
      countsPotty: false,
      reward: 1,
      prompt: `Tap multiples of ${multipleTarget}. Build the biggest combo.`,
      accepts: (n) => n % multipleTarget === 0,
      correct: () => multipleTarget * rnd(1, 14),
      wrong: () => randomNonMultiple(multipleTarget)
    }
  };
  return modes[type] || modes.calm;
}

function startGame(type) {
  stopGame(false);
  const config = modeConfig(type);
  game.active = true;
  game.mode = config.name;
  game.score = 0;
  game.combo = 0;
  game.goal = config.goal;
  game.time = config.duration;
  game.rule = config;
  state.signal = config.signal;
  saveState();
  render();

  els.icon.textContent = config.icon;
  els.title.textContent = config.name;
  els.text.textContent = config.prompt;
  els.face.textContent = config.face;
  setBanner(config.name, config.prompt);
  spawnNumberTrail(smartSequence(state.stickers + state.missions + config.goal), 'math');
  flash('teal');
  ping(300);

  for (let i = 0; i < 5; i += 1) setTimeout(spawnTile, i * 180);
  game.spawnTimer = setInterval(spawnTile, Math.max(420, 900 - levelRank() * 120));
  game.tickTimer = setInterval(() => {
    game.time -= 1;
    updateGameHud();
    if (game.time <= 0) endRound(false);
  }, 1000);
  lastFrame = performance.now();
  game.raf = requestAnimationFrame(gameLoop);
}

function stopGame(clearTiles = true) {
  game.active = false;
  clearInterval(game.spawnTimer);
  clearInterval(game.tickTimer);
  cancelAnimationFrame(game.raf);
  game.spawnTimer = null;
  game.tickTimer = null;
  game.raf = null;
  if (clearTiles) {
    game.tiles.forEach((tile) => tile.el.remove());
    game.tiles.clear();
  }
  updateGameHud();
}

function spawnTile() {
  if (!game.active || !game.rule) return;
  const scene = $('scene').getBoundingClientRect();
  const value = Math.random() < 0.48 ? game.rule.correct() : game.rule.wrong();
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'game-tile';
  el.textContent = value;
  const tile = {
    el,
    value,
    x: rnd(12, Math.max(13, scene.width - 72)),
    y: -60,
    speed: rnd(34, 58 + levelRank() * 12) / 60,
    drift: rnd(-22, 22) / 60,
    wobble: Math.random() * 6.28
  };
  el.style.left = '0px';
  el.style.top = '0px';
  el.style.transform = `translate(${tile.x}px, ${tile.y}px)`;
  el.addEventListener('click', () => hitTile(tile));
  els.floatLayer.appendChild(el);
  game.tiles.set(el, tile);
}

function gameLoop(now) {
  if (!game.active) return;
  const dt = Math.min(34, now - lastFrame);
  lastFrame = now;
  const scene = $('scene').getBoundingClientRect();
  game.tiles.forEach((tile, key) => {
    tile.y += tile.speed * dt;
    tile.x += Math.sin(now / 260 + tile.wobble) * tile.drift * dt;
    tile.el.style.transform = `translate(${tile.x}px, ${tile.y}px)`;
    if (tile.y > scene.height + 80) {
      tile.el.remove();
      game.tiles.delete(key);
    }
  });
  game.raf = requestAnimationFrame(gameLoop);
}

function hitTile(tile) {
  if (!game.active || !game.rule || !game.tiles.has(tile.el)) return;
  const correct = game.rule.accepts(tile.value);
  if (correct) {
    game.score += 1;
    game.combo += 1;
    state.combo = Math.max(state.combo || 0, game.combo);
    tile.el.classList.add('correct');
    launchTileToPotty(tile);
    spawnNumberTrail([tile.value, nextPrimeAfter(tile.value), ...factors(Math.max(2, tile.value))], 'math');
    ping(420 + Math.min(8, game.combo) * 30);
    updateGameHud();
    if (game.score >= game.goal) endRound(true);
  } else {
    game.combo = 0;
    state.combo = 0;
    tile.el.classList.add('wrong');
    flash('gold');
    ping(150);
    setTimeout(() => removeTile(tile), 260);
    updateGameHud();
  }
  saveState();
  renderNumberFacts();
}

function launchTileToPotty(tile) {
  const tokenRect = tile.el.getBoundingClientRect();
  const pottyRect = $('potty').getBoundingClientRect();
  const dx = pottyRect.left + pottyRect.width * 0.55 - (tokenRect.left + tokenRect.width / 2);
  const dy = pottyRect.top + pottyRect.height * 0.55 - (tokenRect.top + tokenRect.height / 2);
  tile.el.style.setProperty('--dx', `${tile.x + dx}px`);
  tile.el.style.setProperty('--dy', `${tile.y + dy}px`);
  tile.el.classList.add('fly-potty');
  els.bowlGlow.classList.add('hit');
  setTimeout(() => els.bowlGlow.classList.remove('hit'), 360);
  setTimeout(() => removeTile(tile), 620);
}

function removeTile(tile) {
  tile.el.remove();
  game.tiles.delete(tile.el);
}

function endRound(won) {
  if (!game.active) return;
  const config = game.rule;
  const score = game.score;
  const combo = game.combo;
  stopGame(false);
  game.tiles.forEach((tile) => tile.el.classList.add('fade-out'));
  setTimeout(() => {
    game.tiles.forEach((tile) => tile.el.remove());
    game.tiles.clear();
  }, 520);

  if (won) {
    const bonus = config.reward + Math.floor(Math.max(combo, 0) / 4);
    if (config.countsPotty) {
      state.today += 1;
      state.missions = Number(state.missions || 0) + 1;
    }
    state.mathWins += score;
    state.stickers += bonus;
    state.signal = 12;
    if (state.today === 1) state.streak = Math.max(1, state.streak);
    saveState();
    render();
    makeNumberChallenge(config.name);
    els.icon.textContent = 'WIN';
    els.title.textContent = `${config.name} cleared`;
    els.text.textContent = `${score}/${game.goal} landed. Combo ${combo}. +${bonus} prime credit${bonus > 1 ? 's' : ''}.`;
    setBanner('Run cleared', `Score ${score}. Combo ${combo}. Prime credits unlocked.`);
    burstDigits(smartSequence(state.stickers + score + combo));
    flash('teal');
    fanfare();
  } else {
    state.combo = 0;
    saveState();
    render();
    els.title.textContent = 'Run complete';
    els.text.textContent = `Score ${score}/${game.goal}. Start another run and beat the code.`;
    setBanner('Try again', `Score ${score}/${game.goal}. The next code is ready.`);
    makeNumberChallenge('practice');
  }
}

function updateGameHud() {
  els.gameMode.textContent = game.mode || 'Ready';
  els.gameTime.textContent = Math.max(0, game.time || 30);
  els.gameScore.textContent = game.score || 0;
  els.gameGoal.textContent = game.goal || 8;
}

function setBanner(title, detail) {
  els.gameBanner.innerHTML = `<strong>${title}</strong><span>${detail}</span>`;
  els.gameBanner.classList.add('show');
  clearTimeout(setBanner.timer);
  setBanner.timer = setTimeout(() => els.gameBanner.classList.remove('show'), 1900);
}

function makeNumberChallenge(type = 'practice') {
  const level = levelRank();
  const missions = Math.max(1, Number(state.missions || 0));
  const total = Math.max(1, Number(state.stickers || 0));
  const combo = Math.max(0, Number(state.combo || 0));
  const n = missions + total + combo;
  const bank = [
    challenge('Prime Jump', `Next prime after ${total + combo}?`, nextPrimeAfter(total + combo), [total + combo + 1, nextPrimeAfter(total + combo) + 2, nextPrimeAfter(total + combo) + 4]),
    challenge('Factor Count', `How many factors does ${Math.max(2, n)} have?`, factors(Math.max(2, n)).length, [factors(Math.max(2, n)).length + 1, Math.max(1, factors(Math.max(2, n)).length - 1), factors(Math.max(2, n)).length + 2]),
    challenge('Fibonacci', `F(${Math.min(12, 5 + (n % 8))}) = ?`, fib(Math.min(12, 5 + (n % 8))), [fib(Math.min(12, 5 + (n % 8))) + 1, fib(Math.min(12, 5 + (n % 8))) - 1, fib(Math.min(12, 5 + (n % 8))) + 3]),
    challenge('Square Code', `${level + 3}^2 + ${missions} = ?`, (level + 3) ** 2 + missions, [(level + 3) ** 2, (level + 4) ** 2 + missions, (level + 3) ** 2 + missions + 2])
  ];
  if (level >= 2) {
    bank.push(
      challenge('Triangular', `T(${6 + (n % 7)}) = ?`, triangular(6 + (n % 7)), [triangular(5 + (n % 7)), triangular(6 + (n % 7)) + 6, triangular(6 + (n % 7)) - 3]),
      challenge('Modulo', `${n * 7 + 5} mod ${5 + (missions % 5)} = ?`, (n * 7 + 5) % (5 + (missions % 5)), [((n * 7 + 5) % (5 + (missions % 5))) + 1, Math.max(0, ((n * 7 + 5) % (5 + (missions % 5))) - 1), 5 + (missions % 5)])
    );
  }
  if (level >= 3) {
    const a = 2 + (n % 5);
    const x = 3 + (missions % 8);
    const b = total % 9;
    bank.push(
      challenge('Solve X', `${a}x + ${b} = ${a * x + b}. x = ?`, x, [x + 1, Math.max(1, x - 1), x + 2]),
      challenge('Prime Gap', `Prime gap after ${previousPrime(n + 20)}?`, nextPrimeAfter(previousPrime(n + 20)) - previousPrime(n + 20), [2, 4, 6, 8])
    );
  }
  currentChallenge = bank[(n + type.length + level) % bank.length];
  els.challengeType.textContent = currentChallenge.type;
  els.challengeLevel.textContent = `Level ${level}: ${state.numberLevel}`;
  els.heroChallengeType.textContent = `${currentChallenge.type} | Level ${level}`;
  els.heroChallengeLine.textContent = currentChallenge.q;
  els.numberQuestion.textContent = currentChallenge.q;
  renderNumberChoices(currentChallenge);
  spawnNumberTrail([currentChallenge.a, ...currentChallenge.w], 'math');
}

function challenge(type, q, a, w) {
  return { type, q, a, w: w.filter((value) => Number.isFinite(value) && value !== a) };
}

function renderNumberChoices(challengeData) {
  els.numberChoices.innerHTML = '';
  makeChoices(challengeData.a, challengeData.w).forEach((answer) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = answer;
    button.addEventListener('click', () => answerNumber(answer, button));
    els.numberChoices.appendChild(button);
  });
}

function answerNumber(answer, button) {
  if (!currentChallenge) return;
  const correct = Number(answer) === Number(currentChallenge.a);
  [...els.numberChoices.querySelectorAll('button')].forEach((item) => {
    item.disabled = true;
    if (Number(item.textContent) === Number(currentChallenge.a)) item.classList.add('correct');
  });
  if (correct) {
    state.combo = Number(state.combo || 0) + 1;
    const bonus = 1 + Math.floor(state.combo / 3);
    state.mathWins += 1;
    state.stickers += bonus;
    saveState();
    render();
    button.classList.add('correct');
    showToast(`Correct. Combo ${state.combo}. +${bonus} prime credit${bonus > 1 ? 's' : ''}.`);
    flash('teal');
    burstDigits(smartSequence(state.stickers + state.combo));
    fanfare();
  } else {
    state.combo = 0;
    saveState();
    render();
    button.classList.add('wrong');
    showToast(`Close. The answer is ${currentChallenge.a}. New code loading.`);
    ping(160);
  }
  setTimeout(() => makeNumberChallenge('practice'), 850);
}

function makeChoices(answer, wrong) {
  const values = [answer, ...wrong];
  let step = 1;
  while ([...new Set(values)].length < 4) {
    values.push(answer + step);
    values.push(Math.max(0, answer - step));
    values.push(answer + step * 2);
    step += 1;
  }
  return shuffle([...new Set(values)]).slice(0, 4);
}

function levelRank() {
  return state.numberLevel === 'beast' ? 3 : state.numberLevel === 'genius' ? 2 : 1;
}

function effectsOn(kind) {
  if (state.calmMode) return false;
  if (kind === 'trail') return state.effectLevel === 'trail' || state.effectLevel === 'flash';
  if (kind === 'flash') return state.effectLevel === 'flash';
  return false;
}

function spawnNumberTrail(values, type) {
  if (!effectsOn('trail')) return;
  values.slice(0, 14).forEach((value, index) => {
    const node = document.createElement('span');
    node.className = `trail-number ${type}`;
    node.textContent = value;
    node.style.left = `${8 + ((index * 13) % 78)}%`;
    node.style.top = `${14 + ((index * 19) % 62)}%`;
    node.style.setProperty('--delay', `${index * 42}ms`);
    els.numberRain.appendChild(node);
    setTimeout(() => node.remove(), 1700 + index * 42);
  });
}

function burstDigits(values) {
  if (!effectsOn('trail')) return;
  const scene = $('scene').getBoundingClientRect();
  values.slice(0, 18).forEach((value, index) => {
    const node = document.createElement('span');
    node.className = 'burst-number';
    node.textContent = value;
    node.style.left = `${scene.left + scene.width / 2}px`;
    node.style.top = `${scene.top + scene.height / 2}px`;
    node.style.setProperty('--x', `${Math.cos(index * 0.9) * (80 + index * 6)}px`);
    node.style.setProperty('--y', `${Math.sin(index * 0.9) * (70 + index * 4)}px`);
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 900);
  });
}

function flash(color) {
  if (!effectsOn('flash')) return;
  els.flashLayer.className = `flash-layer show ${color}`;
  setTimeout(() => {
    els.flashLayer.className = 'flash-layer';
  }, 260);
}

function pointerTrail(event) {
  if (!effectsOn('trail')) return;
  const now = performance.now();
  if (now < pointerTrailReady) return;
  pointerTrailReady = now + 45;
  const point = event.touches ? event.touches[0] : event;
  if (!point) return;
  const node = document.createElement('span');
  node.className = 'pointer-number';
  node.textContent = PRIME_STICKERS[(state.mathWins + state.stickers + Math.floor(now / 100)) % PRIME_STICKERS.length];
  node.style.left = `${point.clientX}px`;
  node.style.top = `${point.clientY}px`;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 620);
}

function isPrime(n) {
  if (n < 2) return false;
  for (let i = 2; i <= Math.sqrt(n); i += 1) {
    if (n % i === 0) return false;
  }
  return true;
}

function nextPrimeAfter(n) {
  let candidate = Math.floor(n) + 1;
  while (!isPrime(candidate)) candidate += 1;
  return candidate;
}

function previousPrime(n) {
  let candidate = Math.max(2, Math.floor(n));
  while (candidate > 2 && !isPrime(candidate)) candidate -= 1;
  return candidate;
}

function factors(n) {
  const list = [];
  for (let i = 1; i <= n; i += 1) {
    if (n % i === 0) list.push(i);
  }
  return list;
}

function factorCode(n) {
  const list = factors(n);
  return list.length > 5 ? `${list.slice(0, 4).join(',')}...` : list.join(',');
}

function fib(n) {
  if (n <= 1) return n;
  let a = 0;
  let b = 1;
  for (let i = 2; i <= n; i += 1) {
    [a, b] = [b, a + b];
  }
  return b;
}

function triangular(n) {
  return (n * (n + 1)) / 2;
}

function smartSequence(seed) {
  const start = Math.max(1, seed % 9);
  const mode = seed % 4;
  if (mode === 0) return Array.from({ length: 12 }, (_, i) => nextPrimeAfter(start + i * 3));
  if (mode === 1) return Array.from({ length: 12 }, (_, i) => fib(i + 2));
  if (mode === 2) return Array.from({ length: 12 }, (_, i) => triangular(i + start));
  return Array.from({ length: 12 }, (_, i) => (i + start) ** 2);
}

function randomComposite(min, max) {
  let n = rnd(min, max);
  while (isPrime(n)) n = rnd(min, max);
  return n;
}

function randomNonFactor(target) {
  let n = rnd(2, Math.min(99, target + 28));
  while (target % n === 0) n = rnd(2, Math.min(99, target + 28));
  return n;
}

function randomNonMember(list, min, max) {
  let n = rnd(min, max);
  while (list.includes(n)) n = rnd(min, max);
  return n;
}

function randomNonMultiple(base) {
  let n = rnd(2, 99);
  while (n % base === 0) n = rnd(2, 99);
  return n;
}

function rnd(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(list) {
  return list[rnd(0, list.length - 1)];
}

function shuffle(items) {
  return items
    .filter((value) => Number.isFinite(value))
    .sort(() => Math.random() - 0.5);
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 2800);
}

function ping(freq) {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!state.sound || !AudioCtor) return;
  const ctx = new AudioCtor();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  osc.type = 'sine';
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.16);
}

function fanfare() {
  [320, 420, 540, 680].forEach((freq, index) => setTimeout(() => ping(freq), index * 90));
}

function scheduleReminder() {
  clearTimeout(reminderTimer);
  reminderTimer = setTimeout(() => {
    if (game.active) return scheduleReminder();
    state.signal = Math.min(96, state.signal + 30);
    saveState();
    render();
    els.icon.textContent = 'SCAN';
    els.title.textContent = 'Body scan time';
    els.text.textContent = 'Pause, breathe, and choose a run.';
    setBanner('Body scan time', 'Pick a signal run when ready.');
    ping(240);
  }, state.reminder * 60 * 1000);
}

function bindEvents() {
  document.querySelectorAll('[data-signal]').forEach((button) => {
    button.addEventListener('click', () => chooseSignal(button.dataset.signal));
  });
  $('character').addEventListener('click', () => {
    state.signal = Math.min(100, state.signal + 14);
    saveState();
    render();
    setBanner('Body scan', 'Choose the closest signal run.');
    spawnNumberTrail(smartSequence(state.signal), 'scan');
  });
  $('newNumberBtn').addEventListener('click', () => startGame('calm'));
  $('resetRoundBtn').addEventListener('click', () => {
    stopGame(true);
    state.signal = 18;
    saveState();
    els.icon.textContent = '?';
    els.title.textContent = 'Choose a run';
    els.text.textContent = 'Tap Prime, Factor, Fibo, or Rush to start a number run.';
    els.face.textContent = 'SCAN';
    render();
  });
  $('soundBtn').addEventListener('click', () => {
    state.sound = !state.sound;
    saveState();
    render();
  });
  $('settingsBtn').addEventListener('click', () => els.settings.showModal());
  $('reminderInput').addEventListener('change', (event) => {
    state.reminder = Math.max(5, Math.min(120, Number(event.target.value) || 30));
    saveState();
    scheduleReminder();
    render();
  });
  $('numberLevelInput').addEventListener('change', (event) => {
    state.numberLevel = event.target.value;
    saveState();
    render();
    makeNumberChallenge('practice');
  });
  $('effectLevelInput').addEventListener('change', (event) => {
    state.effectLevel = event.target.value;
    saveState();
    render();
    spawnNumberTrail(smartSequence(state.stickers + state.missions + 1), 'math');
  });
  $('phraseInput').addEventListener('input', (event) => {
    state.phrase = event.target.value.trim() || defaultState.phrase;
    saveState();
  });
  $('calmModeInput').addEventListener('change', (event) => {
    state.calmMode = event.target.checked;
    saveState();
    render();
  });
  $('resetAllBtn').addEventListener('click', () => {
    if (!confirm('Reset Number Signal Lab progress?')) return;
    stopGame(true);
    state = { ...defaultState, lastDay: dayStamp() };
    saveState();
    render();
    makeNumberChallenge('practice');
    showToast('Progress reset.');
  });
  window.addEventListener('pointermove', pointerTrail, { passive: true });
  window.addEventListener('touchmove', pointerTrail, { passive: true });
}

bindEvents();
render();
makeNumberChallenge('practice');
setTimeout(() => {
  spawnNumberTrail(smartSequence(state.stickers + state.missions + 11), 'math');
  flash('teal');
}, 450);
scheduleReminder();




