/* KULIAHKU versi statis: semua data tersimpan di peramban (localStorage + IndexedDB). */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const tgl = d => { if (!d) return '-'; const [y, m, dd] = d.slice(0, 10).split('-'); return `${+dd} ${MON[m - 1]} ${y}`; };
const today = () => new Date().toISOString().slice(0, 10);
const addDays = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const size = b => b >= 1073741824 ? (b / 1073741824).toFixed(2) + ' GB' : b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const toast = m => { const t = $('#toast'); t.textContent = m; t.className = 'show'; clearTimeout(toast.h); toast.h = setTimeout(() => t.className = '', 3000); };

// ---------- Penyimpanan ----------
const KEY = 'kuliahku-v1', AIKEY = 'kuliahku-aikey';
const blank = () => ({ user: null, courses: [], tasks: [], materials: [], schedules: [], notes: [], posts: [] });
let S = (() => { try { const r = JSON.parse(localStorage.getItem(KEY)); if (r) return Object.assign(blank(), r); } catch (e) {} return blank(); })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Penyimpanan penuh. Hapus data atau foto yang besar.'); } };
const idb = () => new Promise((ok, no) => { const r = indexedDB.open('kuliahku-files', 1); r.onupgradeneeded = () => r.result.createObjectStore('f'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
const fx = async (mode, fn) => { const d = await idb(); return new Promise((ok, no) => { const t = d.transaction('f', mode); const r = fn(t.objectStore('f')); t.oncomplete = () => ok(r && r.result); t.onerror = () => no(t.error); }); };
const fput = (k, b) => fx('readwrite', s => s.put(b, k)), fget = k => fx('readonly', s => s.get(k)), fdel = k => fx('readwrite', s => s.delete(k));
const shrink = (file, max = 160) => new Promise((ok, no) => {
  const img = new Image();
  img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', .85)); };
  img.onerror = no; img.src = URL.createObjectURL(file);
});

// ---------- Helper tampilan ----------
const cname = id => (S.courses.find(c => c.id === id) || {}).name || 'Tanpa mata kuliah';
const copts = (sel, ph = 'Mata kuliah (opsional)') => `<option value="">${ph}</option>` + S.courses.map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
const avatar = (n = 40) => S.user.avatar ? `<img class="av" src="${S.user.avatar}" width="${n}" height="${n}" alt="">` : `<span class="av ini" style="width:${n}px;height:${n}px;font-size:${Math.round(n / 2.3)}px">${esc(S.user.name[0].toUpperCase())}</span>`;
const LB = { belum: 'Belum Dikerjakan', proses: 'Dalam Proses', selesai: 'Selesai' };
const trow = t => { const late = t.due && t.status !== 'selesai' && t.due < today(); return `<div class="trow"><div><b>${esc(t.title)}</b><small>${esc(cname(t.course))}</small><small class="${late ? 'late' : ''}">Jatuh tempo: ${tgl(t.due)}${late ? ' (terlambat)' : ''}</small></div><button class="badge ${t.status}" data-act="task-status" data-id="${t.id}" title="Klik untuk ganti status">${LB[t.status]}</button><button class="x" data-act="task-del" data-id="${t.id}" aria-label="Hapus">✕</button></div>`; };
const mrow = m => `<div class="mrow"><span class="ext">${esc((m.ext || 'link').toUpperCase())}</span><div><b>${esc(m.title)}</b><small>${esc(cname(m.course))}${m.size ? ' • ' + size(m.size) : ''}</small></div><small>${tgl(m.c)}</small>${m.hasFile ? `<button class="dl" data-act="mat-dl" data-id="${m.id}" aria-label="Unduh">⬇</button>` : ''}${m.link ? `<a class="dl" href="${esc(m.link)}" target="_blank" rel="noopener" aria-label="Buka tautan">🔗</a>` : ''}<button class="x" data-act="mat-del" data-id="${m.id}" aria-label="Hapus">✕</button></div>`;
const taskSort = (a, b) => (a.status === 'selesai') - (b.status === 'selesai') || (a.due || '9999').localeCompare(b.due || '9999');
const usedBytes = () => S.materials.reduce((a, m) => a + (m.size || 0), 0);

const NAV = [['dashboard', '🏠', 'Dashboard'], ['materi', '📄', 'Materi Kuliah'], ['tugas', '📋', 'Tugas'], ['jadwal', '🗓️', 'Jadwal Kuliah'], ['catatan', '📝', 'Catatan'], ['ai', '✨', 'AI Assistant'], ['files', '📁', 'File Saya'], ['diskusi', '💬', 'Diskusi'], ['pengaturan', '⚙️', 'Pengaturan']];
function layout(active, body, qv = '') {
  const due = S.tasks.filter(t => t.status !== 'selesai' && t.due && t.due <= addDays(3)).sort(taskSort).slice(0, 6), u = S.user;
  return `<div class="shell"><aside class="side"><a class="brand" href="#/dashboard">🎓 <div><b>KULIAHKU</b><small>Belajar • Simpan • Raih Masa Depan</small></div></a>
  <nav>${NAV.map(([k, ic, lb]) => `<a href="#/${k}" class="${k === active ? 'on' : ''}"><span>${ic}</span>${lb}${k === 'ai' ? '<em>BETA</em>' : ''}</a>`).join('')}</nav>
  <div class="upsell"><b>👑 ${u.plan === 'premium' ? 'Akun Premium' : 'Upgrade ke Premium'}</b><p>Dapatkan semua fitur lengkap, AI Assistant, dan cadangan data.</p><a class="btn" href="#/pengaturan">${u.plan === 'premium' ? 'Kelola Langganan' : 'Upgrade Sekarang'}</a></div>
  <a class="sync" href="#/pengaturan"><b>Cadangan &amp; Pindah Perangkat</b><div>💻 📱 📲</div><small>● Tersimpan di peramban</small></a></aside>
  <div class="body"><header class="top"><form data-f="search" class="search"><input name="q" value="${esc(qv)}" placeholder="Cari materi, tugas, atau mata kuliah..." aria-label="Cari"></form>
  <details class="dd bell"><summary aria-label="Notifikasi">🔔${due.length ? `<i>${due.length}</i>` : ''}</summary><div class="menu"><b>Tenggat 3 hari ke depan</b>${due.length ? '' : '<small>Tidak ada tugas mendesak.</small>'}${due.map(d => `<a href="#/tugas">${esc(d.title)}<small class="${d.due < today() ? 'late' : ''}">${tgl(d.due)}</small></a>`).join('')}</div></details>
  <details class="dd me"><summary>${avatar(42)}<span><b>${esc(u.name)}</b><small>Mahasiswa</small></span> ▾</summary><div class="menu"><a href="#/pengaturan">⚙️ Pengaturan &amp; foto profil</a><button data-act="logout">↩ Keluar</button></div></details></header>
  <main>${body}</main></div></div>`;
}
const onboard = () => `<div class="authpage"><form class="authcard" data-f="onboard"><h1>🎓 KULIAHKU</h1><p>Satu tempat untuk semua kebutuhan kuliahmu.</p><input name="name" placeholder="Nama kamu" required autocomplete="name"><button class="btn">Mulai</button><small>Data tersimpan di peramban ini dan tidak dikirim ke server mana pun.</small></form></div>`;

// ---------- Halaman ----------
const V = {};
V.dashboard = () => {
  const wk = addDays(-7), used = usedBytes(), pct = Math.max(1, Math.min(100, used / (500 * 1048576) * 100));
  const tasks = [...S.tasks].sort(taskSort).slice(0, 5), mats = [...S.materials].reverse().slice(0, 5);
  return `<section class="hero"><div><p>Selamat Datang di</p><h1>KULIAHKU</h1><p>Satu tempat untuk semua kebutuhan kuliahmu.</p><div class="chips"><a href="#/materi">📎 Simpan Materi</a><a href="#/tugas">✅ Kelola Tugas</a><a href="#/ai">✨ AI Assistant</a><a href="#/pengaturan">🔄 Cadangan Data</a></div></div><div class="cap" aria-hidden="true">🎓</div><blockquote>“Masa depanmu dimulai dari apa yang kamu pelajari hari ini.”</blockquote></section>
  <section class="stats"><a class="stat" href="#/materi"><span>📄</span><div><small>Total Materi</small><b>${S.materials.length}</b><em>+${S.materials.filter(m => m.c >= wk).length} minggu ini</em></div></a>
  <a class="stat" href="#/tugas"><span>📋</span><div><small>Total Tugas</small><b>${S.tasks.length}</b><em>+${S.tasks.filter(t => t.c >= wk).length} minggu ini</em></div></a>
  <a class="stat" href="#/courses"><span>📚</span><div><small>Mata Kuliah</small><b>${S.courses.length}</b><em>Aktif</em></div></a>
  <a class="stat" href="#/files"><span>☁️</span><div><small>Penyimpanan</small><b>${size(used)}</b><small>dari ±500 MB ruang aman</small><div class="bar"><i style="width:${pct}%"></i></div></div></a></section>
  <section class="two"><div class="panel"><div class="ph"><h2>📖 Mata Kuliah Saya</h2><a href="#/courses">Lihat Semua</a></div>${S.courses.length ? '' : '<div class="empty">Belum ada mata kuliah. <a href="#/courses">Tambahkan sekarang</a>.</div>'}<div class="cgrid3">${S.courses.slice(-6).reverse().map(c => `<a class="ccard" href="#/courses"><div class="cban ${c.color}"></div><b>${esc(c.name)}</b><small>${c.sks} SKS | Semester ${c.sem}</small><div class="prow"><div class="bar"><i style="width:${c.progress}%"></i></div><span>${c.progress}%</span></div></a>`).join('')}</div></div>
  <div class="panel"><div class="ph"><h2>📋 Tugas Terbaru</h2><a href="#/tugas">Lihat Semua</a></div><details><summary class="btn sm">+ Tambah tugas</summary>${taskForm('stack')}</details>${tasks.length ? tasks.map(trow).join('') : '<div class="empty">Belum ada tugas.</div>'}</div></section>
  <section class="two"><div class="panel"><div class="ph"><h2>📄 Materi Terbaru</h2><a href="#/materi">Lihat Semua</a></div>${mats.length ? mats.map(mrow).join('') : '<div class="empty">Belum ada materi.</div>'}</div>
  <div class="panel"><div class="ph"><h2>✨ AI Assistant <em class="beta">BETA</em></h2></div><p class="mut">Ringkasan materi, buat soal latihan, dan bantu jawab pertanyaanmu.</p><form data-f="goai" class="aibox"><input name="q" placeholder="Tulis pertanyaan atau perintah..." aria-label="Pertanyaan AI" required><button class="btn" aria-label="Kirim">➤</button></form>
  <div class="chips2"><a href="#/ai?mode=ringkasan">Ringkasan Materi</a><a href="#/ai?mode=soal">Buat Soal Latihan</a><a href="#/ai?mode=jelaskan">Jelaskan Konsep</a><a href="#/ai?mode=tanya">Tanya Jawab</a></div></div></section>`;
};
const taskForm = cls => `<form data-f="task" class="${cls}"><input name="title" placeholder="Judul tugas" required aria-label="Judul"><select name="course">${copts()}</select><input type="date" name="due" aria-label="Tenggat"><button class="btn">Tambah</button></form>`;

V.courses = () => `<h1 class="h1">Mata Kuliah</h1><form data-f="course" class="panel addrow"><input name="name" placeholder="Nama mata kuliah" required aria-label="Nama"><input type="number" name="sks" value="3" min="1" max="6" aria-label="SKS"><input type="number" name="sem" value="1" min="1" max="14" aria-label="Semester"><select name="color" aria-label="Warna">${['biru', 'ungu', 'hijau', 'oranye', 'teal'].map(c => `<option>${c}</option>`).join('')}</select><button class="btn">Tambah</button></form>
  ${S.courses.length ? '' : '<div class="empty">Belum ada mata kuliah. Tambahkan yang pertama lewat formulir di atas.</div>'}
  <div class="cgrid">${S.courses.map(c => `<div class="ccard"><div class="cban ${c.color}"></div><b>${esc(c.name)}</b><small>${c.sks} SKS | Semester ${c.sem}</small><div class="bar"><i style="width:${c.progress}%"></i></div>
  <form data-f="progress" class="inl"><input type="hidden" name="id" value="${c.id}"><input type="number" name="progress" min="0" max="100" value="${c.progress}" aria-label="Progres"><button class="mini">Simpan %</button></form><button class="mini del" data-act="course-del" data-id="${c.id}">Hapus</button></div>`).join('')}</div>`;

V.tugas = p => { const st = p.get('st') || '', L = S.tasks.filter(t => !st || t.status === st).sort(taskSort);
  return `<h1 class="h1">Tugas</h1><div class="panel">${taskForm('addrow t')}</div><div class="tabs">${[['', 'Semua'], ['belum', 'Belum Dikerjakan'], ['proses', 'Dalam Proses'], ['selesai', 'Selesai']].map(([k, l]) => `<a class="${k === st ? 'on' : ''}" href="#/tugas${k ? '?st=' + k : ''}">${l}</a>`).join('')}</div>
  <div class="panel">${L.length ? L.map(trow).join('') : '<div class="empty">Tidak ada tugas di sini.</div>'}</div>`; };

V.materi = p => { const q = (p.get('q') || '').toLowerCase(), c = p.get('c') || '', L = [...S.materials].reverse().filter(m => m.title.toLowerCase().includes(q) && (!c || m.course === c));
  return `<h1 class="h1">Materi Kuliah</h1><form data-f="material" class="panel addrow m"><input name="title" placeholder="Judul (opsional)" aria-label="Judul"><select name="course">${copts()}</select><input type="file" name="file" aria-label="File"><input name="link" placeholder="atau tautan https://..." aria-label="Tautan"><button class="btn">Simpan</button></form>
  <form data-f="msearch" class="panel addrow f"><input name="q" value="${esc(p.get('q') || '')}" placeholder="Cari materi" aria-label="Cari"><select name="c">${copts(c, 'Semua mata kuliah')}</select><button class="btn">Cari</button></form>
  <div class="panel">${L.length ? L.map(mrow).join('') : '<div class="empty">Belum ada materi. Unggah PDF, PPT, DOCX, atau simpan tautan Drive.</div>'}</div>`; };

V.files = p => { const G = { pdf: ['pdf'], ppt: ['ppt', 'pptx'], doc: ['doc', 'docx', 'txt'], xls: ['xls', 'xlsx', 'csv'], lain: null }, g = p.get('g') || '';
  const all = S.materials.filter(m => m.hasFile), L = all.filter(m => !g || (G[g] ? G[g].includes(m.ext) : !Object.values(G).filter(Boolean).flat().includes(m.ext))), used = usedBytes();
  return `<h1 class="h1">File Saya</h1><div class="panel"><b>${size(used)}</b> terpakai • ${all.length} file<div class="bar"><i style="width:${Math.max(1, Math.min(100, used / (500 * 1048576) * 100))}%"></i></div><small>File disimpan di peramban ini, bukan di server.</small></div>
  <div class="tabs"><a class="${g ? '' : 'on'}" href="#/files">Semua</a>${[['pdf', 'PDF'], ['ppt', 'PPT'], ['doc', 'DOC'], ['xls', 'XLS'], ['lain', 'Lainnya']].map(([k, l]) => `<a class="${g === k ? 'on' : ''}" href="#/files?g=${k}">${l}</a>`).join('')}</div>
  <div class="panel">${L.length ? L.map(mrow).join('') : '<div class="empty">Tidak ada file. Unggah lewat menu <a href="#/materi">Materi Kuliah</a>.</div>'}</div>`; };

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
V.jadwal = () => { const now = ((new Date().getDay() + 6) % 7) + 1;
  return `<h1 class="h1">Jadwal Kuliah</h1><form data-f="sched" class="panel addrow j"><input name="title" placeholder="Kegiatan (atau pilih mata kuliah)" aria-label="Kegiatan"><select name="course">${copts()}</select><select name="day" aria-label="Hari">${DAYS.map((l, i) => `<option value="${i + 1}" ${i + 1 === now ? 'selected' : ''}>${l}</option>`).join('')}</select><input type="time" name="start" required aria-label="Mulai"><input type="time" name="end" required aria-label="Selesai"><input name="room" placeholder="Ruang" aria-label="Ruang"><button class="btn">Tambah</button></form>
  <div class="days">${DAYS.map((l, i) => `<div class="panel ${i + 1 === now ? 'today' : ''}"><h2>${l}</h2>${S.schedules.filter(s => s.day === i + 1).sort((a, b) => a.start.localeCompare(b.start)).map(s => `<div class="slot"><div><b>${esc(s.title)}</b><small>${s.start} - ${s.end}${s.room ? ' • ' + esc(s.room) : ''}</small></div><button class="x" data-act="sched-del" data-id="${s.id}" aria-label="Hapus">✕</button></div>`).join('') || '<small>Tidak ada jadwal.</small>'}</div>`).join('')}</div>`; };

V.catatan = p => { const q = (p.get('q') || '').toLowerCase(), L = [...S.notes].reverse().filter(n => (n.title + ' ' + n.body).toLowerCase().includes(q));
  return `<h1 class="h1">Catatan</h1><form data-f="note" class="panel stack"><div class="addrow n"><input name="title" placeholder="Judul catatan" required aria-label="Judul"><select name="course">${copts()}</select></div><textarea name="body" rows="3" placeholder="Tulis rangkuman atau catatan pribadi..." aria-label="Isi"></textarea><button class="btn">Simpan catatan</button></form>
  <form data-f="nsearch" class="panel addrow f"><input name="q" value="${esc(p.get('q') || '')}" placeholder="Cari catatan" aria-label="Cari"><button class="btn">Cari</button></form>
  ${L.length ? '' : '<div class="empty">Belum ada catatan.</div>'}<div class="cgrid">${L.map(n => `<div class="ccard note"><b>${esc(n.title)}</b><small>${esc(cname(n.course))} • ${tgl(n.c)}</small><p>${esc(n.body.slice(0, 300)).replace(/\n/g, '<br>')}${n.body.length > 300 ? '…' : ''}</p>
  <details><summary class="mini">Ubah</summary><form data-f="note-edit" class="stack"><input type="hidden" name="id" value="${n.id}"><input name="title" value="${esc(n.title)}" required aria-label="Judul"><select name="course">${copts(n.course)}</select><textarea name="body" rows="5" aria-label="Isi">${esc(n.body)}</textarea><button class="btn sm">Simpan</button></form></details><button class="mini del" data-act="note-del" data-id="${n.id}">Hapus</button></div>`).join('')}</div>`; };

let aiOut = null;
const AIMODES = { ringkasan: 'Ringkasan Materi', soal: 'Buat Soal Latihan', jelaskan: 'Jelaskan Konsep', tanya: 'Tanya Jawab' };
V.ai = p => { const mode = AIMODES[p.get('mode')] ? p.get('mode') : (p.get('q') ? 'tanya' : 'ringkasan'), key = localStorage.getItem(AIKEY) || '';
  return `<h1 class="h1">✨ AI Assistant <em class="beta">BETA</em></h1><div class="note-bar">Website ini tidak punya server, jadi AI memakai API key milikmu sendiri. Kunci hanya disimpan di peramban ini dan dikirim langsung ke Anthropic. Pakai kunci dengan batas biaya rendah, dan jangan pakai di komputer umum.</div>
  <div class="tabs">${Object.entries(AIMODES).map(([k, l]) => `<a class="${k === mode ? 'on' : ''}" href="#/ai?mode=${k}">${l}</a>`).join('')}</div>
  <form data-f="ai" class="panel stack"><input type="hidden" name="mode" value="${mode}"><textarea name="src" rows="7" placeholder="${mode === 'tanya' ? 'Tulis pertanyaanmu...' : mode === 'jelaskan' ? 'Tulis konsep yang ingin dijelaskan...' : 'Tempel teks materi di sini...'}" aria-label="Teks">${esc(p.get('q') || '')}</textarea>
  <select name="note" aria-label="Pakai catatan"><option value="">atau pakai isi salah satu catatan</option>${S.notes.map(n => `<option value="${n.id}">${esc(n.title)}</option>`).join('')}</select><input type="password" name="key" value="${esc(key)}" placeholder="API key Anthropic (sk-ant-...)" aria-label="API key" autocomplete="off"><button class="btn">${AIMODES[mode]}</button></form>
  ${aiOut ? (aiOut.loading ? '<div class="panel">Memproses...</div>' : aiOut.err ? `<div class="note-bar" role="alert">${esc(aiOut.err)}</div>` : `<div class="panel"><div class="ph"><h2>Hasil</h2></div><div class="aiout">${esc(aiOut.out)}</div><button class="btn sm" data-act="ai-save">Simpan ke Catatan</button></div>`) : ''}`; };

V.diskusi = () => `<h1 class="h1">Diskusi</h1><div class="note-bar">Diskusi di versi statis hanya tersimpan di perangkatmu, jadi berfungsi sebagai papan tanya jawab pribadi.</div><form data-f="topic" class="panel stack"><input name="title" placeholder="Judul topik" required aria-label="Judul"><textarea name="body" rows="3" placeholder="Tulis pertanyaan atau pembahasan..." required aria-label="Pesan"></textarea><button class="btn">Buat topik</button></form>
  ${S.posts.length ? '' : '<div class="empty">Belum ada topik.</div>'}${[...S.posts].reverse().map(t => `<div class="panel"><div class="msg">${avatar(36)}<div><b>${esc(t.title)}</b><small>${esc(S.user.name)} • ${tgl(t.c)}</small><p>${esc(t.body).replace(/\n/g, '<br>')}</p></div><button class="x" data-act="post-del" data-id="${t.id}" aria-label="Hapus">✕</button></div>
  ${(t.replies || []).map(r => `<div class="msg rep">${avatar(30)}<div><small>${esc(S.user.name)} • ${tgl(r.c)}</small><p>${esc(r.body)}</p></div></div>`).join('')}
  <form data-f="reply" class="inl"><input type="hidden" name="id" value="${t.id}"><input name="body" placeholder="Balas..." required aria-label="Balasan"><button class="btn sm">Kirim</button></form></div>`).join('')}`;

V.pengaturan = () => `<h1 class="h1">Pengaturan</h1><form data-f="profile" class="panel stack"><h2>Profil</h2><div class="prof">${avatar(84)}<div class="stack"><label>Foto profil<input type="file" name="avatar" accept="image/*"></label><label>Nama<input name="name" value="${esc(S.user.name)}" required></label></div></div><button class="btn">Simpan profil</button></form>
  <div class="panel stack"><h2>👑 Paket: ${S.user.plan === 'premium' ? 'Premium' : 'Gratis'}</h2><p class="mut">Mode uji coba tanpa pembayaran.</p><button class="btn" data-act="plan">${S.user.plan === 'premium' ? 'Kembali ke Gratis' : 'Aktifkan Premium'}</button></div>
  <div class="panel stack" id="sinkron"><h2>🔄 Cadangan &amp; pindah perangkat</h2><p class="mut">Data tersimpan di peramban ini saja. Untuk memindahkan ke HP atau laptop lain: unduh cadangan di sini, lalu impor di perangkat tujuan. File materi yang diunggah tidak ikut dalam cadangan, hanya data teksnya.</p><button class="btn" data-act="export">Unduh cadangan data</button>
  <form data-f="import" class="stack"><label>Impor cadangan (.json)<input type="file" name="file" accept=".json,application/json" required></label><button class="btn">Impor</button></form></div>
  <div class="panel stack"><h2>Hapus semua data</h2><p class="mut">Menghapus semua data dan file di peramban ini secara permanen.</p><button class="mini del" data-act="reset">Hapus semua data</button></div>`;

V.cari = p => { const q = (p.get('q') || '').toLowerCase(), has = s => s.toLowerCase().includes(q);
  const t = S.tasks.filter(x => has(x.title)), m = S.materials.filter(x => has(x.title)), n = S.notes.filter(x => has(x.title + ' ' + x.body)), c = S.courses.filter(x => has(x.name));
  return `<h1 class="h1">Hasil untuk “${esc(p.get('q') || '')}”</h1>${[['Mata kuliah', c.map(x => `<div class="trow"><div><b>${esc(x.name)}</b><small>${x.sks} SKS | Semester ${x.sem}</small></div><a href="#/courses">Buka</a></div>`)], ['Tugas', t.map(trow)], ['Materi', m.map(mrow)], ['Catatan', n.map(x => `<div class="trow"><div><b>${esc(x.title)}</b><small>${esc(x.body.slice(0, 80))}</small></div><a href="#/catatan?q=${encodeURIComponent(x.title)}">Buka</a></div>`)]].map(([l, r]) => r.length ? `<div class="panel"><h2>${l}</h2>${r.join('')}</div>` : '').join('') || '<div class="empty">Tidak ada hasil.</div>'}`; };

// ---------- Router ----------
const ACTIVE = { courses: 'dashboard', cari: 'dashboard' };
async function render() {
  const y = scrollY, root = $('#root');
  if (!S.user) { root.innerHTML = onboard(); return; }
  const [r, qs] = location.hash.slice(2).split('?'), name = V[r] ? r : 'dashboard', p = new URLSearchParams(qs || '');
  root.innerHTML = layout(ACTIVE[name] || name, await V[name](p), name === 'cari' ? p.get('q') || '' : '');
  scrollTo(0, y);
}
addEventListener('hashchange', () => { scrollTo(0, 0); render(); });

// ---------- Aksi (klik) ----------
const A = {
  'task-status': id => { const t = S.tasks.find(x => x.id === id); t.status = { belum: 'proses', proses: 'selesai', selesai: 'belum' }[t.status]; },
  'task-del': id => { if (confirm('Hapus tugas ini?')) S.tasks = S.tasks.filter(x => x.id !== id); },
  'course-del': id => { if (confirm('Hapus mata kuliah ini?')) { S.courses = S.courses.filter(x => x.id !== id);[...S.tasks, ...S.materials, ...S.notes, ...S.schedules].forEach(x => { if (x.course === id) x.course = ''; }); } },
  'mat-del': async id => { if (!confirm('Hapus materi ini?')) return; const m = S.materials.find(x => x.id === id); if (m.hasFile) await fdel(id); S.materials = S.materials.filter(x => x.id !== id); },
  'mat-dl': async id => { const m = S.materials.find(x => x.id === id), b = await fget(id); if (!b) return toast('File tidak ditemukan di peramban ini.'); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = m.fileName; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); },
  'sched-del': id => { S.schedules = S.schedules.filter(x => x.id !== id); },
  'note-del': id => { if (confirm('Hapus catatan ini?')) S.notes = S.notes.filter(x => x.id !== id); },
  'post-del': id => { if (confirm('Hapus topik ini?')) S.posts = S.posts.filter(x => x.id !== id); },
  'plan': () => { S.user.plan = S.user.plan === 'premium' ? 'free' : 'premium'; toast(S.user.plan === 'premium' ? 'Premium aktif (mode uji coba).' : 'Kembali ke paket Gratis.'); },
  'logout': () => { S.user = null; },
  'ai-save': () => { S.notes.push({ id: uid(), title: AIMODES[aiOut.mode] || 'Hasil AI', course: '', body: aiOut.out, c: today() }); toast('Disimpan ke Catatan.'); },
  'export': () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' })); a.download = 'kuliahku-cadangan-' + today() + '.json'; a.click(); },
  'reset': async () => { if (!confirm('Hapus SEMUA data di peramban ini? Tidak bisa dibatalkan.')) return; localStorage.removeItem(KEY); localStorage.removeItem(AIKEY); indexedDB.deleteDatabase('kuliahku-files'); S = blank(); location.hash = ''; },
};
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b || !A[b.dataset.act]) return;
  try { await A[b.dataset.act](b.dataset.id); } catch (err) { toast('Terjadi kesalahan: ' + err.message); }
  save(); render();
});

