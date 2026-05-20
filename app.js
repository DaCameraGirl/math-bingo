const STORAGE_KEY = 'jaxonsPottyTime2';
const stickers = ['2', '3', '5', '7', '11', '13', '17', '19', '23', '29'];
const defaultState = {
  stickers: 0,
  today: 0,
  missions: 0,
  mathWins: 0,
  streak: 0,
  lastDay: '',
  sound: true,
  reminder: 30,
  phrase: 'Body signal noticed. Potty mission complete.',
  calmMode: false,
  signal: 18
};
let state = loadState();
let reminderTimer = null;
let currentChallenge = null;

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
  bowlGlow: $('bowlGlow'),
  toast: $('toast'),
  settings: $('settingsDialog'),
  missionNumber: $('missionNumber'),
  nextPrimeNumber: $('nextPrimeNumber'),
  factorCode: $('factorCode'),
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
    state.lastDay = today;
    saveState();
  }
}

function render() {
  syncDay();
  els.today.textContent = state.today;
  els.stickers.textContent = state.stickers;
  els.mathWins.textContent = state.mathWins;
  els.fill.style.width = `${Math.max(8, Math.min(100, state.signal))}%`;
  els.signalText.textContent = signalLabel(state.signal);
  document.body.classList.toggle('low-stim', state.calmMode);
  $('soundBtn').textContent = state.sound ? 'Sound' : 'Quiet';
  $('reminderInput').value = state.reminder;
  $('phraseInput').value = state.phrase;
  $('calmModeInput').checked = state.calmMode;
  renderNumberFacts();
  renderStickers();
}

function renderStickers() {
  els.grid.innerHTML = '';
  for (let i = 0; i < 20; i++) {
    const item = document.createElement('div');
    item.className = `sticker${i < state.stickers ? ' earned' : ''}`;
    item.textContent = i < state.stickers ? stickers[i % stickers.length] : i + 1;
    els.grid.appendChild(item);
  }
}

function renderNumberFacts() {
  const missions = Number(state.missions || 0);
  const stickersEarned = Number(state.stickers || 0);
  els.missionNumber.textContent = missions;
  els.nextPrimeNumber.textContent = nextPrimeAfter(Math.max(1, stickersEarned));
  els.factorCode.textContent = factorCode(Math.max(1, missions + stickersEarned));
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
    try: { icon: 'TRY', title: 'Maybe means try', text: 'A short sit still counts. You noticed the signal early.', token: 'try', gain: 1, signal: 55, face: ':|' },
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
  fanfare();
}

function makeNumberChallenge(type = 'practice') {
  const missions = Math.max(1, Number(state.missions || 0));
  const total = Math.max(1, Number(state.stickers || 0));
  const challengeBank = [
    {
      q: `Next prime after ${total}?`,
      a: nextPrimeAfter(total),
      w: [nextPrimeAfter(total) + 2, Math.max(2, total + 1), nextPrimeAfter(total) + 4]
    },
    {
      q: `${missions} missions + ${total} stickers = ?`,
      a: missions + total,
      w: [missions + total + 1, Math.max(0, missions + total - 1), missions * 2 + total]
    },
    {
      q: `Double today's potty missions: ${state.today} x 2 = ?`,
      a: state.today * 2,
      w: [state.today + 2, state.today * 2 + 2, Math.max(0, state.today * 2 - 2)]
    },
    {
      q: `Factor count for ${missions}: how many factors?`,
      a: factors(missions).length,
      w: [factors(missions).length + 1, Math.max(1, factors(missions).length - 1), factors(missions).length + 2]
    }
  ];
  currentChallenge = challengeBank[(missions + total + type.length) % challengeBank.length];
  els.numberQuestion.textContent = currentChallenge.q;
  renderNumberChoices(currentChallenge);
}

function renderNumberChoices(challenge) {
  els.numberChoices.innerHTML = '';
  shuffle([challenge.a, ...challenge.w]).slice(0, 4).forEach((answer) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = answer;
    button.addEventListener('click', () => answerNumber(answer));
    els.numberChoices.appendChild(button);
  });
}

function answerNumber(answer) {
  if (!currentChallenge) return;
  const correct = Number(answer) === Number(currentChallenge.a);
  if (correct) {
    state.mathWins += 1;
    state.stickers += 1;
    saveState();
    render();
    showToast('Correct number win. +1 prime sticker.');
    fanfare();
    makeNumberChallenge('practice');
  } else {
    showToast(`Close. The answer is ${currentChallenge.a}. Try the next one.`);
    ping(160);
    makeNumberChallenge('practice');
  }
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

function shuffle(items) {
  return items
    .filter((value, index, array) => array.indexOf(value) === index)
    .sort(() => Math.random() - 0.5);
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 2600);
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
  [320, 420, 540].forEach((freq, index) => setTimeout(() => ping(freq), index * 120));
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
}

bindEvents();
render();
makeNumberChallenge('practice');
scheduleReminder();
