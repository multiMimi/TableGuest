
// ── GLOBAL STATE ──
const TABLE_COUNT = 18;
let tables = [];

// Table Positions based on the original map layout
const TABLE_POS = [
  // Row 1
  { x: 95, y: 170, r: 23 },  // T1
  { x: 155, y: 170, r: 23 },  // T2
  { x: 215, y: 170, r: 23 },  // T3
  { x: 275, y: 170, r: 23 },  // T4
  // Row 2
  { x: 95, y: 230, r: 23 },  // T5
  { x: 155, y: 230, r: 23 },  // T6
  { x: 215, y: 230, r: 23 },  // T7
  { x: 275, y: 230, r: 23 },  // T8
  // Row 3
  { x: 95, y: 290, r: 23 },  // T9
  { x: 155, y: 290, r: 23 },  // T10
  { x: 215, y: 290, r: 23 },  // T11
  { x: 275, y: 290, r: 23 },  // T12
  // Row 4
  { x: 95, y: 350, r: 23 },  // T13
  { x: 155, y: 350, r: 23 },  // T14
  { x: 215, y: 350, r: 23 },  // T15
  { x: 275, y: 350, r: 23 },  // T16
  // Row 5
  { x: 95, y: 410, r: 23 },  // T17
  { x: 155, y: 410, r: 23 }   // T18
];

let activeTableIdx = null;

// ── INITIALIZATION ──
function initializeTables() {
  tables = [];
  for (let i = 0; i < TABLE_COUNT; i++) {
    // T2 and T3 have capacity of 6, others 8
    const capacity = (i === 1 || i === 2) ? 6 : 8;
    tables.push({ id: i + 1, capacity: capacity, guests: [] });
  }
}

// ── FIREBASE CONFIG ──
const firebaseConfig = {
  apiKey: "AIzaSyB205cNsDOpngF8GKOF4VQD9gdG9MIkwis",
  authDomain: "tablesguest.firebaseapp.com",
  databaseURL: "https://tablesguest-default-rtdb.firebaseio.com",
  projectId: "tablesguest",
  storageBucket: "tablesguest.firebasestorage.app",
  messagingSenderId: "366244761531",
  appId: "1:366244761531:web:a095bcab907363bd1a7e9e",
  measurementId: "G-LG15NT9BDQ"
};

function updateSyncStatus(connected) {
  const statusEl = document.getElementById('syncStatus');
  const dot = statusEl.querySelector('.sync-dot');
  const text = statusEl.querySelector('.sync-text');

  if (connected) {
    statusEl.style.backgroundColor = 'rgba(46, 204, 113, 0.1)';
    statusEl.style.borderColor = 'rgba(46, 204, 113, 0.2)';
    statusEl.style.color = 'var(--accent-green)';
    dot.style.backgroundColor = 'var(--accent-green)';
    dot.style.boxShadow = '0 0 8px var(--accent-green)';
    text.textContent = 'Live Sync';
  } else {
    statusEl.style.backgroundColor = 'rgba(231, 76, 60, 0.1)';
    statusEl.style.borderColor = 'rgba(231, 76, 60, 0.2)';
    statusEl.style.color = 'var(--accent-ruby)';
    dot.style.backgroundColor = 'var(--accent-ruby)';
    dot.style.boxShadow = '0 0 8px var(--accent-ruby)';
    text.textContent = 'Local Mode';
  }
}

function setupFirebase() {
  initializeTables();

  if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    const database = firebase.database();
    const tablesRef = database.ref('tables');

    // Connection status listener
    const connectedRef = database.ref(".info/connected");
    connectedRef.on("value", (snap) => {
      updateSyncStatus(snap.val() === true);
    });

    tablesRef.on('value', (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Ensure guests array exists
        tables = data.map(t => ({ ...t, guests: t.guests || [] }));
      } else {
        tablesRef.set(tables);
      }
      refreshUI();
    }, (error) => {
      console.error("Firebase error:", error);
      updateSyncStatus(false);
      refreshUI();
    });
  } else {
    console.warn("Firebase SDK not loaded, using local data only");
    updateSyncStatus(false);
    refreshUI();
  }
}

