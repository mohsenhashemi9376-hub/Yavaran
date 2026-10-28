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

    <main x-data="timesheet" x-cloak class="mx-auto max-w-2xl px-4 pb-32 pt-4 lg:max-w-6xl lg:px-8">
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

      {{-- داشبورد پانچ: ثبت ورود / خروج (تا دو نوبت در روز) --}}
      <section class="relative mb-3 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 p-5 text-white shadow-sm md:p-6" aria-label="ثبت ورود و خروج">
        <div class="pointer-events-none absolute -start-10 -top-10 size-48 rounded-full bg-emerald-500/15 blur-3xl"></div>
        <div class="relative flex flex-col gap-5 md:flex-row md:items-center md:gap-8">
          {{-- ساعت زنده و روز جاری --}}
          <div class="flex items-center gap-4 md:shrink-0">
            <div class="relative size-24 shrink-0">
              <svg viewBox="0 0 100 100" class="size-24 -rotate-90" aria-hidden="true">
                <circle cx="50" cy="50" r="44" fill="none" stroke="rgb(51 65 85)" stroke-width="5" />
                <circle cx="50" cy="50" r="44" fill="none" stroke="rgb(52 211 153)" stroke-width="5" stroke-linecap="round" stroke-dasharray="276.5" :stroke-dashoffset="ringOffset" class="transition-[stroke-dashoffset] duration-1000 ease-linear" />
              </svg>
              <span class="absolute inset-0 flex items-center justify-center text-2xl font-extrabold tabular-nums" x-text="clockSec"></span>
            </div>
            <div class="min-w-0">
              <p class="text-xs font-bold text-emerald-300" x-text="todayLabel"></p>
              <p class="text-4xl font-extrabold leading-tight tabular-nums" dir="ltr" x-text="clockHM"></p>
              <p class="text-xs font-medium text-slate-400">ساعت اکنون</p>
            </div>
          </div>

          {{-- نوبت‌های امروز --}}
          <div class="min-w-0 flex-1" x-show="hasSessions">
            <ul class="space-y-1.5">
              <template x-for="s in todaySessions" :key="s.key">
                <li class="flex items-center justify-between gap-3 rounded-xl bg-white/10 px-3 py-2 text-sm">
                  <span class="font-bold text-emerald-200" x-text="s.label"></span>
                  <span class="font-extrabold tabular-nums">ورود <span x-text="s.inText"></span> · خروج <span x-text="s.outText"></span></span>
                </li>
              </template>
            </ul>
            <p class="mt-2 text-xs text-slate-300">جمع امروز: <span class="font-extrabold text-white" x-text="todayHoursText"></span> ساعت</p>
          </div>

          {{-- دکمهٔ اصلی (نزدیک شست) --}}
          <div class="md:w-72 md:shrink-0 md:ms-auto">
            <button type="button" x-show="isNotDone" :disabled="cannotPunch" @click="punch()" :class="punchBtnClass" class="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl px-4 text-lg font-extrabold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-40">
              <span class="relative flex size-3">
                <span class="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75"></span>
                <span class="relative inline-flex size-3 rounded-full bg-white"></span>
              </span>
              <span x-text="punchLabel"></span>
            </button>
            <div x-show="isPunch('done')" class="rounded-2xl bg-white/10 p-4 text-center">
              <p class="text-base font-extrabold text-emerald-300">خسته نباشید، امروز دو نوبت ثبت شد ✓</p>
            </div>
            <p x-show="punchError" class="mt-2 text-center text-xs font-bold text-rose-300" x-text="punchError"></p>
            <div x-show="hasHint" class="mt-3 flex items-center justify-between gap-2 text-xs text-slate-300">
              <span x-text="punchHint"></span>
              <button type="button" x-show="todayInOtherMonth" @click="goToday()" class="min-h-11 shrink-0 rounded-xl bg-slate-700 px-3 font-bold text-white active:bg-slate-600">رفتن به ماه امروز</button>
            </div>
          </div>
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

      {{-- تب ۱: ثبت ساعات کاری (موبایل: کارت ستونی، دسکتاپ: سطر افقی شبیه جدول) --}}
      <section x-show="isTab('timesheet')" class="space-y-3" aria-label="ثبت ساعات کاری">
        <template x-for="day in days" :key="day.date">
          <div class="flex flex-col gap-3">
          <button type="button" x-show="isPast(day)" @click="toggleDay(day)" class="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-start shadow-sm md:hidden">
            <span class="min-w-0 flex-1 truncate text-sm font-extrabold text-slate-800" x-text="summaryLabel(day)"></span>
            <span class="shrink-0 text-xs font-bold text-slate-500" x-text="summaryHours(day)"></span>
            <span :class="summaryClass(day)" class="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-2 text-xs font-extrabold" x-text="summaryMark(day)"></span>
          </button>
          <article :id="dayId(day)" :class="[rowClass(day), collapsedClass(day)]" class="flex scroll-mt-40 flex-col gap-3 rounded-2xl border p-3 shadow-sm md:flex-row md:items-center md:gap-4 md:p-4">
            {{-- تاریخ و روز --}}
            <div class="flex items-center justify-between gap-2 md:w-24 md:shrink-0 md:flex-col md:items-start md:justify-center">
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
              <span x-show="isOpen(day)" :class="badgeClass(day.date)" class="min-w-20 rounded-full px-3 py-1.5 text-center text-sm font-extrabold md:hidden">
                <span x-text="dayHoursText(day.date)"></span>
                <span x-show="hasHours(day.date)" class="text-xs font-bold">ساعت</span>
              </span>
            </div>

            {{-- ورود و خروج (نوبت اول و دوم) با انتخابگر ساعت سفارشی --}}
            <div x-show="isOpen(day)" class="space-y-2 md:flex md:shrink-0 md:items-center md:gap-3 md:space-y-0">
              <template x-for="row in sessionRows" :key="row.key">
                <div x-show="rowVisible(day.date, row)" :class="rowClass2(row)" class="grid grid-cols-2 gap-2 md:flex">
                  <template x-for="f in row.fields" :key="f.id">
                    <button type="button" @click="openPicker(day.date, f.id)" :class="fieldBtnClass(day.date, f.id)" class="flex min-h-14 flex-col items-center justify-center rounded-xl border px-2 shadow-sm transition active:scale-[0.98] md:min-h-12 md:w-24">
                      <span class="text-[11px] font-bold opacity-70" x-text="f.label"></span>
                      <span class="text-lg font-extrabold tabular-nums leading-tight md:text-base" dir="ltr" x-text="fieldText(day.date, f.id)"></span>
                    </button>
                  </template>
                </div>
              </template>
              <p x-show="isInvalid(day.date)" class="text-xs font-bold text-rose-600">ساعت‌ها معتبر نیست (خروج باید بعد از ورود باشد).</p>
            </div>

            {{-- تگ‌های فعالیت + «سایر موارد» به‌صورت Inline --}}
            <div x-show="isOpen(day)" class="flex flex-wrap items-center gap-2 md:flex-1" role="group" aria-label="فعالیت‌های روز">
              <template x-for="tag in tagList" :key="tag.key">
                <button type="button" @click="toggleTag(day.date, tag.key)" :class="tagClass(day.date, tag.key)" :aria-pressed="hasTag(day.date, tag.key)" class="min-h-11 rounded-full border px-4 text-sm font-bold transition md:min-h-9 md:px-3 md:text-xs" x-text="tag.label"></button>
              </template>
              <div x-show="hasOther(day.date)" class="relative w-full md:w-56">
                <svg class="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                <input type="text" maxlength="120" :value="otherText(day.date)" @input="setOtherText(day.date, $event)" placeholder="فعالیت دلخواه…" aria-label="شرح سایر موارد" class="min-h-11 w-full rounded-xl border border-emerald-200 bg-emerald-50/60 ps-9 pe-3 text-sm font-bold text-slate-800 placeholder:font-medium placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200 md:min-h-9 md:text-xs" />
              </div>
            </div>

            {{-- ساعت محاسبه‌شده (دسکتاپ: انتهای سطر) --}}
            <span x-show="isOpen(day)" :class="badgeClass(day.date)" class="hidden w-28 shrink-0 rounded-xl px-3 py-2 text-center text-base font-extrabold md:block">
              <span x-text="dayHoursText(day.date)"></span>
              <span x-show="hasHours(day.date)" class="text-xs font-bold">ساعت</span>
            </span>

            {{-- روز تعطیل یا آینده --}}
            <div x-show="isLocked(day)" class="grid grid-cols-2 gap-2 md:flex md:flex-1 md:justify-start">
              <span class="flex min-h-14 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-200/60 text-lg font-extrabold text-slate-400 md:min-h-12 md:w-24 md:text-base">--:--</span>
              <span class="flex min-h-14 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-200/60 text-lg font-extrabold text-slate-400 md:min-h-12 md:w-24 md:text-base">--:--</span>
            </div>
          </article>
          </div>
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

      {{-- شاخص‌های شخصی استاد (حداکثر ۴ مورد) --}}
      <section x-show="isTab('evaluation')" class="mt-3 space-y-3" aria-label="شاخص‌های شخصی من">
        <template x-for="axis in customAxes" :key="axis.id">
          <article class="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
            <div class="flex items-center gap-2">
              <input type="text" maxlength="60" :value="axis.title" @input="setCustomTitle(axis.id, $event)" aria-label="عنوان شاخص" class="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-extrabold text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              <span class="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-600"><span x-text="scoreText(axis.id)"></span> / ۵</span>
              <button type="button" @click="removeCustom(axis.id)" aria-label="حذف شاخص" class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-lg font-bold text-rose-600 active:bg-rose-100">✕</button>
            </div>
            <div class="mt-3 flex items-center gap-1" role="group" :aria-label="axis.title">
              <template x-for="n in stars" :key="n">
                <button type="button" @click="setScore(axis.id, n)" :class="starClass(axis.id, n)" class="flex size-12 items-center justify-center rounded-xl text-4xl leading-none active:bg-slate-100" :aria-label="n">★</button>
              </template>
              <button type="button" @click="clearScore(axis.id)" class="ms-auto min-h-11 rounded-xl px-3 text-xs font-bold text-slate-500 active:bg-slate-100">صفر</button>
            </div>
          </article>
        </template>

        <div class="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/60 p-4">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-sm font-extrabold text-emerald-900">افزودن شاخص شخصی</h2>
            <span class="rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-emerald-700" x-text="customCounterText"></span>
          </div>
          <p class="mt-1 text-xs leading-6 text-slate-500">می‌توانید تا ۴ شاخص دلخواه خودتان را به فهرست خودارزیابی اضافه کنید.</p>
          <div x-show="canAddCustom" class="mt-3 flex items-center gap-2">
            <input type="text" maxlength="60" :value="newTitle" @input="setNewTitle($event)" @keydown.enter.prevent="addCustom()" placeholder="مثلاً: مشارکت در برنامه‌های فرهنگی" class="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200" />
            <button type="button" @click="addCustom()" :disabled="addDisabled" class="min-h-12 shrink-0 rounded-xl bg-emerald-600 px-5 text-sm font-extrabold text-white shadow-sm active:bg-emerald-700 disabled:opacity-40">افزودن</button>
          </div>
          <p x-show="hasCustomError" class="mt-2 text-xs font-bold text-rose-600" x-text="customError"></p>
          <p x-show="atLimit" class="mt-3 text-xs font-bold text-emerald-800">به سقف ۴ شاخص رسیده‌اید؛ برای افزودن مورد جدید، یکی را حذف کنید.</p>
        </div>
      </section>

      {{-- نوار پایین (نزدیک شست): تب‌ها + ذخیره --}}
      <nav class="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="بخش‌ها">
        <div class="mx-auto max-w-2xl px-4 pt-2 lg:max-w-6xl lg:px-8">
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

      {{-- انتخابگر ساعت: صفحهٔ پایین‌آمدنی (نزدیک شست) --}}
      <div x-show="picker.open" x-transition.opacity class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm md:items-center" @click.self="closePicker()" role="dialog" aria-modal="true" aria-label="انتخاب ساعت">
        <div class="w-full max-w-md rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl md:rounded-3xl">
          <div class="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 md:hidden"></div>
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-extrabold text-slate-700">ساعت <span x-text="pickerTitle"></span></p>
            <button type="button" @click="pickNow()" class="min-h-11 rounded-xl bg-emerald-50 px-4 text-sm font-extrabold text-emerald-700 active:bg-emerald-100">همین الان</button>
          </div>

          <div class="my-4 flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-br from-slate-900 to-emerald-950 py-4 text-white">
            <button type="button" @click="nudgeDown()" class="flex size-12 items-center justify-center rounded-xl bg-white/10 text-2xl font-extrabold active:bg-white/20" aria-label="یک دقیقه کمتر">−</button>
            <p class="min-w-32 text-center text-5xl font-extrabold tabular-nums" dir="ltr" x-text="pickerText"></p>
            <button type="button" @click="nudgeUp()" class="flex size-12 items-center justify-center rounded-xl bg-white/10 text-2xl font-extrabold active:bg-white/20" aria-label="یک دقیقه بیشتر">+</button>
          </div>

          <p class="mb-1.5 text-xs font-bold text-slate-500">ساعت</p>
          <div class="grid grid-cols-6 gap-1.5" dir="ltr">
            <template x-for="h in hours" :key="h">
              <button type="button" @click="pickHour(h)" :class="hourClass(h)" class="min-h-11 rounded-xl text-base font-extrabold tabular-nums transition" x-text="hourText(h)"></button>
            </template>
          </div>

          <p class="mb-1.5 mt-3 text-xs font-bold text-slate-500">دقیقه</p>
          <div class="grid grid-cols-6 gap-1.5" dir="ltr">
            <template x-for="m in minutes" :key="m">
              <button type="button" @click="pickMinute(m)" :class="minuteClass(m)" class="min-h-11 rounded-xl text-base font-extrabold tabular-nums transition" x-text="minuteText(m)"></button>
            </template>
          </div>

          <div class="mt-5 flex gap-2">
            <button type="button" @click="applyPicker()" class="min-h-14 flex-1 rounded-2xl bg-emerald-600 text-base font-extrabold text-white shadow-sm active:bg-emerald-700">تأیید</button>
            <button type="button" @click="clearPickerValue()" class="min-h-14 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-600 active:bg-slate-100">پاک کردن</button>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>
