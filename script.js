// ==================== DATA ====================
let jadwal = JSON.parse(localStorage.getItem('bel_jadwal') || '[]');

// ==================== MUSIK CUSTOM ====================
let customMusik = [];
let currentAudio = null;
let lastValidSuara = 'ding';

function handleSuaraChange(sel) {
  if (sel.value === '__tambah__') {
    sel.value = lastValidSuara;
    document.getElementById('fileMusik').click();
  } else {
    lastValidSuara = sel.value;
  }
}

function handleUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { alert('⚠️ File terlalu besar! Maksimal 10MB.'); return; }
  if (!file.type.startsWith('audio/')) { alert('⚠️ File harus berformat audio!'); return; }

  const url = URL.createObjectURL(file);
  const id = 'custom_' + Date.now();
  const nama = file.name.replace(/\.[^.]+$/, '');

  customMusik.push({ id, nama, url });
  addCustomOption(id, nama);

  const sel = document.getElementById('inSuara');
  sel.value = id;
  lastValidSuara = id;

  input.value = '';
}

function addCustomOption(id, nama) {
  const sel = document.getElementById('inSuara');
  const sepIdx = [...sel.options].findIndex(o => o.value === '__tambah__') - 1;
  const opt = new Option(`🎵 ${nama}`, id);
  sel.add(opt, sepIdx);
}

// ==================== DAY PICKER ====================
document.querySelectorAll('.day-btn').forEach(btn => {
  btn.addEventListener('click', () => btn.classList.toggle('active'));
});

function pilihHari(mode) {
  document.querySelectorAll('.day-btn').forEach(btn => {
    const d = parseInt(btn.dataset.day);
    if (mode === 'semua')        btn.classList.add('active');
    else if (mode === 'none')    btn.classList.remove('active');
    else if (mode === 'senin-jumat') btn.classList.toggle('active', d >= 1 && d <= 5);
    else if (mode === 'weekend') btn.classList.toggle('active', d === 0 || d === 6);
  });
}

function getSelectedDays() {
  return [...document.querySelectorAll('.day-btn.active')].map(b => parseInt(b.dataset.day));
}

const NAMA_HARI = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

function formatHari(days) {
  if (!days || days.length === 0) return '—';
  if (days.length === 7) return '🔁 Setiap hari';
  if (JSON.stringify([...days].sort()) === JSON.stringify([1,2,3,4,5])) return 'Sen–Jum';
  if (JSON.stringify([...days].sort()) === JSON.stringify([0,6])) return 'Weekend';
  return days.map(d => NAMA_HARI[d]).join(', ');
}

// ==================== CLOCK ====================
const HARI = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

let lastRingKey = '';

function updateClock() {
  const now = new Date();
  const H = String(now.getHours()).padStart(2,'0');
  const M = String(now.getMinutes()).padStart(2,'0');
  const S = String(now.getSeconds()).padStart(2,'0');

  document.getElementById('clockDisplay').textContent = `${H}:${M}:${S}`;
  document.getElementById('dateDisplay').textContent =
    `${HARI[now.getDay()]}, ${now.getDate()} ${BULAN[now.getMonth()]} ${now.getFullYear()}`;

  if (S === '00') {
    const nowHM = `${H}:${M}`;
    if (nowHM !== lastRingKey) {
      const hariIni = now.getDay();
      jadwal.forEach(j => {
        if (j.waktu === nowHM && j.hari.includes(hariIni)) {
          lastRingKey = nowHM;
          bunyikanBel(j.suara);
          tampilkanNotif(j.nama, j.waktu);
          // Tandai done jika hanya 1x (tidak ada hari aktif berulang)
          if (j.hari.length === 0) {
            j.done = true;
            simpan();
          }
        }
      });
      renderTabel();
    }
  }

  updateNextBell();
}

// ==================== NEXT BELL INFO ====================
function updateNextBell() {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const hariIni = now.getDay();

  const aktif = jadwal.filter(j => !j.done && j.hari.includes(hariIni));
  let next = null;
  let minDiff = Infinity;

  aktif.forEach(j => {
    const [h, m] = j.waktu.split(':').map(Number);
    let diff = h * 60 + m - nowMin;
    if (diff < 0) diff += 1440;
    if (diff > 0 && diff < minDiff) {
      minDiff = diff;
      next = j;
    }
  });

  const el = document.getElementById('nextBellInfo');
  if (next) {
    const jam = Math.floor(minDiff / 60);
    const mnt = minDiff % 60;
    el.textContent = `Bel berikut: ${next.nama} — ${jam > 0 ? jam + 'j ' : ''}${mnt}mnt lagi`;
  } else {
    el.textContent = 'Tidak ada jadwal aktif hari ini';
  }
}