function saveTable(tableIdx) {
  if (tableIdx >= 0 && tableIdx < tables.length) {
    if (typeof firebase !== 'undefined' && firebase.database) {
      const database = firebase.database();
      const tablesRef = database.ref('tables');
      tablesRef.child(tableIdx).set(tables[tableIdx]).catch(error => {
        console.error("Error saving table:", error);
      });
    }
  }
  refreshUI();
}

function refreshUI() {
  renderMap();
  renderManage();
  updateStats();
  if (activeTableIdx !== null) {
    renderModalGuests();
  }
}

// ── UI RENDERERS ──

function renderMap() {
  const wrap = document.getElementById('map-tables');
  if (!wrap) return;
  wrap.innerHTML = '';

  tables.forEach((t, i) => {
    const pos = TABLE_POS[i];
    const div = document.createElement('div');

    // Determine status class
    let statusClass = 'table-status-empty';
    if (t.guests.length > 0) {
      statusClass = t.guests.length >= t.capacity ? 'table-status-full' : 'table-status-partial';
    }

    div.className = `round-table ${statusClass}`;
    div.style.cssText = `left:${pos.x - pos.r}px;top:${pos.y - pos.r}px;width:${pos.r * 2}px;height:${pos.r * 2}px;`;

    div.innerHTML = `
      <div class="table-icon">🌺</div>
      <div class="table-id">T${t.id}</div>
      <div class="table-capacity">${t.guests.length}/${t.capacity}</div>
    `;

    div.onclick = () => openModal(i);
    wrap.appendChild(div);
  });
}

function renderManage() {
  const q = (document.getElementById('tableSearch')?.value || '').toLowerCase();
  const el = document.getElementById('manageList');
  if (!el) return;

  el.innerHTML = '';

  tables.forEach((t, idx) => {
    const matchTable = `table ${t.id}`.includes(q);
    const matchGuests = t.guests.some(g => g.toLowerCase().includes(q));

    if (q && !matchTable && !matchGuests) return;

    const pct = (t.guests.length / t.capacity) * 100;
    const isFull = t.guests.length >= t.capacity;

    const card = document.createElement('div');
    card.className = 'table-card';

    // Header
    let html = `
      <div class="table-card-header" onclick="openModal(${idx})">
        <div>
          <div class="table-card-title">🌺 Table ${t.id}</div>
          <div class="capacity-track">
            <div class="capacity-fill" style="width:${pct}%"></div>
          </div>
        </div>
        <div class="table-card-meta">${t.guests.length}/${t.capacity} guests</div>
      </div>
      <div class="guest-list-wrap">
    `;

    // Guests
    if (t.guests.length === 0) {
      html += `<div class="empty-state">No guests assigned yet</div>`;
    } else {
      t.guests.forEach((g, gi) => {
        html += `
          <div class="guest-row">
            <span class="guest-name">${g}</span>
            <button class="btn-remove" onclick="removeGuest(${idx},${gi})" title="Remove guest">✕</button>
          </div>
        `;
      });
    }
    html += `</div>`;

    // Add Area
    html += `
      <div class="quick-add-area">
        <div class="input-wrapper" style="padding: 8px 12px;">
          <input type="text" id="add-${idx}" class="premium-input" placeholder="Add guest name..." onkeydown="if(event.key==='Enter')quickAdd(${idx})">
        </div>
        <button class="btn-primary" onclick="quickAdd(${idx})" ${isFull ? 'disabled' : ''}>+ Add</button>
      </div>
    `;

    card.innerHTML = html;
    el.appendChild(card);
  });
}

function updateStats() {
  const totalGuests = tables.reduce((s, t) => s + t.guests.length, 0);
  const totalCapacity = tables.reduce((s, t) => s + t.capacity, 0);

  const elGuests = document.getElementById('stat-guests');
  const elCapacity = document.getElementById('stat-capacity');
  const elTables = document.getElementById('stat-tables');

  if (elGuests) elGuests.textContent = totalGuests;
  if (elCapacity) elCapacity.textContent = totalCapacity;
  if (elTables) elTables.textContent = tables.length;
}

// ── INTERACTIONS ──

