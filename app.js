const STORAGE_KEY = "financeiro-app-v1";

const state = loadState();
const formatMoney = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const els = {
  initialBalance: document.querySelector("#initialBalance"),
  monthPicker: document.querySelector("#monthPicker"),
  incomeTotal: document.querySelector("#incomeTotal"),
  expenseTotal: document.querySelector("#expenseTotal"),
  subscriptionTotal: document.querySelector("#subscriptionTotal"),
  balanceTotal: document.querySelector("#balanceTotal"),
  titheTotal: document.querySelector("#titheTotal"),
  monthRating: document.querySelector("#monthRating"),
  ratingCard: document.querySelector("#ratingCard"),
  transactionForm: document.querySelector("#transactionForm"),
  subscriptionForm: document.querySelector("#subscriptionForm"),
  goalForm: document.querySelector("#goalForm"),
  transactionList: document.querySelector("#transactionList"),
  subscriptionList: document.querySelector("#subscriptionList"),
  goalList: document.querySelector("#goalList"),
  chart: document.querySelector("#mainChart"),
  goalChart: document.querySelector("#goalChart"),
};

let activeChart = "weekly";

init();

function init() {
  els.initialBalance.value = state.initialBalance || "";
  els.monthPicker.value = state.month;
  setDefaultDate();
  bindEvents();
  render();
}

function bindEvents() {
  els.initialBalance.addEventListener("input", () => {
    state.initialBalance = Number(els.initialBalance.value || 0);
    saveState();
    render();
  });

  els.monthPicker.addEventListener("change", () => {
    state.month = els.monthPicker.value || getCurrentMonth();
    saveState();
    setDefaultDate();
    render();
  });

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      const tab = button.dataset.tab;
      els.transactionForm.classList.toggle("active-form", tab === "transaction");
      els.subscriptionForm.classList.toggle("active-form", tab === "subscription");
      els.goalForm.classList.toggle("active-form", tab === "goal");
    });
  });

  document.querySelectorAll("[data-chart]").forEach((button) => {
    button.addEventListener("click", () => {
      activeChart = button.dataset.chart;
      document.querySelectorAll("[data-chart]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderChart();
    });
  });

  els.transactionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(els.transactionForm);
    state.transactions.push({
      id: createId(),
      date: data.get("date"),
      type: data.get("type"),
      category: data.get("category"),
      description: clean(data.get("description")),
      amount: Number(data.get("amount")),
    });
    saveState();
    els.transactionForm.reset();
    setDefaultDate();
    render();
  });

  els.subscriptionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(els.subscriptionForm);
    state.subscriptions.push({
      id: createId(),
      name: clean(data.get("name")),
      amount: Number(data.get("amount")),
      dueDay: Number(data.get("dueDay")),
      active: data.get("active") === "on",
    });
    saveState();
    els.subscriptionForm.reset();
    els.subscriptionForm.elements.active.checked = true;
    els.subscriptionForm.elements.dueDay.value = 1;
    render();
  });

  els.goalForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(els.goalForm);
    state.goals.push({
      id: createId(),
      name: clean(data.get("name")),
      amount: Number(data.get("amount")),
      saved: Number(data.get("saved") || 0),
      months: Math.max(1, Number(data.get("months") || 1)),
    });
    saveState();
    els.goalForm.reset();
    els.goalForm.elements.saved.value = 0;
    els.goalForm.elements.months.value = 6;
    render();
  });

  document.querySelector("#clearTransactions").addEventListener("click", () => {
    if (!state.transactions.length || !confirm("Limpar todos os lançamentos?")) return;
    state.transactions = [];
    saveState();
    render();
  });

  document.querySelector("#clearSubscriptions").addEventListener("click", () => {
    if (!state.subscriptions.length || !confirm("Limpar todas as assinaturas?")) return;
    state.subscriptions = [];
    saveState();
    render();
  });

  document.querySelector("#clearGoals").addEventListener("click", () => {
    if (!state.goals.length || !confirm("Limpar todas as metas?")) return;
    state.goals = [];
    saveState();
    render();
  });

  window.addEventListener("resize", () => {
    renderChart();
    renderGoalChart();
  });
}