// ==================== AUDIO ENGINE ====================
let audioCtx;
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function tone(ctx, freq, type, start, dur, vol) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
  gain.gain.setValueAtTime(vol, ctx.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + dur + 0.01);
}

const SOUNDS = {
  ding: ctx => {
    tone(ctx, 880, 'sine', 0, 2.0, 0.7);
    tone(ctx, 1320, 'sine', 0.05, 1.2, 0.3);
  },
  sekolah: ctx => {
    [0, 0.35, 0.70, 1.05, 1.40, 1.75].forEach(t => {
      tone(ctx, 700, 'square', t, 0.25, 0.35);
    });
  },
  digital: ctx => {
    [440, 550, 660, 770, 880].forEach((f, i) => {
      tone(ctx, f, 'square', i * 0.18, 0.14, 0.3);
    });
  },
  lonceng: ctx => {
    [[523,0],[659,0.45],[784,0.9],[1047,1.35]].forEach(([f,t]) => {
      tone(ctx, f, 'sine', t, 1.5, 0.5);
    });
  },
  alarm: ctx => {
    for (let i = 0; i < 8; i++) {
      tone(ctx, i % 2 === 0 ? 880 : 660, 'sawtooth', i * 0.22, 0.18, 0.4);
    }
  },
  triple: ctx => {
    [0, 0.5, 1.0].forEach(t => {
      tone(ctx, 880, 'sine', t, 0.6, 0.6);
      tone(ctx, 1320, 'sine', t + 0.05, 0.4, 0.25);
    });
  }
};

function bunyikanBel(jenis) {
  if (jenis.startsWith('custom_')) {
    const m = customMusik.find(m => m.id === jenis);
    if (m) {
      if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }
      currentAudio = new Audio(m.url);
      currentAudio.play();
    }
  } else {
    const ctx = getCtx();
    (SOUNDS[jenis] || SOUNDS.ding)(ctx);
  }
  const icon = document.getElementById('bellIcon');
  icon.classList.remove('ringing');
  void icon.offsetWidth;
  icon.classList.add('ringing');
  setTimeout(() => icon.classList.remove('ringing'), 1500);
}

function testSound() {
  bunyikanBel(document.getElementById('inSuara').value);
}

// ==================== NOTIF ====================
let notifTimer;
function tampilkanNotif(nama, waktu) {
  clearTimeout(notifTimer);
  const el = document.getElementById('notif');
  document.getElementById('notifTitle').textContent = `🔔 ${nama}`;
  document.getElementById('notifSub').textContent = `Waktu: ${waktu}`;
  el.classList.add('show');
  notifTimer = setTimeout(() => el.classList.remove('show'), 5000);
}

// ==================== CRUD ====================
function tambahJadwal() {
  const nama = document.getElementById('inNama').value.trim();
  const waktu = document.getElementById('inWaktu').value;
  const suara = document.getElementById('inSuara').value;
  const hari = getSelectedDays();

  if (!nama) return alert('⚠️ Nama jadwal tidak boleh kosong!');
  if (!waktu) return alert('⚠️ Waktu tidak boleh kosong!');
  if (hari.length === 0) return alert('⚠️ Pilih minimal 1 hari aktif!');

  jadwal.push({ id: Date.now(), nama, waktu, suara, hari, done: false });
  jadwal.sort((a, b) => a.waktu.localeCompare(b.waktu));
  simpan();
  renderTabel();

  document.getElementById('inNama').value = '';
  document.getElementById('inWaktu').value = '';
  document.getElementById('inNama').focus();
}

function hapus(id) {
  if (!confirm('Hapus jadwal ini?')) return;
  jadwal = jadwal.filter(j => j.id !== id);
  simpan();
  renderTabel();
}

function simpan() {
  localStorage.setItem('bel_jadwal', JSON.stringify(jadwal));
}

// ==================== RENDER ====================
function getSuaraLabel(jenis) {
  if (jenis.startsWith('custom_')) {
    const m = customMusik.find(m => m.id === jenis);
    return m ? `🎵 ${m.nama}` : '🎵 Custom';
  }
  const MAP = { ding:'🔔 Ding', sekolah:'🏫 Sekolah', digital:'📱 Digital', lonceng:'⛪ Lonceng', alarm:'⏰ Alarm', triple:'✨ Triple' };
  return MAP[jenis] || jenis;
}

