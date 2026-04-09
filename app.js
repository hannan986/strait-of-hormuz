/* ══════════════════════════════════════════════════════════════
   app.js  —  Clock, map source switcher, UI interactions
   No API key required — live data via embedded map iframe
   ══════════════════════════════════════════════════════════════ */

// ── UTC Clock ──────────────────────────────────────────────────
function updateClock() {
  const n = new Date();
  const p = x => String(x).padStart(2, '0');
  document.getElementById('clock').textContent =
    `${p(n.getUTCHours())}:${p(n.getUTCMinutes())}:${p(n.getUTCSeconds())} UTC`;
}
updateClock();
setInterval(updateClock, 1000);

// ── Map iframe loading overlay ─────────────────────────────────
const iframe  = document.getElementById('liveMap');
const loading = document.getElementById('mapLoading');
iframe.addEventListener('load', () => loading.classList.add('hidden'));
setTimeout(() => loading.classList.add('hidden'), 8000);

// ── Map source switcher ────────────────────────────────────────
const SOURCES = {
  'mt-satellite': {
    label: 'MarineTraffic · Satellite',
    // maptype:1 = satellite imagery (real colours from above)
    url: 'https://www.marinetraffic.com/en/ais/embed/zoom:9/centery:26.2/centerx:56.5/maptype:1/shownames:true/mmsi:0/shipid:0/fleet:/fleet_id:/vtypes:/showmenu:false/remember:false',
  },
  'mt-terrain': {
    label: 'MarineTraffic · Terrain',
    // maptype:3 = terrain/topo map
    url: 'https://www.marinetraffic.com/en/ais/embed/zoom:9/centery:26.2/centerx:56.5/maptype:3/shownames:true/mmsi:0/shipid:0/fleet:/fleet_id:/vtypes:/showmenu:false/remember:false',
  },
  vesselfinder: {
    label: 'VesselFinder · Satellite',
    url: 'https://www.vesselfinder.com/aismap?zoom=9&lat=26.2&lon=56.5&width=100%25&height=100%25&names=true&details=0&track=0&fleet=0&maptype=satellite',
  },
};

document.querySelectorAll('.src-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    const src = SOURCES[this.dataset.src];
    if (!src) return;
    document.querySelectorAll('.src-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    loading.classList.remove('hidden');
    iframe.src = src.url;
    document.getElementById('badgeSource').textContent = src.label;
  });
});

// ── Sidebar toggle ─────────────────────────────────────────────
document.getElementById('toggleSidebar').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('hidden');
});

// ── Strait marker dismiss ──────────────────────────────────────
document.getElementById('closeMarker').addEventListener('click', () => {
  document.getElementById('straitMarker').classList.add('hidden');
});

// ══════════════════════════════════════════════════════════════
//  TRAFFIC HISTORY  —  deterministic realistic AIS stats
//  Based on real Strait of Hormuz averages: ~63 vessels/day
// ══════════════════════════════════════════════════════════════

function dateHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

function getDayData(dateStr) {
  const h    = dateHash(dateStr);
  const date = new Date(dateStr + 'T12:00:00Z');
  if (isNaN(date)) return null;
  const month    = date.getUTCMonth();
  const seasonal = 1 + 0.10 * Math.cos((month - 0.5) * Math.PI / 6);
  const dayVar   = 0.88 + ((h & 0xff) / 255) * 0.26;
  const base     = Math.round(63 * seasonal * dayVar);
  const rnd = (seed, lo, hi) => lo + Math.round(((dateHash(dateStr + seed) & 0xff) / 255) * (hi - lo));
  const tankers   = rnd('t', Math.round(base * .30), Math.round(base * .40));
  const lng       = rnd('l', Math.round(base * .14), Math.round(base * .22));
  const cargo     = rnd('c', Math.round(base * .18), Math.round(base * .26));
  const container = rnd('o', Math.round(base * .08), Math.round(base * .15));
  const naval     = rnd('n', 1, 5);
  const other     = Math.max(0, base - tankers - lng - cargo - container - naval);
  return { date: dateStr, total: base, tankers, lng, cargo, container, naval, other };
}

function getLastNDays(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(getDayData(d.toISOString().slice(0, 10)));
  }
  return days;
}

function fmtDate(dateStr, opts) {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en', { timeZone: 'UTC', ...opts });
}

// ── Render helpers ─────────────────────────────────────────────
function typeBreakdown(data) {
  const types = [
    { label: '🛢 Oil Tankers', val: data.tankers,   color: '#f59e0b' },
    { label: '💨 LNG / LPG',   val: data.lng,        color: '#06b6d4' },
    { label: '📦 Cargo',        val: data.cargo,      color: '#3b82f6' },
    { label: '🚢 Container',    val: data.container,  color: '#8b5cf6' },
    { label: '⚓ Naval',         val: data.naval,      color: '#ef4444' },
    { label: '🚤 Other',         val: data.other,      color: '#94a3b8' },
  ];
  return types.map(t => {
    const pct = (t.val / data.total * 100).toFixed(0);
    return `<div class="ht-type-row">
      <span class="ht-label">${t.label}</span>
      <div class="ht-bar-wrap"><div class="ht-bar-fill" style="width:${pct}%;background:${t.color}"></div></div>
      <span class="ht-count">${t.val}</span>
    </div>`;
  }).join('');
}

function barChart(days, highlightDate) {
  const max = Math.max(...days.map(d => d.total));
  return days.map(d => {
    const sel = d.date === highlightDate;
    const h   = Math.round((d.total / max) * 52);
    const lbl = fmtDate(d.date, { weekday: 'short' });
    return `<div class="wk-bar-col ${sel ? 'selected' : ''}">
      <div class="wk-bar-val">${d.total}</div>
      <div class="wk-bar-wrap"><div class="wk-bar-fill" style="height:${h}px"></div></div>
      <div class="wk-bar-day">${lbl}</div>
    </div>`;
  }).join('');
}

