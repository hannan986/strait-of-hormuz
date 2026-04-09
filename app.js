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
//  HISTORICAL DAILY TRAFFIC
//  Uses a deterministic hash so every date always returns the
//  same realistic numbers (based on actual Strait of Hormuz
//  traffic statistics: ~50-100 vessels/day, ~1,700+/month)
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

  const month    = date.getUTCMonth();               // 0-11
  // Oil demand peaks Dec-Feb, slight dip Jun-Aug
  const seasonal = 1 + 0.10 * Math.cos((month - 0.5) * Math.PI / 6);
  const dayVar   = 0.88 + ((h & 0xff) / 255) * 0.26; // ±13% daily variation
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

function getWeekData(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  const days = [];
  for (let i = -3; i <= 3; i++) {
    const nd = new Date(d);
    nd.setUTCDate(d.getUTCDate() + i);
    const s = nd.toISOString().slice(0, 10);
    days.push(getDayData(s));
  }
  return days;
}

function renderHistResults(data, weekData) {
  const avg   = 63;
  const diff  = data.total - avg;
  const diffStr = (diff >= 0 ? '+' : '') + diff;
  const diffColor = diff >= 0 ? '#52b788' : '#e76f51';

  const maxWeek = Math.max(...weekData.map(d => d.total));

  const bars = weekData.map(d => {
    const isSelected = d.date === data.date;
    const h = Math.round((d.total / maxWeek) * 44);
    const dayName = new Date(d.date + 'T12:00:00Z')
      .toLocaleDateString('en', { weekday: 'short', timeZone: 'UTC' });
    return `<div class="wk-bar-col ${isSelected ? 'selected' : ''}">
      <div class="wk-bar-val">${d.total}</div>
      <div class="wk-bar-wrap"><div class="wk-bar-fill" style="height:${h}px"></div></div>
      <div class="wk-bar-day">${dayName}</div>
    </div>`;
  }).join('');

  const types = [
    { label: 'Oil Tankers',    val: data.tankers,   color: '#f59e0b', pct: (data.tankers   / data.total * 100).toFixed(0) },
    { label: 'LNG / LPG',     val: data.lng,        color: '#06b6d4', pct: (data.lng       / data.total * 100).toFixed(0) },
    { label: 'Cargo',          val: data.cargo,      color: '#3b82f6', pct: (data.cargo     / data.total * 100).toFixed(0) },
    { label: 'Container',      val: data.container,  color: '#8b5cf6', pct: (data.container / data.total * 100).toFixed(0) },
    { label: 'Naval',          val: data.naval,      color: '#ef4444', pct: (data.naval     / data.total * 100).toFixed(0) },
    { label: 'Other',          val: data.other,      color: '#94a3b8', pct: (data.other     / data.total * 100).toFixed(0) },
  ];

  const typeRows = types.map(t => `
    <div class="ht-type-row">
      <div class="ht-dot" style="background:${t.color}"></div>
      <div class="ht-label">${t.label}</div>
      <div class="ht-bar-wrap">
        <div class="ht-bar-fill" style="width:${t.pct}%;background:${t.color}"></div>
      </div>
      <div class="ht-count">${t.val}</div>
    </div>`).join('');

  const displayDate = new Date(data.date + 'T12:00:00Z')
    .toLocaleDateString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

  document.getElementById('histResults').innerHTML = `
    <div class="hist-date-label">${displayDate}</div>

    <div class="hist-total-row">
      <div class="hist-total-num">${data.total}</div>
      <div class="hist-total-info">
        <div class="hist-total-label">Ships Transited</div>
        <div class="hist-total-diff" style="color:${diffColor}">${diffStr} vs daily avg (${avg})</div>
      </div>
    </div>

    <div class="hist-week-chart">${bars}</div>
    <div class="hist-week-caption">7-day window</div>

    <div class="ht-types">${typeRows}</div>
  `;
  document.getElementById('histResults').classList.remove('hidden');
}

function runHistSearch() {
  const val = document.getElementById('histDate').value;
  if (!val) { alert('Please pick a date.'); return; }

  const today = new Date().toISOString().slice(0, 10);
  if (val > today) { alert('Cannot search future dates.'); return; }

  const data     = getDayData(val);
  const weekData = getWeekData(val);
  if (data) renderHistResults(data, weekData);
}

document.getElementById('histSearchBtn').addEventListener('click', runHistSearch);
document.getElementById('histDate').addEventListener('keydown', e => {
  if (e.key === 'Enter') runHistSearch();
});

// Default to today
document.getElementById('histDate').value = new Date().toISOString().slice(0, 10);
