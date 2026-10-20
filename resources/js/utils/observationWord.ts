import { getTodayShamsi, toPersianDigits } from './persianDate';

export interface WordObservation {
  date: string;
  time?: string;
  categoryLabel: string;
  title: string;
  content: string;
  location?: string;
  tags?: string[];
  recordedBy?: string;
  authorLabel: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const nl = (s: string) => esc(s).replace(/\r?\n/g, '<br/>');

/**
 * خروجی Word از مشاهدات یک دانش‌آموز (فایل .doc راست‌چین؛ Word آن را مستقیم باز می‌کند و بدون وابستگی اضافه ساخته می‌شود).
 * مشاهدات به ترتیب زمان (قدیمی‌ترین ← جدیدترین) در یک خط زمانی چاپ می‌شوند.
 */
export function exportStudentObservationsWord(opts: { studentName: string; className: string; items: WordObservation[] }): void {
  const { studentName, className, items } = opts;
  const today = toPersianDigits(getTodayShamsi().displayDate);
  const sorted = [...items].sort((a, b) => `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`));

  const entries = sorted.map((o, i) => `
    <div class="entry">
      <p class="meta"><b>${toPersianDigits(i + 1)}.</b> ${esc(toPersianDigits(o.date))}${o.time ? ` · ${esc(toPersianDigits(o.time))}` : ''}
        &nbsp;|&nbsp; <span class="cat">${esc(o.categoryLabel)}</span></p>
      <p class="title">${esc(o.title)}</p>
      <p class="body">${nl(o.content)}</p>
      <p class="foot">${o.location ? `مکان: ${esc(o.location)} &nbsp;|&nbsp; ` : ''}${o.tags && o.tags.length ? `برچسب‌ها: ${esc(o.tags.map((t) => `#${t}`).join('، '))} &nbsp;|&nbsp; ` : ''}ثبت‌کننده: ${esc(o.recordedBy || o.authorLabel)}</p>
    </div>`).join('');

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40" dir="rtl" lang="fa">
<head><meta charset="utf-8"><title>مشاهدات ${esc(studentName)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  @page { size: A4; margin: 2cm; }
  body { font-family: Vazirmatn, Tahoma, 'B Nazanin', sans-serif; direction: rtl; text-align: right; color: #0f172a; }
  h1 { font-size: 20pt; margin: 0 0 4pt; color: #065f46; }
  .sub { font-size: 11pt; color: #475569; margin: 0 0 14pt; }
  table.sum { border-collapse: collapse; width: 100%; margin-bottom: 14pt; }
  table.sum td { border: 1px solid #cbd5e1; padding: 6pt 8pt; font-size: 11pt; }
  .entry { border-right: 3px solid #10b981; padding: 4pt 10pt; margin: 0 0 10pt; page-break-inside: avoid; }
  .meta { font-size: 10pt; color: #64748b; margin: 0 0 2pt; }
  .cat { color: #047857; font-weight: bold; }
  .title { font-size: 13pt; font-weight: bold; margin: 0 0 2pt; }
  .body { font-size: 11pt; line-height: 1.9; margin: 0 0 3pt; }
  .foot { font-size: 9pt; color: #94a3b8; margin: 0; }
</style></head>
<body>
  <h1>گزارش مشاهدات تربیتی</h1>
  <p class="sub">دبیرستان دوره اول یاوران ولایت · تاریخ تهیه: ${esc(today)}</p>
  <table class="sum"><tr>
    <td><b>دانش‌آموز:</b> ${esc(studentName)}</td>
    <td><b>کلاس:</b> ${esc(className)}</td>
    <td><b>تعداد مشاهدات:</b> ${esc(toPersianDigits(items.length))}</td>
  </tr></table>
  ${entries || '<p>مشاهده‌ای ثبت نشده است.</p>'}
</body></html>`;

  const blob = new Blob(['﻿', html], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `مشاهدات-${studentName.replace(/\s+/g, '-')}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
