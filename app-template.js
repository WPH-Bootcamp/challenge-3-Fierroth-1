// app.js
// Habit Tracker CLI - Complete implementation

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'habits-data.json');
const REMINDER_INTERVAL = 10000; // 10 detik
const DAYS_IN_WEEK = 7;

// ---------- Readline helper ----------
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, answer => resolve(answer));
  });
}

// ---------- Utilities ----------
function uuid() {
  // simple id generator
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatDate(d) {
  // YYYY-MM-DD
  return d.toISOString().slice(0, 10);
}

function startOfWeek(date) {
  // minggu dimulai hari senin
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  d.setHours(0,0,0,0);
  return d;
}

function endOfWeek(date) {
  const s = startOfWeek(date);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23,59,59,999);
  return e;
}

function asciiProgressBar(percent, length = 20) {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * length);
  const empty = length - filled;
  return '[' + '#'.repeat(filled) + '-'.repeat(empty) + `] ${Math.round(clamped)}%`;
}

// ---------- User Profile Object ----------
const UserProfile = {
  name: 'User',
  createdAt: new Date().toISOString(),
  stats: {
    habitsCreated: 0,
    totalCompletions: 0
  },
  updateStats(habits) {
    this.stats.habitsCreated = habits.length;
    let completions = 0;
    habits.forEach(h => completions += h.completions.length);
    this.stats.totalCompletions = completions;
  },
  getDaysJoined() {
    const created = new Date(this.createdAt);
    const now = new Date();
    const diff = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    return diff + 1; // include today
  }
};

// ---------- Habit Class ----------
class Habit {
  constructor(name, targetFrequency) {
    this.id = uuid();
    this.name = name;
    this.targetFrequency = Number(targetFrequency) ?? 0; // nullish coalescing
    this.completions = []; // store date strings 'YYYY-MM-DD'
    this.createdAt = new Date().toISOString();
  }

  markComplete(date = new Date()) {
    const dateStr = formatDate(new Date(date));
    // prevent duplicate completions for same day
    if (!this.completions.includes(dateStr)) {
      this.completions.push(dateStr);
      return true;
    }
    return false;
  }

  // returns array of completion date strings that fall in current week
  getThisWeekCompletions(referenceDate = new Date()) {
    const start = startOfWeek(referenceDate);
    const end = endOfWeek(referenceDate);
    return this.completions.filter(d => {
      const dt = new Date(d + 'T00:00:00');
      return dt >= start && dt <= end;
    });
  }

  isCompletedThisWeek(referenceDate = new Date()) {
    return this.getThisWeekCompletions(referenceDate).length >= this.targetFrequency;
  }

  getProgressPercentage(referenceDate = new Date()) {
    const done = this.getThisWeekCompletions(referenceDate).length;
    if (this.targetFrequency <= 0) return 0;
    const percent = (done / this.targetFrequency) * 100;
    return Math.min(percent, 100);
  }

  getStatus(referenceDate = new Date()) {
    const done = this.getThisWeekCompletions(referenceDate).length;
    if (this.targetFrequency <= 0) return `Target tidak ditetapkan`;
    return `${done}/${this.targetFrequency} per minggu - ${this.isCompletedThisWeek(referenceDate) ? '✅ Selesai' : '🔜 Belum selesai'}`;
  }
}

// ---------- HabitTracker Class ----------
class HabitTracker {
  constructor() {
    this.habits = [];
    this.user = UserProfile;
    this.reminderTimer = null;
    this.loadFromFile();
  }

  addHabit(name, frequency) {
    const h = new Habit(name, frequency);
    this.habits.push(h);
    this.user.updateStats(this.habits);
    this.saveToFile();
    return h;
  }

  completeHabit(habitIndex) {
    const idx = Number(habitIndex);
    if (Number.isNaN(idx) || idx < 0 || idx >= this.habits.length) return { error: 'Index tidak valid' };
    const habit = this.habits[idx];
    const added = habit.markComplete();
    if (added) {
      this.user.updateStats(this.habits);
      this.saveToFile();
    }
    return { habit, added };
  }

  deleteHabit(habitIndex) {
    const idx = Number(habitIndex);
    if (Number.isNaN(idx) || idx < 0 || idx >= this.habits.length) return false;
    this.habits.splice(idx, 1);
    this.user.updateStats(this.habits);
    this.saveToFile();
    return true;
  }

