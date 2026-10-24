// ================= الحالة =================
const DISHES = ['فول', 'طعمية', 'كشري', 'محشي', 'كنافة'];
const EMOJIS = ['🧑', '👩', '👴', '👵', '🧒', '👨'];

const DEFAULT_STATE = () => ({
  money: 100,
  reputation: 3,
  maxReputation: 5,
  level: 1,
  ordersServed: 0,
  perfectStreak: 0,
  dailyProgress: 0,
  dailyGoal: 10,
  ingredients: { 'فول': 3, 'طعمية': 3, 'كشري': 3, 'محشي': 3, 'كنافة': 3 },
  sellPrice: 12,
  buyPrice: 4,
  upgradeCost: 150,
  patienceDuration: 8000,
  // مؤقتات
  currentCustomer: null,
  patienceTimer: null,
  patienceLeft: 0,
});

let state = DEFAULT_STATE();

const $ = id => document.getElementById(id);

// ================= حفظ / تحميل =================
function save() {
  const toSave = { ...state };
  delete toSave.patienceTimer;
  delete toSave.currentCustomer;
  localStorage.setItem('basata_save_v2', JSON.stringify(toSave));
}

function load() {
  const raw = localStorage.getItem('basata_save_v2');
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    state = { ...DEFAULT_STATE(), ...data };
  } catch (e) { state = DEFAULT_STATE(); }
}

// ================= واجهة =================
function render() {
  $('money').textContent = Math.floor(state.money);
  $('lanterns').textContent = state.dailyProgress >= 0 ? Math.floor(state.ordersServed / 10) : 0;
  $('upgrade-cost').textContent = state.upgradeCost;
  $('daily-challenge').textContent = `تحدي اليوم: ${state.dailyProgress} / ${state.dailyGoal}`;
  $('upgrade-btn').disabled = state.money < state.upgradeCost;

  // القلوب
  let hearts = '';
  for (let i = 0; i < state.maxReputation; i++) {
    hearts += i < state.reputation ? '❤️' : '🖤';
  }
  $('hearts').textContent = hearts;

  // عدادات المكونات
  DISHES.forEach(dish => {
    const el = document.querySelector(`[data-count="${dish}"]`);
    const itemEl = document.querySelector(`.item[data-item="${dish}"]`);
    if (!el || !itemEl) return;
    const count = state.ingredients[dish] || 0;
    el.textContent = count;
    itemEl.classList.toggle('empty', count <= 0);
  });

  // سوق
  renderMarket();
}

// ================= السوق =================
function renderMarket() {
  const wrap = $('market-items');
  wrap.innerHTML = '';
  DISHES.forEach(dish => {
    const count = state.ingredients[dish] || 0;
    const affordable = state.money >= state.buyPrice;

    const row = document.createElement('div');
    row.className = 'market-row';
    row.innerHTML = `
      <div class="info">
        <span class="emoji">${emojiFor(dish)}</span>
        <div>
          <div>${dish}</div>
          <div class="count">عندك: ${count}</div>
        </div>
      </div>
      <button data-buy="${dish}" ${affordable ? '' : 'disabled'}>
        +1 (${state.buyPrice} ج)
      </button>
    `;
    wrap.appendChild(row);
  });

  wrap.querySelectorAll('[data-buy]').forEach(btn => {
    btn.addEventListener('click', () => buyIngredient(btn.dataset.buy));
  });
}

function emojiFor(dish) {
  const map = { 'فول': '🫘', 'طعمية': '🧆', 'كشري': '🍚', 'محشي': '🍆', 'كنافة': '🍮' };
  return map[dish] || '🍽️';
}

function buyIngredient(dish) {
  if (state.money < state.buyPrice) return;
  state.money -= state.buyPrice;
  state.ingredients[dish] = (state.ingredients[dish] || 0) + 1;
  showFeedback(`+1 ${dish}`);
  save();
  render();
}

function openMarket() {
  $('market-modal').classList.remove('hidden');
  renderMarket();
}
function closeMarket() {
  $('market-modal').classList.add('hidden');
}

// ================= الزبون =================
function spawnCustomer() {
  // لو سمعة 0 → game over
  if (state.reputation <= 0) { gameOver(); return; }

  const dish = DISHES[Math.floor(Math.random() * DISHES.length)];
  state.currentCustomer = dish;

  $('customer-emoji').textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
  $('order-item').textContent = dish;
  $('customer').classList.remove('hidden');

  startPatience();
}