function render() {
  const summary = getMonthSummary(state.month);
  els.incomeTotal.textContent = formatMoney.format(summary.income);
  els.expenseTotal.textContent = formatMoney.format(summary.dailyExpenses);
  els.subscriptionTotal.textContent = formatMoney.format(summary.subscriptions);
  els.balanceTotal.textContent = formatMoney.format(summary.balance);
  els.titheTotal.textContent = formatMoney.format(summary.tithe);
  els.monthRating.textContent = summary.rating;
  els.ratingCard.className = `metric month-rating ${summary.ratingClass}`;
  renderTransactions();
  renderSubscriptions();
  renderGoals();
  renderChart();
  renderGoalChart();
}

function renderTransactions() {
  const items = getTransactionsForMonth(state.month).sort((a, b) => b.date.localeCompare(a.date));
  if (!items.length) {
    els.transactionList.innerHTML = `<p class="empty">Nenhum lançamento neste mês.</p>`;
    return;
  }
  els.transactionList.innerHTML = items
    .map((item) => {
      const typeLabel = item.type === "income" ? "Entrada" : "Saída";
      const valueClass = item.type === "income" ? "income" : "expense";
      const signal = item.type === "income" ? "+" : "-";
      return `
        <div class="item">
          <div>
            <p class="item-title">${escapeHtml(item.description)}</p>
            <p class="item-meta">${formatDate(item.date)} · ${typeLabel} · ${escapeHtml(item.category)}</p>
          </div>
          <div>
            <div class="item-value ${valueClass}">${signal}${formatMoney.format(item.amount)}</div>
            <button class="delete" type="button" data-delete-transaction="${item.id}">Excluir</button>
          </div>
        </div>
      `;
    })
    .join("");

  els.transactionList.querySelectorAll("[data-delete-transaction]").forEach((button) => {
    button.addEventListener("click", () => {
      state.transactions = state.transactions.filter((item) => item.id !== button.dataset.deleteTransaction);
      saveState();
      render();
    });
  });
}

function renderSubscriptions() {
  if (!state.subscriptions.length) {
    els.subscriptionList.innerHTML = `<p class="empty">Nenhuma assinatura cadastrada.</p>`;
    return;
  }
  els.subscriptionList.innerHTML = state.subscriptions
    .map((item) => `
      <div class="item">
        <div>
          <p class="item-title">${escapeHtml(item.name)}</p>
          <p class="item-meta">Vence dia ${item.dueDay} · ${item.active ? "Ativa" : "Inativa"}</p>
        </div>
        <div>
          <div class="item-value expense">${formatMoney.format(item.amount)}</div>
          <button class="delete" type="button" data-delete-subscription="${item.id}">Excluir</button>
        </div>
      </div>
    `)
    .join("");

  els.subscriptionList.querySelectorAll("[data-delete-subscription]").forEach((button) => {
    button.addEventListener("click", () => {
      state.subscriptions = state.subscriptions.filter((item) => item.id !== button.dataset.deleteSubscription);
      saveState();
      render();
    });
  });
}

function renderGoals() {
  if (!state.goals.length) {
    els.goalList.innerHTML = `<p class="empty">Nenhuma meta cadastrada.</p>`;
    return;
  }

  els.goalList.innerHTML = state.goals
    .map((item) => {
      const amount = Number(item.amount || 0);
      const saved = Math.min(Number(item.saved || 0), amount);
      const missing = Math.max(amount - saved, 0);
      const monthly = missing / Math.max(Number(item.months || 1), 1);
      const percent = amount > 0 ? Math.min(100, (saved / amount) * 100) : 0;
      return `
        <div class="item">
          <div>
            <p class="item-title">${escapeHtml(item.name)}</p>
            <p class="item-meta">Meta ${formatMoney.format(amount)} · guardar ${formatMoney.format(monthly)} por mês · ${item.months} meses</p>
            <div class="goal-progress">
              <div class="progress-track"><div class="progress-fill" style="width: ${percent}%"></div></div>
              <p class="item-meta">${percent.toFixed(0)}% guardado · falta ${formatMoney.format(missing)}</p>
            </div>
          </div>
          <div>
            <div class="item-value income">${formatMoney.format(saved)}</div>
            <button class="delete" type="button" data-delete-goal="${item.id}">Excluir</button>
          </div>
        </div>
      `;
    })
    .join("");

  els.goalList.querySelectorAll("[data-delete-goal]").forEach((button) => {
    button.addEventListener("click", () => {
      state.goals = state.goals.filter((item) => item.id !== button.dataset.deleteGoal);
      saveState();
      render();
    });
  });
}