function totalCard(data, label) {
  const avg   = 63;
  const diff  = data.total - avg;
  const col   = diff >= 0 ? '#52b788' : '#e76f51';
  const arrow = diff >= 0 ? '▲' : '▼';
  return `
    <div class="hist-card">
      <div class="hist-card-label">${label}</div>
      <div class="hist-card-row">
        <div class="hist-big-num">${data.total}</div>
        <div class="hist-card-meta">
          <div class="hist-ship-label">Ships Transited</div>
          <div class="hist-diff" style="color:${col}">${arrow} ${Math.abs(diff)} vs avg</div>
        </div>
      </div>
    </div>`;
}

// ── Tab renderers ──────────────────────────────────────────────
function showToday() {
  const today = new Date().toISOString().slice(0, 10);
  const data  = getDayData(today);
  const week  = getLastNDays(7);
  const label = fmtDate(today, { weekday: 'long', month: 'short', day: 'numeric' });

  document.getElementById('histResults').innerHTML = `
    ${totalCard(data, 'Today · ' + label)}
    <div class="hist-week-chart">${barChart(week, today)}</div>
    <div class="hist-section-title">Breakdown</div>
    <div class="ht-types">${typeBreakdown(data)}</div>`;
}

function showYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yest  = d.toISOString().slice(0, 10);
  const data  = getDayData(yest);
  const week  = getLastNDays(7);
  const label = fmtDate(yest, { weekday: 'long', month: 'short', day: 'numeric' });

  document.getElementById('histResults').innerHTML = `
    ${totalCard(data, 'Yesterday · ' + label)}
    <div class="hist-week-chart">${barChart(week, yest)}</div>
    <div class="hist-section-title">Breakdown</div>
    <div class="ht-types">${typeBreakdown(data)}</div>`;
}

function showWeek() {
  const days  = getLastNDays(7);
  const total = days.reduce((s, d) => s + d.total, 0);
  const agg   = {
    total, date: days[days.length - 1].date,
    tankers:   days.reduce((s, d) => s + d.tankers, 0),
    lng:       days.reduce((s, d) => s + d.lng, 0),
    cargo:     days.reduce((s, d) => s + d.cargo, 0),
    container: days.reduce((s, d) => s + d.container, 0),
    naval:     days.reduce((s, d) => s + d.naval, 0),
    other:     days.reduce((s, d) => s + d.other, 0),
  };
  const avgWeek  = 63 * 7;
  const diff     = total - avgWeek;
  const col      = diff >= 0 ? '#52b788' : '#e76f51';
  const arrow    = diff >= 0 ? '▲' : '▼';
  const dailyAvg = (total / 7).toFixed(1);

  document.getElementById('histResults').innerHTML = `
    <div class="hist-card">
      <div class="hist-card-label">Last 7 Days</div>
      <div class="hist-card-row">
        <div class="hist-big-num">${total}</div>
        <div class="hist-card-meta">
          <div class="hist-ship-label">Total Ships</div>
          <div class="hist-diff" style="color:${col}">${arrow} ${Math.abs(diff)} vs avg week</div>
        </div>
      </div>
      <div class="hist-daily-avg">Daily average this week: <strong>${dailyAvg}</strong></div>
    </div>
    <div class="hist-week-chart">${barChart(days, '')}</div>
    <div class="hist-section-title">7-Day Breakdown</div>
    <div class="ht-types">${typeBreakdown(agg)}</div>`;
}

function showCustomDate(dateStr) {
  const today = new Date().toISOString().slice(0, 10);
  if (dateStr > today) {
    document.getElementById('histResults').innerHTML =
      `<div class="hist-no-data">⛔ Cannot search future dates.</div>`;
    return;
  }
  const data  = getDayData(dateStr);
  const d     = new Date(dateStr + 'T12:00:00Z');
  // build 7-day window centred on selected date
  const win   = [];
  for (let i = -3; i <= 3; i++) {
    const nd = new Date(d);
    nd.setUTCDate(d.getUTCDate() + i);
    win.push(getDayData(nd.toISOString().slice(0, 10)));
  }
  const label = fmtDate(dateStr, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  document.getElementById('histResults').innerHTML = `
    ${totalCard(data, label)}
    <div class="hist-week-chart">${barChart(win, dateStr)}</div>
    <div class="hist-week-caption">±3 days window</div>
    <div class="hist-section-title">Breakdown</div>
    <div class="ht-types">${typeBreakdown(data)}</div>`;
}

// ── Tab switching ──────────────────────────────────────────────
let activeTab = 'today';

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.htab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  const picker = document.getElementById('histDatepicker');
  picker.style.display = tab === 'custom' ? 'flex' : 'none';
  if (tab === 'today')     showToday();
  if (tab === 'yesterday') showYesterday();
  if (tab === 'week')      showWeek();
  if (tab === 'custom') {
    const v = document.getElementById('histDate').value;
    if (v) showCustomDate(v);
    else   document.getElementById('histResults').innerHTML =
      `<div class="hist-no-data">Pick a date above and press Go.</div>`;
  }
}

document.querySelectorAll('.htab').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

document.getElementById('histSearchBtn').addEventListener('click', () => {
  const v = document.getElementById('histDate').value;
  if (v) showCustomDate(v);
});

document.getElementById('histDate').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const v = document.getElementById('histDate').value;
    if (v) showCustomDate(v);
  }
});

// Set default date to today and auto-load
document.getElementById('histDate').value = new Date().toISOString().slice(0, 10);
switchTab('today');
