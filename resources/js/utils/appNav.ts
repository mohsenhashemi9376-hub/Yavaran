/** ناوبری بین بخش‌های برنامه از کامپوننت‌های دور از هم (مثلاً زنگوله اعلان → «اعلانات و ارزیابی» استاد) */
export const OPEN_TEACHER_EVALUATIONS_EVENT = 'yavaran:open-teacher-evaluations';

let pendingTeacherEvaluations = false;

export const requestOpenTeacherEvaluations = () => {
  pendingTeacherEvaluations = true;
  window.dispatchEvent(new Event(OPEN_TEACHER_EVALUATIONS_EVENT));
};

/** اگر درخواستی قبل از آماده‌شدن پنل استاد ثبت شده باشد، یک‌بار مصرف می‌شود */
export const consumePendingTeacherEvaluations = () => {
  const v = pendingTeacherEvaluations;
  pendingTeacherEvaluations = false;
  return v;
};