  displayProfile() {
    console.log('---- Profil Pengguna ----');
    console.log(`Nama: ${this.user.name}`);
    console.log(`Bergabung sejak: ${new Date(this.user.createdAt).toLocaleString()}`);
    console.log(`Hari sejak bergabung: ${this.user.getDaysJoined()}`);
    console.log(`Jumlah kebiasaan dibuat: ${this.user.stats.habitsCreated}`);
    console.log(`Total penyelesaian: ${this.user.stats.totalCompletions}`);
    console.log('-------------------------\n');
  }

  displayHabits(filter = 'all') {
    console.log('---- Daftar Kebiasaan ----');
    let list = this.habits;
    if (filter === 'active') {
      list = this.habits.filter(h => !h.isCompletedThisWeek());
    } else if (filter === 'completed') {
      list = this.habits.filter(h => h.isCompletedThisWeek());
    }
    if (list.length === 0) {
      console.log('(kosong)');
      console.log('---------------------------\n');
      return;
    }
    list.forEach((h, i) => {
      const percent = h.getProgressPercentage();
      console.log(`${i}. ${h.name} (${h.getStatus()})`);
      console.log(`   ${asciiProgressBar(percent)}`);
    });
    console.log('---------------------------\n');
  }

  // demonstrate with while loop
  displayHabitsWithWhile() {
    console.log('--- Demo: while loop ---');
    let i = 0;
    while (i < this.habits.length) {
      const h = this.habits[i];
      console.log(`${i}. ${h.name} - ${h.getStatus()}`);
      i++;
    }
    if (this.habits.length === 0) console.log('(tidak ada kebiasaan)');
    console.log('------------------------\n');
  }

  // demonstrate with for loop
  displayHabitsWithFor() {
    console.log('--- Demo: for loop ---');
    for (let i = 0; i < this.habits.length; i++) {
      const h = this.habits[i];
      console.log(`${i}. ${h.name} - ${h.getStatus()}`);
    }
    if (this.habits.length === 0) console.log('(tidak ada kebiasaan)');
    console.log('----------------------\n');
  }

  displayStats() {
    console.log('---- Statistik Ringkas ----');
    console.log(`Total kebiasaan: ${this.habits.length}`);
    const completedThisWeek = this.habits.filter(h => h.isCompletedThisWeek()).length;
    const activeThisWeek = this.habits.length - completedThisWeek;
    console.log(`Selesai minggu ini: ${completedThisWeek}`);
    console.log(`Belum selesai: ${activeThisWeek}`);

    // array methods examples:
    const names = this.habits.map(h => h.name);
    const mostCompletions = this.habits.reduce((acc, h) => {
      const c = h.getThisWeekCompletions().length;
      if (!acc || c > acc.count) return { habit: h, count: c };
      return acc;
    }, null);
    console.log(`Nama kebiasaan: ${names.join(', ') || '(kosong)'}`);
    if (mostCompletions) {
      console.log(`Paling aktif minggu ini: ${mostCompletions.habit.name} (${mostCompletions.count} kali)`);
    } else {
      console.log('(belum ada penyelesaian minggu ini)');
    }
    console.log('---------------------------\n');
  }

  startReminder() {
    if (this.reminderTimer) return;
    this.reminderTimer = setInterval(() => {
      this.showReminder();
    }, REMINDER_INTERVAL);
  }

  showReminder() {
    // show reminder of active habits
    const active = this.habits.filter(h => !h.isCompletedThisWeek());
    if (active.length === 0) {
      console.log('\n[Reminder] Semua habit sudah tercapai minggu ini 🎉\n');
    } else {
      console.log('\n[Reminder] Kamu punya kebiasaan yang belum mencapai target minggu ini:');
      active.forEach((h, i) => {
        console.log(` - ${h.name}: ${h.getThisWeekCompletions().length}/${h.targetFrequency}`);
      });
      console.log('👉 Ketik nomor menu untuk menandai selesai atau lihat detail.\n');
    }
  }

  stopReminder() {
    if (this.reminderTimer) {
      clearInterval(this.reminderTimer);
      this.reminderTimer = null;
    }
  }

  saveToFile() {
    const payload = {
      user: this.user,
      habits: this.habits
    };
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (err) {
      console.error('Gagal menyimpan data:', err.message);
    }
  }