// ---------- Formulir ----------
const askAI = async (mode, src, key) => {
  const pre = { ringkasan: 'Ringkas materi kuliah berikut dalam bahasa Indonesia, berupa poin-poin utama yang mudah dipelajari:\n\n', soal: 'Buat 5 soal pilihan ganda (A-D) beserta kunci jawaban dan pembahasan singkat dari materi berikut, dalam bahasa Indonesia:\n\n', jelaskan: 'Jelaskan konsep berikut dengan bahasa sederhana untuk mahasiswa, sertakan contoh, dalam bahasa Indonesia:\n\n', tanya: 'Jawab pertanyaan mahasiswa berikut dengan jelas dan ringkas dalam bahasa Indonesia:\n\n' }[mode];
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: 1500, messages: [{ role: 'user', content: pre + src.slice(0, 12000) }] }) });
  const d = await r.json(); if (!r.ok) throw new Error(d.error?.message || 'Permintaan AI gagal.'); return d.content?.[0]?.text || '';
};
const F = {
  onboard: d => { S.user = { name: d.name.trim(), avatar: S.user?.avatar || null, plan: 'free' }; },
  search: d => { location.hash = '#/cari?q=' + encodeURIComponent(d.q); },
  goai: d => { location.hash = '#/ai?mode=tanya&q=' + encodeURIComponent(d.q); },
  msearch: d => { location.hash = `#/materi?q=${encodeURIComponent(d.q)}&c=${d.c}`; },
  nsearch: d => { location.hash = '#/catatan?q=' + encodeURIComponent(d.q); },
  task: d => { if (!d.title.trim()) return; S.tasks.push({ id: uid(), title: d.title.trim(), course: d.course, due: d.due, status: 'belum', c: today() }); toast('Tugas ditambahkan.'); },
  course: d => { if (!d.name.trim()) return; S.courses.push({ id: uid(), name: d.name.trim(), sks: +d.sks || 3, sem: +d.sem || 1, color: d.color, progress: 0 }); toast('Mata kuliah ditambahkan.'); },
  progress: d => { S.courses.find(c => c.id === d.id).progress = Math.min(100, Math.max(0, +d.progress || 0)); toast('Progres diperbarui.'); },
  material: async d => {
    const f = d.file, hasFile = f && f.size > 0, link = d.link.trim();
    if (!hasFile && !link) return toast('Pilih file atau isi tautan.');
    if (link && !/^https?:\/\//i.test(link)) return toast('Tautan harus diawali http:// atau https://');
    if (hasFile && f.size > 50 * 1048576) return toast('Ukuran file maksimal 50 MB.');
    const id = uid(); if (hasFile) await fput(id, f);
    S.materials.push({ id, title: d.title.trim() || (hasFile ? f.name.replace(/\.[^.]+$/, '') : link), course: d.course, link, hasFile: !!hasFile, fileName: hasFile ? f.name : '', ext: hasFile ? (f.name.split('.').pop() || 'file').toLowerCase().slice(0, 5) : '', size: hasFile ? f.size : 0, c: today() }); toast('Materi disimpan.');
  },
  sched: d => { const title = d.title.trim() || (S.courses.find(c => c.id === d.course) || {}).name; if (!title) return toast('Isi kegiatan atau pilih mata kuliah.'); S.schedules.push({ id: uid(), title, course: d.course, day: +d.day, start: d.start, end: d.end, room: d.room.trim() }); toast('Jadwal ditambahkan.'); },
  note: d => { if (!d.title.trim()) return; S.notes.push({ id: uid(), title: d.title.trim(), course: d.course, body: d.body, c: today() }); toast('Catatan disimpan.'); },
  'note-edit': d => { Object.assign(S.notes.find(n => n.id === d.id), { title: d.title.trim(), course: d.course, body: d.body }); toast('Catatan diperbarui.'); },
  topic: d => { S.posts.push({ id: uid(), title: d.title.trim(), body: d.body.trim(), c: today(), replies: [] }); },
  reply: d => { S.posts.find(t => t.id === d.id).replies.push({ body: d.body.trim(), c: today() }); },
  profile: async d => { if (!d.name.trim()) return; S.user.name = d.name.trim(); if (d.avatar && d.avatar.size) { if (!d.avatar.type.startsWith('image/')) return toast('File harus berupa gambar.'); S.user.avatar = await shrink(d.avatar); } toast('Profil diperbarui.'); },
  import: async d => { try { const j = JSON.parse(await d.file.text()); if (!['courses', 'tasks', 'materials', 'notes'].every(k => Array.isArray(j[k]))) throw 0; S = Object.assign(blank(), j); toast('Cadangan diimpor.'); } catch (e) { toast('File cadangan tidak valid.'); } },
  ai: async d => {
    let src = d.src.trim(); if (!src && d.note) src = (S.notes.find(n => n.id === d.note) || {}).body || '';
    if (!src) return void (aiOut = { err: 'Tulis teks atau pilih catatan dulu.' });
    if (!d.key.trim()) return void (aiOut = { err: 'Isi API key Anthropic dulu.' });
    localStorage.setItem(AIKEY, d.key.trim()); aiOut = { loading: true }; render();
    try { aiOut = { out: await askAI(d.mode, src, d.key.trim()), mode: d.mode }; } catch (e) { aiOut = { err: 'Gagal: ' + e.message }; }
  },
};
document.addEventListener('submit', async e => {
  const f = e.target.closest('form[data-f]'); if (!f) return; e.preventDefault();
  try { await F[f.dataset.f](Object.fromEntries(new FormData(f)), f); } catch (err) { toast('Terjadi kesalahan: ' + err.message); }
  save(); render();
});
render();
