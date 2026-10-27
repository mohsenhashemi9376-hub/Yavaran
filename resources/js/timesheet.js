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

/** دقیقهٔ یک نوبت (ورود/خروج)؛ null اگر ناقص یا نامعتبر باشد */
const spanMinutes = (inT, outT) => {
  const a = toMinutes(inT);
  const b = toMinutes(outT);
  return a === null || b === null || b <= a ? null : b - a;
};

const pad = (n) => String(n).padStart(2, '0');

/** اجزای زمان به وقت تهران، مستقل از ساعت و منطقهٔ زمانی دستگاه */
const TEHRAN = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const tehranParts = (d) => Object.fromEntries(TEHRAN.formatToParts(d).map((p) => [p.type, p.value]));
const isoOf = (d) => { const p = tehranParts(d); return `${p.year}-${p.month}-${p.day}`; };
const hmOf = (d) => { const p = tehranParts(d); return `${p.hour}:${p.minute}`; };
const secOf = (d) => Number(tehranParts(d).second);

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const FIELD_LABELS = { in: 'ورود', out: 'خروج', in2: 'ورود دوم', out2: 'خروج دوم' };

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
  /** اختلاف ساعت سرور با دستگاه (میلی‌ثانیه)؛ ساعت اشتباه دستگاه روی ثبت اثر نمی‌گذارد */
  offset: 0,
  picker: { open: false, date: '', field: '', h: 8, m: 0 },
  hours: HOURS,
  minutes: MINUTES,

  async init() {
    // ساعت زنده: هر ثانیه
    if (this.config.serverNow) this.offset = this.config.serverNow - Date.now();
    this.now = new Date(Date.now() + this.offset);
    setInterval(() => { this.now = new Date(Date.now() + this.offset); }, 1000);
    // ماه جاری؛ اگر امروز خارج از سال تحصیلی باشد، نزدیک‌ترین ماه
    const today = isoOf(this.now);
    const hit = this.months.find((m) => m.days.some((d) => d.g === today));
    this.monthKey = (hit || (today < this.months[0].days[0].g ? this.months[0] : this.months[this.months.length - 1])).key;
    await this.load();
    // با ورود به صفحه، روز جاری را نشان بده
    this.$nextTick(() => this.scrollToToday());
    window.addEventListener('beforeunload', () => { if (this.dirty) this.save(); });
  },

  dayId(day) { return `day-${day.date}`; },
  scrollToToday() {
    if (!this.hasToday) return;
    const el = document.getElementById(this.dayId(this.todayDay));
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  },

  // ---------- ساعت زنده ----------
  get clockHM() { return toFa(hmOf(this.now)); },
  get clockSec() { return toFa(pad(secOf(this.now))); },
  get ringOffset() { return 276.5 * (1 - secOf(this.now) / 60); },
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
  fieldValue(date, field) { return this.entry(date)[field] || ''; },
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

  // ---------- انتخابگر ساعت (جایگزین فیلد ساعت ویندوز/مرورگر) ----------
  get sessionRows() {
    return [
      { key: 'a', fields: [{ id: 'in', label: FIELD_LABELS.in }, { id: 'out', label: FIELD_LABELS.out }] },
      { key: 'b', fields: [{ id: 'in2', label: FIELD_LABELS.in2 }, { id: 'out2', label: FIELD_LABELS.out2 }] },
    ];
  },
  rowClass2(row) { return row.key === 'b' ? 'md:border-s md:border-slate-200 md:ps-3' : ''; },
  rowVisible(date, row) { return row.key === 'a' || this.hasSecond(date); },
  fieldText(date, field) { const v = this.fieldValue(date, field); return v ? toFa(v) : '--:--'; },
  fieldFilled(date, field) { return Boolean(this.fieldValue(date, field)); },
  fieldBtnClass(date, field) {
    return this.fieldFilled(date, field)
      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
      : 'border-slate-200 bg-slate-50 text-slate-400';
  },
  openPicker(date, field) {
    const cur = toMinutes(this.fieldValue(date, field));
    const base = cur !== null ? cur : toMinutes(hmOf(new Date(Date.now() + this.offset)));
    this.picker = { open: true, date, field, h: Math.floor(base / 60), m: base % 60 };
  },
  closePicker() { this.picker = { ...this.picker, open: false }; },
  get pickerTitle() { return FIELD_LABELS[this.picker.field] || ''; },
  get pickerText() { return toFa(`${pad(this.picker.h)}:${pad(this.picker.m)}`); },
  hourText(h) { return toFa(pad(h)); },
  minuteText(m) { return toFa(pad(m)); },
  pickHour(h) { this.picker = { ...this.picker, h }; },
  pickMinute(m) { this.picker = { ...this.picker, m }; },
  nudge(delta) {
    const t = (((this.picker.h * 60 + this.picker.m + delta) % 1440) + 1440) % 1440;
    this.picker = { ...this.picker, h: Math.floor(t / 60), m: t % 60 };
  },
  nudgeUp() { this.nudge(1); },
  nudgeDown() { this.nudge(-1); },
  pickNow() {
    const t = toMinutes(hmOf(new Date(Date.now() + this.offset)));
    this.picker = { ...this.picker, h: Math.floor(t / 60), m: t % 60 };
  },
  hourClass(h) { return this.picker.h === h ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 active:bg-slate-200'; },
  minuteClass(m) { return this.picker.m === m ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 active:bg-slate-200'; },
  applyPicker() {
    const { date, field, h, m } = this.picker;
    this.entries = { ...this.entries, [date]: { ...this.entry(date), [field]: `${pad(h)}:${pad(m)}` } };
    this.touch();
    this.closePicker();
  },
  clearPickerValue() {
    const { date, field } = this.picker;
    this.entries = { ...this.entries, [date]: { ...this.entry(date), [field]: '' } };
    this.touch();
    this.closePicker();
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

  /** نوبت دوم (ورود دوم و خروج دوم) وقتی نمایش داده می‌شود که نوبت اول کامل یا نوبت دوم شروع شده باشد */
  hasSecond(date) {
    const e = this.entry(date);
    return Boolean(e.in2 || e.out2 || (e.in && e.out));
  },
  /** ساعت کارکرد یک روز (اعشاری)، مجموع نوبت اول و دوم؛ null اگر هیچ نوبت معتبری نباشد */
  dayHours(date) {
    const e = this.entry(date);
    const m1 = spanMinutes(e.in, e.out);
    const m2 = spanMinutes(e.in2, e.out2);
    if (m1 === null && m2 === null) return null;
    return ((m1 || 0) + (m2 || 0)) / 60;
  },
  hasHours(date) { return this.dayHours(date) !== null; },
  isInvalid(date) {
    const e = this.entry(date);
    const bad = (x, y) => toMinutes(x) !== null && toMinutes(y) !== null && toMinutes(y) <= toMinutes(x);
    // نوبت دوم باید بعد از خروج اول شروع شود
    const overlap = toMinutes(e.out) !== null && toMinutes(e.in2) !== null && toMinutes(e.in2) < toMinutes(e.out);
    return bad(e.in, e.out) || bad(e.in2, e.out2) || overlap;
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
  /** idle: بدون ثبت، working: ورود اول، between: خروج اول، working2: ورود دوم، done: خروج دوم (پایان روز) */
  get punchState() {
    const e = this.hasToday ? this.entry(this.todayDate) : {};
    if (e.out2) return 'done';
    if (e.in2) return 'working2';
    if (e.out) return 'between';
    return e.in ? 'working' : 'idle';
  },
  isPunch(name) { return this.punchState === name; },
  get isNotDone() { return this.punchState !== 'done'; },
  get isPunchWorking() { return this.punchState === 'working' || this.punchState === 'working2'; },
  get punchLabel() {
    return {
      idle: 'ثبت ورود به مدرسه',
      working: 'ثبت خروج',
      between: 'ثبت ورود دوم',
      working2: 'ثبت خروج دوم',
      done: 'پایان روز',
    }[this.punchState];
  },
  get punchBtnClass() {
    return this.isPunchWorking
      ? 'bg-rose-500 shadow-rose-900/30'
      : 'bg-emerald-500 shadow-emerald-900/30';
  },
  /** نوبت‌های امروز برای نمایش در داشبورد */
  get todaySessions() {
    if (!this.hasToday) return [];
    const e = this.entry(this.todayDate);
    const rows = [];
    if (e.in) rows.push({ key: 's1', label: 'نوبت اول', inText: toFa(e.in), outText: e.out ? toFa(e.out) : '…' });
    if (e.in2) rows.push({ key: 's2', label: 'نوبت دوم', inText: toFa(e.in2), outText: e.out2 ? toFa(e.out2) : '…' });
    return rows;
  },
  get hasSessions() { return this.todaySessions.length > 0; },
  get todayLabel() { return this.hasToday ? `${this.todayDay.weekday} ${this.todayDay.label}` : ''; },
  get todayHoursText() { return this.hasToday ? this.dayHoursText(this.todayDate) : '—'; },
  get canPunch() { return this.hasToday && !this.todayOff && !this.loading; },
  get cannotPunch() { return !this.canPunch; },

  async punch() {
    this.punchError = '';
    if (!this.canPunch) return;
    const date = this.todayDate;
    const hm = hmOf(new Date(Date.now() + this.offset));
    const m = toMinutes(hm);
    const e = this.entry(date);
    if (!e.in) {
      this.entries = { ...this.entries, [date]: { ...e, in: hm, tags: e.tags && e.tags.length ? e.tags : [DEFAULT_TAG] } };
    } else if (!e.out) {
      if (m <= toMinutes(e.in)) { this.punchError = 'خروج باید دست‌کم یک دقیقه بعد از ورود باشد.'; return; }
      this.entries = { ...this.entries, [date]: { ...e, out: hm } };
    } else if (!e.in2) {
      if (m < toMinutes(e.out)) { this.punchError = 'ورود دوم باید بعد از خروج اول باشد.'; return; }
      this.entries = { ...this.entries, [date]: { ...e, in2: hm } };
    } else if (!e.out2) {
      if (m <= toMinutes(e.in2)) { this.punchError = 'خروج دوم باید دست‌کم یک دقیقه بعد از ورود دوم باشد.'; return; }
      this.entries = { ...this.entries, [date]: { ...e, out2: hm } };
    } else {
      return;
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
        if (e.in || e.out || e.in2 || e.out2 || (e.tags || []).length) {
          const tags = e.tags || [];
          entries[d.date] = {
            in: e.in || null,
            out: e.out || null,
            in2: e.in2 || null,
            out2: e.out2 || null,
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
