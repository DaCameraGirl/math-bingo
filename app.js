const STORAGE_KEY = 'jaxonsPottyTime2';
const stickers = ['STAR', 'ROCKET', 'CROWN', 'GEM', 'BOLT', 'KEY', 'MOON', 'SUN', 'OK', '10'];
const defaultState = {
  stickers: 0,
  today: 0,
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

const $ = (id) => document.getElementById(id);
const els = {
  today: $('todayCount'),
  stickers: $('stickerCount'),
  streak: $('streakCount'),
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
  settings: $('settingsDialog')
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
  els.streak.textContent = state.streak;
  els.fill.style.width = `${Math.max(8, Math.min(100, state.signal))}%`;
  els.signalText.textContent = signalLabel(state.signal);
  document.body.classList.toggle('low-stim', state.calmMode);
  $('soundBtn').textContent = state.sound ? 'Sound' : 'Quiet';
  $('reminderInput').value = state.reminder;
  $('phraseInput').value = state.phrase;
  $('calmModeInput').checked = state.calmMode;
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
  state.stickers += gain;
  state.signal = 12;
  if (state.today === 1) state.streak = Math.max(1, state.streak);
  saveState();
  render();
  celebrate(type, gain);
  scheduleReminder();
}

function celebrate(type, gain) {
  const message = gain > 0 ? `${state.phrase} +${gain} sticker${gain > 1 ? 's' : ''}.` : 'Check-in complete.';
  els.title.textContent = type === 'poop' ? 'Potty pop landed' : 'Potty mission complete';
  els.text.textContent = message;
  els.icon.textContent = 'WIN';
  els.face.textContent = ':D';
  showToast(message);
  fanfare();
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 2600);
}

function ping(freq) {
  if (!state.sound || !window.AudioContext) return;
  const ctx = new AudioContext();
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
    showToast('Progress reset.');
  });
}

bindEvents();
render();
scheduleReminder();
