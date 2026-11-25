/* STOCKWISE AI – demo logic. Vanilla JavaScript, no build step.
   DEMO DATA: all companies and prices are fictional and illustrative. */
(function () {
  'use strict';

  /* ---------- Helpers ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const fmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
  const money = (v) => fmt.format(v);
  const pct = (v) => (v >= 0 ? '+' : '') + (v * 100).toFixed(2) + '%';
  const dir = (v) => (v >= 0 ? 'up' : 'down');
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const MUTED = '#8b9bb0', GRID = 'rgba(148,163,184,.1)', EM = '#34d399', RED = '#f87171';
  const PALETTE = ['#34d399', '#60a5fa', '#fbbf24'];

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }

  /* ---------- Sample companies (fictional) ---------- */
  const COMPANIES = [
    { sym: 'NVTX', name: 'Novatek Systems', sector: 'Information Technology', base: 1840.5, drift: 0.0014, vol: 0.020, seed: 11, mcap: '₹2,84,000 Cr', pe: 28.4, div: 0.9, desc: 'A fictional software and cloud services company that builds tools for banks and schools.' },
    { sym: 'GRNW', name: 'Greenwave Energy', sector: 'Renewable Energy', base: 612.2, drift: 0.0009, vol: 0.027, seed: 23, mcap: '₹74,500 Cr', pe: 34.9, div: 0.4, desc: 'A fictional company that builds and runs solar and wind power plants.' },
    { sym: 'MDLF', name: 'MediLife Pharma', sector: 'Healthcare', base: 928.75, drift: 0.0004, vol: 0.016, seed: 37, mcap: '₹1,12,300 Cr', pe: 24.1, div: 1.6, desc: 'A fictional maker of generic medicines and diagnostic kits.' },
    { sym: 'BHRT', name: 'BharatBuild Infra', sector: 'Infrastructure', base: 3120.0, drift: 0.0002, vol: 0.018, seed: 41, mcap: '₹1,98,700 Cr', pe: 19.6, div: 2.1, desc: 'A fictional construction firm working on roads, bridges and metro lines.' },
    { sym: 'SKYR', name: 'SkyRoute Airlines', sector: 'Aviation', base: 245.6, drift: -0.0004, vol: 0.030, seed: 53, mcap: '₹31,200 Cr', pe: 41.7, div: 0.0, desc: 'A fictional low-cost airline connecting smaller cities. Fuel costs strongly affect its results.' },
    { sym: 'FINX', name: 'FinEdge Bank', sector: 'Banking', base: 1475.3, drift: 0.0008, vol: 0.014, seed: 67, mcap: '₹3,56,000 Cr', pe: 16.8, div: 1.9, desc: 'A fictional private bank offering savings, loans and digital payments.' },
    { sym: 'AGRO', name: 'AgriNova Foods', sector: 'Consumer Goods', base: 388.4, drift: 0.0005, vol: 0.013, seed: 79, mcap: '₹46,800 Cr', pe: 22.3, div: 1.2, desc: 'A fictional packaged-food company selling grains, snacks and edible oils.' },
    { sym: 'RTLX', name: 'RetailX Mart', sector: 'Retail', base: 2210.8, drift: 0.0011, vol: 0.022, seed: 89, mcap: '₹1,41,500 Cr', pe: 52.0, div: 0.3, desc: 'A fictional supermarket and online grocery chain.' }
  ];
  const BASE_DAYS = 180;
  const RANGES = { '1M': 21, '3M': 63, '6M': 179 };

  function rng(seed) {            // small seeded random generator so sample data is stable
    let a = seed * 9301 + 49297;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeSeries(c, n) {
    const r = rng(c.seed), p = [100];
    for (let i = 1; i < n; i++) {
      const z = (r() + r() + r() - 1.5) * 1.15;
      p.push(p[i - 1] * (1 + c.drift + c.vol * z));
    }
    const k = c.base / p[BASE_DAYS - 1];
    return p.map((v) => +(v * k).toFixed(2));
  }
  function buildSeries() {
    COMPANIES.forEach((c) => { c.s = makeSeries(c, BASE_DAYS + state.extra); });
  }
  const get = (sym) => COMPANIES.find((c) => c.sym === sym);
  const price = (c) => c.s[c.s.length - 1];
  const change = (c, d) => price(c) / c.s[c.s.length - 1 - d] - 1;
  function volatility(c) {        // average daily swing over the last 30 days, in %
    const s = c.s.slice(-31), r = [];
    for (let i = 1; i < s.length; i++) r.push(s[i] / s[i - 1] - 1);
    const m = r.reduce((a, b) => a + b, 0) / r.length;
    return Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / r.length) * 100;
  }
  const sma = (s, n) => { const a = s.slice(-n); return a.reduce((x, y) => x + y, 0) / a.length; };
  const window180 = (c) => c.s.slice(-BASE_DAYS);

  /* ---------- Saved state (LocalStorage) ---------- */
  const KEY = 'stockwiseAi.demo.v1';
  const DEFAULTS = { watchlist: ['NVTX', 'GRNW', 'FINX'], recent: [], cash: 100000, holdings: {}, tx: [], chat: [], extra: 0, cmp: ['NVTX', 'FINX', ''] };
  let state = load();
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      return Object.assign(clone(DEFAULTS), saved && typeof saved === 'object' ? saved : {});
    } catch (e) { return clone(DEFAULTS); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage may be blocked */ } }
  buildSeries();

  let current = state.recent[0] || 'NVTX';
  const rangeSel = { dash: '6M', an: '6M' };

  /* ---------- Charts ---------- */
  const charts = {};
  function drawChart(id, cfg) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    if (typeof Chart === 'undefined') { canvas.parentElement.classList.add('no-chart'); return; }
    canvas.parentElement.classList.remove('no-chart');
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(canvas, cfg);
  }
  function baseOptions(multi, yFmt) {
    return {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: multi, labels: { color: '#a8b5c7', boxWidth: 10, usePointStyle: true } },
        tooltip: { backgroundColor: '#0f1a2d', borderColor: 'rgba(52,211,153,.4)', borderWidth: 1, titleColor: '#e9eef6', bodyColor: '#c4cfde', callbacks: { label: (i) => ' ' + (multi ? i.dataset.label + ': ' : '') + yFmt(i.parsed.y) } }
      },
      scales: {
        x: { ticks: { color: MUTED, maxTicksLimit: 6, maxRotation: 0 }, grid: { display: false } },
        y: { ticks: { color: MUTED, callback: (v) => yFmt(v) }, grid: { color: GRID } }
      }
    };
  }
  function priceChart(id, c, rangeKey) {
    const n = RANGES[rangeKey] + 1, data = c.s.slice(-n), start = c.s.length - data.length;
    const up = data[data.length - 1] >= data[0], col = up ? EM : RED;
    drawChart(id, {
      type: 'line',
      data: {
        labels: data.map((_, i) => 'Demo day ' + (start + i + 1)),
        datasets: [{ label: c.name, data, borderColor: col, backgroundColor: up ? 'rgba(52,211,153,.12)' : 'rgba(248,113,113,.12)', fill: true, tension: .25, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2 }]
      },
      options: baseOptions(false, (v) => '₹' + Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 }))
    });
  }

  /* ---------- Navigation ---------- */
  const VIEWS = ['dashboard', 'analysis', 'assistant', 'compare', 'trade'];
  const renderers = { dashboard: renderDashboard, analysis: renderAnalysis, assistant: renderChat, compare: renderCompare, trade: renderTrade };
  let view = 'dashboard';
  function route() {
    const h = location.hash.replace('#', '');
    view = VIEWS.indexOf(h) >= 0 ? h : 'dashboard';
    VIEWS.forEach((v) => $('#view-' + v).classList.toggle('active', v === view));
    $$('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.view === view));
    renderers[view]();
    window.scrollTo(0, 0);
  }
  function go(v) { if (location.hash === '#' + v) route(); else location.hash = v; }
  function openCompany(sym, target) {
    current = sym;
    state.recent = [sym].concat(state.recent.filter((x) => x !== sym)).slice(0, 6);
    save();
    go(target || 'analysis');
  }

  /* ---------- Search ---------- */
  function initSearch(inputId, resultsId) {
    const input = $('#' + inputId), box = $('#' + resultsId);
    function show() {
      const q = input.value.trim().toLowerCase();
      const hits = COMPANIES.filter((c) => !q || (c.name + ' ' + c.sym + ' ' + c.sector).toLowerCase().indexOf(q) >= 0).slice(0, 6);
      box.innerHTML = '';
      if (!hits.length) box.appendChild(el('div', 'none', 'No sample company matches “' + input.value.trim() + '”.'));
      hits.forEach((c) => {
        const b = el('button');
        b.type = 'button';
        const left = el('span'); left.append(c.name + ' ', el('small', '', c.sym + ' · ' + c.sector));
        const right = el('span', dir(change(c, 1)), money(price(c)));
        b.append(left, right);
        b.addEventListener('click', () => { box.hidden = true; input.value = ''; openCompany(c.sym); });
        box.appendChild(b);
      });
      box.hidden = false;
    }
    input.addEventListener('input', show);
    input.addEventListener('focus', show);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') box.hidden = true;
      if (e.key === 'Enter') { const f = box.querySelector('button'); if (f) f.click(); }
    });
    document.addEventListener('click', (e) => { if (!box.contains(e.target) && e.target !== input) box.hidden = true; });
  }

  /* ---------- Portfolio maths ---------- */
  function portfolio() {
    let held = 0;
    Object.keys(state.holdings).forEach((s) => { held += state.holdings[s].qty * price(get(s)); });
    const total = state.cash + held;
    return { held: held, total: total, pl: total - 100000 };
  }

  /* ---------- Dashboard ---------- */
  function statCard(label, value, meta, cls) {
    const d = el('article', 'card stat');
    d.append(el('span', 'label', label), el('strong', cls || '', value), el('div', 'meta', meta));
    return d;
  }
  function renderDashboard() {
    const p = portfolio();
    $('#heroPortfolio').textContent = money(p.total);
    const hp = $('#heroPL');
    hp.textContent = (p.pl >= 0 ? '+' : '') + money(p.pl) + ' since start';
    hp.className = 'pill ' + (p.pl === 0 ? '' : dir(p.pl));

    const chips = $('#quickChips'); chips.innerHTML = '';
    COMPANIES.slice(0, 5).forEach((c) => {
      const b = el('button', 'chip', c.sym); b.type = 'button';
      b.addEventListener('click', () => openCompany(c.sym)); chips.appendChild(b);
    });

    // Market overview (computed from the sample companies)
    const idx = (k) => COMPANIES.reduce((a, c) => a + c.s[c.s.length - 1 - k] / c.s[0], 0) / COMPANIES.length * 1000;
    const idxChg = idx(0) / idx(1) - 1;
    const sorted = COMPANIES.slice().sort((a, b) => change(b, 1) - change(a, 1));
    const best = sorted[0], worst = sorted[sorted.length - 1];
    const adv = COMPANIES.filter((c) => change(c, 1) >= 0).length;
    const m = $('#marketCards'); m.innerHTML = '';
    m.appendChild(statCard('StockWise demo index', idx(0).toFixed(2), pct(idxChg) + ' today (sample)', dir(idxChg)));
    m.appendChild(statCard('Top gainer today', best.sym, best.name + ' ' + pct(change(best, 1)), dir(change(best, 1))));
    m.appendChild(statCard('Top decliner today', worst.sym, worst.name + ' ' + pct(change(worst, 1)), dir(change(worst, 1))));
    const br = statCard('Market breadth', adv + ' up · ' + (COMPANIES.length - adv) + ' down', 'Share of sample companies rising', '');
    const bar = el('div', 'breadth'), fill = el('i'); fill.style.width = (adv / COMPANIES.length * 100) + '%';
    bar.appendChild(fill); br.appendChild(bar); m.appendChild(br);

    const c = get(current);
    $('#dashName').textContent = c.name + ' (' + c.sym + ')';
    $('#dashPrice').textContent = money(price(c));
    const dc = $('#dashChange'); dc.textContent = pct(change(c, 1)) + ' today'; dc.className = 'pill ' + dir(change(c, 1));
    setRangeButtons('dash');
    priceChart('dashChart', c, rangeSel.dash);
    renderWatchlist();
    renderRecent();
  }
  function renderWatchlist() {
    const box = $('#watchlist'); box.innerHTML = '';
    $('#wlAdd').textContent = state.watchlist.indexOf(current) >= 0 ? 'Added: ' + current : 'Add ' + current;
    if (!state.watchlist.length) { box.appendChild(el('p', 'empty', 'Your watchlist is empty. Search for a company and press Add.')); return; }
    state.watchlist.forEach((sym) => {
      const c = get(sym), row = el('div', 'row');
      const b = el('button', 'main-btn'); b.type = 'button';
      const l = el('span'); l.append(c.name, el('small', '', c.sym));
      const r = el('span', 'r'); r.append(money(price(c)), el('small', dir(change(c, 1)), pct(change(c, 1))));
      b.append(l, r); b.addEventListener('click', () => openCompany(sym));
      const x = el('button', 'x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Remove ' + c.name + ' from watchlist');
      x.addEventListener('click', () => toggleWatch(sym));
      row.append(b, x); box.appendChild(row);
    });
  }
  function toggleWatch(sym) {
    const i = state.watchlist.indexOf(sym);
    if (i >= 0) { state.watchlist.splice(i, 1); toast(get(sym).name + ' removed from watchlist'); }
    else { state.watchlist.push(sym); toast(get(sym).name + ' added to watchlist'); }
    save(); renderers[view]();
  }
  function renderRecent() {
    const box = $('#recent'); box.innerHTML = '';
    if (!state.recent.length) { box.appendChild(el('p', 'empty', 'Companies you open will appear here.')); return; }
    state.recent.forEach((sym) => {
      const b = el('button', 'chip', get(sym).name); b.type = 'button';
      b.addEventListener('click', () => openCompany(sym)); box.appendChild(b);
    });
  }
  function setRangeButtons(group) {
    $$('[data-range-group="' + group + '"] button').forEach((b) => b.classList.toggle('on', b.dataset.range === rangeSel[group]));
  }

  /* ---------- Stock analysis ---------- */
  function analyse(c) {
    const p = price(c), m20 = sma(c.s, 20), m50 = sma(c.s, 50), mom = change(c, 21), v = volatility(c);
    let trend = 'Mixed', tcls = '';
    if (p > m20 && m20 > m50) { trend = 'Upward'; tcls = 'up'; } else if (p < m20 && m20 < m50) { trend = 'Downward'; tcls = 'down'; }
    const vl = v < 1.2 ? 'low' : v < 2 ? 'moderate' : 'high';
    const lines = [
      'Price vs averages: the sample price (' + money(p) + ') is ' + (p > m20 ? 'above' : 'below') + ' its 20-day average (' + money(m20) + ') and its 20-day average is ' + (m20 > m50 ? 'above' : 'below') + ' the 50-day average (' + money(m50) + '). Learners often read price > short average > long average as an upward trend, and the reverse as a downward trend.',
      'Momentum: over the last month the sample price changed by ' + pct(mom) + '. Momentum shows direction, but it can reverse quickly.',
      'Volatility: daily moves averaged about ' + v.toFixed(2) + '%, which this demo labels ' + vl + '. Higher volatility means larger swings up and down, so more risk.',
      trend === 'Upward' ? 'Learning point: an upward trend does not guarantee future gains. Check the company’s earnings, debt and news before drawing conclusions.'
        : trend === 'Downward' ? 'Learning point: a downward trend can reflect real business problems or a temporary dip. Studying why the price fell matters more than the chart alone.'
          : 'Learning point: a mixed signal means the short and long averages disagree. Analysts often wait for a clearer picture or look at other indicators.'
    ];
    return { trend: trend, tcls: tcls, lines: lines };
  }
  function renderAnalysis() {
    const c = get(current), up = change(c, 1) >= 0;
    $('#anName').textContent = c.name;
    $('#anTicker').textContent = c.sym;
    $('#anSector').textContent = c.sector;
    $('#anDesc').textContent = c.desc + ' (Fictional company for demonstration.)';
    const w = state.watchlist.indexOf(c.sym) >= 0;
    $('#anWatch').textContent = w ? 'Remove from watchlist' : 'Add to watchlist';

    const s = $('#anStats'); s.innerHTML = '';
    s.appendChild(statCard('Sample price', money(price(c)), pct(change(c, 1)) + ' today', up ? 'up' : 'down'));
    [['1 week', 5], ['1 month', 21], ['6 months', 179]].forEach((x) => {
      const ch = change(c, x[1]); s.appendChild(statCard(x[0] + ' change', pct(ch), 'Sample data', dir(ch)));
    });
    setRangeButtons('an');
    priceChart('anChart', c, rangeSel.an);

    const w180 = window180(c), facts = $('#anFacts'); facts.innerHTML = '';
    [['Sector', c.sector], ['Market cap (sample)', c.mcap], ['P/E ratio (sample)', c.pe.toFixed(1)], ['Dividend yield (sample)', c.div.toFixed(1) + '%'],
      ['Period high', money(Math.max.apply(null, w180))], ['Period low', money(Math.min.apply(null, w180))], ['Daily volatility', volatility(c).toFixed(2) + '%']].forEach((f) => {
      const d = el('div'); d.append(el('dt', '', f[0]), el('dd', '', f[1])); facts.appendChild(d);
    });

    const a = analyse(c);
    const t = $('#anTrend'); t.textContent = a.trend + ' trend'; t.className = 'pill ' + a.tcls;
    const box = $('#anAI'); box.innerHTML = '';
    a.lines.forEach((l) => box.appendChild(el('p', '', l)));
    box.appendChild(el('p', 'disc', 'This is a rule-based teaching example built from sample numbers. It is not a prediction, a recommendation or financial advice.'));
  }

  /* ---------- AI learning assistant ---------- */
  const KB = [
    { k: ['hello', 'hey', 'hi there', 'help'], a: 'Hello! I can explain stocks, shares, IPOs, dividends, stock exchanges, indices and common market terms. Try one of the suggestions below.' },
    { k: ['what is a stock', 'what is stock', 'share', 'equity', 'stocks'], a: 'A stock (or share) is a small piece of ownership in a company. If you hold shares, you own part of the business. Share prices move with the company’s results, news and what investors expect from it.' },
    { k: ['ipo', 'initial public offering', 'listing'], a: 'An IPO (Initial Public Offering) is when a private company sells shares to the public for the first time so that it can raise money. After the IPO, its shares are listed and traded on a stock exchange. IPO prices can be volatile, so reading the company’s offer document is important.' },
    { k: ['dividend', 'payout'], a: 'A dividend is a part of a company’s profit that it pays to shareholders, usually per share. Dividend yield = yearly dividend ÷ share price. Not every company pays dividends; some reinvest profits to grow instead.' },
    { k: ['stock exchange', 'exchange', 'nse', 'bse', 'bombay', 'national stock'], a: 'A stock exchange is a regulated marketplace where shares are bought and sold. In India the two main exchanges are the NSE (National Stock Exchange) and the BSE (Bombay Stock Exchange). They match buyers and sellers and publish prices.' },
    { k: ['sensex', 'nifty', 'index', 'indices'], a: 'A stock index tracks a group of companies to show how the market is doing. Sensex tracks 30 large companies on the BSE, and Nifty 50 tracks 50 large companies on the NSE. This demo’s “StockWise demo index” is a made-up example built from the 8 sample companies.' },
    { k: ['sebi', 'regulator', 'regulation'], a: 'SEBI (Securities and Exchange Board of India) is the regulator of India’s securities market. It makes rules to protect investors and keep trading fair and transparent.' },
    { k: ['demat', 'brokerage', 'broker', 'account'], a: 'A demat account holds your shares in electronic form, like a bank account holds money. A broker uses it to place orders for you on the exchange. This demo needs no account because it only uses virtual money.' },
    { k: ['market cap', 'market capitalisation', 'capitalization'], a: 'Market capitalisation = share price × number of shares. It shows the market’s value of the whole company. Large-cap companies are big and usually steadier; small-caps can grow faster but are riskier.' },
    { k: ['p/e', 'pe ratio', 'price to earnings', 'price-to-earnings', 'valuation'], a: 'The P/E ratio = share price ÷ earnings per share. It shows how much investors pay for each rupee of profit. A high P/E can mean high growth expectations; a low P/E can mean a cheaper or slower company. Compare P/E within the same sector.' },
    { k: ['eps', 'earnings per share', 'profit'], a: 'EPS (Earnings Per Share) = company profit ÷ number of shares. It tells you how much profit each share earned.' },
    { k: ['bull', 'bear', 'rally', 'crash'], a: 'A bull market is a long period of rising prices and optimism. A bear market is a long period of falling prices (often 20% or more from a peak) and pessimism.' },
    { k: ['volatil', 'risk', 'risky'], a: 'Volatility is how much and how fast a price moves. High volatility means bigger swings and more risk. Investors manage risk by spreading money across companies and by investing only what they can afford to keep invested.' },
    { k: ['diversif', 'portfolio', 'eggs'], a: 'Diversification means spreading money across different companies, sectors or asset types so that one bad result hurts less. A portfolio is the collection of everything you hold.' },
    { k: ['market order', 'limit order', 'order type', 'order'], a: 'A market order buys or sells right away at the best available price. A limit order sets the price you are willing to accept, and runs only if the market reaches it. This demo uses simple market-style orders at the sample price.' },
    { k: ['mutual fund', 'sip', 'etf'], a: 'A mutual fund pools money from many people and invests it in a basket of securities run by a fund manager. A SIP (Systematic Investment Plan) invests a fixed amount regularly, such as monthly. An ETF is a basket that trades on the exchange like a share.' },
    { k: ['blue chip', 'large cap', 'small cap', 'mid cap'], a: 'Blue-chip companies are large, well-established firms with a long record. Companies are often grouped as large-cap, mid-cap or small-cap by their market capitalisation.' },
    { k: ['split', 'bonus', 'face value'], a: 'A stock split divides each share into more shares (for example 1 into 2) so the price per share falls but your total value stays the same. A bonus issue gives existing holders extra free shares. Face value is the nominal value printed on a share and is different from its market price.' },
    { k: ['52 week', 'high', 'low'], a: 'The 52-week high and low are the highest and lowest prices a share traded at in the past year. They give a quick sense of the price range. In this demo the period high and low come from the sample data.' },
    { k: ['trading', 'investing', 'long term', 'short term'], a: 'Trading means buying and selling over short periods to profit from price moves. Investing means holding for years based on a company’s long-term value. Trading usually carries higher risk and costs.' },
    { k: ['simulator', 'virtual', 'demo', 'fake', 'real money'], a: 'The simulator gives you ₹1,00,000 of fictional money. You can buy and sell sample companies at sample prices, and watch your portfolio. No real money is used and all data is illustrative.' },
    { k: ['trend', 'analysis', 'average', 'moving'], a: 'The trend analysis compares the sample price with its 20-day and 50-day averages, looks at one-month momentum and measures daily swings. It is a simple teaching tool and does not predict the future.' },
    { k: ['should i buy', 'best stock', 'which stock', 'will it go up', 'predict', 'invest in'], a: 'I can’t tell you what to buy or predict prices, and nothing here is financial advice. What I can do is explain terms and show how to compare companies by growth, valuation, dividends and risk. Real investors should research carefully or speak to a SEBI-registered adviser.' }
  ];
  const SUGGEST = ['What is a stock?', 'What is an IPO?', 'Explain dividends', 'What is NSE and BSE?', 'What is a P/E ratio?', 'What is diversification?'];
  const GREETING = 'Hi! I’m the StockWise learning assistant. Ask me about stocks, IPOs, dividends, exchanges or market terms. My answers are pre-written for this demo.';

  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function answer(q) {
    const t = ' ' + q.toLowerCase() + ' ';
    let best = null, score = 0;
    KB.forEach((e) => {
      const n = e.k.filter((k) => new RegExp('\\b' + esc(k.trim())).test(t)).length;
      if (n > score) { score = n; best = e; }
    });
    if (best) return best.a;
    const co = COMPANIES.find((c) => t.indexOf(c.sym.toLowerCase()) >= 0 || t.indexOf(c.name.toLowerCase().split(' ')[0]) >= 0);
    if (co) return co.name + ' (' + co.sym + ') is a fictional ' + co.sector.toLowerCase() + ' company. Sample price ' + money(price(co)) + ', P/E ' + co.pe.toFixed(1) + ', dividend yield ' + co.div.toFixed(1) + '%. Open the Analysis page for charts and a trend explanation. All values are demo data.';
    return 'I don’t have a pre-written answer for that yet. I can explain stocks, shares, IPOs, dividends, stock exchanges, indices, P/E ratio, market cap, risk and diversification. Try rephrasing or pick a suggestion below.';
  }
  function addMsg(role, text, store) {
    const log = $('#chatLog');
    log.appendChild(el('div', 'msg ' + role, text));
    log.scrollTop = log.scrollHeight;
    if (store) { state.chat.push({ r: role, t: text }); state.chat = state.chat.slice(-40); save(); }
  }
  function renderChat() {
    $('#chatLog').innerHTML = '';
    addMsg('bot', GREETING, false);
    state.chat.forEach((m) => addMsg(m.r, m.t, false));
    const chips = $('#chatChips'); chips.innerHTML = '';
    SUGGEST.forEach((s) => {
      const b = el('button', 'chip', s); b.type = 'button';
      b.addEventListener('click', () => ask(s)); chips.appendChild(b);
    });
  }
  function ask(q) {
    q = q.trim(); if (!q) return;
    addMsg('user', q, true);
    const typing = el('div', 'msg bot typing', '...');
    $('#chatLog').appendChild(typing); $('#chatLog').scrollTop = 99999;
    setTimeout(() => { typing.remove(); addMsg('bot', answer(q), true); }, 450);
  }

  /* ---------- Company comparison ---------- */
  function fillSelect(sel, withNone) {
    sel.innerHTML = '';
    if (withNone) { const o = el('option', '', 'None'); o.value = ''; sel.appendChild(o); }
    COMPANIES.forEach((c) => { const o = el('option', '', c.name + ' (' + c.sym + ')'); o.value = c.sym; sel.appendChild(o); });
  }
  function renderCompare() {
    const ids = ['cmpA', 'cmpB', 'cmpC'];
    ids.forEach((id, i) => { const s = $('#' + id); if (!s.options.length) fillSelect(s, i === 2); s.value = state.cmp[i]; });
    const picked = [];
    state.cmp.forEach((s) => { if (s && picked.indexOf(s) < 0) picked.push(s); });
    const warn = $('#cmpWarn');
    warn.hidden = picked.length >= 2;
    warn.textContent = 'Please choose at least two different companies.';
    if (picked.length < 2) return;
    const cs = picked.map(get);

    drawChart('cmpLine', {
      type: 'line',
      data: {
        labels: window180(cs[0]).map((_, i) => 'Sample day ' + (i + 1)),
        datasets: cs.map((c, i) => { const w = window180(c); return { label: c.sym, data: w.map((v) => +(v / w[0] * 100).toFixed(2)), borderColor: PALETTE[i], backgroundColor: PALETTE[i], tension: .25, pointRadius: 0, borderWidth: 2 }; })
      },
      options: baseOptions(true, (v) => Number(v).toFixed(1))
    });
    const periods = [['1 week', 5], ['1 month', 21], ['3 months', 63], ['6 months', 179]];
    const bo = baseOptions(true, (v) => Number(v).toFixed(2) + '%');
    bo.interaction = { mode: 'index', intersect: false };
    drawChart('cmpBar', {
      type: 'bar',
      data: { labels: periods.map((p) => p[0]), datasets: cs.map((c, i) => ({ label: c.sym, data: periods.map((p) => +(change(c, p[1]) * 100).toFixed(2)), backgroundColor: PALETTE[i], borderRadius: 4 })) },
      options: bo
    });

    const rows = [
      ['Sample price', (c) => price(c), (v) => money(v), null],
      ['Change today', (c) => change(c, 1), pct, 'max'],
      ['Change 1 month', (c) => change(c, 21), pct, 'max'],
      ['Change 6 months', (c) => change(c, 179), pct, 'max'],
      ['Market cap (sample)', (c) => c.mcap, (v) => v, null],
      ['P/E ratio (sample)', (c) => c.pe, (v) => v.toFixed(1), null],
      ['Dividend yield', (c) => c.div, (v) => v.toFixed(1) + '%', 'max'],
      ['Period high', (c) => Math.max.apply(null, window180(c)), money, null],
      ['Period low', (c) => Math.min.apply(null, window180(c)), money, null],
      ['Daily volatility', (c) => volatility(c), (v) => v.toFixed(2) + '%', 'min'],
      ['Trend signal', (c) => analyse(c).trend, (v) => v, null]
    ];
    const t = $('#cmpTable'); t.innerHTML = '';
    const head = el('tr'); head.appendChild(el('th', '', 'Metric'));
    cs.forEach((c) => head.appendChild(el('th', '', c.sym)));
    t.appendChild(head);
    rows.forEach((r) => {
      const vals = cs.map(r[1]), tr = el('tr'); tr.appendChild(el('td', '', r[0]));
      const target = r[3] === 'max' ? Math.max.apply(null, vals) : r[3] === 'min' ? Math.min.apply(null, vals) : null;
      vals.forEach((v) => tr.appendChild(el('td', target !== null && v === target ? 'best' : '', r[2](v))));
      t.appendChild(tr);
    });
  }

  /* ---------- Virtual trading simulator ---------- */
  function renderTrade() {
    const p = portfolio();
    const s = $('#tradeStats'); s.innerHTML = '';
    s.appendChild(statCard('Virtual cash', money(state.cash), 'Available to spend'));
    s.appendChild(statCard('Holdings value', money(p.held), Object.keys(state.holdings).length + ' companies'));
    s.appendChild(statCard('Portfolio value', money(p.total), 'Started with ₹1,00,000'));
    s.appendChild(statCard('Profit / loss', (p.pl >= 0 ? '+' : '') + money(p.pl), pct(p.pl / 100000) + ' overall', p.pl === 0 ? '' : dir(p.pl)));

    const sel = $('#orderSym');
    if (!sel.options.length) fillSelect(sel, false);
    if (!sel.dataset.set) { sel.value = current; sel.dataset.set = '1'; }
    updatePreview();

    const h = $('#holdTable'); h.innerHTML = '';
    const syms = Object.keys(state.holdings);
    if (!syms.length) { h.innerHTML = '<tr><td class="muted">No holdings yet. Place a virtual buy order to begin.</td></tr>'; }
    else {
      h.appendChild(headerRow(['Company', 'Qty', 'Avg cost', 'Price', 'Value', 'P/L']));
      syms.forEach((sym) => {
        const hd = state.holdings[sym], c = get(sym), val = hd.qty * price(c), pl = val - hd.qty * hd.avg;
        const tr = el('tr');
        const first = el('td'); const b = el('button', 'chip', sym); b.type = 'button';
        b.addEventListener('click', () => { sel.value = sym; updatePreview(); toast(sym + ' selected for a sell order'); });
        first.appendChild(b); tr.appendChild(first);
        [hd.qty, money(hd.avg), money(price(c)), money(val)].forEach((v) => tr.appendChild(el('td', '', String(v))));
        tr.appendChild(el('td', dir(pl), (pl >= 0 ? '+' : '') + money(pl)));
        h.appendChild(tr);
      });
    }

    const t = $('#txTable'); t.innerHTML = '';
    if (!state.tx.length) { t.innerHTML = '<tr><td class="muted">No transactions yet.</td></tr>'; return; }
    t.appendChild(headerRow(['Time', 'Type', 'Company', 'Qty', 'Price', 'Total']));
    state.tx.slice().reverse().slice(0, 30).forEach((x) => {
      const tr = el('tr');
      tr.appendChild(el('td', '', x.time));
      tr.appendChild(el('td', x.type === 'BUY' ? 'up' : 'down', x.type));
      [x.sym, x.qty, money(x.price), money(x.total)].forEach((v) => tr.appendChild(el('td', '', String(v))));
      t.appendChild(tr);
    });
  }
  function headerRow(cols) { const tr = el('tr'); cols.forEach((c) => tr.appendChild(el('th', '', c))); return tr; }
  function qty() { const q = Number($('#orderQty').value); return Number.isInteger(q) && q > 0 ? q : 0; }
  function updatePreview() {
    const c = get($('#orderSym').value), q = qty(), held = state.holdings[c.sym] ? state.holdings[c.sym].qty : 0;
    $('#orderPreview').textContent = q ? 'Price ' + money(price(c)) + ' × ' + q + ' = ' + money(price(c) * q) + '  ·  You hold ' + held : 'Enter a whole number of shares (1 or more).';
    $('#orderMsg').hidden = true;
  }
  function msg(text) { const m = $('#orderMsg'); m.textContent = text; m.hidden = false; }
  function trade(type) {
    const c = get($('#orderSym').value), q = qty();
    if (!q) { msg('Enter a whole number of shares (1 or more).'); return; }
    const total = +(price(c) * q).toFixed(2), hd = state.holdings[c.sym];
    if (type === 'BUY') {
      if (total > state.cash) { msg('Not enough virtual cash. This order costs ' + money(total) + ' but you have ' + money(state.cash) + '.'); return; }
      state.cash = +(state.cash - total).toFixed(2);
      if (hd) { hd.avg = (hd.avg * hd.qty + total) / (hd.qty + q); hd.qty += q; } else state.holdings[c.sym] = { qty: q, avg: price(c) };
    } else {
      if (!hd || hd.qty < q) { msg('You only hold ' + (hd ? hd.qty : 0) + ' shares of ' + c.sym + '.'); return; }
      state.cash = +(state.cash + total).toFixed(2);
      hd.qty -= q; if (hd.qty === 0) delete state.holdings[c.sym];
    }
    state.tx.push({ time: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }), type: type, sym: c.sym, qty: q, price: price(c), total: total });
    save(); toast((type === 'BUY' ? 'Bought ' : 'Sold ') + q + ' × ' + c.sym + ' (virtual)'); renderTrade();
  }

  /* ---------- Events ---------- */
  function bind() {
    window.addEventListener('hashchange', route);
    initSearch('topSearch', 'topResults');
    initSearch('heroSearch', 'heroResults');

    $$('[data-range-group]').forEach((g) => g.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      rangeSel[g.dataset.rangeGroup] = b.dataset.range; renderers[view]();
    }));
    $('#dashAnalyse').addEventListener('click', () => openCompany(current));
    $('#wlAdd').addEventListener('click', () => { if (state.watchlist.indexOf(current) >= 0) toast(current + ' is already in your watchlist'); else toggleWatch(current); });
    $('#clearRecent').addEventListener('click', () => { state.recent = []; save(); renderRecent(); });

    $('#anWatch').addEventListener('click', () => toggleWatch(current));
    $('#anTrade').addEventListener('click', () => { $('#orderSym').dataset.set = ''; go('trade'); });
    $('#anCompare').addEventListener('click', () => {
      if (state.cmp.indexOf(current) < 0) state.cmp[1] = current;
      if (state.cmp[0] === state.cmp[1]) state.cmp[0] = COMPANIES.find((c) => c.sym !== current).sym;
      save(); go('compare');
    });

    $('#chatForm').addEventListener('submit', (e) => { e.preventDefault(); const i = $('#chatInput'); ask(i.value); i.value = ''; });
    $('#chatClear').addEventListener('click', () => { state.chat = []; save(); renderChat(); toast('Chat cleared'); });

    ['cmpA', 'cmpB', 'cmpC'].forEach((id, i) => $('#' + id).addEventListener('change', (e) => { state.cmp[i] = e.target.value; save(); renderCompare(); }));

    $('#orderSym').addEventListener('change', updatePreview);
    $('#orderQty').addEventListener('input', updatePreview);
    $('#buyBtn').addEventListener('click', () => trade('BUY'));
    $('#sellBtn').addEventListener('click', () => trade('SELL'));
    $('#simDay').addEventListener('click', () => { state.extra += 1; buildSeries(); save(); toast('Simulated one more demo day. Sample prices have changed.'); renderTrade(); });
    $('#resetDemo').addEventListener('click', () => {
      if (!confirm('Reset all demo data (balance, holdings, history, watchlist)?')) return;
      state = clone(DEFAULTS); buildSeries(); current = 'NVTX'; save(); toast('Demo reset to ₹1,00,000'); route();
    });
  }

  bind();
  route();
})();
