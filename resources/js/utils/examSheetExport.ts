import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { Document, ImageRun, Packer, Paragraph, AlignmentType, PageOrientation } from 'docx';

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