  loadFromFile() {
    try {
      if (!fs.existsSync(DATA_FILE)) {
        // initialize default file
        this.saveToFile();
        return;
      }
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      // restore user
      this.user = parsed.user ?? this.user;
      // restore habits (map to Habit instances)
      this.habits = (parsed.habits ?? []).map(h => {
        const habit = new Habit(h.name, h.targetFrequency ?? 0);
        habit.id = h.id ?? habit.id;
        habit.completions = h.completions ?? [];
        habit.createdAt = h.createdAt ?? habit.createdAt;
        return habit;
      });
      this.user.updateStats(this.habits);
    } catch (err) {
      console.error('Gagal memuat data:', err.message);
    }
  }

  clearAllData() {
    this.habits = [];
    this.user = UserProfile;
    this.user.createdAt = new Date().toISOString();
    this.user.updateStats(this.habits);
    this.saveToFile();
  }
}

// ---------- CLI Menu ----------
function displayMenu() {
  console.log('\n====== HABIT TRACKER MENU ======');
  console.log('0. Lihat Profil');
  console.log('1. Lihat Semua Kebiasaan');
  console.log('2. Lihat Kebiasaan Aktif');
  console.log('3. Lihat Kebiasaan Selesai');
  console.log('4. Tambah Kebiasaan Baru');
  console.log('5. Tandai Kebiasaan Selesai (hari ini)');
  console.log('6. Hapus Kebiasaan');
  console.log('7. Lihat Statistik');
  console.log('8. Demo Loop (while & for)');
  console.log('9. Keluar');
  console.log('=================================\n');
}

async function handleMenu(tracker) {
  tracker.startReminder();
  let exit = false;
  while (!exit) {
    displayMenu();
    const choice = await askQuestion('Pilih menu (0-9): ');
    switch (choice.trim()) {
      case '0':
        tracker.displayProfile();
        break;
      case '1':
        tracker.displayHabits('all');
        break;
      case '2':
        tracker.displayHabits('active');
        break;
      case '3':
        tracker.displayHabits('completed');
        break;
      case '4': {
        const name = await askQuestion('Nama kebiasaan: ');
        const freq = await askQuestion('Target per minggu (angka): ');
        const parsed = Number(freq);
        if (!name.trim() || Number.isNaN(parsed) || parsed < 0) {
          console.log('Input tidak valid. Pastikan nama tidak kosong dan target angka >= 0.');
        } else {
          const h = tracker.addHabit(name.trim(), parsed);
          console.log(`Kebiasaan ditambahkan: ${h.name} (target ${h.targetFrequency}/minggu)`);
        }
        break;
      }
      case '5': {
        tracker.displayHabits('all');
        const idx = await askQuestion('Masukkan index kebiasaan yang ingin ditandai selesai hari ini: ');
        const res = tracker.completeHabit(idx);
        if (res.error) {
          console.log('Error:', res.error);
        } else {
          if (res.added) console.log(`Berhasil menandai "${res.habit.name}" selesai untuk hari ini.`);
          else console.log('Sudah ditandai selesai untuk hari ini (tidak ada perubahan).');
        }
        break;
      }
      case '6': {
        tracker.displayHabits('all');
        const idx = await askQuestion('Masukkan index kebiasaan yang ingin dihapus: ');
        const ok = tracker.deleteHabit(idx);
        console.log(ok ? 'Habit dihapus.' : 'Index tidak valid.');
        break;
      }
      case '7':
        tracker.displayStats();
        break;
      case '8':
        console.log('\n-- Demo While --');
        tracker.displayHabitsWithWhile();
        console.log('-- Demo For --');
        tracker.displayHabitsWithFor();
        break;
      case '9':
        console.log('Keluar... Menyimpan data dan menghentikan reminder.');
        tracker.stopReminder();
        tracker.saveToFile();
        exit = true;
        break;
      default:
        console.log('Pilihan tidak dikenal. Masukkan angka 0-9.');
    }
  }
  rl.close();
}

// ---------- Main ----------
async function main() {
  console.clear();
  console.log('===================================');
  console.log('   SELAMAT DATANG - HABIT TRACKER   ');
  console.log('===================================\n');

  const tracker = new HabitTracker();

  // optional demo data if file empty
  if (tracker.habits.length === 0) {
    tracker.addHabit('Belajar coding', 5);
    tracker.addHabit('Membaca buku', 3);
    // mark some completions (for demo)
    tracker.habits[0].markComplete(new Date()); // today
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    tracker.habits[0].markComplete(yesterday);
    tracker.saveToFile();
  }

  // run CLI loop
  await handleMenu(tracker);
}

main().catch(err => {
  console.error('Fatal error:', err);
  rl.close();
});