function startPatience() {
  state.patienceLeft = state.patienceDuration;
  updatePatienceBar();
  clearInterval(state.patienceTimer);

  state.patienceTimer = setInterval(() => {
    // لو السوق مفتوح → اوقف الوقت
    if (!$('market-modal').classList.contains('hidden')) return;

    state.patienceLeft -= 100;

    if (state.patienceLeft <= 0) {
      clearInterval(state.patienceTimer);
      customerAngry();
    } else {
      updatePatienceBar();
    }
  }, 100);
}

function updatePatienceBar() {
  const pct = Math.max(0, (state.patienceLeft / state.patienceDuration) * 100);
  const fill = $('patience-fill');
  fill.style.width = pct + '%';
  fill.classList.toggle('danger', pct < 35);
}

function customerAngry() {
  state.reputation--;
  state.perfectStreak = 0;

  const cust = $('customer');
  cust.classList.add('shake');
  showFeedback('😡 الزبون مشي!');

  setTimeout(() => {
    cust.classList.remove('shake');
    hideCustomer();
    render();
    save();
    if (state.reputation <= 0) { gameOver(); return; }
    setTimeout(spawnCustomer, 1200);
  }, 300);
}

function hideCustomer() {
  $('customer').classList.add('hidden');
  state.currentCustomer = null;
  clearInterval(state.patienceTimer);
}

// ================= خدمة الزبون =================
function serve(dish) {
  if (!state.currentCustomer) return;

  // طلب غلط
  if (dish !== state.currentCustomer) {
    showFeedback('مش طلبه! ❌');
    return;
  }

  // مفيش مكونات
  if ((state.ingredients[dish] || 0) <= 0) {
    showFeedback('مفيش مكونات! اشتري 🛒');
    openMarket();
    return;
  }

  // نجاح ✅
  clearInterval(state.patienceTimer);
  state.ingredients[dish]--;
  state.money += state.sellPrice;
  state.ordersServed++;
  state.perfectStreak++;
  state.dailyProgress++;

  showFeedback(`+${state.sellPrice} جنيه ✅`);

  // سمعة
  if (state.perfectStreak % 5 === 0 && state.reputation < state.maxReputation) {
    state.reputation++;
    showFeedback('❤️ سمعة +1');
  }

  // تحدي اليوم
  if (state.dailyProgress >= state.dailyGoal) {
    state.dailyGoal += 5;
    state.dailyProgress = 0;
    showFeedback('🏮 تحدي اليوم خلص!');
  }

  hideCustomer();
  render();
  save();
  setTimeout(spawnCustomer, 800);
}

// ================= الترقية =================
function upgrade() {
  if (state.money < state.upgradeCost) return;
  state.money -= state.upgradeCost;
  state.level++;
  state.sellPrice += 3;
  state.upgradeCost = Math.floor(state.upgradeCost * 1.7);
  showFeedback(`⬆️ مستوى ${state.level}! سعر البيع ${state.sellPrice}`);
  render();
  save();
}

// ================= نهاية اليوم =================
function gameOver() {
  clearInterval(state.patienceTimer);
  hideCustomer();
  $('final-score').textContent = `خدمت ${state.ordersServed} زبون — مستوى ${state.level}`;
  $('gameover-modal').classList.remove('hidden');
}

function restart() {
  localStorage.removeItem('basata_save_v2');
  state = DEFAULT_STATE();
  $('gameover-modal').classList.add('hidden');
  render();
  save();
  setTimeout(spawnCustomer, 1000);
}

// ================= Feedback =================
function showFeedback(text) {
  const el = document.createElement('div');
  el.className = 'feedback';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

// ================= ربط الأحداث =================
document.querySelectorAll('.item').forEach(el => {
  el.addEventListener('click', () => serve(el.dataset.item));
});

$('market-btn').addEventListener('click', openMarket);
$('close-market').addEventListener('click', closeMarket);
$('upgrade-btn').addEventListener('click', upgrade);
$('restart-btn').addEventListener('click', restart);

// ================= بدء =================
load();
render();
setTimeout(spawnCustomer, 1200);
