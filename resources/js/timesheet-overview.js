// نمای مدیریتی تایم‌شیت و خودارزیابی اساتید — Alpine.js (نسخهٔ سازگار با CSP)
import Alpine from '@alpinejs/csp';
import { request, toFa } from './lib/pageApi.js';

const fmt = (h) => toFa((Math.round(h * 100) / 100).toString()).replace('.', '٫');

Alpine.data('timesheetOverview', () => ({
  config: JSON.parse(document.getElementById('overview-config').textContent),
  monthKey: '',
  teachers: [],
  openId: '',
  loading: true,
  error: '',

  async init() {
    this.monthKey = this.config.months[0].key;
    await this.load();
  },
  get months() { return this.config.months; },
  get axes() { return this.config.axes; },
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
      this.teachers = (await request(`/api/teacher-timesheets?month=${encodeURIComponent(this.monthKey)}`)).teachers;
    } catch (err) {
      if (err.message !== 'auth') this.error = err.message;
    } finally {
      this.loading = false;
    }
  },
  get hasError() { return this.error !== ''; },
  get isEmpty() { return !this.loading && this.teachers.length === 0; },
  get totalText() { return fmt(this.teachers.reduce((s, t) => s + t.hours, 0)); },
  get teacherCount() { return toFa(this.teachers.length); },
  get submittedCount() { return toFa(this.teachers.filter((t) => t.days > 0).length); },
  hoursText(t) { return t.days ? fmt(t.hours) : '—'; },
  daysText(t) { return toFa(t.days); },
  scoreText(t) { return t.hasEval ? `${toFa(t.scoreTotal)} / ${toFa(this.axes.length * 5)}` : '—'; },
  barStyle(t) { return `width:${Math.min(100, (t.scoreTotal / (this.axes.length * 5)) * 100)}%`; },
  isOpen(t) { return this.openId === t.id; },
  toggle(t) { this.openId = this.openId === t.id ? '' : t.id; },
  axisScore(t, axis) { return toFa(t.scores[axis.id] || 0); },
  hasNote(t) { return t.extraNote !== ''; },
}));

window.Alpine = Alpine;
Alpine.start();
