const STORAGE_KEY = 'jaxonsPottyTime2';
const PRIME_STICKERS = ['2', '3', '5', '7', '11', '13', '17', '19', '23', '29', '31', '37'];
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
  phrase: 'Body signal noticed. Potty mission complete.',
  calmMode: false,
  effectLevel: 'flash',
  numberLevel: 'beast',
  signal: 18
};

let state = loadState();
let reminderTimer = null;
let currentChallenge = null;
let pointerTrailReady = 0;

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
  numberQuestion: $('numberQuestion'),
  numberChoices: $('numberChoices')
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
  document.body.classList.toggle('effects-flash', effectsOn('flash'));
  $('soundBtn').textContent = state.sound ? 'Sound' : 'Quiet';
  $('reminderInput').value = state.reminder;
  $('phraseInput').value = state.phrase;
  $('calmModeInput').checked = state.calmMode;
  $('effectLevelInput').value = state.effectLevel;
  $('numberLevelInput').value = state.numberLevel;
  renderNumberFacts();
  renderStickers();
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
  if (value < 82) return 'potty soon';
  return 'go now signal';
}

function chooseSignal(type) {
  const data = {
    pee: { icon: 'DROP', title: 'Pee signal spotted', text: 'Tap the drop and send it to the potty. Then go try for real.', token: 'drop', gain: 1, signal: 72, face: ':o' },
    poop: { icon: 'POP', title: 'Poop signal spotted', text: 'Tap the pop and land it in the potty. Slow body, steady feet.', token: 'pop', gain: 2, signal: 86, face: ':O' },
    try: { icon: 'TRY', title: 'Maybe means try', text: 'A short sit counts. You noticed the signal early.', token: 'try', gain: 1, signal: 55, face: ':|' },
    calm: { icon: 'OK', title: 'All clear check-in', text: 'Nice body scan. We will check again later.', token: 'ok', gain: 0, signal: 18, face: ':)' }
  }[type];

  els.icon.textContent = data.icon;
  els.title.textContent = data.title;
  els.text.textContent = data.text;
  els.face.textContent = data.face;
  state.signal = data.signal;
  saveState();
  render();
  ping(type === 'poop' ? 180 : 260);
  spawnNumberTrail(type === 'poop' ? factors(Math.max(2, state.missions + 2)) : smartSequence(state.stickers + 2), type);

  if (type === 'calm') {
    showToast('Body check complete. No pressure.');
    scheduleReminder();
    return;
  }
  spawnToken(type, data.token, data.gain);
}

function spawnToken(type, label, gain) {
  els.floatLayer.innerHTML = '';
  const token = document.createElement('button');
  token.type = 'button';
  token.className = `token ${type}`;
  token.textContent = label;
  token.style.left = type === 'poop' ? '30%' : '24%';
  token.style.top = type === 'try' ? '50%' : '42%';
  token.addEventListener('click', () => completeMission(token, gain, type));
  els.floatLayer.appendChild(token);
  showToast('Tap the token to send it to the potty.');
}

function completeMission(token, gain, type) {
  const tokenRect = token.getBoundingClientRect();
  const pottyRect = $('potty').getBoundingClientRect();
  const dx = pottyRect.left + pottyRect.width * 0.55 - (tokenRect.left + tokenRect.width / 2);
  const dy = pottyRect.top + pottyRect.height * 0.55 - (tokenRect.top + tokenRect.height / 2);
  token.style.setProperty('--dx', `${dx}px`);
  token.style.setProperty('--dy', `${dy}px`);
  token.classList.add('fly');
  token.disabled = true;
  setTimeout(() => token.remove(), 780);
  els.bowlGlow.classList.add('hit');
  setTimeout(() => els.bowlGlow.classList.remove('hit'), 520);

  state.today += 1;
  state.missions = Number(state.missions || 0) + 1;
  state.stickers += gain;
  state.signal = 12;
  if (state.today === 1) state.streak = Math.max(1, state.streak);
  saveState();
  render();
  celebrate(type, gain);
  makeNumberChallenge(type);
  scheduleReminder();
}

function celebrate(type, gain) {
  const nextPrime = nextPrimeAfter(Math.max(1, state.stickers));
  const message = gain > 0 ? `${state.phrase} +${gain}. Next prime: ${nextPrime}.` : 'Check-in complete.';
  els.title.textContent = type === 'poop' ? 'Potty pop landed' : 'Potty mission complete';
  els.text.textContent = message;
  els.icon.textContent = 'WIN';
  els.face.textContent = ':D';
  showToast(message);
  burstDigits(type === 'poop' ? factors(state.missions + state.stickers) : smartSequence(state.stickers + 3));
  flash('gold');
  fanfare();
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
  els.numberQuestion.textContent = currentChallenge.q;
  renderNumberChoices(currentChallenge);
  spawnNumberTrail([currentChallenge.a, ...currentChallenge.w], 'math');
}

function challenge(type, q, a, w) {
  return { type, q, a, w: w.filter((value) => Number.isFinite(value) && value !== a) };
}

function renderNumberChoices(challengeData) {
  els.numberChoices.innerHTML = '';
  const choices = makeChoices(challengeData.a, challengeData.w);
  choices.forEach((answer) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = answer;
    button.addEventListener('click', () => answerNumber(answer, button));
    els.numberChoices.appendChild(button);
  });
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
    showToast(`Correct. Combo ${state.combo}. +${bonus} prime sticker${bonus > 1 ? 's' : ''}.`);
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
  const list = values.slice(0, 14);
  list.forEach((value, index) => {
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
  const list = values.slice(0, 18);
  const scene = $('scene').getBoundingClientRect();
  list.forEach((value, index) => {
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
    state.signal = Math.min(96, state.signal + 30);
    saveState();
    render();
    els.icon.textContent = 'SCAN';
    els.title.textContent = 'Body scan time';
    els.text.textContent = 'Pause, breathe, and choose what your body is saying.';
    showToast('Body scan time.');
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
    showToast('Body scan: choose the closest signal.');
    spawnNumberTrail(smartSequence(state.signal), 'scan');
  });
  $('newNumberBtn').addEventListener('click', () => makeNumberChallenge('practice'));
  $('resetRoundBtn').addEventListener('click', () => {
    state.signal = 18;
    saveState();
    els.icon.textContent = '?';
    els.title.textContent = 'What does your body say?';
    els.text.textContent = 'Pick a body signal. Then help the pop reach the potty.';
    els.face.textContent = ':)';
    els.floatLayer.innerHTML = '';
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
    if (!confirm('Reset Potty Time 2 progress?')) return;
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
scheduleReminder();

