import React, { useState } from 'react';
import { useSchool } from '../context/SchoolContext';
import { YavaranLogo } from './YavaranLogo';
import { Lock, User, KeyRound, AlertCircle, CheckCircle2, Shield, GraduationCap, School, X, ArrowLeft, HeartHandshake } from 'lucide-react';
import { toPersianDigits } from '../utils/persianDate';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { allUsers, login, currentUser } = useSchool();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedDemoUser, setSelectedDemoUser] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg('');
    setIsSubmitting(true);

    const res = await login(username, password);
    setIsSubmitting(false);
    if (res.success) {
      setPassword('');
      onClose();
    } else {
      setErrorMsg(res.message || 'نام کاربری یا رمز عبور اشتباه است.');
    }
  };

  const handleQuickSelectUser = (u: typeof allUsers[0]) => {
    setUsername(u.username || u.phone);
    setPassword(u.password || '123');
    setSelectedDemoUser(u.id);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute left-4 top-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center text-center space-y-3">
            <YavaranLogo size="lg" />
            <div>
              <h3 className="text-lg font-black text-white">ورود به سامانه مدرسه یاوران ولایت</h3>
              <p className="text-xs text-emerald-300 mt-0.5">
                ورود دبیران، معاونین و مدیریت با نام کاربری و کلمه عبور
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 font-bold animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                نام کاربری یا شماره همراه
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="مثال: admin یا rezaei یا شماره موبایل"
                  dir="ltr"
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 text-left"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                کلمه عبور (پیش‌فرض حساب‌ها: ۱۲۳)
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="رمز عبور خود را وارد نمایید"
                  dir="ltr"
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 text-left"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-md shadow-emerald-600/20 cursor-pointer flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>ورود امن به سامانه</span>
            </button>
          </form>

          {/* Quick Demo Switcher Table */}
          {allUsers.length > 0 && (
          <div className="pt-4 border-t border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>حساب‌های پیش‌فرض جهت آزمون و جابجایی سریع:</span>
              <span className="text-[10px] text-slate-400">کلیک برای انتخاب</span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {allUsers.map((u) => {
                const isSelected = (username === u.username || username === u.phone) || selectedDemoUser === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleQuickSelectUser(u)}
                    className={`w-full text-right p-2.5 rounded-xl border text-xs flex items-center justify-between transition cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                        u.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                        u.role === 'vice_educational' ? 'bg-blue-100 text-blue-800' :
                        u.role === 'vice_disciplinary' ? 'bg-rose-100 text-rose-800' :
                        u.role === 'vice_nurturing' ? 'bg-teal-100 text-teal-800' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {u.role === 'admin' ? <Shield className="w-3.5 h-3.5" /> :
                         u.role === 'vice_educational' ? <School className="w-3.5 h-3.5" /> :
                         u.role === 'vice_disciplinary' ? <Lock className="w-3.5 h-3.5" /> :
                         u.role === 'vice_nurturing' ? <HeartHandshake className="w-3.5 h-3.5" /> :
                         <GraduationCap className="w-3.5 h-3.5" />}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{u.name}</div>
                        <div className="text-[10px] text-slate-500">{u.roleTitle}</div>
                      </div>
                    </div>

                    <div className="text-left font-mono text-[11px] text-slate-500">
                      <div>نام کاربری: <span className="font-bold text-slate-800">{u.username || u.phone}</span></div>
                      <div>رمز: <span className="text-slate-600">{u.password || '123'}</span></div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          )}

        </div>

      </div>
    </div>
  );
};
