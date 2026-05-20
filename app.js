const STORE = 'numbersRUsBoard';
const size = 5;
const bingoLines = [
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24],
  [0, 5, 10, 15, 20],
  [1, 6, 11, 16, 21],
  [2, 7, 12, 17, 22],
  [3, 8, 13, 18, 23],
  [4, 9, 14, 19, 24],
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20]
];
const trackAnimals = ['Elephant', 'Zebra', 'Rhino', 'Giraffe', 'Panda', 'Otter', 'Tiger', 'Koala'];
const trackMarks = ['hoof', 'pad', 'claw', 'trail', 'den', 'scat', 'nest', 'burrow'];
const animalFacts = [
  { animal: 'Elephant', fact: '4 legs', key: 'elephant' },
  { animal: 'Spider', fact: '8 legs', key: 'spider' },
  { animal: 'Starfish', fact: '5 arms', key: 'starfish' },
  { animal: 'Insect', fact: '6 legs', key: 'insect' },
  { animal: 'Octopus', fact: '8 arms', key: 'octopus' },
  { animal: 'Bird', fact: '2 wings', key: 'bird' },
  { animal: 'Rhino', fact: '1 horn clue', key: 'rhino' },
  { animal: 'Crab', fact: '10 legs', key: 'crab' }
];

let state = load();
let card = [];
let marked = new Set();
let current = null;
let active = false;
let spotAnswer = null;
let animalFirst = null;
let stepSafeCount = 0;
let stepNeed = 5;
let stepRule = null;

const $ = (id) => document.getElementById(id);
const board = $('board');

function load() {
  try {
    return {
      wins: 0,
      credits: 0,
      streak: 0,
      sound: true,
      ...JSON.parse(localStorage.getItem(STORE) || '{}')
    };
  } catch {
    return { wins: 0, credits: 0, streak: 0, sound: true };
  }
}

function save() {
  localStorage.setItem(STORE, JSON.stringify(state));
}

