import { toPersianDigits } from './persianDate';

/** حداقل طول رمز عبور برای همه‌ی نقش‌ها ۸ کاراکتر است (هماهنگ با سرور) */
export const MIN_PASSWORD_LENGTH = 8;

export const minPasswordLength = (_role?: string, _forced = false): number => MIN_PASSWORD_LENGTH;

export const passwordTooShortMessage = (min: number = MIN_PASSWORD_LENGTH): string =>
  `رمز عبور جدید باید حداقل ${toPersianDigits(min)} کاراکتر باشد.`;

/** رمز واردشده (در صورت پر بودن) باید حداقل ۸ کاراکتر باشد؛ در غیر این صورت پیام خطا برمی‌گردد */
export const passwordLengthError = (password: string): string | undefined =>
  password.trim() !== '' && password.trim().length < MIN_PASSWORD_LENGTH ? passwordTooShortMessage() : undefined;