function renderChart() {
  const canvas = els.chart;
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(700, Math.floor(rect.width * scale));
  canvas.height = Math.floor(360 * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  const width = canvas.width / scale;
  const height = canvas.height / scale;
  const data = getExpensePieData(activeChart);

  ctx.clearRect(0, 0, width, height);
  drawChartFrame(ctx, width, height, getChartTitle(activeChart));

  if (!data.length || !data.some((item) => item.value > 0)) {
    ctx.fillStyle = "#5d7164";
    ctx.font = "15px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Cadastre gastos ou assinaturas para visualizar o gráfico.", width / 2, height / 2);
    return;
  }

  drawPieChart(ctx, data, width, height);
}

function drawChartFrame(ctx, width, height, title) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#172026";
  ctx.font = "700 16px Arial";
  ctx.textAlign = "left";
  ctx.fillText(title, 18, 28);
}

function drawGrid(ctx, chart, maxValue) {
  ctx.strokeStyle = "#e2e8f0";
  ctx.fillStyle = "#64748b";
  ctx.font = "12px Arial";
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i += 1) {
    const y = chart.bottom - ((chart.bottom - chart.top) * i) / 4;
    const value = (maxValue * i) / 4;
    ctx.beginPath();
    ctx.moveTo(chart.left, y);
    ctx.lineTo(chart.right, y);
    ctx.stroke();
    ctx.fillText(shortMoney(value), chart.left - 10, y + 4);
  }
}

function drawBar(ctx, x, y, width, height, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, Math.max(1, height));
}

function drawLegend(ctx, x, y) {
  const items = [
    ["#15803d", "Entradas"],
    ["#86efac", "Saídas"],
    ["#0f7a45", "Saldo"],
  ];
  ctx.font = "12px Arial";
  ctx.textAlign = "left";
  items.forEach((item, index) => {
    const startX = x + index * 112;
    ctx.fillStyle = item[0];
    ctx.fillRect(startX, y, 12, 12);
    ctx.fillStyle = "#334155";
    ctx.fillText(item[1], startX + 18, y + 11);
  });
}

function drawPieChart(ctx, data, width, height) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = Math.min(width * 0.22, height * 0.32, 120);
  const centerX = Math.max(150, width * 0.34);
  const centerY = height * 0.55;
  let start = -Math.PI / 2;

  data.forEach((item) => {
    const angle = (item.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, start, start + angle);
    ctx.closePath();
    ctx.fillStyle = item.color;
    ctx.fill();
    start += angle;
  });

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.58, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.fillStyle = "#0f3d24";
  ctx.font = "700 16px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Total", centerX, centerY - 4);
  ctx.font = "13px Arial";
  ctx.fillText(formatMoney.format(total), centerX, centerY + 18);

  const legendX = Math.min(width - 260, centerX + radius + 70);
  let legendY = 70;
  ctx.textAlign = "left";
  data.forEach((item) => {
    const percent = total > 0 ? (item.value / total) * 100 : 0;
    ctx.fillStyle = item.color;
    ctx.fillRect(legendX, legendY - 11, 12, 12);
    ctx.fillStyle = "#31523d";
    ctx.font = "13px Arial";
    ctx.fillText(`${item.label} · ${percent.toFixed(0)}%`, legendX + 20, legendY);
    ctx.fillStyle = "#5d7164";
    ctx.font = "12px Arial";
    ctx.fillText(formatMoney.format(item.value), legendX + 20, legendY + 17);
    legendY += 42;
  });
}

function renderGoalChart() {
  const canvas = els.goalChart;
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(560, Math.floor(rect.width * scale));
  canvas.height = Math.floor(320 * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  const width = canvas.width / scale;
  const height = canvas.height / scale;

  ctx.clearRect(0, 0, width, height);
  drawChartFrame(ctx, width, height, "Progresso das metas");

  if (!state.goals.length) {
    ctx.fillStyle = "#5d7164";
    ctx.font = "15px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Cadastre uma meta para acompanhar o progresso.", width / 2, height / 2);
    return;
  }

  const data = state.goals.slice(-6).map((goal) => {
    const amount = Number(goal.amount || 0);
    const saved = Math.min(Number(goal.saved || 0), amount);
    return {
      label: goal.name,
      amount,
      saved,
      missing: Math.max(amount - saved, 0),
    };
  });
  const maxValue = Math.max(...data.map((item) => item.amount), 1);
  const chart = { left: 72, top: 56, right: width - 24, bottom: height - 56 };
  const rowHeight = (chart.bottom - chart.top) / data.length;

  drawGrid(ctx, chart, maxValue);
  data.forEach((item, index) => {
    const y = chart.top + index * rowHeight + rowHeight * 0.28;
    const fullWidth = chart.right - chart.left;
    const savedWidth = (item.saved / maxValue) * fullWidth;
    const amountWidth = (item.amount / maxValue) * fullWidth;

    ctx.fillStyle = "#eef8f0";
    ctx.fillRect(chart.left, y, amountWidth, Math.max(16, rowHeight * 0.34));
    ctx.fillStyle = "#15803d";
    ctx.fillRect(chart.left, y, savedWidth, Math.max(16, rowHeight * 0.34));

    ctx.fillStyle = "#31523d";
    ctx.font = "12px Arial";
    ctx.textAlign = "right";
    ctx.fillText(truncate(item.label, 12), chart.left - 10, y + 13);
    ctx.textAlign = "left";
    ctx.fillText(`${formatMoney.format(item.saved)} / ${formatMoney.format(item.amount)}`, chart.left + amountWidth + 8, y + 13);
  });
}

