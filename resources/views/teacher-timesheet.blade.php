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
            {{ $config['teacherName'] }} · سال تحصیلی {{ $config['academicYear'] }}
          </p>
        </div>
        <a href="/" class="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 shadow-sm active:bg-slate-100">
          بازگشت
        </a>
      </header>

      {{-- ویجت پانچ سریع (One-Tap Check-in) --}}
      <section class="relative mb-3 overflow-hidden rounded-3xl bg-slate-900 p-5 text-white shadow-sm" aria-label="پانچ سریع">
        <div class="pointer-events-none absolute -start-10 -top-10 size-40 rounded-full bg-emerald-500/10 blur-2xl"></div>
        <div class="relative flex items-center gap-4">
          <div class="relative size-24 shrink-0">
            <svg viewBox="0 0 100 100" class="size-24 -rotate-90" aria-hidden="true">
              <circle cx="50" cy="50" r="44" fill="none" stroke="rgb(51 65 85)" stroke-width="5" />
              <circle cx="50" cy="50" r="44" fill="none" stroke="rgb(52 211 153)" stroke-width="5" stroke-linecap="round" stroke-dasharray="276.5" :stroke-dashoffset="ringOffset" class="transition-[stroke-dashoffset] duration-1000 ease-linear" />
            </svg>
            <span class="absolute inset-0 flex items-center justify-center text-2xl font-extrabold tabular-nums" x-text="clockSec"></span>
          </div>
          <div class="min-w-0">
            <p class="text-xs font-medium text-slate-400">ساعت اکنون</p>
            <p class="text-4xl font-extrabold leading-tight tabular-nums" dir="ltr" x-text="clockHM"></p>
            <p x-show="isPunch('working')" class="mt-1 text-xs font-bold text-emerald-300">ورود شما: <span x-text="todayInText"></span></p>
          </div>
        </div>

        {{-- وضعیت ۱: ثبت نشده --}}
        <button type="button" x-show="isPunch('idle')" :disabled="cannotPunch" @click="punch()" class="relative mt-4 flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 text-lg font-extrabold text-white shadow-lg shadow-emerald-900/30 transition active:scale-[0.98] disabled:opacity-40">
          <span class="relative flex size-3">
            <span class="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75"></span>
            <span class="relative inline-flex size-3 rounded-full bg-white"></span>
          </span>
          ثبت ورود به مدرسه
        </button>

        {{-- وضعیت ۲: ورود زده --}}
        <button type="button" x-show="isPunch('working')" :disabled="cannotPunch" @click="punch()" class="relative mt-4 flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 px-4 text-lg font-extrabold text-white shadow-lg shadow-rose-900/30 transition active:scale-[0.98] disabled:opacity-40">
          ثبت خروج و پایان کار
        </button>

        {{-- وضعیت ۳: پایان روز --}}
        <div x-show="isPunch('done')" class="relative mt-4 rounded-2xl bg-slate-800 p-4 text-center">
          <p class="text-base font-extrabold text-emerald-300">خسته نباشید، ساعت امروز ثبت شد ✓</p>
          <p class="mt-1 text-xs text-slate-300">
            ورود <span class="font-bold text-white" x-text="todayInText"></span> · خروج <span class="font-bold text-white" x-text="todayOutText"></span> · <span class="font-bold text-white" x-text="todayHoursText"></span> ساعت
          </p>
        </div>

        <p x-show="punchError" class="relative mt-2 text-center text-xs font-bold text-rose-300" x-text="punchError"></p>
        <div x-show="hasHint" class="relative mt-3 flex items-center justify-between gap-2 text-xs text-slate-300">
          <span x-text="punchHint"></span>
          <button type="button" x-show="todayInOtherMonth" @click="goToday()" class="min-h-11 shrink-0 rounded-xl bg-slate-700 px-3 font-bold text-white active:bg-slate-600">رفتن به ماه امروز</button>
        </div>
      </section>

      {{-- نوار کنترل: ماه کاری --}}
      <section class="mb-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div>
          <label for="month" class="mb-1.5 block text-xs font-bold text-slate-500">ماه کاری</label>
          <select id="month" @change="changeMonth($event)" class="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-base font-bold text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200">
            <template x-for="m in months" :key="m.key">
              <option :value="m.key" :selected="isMonth(m.key)" x-text="m.label"></option>
            </template>
          </select>
        </div>
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
              <dd class="mt-1 text-base font-extrabold"><span x-text="filledDays"></span> / <span x-text="workDaysCount"></span></dd>
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
            <div class="flex items-center justify-between gap-2">
              <div>
                <p class="text-sm font-extrabold text-slate-800">
                  <span x-text="day.label"></span>
                  <span x-show="isToday(day)" class="ms-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">امروز</span>
                </p>
                <p class="text-xs font-medium text-slate-500">
                  <span x-text="day.weekday"></span>
                  <span x-show="isOff(day)"> · تعطیل</span>
                  <span x-show="isFutureWorking(day)"> · روز آینده</span>
                </p>
              </div>
              <span x-show="isOpen(day)" :class="badgeClass(day.date)" class="min-w-20 rounded-full px-3 py-1.5 text-center text-sm font-extrabold">
                <span x-text="dayHoursText(day.date)"></span>
                <span x-show="hasHours(day.date)" class="text-xs font-bold">ساعت</span>
              </span>
            </div>

            <div x-show="isOpen(day)" class="mt-3 space-y-2">
              <div class="grid grid-cols-2 gap-2">
                <label class="block">
                  <span class="mb-1 block text-xs font-bold text-slate-500">ساعت ورود</span>
                  <span class="time-field relative block">
                    <svg class="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-emerald-600 " viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                    <input type="time" dir="ltr" :value="valueOf(day.date, 'in')" @input="setField(day.date, 'in', $event)" class="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 ps-11 pe-3 text-center text-lg font-extrabold tabular-nums text-slate-800 shadow-sm transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                  </span>
                </label>
                <label class="block">
                  <span class="mb-1 block text-xs font-bold text-slate-500">ساعت خروج</span>
                  <span class="time-field relative block">
                    <svg class="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-emerald-600 " viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                    <input type="time" dir="ltr" :value="valueOf(day.date, 'out')" @input="setField(day.date, 'out', $event)" class="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 ps-11 pe-3 text-center text-lg font-extrabold tabular-nums text-slate-800 shadow-sm transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                  </span>
                </label>
              </div>
              <p x-show="isInvalid(day.date)" class="text-xs font-bold text-rose-600">ساعت خروج باید بعد از ساعت ورود باشد.</p>

              <div class="flex flex-wrap gap-2" role="group" aria-label="فعالیت‌های امروز">
                <template x-for="tag in tagList" :key="tag.key">
                  <button type="button" @click="toggleTag(day.date, tag.key)" :class="tagClass(day.date, tag.key)" :aria-pressed="hasTag(day.date, tag.key)" class="min-h-11 rounded-full border px-4 text-sm font-bold transition" x-text="tag.label"></button>
                </template>
              </div>
              <div x-show="hasOther(day.date)" class="relative">
                <svg class="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                <input type="text" maxlength="120" :value="otherText(day.date)" @input="setOtherText(day.date, $event)" placeholder="فعالیت دلخواه خود را بنویسید…" aria-label="شرح سایر موارد" class="min-h-12 w-full rounded-xl border border-emerald-200 bg-emerald-50/60 ps-11 pe-3 text-sm font-bold text-slate-800 placeholder:font-medium placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              </div>
            </div>

            <fieldset x-show="isLocked(day)" disabled class="mt-3 grid grid-cols-2 gap-2">
              <span class="time-field relative block">
                <svg class="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-emerald-600 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                <input type="time" dir="ltr" disabled class="min-h-12 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-200/60 ps-11 pe-3 text-center text-lg font-extrabold text-slate-400" aria-label="ساعت ورود (غیرفعال)" />
              </span>
              <span class="time-field relative block">
                <svg class="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-emerald-600 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                <input type="time" dir="ltr" disabled class="min-h-12 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-200/60 ps-11 pe-3 text-center text-lg font-extrabold text-slate-400" aria-label="ساعت خروج (غیرفعال)" />
              </span>
            </fieldset>
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
