// کارتابل بررسی طرح درس اساتید (معاون آموزش) — Alpine.js (نسخهٔ سازگار با CSP)
import Alpine from '@alpinejs/csp';
import { request, toFa } from './lib/pageApi.js';

const STATES = {
  pending: { label: 'در انتظار بررسی', cls: 'bg-slate-100 text-slate-700 border-slate-300' },
  revision: { label: 'نیاز به اصلاح', cls: 'bg-amber-50 text-amber-800 border-amber-300' },
  approved: { label: 'تأییدشده', cls: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
};

const TAG_TONES = {
  emerald: { on: 'border-emerald-600 bg-emerald-600 text-white', off: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  sky: { on: 'border-sky-600 bg-sky-600 text-white', off: 'border-sky-200 bg-sky-50 text-sky-800' },
  orange: { on: 'border-orange-500 bg-orange-500 text-white', off: 'border-orange-200 bg-orange-50 text-orange-800' },
  amber: { on: 'border-amber-500 bg-amber-500 text-white', off: 'border-amber-200 bg-amber-50 text-amber-800' },
};

Alpine.data('lessonReview', () => ({
  config: JSON.parse(document.getElementById('review-config').textContent),
  plans: [],
  filter: 'all',
  openId: '',
  picked: [],
  note: '',
  loading: true,
  busy: false,
  error: '',
  toast: '',
  toastTimer: null,

  async init() {
    await this.load();
  },

  async load() {
    this.loading = true;
    this.error = '';
    try {
      this.plans = (await request('/api/lesson-plan-review')).plans;
    } catch (err) {
      if (err.message !== 'auth') this.error = err.message;
    } finally {
      this.loading = false;
    }
  },

  // ---------- آمار و فیلتر ----------
  countOf(state) { return this.plans.filter((p) => p.state === state).length; },
  get pendingCount() { return toFa(this.countOf('pending')); },
  get revisionCount() { return toFa(this.countOf('revision')); },
  get approvedCount() { return toFa(this.countOf('approved')); },
  get shown() { return this.filter === 'all' ? this.plans : this.plans.filter((p) => p.state === this.filter); },
  get isEmpty() { return !this.loading && this.shown.length === 0; },
  get hasError() { return this.error !== ''; },
  setFilter(key) { this.filter = this.filter === key ? 'all' : key; },
  statClass(key) {
    return this.filter === key ? 'ring-2 ring-emerald-500 border-emerald-300' : 'border-slate-200';
  },
  chipClass(key) {
    return this.filter === key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200';
  },
  stateLabel(p) { return STATES[p.state].label; },
  stateClass(p) { return STATES[p.state].cls; },
  sentText(p) { return p.sentAt ? toFa(p.sentAt) : '—'; },
  planDate(p) { return toFa(p.date); },
  cardTitle(p) { return p.mainTopic || p.subject; },

  // ---------- مودال ----------
  get current() { return this.plans.find((p) => p.id === this.openId); },
  get hasCurrent() { return Boolean(this.current); },
  get notFinal() { return !this.isFinal; },
  get currentTeacher() { return this.hasCurrent ? this.current.teacherName : ''; },
  get isFinal() { return this.hasCurrent && this.current.state === 'approved'; },
  get canAct() { return this.hasCurrent && !this.busy && this.current.state !== 'approved'; },
  get cannotAct() { return !this.canAct; },
  get canReturn() { return this.canAct && (this.picked.length > 0 || this.note.trim() !== ''); },
  get cannotReturn() { return !this.canReturn; },
  get currentSubtitle() {
    const p = this.current;
    return p ? `${p.subject} · ${p.className} · ${toFa(p.date)}` : '';
  },
  get topicText() {
    const p = this.current;
    return p ? [p.mainTopic, p.subTopic].filter(Boolean).join(' — ') : '';
  },
  get objectiveGroups() {
    const o = this.current ? this.current.objectives : {};
    return [
      { key: 'cognitive', title: 'شناختی', items: o.cognitive || [] },
      { key: 'affective', title: 'عاطفی', items: o.affective || [] },
      { key: 'psychomotor', title: 'مهارتی', items: o.psychomotor || [] },
    ].filter((g) => g.items.length > 0);
  },
  get methodsText() { return this.current ? this.current.methods.join('، ') : ''; },
  get hasMethods() { return this.hasCurrent && this.current.methods.length > 0; },
  get steps() { return this.current ? this.current.scenario.filter((s) => s.description) : []; },
  get hasSteps() { return this.steps.length > 0; },
  stepMinutes(s) { return s.minutes ? `${toFa(s.minutes)} دقیقه` : ''; },
  get evalRows() {
    const e = this.current ? this.current.evaluation : {};
    return [
      { key: 'initial', title: 'ارزشیابی آغازین', text: e.initial },
      { key: 'process', title: 'ارزشیابی فرایندی', text: e.process },
      { key: 'final', title: 'ارزشیابی پایانی', text: e.final },
    ].filter((r) => r.text);
  },
  get previousFeedback() {
    return this.hasCurrent && this.current.review ? this.current.review.feedback : '';
  },
  get hasPreviousFeedback() { return this.previousFeedback !== ''; },

  open(p) {
    this.openId = p.id;
    this.picked = p.review ? [...p.review.tags] : [];
    this.note = p.review ? p.review.note : '';
  },
  close() { this.openId = ''; },

  // ---------- برچسب‌ها و یادداشت ----------
  get tags() { return this.config.tags; },
  tagOn(key) { return this.picked.includes(key); },
  toggleTag(key) {
    this.picked = this.tagOn(key) ? this.picked.filter((k) => k !== key) : [...this.picked, key];
  },
  tagClass(tag) {
    const t = TAG_TONES[tag.tone];
    return this.tagOn(tag.key) ? `${t.on} shadow-sm` : t.off;
  },
  setNote(e) { this.note = e.target.value; },

  // ---------- اقدام ----------
  get approveLabel() { return `✅ تایید و ارسال پاداش (${toFa(this.config.approvePoints)}+ امتیاز)`; },
  async approve() { await this.submit('approve'); },
  async sendBack() { await this.submit('return'); },
  async submit(action) {
    if (!this.hasCurrent || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const res = await request(`/api/lesson-plan-review/${encodeURIComponent(this.openId)}`, {
        method: 'POST',
        body: JSON.stringify({ action, tags: this.picked, note: this.note.trim() }),
      });
      this.say(action === 'approve'
        ? (res.awarded ? `طرح تأیید شد؛ ${toFa(res.awarded)} امتیاز پاداش برای استاد ثبت شد.` : 'طرح تأیید شد.')
        : 'طرح برای اصلاح به استاد ارجاع شد.');
      this.close();
      await this.load();
    } catch (err) {
      if (err.message !== 'auth') this.error = err.message;
    } finally {
      this.busy = false;
    }
  },
  say(msg) {
    this.toast = msg;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.toast = ''; }, 4000);
  },
  get hasToast() { return this.toast !== ''; },
}));

window.Alpine = Alpine;
Alpine.start();