function wrapLabel(ctx, text, x, y, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y);
    return;
  }
  const parts = text.split(" ");
  ctx.fillText(parts[0], x, y - 7);
  ctx.fillText(parts.slice(1).join(" "), x, y + 7);
}

function getMonthSummary(month) {
  const transactions = getTransactionsForMonth(month);
  const income = sum(transactions.filter((item) => item.type === "income"));
  const dailyExpenses = sum(transactions.filter((item) => item.type === "expense"));
  const subscriptions = getActiveSubscriptionTotal();
  const totalOutflow = dailyExpenses + subscriptions;
  const balance = Number(state.initialBalance || 0) + income - dailyExpenses;
  const tithe = income * 0.1;
  const target = income * 0.2;
  let rating = "Sem dados";
  let ratingClass = "";
  if (income > 0 && balance >= target) {
    rating = "Bom";
    ratingClass = "good";
  } else if (income > 0 && balance >= 0) {
    rating = "Ruim";
    ratingClass = "bad";
  } else if (income > 0) {
    rating = "Péssimo";
    ratingClass = "awful";
  }
  return { income, dailyExpenses, subscriptions, totalOutflow, balance, tithe, rating, ratingClass };
}

function getExpensePieData(type) {
  if (type === "weekly") return getWeeklyExpensePieData();
  if (type === "biweekly") return getBiweeklyExpensePieData();
  return getMonthlyExpensePieData();
}

function getWeeklyExpensePieData() {
  const [year, monthIndex] = parseMonth(state.month);
  const days = daysInMonth(year, monthIndex);
  const items = [];
  for (let start = 1; start <= days; start += 7) {
    const end = Math.min(start + 6, days);
    const daily = getDailyExpensesForRange(year, monthIndex, start, end);
    const subscriptions = getSubscriptionExpensesForRange(start, end);
    if (daily > 0) items.push({ label: `Semana ${start}-${end} diários`, value: daily, color: pieColor(items.length) });
    if (subscriptions > 0) items.push({ label: `Semana ${start}-${end} assinaturas`, value: subscriptions, color: pieColor(items.length) });
  }
  return items;
}

function getBiweeklyExpensePieData() {
  const [year, monthIndex] = parseMonth(state.month);
  const days = daysInMonth(year, monthIndex);
  const ranges = [
    { label: "1a quinzena", start: 1, end: 15 },
    { label: "2a quinzena", start: 16, end: days },
  ];
  const items = [];
  ranges.forEach((range) => {
    const daily = getDailyExpensesForRange(year, monthIndex, range.start, range.end);
    const subscriptions = getSubscriptionExpensesForRange(range.start, range.end);
    if (daily > 0) items.push({ label: `${range.label} diários`, value: daily, color: pieColor(items.length) });
    if (subscriptions > 0) items.push({ label: `${range.label} assinaturas`, value: subscriptions, color: pieColor(items.length) });
  });
  return items;
}

function getMonthlyExpensePieData() {
  const transactions = getTransactionsForMonth(state.month).filter((item) => item.type === "expense");
  const byCategory = transactions.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + Number(item.amount || 0);
    return acc;
  }, {});
  const items = Object.entries(byCategory)
    .filter((entry) => entry[1] > 0)
    .map(([label, value], index) => ({ label, value, color: pieColor(index) }));
  const subscriptions = getActiveSubscriptionTotal();
  if (subscriptions > 0) {
    items.push({ label: "Assinaturas", value: subscriptions, color: pieColor(items.length) });
  }
  return items;
}

