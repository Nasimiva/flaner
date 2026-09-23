import React, { useEffect, useState } from 'react';
import { LockKeyhole, LogOut, ShieldCheck } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { AdminPanel } from './AdminPanel';

export const AdminAccess: React.FC = () => {
  const { setIsAdminOpen } = useShop();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/admin/session')
      .then((response) => response.json())
      .then((data) => {
        setAuthenticated(Boolean(data.authenticated));
        if (data.email) setEmail(data.email);
      })
      .catch(() => setError('Не удалось проверить защищённую сессию.'))
      .finally(() => setChecking(false));
  }, []);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Не удалось выполнить вход.');
      }
      setCode('');
      setAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выполнить вход.');
    } finally {
      setSubmitting(false);
    }
  };

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => undefined);
    setAuthenticated(false);
    setIsAdminOpen(false);
  };

  if (checking) return <div className="min-h-screen grid place-items-center text-sm text-[#6E5C51]">Проверяем доступ…</div>;
  if (authenticated) {
    return (
      <>
        <button onClick={logout} className="fixed right-4 bottom-4 z-50 rounded-full bg-[#2A2421] px-4 py-2 text-xs font-semibold text-white shadow-lg flex items-center gap-2">
          <LogOut className="h-3.5 w-3.5" /> Выйти из админки
        </button>
        <AdminPanel />
      </>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F4F0] grid place-items-center p-4">
      <form onSubmit={login} className="w-full max-w-sm rounded-3xl border border-[#EAE3DC] bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 text-[#2A2421]"><span className="rounded-2xl bg-[#F3ECE5] p-3"><ShieldCheck /></span><div><h1 className="font-bold">Защищённый вход</h1><p className="text-xs text-[#7A6B62]">Только для разрешённых администраторов</p></div></div>
        <label className="block text-xs font-medium text-[#52443C]">Рабочий e-mail<input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#DFD6CD] bg-[#FAF8F5] px-3 py-2.5 text-sm outline-none focus:border-[#2A2421]" /></label>
        <label className="block text-xs font-medium text-[#52443C]">Код доступа<input required type="password" autoComplete="current-password" value={code} onChange={(e) => setCode(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#DFD6CD] bg-[#FAF8F5] px-3 py-2.5 text-sm outline-none focus:border-[#2A2421]" /></label>
        {error && <p className="text-xs text-red-700">{error}</p>}
        <button disabled={submitting} className="w-full rounded-xl bg-[#2A2421] py-3 text-sm font-semibold text-white disabled:opacity-60"><LockKeyhole className="mr-2 inline h-4 w-4" />{submitting ? 'Входим…' : 'Войти'}</button>
        <button type="button" onClick={() => setIsAdminOpen(false)} className="w-full text-xs text-[#6E5C51]">Вернуться в магазин</button>
      </form>
    </main>
  );
};
