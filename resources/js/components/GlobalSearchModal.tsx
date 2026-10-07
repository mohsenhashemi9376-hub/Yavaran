import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSchool } from '../context/SchoolContext';
import { Student, SchoolClass, User } from '../types';
import { toPersianDigits } from '../utils/persianDate';
import { 
  Search, 
  X, 
  GraduationCap, 
  School, 
  BookOpen, 
  HeartHandshake, 
  Clock, 
  ArrowLeft, 
  Trash2,
  CornerDownLeft,
  ChevronLeft
} from 'lucide-react';
import { Badge } from './ui/Badge';
import { studentFullName } from '../utils/studentName';

export interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStudent: (student: Student) => void;
  onOpenClassDetail: (cls: SchoolClass) => void;
  onSelectTeacher?: (teacher: User) => void;
  onSelectCoach?: (coach: User) => void;
}

interface RecentSearchItem {
  id: string;
  query: string;
  timestamp: number;
}

const RECENT_SEARCHES_KEY = 'yavaran_recent_searches_v2';
const MAX_RECENTS = 6;

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectStudent,
  onOpenClassDetail,
  onSelectTeacher,
  onSelectCoach,
}) => {
  const { students, classes, allTeachers, allCoaches, academicSubjects } = useSchool();
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, [isOpen]);

  const saveRecentSearch = (searchTerm: string) => {
    const trimmed = searchTerm.trim();
    if (!trimmed || trimmed.length < 2) return;
    try {
      const updated = [
        { id: Date.now().toString(), query: trimmed, timestamp: Date.now() },
        ...recentSearches.filter((item) => item.query.toLowerCase() !== trimmed.toLowerCase()),
      ].slice(0, MAX_RECENTS);
      setRecentSearches(updated);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // ignore
    }
  };

  const removeRecentSearch = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = recentSearches.filter((item) => item.id !== id);
    setRecentSearches(updated);
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  // Focus input automatically on open & reset active index
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Normalize search text (trim, Persian/Arabic letter normalization)
  const normalize = (text: string) => {
    return text
      .toLowerCase()
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width
      .trim();
  };

  const cleanQuery = useMemo(() => normalize(query), [query]);

  // Class ID to Class map for quick lookup
  const classMap = useMemo(() => {
    const map = new Map<string, SchoolClass>();
    classes.forEach((c) => map.set(c.id, c));
    return map;
  }, [classes]);

  // Subject ID to name lookup
  const subjectMap = useMemo(() => {
    const map = new Map<string, string>();
    academicSubjects.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [academicSubjects]);

  // Categorized Results
  const matchedStudents = useMemo(() => {
    if (!cleanQuery) return [];
    return students.filter((s) => {
      const fullName = normalize(`${studentFullName(s)}`);
      const reverseName = normalize(`${studentFullName(s)}`);
      const code = s.studentCode || '';
      const nationalId = s.nationalId || '';
      const cls = classMap.get(s.classId);
      const className = cls ? normalize(cls.name) : '';
      return (
        fullName.includes(cleanQuery) ||
        reverseName.includes(cleanQuery) ||
        code.includes(cleanQuery) ||
        nationalId.includes(cleanQuery) ||
        className.includes(cleanQuery)
      );
    }).slice(0, 6);
  }, [cleanQuery, students, classMap]);

  const matchedClasses = useMemo(() => {
    if (!cleanQuery) return [];
    return classes.filter((c) => {
      const name = normalize(c.name);
      const grade = normalize(c.grade || '');
      const room = normalize(c.room || '');
      return name.includes(cleanQuery) || grade.includes(cleanQuery) || room.includes(cleanQuery);
    }).slice(0, 4);
  }, [cleanQuery, classes]);

  const matchedTeachers = useMemo(() => {
    if (!cleanQuery) return [];
    return allTeachers.filter((t) => {
      const name = normalize(t.name);
      const phone = normalize(t.phone || '');
      const subjects = (t.assignedSubjectIds || [])
        .map((id) => normalize(subjectMap.get(id) || ''))
        .join(' ');
      return name.includes(cleanQuery) || phone.includes(cleanQuery) || subjects.includes(cleanQuery);
    }).slice(0, 4);
  }, [cleanQuery, allTeachers, subjectMap]);

  const matchedCoaches = useMemo(() => {
    if (!cleanQuery) return [];
    return allCoaches.filter((c) => {
      const name = normalize(c.name);
      const phone = normalize(c.phone || '');
      const assignedClassNames = (c.assignedClassIds || [])
        .map((cid) => {
          const cls = classMap.get(cid);
          return cls ? normalize(cls.name) : '';
        })
        .join(' ');
      return name.includes(cleanQuery) || phone.includes(cleanQuery) || assignedClassNames.includes(cleanQuery);
    }).slice(0, 4);
  }, [cleanQuery, allCoaches, classMap]);

  // Flatten items for keyboard selection
  type FlatResultItem = 
    | { type: 'student'; item: Student }
    | { type: 'class'; item: SchoolClass }
    | { type: 'teacher'; item: User }
    | { type: 'coach'; item: User };

  const allResults = useMemo<FlatResultItem[]>(() => {
    const list: FlatResultItem[] = [];
    matchedStudents.forEach((s) => list.push({ type: 'student', item: s }));
    matchedClasses.forEach((c) => list.push({ type: 'class', item: c }));
    matchedTeachers.forEach((t) => list.push({ type: 'teacher', item: t }));
    matchedCoaches.forEach((co) => list.push({ type: 'coach', item: co }));
    return list;
  }, [matchedStudents, matchedClasses, matchedTeachers, matchedCoaches]);

  const totalResultsCount = allResults.length;

  // Handle select action
  const handleSelect = (result: FlatResultItem) => {
    saveRecentSearch(query);
    onClose();
    if (result.type === 'student') {
      onSelectStudent(result.item);
    } else if (result.type === 'class') {
      onOpenClassDetail(result.item);
    } else if (result.type === 'teacher' && onSelectTeacher) {
      onSelectTeacher(result.item);
    } else if (result.type === 'coach' && onSelectCoach) {
      onSelectCoach(result.item);
    }
  };

  // Keyboard navigation inside command palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (totalResultsCount > 0) {
        setActiveIndex((prev) => (prev + 1) % totalResultsCount);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (totalResultsCount > 0) {
        setActiveIndex((prev) => (prev - 1 + totalResultsCount) % totalResultsCount);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (totalResultsCount > 0 && allResults[activeIndex]) {
        handleSelect(allResults[activeIndex]);
      }
    }
  };

  // Scroll active item into view
  useEffect(() => {
    const activeEl = resultsContainerRef.current?.querySelector(`[data-result-index="${activeIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  if (!isOpen) return null;

  let runningIndex = -1;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center pt-12 sm:pt-20 p-4 z-[95] animate-in fade-in duration-150"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-2xl flex flex-col shadow-2xl border border-slate-100 overflow-hidden max-h-[85vh] animate-in zoom-in-95 duration-150">
        
        {/* Command Search Header */}
        <div className="relative flex items-center border-b border-slate-100 px-4 sm:px-5 py-3.5 bg-white">
          <Search className="w-5 h-5 text-teal-800 shrink-0 ml-3" />
          <input
            ref={inputRef}
            type="text"
            id="global-search-input-palette"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="جستجوی دانش‌آموز، کلاس، معلم، مربی..."
            className="w-full bg-transparent text-sm sm:text-base font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer ml-1"
              title="پاک کردن متن"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition cursor-pointer font-bold shrink-0 mr-2"
          >
            Esc
          </button>
        </div>

        {/* Results / Suggestions Area */}
        <div 
          ref={resultsContainerRef}
          className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 divide-y divide-slate-100"
        >
          {/* 1. When query is empty: show Recent Searches and Quick Entity Filters */}
          {!cleanQuery && (
            <div className="space-y-4 pt-1">
              {recentSearches.length > 0 && (
                <div>
                  <div className="flex items-center justify-between px-2 pb-2">
                    <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      جستجوهای اخیر
                    </span>
                    <button
                      type="button"
                      onClick={clearRecentSearches}
                      className="text-[11px] text-slate-400 hover:text-rose-600 transition flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      پاک کردن تاریخچه
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 px-1">
                    {recentSearches.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setQuery(item.query);
                          inputRef.current?.focus();
                        }}
                        className="inline-flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-teal-50 hover:text-teal-900 text-slate-700 px-3 py-1.5 rounded-xl transition cursor-pointer border border-slate-200/60"
                      >
                        <Search className="w-3 h-3 text-slate-400" />
                        <span>{item.query}</span>
                        <span 
                          onClick={(e) => removeRecentSearch(item.id, e)}
                          className="hover:text-rose-600 p-0.5 rounded-md hover:bg-white/60"
                          title="حذف"
                        >
                          <X className="w-3 h-3" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick access shortcuts */}
              <div className="pt-2">
                <span className="text-xs font-bold text-slate-500 block px-2 pb-2">
                  دسترسی‌های سریع بر اساس بخش
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('کلاس');
                      inputRef.current?.focus();
                    }}
                    className="p-3 text-right rounded-xl bg-slate-50 hover:bg-teal-50/70 border border-slate-200/70 hover:border-teal-200 transition cursor-pointer group"
                  >
                    <School className="w-4 h-4 text-teal-700 mb-1.5 group-hover:scale-110 transition-transform" />
                    <div className="text-xs font-bold text-slate-800">کلاس‌ها</div>
                    <div className="text-[10px] text-slate-500">{toPersianDigits(classes.length)} کلاس فعال</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setQuery('دانش‌آموز');
                      inputRef.current?.focus();
                    }}
                    className="p-3 text-right rounded-xl bg-slate-50 hover:bg-teal-50/70 border border-slate-200/70 hover:border-teal-200 transition cursor-pointer group"
                  >
                    <GraduationCap className="w-4 h-4 text-emerald-700 mb-1.5 group-hover:scale-110 transition-transform" />
                    <div className="text-xs font-bold text-slate-800">دانش‌آموزان</div>
                    <div className="text-[10px] text-slate-500">{toPersianDigits(students.length)} دانش‌آموز</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setQuery('معلم');
                      inputRef.current?.focus();
                    }}
                    className="p-3 text-right rounded-xl bg-slate-50 hover:bg-teal-50/70 border border-slate-200/70 hover:border-teal-200 transition cursor-pointer group"
                  >
                    <BookOpen className="w-4 h-4 text-amber-700 mb-1.5 group-hover:scale-110 transition-transform" />
                    <div className="text-xs font-bold text-slate-800">دبیران</div>
                    <div className="text-[10px] text-slate-500">{toPersianDigits(allTeachers.length)} دبیر تخصصی</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setQuery('مربی');
                      inputRef.current?.focus();
                    }}
                    className="p-3 text-right rounded-xl bg-slate-50 hover:bg-teal-50/70 border border-slate-200/70 hover:border-teal-200 transition cursor-pointer group"
                  >
                    <HeartHandshake className="w-4 h-4 text-purple-700 mb-1.5 group-hover:scale-110 transition-transform" />
                    <div className="text-xs font-bold text-slate-800">مربیان تربیتی</div>
                    <div className="text-[10px] text-slate-500">{toPersianDigits(allCoaches.length)} مربی فعال</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. When query is not empty and results found */}
          {cleanQuery && totalResultsCount > 0 && (
            <div className="space-y-4 pt-1">
              {/* بخش دانش‌آموزان */}
              {matchedStudents.length > 0 && (
                <div>
                  <div className="flex items-center justify-between px-2 pb-2">
                    <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-teal-700" />
                      دانش‌آموزان ({toPersianDigits(matchedStudents.length)})
                    </span>
                  </div>
                  <div className="space-y-1">
                    {matchedStudents.map((st) => {
                      runningIndex++;
                      const isCurrentActive = activeIndex === runningIndex;
                      const cls = classMap.get(st.classId);
                      return (
                        <div
                          key={st.id}
                          data-result-index={runningIndex}
                          onClick={() => handleSelect({ type: 'student', item: st })}
                          className={`
                            flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition select-none
                            ${
                              isCurrentActive
                                ? 'bg-teal-50 border border-teal-200 text-teal-950'
                                : 'hover:bg-slate-50 border border-transparent text-slate-800'
                            }
                          `}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-teal-100/70 text-teal-800 flex items-center justify-center shrink-0 font-bold text-xs">
                              {st.firstName[0]}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs sm:text-sm font-bold truncate">
                                {studentFullName(st)}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5">
                                <span>{cls ? cls.name : 'بدون کلاس'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant={st.disciplineScore >= 18 ? 'success' : st.disciplineScore >= 15 ? 'warning' : 'danger'} size="sm">
                              نمره انضباط: {toPersianDigits(st.disciplineScore)}
                            </Badge>
                            <ChevronLeft className="w-4 h-4 text-slate-400" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* بخش کلاس‌ها */}
              {matchedClasses.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center justify-between px-2 pb-2">
                    <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                      <School className="w-3.5 h-3.5 text-blue-700" />
                      کلاس‌ها ({toPersianDigits(matchedClasses.length)})
                    </span>
                  </div>
                  <div className="space-y-1">
                    {matchedClasses.map((cls) => {
                      runningIndex++;
                      const isCurrentActive = activeIndex === runningIndex;
                      const studentCount = students.filter((s) => s.classId === cls.id).length;
                      return (
                        <div
                          key={cls.id}
                          data-result-index={runningIndex}
                          onClick={() => handleSelect({ type: 'class', item: cls })}
                          className={`
                            flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition select-none
                            ${
                              isCurrentActive
                                ? 'bg-teal-50 border border-teal-200 text-teal-950'
                                : 'hover:bg-slate-50 border border-transparent text-slate-800'
                            }
                          `}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-800 border border-blue-100 flex items-center justify-center shrink-0">
                              <School className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs sm:text-sm font-bold truncate">
                                {cls.name}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5">
                                <span>{cls.grade}</span>
                                {cls.room && (
                                  <>
                                    <span>•</span>
                                    <span>اتاق {toPersianDigits(cls.room)}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="info" size="sm">
                              {toPersianDigits(studentCount)} دانش‌آموز
                            </Badge>
                            <ChevronLeft className="w-4 h-4 text-slate-400" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* بخش معلمان */}
              {matchedTeachers.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center justify-between px-2 pb-2">
                    <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                      معلمان و دبیران ({toPersianDigits(matchedTeachers.length)})
                    </span>
                  </div>
                  <div className="space-y-1">
                    {matchedTeachers.map((tc) => {
                      runningIndex++;
                      const isCurrentActive = activeIndex === runningIndex;
                      const subjects = (tc.assignedSubjectIds || [])
                        .map((id) => subjectMap.get(id))
                        .filter(Boolean)
                        .join('، ');
                      return (
                        <div
                          key={tc.id}
                          data-result-index={runningIndex}
                          onClick={() => handleSelect({ type: 'teacher', item: tc })}
                          className={`
                            flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition select-none
                            ${
                              isCurrentActive
                                ? 'bg-teal-50 border border-teal-200 text-teal-950'
                                : 'hover:bg-slate-50 border border-transparent text-slate-800'
                            }
                          `}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-800 border border-amber-100 flex items-center justify-center shrink-0">
                              <BookOpen className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs sm:text-sm font-bold truncate">
                                {tc.name}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5">
                                <span>{subjects || 'دبیر عمومی'}</span>
                                {tc.phone && (
                                  <>
                                    <span>•</span>
                                    <span dir="ltr">{toPersianDigits(tc.phone)}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="neutral" size="sm">
                              دبیر
                            </Badge>
                            <ChevronLeft className="w-4 h-4 text-slate-400" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* بخش مربیان */}
              {matchedCoaches.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center justify-between px-2 pb-2">
                    <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                      <HeartHandshake className="w-3.5 h-3.5 text-purple-700" />
                      مربیان تربیتی ({toPersianDigits(matchedCoaches.length)})
                    </span>
                  </div>
                  <div className="space-y-1">
                    {matchedCoaches.map((ch) => {
                      runningIndex++;
                      const isCurrentActive = activeIndex === runningIndex;
                      const coachClassNames = (ch.assignedClassIds || [])
                        .map((cid) => classMap.get(cid)?.name)
                        .filter(Boolean)
                        .join('، ');
                      return (
                        <div
                          key={ch.id}
                          data-result-index={runningIndex}
                          onClick={() => handleSelect({ type: 'coach', item: ch })}
                          className={`
                            flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition select-none
                            ${
                              isCurrentActive
                                ? 'bg-teal-50 border border-teal-200 text-teal-950'
                                : 'hover:bg-slate-50 border border-transparent text-slate-800'
                            }
                          `}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-800 border border-purple-100 flex items-center justify-center shrink-0">
                              <HeartHandshake className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs sm:text-sm font-bold truncate">
                                {ch.name}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5">
                                <span>کلاس‌های تحت مسئولیت: {coachClassNames || 'کلیه کلاس‌ها'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="info" size="sm">
                              مربی تربیتی
                            </Badge>
                            <ChevronLeft className="w-4 h-4 text-slate-400" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. When query is entered but nothing matches (Empty State) */}
          {cleanQuery && totalResultsCount === 0 && (
            <div className="py-10 px-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Search className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 mb-1">
                نتیجه‌ای پیدا نشد
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                هیچ دانش‌آموز، کلاس، معلم یا مربی با عبارت «{query}» پیدا نشد. لطفاً نام یا شماره دیگری را امتحان کنید.
              </p>
            </div>
          )}
        </div>

        {/* Footer with keyboard hints */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono shadow-2xs">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono shadow-2xs">↓</kbd>
              جابجایی
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono shadow-2xs">↵ Enter</kbd>
              انتخاب
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono shadow-2xs">Esc</kbd>
              خروج
            </span>
          </div>

          <span className="text-teal-800 font-bold">
            دبیرستان دوره اول یاوران ولایت
          </span>
        </div>
      </div>
    </div>
  );
};
