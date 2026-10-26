// ساعت کاری و خودارزیابی اساتید — Alpine.js (نسخهٔ سازگار با CSP)
import Alpine from '@alpinejs/csp';
import { request, toFa } from './lib/pageApi.js';

/** ساعت اعشاری با ممیز فارسی: ۶٫۵ */
const fmtHours = (h) => toFa((Math.round(h * 100) / 100).toString()).replace('.', '٫');

const toMinutes = (t) => {
  if (!/^\d{2}:\d{2}$/.test(t || '')) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const DEFAULT_TAG = 'teaching';

const pad = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hmOf = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

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
  punchError: '',
  timer: null,
  now: new Date(),

  async init() {
    // ساعت زنده: هر ثانیه
    setInterval(() => { this.now = new Date(); }, 1000);
    // ماه جاری؛ اگر امروز خارج از سال تحصیلی باشد، نزدیک‌ترین ماه
    const today = isoOf(this.now);
    const hit = this.months.find((m) => m.days.some((d) => d.g === today));
    this.monthKey = (hit || (today < this.months[0].days[0].g ? this.months[0] : this.months[this.months.length - 1])).key;
    await this.load();
    window.addEventListener('beforeunload', () => { if (this.dirty) this.save(); });
  },

  // ---------- ساعت زنده ----------
  get clockHM() { return toFa(hmOf(this.now)); },
  get clockSec() { return toFa(pad(this.now.getSeconds())); },
  get ringOffset() { return 276.5 * (1 - this.now.getSeconds() / 60); },
  get todayIso() { return isoOf(this.now); },

  // ---------- ماه و تب ----------
  get months() { return this.config.months; },
  get month() { return this.months.find((m) => m.key === this.monthKey); },
  get days() { return this.month.days; },
  get axes() { return this.config.axes; },
  get tagList() { return Object.entries(this.config.tags).map(([key, label]) => ({ key, label })); },
  isMonth(key) { return key === this.monthKey; },
  isTab(name) { return this.tab === name; },
  setTab(name) { this.tab = name; },
  tabClass(name) {
    return this.tab === name
      ? 'bg-emerald-600 text-white shadow-sm'
      : 'text-slate-600 hover:bg-slate-100';
  },

  async changeMonth(e) {
    await this.goMonth(e.target.value);
  },
  async goMonth(key) {
    if (this.dirty) await this.save();
    this.monthKey = key;
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

  // ---------- روزها ----------
  entry(date) { return this.entries[date] || {}; },
  valueOf(date, field) { return this.entry(date)[field] || ''; },
  isToday(day) { return day.g === this.todayIso; },
  isOff(day) { return day.off; },
  isWorking(day) { return !day.off; },
  /** روز آینده (بعد از امروز): غیرفعال و بدون نیاز به ثبت */
  isFuture(day) { return day.g > this.todayIso; },
  isFutureWorking(day) { return !day.off && this.isFuture(day); },
  /** فقط روزهای کاری گذشته و امروز قابل ویرایش‌اند */
  isOpen(day) { return !day.off && !this.isFuture(day); },
  isLocked(day) { return day.off || this.isFuture(day); },
  setField(date, field, e) {
    this.entries = { ...this.entries, [date]: { ...this.entry(date), [field]: e.target.value } };
    this.touch();
  },

  // ---------- تگ‌های فعالیت ----------
  tagsOf(date) { return this.entry(date).tags || []; },
  hasTag(date, key) { return this.tagsOf(date).includes(key); },
  toggleTag(date, key) {
    const cur = this.tagsOf(date);
    const tags = cur.includes(key) ? cur.filter((t) => t !== key) : [...cur, key];
    this.entries = { ...this.entries, [date]: { ...this.entry(date), tags } };
    this.touch();
  },
  hasOther(date) { return this.hasTag(date, 'other'); },
  otherText(date) { return this.entry(date).otherText || ''; },
  setOtherText(date, e) {
    this.entries = { ...this.entries, [date]: { ...this.entry(date), otherText: e.target.value } };
    this.touch();
  },
  tagClass(date, key) {
    return this.hasTag(date, key)
      ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
      : 'border-slate-200 bg-white text-slate-600 active:bg-slate-100';
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
    if (day.off) return 'border-slate-200 bg-slate-100 opacity-60 grayscale';
    if (this.isFuture(day)) return 'border-slate-200 bg-slate-50 opacity-50';
    if (this.isToday(day)) return 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200';
    if (this.isInvalid(day.date)) return 'border-rose-300 bg-rose-50';
    return this.hasHours(day.date) ? 'border-emerald-200 bg-white' : 'border-slate-200 bg-white';
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
  get workDaysCount() { return toFa(this.days.filter((d) => this.isOpen(d)).length); },
  get averageText() {
    const n = this.days.filter((d) => this.hasHours(d.date)).length;
    return n ? fmtHours(this.totalHours / n) : '—';
  },

  // ---------- پانچ سریع ----------
  get todayDay() { return this.days.find((d) => this.isToday(d)); },
  get hasToday() { return Boolean(this.todayDay); },
  get todayOff() { return this.hasToday && this.todayDay.off; },
  get todayDate() { return this.hasToday ? this.todayDay.date : ''; },
  /** idle: ثبت نشده، working: ورود زده، done: پایان روز */
  get punchState() {
    const e = this.hasToday ? this.entry(this.todayDate) : {};
    if (e.in && e.out) return 'done';
    return e.in ? 'working' : 'idle';
  },
  isPunch(name) { return this.punchState === name; },
  get todayInText() { return this.hasToday ? toFa(this.entry(this.todayDate).in || '') : ''; },
  get todayOutText() { return this.hasToday ? toFa(this.entry(this.todayDate).out || '') : ''; },
  get todayHoursText() { return this.hasToday ? this.dayHoursText(this.todayDate) : '—'; },
  get canPunch() { return this.hasToday && !this.todayOff && !this.loading; },
  get cannotPunch() { return !this.canPunch; },

  async punch() {
    this.punchError = '';
    if (!this.canPunch) return;
    // اگر امروز در ماه دیگری از ماه نمایش‌داده‌شده است، اول به آن ماه می‌رویم
    const date = this.todayDate;
    const hm = hmOf(new Date());
    const e = this.entry(date);
    if (!e.in) {
      this.entries = { ...this.entries, [date]: { ...e, in: hm, tags: e.tags && e.tags.length ? e.tags : [DEFAULT_TAG] } };
    } else if (!e.out) {
      if (toMinutes(hm) <= toMinutes(e.in)) {
        this.punchError = 'خروج باید دست‌کم یک دقیقه بعد از ورود باشد.';
        return;
      }
      this.entries = { ...this.entries, [date]: { ...e, out: hm } };
    }
    this.touch();
    await this.save();
  },
  async goToday() {
    const m = this.months.find((x) => x.days.some((d) => d.g === this.todayIso));
    if (m && m.key !== this.monthKey) await this.goMonth(m.key);
  },
  get todayInOtherMonth() {
    const m = this.months.find((x) => x.days.some((d) => d.g === this.todayIso));
    return Boolean(m) && m.key !== this.monthKey;
  },
  get todayOutsideYear() {
    return !this.months.some((x) => x.days.some((d) => d.g === this.todayIso));
  },
  get punchHint() {
    if (this.todayOutsideYear) return 'امروز در بازهٔ سال تحصیلی ۱۴۰۵-۱۴۰۶ نیست.';
    if (this.todayInOtherMonth) return 'ماه امروز را از فهرست انتخاب کنید یا دکمهٔ زیر را بزنید.';
    if (this.todayOff) return 'امروز تعطیل است.';
    return '';
  },
  get hasHint() { return this.punchHint !== ''; },

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
    if (this.saving) { this.timer = setTimeout(() => this.save(), 400); return; }
    this.saving = true;
    this.error = '';
    try {
      const entries = {};
      for (const d of this.days) {
        const e = this.entry(d.date);
        if (!this.isOpen(d)) continue;
        if (e.in || e.out || (e.tags || []).length) {
          const tags = e.tags || [];
          entries[d.date] = {
            in: e.in || null,
            out: e.out || null,
            tags,
            otherText: tags.includes('other') ? (e.otherText || '').trim() : '',
          };
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
