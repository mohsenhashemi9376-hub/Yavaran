<!doctype html>
<html lang="fa" dir="rtl" translate="no" class="notranslate">
  <head>
    <meta charset="UTF-8" />
    <meta name="google" content="notranslate" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0b4838" />
    <meta name="robots" content="noindex, nofollow" />
    <title>تایم‌شیت اساتید</title>
    <link rel="icon" href="/favicon.ico?v=2" sizes="any" />
    @vite(['resources/css/review.css', 'resources/js/timesheet-overview.js'])
  </head>
  <body class="bg-slate-50 text-slate-900 antialiased">
    <script type="application/json" id="overview-config">@json($config)</script>

    <main x-data="timesheetOverview" x-cloak class="mx-auto max-w-3xl px-4 pb-16 pt-4">
      <header class="mb-4 flex items-center justify-between gap-3">
        <div class="min-w-0">
          <h1 class="text-xl font-extrabold">تایم‌شیت و خودارزیابی اساتید</h1>
          <p class="mt-0.5 text-xs font-medium text-slate-500">سال تحصیلی {{ $config['academicYear'] }}</p>
        </div>
        <a href="/" class="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 shadow-sm active:bg-slate-100">بازگشت</a>
      </header>

      <section class="mb-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <label for="month" class="mb-1.5 block text-xs font-bold text-slate-500">ماه کاری</label>
        <select id="month" @change="changeMonth($event)" class="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-base font-bold focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200">
          <template x-for="m in months" :key="m.key">
            <option :value="m.key" :selected="isMonth(m.key)" x-text="m.label"></option>
          </template>
        </select>
      </section>

      <section class="mb-4" aria-label="خلاصهٔ ماه">
        <div class="grid grid-cols-2 gap-2 text-center">
          <template x-for="c in cards" :key="c.key">
            <div class="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <p class="text-[11px] font-bold text-slate-500" x-text="c.label"></p>
              <p class="mt-1 text-2xl font-extrabold text-slate-900" x-text="c.value"></p>
              <p class="mt-0.5 min-h-5 text-xs font-extrabold" :class="c.deltaClass" x-text="c.deltaText"></p>
            </div>
          </template>
        </div>
        <p x-show="hasPrev" class="mt-2 text-center text-[11px] font-medium text-slate-400" x-text="prevNote"></p>
      </section>

      {{-- ویرایش شاخص‌های خودارزیابی (فقط مدیر مدرسه) --}}
      <section x-show="canEdit" class="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="شاخص‌های خودارزیابی">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-extrabold text-slate-800">شاخص‌های خودارزیابی</h2>
            <p class="mt-0.5 text-xs text-slate-500"><span x-text="axesCountText"></span> شاخص ثابت · هر استاد تا ۴ شاخص شخصی هم می‌تواند اضافه کند</p>
          </div>
          <button type="button" x-show="notEditing" @click="startEdit()" class="min-h-11 shrink-0 rounded-xl bg-emerald-600 px-4 text-sm font-extrabold text-white shadow-sm active:bg-emerald-700">ویرایش</button>
        </div>
        <p x-show="hasAxesMsg" class="mt-2 text-xs font-bold text-emerald-700" x-text="axesMsg"></p>

        <div x-show="isEditing" class="mt-3 space-y-2">
          <template x-for="(a, index) in draft" :key="a.k">
            <div class="flex items-center gap-1.5">
              <span class="w-6 shrink-0 text-center text-xs font-extrabold text-slate-400" x-text="axisNo(index)"></span>
              <input type="text" maxlength="80" :value="a.title" @input="setAxisTitle(a.k, $event)" placeholder="عنوان شاخص" class="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              <button type="button" @click="moveUp(a.k)" aria-label="بالا" class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600 active:bg-slate-100">↑</button>
              <button type="button" @click="moveDown(a.k)" aria-label="پایین" class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600 active:bg-slate-100">↓</button>
              <button type="button" @click="removeAxis(a.k)" aria-label="حذف" class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 font-bold text-rose-600 active:bg-rose-100">✕</button>
            </div>
          </template>
          <button type="button" @click="addAxisRow()" :disabled="draftFull" class="min-h-11 w-full rounded-xl border border-dashed border-emerald-300 bg-emerald-50/60 text-sm font-extrabold text-emerald-800 active:bg-emerald-100 disabled:opacity-40">+ افزودن شاخص</button>
          <p x-show="hasAxesError" class="text-xs font-bold text-rose-600" x-text="axesError"></p>
          <div class="grid grid-cols-2 gap-2 pt-1">
            <button type="button" @click="cancelEdit()" class="min-h-12 rounded-xl bg-slate-100 text-sm font-extrabold text-slate-700 active:bg-slate-200">انصراف</button>
            <button type="button" @click="saveAxes()" :disabled="axesDisabled" class="min-h-12 rounded-xl bg-slate-900 text-sm font-extrabold text-white active:bg-slate-700 disabled:opacity-50" x-text="saveLabel"></button>
          </div>
          <p class="text-[11px] leading-5 text-slate-400">حذف یا تغییر شاخص، نمره‌های قبلی ثبت‌شده را پاک نمی‌کند ولی دیگر در امتیاز کل حساب نمی‌شود.</p>
        </div>
      </section>

      <p x-show="loading" class="py-10 text-center text-sm font-medium text-slate-500">در حال بارگذاری…</p>
      <p x-show="hasError" class="mb-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700" x-text="error"></p>
      <p x-show="isEmpty" class="rounded-2xl border border-dashed border-slate-300 bg-white py-10 text-center text-sm text-slate-500">استادی یافت نشد.</p>

      <ul class="space-y-2">
        <template x-for="t in teachers" :key="t.id">
          <li class="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <button type="button" @click="toggle(t)" class="flex w-full min-h-16 items-center justify-between gap-3 p-4 text-start">
              <span class="min-w-0">
                <span class="block truncate text-sm font-extrabold" x-text="t.name"></span>
                <span class="mt-0.5 block text-xs text-slate-500"><span x-text="daysText(t)"></span> روز ثبت‌شده · خودارزیابی <span x-text="scoreText(t)"></span></span>
              </span>
              <span class="shrink-0 text-end"><span class="block rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-extrabold text-emerald-700"><span x-text="hoursText(t)"></span> ساعت</span><span class="mt-0.5 block text-[11px] font-extrabold" :class="teacherDeltaClass(t)" x-text="teacherDelta(t)"></span></span>
            </button>
            <div x-show="isOpen(t)" class="space-y-2 border-t border-slate-100 p-4">
              <template x-for="a in axes" :key="a.id">
                <div class="flex items-center justify-between gap-3 text-sm"><span class="text-slate-600" x-text="a.title"></span><span class="font-extrabold text-slate-800"><span x-text="axisScore(t, a)"></span> / ۵</span></div>
              </template>
              <template x-for="c in t.custom" :key="c.title">
                <div class="flex items-center justify-between gap-3 text-sm"><span class="text-emerald-800" x-text="c.title"></span><span class="font-extrabold text-slate-800"><span x-text="customScore(c)"></span> / ۵</span></div>
              </template>
              <div class="h-2 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full bg-emerald-500" :style="barStyle(t)"></div></div>
              <p x-show="hasNote(t)" class="whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm leading-7 text-slate-700" x-text="t.extraNote"></p>
            </div>
          </li>
        </template>
      </ul>
    </main>
  </body>
</html>