function switchTab(tabId) {
  // Update Buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  // Update Panes
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.remove('active');
  });
  document.getElementById(`tab-${tabId}`).classList.add('active');

  // Re-render specific tab if needed
  if (tabId === 'manage') renderManage();
  if (tabId === 'map') renderMap();
}

function findGuest() {
  const q = document.getElementById('waiterSearch').value.trim().toLowerCase();
  const res = document.getElementById('waiterResult');

  if (!q) {
    res.innerHTML = '';
    return;
  }

  let found = null;
  for (const t of tables) {
    const match = t.guests.find(g => g.toLowerCase().includes(q));
    if (match) {
      found = { table: t, name: match };
      break;
    }
  }

  if (found) {
    res.innerHTML = `
      <div class="result-card">
        <div class="result-label">Guest Location Confirmed</div>
        <div class="result-name">🌺 ${found.name}</div>
        <div class="result-table">Table ${found.table.id}</div>
        <div class="result-sub">
          <strong>${found.table.guests.length} / ${found.table.capacity}</strong> guests currently seated. Please escort them.
        </div>
      </div>
    `;
  } else {
    res.innerHTML = `
      <div class="result-not-found">
        ⚠️ No guest found matching "<strong>${document.getElementById('waiterSearch').value.trim()}</strong>"
      </div>
    `;
  }
}

// ── MODAL LOGIC ──

function openModal(idx) {
  activeTableIdx = idx;
  const t = tables[idx];

  document.getElementById('modal-title').textContent = `Table ${t.id}`;
  renderModalGuests();

  document.getElementById('modal').classList.add('open');
  setTimeout(() => document.getElementById('modal-name-input').focus(), 100);
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  activeTableIdx = null;
  document.getElementById('modal-name-input').value = '';
}

function renderModalGuests() {
  if (activeTableIdx === null) return;

  const t = tables[activeTableIdx];
  const listEl = document.getElementById('modal-guests');
  const metaEl = document.getElementById('modal-meta');
  const addBtn = document.getElementById('btnModalAddGuest');

  metaEl.textContent = `${t.guests.length} / ${t.capacity} guests seated`;

  if (t.guests.length === 0) {
    listEl.innerHTML = '<div class="empty-state">No guests assigned yet</div>';
  } else {
    listEl.innerHTML = t.guests.map((g, gi) => `
      <div class="guest-row">
        <span class="guest-name">${g}</span>
        <button class="btn-remove" onclick="removeGuest(${activeTableIdx},${gi})">✕</button>
      </div>
    `).join('');
  }

  addBtn.disabled = t.guests.length >= t.capacity;
}

function modalAddGuest() {
  const input = document.getElementById('modal-name-input');
  const name = input.value.trim();

  if (!name || activeTableIdx === null) return;

  const t = tables[activeTableIdx];
  if (t.guests.length >= t.capacity) return;

  t.guests.push(name);
  saveTable(activeTableIdx);

  input.value = '';
  // UI updates via refreshUI() in saveTable
}

function removeGuest(tableIdx, guestIdx) {
  tables[tableIdx].guests.splice(guestIdx, 1);
  saveTable(tableIdx);
}

function quickAdd(idx) {
  const input = document.getElementById(`add-${idx}`);
  const name = input?.value.trim();

  if (!name) return;
  if (tables[idx].guests.length >= tables[idx].capacity) return;

  tables[idx].guests.push(name);
  saveTable(idx);

  input.value = '';
}

// ── EVENT LISTENERS ──

document.addEventListener('DOMContentLoaded', () => {
  setupFirebase();

  // Tab Switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Waiter Search
  document.getElementById('waiterSearch').addEventListener('input', findGuest);
  document.getElementById('btnFindGuest').addEventListener('click', findGuest);

  // Manage Search
  document.getElementById('tableSearch').addEventListener('input', renderManage);

  // Modal Actions
  document.getElementById('btnModalCloseTop').addEventListener('click', closeModal);
  document.getElementById('btnModalCloseBottom').addEventListener('click', closeModal);
  document.getElementById('btnModalAddGuest').addEventListener('click', modalAddGuest);

  document.getElementById('modal-name-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') modalAddGuest();
  });

  // Close modal when clicking backdrop
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal')) closeModal();
  });
});
