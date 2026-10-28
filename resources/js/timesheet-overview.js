// نمای مدیریتی تایم‌شیت و خودارزیابی اساتید — Alpine.js (نسخهٔ سازگار با CSP)
import Alpine from '@alpinejs/csp';
import { request, toFa } from './lib/pageApi.js';

const fmt = (h) => toFa((Math.round(h * 100) / 100).toString()).replace('.', '٫');

Alpine.data('timesheetOverview', () => ({
  config: JSON.parse(document.getElementById('overview-config').textContent),
  monthKey: '',
  teachers: [],
  summary: null,
  prevSummary: null,
  prevLabel: '',
  openId: '',
  loading: true,
  error: '',
  editing: false,
  draft: [],
  axesError: '',
  axesSaving: false,
  axesMsg: '',
  seq: 0,

  async init() {
    this.monthKey = this.config.months[0].key;
    await this.load();
  },
  get months() { return this.config.months; },
  get axes() { return this.config.axes; },
  get canEdit() { return !!this.config.canEditAxes; },
  get isEditing() { return this.editing; },
  get notEditing() { return !this.editing; },
  get axesCountText() { return toFa(this.axes.length); },
  get draftFull() { return this.draft.length >= 12; },
  get hasAxesError() { return this.axesError !== ''; },
  get hasAxesMsg() { return this.axesMsg !== ''; },
  get axesDisabled() { return this.axesSaving; },
  get saveLabel() { return this.axesSaving ? 'در حال ذخیره…' : 'ذخیره شاخص‌ها'; },
  startEdit() {
    this.draft = this.axes.map((a) => ({ k: `k${++this.seq}`, id: a.id, title: a.title }));
    this.axesError = '';
    this.axesMsg = '';
    this.editing = true;
  },
  cancelEdit() { this.editing = false; this.axesError = ''; },
  addAxisRow() {
    if (this.draftFull) return;
    this.draft = [...this.draft, { k: `k${++this.seq}`, id: null, title: '' }];
  },
  removeAxis(k) { this.draft = this.draft.filter((a) => a.k !== k); },
  setAxisTitle(k, e) { this.draft = this.draft.map((a) => (a.k === k ? { ...a, title: e.target.value } : a)); },
  moveAxis(k, dir) {
    const i = this.draft.findIndex((a) => a.k === k);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= this.draft.length) return;
    const next = [...this.draft];
    [next[i], next[j]] = [next[j], next[i]];
    this.draft = next;
  },
  moveUp(k) { this.moveAxis(k, -1); },
  moveDown(k) { this.moveAxis(k, 1); },
  axisNo(index) { return toFa(index + 1); },
  async saveAxes() {
    const axes = this.draft.map((a) => ({ id: a.id, title: a.title.trim() }));
    if (axes.length === 0) { this.axesError = 'حداقل یک شاخص لازم است.'; return; }
    if (axes.some((a) => a.title.length < 2)) { this.axesError = 'عنوان همه‌ی شاخص‌ها را بنویسید.'; return; }
    this.axesSaving = true;
    this.axesError = '';
    try {
      const res = await request('/api/teacher-timesheet/axes', { method: 'PUT', body: JSON.stringify({ axes }) });
      this.config.axes = res.axes;
      this.editing = false;
      this.axesMsg = 'شاخص‌ها ذخیره شد ✓';
      await this.load();
    } catch (err) {
      if (err.message !== 'auth') this.axesError = err.message;
    } finally {
      this.axesSaving = false;
    }
  },
  isMonth(key) { return key === this.monthKey; },
  async changeMonth(e) {
    this.monthKey = e.target.value;
    this.openId = '';
    await this.load();
  },
  async load() {
    this.loading = true;
    this.error = '';
    try {
      const data = await request(`/api/teacher-timesheets?month=${encodeURIComponent(this.monthKey)}`);
      this.teachers = data.teachers;
      this.summary = data.summary;
      this.prevSummary = data.prevSummary;
      this.prevLabel = data.prevLabel || '';
    } catch (err) {
      if (err.message !== 'auth') this.error = err.message;
    } finally {
      this.loading = false;
    }
  },
  // ---------- خلاصهٔ ماه و مقایسه با ماه قبل ----------
  delta(cur, prev, unit, digits) {
    if (prev === null || prev === undefined || cur === null || cur === undefined) return { text: '', cls: 'text-slate-400' };
    const d = Math.round((cur - prev) * 10 ** digits) / 10 ** digits;
    if (d === 0) return { text: 'بدون تغییر', cls: 'text-slate-400' };
    const txt = `${d > 0 ? '▲' : '▼'} ${toFa(Math.abs(d).toString().replace('.', '٫'))}${unit}`;
    return { text: txt, cls: d > 0 ? 'text-emerald-600' : 'text-rose-600' };
  },
  get cards() {
    const s = this.summary;
    const p = this.prevSummary;
    if (!s) return [];
    const mk = (key, label, value, cur, prev, unit, digits) => ({ key, label, value, ...(() => { const d = this.delta(cur, prev, unit, digits); return { deltaText: d.text, deltaClass: d.cls }; })() });
    return [
      mk('hours', 'مجموع ساعات', fmt(s.hours), s.hours, p?.hours, ' ساعت', 1),
      mk('submitted', 'دارای ساعت ثبت‌شده', `${toFa(s.submitted)} از ${toFa(s.teachers)}`, s.submitted, p?.submitted, ' نفر', 0),
      mk('avg', 'میانگین ساعت هر استاد', fmt(s.avgHours), s.avgHours, p?.avgHours, ' ساعت', 1),
      mk('score', 'میانگین خودارزیابی', s.scorePct === null ? '—' : `${toFa(s.scorePct.toString().replace('.', '٫'))}٪`, s.scorePct, p?.scorePct, '٪', 1),
    ];
  },
  get hasPrev() { return this.prevSummary !== null; },
  get prevNote() { return this.prevLabel ? `مقایسه با ${this.prevLabel}` : ''; },
  teacherDelta(t) { return this.delta(t.hours, t.prevHours, ' ساعت', 1).text; },
  teacherDeltaClass(t) { return this.delta(t.hours, t.prevHours, ' ساعت', 1).cls; },
  get hasError() { return this.error !== ''; },
  get isEmpty() { return !this.loading && this.teachers.length === 0; },
  get totalText() { return fmt(this.teachers.reduce((s, t) => s + t.hours, 0)); },
  get teacherCount() { return toFa(this.teachers.length); },
  get submittedCount() { return toFa(this.teachers.filter((t) => t.days > 0).length); },
  hoursText(t) { return t.days ? fmt(t.hours) : '—'; },
  daysText(t) { return toFa(t.days); },
  scoreText(t) { return t.hasEval ? `${toFa(t.scoreTotal)} / ${toFa(t.scoreMax)}` : '—'; },
  barStyle(t) { return `width:${Math.min(100, (t.scoreTotal / t.scoreMax) * 100)}%`; },
  isOpen(t) { return this.openId === t.id; },
  toggle(t) { this.openId = this.openId === t.id ? '' : t.id; },
  axisScore(t, axis) { return toFa(t.scores[axis.id] || 0); },
  hasCustom(t) { return t.custom.length > 0; },
  customScore(c) { return toFa(c.score); },
  hasNote(t) { return t.extraNote !== ''; },
}));

window.Alpine = Alpine;
Alpine.start();
