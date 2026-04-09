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
