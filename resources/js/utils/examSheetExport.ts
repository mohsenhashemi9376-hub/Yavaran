import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { Document, ImageRun, Packer, Paragraph, AlignmentType, PageOrientation, Table, TableRow, TableCell, TextRun, WidthType, BorderStyle, ShadingType, VerticalAlign } from 'docx';

export type SheetFormat = 'png' | 'pdf' | 'docx';

const A4 = { w: 210, h: 297 }; // میلی‌متر
const MARGIN = 8;
const PIXEL_RATIO = 3;

const download = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('تصویر ساخته نشد.'));
    img.src = src;
  });

/** عکس بلند برگه را به برش‌های هم‌نسبتِ صفحه‌ی A4 تقسیم می‌کند (هر برش = یک صفحه) */
const sliceToPages = async (dataUrl: string, pageRatio: number) => {
  const img = await loadImage(dataUrl);
  const sliceH = Math.floor(img.width * pageRatio);
  const pages: { dataUrl: string; w: number; h: number }[] = [];
  for (let y = 0; y < img.height; y += sliceH) {
    const h = Math.min(sliceH, img.height - y);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, y, img.width, h, 0, 0, img.width, h);
    pages.push({ dataUrl: canvas.toDataURL('image/png'), w: img.width, h });
  }
  return pages;
};

const dataUrlToBytes = (dataUrl: string) => {
  const bin = atob(dataUrl.split(',')[1]);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

/** برگه‌ی (DOM) را با کیفیت بالا به عکس PNG، PDF یا Word تبدیل و دانلود می‌کند */
export async function exportSheet(node: HTMLElement, format: SheetFormat, baseName: string, landscape: boolean) {
  await document.fonts.ready;
  const dataUrl = await toPng(node, { pixelRatio: PIXEL_RATIO, backgroundColor: '#ffffff', cacheBust: true });

  if (format === 'png') {
    download(await (await fetch(dataUrl)).blob(), `${baseName}.png`);
    return;
  }

  const pageW = landscape ? A4.h : A4.w;
  const pageH = landscape ? A4.w : A4.h;
  const innerW = pageW - MARGIN * 2;
  const innerH = pageH - MARGIN * 2;
  const pages = await sliceToPages(dataUrl, innerH / innerW);

  if (format === 'pdf') {
    const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4', compress: true });
    pages.forEach((p, i) => {
      if (i > 0) pdf.addPage();
      pdf.addImage(p.dataUrl, 'PNG', MARGIN, MARGIN, innerW, (p.h / p.w) * innerW, undefined, 'FAST');
    });
    pdf.save(`${baseName}.pdf`);
    return;
  }

  // Word: عرض قابل چاپ A4 (۹۶ نقطه در اینچ) منهای حاشیه‌ها
  const widthPx = Math.round((innerW / 25.4) * 96);
  const twip = (mm: number) => Math.round((mm / 25.4) * 1440);
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: twip(A4.w), height: twip(A4.h), orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
            margin: { top: twip(MARGIN), bottom: twip(MARGIN), left: twip(MARGIN), right: twip(MARGIN) },
          },
        },
        children: pages.map(
          (p) =>
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  type: 'png',
                  data: dataUrlToBytes(p.dataUrl),
                  transformation: { width: widthPx, height: Math.round((p.h / p.w) * widthPx) },
                }),
              ],
            })
        ),
      },
    ],
  });
  download(await Packer.toBlob(doc), `${baseName}.docx`);
}

export interface ExamDocxData {
  title: string;
  className: string;
  /** هر خط یک پاراگراف زیر عنوان (خلاصه و تحلیل) */
  summary: string[];
  head: string[];
  rows: { cells: string[]; tone?: 'good' | 'ok' | 'mid' | 'bad' | 'none' }[];
  landscape: boolean;
}

const TONE_COLOR = { good: '047857', ok: '0369A1', mid: 'B45309', bad: 'BE123C', none: '94A3B8' } as const;