function rnd(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function uniqueNumbers(count, min, max) {
  const values = new Set();
  while (values.size < count) values.add(rnd(min, max));
  return [...values];
}

function renderStats() {
  $('wins').textContent = state.wins;
  $('credits').textContent = state.credits;
  $('streak').textContent = state.streak;
  $('marked').textContent = marked.size;
  $('soundBtn').textContent = state.sound ? 'Sound On' : 'Sound Off';
}

function newCard() {
  card = uniqueNumbers(size * size, 1, 99);
  marked = new Set();
  active = false;
  current = null;
  board.innerHTML = '';
  card.forEach((value, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cell';
    button.textContent = value;
    button.dataset.index = index;
    button.addEventListener('click', () => chooseCell(index));
    board.appendChild(button);
  });
  setCall('Ready', 'Press Start Run.', 'Mark called numbers. Five marked squares in any row, column, or diagonal wins.');
  renderStats();
}

function startRun() {
  if (!card.length) newCard();
  active = true;
  nextClue();
  toast('Run started. Build a line.');
}

function nextClue() {
  if (!active) active = true;
  const open = card.map((value, index) => ({ value, index })).filter((item) => !marked.has(item.index));
  if (!open.length) {
    newCard();
    startRun();
    return;
  }
  const answer = open[rnd(0, open.length - 1)].value;
  current = makeClue(answer);
  setCall(current.type, current.text, current.hint);
}

function nextTrackClue() {
  if (!active) active = true;
  const open = card.map((value, index) => ({ value, index })).filter((item) => !marked.has(item.index));
  if (!open.length) {
    newCard();
    startRun();
    return;
  }
  const answer = open[rnd(0, open.length - 1)].value;
  current = makeTrackClue(answer);
  setCall(current.type, current.text, current.hint);
}

function makeClue(answer) {
  const options = [];
  if (answer > 3) {
    const a = rnd(1, answer - 1);
    options.push({
      type: 'Add/Subtract',
      text: `${a} + ${answer - a} = ?`,
      hint: 'Tap the answer.'
    });
  }
  if (answer <= 12) {
    const factor = rnd(2, 9);
    options.push({
      type: 'Division',
      text: `${answer * factor} / ${factor} = ?`,
      hint: 'Reduce it, then mark the board.'
    });
  }
  if (isPrime(answer)) {
    const previous = previousPrime(answer - 1);
    options.push({
      type: 'Prime Jump',
      text: `Next prime after ${previous} = ?`,
      hint: 'Find the prime on the board.'
    });
  }
  const root = Math.round(Math.sqrt(answer));
  if (root * root === answer) {
    options.push({
      type: 'Square Root',
      text: `sqrt(${answer}) x ${root} = ?`,
      hint: 'Use the square relationship.'
    });
  }
  if (answer % 2 === 0) {
    options.push({
      type: 'Half Code',
      text: `${answer / 2} x 2 = ?`,
      hint: 'Double it.'
    });
  }
  options.push({
    type: 'Direct Call',
    text: `Mark ${answer}`,
    hint: 'A direct call still counts.'
  });
  return { answer, ...shuffle(options)[0] };
}

function makeTrackClue(answer) {
  const animal = trackAnimals[rnd(0, trackAnimals.length - 1)];
  const options = [];
  if (answer > 8) {
    const offset = rnd(3, 14);
    options.push(`${animal} track card: ${answer + offset} - ${offset}`);
  }
  if (answer % 2 === 0) {
    options.push(`${animal} evidence code: ${answer / 2} x 2`);
  }
  if (answer <= 12) {
    const multiplier = rnd(3, 9);
    options.push(`${animal} sample tag: ${answer * multiplier} / ${multiplier}`);
  }
  if (isPrime(answer)) {
    options.push(`${animal} prime trail: next prime after ${previousPrime(answer - 1)}`);
  }
  options.push(`${animal} direct track: ${answer}`);
  return {
    answer,
    type: 'Track Card',
    text: `${shuffle(options)[0]} = ?`,
    hint: 'Match the zookeeper evidence card to the board number.'
  };
}

function chooseCell(index) {
  if (!active || !current || marked.has(index)) return;
  const button = board.children[index];
  const value = card[index];
  if (value !== current.answer) {
    button.classList.add('wrong');
    state.streak = 0;
    save();
    renderStats();
    beep(150);
    setTimeout(() => button.classList.remove('wrong'), 260);
    toast('Not that one. Solve the clue and try again.');
    return;
  }

  marked.add(index);
  button.classList.add('marked');
  state.credits += 1;
  state.streak += 1;
  save();
  renderStats();
  beep(420 + Math.min(state.streak, 10) * 24);
  launchSpark(button);

  const line = winningLine();
  if (line) {
    finishBingo(line);
  } else {
    nextClue();
  }
}

function winningLine() {
  return bingoLines.find((line) => line.every((index) => marked.has(index)));
}

function finishBingo(line) {
  active = false;
  line.forEach((index) => board.children[index].classList.add('bingo'));
  state.wins += 1;
  state.credits += 5;
  state.streak += 3;
  save();
  renderStats();
  setCall('BINGO', 'Approach run complete.', '+5 credits. New card when ready.');
  $('target').classList.add('hit');
  setTimeout(() => $('target').classList.remove('hit'), 900);
  fanfare();
  toast('BINGO. Approach run complete.');
}

function newSpotMatch() {
  const shared = Math.random() < 0.55 ? String(rnd(2, 99)) : trackMarks[rnd(0, trackMarks.length - 1)];
  spotAnswer = shared;
  const pool = shuffle([
    ...uniqueNumbers(16, 2, 99).map(String),
    ...trackMarks
  ].filter((item) => item !== shared));
  const cardA = shuffle([shared, ...pool.slice(0, 7)]);
  const cardB = shuffle([shared, ...pool.slice(7, 14)]);
  renderSpotCard($('spotCardA'), cardA);
  renderSpotCard($('spotCardB'), cardB);
  toast('Spot Match loaded. Find the shared item.');
}

function renderSpotCard(container, items) {
  container.innerHTML = '';
  items.forEach((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = item;
    button.style.setProperty('--r', `${(index % 5 - 2) * 7}deg`);
    button.addEventListener('click', () => chooseSpot(item, button));
    container.appendChild(button);
  });
}

function chooseSpot(item, button) {
  if (!spotAnswer) return;
  if (item !== spotAnswer) {
    button.classList.add('wrong');
    state.streak = 0;
    save();
    renderStats();
    beep(150);
    setTimeout(() => button.classList.remove('wrong'), 260);
    toast('No match. Look for the item on both cards.');
    return;
  }
  button.classList.add('correct');
  state.credits += 3;
  state.streak += 2;
  save();
  renderStats();
  $('target').classList.add('hit');
  setTimeout(() => $('target').classList.remove('hit'), 700);
  fanfare();
  toast(`Shared match: ${item}. +3 credits.`);
  setTimeout(newSpotMatch, 900);
}

function newAnimalPuzzle() {
  animalFirst = null;
  const picks = shuffle(animalFacts).slice(0, 4);
  const cards = shuffle([
    ...picks.map((item) => ({ kind: 'animal', label: item.animal, key: item.key })),
    ...picks.map((item) => ({ kind: 'fact', label: item.fact, key: item.key }))
  ]);
  const grid = $('animalGrid');
  grid.innerHTML = '';
  cards.forEach((card) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `animal-card ${card.kind}`;
    button.textContent = card.label;
    button.dataset.key = card.key;
    button.dataset.kind = card.kind;
    button.addEventListener('click', () => chooseAnimalCard(button));
    grid.appendChild(button);
  });
}

