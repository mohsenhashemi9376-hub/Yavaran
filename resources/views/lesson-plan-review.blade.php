<!doctype html>
<html lang="fa" dir="rtl" translate="no" class="notranslate">
  <head>
    <meta charset="UTF-8" />
    <meta name="google" content="notranslate" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0b4838" />
    <meta name="robots" content="noindex, nofollow" />
    <title>کارتابل بررسی طرح درس‌ها</title>
    <link rel="icon" href="/favicon.ico?v=2" sizes="any" />
    @vite(['resources/css/review.css', 'resources/js/lesson-review.js'])
  </head>
  <body class="bg-slate-50 text-slate-900 antialiased">
    <script type="application/json" id="review-config">@json($config)</script>

    <main x-data="lessonReview" x-cloak class="mx-auto max-w-5xl px-4 pb-16 pt-4">
      {{-- هدر --}}
      <header class="mb-4">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <h1 class="text-xl font-extrabold text-slate-900">کارتابل بررسی طرح درس‌ها</h1>
            <p class="mt-0.5 text-xs font-medium text-slate-500">معاونت آموزش · سال تحصیلی {{ $config['academicYear'] }}</p>
          </div>
          <a href="/" class="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 shadow-sm active:bg-slate-100">بازگشت</a>
        </div>

        <div class="mt-4 grid grid-cols-3 gap-2">
          <button type="button" @click="setFilter('pending')" :class="statClass('pending')" class="rounded-2xl border bg-white p-3 text-start shadow-sm transition active:bg-slate-50">
            <p class="text-[11px] font-bold text-slate-500">در انتظار بررسی</p>
            <p class="mt-1 text-2xl font-extrabold text-slate-800" x-text="pendingCount"></p>
          </button>
          <button type="button" @click="setFilter('revision')" :class="statClass('revision')" class="rounded-2xl border bg-white p-3 text-start shadow-sm transition active:bg-slate-50">
            <p class="text-[11px] font-bold text-amber-700">نیاز به اصلاح</p>
            <p class="mt-1 text-2xl font-extrabold text-amber-600" x-text="revisionCount"></p>
          </button>
          <button type="button" @click="setFilter('approved')" :class="statClass('approved')" class="rounded-2xl border bg-white p-3 text-start shadow-sm transition active:bg-slate-50">
            <p class="text-[11px] font-bold text-emerald-700">تایید شده</p>
            <p class="mt-1 text-2xl font-extrabold text-emerald-600" x-text="approvedCount"></p>
          </button>
        </div>
      </header>

      <p x-show="loading" class="py-12 text-center text-sm font-medium text-slate-500">در حال بارگذاری…</p>
      <p x-show="hasError" class="mb-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700" x-text="error"></p>
      <p x-show="isEmpty" class="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm font-medium text-slate-500">طرح درسی در این بخش وجود ندارد.</p>

      {{-- گرید طرح درس‌ها --}}
      <section class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="طرح درس‌های ارسالی">
        <template x-for="p in shown" :key="p.id">
          <button type="button" @click="open(p)" class="rounded-2xl border border-slate-200 bg-white p-4 text-start shadow-sm transition hover:border-emerald-300 hover:shadow-md active:scale-[0.99]">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="truncate text-base font-extrabold text-slate-900" x-text="p.teacherName"></p>
                <p class="mt-0.5 truncate text-sm font-bold text-emerald-700" x-text="p.subject"></p>
              </div>
              <span :class="stateClass(p)" class="shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-extrabold" x-text="stateLabel(p)"></span>
            </div>
            <p class="mt-2 line-clamp-2 min-h-12 text-sm leading-6 text-slate-600" x-text="cardTitle(p)"></p>
            <dl class="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
              <div><dt class="inline">کلاس: </dt><dd class="inline font-bold text-slate-700" x-text="p.className"></dd></div>
              <div><dt class="inline">ارسال: </dt><dd class="inline font-bold text-slate-700" x-text="sentText(p)"></dd></div>
            </dl>
          </button>
        </template>
      </section>

      {{-- پیام موفقیت --}}
      <div x-show="hasToast" x-transition class="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-2xl bg-slate-900 p-4 text-center text-sm font-bold text-white shadow-lg" role="status" x-text="toast"></div>

      {{-- مودال بررسی و بازخورد --}}
      <div x-show="hasCurrent" @keydown.escape.window="close()" class="fixed inset-0 z-40 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="بررسی طرح درس">
        <div class="absolute inset-0 bg-slate-900/60" @click="close()"></div>

        <div class="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:max-w-2xl sm:rounded-3xl">
          <div class="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
            <div class="min-w-0">
              <h2 class="truncate text-base font-extrabold text-slate-900" x-text="currentTeacher"></h2>
              <p class="mt-0.5 truncate text-xs font-medium text-slate-500" x-text="currentSubtitle"></p>
            </div>
            <button type="button" @click="close()" class="flex size-11 shrink-0 items-center justify-center rounded-xl text-xl text-slate-500 active:bg-slate-100" aria-label="بستن">✕</button>
          </div>

          <div class="flex-1 space-y-4 overflow-y-auto p-4">
            {{-- خلاصه طرح درس --}}
            <section class="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
              <h3 class="text-xs font-extrabold text-slate-500">خلاصه طرح درس</h3>
              <p class="text-sm font-bold leading-7 text-slate-800" x-text="topicText"></p>

              <div x-show="hasMethods">
                <p class="text-xs font-bold text-slate-500">روش‌های تدریس</p>
                <p class="text-sm leading-7 text-slate-700" x-text="methodsText"></p>
              </div>

              <template x-for="g in objectiveGroups" :key="g.key">
                <div>
                  <p class="text-xs font-bold text-slate-500">اهداف <span x-text="g.title"></span></p>
                  <ul class="mt-1 list-disc space-y-0.5 ps-5 text-sm leading-7 text-slate-700">
                    <template x-for="(item, i) in g.items" :key="i"><li x-text="item"></li></template>
                  </ul>
                </div>
              </template>

              <div x-show="hasSteps">
                <p class="text-xs font-bold text-slate-500">مراحل تدریس</p>
                <ol class="mt-1 space-y-1.5">
                  <template x-for="(s, i) in steps" :key="i">
                    <li class="flex items-start justify-between gap-2 rounded-xl bg-white p-2.5 text-sm leading-6 text-slate-700">
                      <span x-text="s.description"></span>
                      <span class="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500" x-text="stepMinutes(s)"></span>
                    </li>
                  </template>
                </ol>
              </div>

              <template x-for="r in evalRows" :key="r.key">
                <div>
                  <p class="text-xs font-bold text-slate-500" x-text="r.title"></p>
                  <p class="text-sm leading-7 text-slate-700" x-text="r.text"></p>
                </div>
              </template>
            </section>

            <div x-show="hasPreviousFeedback" class="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm leading-7 text-amber-900">
              <p class="text-xs font-extrabold">بازخورد قبلی معاونت</p>
              <p class="whitespace-pre-line" x-text="previousFeedback"></p>
            </div>

            {{-- ثبت بازخورد معاونت --}}
            <section x-show="notFinal" class="space-y-3" aria-label="ثبت بازخورد معاونت">
              <h3 class="text-sm font-extrabold text-slate-800">ثبت بازخورد معاونت</h3>
              <div class="flex flex-wrap gap-2" role="group" aria-label="برچسب‌های بازخورد">
                <template x-for="t in tags" :key="t.key">
                  <button type="button" @click="toggleTag(t.key)" :class="tagClass(t)" :aria-pressed="tagOn(t.key)" class="min-h-11 rounded-full border px-4 text-sm font-bold transition active:scale-95" x-text="t.label"></button>
                </template>
              </div>
              <label class="block">
                <span class="mb-1 block text-xs font-bold text-slate-500">یادداشت اختصاصی معاون</span>
                <textarea rows="4" maxlength="2000" :value="note" @input="setNote($event)" placeholder="نکته‌ی اصلاحی، پیشنهاد یا تقدیر از استاد…" class="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm leading-7 text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"></textarea>
              </label>
            </section>
            <p x-show="isFinal" class="rounded-2xl bg-emerald-50 p-3 text-center text-sm font-bold text-emerald-800">این طرح درس تأیید شده است.</p>
            <p x-show="hasError" class="rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700" x-text="error"></p>
          </div>

          {{-- دکمه‌های اقدام (نزدیک شست) --}}
          <div x-show="notFinal" class="grid grid-cols-1 gap-2 border-t border-slate-100 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:grid-cols-2">
            <button type="button" @click="approve()" :disabled="cannotAct" class="min-h-14 rounded-2xl bg-emerald-600 px-4 text-sm font-extrabold text-white shadow-sm transition active:bg-emerald-700 disabled:opacity-40" x-text="approveLabel"></button>
            <button type="button" @click="sendBack()" :disabled="cannotReturn" class="min-h-14 rounded-2xl bg-amber-500 px-4 text-sm font-extrabold text-white shadow-sm transition active:bg-amber-600 disabled:opacity-40">🔄 ارجاع برای اصلاح</button>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>
