// ساعت کاری و خودارزیابی اساتید — Alpine.js (نسخهٔ سازگار با CSP)
import Alpine from '@alpinejs/csp';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toFa = (v) => String(v).replace(/\d/g, (d) => FA_DIGITS[d]);

/** ساعت اعشاری با ممیز فارسی: ۶٫۵ */
const fmtHours = (h) => toFa((Math.round(h * 100) / 100).toString()).replace('.', '٫');

const toMinutes = (t) => {
  if (!/^\d{2}:\d{2}$/.test(t || '')) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const readXsrf = () => {
  const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
};

const request = async (url, options = {}) => {
  const res = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-XSRF-TOKEN': readXsrf(),
    },
  });
  if (res.status === 401 || res.status === 419) {
    window.location.assign('/');
    throw new Error('auth');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || 'خطا در ارتباط با سرور.');
  return body;
};

Alpine.data('timesheet', () => ({
  config: JSON.parse(document.getElementById('timesheet-config').textContent),
  tab: 'timesheet',
  monthKey: '',
  entries: {},
  scores: {},
  extraNote: '',
  stars: [1, 2, 3, 4, 5],
  loading: true,
  saving: false,
  dirty: false,
  error: '',
  savedText: '',
  timer: null,

  async init() {
    this.monthKey = this.config.months[0].key;
    await this.load();
    window.addEventListener('beforeunload', () => { if (this.dirty) this.save(); });
  },

  // ---------- ماه و تب ----------
  get months() { return this.config.months; },
  get month() { return this.months.find((m) => m.key === this.monthKey); },
  get days() { return this.month.days; },
  get axes() { return this.config.axes; },
  get yearLabel() { return this.config.academicYear; },
  isMonth(key) { return key === this.monthKey; },
  isTab(name) { return this.tab === name; },
  setTab(name) { this.tab = name; },
  tabClass(name) {
    return this.tab === name
      ? 'bg-emerald-600 text-white shadow-sm'
      : 'text-slate-600 hover:bg-slate-100';
  },

  async changeMonth(e) {
    if (this.dirty) await this.save();
    this.monthKey = e.target.value;
    await this.load();
  },

  async load() {
    this.loading = true;
    this.error = '';
    try {
      const data = await request(`/api/teacher-timesheet?month=${encodeURIComponent(this.monthKey)}`);
      this.entries = data.entries || {};
      const ev = data.selfEvaluation || {};
      this.scores = ev.scores || {};
      this.extraNote = ev.extraNote || '';
      this.dirty = false;
      this.savedText = '';
    } catch (err) {
      if (err.message !== 'auth') this.error = err.message;
    } finally {
      this.loading = false;
    }
  },

  // ---------- ثبت ساعات ----------
  entry(date) { return this.entries[date] || {}; },
  valueOf(date, field) { return this.entry(date)[field] || ''; },
  setField(date, field, e) {
    this.entries = { ...this.entries, [date]: { ...this.entry(date), [field]: e.target.value } };
    this.touch();
  },

  /** ساعت کارکرد یک روز (اعشاری)؛ null اگر ناقص یا نامعتبر باشد */
  dayHours(date) {
    const a = toMinutes(this.entry(date).in);
    const b = toMinutes(this.entry(date).out);
    if (a === null || b === null || b <= a) return null;
    return (b - a) / 60;
  },
  hasHours(date) { return this.dayHours(date) !== null; },
  isInvalid(date) {
    const a = toMinutes(this.entry(date).in);
    const b = toMinutes(this.entry(date).out);
    return a !== null && b !== null && b <= a;
  },
  dayHoursText(date) {
    const h = this.dayHours(date);
    return h === null ? '—' : fmtHours(h);
  },
  rowClass(day) {
    if (this.isInvalid(day.date)) return 'border-rose-300 bg-rose-50';
    if (this.hasHours(day.date)) return 'border-emerald-200 bg-white';
    return day.friday ? 'border-slate-200 bg-slate-100/70' : 'border-slate-200 bg-white';
  },
  badgeClass(date) {
    if (this.isInvalid(date)) return 'bg-rose-100 text-rose-700';
    return this.hasHours(date) ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400';
  },

  get totalHours() {
    return this.days.reduce((sum, d) => sum + (this.dayHours(d.date) || 0), 0);
  },
  get totalText() { return fmtHours(this.totalHours); },
  get filledDays() { return toFa(this.days.filter((d) => this.hasHours(d.date)).length); },
  get daysCount() { return toFa(this.days.length); },
  get averageText() {
    const n = this.days.filter((d) => this.hasHours(d.date)).length;
    return n ? fmtHours(this.totalHours / n) : '—';
  },

  // ---------- خودارزیابی ----------
  isExtra(axis) { return axis.id === 'extra'; },
  axisNumber(index) { return toFa(index + 1); },
  scoreOf(id) { return this.scores[id] ?? 0; },
  scoreText(id) { return toFa(this.scoreOf(id)); },
  setScore(id, n) {
    // لمس دوباره‌ی همان ستاره، امتیاز را به ۰ برمی‌گرداند
    this.scores = { ...this.scores, [id]: this.scoreOf(id) === n ? 0 : n };
    this.touch();
  },
  clearScore(id) {
    this.scores = { ...this.scores, [id]: 0 };
    this.touch();
  },
  starClass(id, n) {
    return this.scoreOf(id) >= n ? 'text-amber-400' : 'text-slate-300';
  },
  setExtraNote(e) { this.extraNote = e.target.value; this.touch(); },
  get totalScore() {
    return this.axes.reduce((sum, a) => sum + this.scoreOf(a.id), 0);
  },
  get totalScoreText() { return `${toFa(this.totalScore)} از ${toFa(this.axes.length * 5)}`; },

  // ---------- ذخیره ----------
  touch() {
    this.dirty = true;
    this.savedText = '';
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.save(), 1500);
  },
  get statusText() {
    if (this.saving) return 'در حال ذخیره…';
    if (this.error) return this.error;
    if (this.dirty) return 'ذخیره‌نشده';
    return this.savedText;
  },
  get statusClass() {
    if (this.error) return 'text-rose-600';
    return this.dirty ? 'text-amber-600' : 'text-emerald-700';
  },
  async save() {
    clearTimeout(this.timer);
    if (this.saving) return;
    this.saving = true;
    this.error = '';
    try {
      const entries = {};
      for (const d of this.days) {
        const e = this.entry(d.date);
        if (e.in || e.out || (e.note || '').trim()) {
          entries[d.date] = { in: e.in || null, out: e.out || null, note: (e.note || '').trim() };
        }
      }
      await request('/api/teacher-timesheet', {
        method: 'POST',
        body: JSON.stringify({
          month: this.monthKey,
          entries,
          selfEvaluation: { scores: this.scores, extraNote: this.extraNote },
        }),
      });
      this.dirty = false;
      this.savedText = 'ذخیره شد ✓';
    } catch (err) {
      if (err.message !== 'auth') this.error = err.message;
    } finally {
      this.saving = false;
    }
  },
}));

window.Alpine = Alpine;
Alpine.start();