function getStatusBadge(j) {
  if (j.done) return '<span class="badge b-done">✓ Selesai</span>';

  const now = new Date();
  const hariIni = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const [h, m] = j.waktu.split(':').map(Number);
  const jadMin = h * 60 + m;
  const diff = jadMin - nowMin;

  // Hari ini tidak aktif
  if (!j.hari.includes(hariIni)) return '<span class="badge b-skip">⏭ Bukan harinya</span>';

  if (diff === 0) return '<span class="badge b-now">🔔 Sekarang!</span>';
  if (diff > 0 && diff <= 10) return `<span class="badge b-soon">⏳ ${diff} mnt lagi</span>`;
  if (diff < 0) return '<span class="badge b-done">✓ Selesai hari ini</span>';
  return '<span class="badge b-active">✅ Aktif</span>';
}

function renderTabel() {
  const tbody = document.getElementById('tbody');
  const emptyState = document.getElementById('emptyState');
  const table = document.getElementById('jadwalTable');

  if (jadwal.length === 0) {
    emptyState.style.display = 'block';
    table.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  table.style.display = '';

  tbody.innerHTML = jadwal.map((j, i) => `
    <tr>
      <td style="color:var(--text-muted)">${i + 1}</td>
      <td><strong>${j.nama}</strong></td>
      <td style="font-size:15px;font-weight:800;letter-spacing:1px">${j.waktu}</td>
      <td>${getSuaraLabel(j.suara)}</td>
      <td>${formatHari(j.hari)}</td>
      <td>${getStatusBadge(j)}</td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn btn-sm btn-edit" onclick="bukaEdit(${j.id})" title="Edit">✏️</button>
          <button class="btn btn-sm btn-play" onclick="bunyikanBel('${j.suara}')" title="Tes suara">▶</button>
          <button class="btn btn-sm btn-del" onclick="hapus(${j.id})" title="Hapus">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ==================== EDIT ====================
let editId = null;

function bukaEdit(id) {
  const j = jadwal.find(j => j.id === id);
  if (!j) return;
  editId = id;

  document.getElementById('editNama').value = j.nama;
  document.getElementById('editWaktu').value = j.waktu;
  document.getElementById('editSuara').value = j.suara;

  // Set hari aktif di modal
  document.querySelectorAll('#editDayPicker .day-btn').forEach(btn => {
    btn.classList.toggle('active', j.hari.includes(parseInt(btn.dataset.day)));
  });

  document.getElementById('modalOverlay').classList.add('show');
}

function tutupModal() {
  document.getElementById('modalOverlay').classList.remove('show');
  editId = null;
}

function simpanEdit() {
  const nama = document.getElementById('editNama').value.trim();
  const waktu = document.getElementById('editWaktu').value;
  const suara = document.getElementById('editSuara').value;
  const hari = [...document.querySelectorAll('#editDayPicker .day-btn.active')]
    .map(b => parseInt(b.dataset.day));

  if (!nama) return alert('⚠️ Nama tidak boleh kosong!');
  if (!waktu) return alert('⚠️ Waktu tidak boleh kosong!');
  if (hari.length === 0) return alert('⚠️ Pilih minimal 1 hari!');

  const idx = jadwal.findIndex(j => j.id === editId);
  if (idx === -1) return;

  jadwal[idx] = { ...jadwal[idx], nama, waktu, suara, hari, done: false };
  jadwal.sort((a, b) => a.waktu.localeCompare(b.waktu));
  simpan();
  renderTabel();
  tutupModal();
}

function pilihHariEdit(mode) {
  document.querySelectorAll('#editDayPicker .day-btn').forEach(btn => {
    const d = parseInt(btn.dataset.day);
    if (mode === 'semua')            btn.classList.add('active');
    else if (mode === 'none')        btn.classList.remove('active');
    else if (mode === 'senin-jumat') btn.classList.toggle('active', d >= 1 && d <= 5);
    else if (mode === 'weekend')     btn.classList.toggle('active', d === 0 || d === 6);
  });
}

// Tutup modal pakai tombol Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') tutupModal();
});

// ==================== INIT ====================
renderTabel();
updateClock();
setInterval(updateClock, 1000);
setInterval(renderTabel, 30000);
