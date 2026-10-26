<!doctype html>
<html lang="fa" dir="rtl" translate="no" class="notranslate">
  <head>
    <meta charset="UTF-8" />
    <meta name="google" content="notranslate" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0b4838" />
    <meta name="robots" content="noindex, nofollow" />
    <title>ساعت کاری و خودارزیابی اساتید</title>
    <link rel="icon" href="/favicon.ico?v=2" sizes="any" />
    @vite(['resources/css/timesheet.css', 'resources/js/timesheet.js'])
  </head>
  <body class="bg-slate-50 text-slate-900 antialiased">
    <script type="application/json" id="timesheet-config">@json($config)</script>

    <main x-data="timesheet" x-cloak class="mx-auto max-w-2xl px-4 pb-32 pt-4">
      {{-- سربرگ --}}
      <header class="mb-4 flex items-center justify-between gap-3">
        <div class="min-w-0">
          <h1 class="truncate text-lg font-extrabold text-slate-900">ساعت کاری و خودارزیابی</h1>
          <p class="mt-0.5 text-xs font-medium text-slate-500">
            {{ $config['teacherName'] }} · سال تحصیلی <span x-text="yearLabel"></span>
          </p>
        </div>
        <a href="/" class="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 shadow-sm active:bg-slate-100">
          بازگشت
        </a>
      </header>

      {{-- انتخاب ماه کاری --}}
      <section class="mb-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <label for="month" class="mb-1.5 block text-xs font-bold text-slate-500">ماه کاری</label>
        <select id="month" @change="changeMonth($event)" class="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-base font-bold text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200">
          <template x-for="m in months" :key="m.key">
            <option :value="m.key" :selected="isMonth(m.key)" x-text="m.label"></option>
          </template>
        </select>
      </section>

      {{-- کارت آماری چسبان: مجموع ساعات کاری ماه --}}
      <section class="sticky top-2 z-20 mb-4 rounded-2xl border border-emerald-200 bg-emerald-600 p-4 text-white shadow-sm">
        <div class="flex items-end justify-between gap-3">
          <div>
            <p class="text-xs font-medium text-emerald-100">مجموع ساعات کاری این ماه</p>
            <p class="mt-1 text-3xl font-extrabold leading-none">
              <span x-text="totalText"></span>
              <span class="text-base font-bold text-emerald-100">ساعت</span>
            </p>
          </div>
          <dl class="flex gap-4 text-center text-xs">
            <div>
              <dt class="text-emerald-100">روز ثبت‌شده</dt>
              <dd class="mt-1 text-base font-extrabold"><span x-text="filledDays"></span> / <span x-text="daysCount"></span></dd>
            </div>
            <div>
              <dt class="text-emerald-100">میانگین روزانه</dt>
              <dd class="mt-1 text-base font-extrabold" x-text="averageText"></dd>
            </div>
          </dl>
        </div>
      </section>

      <p x-show="loading" class="py-10 text-center text-sm font-medium text-slate-500">در حال بارگذاری…</p>

      {{-- تب ۱: ثبت ساعات کاری --}}
      <section x-show="isTab('timesheet')" class="space-y-3" aria-label="ثبت ساعات کاری">
        <template x-for="day in days" :key="day.date">
          <article :class="rowClass(day)" class="rounded-2xl border p-3 shadow-sm">
            <div class="mb-2 flex items-center justify-between gap-2">
              <div>
                <p class="text-sm font-extrabold text-slate-800" x-text="day.label"></p>
                <p class="text-xs font-medium text-slate-500" x-text="day.weekday"></p>
              </div>
              <span :class="badgeClass(day.date)" class="min-w-20 rounded-full px-3 py-1.5 text-center text-sm font-extrabold">
                <span x-text="dayHoursText(day.date)"></span>
                <span x-show="hasHours(day.date)" class="text-xs font-bold">ساعت</span>
              </span>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <label class="block">
                <span class="mb-1 block text-xs font-bold text-slate-500">ساعت ورود</span>
                <input type="time" :value="valueOf(day.date, 'in')" @input="setField(day.date, 'in', $event)" class="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-base font-bold text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              </label>
              <label class="block">
                <span class="mb-1 block text-xs font-bold text-slate-500">ساعت خروج</span>
                <input type="time" :value="valueOf(day.date, 'out')" @input="setField(day.date, 'out', $event)" class="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-base font-bold text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              </label>
            </div>
            <p x-show="isInvalid(day.date)" class="mt-1.5 text-xs font-bold text-rose-600">ساعت خروج باید بعد از ساعت ورود باشد.</p>

            <label class="mt-2 block">
              <span class="mb-1 block text-xs font-bold text-slate-500">توضیحات و فعالیت‌های امروز</span>
              <input type="text" maxlength="500" :value="valueOf(day.date, 'note')" @input="setField(day.date, 'note', $event)" placeholder="مثلاً: تدریس، جلسه اولیا، تصحیح برگه‌ها…" class="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200" />
            </label>
          </article>
        </template>
      </section>

      {{-- تب ۲: خودارزیابی ماهانه --}}
      <section x-show="isTab('evaluation')" class="space-y-3" aria-label="خودارزیابی ماهانه">
        <div class="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p class="text-sm font-bold text-slate-600">امتیاز کل خودارزیابی</p>
          <p class="text-lg font-extrabold text-emerald-700" x-text="totalScoreText"></p>
        </div>

        <template x-for="(axis, index) in axes" :key="axis.id">
          <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div class="flex items-start justify-between gap-3">
              <h2 class="text-sm font-extrabold leading-7 text-slate-800">
                <span class="ms-0 me-1 text-emerald-600" x-text="axisNumber(index)"></span>.
                <span x-text="axis.title"></span>
              </h2>
              <span class="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-600">
                <span x-text="scoreText(axis.id)"></span> / ۵
              </span>
            </div>

            <div class="mt-3 flex items-center gap-1" role="group" :aria-label="axis.title">
              <template x-for="n in stars" :key="n">
                <button type="button" @click="setScore(axis.id, n)" :class="starClass(axis.id, n)" class="flex size-12 items-center justify-center rounded-xl text-4xl leading-none active:bg-slate-100" :aria-label="n">
                  ★
                </button>
              </template>
              <button type="button" @click="clearScore(axis.id)" class="ms-auto min-h-11 rounded-xl px-3 text-xs font-bold text-slate-500 active:bg-slate-100">
                صفر
              </button>
            </div>

            <div x-show="isExtra(axis)" class="mt-3">
              <label for="extra-note" class="mb-1 block text-xs font-bold text-slate-500">شرح کارهای اضافه‌ای که انجام داده‌اید</label>
              <textarea id="extra-note" rows="5" maxlength="3000" :value="extraNote" @input="setExtraNote($event)" placeholder="کارهای انجام‌شده‌ی فراتر از وظایف اصلی را اینجا بنویسید…" class="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-7 text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"></textarea>
            </div>
          </article>
        </template>
      </section>

      {{-- نوار پایین (نزدیک شست): تب‌ها + ذخیره --}}
      <nav class="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="بخش‌ها">
        <div class="mx-auto max-w-2xl px-4 pt-2">
          <p class="mb-1.5 min-h-4 text-center text-xs font-bold" :class="statusClass" x-text="statusText"></p>
          <div class="flex items-center gap-2 pb-3">
            <div class="grid flex-1 grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
              <button type="button" @click="setTab('timesheet')" :class="tabClass('timesheet')" class="min-h-12 rounded-xl px-2 text-sm font-extrabold transition">ثبت ساعات کاری</button>
              <button type="button" @click="setTab('evaluation')" :class="tabClass('evaluation')" class="min-h-12 rounded-xl px-2 text-sm font-extrabold transition">خودارزیابی ماهانه</button>
            </div>
            <button type="button" @click="save()" class="min-h-12 shrink-0 rounded-2xl bg-slate-900 px-5 text-sm font-extrabold text-white shadow-sm active:bg-slate-700">ذخیره</button>
          </div>
        </div>
      </nav>
    </main>
  </body>
</html>