/** Word با جدول واقعی و قابل ویرایش (راست‌به‌چپ؛ فونت Tahoma که روی همه‌ی سیستم‌ها فارسی را درست نشان می‌دهد) */
export async function exportExamDocx(parts: ExamDocxData[], baseName: string) {
  const FONT = { ascii: 'Tahoma', hAnsi: 'Tahoma', cs: 'Tahoma' };
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' };
  const borders = { top: border, bottom: border, left: border, right: border };
  const para = (text: string, o: { bold?: boolean; size?: number; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) =>
    new Paragraph({
      bidirectional: true,
      alignment: o.align ?? AlignmentType.CENTER,
      spacing: { before: 40, after: 40 },
      children: [new TextRun({ text, bold: o.bold, size: o.size ?? 20, color: o.color, font: FONT, rightToLeft: true })],
    });

  const cell = (text: string, o: { head?: boolean; bold?: boolean; color?: string; shade?: string; start?: boolean } = {}) =>
    new TableCell({
      borders,
      verticalAlign: VerticalAlign.CENTER,
      shading: o.head ? { type: ShadingType.CLEAR, fill: '047857', color: 'auto' } : o.shade ? { type: ShadingType.CLEAR, fill: o.shade, color: 'auto' } : undefined,
      children: [para(text, { bold: o.head || o.bold, color: o.head ? 'FFFFFF' : o.color, size: o.head ? 19 : 20, align: o.start ? AlignmentType.START : AlignmentType.CENTER })],
    });

  const buildTable = (d: ExamDocxData) =>
    new Table({
      visuallyRightToLeft: true,
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ tableHeader: true, cantSplit: true, children: d.head.map((h, i) => cell(h, { head: true, start: i === 1 })) }),
        ...d.rows.map(
          (r, ri) =>
            new TableRow({
              cantSplit: true,
              children: r.cells.map((c, i) =>
                cell(c, {
                  start: i === 1,
                  bold: i === 1 || (i > 1 && i < r.cells.length - 1),
                  color: i > 1 && i < r.cells.length - 2 ? TONE_COLOR[r.tone ?? 'none'] : undefined,
                  shade: ri % 2 ? 'F8FAFC' : undefined,
                })
              ),
            })
        ),
      ],
    });

  const twip = (mm: number) => Math.round((mm / 25.4) * 1440);
  const doc = new Document({
    styles: { default: { document: { run: { font: FONT } } } },
    sections: parts.map((d) => ({
      properties: {
        page: {
          size: { width: twip(A4.w), height: twip(A4.h), orientation: d.landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
          margin: { top: twip(12), bottom: twip(12), left: twip(10), right: twip(10) },
        },
      },
      children: [
        para('دبیرستان دوره اول یاوران ولایت', { bold: true, size: 22, color: '047857' }),
        para(d.title, { bold: true, size: 32 }),
        para(`کلاس: ${d.className}`, { bold: true, size: 22 }),
        ...d.summary.map((line) => para(line, { size: 19, color: '475569' })),
        new Paragraph({ children: [] }),
        buildTable(d),
      ],
    })),
  });
  download(await Packer.toBlob(doc), `${baseName}.docx`);
}

/** چند برگه (هر ماه یک برگه) را در یک PDF می‌گذارد؛ هر برگه از صفحه‌ی جدید شروع می‌شود */
export async function exportSheetsPdf(items: { node: HTMLElement; landscape: boolean }[], baseName: string) {
  await document.fonts.ready;
  let pdf: jsPDF | null = null;
  for (const it of items) {
    const dataUrl = await toPng(it.node, { pixelRatio: PIXEL_RATIO, backgroundColor: '#ffffff', cacheBust: true });
    const pageW = it.landscape ? A4.h : A4.w;
    const pageH = it.landscape ? A4.w : A4.h;
    const innerW = pageW - MARGIN * 2;
    const innerH = pageH - MARGIN * 2;
    const pages = await sliceToPages(dataUrl, innerH / innerW);
    for (const p of pages) {
      const orientation = it.landscape ? 'landscape' : 'portrait';
      if (!pdf) pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4', compress: true });
      else pdf.addPage('a4', orientation);
      pdf.addImage(p.dataUrl, 'PNG', MARGIN, MARGIN, innerW, (p.h / p.w) * innerW, undefined, 'FAST');
    }
  }
  pdf?.save(`${baseName}.pdf`);
}