function getDailyExpensesForRange(year, monthIndex, startDay, endDay) {
  const month = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  return getTransactionsForMonth(month)
    .filter((item) => {
      const day = Number(item.date.slice(8, 10));
      return item.type === "expense" && day >= startDay && day <= endDay;
    })
    .reduce((total, item) => total + Number(item.amount || 0), 0);
}

function getSubscriptionExpensesForRange(startDay, endDay) {
  return state.subscriptions
    .filter((item) => item.active && item.dueDay >= startDay && item.dueDay <= endDay)
    .reduce((total, item) => total + Number(item.amount || 0), 0);
}

function pieColor(index) {
  const colors = ["#15803d", "#86efac", "#14532d", "#bbf7d0", "#0f7a45", "#4ade80", "#3f6f52", "#dcfce7"];
  return colors[index % colors.length];
}

function getChartData(type) {
  if (type === "weekly") return getWeeklyData();
  if (type === "biweekly") return getBiweeklyData();
  return getMonthlyData();
}

function getWeeklyData() {
  const [year, monthIndex] = parseMonth(state.month);
  const days = daysInMonth(year, monthIndex);
  const ranges = [];
  for (let start = 1; start <= days; start += 7) {
    ranges.push({ label: `${start}-${Math.min(start + 6, days)}`, start, end: Math.min(start + 6, days) });
  }
  return ranges.map((range) => summarizeRange(year, monthIndex, range.start, range.end, `Semana ${range.label}`));
}

function getBiweeklyData() {
  const [year, monthIndex] = parseMonth(state.month);
  const days = daysInMonth(year, monthIndex);
  return [
    summarizeRange(year, monthIndex, 1, 15, "1a quinzena"),
    summarizeRange(year, monthIndex, 16, days, "2a quinzena"),
  ];
}

function getMonthlyData() {
  const [year] = parseMonth(state.month);
  return Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    const summary = getMonthSummary(month);
    return {
      label: new Date(year, index, 1).toLocaleDateString("pt-BR", { month: "short" }),
      income: summary.income,
      expenses: summary.totalOutflow,
      balance: summary.balance,
    };
  });
}

function summarizeRange(year, monthIndex, startDay, endDay, label) {
  const transactions = getTransactionsForMonth(`${year}-${String(monthIndex + 1).padStart(2, "0")}`).filter((item) => {
    const day = Number(item.date.slice(8, 10));
    return day >= startDay && day <= endDay;
  });
  const income = sum(transactions.filter((item) => item.type === "income"));
  const singleExpenses = sum(transactions.filter((item) => item.type === "expense"));
  const subscriptionExpenses = state.subscriptions
    .filter((item) => item.active && item.dueDay >= startDay && item.dueDay <= endDay)
    .reduce((total, item) => total + Number(item.amount || 0), 0);
  const expenses = singleExpenses + subscriptionExpenses;
  return { label, income, expenses, balance: income - expenses };
}

function getTransactionsForMonth(month) {
  return state.transactions.filter((item) => item.date && item.date.startsWith(month));
}

function getActiveSubscriptionTotal() {
  return state.subscriptions
    .filter((item) => item.active)
    .reduce((total, item) => total + Number(item.amount || 0), 0);
}

function sum(items) {
  return items.reduce((total, item) => total + Number(item.amount || 0), 0);
}

function setDefaultDate() {
  const dateInput = els.transactionForm.elements.date;
  const today = toInputDate(new Date());
  dateInput.value = today.startsWith(state.month) ? today : `${state.month}-01`;
}

function parseMonth(month) {
  const [year, number] = month.split("-").map(Number);
  return [year, number - 1];
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function getChartTitle(type) {
  if (type === "weekly") return "Resumo semanal do mês";
  if (type === "biweekly") return "Resumo quinzenal do mês";
  return "Resumo mensal do ano";
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function loadState() {
  const fallback = { month: getCurrentMonth(), initialBalance: 0, transactions: [], subscriptions: [], goals: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      ...fallback,
      ...saved,
      transactions: saved.transactions || [],
      subscriptions: saved.subscriptions || [],
      goals: saved.goals || [],
    };
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clean(value) {
  return String(value || "").trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function shortMoney(value) {
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1).replace(".", ",")} mil`;
  return formatMoney.format(value);
}

function truncate(value, limit) {
  const text = String(value || "");
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