function chooseAnimalCard(button) {
  if (button.classList.contains('matched')) return;
  if (!animalFirst) {
    animalFirst = button;
    button.classList.add('selected');
    return;
  }
  if (animalFirst === button) return;
  const match = animalFirst.dataset.key === button.dataset.key && animalFirst.dataset.kind !== button.dataset.kind;
  if (match) {
    animalFirst.classList.add('matched');
    button.classList.add('matched');
    animalFirst.classList.remove('selected');
    state.credits += 2;
    state.streak += 1;
    save();
    renderStats();
    beep(520);
    toast('Animal match. +2 credits.');
    if ([...$('animalGrid').children].every((card) => card.classList.contains('matched'))) {
      state.credits += 3;
      save();
      renderStats();
      fanfare();
      toast('Puzzle cleared. +3 bonus credits.');
    }
  } else {
    animalFirst.classList.remove('selected');
    button.classList.add('wrong');
    state.streak = 0;
    save();
    renderStats();
    beep(140);
    setTimeout(() => button.classList.remove('wrong'), 260);
  }
  animalFirst = null;
}

function newStepPath() {
  stepSafeCount = 0;
  const divisor = rnd(3, 9);
  stepRule = (value) => value % divisor === 0;
  $('stepRule').textContent = `Step only on multiples of ${divisor}. Clear ${stepNeed} safe steps.`;
  const safe = uniqueNumbers(7, 1, 12).map((value) => value * divisor);
  const traps = [];
  while (traps.length < 9) {
    const value = rnd(2, 99);
    if (value % divisor !== 0 && !traps.includes(value)) traps.push(value);
  }
  const cells = shuffle([...safe.slice(0, 7), ...traps]).slice(0, 16);
  const grid = $('stepGrid');
  grid.innerHTML = '';
  cells.forEach((value) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = value;
    button.dataset.value = value;
    button.addEventListener('click', () => chooseStep(button));
    grid.appendChild(button);
  });
}

function chooseStep(button) {
  if (!stepRule || button.disabled) return;
  const value = Number(button.dataset.value);
  if (!stepRule(value)) {
    button.classList.add('trap');
    state.streak = 0;
    save();
    renderStats();
    beep(140);
    toast('Trap step. New path.');
    setTimeout(newStepPath, 650);
    return;
  }
  button.classList.add('safe');
  button.disabled = true;
  stepSafeCount += 1;
  state.credits += 1;
  state.streak += 1;
  save();
  renderStats();
  beep(460 + stepSafeCount * 30);
  if (stepSafeCount >= stepNeed) {
    state.credits += 4;
    save();
    renderStats();
    $('target').classList.add('hit');
    setTimeout(() => $('target').classList.remove('hit'), 700);
    fanfare();
    toast('Safe path complete. +4 bonus credits.');
    setTimeout(newStepPath, 900);
  }
}

function setCall(type, text, hint) {
  $('callType').textContent = type;
  $('callText').textContent = text;
  $('callHint').textContent = hint;
}

function launchSpark(source) {
  const rect = source.getBoundingClientRect();
  const target = $('target').getBoundingClientRect();
  const spark = document.createElement('span');
  spark.className = 'spark';
  spark.textContent = source.textContent;
  spark.style.left = `${rect.left + rect.width / 2}px`;
  spark.style.top = `${rect.top + rect.height / 2}px`;
  spark.style.setProperty('--x', `${target.left + target.width / 2 - rect.left}px`);
  spark.style.setProperty('--y', `${target.top + target.height / 2 - rect.top}px`);
  document.body.appendChild(spark);
  setTimeout(() => spark.remove(), 650);
}

function isPrime(n) {
  if (n < 2) return false;
  for (let i = 2; i <= Math.sqrt(n); i += 1) {
    if (n % i === 0) return false;
  }
  return true;
}

function previousPrime(n) {
  let value = Math.max(2, n);
  while (value > 2 && !isPrime(value)) value -= 1;
  return value;
}

function beep(freq) {
  if (!state.sound) return;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;
  const ctx = new AudioCtor();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.16);
}

function fanfare() {
  [320, 440, 560, 740].forEach((freq, index) => setTimeout(() => beep(freq), index * 90));
}

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2200);
}

function showMode(mode) {
  document.querySelectorAll('.mode-card').forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === mode);
  });
  document.querySelectorAll('.mode-content').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `mode-${mode}`);
  });
}

$('startBtn').addEventListener('click', startRun);
$('trackClueBtn').addEventListener('click', nextTrackClue);
$('nextClueBtn').addEventListener('click', nextClue);
$('newCardBtn').addEventListener('click', newCard);
$('newSpotBtn').addEventListener('click', newSpotMatch);
$('newAnimalBtn').addEventListener('click', newAnimalPuzzle);
$('newStepBtn').addEventListener('click', newStepPath);
document.querySelectorAll('.mode-card').forEach((button) => {
  button.addEventListener('click', () => showMode(button.dataset.mode));
});
$('soundBtn').addEventListener('click', () => {
  state.sound = !state.sound;
  save();
  renderStats();
});

newCard();
newSpotMatch();
newAnimalPuzzle();
newStepPath();
