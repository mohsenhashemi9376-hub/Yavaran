import { toPersianDigits } from './persianDate';

/** مربی و معاون تربیتی به داده‌های محرمانه دسترسی دارند؛ حداقل طول رمز آن‌ها ۸ است (هماهنگ با سرور) */
export const minPasswordLength = (role: string | undefined, forced = false): number => {
  if (role === 'coach' || role === 'vice_nurturing') return 8;
  return forced ? 8 : 6;
};

export const passwordTooShortMessage = (min: number): string =>
  `رمز عبور جدید باید حداقل ${toPersianDigits(min)} کاراکتر باشد.`;
