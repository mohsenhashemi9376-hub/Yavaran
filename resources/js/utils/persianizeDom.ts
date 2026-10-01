import { toPersianDigits } from './persianDate';

/**
 * فارسی‌سازی سراسری ارقام: تمام اعداد لاتین نمایش‌داده‌شده در صفحه (متن، placeholder، title)
 * به ارقام فارسی (۰-۹) تبدیل می‌شوند. مقدار فیلدهای ورودی دست نمی‌خورد تا ویرایش و
 * اعتبارسنجی داده‌ها مختل نشود. برای تبدیل دستی در کد از toPersianDigits استفاده کنید.
 */
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'NOSCRIPT', 'CODE']);
const ATTRS = ['placeholder', 'title', 'aria-label'];
const LATIN_DIGIT = /[0-9]/;

const convertTextNode = (node: Text) => {
  const value = node.nodeValue;
  if (value && LATIN_DIGIT.test(value)) {
    const parent = node.parentElement;
    if (parent && SKIP_TAGS.has(parent.tagName)) return;
    node.nodeValue = toPersianDigits(value);
  }
};

const convertElementAttrs = (el: Element) => {
  for (const attr of ATTRS) {
    const v = el.getAttribute(attr);
    if (v && LATIN_DIGIT.test(v)) el.setAttribute(attr, toPersianDigits(v));
  }
};

const convertTree = (root: Node) => {
  if (root.nodeType === Node.TEXT_NODE) {
    convertTextNode(root as Text);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as Element;
  if (SKIP_TAGS.has(el.tagName)) return;
  convertElementAttrs(el);
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n: Node | null = walker.nextNode();
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) convertTextNode(n as Text);
    else convertElementAttrs(n as Element);
    n = walker.nextNode();
  }
};

export const enablePersianDigits = () => {
  if (typeof document === 'undefined') return;
  convertTree(document.body);

  new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'childList') {
        m.addedNodes.forEach(convertTree);
      } else if (m.type === 'characterData') {
        convertTextNode(m.target as Text);
      } else if (m.type === 'attributes') {
        convertElementAttrs(m.target as Element);
      }
    }
  }).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRS,
  });
};
