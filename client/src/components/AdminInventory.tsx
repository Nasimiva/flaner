import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShop } from '../context/ShopContext';
import { categoryLabelById } from '../utils/categories';
import { AdminApiError } from '../utils/adminLeadsApi';
import {
  BACKUP_FILES,
  MOVEMENT_LABELS,
  fetchBackup,
  isResetConfirmed,
  resetWarehouse,
  RESET_CONFIRM_WORD,
  addReceipt,
  cancelSale,
  currentMonth,
  formatSum,
  getReport,
  listMovements,
  listStock,
  parseAmount,
  reportCsvUrl,
  sellProduct,
  setCostPrice,
  setStock,
  stockLevel,
  stockTotals,
  type Movement,
  type MovementKind,
  type MovementPage,
  type MonthlyReport,
  type StockFilters,
  type StockItem,
  type StockList
} from '../utils/inventoryApi';
import { AlertCircle, ChevronLeft, ChevronRight, Download, Minus, Trash2, PackagePlus, Pencil, RefreshCw, Search, Undo2, X } from 'lucide-react';

// Admin-only screens: warehouse ("Склад"), monthly report ("Отчёт") and the movement journal ("Журнал").
// Quantities, cost price and sales are loaded only here, from /api/admin/inventory; the storefront never sees them.

const inputClass = 'w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DFD6CD] rounded-xl focus:outline-none focus:border-[#2A2421]';
const cardClass = 'bg-white rounded-2xl border border-[#EAE3DC] shadow-xs';
const primaryButton = 'bg-[#2A2421] hover:bg-[#3D3531] disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all';
const secondaryButton = 'bg-[#F5EFEB] hover:bg-[#EAE1D7] disabled:opacity-50 text-[#2A2421] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors';

const errorMessage = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

const formatDateTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tashkent' });
};

const ErrorBox: React.FC<{ error: AdminApiError | Error; onRetry: () => void }> = ({ error, onRetry }) => (
  <div role="alert" className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 flex items-start gap-3">
    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
    <div className="flex-1 text-sm">
      <p className="font-semibold">{error.message}</p>
      <button onClick={onRetry} className="mt-2 text-xs font-semibold underline">Повторить</button>
    </div>
  </div>
);

const StockBadge: React.FC<{ count: number }> = ({ count }) => {
  const level = stockLevel(count);
  const style = level === 'zero' ? 'bg-rose-100 text-rose-800' : level === 'low' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800';
  return <span data-testid="stock-badge" className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${style}`}>{count} шт.</span>;
};

const Stat: React.FC<{ label: string; value: string; testId?: string }> = ({ label, value, testId }) => (
  <div className={`${cardClass} p-3.5`}>
    <div className="text-[10px] uppercase font-bold tracking-wider text-[#8A796F]">{label}</div>
    <div data-testid={testId} className="text-base font-bold text-[#2A2421] mt-0.5 break-words">{value}</div>
  </div>
);

// ---------------------------------------------------------------------------------------------
// Warehouse
// ---------------------------------------------------------------------------------------------

type RowMode = 'sale' | 'receipt' | 'set';

const RowPanel: React.FC<{
  item: StockItem;
  mode: RowMode;
  onClose: () => void;
  onChanged: (item: StockItem) => void;
}> = ({ item, mode, onClose, onChanged }) => {
  const { showToast } = useShop();
  const [quantity, setQuantity] = useState(mode === 'set' ? String(item.stockCount) : '1');
  const [price, setPrice] = useState(String(mode === 'sale' ? item.price : item.costPrice));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const qty = parseAmount(quantity);
    const money = parseAmount(price);
    if (qty === undefined || Number.isNaN(qty) || !Number.isInteger(qty) || qty < (mode === 'set' ? 0 : 1)) {
      return setError(mode === 'set' ? 'Остаток — целое число, не меньше 0.' : 'Количество — целое число, не меньше 1.');
    }
    if (money !== undefined && (Number.isNaN(money) || money < 0)) return setError('Цена — число, не меньше 0.');
    if (mode === 'sale' && qty > item.stockCount) return setError(`Недостаточно товара на складе: осталось ${item.stockCount} шт.`);
    if (mode === 'sale' && money === undefined) return setError('Укажите цену продажи.');
    setError('');
    setBusy(true);
    try {
      if (mode === 'sale') {
        // The regular price is sent as "no price", so the server records exactly the catalog price at that moment.
        const result = await sellProduct(item.id, { quantity: qty, unitPrice: money === item.price ? undefined : money, note: note.trim() || undefined });
        onChanged(result.product);
        showToast(`Продано: ${item.name} × ${qty}. Осталось ${result.product.stockCount} шт.`);
      } else if (mode === 'receipt') {
        const result = await addReceipt(item.id, { quantity: qty, costPrice: money, note: note.trim() || undefined });
        onChanged(result.product);
        showToast(`Приход: ${item.name} + ${qty}. Теперь ${result.product.stockCount} шт.`);
      } else {
        let latest = item;
        if (qty !== item.stockCount) latest = (await setStock(item.id, qty, note.trim() || undefined)).product;
        if (money !== undefined && money !== latest.costPrice) latest = (await setCostPrice(item.id, money)).product;
        onChanged(latest);
        showToast('Склад обновлён');
      }
      onClose();
    } catch (cause) {
      setError(errorMessage(cause, 'Не удалось сохранить.'));
    } finally {
      setBusy(false);
    }
  };

  const labels = mode === 'sale'
    ? { qty: 'Сколько продано', money: 'Цена продажи за шт. (со скидкой — укажите свою)', button: 'Записать продажу' }
    : mode === 'receipt'
      ? { qty: 'Сколько пришло', money: 'Закупочная цена за шт. (необязательно)', button: 'Добавить приход' }
      : { qty: 'Остаток на складе', money: 'Закупочная цена за шт.', button: 'Сохранить' };

  return (
    <div className="mt-3 pt-3 border-t border-[#F2ECE5] space-y-2" data-testid={`row-panel-${mode}`}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="text-[11px] text-[#6E5C51] font-medium">
          {labels.qty}
          <input inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} className={`${inputClass} mt-1`} data-testid="row-quantity" autoFocus />
        </label>
        <label className="text-[11px] text-[#6E5C51] font-medium">
          {labels.money}
          <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} className={`${inputClass} mt-1`} data-testid="row-price" />
        </label>
        <label className="text-[11px] text-[#6E5C51] font-medium">
          Заметка (необязательно)
          <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className={`${inputClass} mt-1`} />
        </label>
      </div>
      {error && <p role="alert" data-testid="row-error" className="text-xs font-semibold text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={busy} className={primaryButton} data-testid="row-submit">{busy ? 'Сохраняем…' : labels.button}</button>
        <button onClick={onClose} disabled={busy} className={secondaryButton}>Отмена</button>
      </div>
    </div>
  );
};

/** Saves a Blob through a temporary link; the browser puts it in the downloads folder. */
const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

const ResetDialog: React.FC<{ onClose: () => void; onDone: () => void }> = ({ onClose, onDone }) => {
  const { showToast } = useShop();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    if (!isResetConfirmed(typed) || busy) return;
    setBusy(true);
    setError('');
    try {
      // 1. The backups come first. If either cannot be fetched, nothing is deleted.
      const stamp = new Date().toISOString().slice(0, 10);
      const files = await Promise.all(BACKUP_FILES.map(async (file) => ({ filename: file.filename, blob: await fetchBackup(file.url) })));
      for (const file of files) saveBlob(file.blob, `${stamp}-${file.filename}`);
      // 2. Only then the reset itself.
      const result = await resetWarehouse();
      showToast(`Склад обнулён: товаров ${result.productsReset}, записей журнала удалено ${result.movementsDeleted}. Копии скачаны.`, 'info');
      onDone();
      onClose();
    } catch (cause) {
      setError(errorMessage(cause, 'Не удалось обнулить склад.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="reset-title" data-testid="reset-dialog">
      <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-3 shadow-xl">
        <h3 id="reset-title" className="text-base font-bold text-[#2A2421]">Обнулить склад?</h3>
        <ul className="text-xs text-[#52443C] list-disc pl-4 space-y-1">
          <li>Остаток каждого товара станет 0.</li>
          <li>История приходов, продаж и пересчётов будет удалена, отчёты за прошлые месяцы опустеют.</li>
          <li>Отметка «В наличии» на сайте и закупочные цены не изменятся.</li>
          <li>Перед удалением на ваш компьютер скачаются два файла CSV: текущие остатки и журнал. Это единственная копия, сохраните их.</li>
        </ul>
        <label className="block text-[11px] text-[#6E5C51] font-medium">
          Для подтверждения введите слово <b>{RESET_CONFIRM_WORD}</b>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') run(); }} className={`${inputClass} mt-1`} autoFocus autoComplete="off" data-testid="reset-confirm-input" />
        </label>
        {error && <p role="alert" data-testid="reset-error" className="text-xs font-semibold text-red-700">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} disabled={busy} className={secondaryButton}>Отмена</button>
          <button onClick={run} disabled={!isResetConfirmed(typed) || busy} className="bg-red-700 hover:bg-red-800 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5" data-testid="reset-submit">
            <Trash2 className="w-3.5 h-3.5" /> {busy ? 'Скачиваем копии и обнуляем…' : 'Скачать копии и обнулить'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const AdminStock: React.FC = () => {
  const { categories } = useShop();
  const [filters, setFilters] = useState<StockFilters>({ q: '', category: '', brand: '', stock: 'all' });
  const [query, setQuery] = useState('');
  const [data, setData] = useState<StockList | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<{ id: string; mode: RowMode } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const requestId = useRef(0);

  // Typing in the search box waits for a pause before asking the server.
  useEffect(() => {
    const timer = setTimeout(() => setFilters((current) => (current.q === query ? current : { ...current, q: query })), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const result = await listStock(filters);
      if (id !== requestId.current) return;
      setData(result);
      setError(null);
    } catch (cause) {
      if (id === requestId.current) setError(cause instanceof Error ? cause : new Error('Не удалось загрузить склад.'));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const replaceItem = (updated: StockItem) =>
    setData((current) => current && { ...current, items: current.items.map((item) => (item.id === updated.id ? updated : item)) });

  // Totals follow the visible rows, so they stay right after a sale without another request.
  const totals = useMemo(() => stockTotals(data?.items ?? []), [data]);

  return (
    <div className="space-y-4" data-testid="admin-stock">
      <div className={`${cardClass} p-3.5 grid grid-cols-1 sm:grid-cols-4 gap-2.5`}>
        <div className="relative sm:col-span-4">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A796F]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по названию или бренду..." className={`${inputClass} pl-9`} data-testid="stock-search" />
        </div>
        <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} className={inputClass} aria-label="Категория">
          <option value="">Все категории</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <select value={filters.brand} onChange={(e) => setFilters({ ...filters, brand: e.target.value })} className={inputClass} aria-label="Бренд">
          <option value="">Все бренды</option>
          {(data?.brands ?? []).map((brand) => <option key={brand} value={brand}>{brand}</option>)}
        </select>
        <select value={filters.stock} onChange={(e) => setFilters({ ...filters, stock: e.target.value as StockFilters['stock'] })} className={inputClass} aria-label="Остаток">
          <option value="all">Любой остаток</option>
          <option value="in">Достаточно (больше 2)</option>
          <option value="low">Мало (1–2 шт.)</option>
          <option value="zero">Нет в наличии (0)</option>
        </select>
        <button onClick={load} disabled={loading} className={secondaryButton}><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Обновить</button>
        <button onClick={() => setResetOpen(true)} className="sm:col-span-4 sm:w-fit text-xs font-semibold text-red-700 hover:bg-red-50 rounded-xl px-3 py-2 flex items-center gap-1.5 border border-red-200" data-testid="btn-reset-stock"><Trash2 className="w-3.5 h-3.5" /> Обнулить склад</button>
      </div>

      {resetOpen && <ResetDialog onClose={() => setResetOpen(false)} onDone={load} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Товаров" value={String(totals.products)} testId="stock-total-products" />
        <Stat label="Штук на складе" value={totals.units.toLocaleString('ru-RU')} testId="stock-total-units" />
        <Stat label="Стоимость (закупка)" value={formatSum(totals.costValue)} testId="stock-total-cost" />
        <Stat label="Стоимость (розница)" value={formatSum(totals.retailValue)} testId="stock-total-retail" />
      </div>

      {error && <ErrorBox error={error} onRetry={load} />}

      {data && data.items.length === 0 && !error && <div className={`${cardClass} p-6 text-center text-sm text-[#8A796F]`}>Ничего не найдено.</div>}

      <div className="space-y-2.5">
        {(data?.items ?? []).map((item) => {
          const panel = open?.id === item.id ? open.mode : null;
          return (
            <div key={item.id} className={`${cardClass} p-3.5`} data-testid="stock-row">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#8A796F] block">{item.brand}</span>
                  <h4 className="text-xs font-bold text-[#2A2421]">{item.name}</h4>
                  <div className="text-[11px] text-[#7A6B62] mt-0.5">
                    {categoryLabelById(categories, item.category, 'ru')}{item.volume ? ` • ${item.volume}` : ''} • цена {formatSum(item.price)} • закупка {item.costPrice > 0 ? formatSum(item.costPrice) : 'не указана'}
                  </div>
                  {item.stockCount > 0 && !item.inStock && <div className="text-[11px] text-amber-700 mt-0.5">Остаток есть, но на сайте помечен «Нет в наличии» (вкладка «Товары»).</div>}
                  {item.stockCount === 0 && item.inStock && <div className="text-[11px] text-amber-700 mt-0.5">Остаток 0, но на сайте помечен «В наличии». Сделайте приход или пересчёт.</div>}
                </div>
                <StockBadge count={item.stockCount} />
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setOpen({ id: item.id, mode: 'sale' })} disabled={item.stockCount === 0} className={primaryButton} data-testid="btn-sold"><Minus className="w-3.5 h-3.5" /> Продано</button>
                  <button onClick={() => setOpen({ id: item.id, mode: 'receipt' })} className={secondaryButton} data-testid="btn-receipt"><PackagePlus className="w-3.5 h-3.5" /> + приход</button>
                  <button onClick={() => setOpen({ id: item.id, mode: 'set' })} className={secondaryButton} title="Указать точный остаток и закупочную цену" data-testid="btn-edit-stock"><Pencil className="w-3.5 h-3.5" /> Остаток</button>
                </div>
              </div>
              {panel && <RowPanel key={`${item.id}-${panel}`} item={item} mode={panel} onClose={() => setOpen(null)} onChanged={replaceItem} />}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
// Monthly report
// ---------------------------------------------------------------------------------------------

export const AdminReport: React.FC = () => {
  const [month, setMonth] = useState(currentMonth());
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    const id = ++requestId.current;
    setLoading(true);
    try {
      const result = await getReport(month);
      if (id !== requestId.current) return;
      setReport(result);
      setError(null);
    } catch (cause) {
      if (id === requestId.current) setError(cause instanceof Error ? cause : new Error('Не удалось загрузить отчёт.'));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const totals = report?.totals;
  return (
    <div className="space-y-4" data-testid="admin-report">
      <div className={`${cardClass} p-3.5 flex flex-col sm:flex-row gap-3 sm:items-end`}>
        <label className="text-[11px] text-[#6E5C51] font-medium">
          Месяц
          <input type="month" value={month} max={currentMonth()} onChange={(e) => setMonth(e.target.value)} className={`${inputClass} mt-1`} data-testid="report-month" />
        </label>
        <button onClick={load} disabled={loading} className={secondaryButton}><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Обновить</button>
        <a href={reportCsvUrl(month)} download className={`${primaryButton} sm:ml-auto`} data-testid="report-export"><Download className="w-3.5 h-3.5" /> Скачать для Excel (CSV)</a>
      </div>

      {error && <ErrorBox error={error} onRetry={load} />}

      {report && totals && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Stat label="Продано штук" value={totals.quantity.toLocaleString('ru-RU')} testId="report-total-qty" />
            <Stat label="Выручка" value={formatSum(totals.revenue)} testId="report-total-revenue" />
            <Stat label="Себестоимость" value={formatSum(totals.cost)} testId="report-total-cost" />
            <Stat label="Прибыль" value={formatSum(totals.profit)} testId="report-total-profit" />
            <Stat label="Продаж (раз)" value={String(totals.salesCount)} />
          </div>

          <div className={`${cardClass} overflow-x-auto`}>
            <table className="w-full text-xs min-w-[640px]" data-testid="report-table">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-[#8A796F] border-b border-[#F2ECE5]">
                  <th className="p-3">Товар</th>
                  <th className="p-3 text-right">Продан (раз)</th>
                  <th className="p-3 text-right">Штук</th>
                  <th className="p-3 text-right">Выручка</th>
                  <th className="p-3 text-right">Себестоимость</th>
                  <th className="p-3 text-right">Прибыль</th>
                </tr>
              </thead>
              <tbody>
                {report.lines.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-[#8A796F]">За этот месяц продаж нет.</td></tr>}
                {report.lines.map((line) => (
                  <tr key={`${line.productId ?? 'deleted'}-${line.name}`} className="border-b border-[#F8F4EF]" data-testid="report-row">
                    <td className="p-3"><div className="font-semibold text-[#2A2421]">{line.name}</div><div className="text-[10px] text-[#8A796F]">{line.brand}</div></td>
                    <td className="p-3 text-right">{line.salesCount}</td>
                    <td className="p-3 text-right font-bold">{line.quantity}</td>
                    <td className="p-3 text-right">{formatSum(line.revenue)}</td>
                    <td className="p-3 text-right">{formatSum(line.cost)}</td>
                    <td className={`p-3 text-right font-semibold ${line.profit < 0 ? 'text-red-700' : 'text-emerald-800'}`}>{formatSum(line.profit)}</td>
                  </tr>
                ))}
              </tbody>
              {report.lines.length > 0 && (
                <tfoot>
                  <tr className="font-bold text-[#2A2421] bg-[#FAF8F5]">
                    <td className="p-3">Итого</td>
                    <td className="p-3 text-right">{totals.salesCount}</td>
                    <td className="p-3 text-right">{totals.quantity}</td>
                    <td className="p-3 text-right">{formatSum(totals.revenue)}</td>
                    <td className="p-3 text-right">{formatSum(totals.cost)}</td>
                    <td className="p-3 text-right">{formatSum(totals.profit)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="text-[11px] text-[#8A796F]">Себестоимость считается по закупочной цене, которая была у товара в момент продажи. Если закупочная цена не указана, она равна 0 и прибыль завышена.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <StockEntries title={`Нет в наличии (0 шт.) — ${report.outOfStock.length}`} entries={report.outOfStock} tone="zero" testId="report-out-of-stock" />
            <StockEntries title={`Мало на складе (1–${report.lowStockLimit} шт.) — ${report.lowStock.length}`} entries={report.lowStock} tone="low" testId="report-low-stock" />
          </div>
        </>
      )}
    </div>
  );
};

const StockEntries: React.FC<{ title: string; entries: Array<{ id: string; name: string; brand: string; stockCount: number }>; tone: 'zero' | 'low'; testId: string }> = ({ title, entries, tone, testId }) => (
  <div className={`${cardClass} p-3.5`} data-testid={testId}>
    <h3 className="text-sm font-bold text-[#2A2421] mb-2">{title}</h3>
    {entries.length === 0 ? <p className="text-xs text-[#8A796F]">Таких товаров нет.</p> : (
      <ul className="max-h-72 overflow-y-auto divide-y divide-[#F2ECE5]">
        {entries.map((entry) => (
          <li key={entry.id} className="py-1.5 flex items-center justify-between gap-2 text-xs">
            <span className="min-w-0"><span className="text-[10px] uppercase font-bold text-[#8A796F]">{entry.brand}</span> {entry.name}</span>
            <span className={`font-bold ${tone === 'zero' ? 'text-rose-700' : 'text-amber-700'}`}>{entry.stockCount} шт.</span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

// ---------------------------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------------------------

const JOURNAL_PAGE_SIZE = 30;
const KIND_STYLES: Record<MovementKind, string> = {
  receipt: 'bg-emerald-100 text-emerald-800',
  sale: 'bg-sky-100 text-sky-800',
  sale_cancel: 'bg-stone-200 text-stone-700',
  adjustment: 'bg-amber-100 text-amber-800'
};

export const AdminJournal: React.FC = () => {
  const { showToast } = useShop();
  const [productText, setProductText] = useState('');
  const [products, setProducts] = useState<StockItem[]>([]);
  const [kind, setKind] = useState<MovementKind | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<MovementPage | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const requestId = useRef(0);

  // The product filter is a typed name with suggestions: the entry only counts once it matches a product exactly.
  const label = (item: StockItem) => `${item.brand} — ${item.name}${item.volume ? ` (${item.volume})` : ''}`;
  useEffect(() => { listStock({}).then((list) => setProducts(list.items)).catch(() => undefined); }, []);
  const productId = useMemo(() => products.find((item) => label(item) === productText)?.id ?? '', [products, productText]);

  useEffect(() => { setPage(1); }, [productId, kind, from, to]);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const result = await listMovements({ productId, kind, from, to, page, pageSize: JOURNAL_PAGE_SIZE });
      if (id !== requestId.current) return;
      setData(result);
      setError(null);
    } catch (cause) {
      if (id === requestId.current) setError(cause instanceof Error ? cause : new Error('Не удалось загрузить журнал.'));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [productId, kind, from, to, page]);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async (movement: Movement) => {
    if (!window.confirm(`Отменить продажу «${movement.productName}» × ${-movement.delta}? Товар вернётся на склад.`)) return;
    setCancelling(movement.id);
    try {
      const result = await cancelSale(movement.id);
      showToast(`Продажа отменена. На складе ${result.product.stockCount} шт.`, 'info');
      await load();
    } catch (cause) {
      showToast(errorMessage(cause, 'Не удалось отменить продажу.'), 'error');
    } finally {
      setCancelling(null);
    }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <div className="space-y-4" data-testid="admin-journal">
      <div className={`${cardClass} p-3.5 grid grid-cols-1 sm:grid-cols-4 gap-2.5`}>
        <label className="text-[11px] text-[#6E5C51] font-medium sm:col-span-2">
          Товар
          <input list="journal-products" value={productText} onChange={(e) => setProductText(e.target.value)} placeholder="Начните вводить название…" className={`${inputClass} mt-1`} data-testid="journal-product" />
          <datalist id="journal-products">{products.map((item) => <option key={item.id} value={label(item)} />)}</datalist>
        </label>
        <label className="text-[11px] text-[#6E5C51] font-medium">
          Тип записи
          <select value={kind} onChange={(e) => setKind(e.target.value as MovementKind | '')} className={`${inputClass} mt-1`}>
            <option value="">Все</option>
            {(Object.keys(MOVEMENT_LABELS) as MovementKind[]).map((value) => <option key={value} value={value}>{MOVEMENT_LABELS[value]}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] text-[#6E5C51] font-medium">С<input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={`${inputClass} mt-1`} data-testid="journal-from" /></label>
          <label className="text-[11px] text-[#6E5C51] font-medium">По<input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={`${inputClass} mt-1`} data-testid="journal-to" /></label>
        </div>
        {(productText || kind || from || to) && (
          <button onClick={() => { setProductText(''); setKind(''); setFrom(''); setTo(''); }} className={`${secondaryButton} sm:col-span-4 sm:w-fit`}><X className="w-3.5 h-3.5" /> Сбросить фильтры</button>
        )}
      </div>

      {error && <ErrorBox error={error} onRetry={load} />}

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-xs min-w-[720px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-[#8A796F] border-b border-[#F2ECE5]">
              <th className="p-3">Дата</th><th className="p-3">Запись</th><th className="p-3">Товар</th>
              <th className="p-3 text-right">Кол-во</th><th className="p-3 text-right">Цена</th><th className="p-3 text-right">Остаток</th><th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {data && data.items.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-[#8A796F]">Записей нет.</td></tr>}
            {(data?.items ?? []).map((movement) => (
              <tr key={movement.id} className={`border-b border-[#F8F4EF] ${movement.cancelled ? 'opacity-60' : ''}`} data-testid="journal-row">
                <td className="p-3 whitespace-nowrap">{formatDateTime(movement.createdAt)}</td>
                <td className="p-3 whitespace-nowrap">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${KIND_STYLES[movement.kind]}`}>{MOVEMENT_LABELS[movement.kind]}</span>
                  {movement.cancelled && <span className="ml-1 text-[10px] font-semibold text-stone-600">отменена</span>}
                </td>
                <td className="p-3"><div className="font-semibold text-[#2A2421]">{movement.productName}</div><div className="text-[10px] text-[#8A796F]">{movement.brand}{movement.note ? ` • ${movement.note}` : ''}</div></td>
                <td className={`p-3 text-right font-bold ${movement.delta < 0 ? 'text-rose-700' : 'text-emerald-800'}`}>{movement.delta > 0 ? `+${movement.delta}` : movement.delta}</td>
                <td className="p-3 text-right whitespace-nowrap">
                  {movement.kind === 'sale' && movement.unitPrice !== null ? (
                    <>
                      {formatSum(movement.unitPrice)}
                      {movement.listPrice !== null && movement.unitPrice < movement.listPrice && <div className="text-[10px] text-amber-700">скидка (обычная {formatSum(movement.listPrice)})</div>}
                    </>
                  ) : '—'}
                </td>
                <td className="p-3 text-right">{movement.stockAfter}</td>
                <td className="p-3 text-right">
                  {movement.kind === 'sale' && !movement.cancelled && movement.productId && (
                    <button onClick={() => handleCancel(movement)} disabled={cancelling === movement.id} className={secondaryButton} title="Отменить ошибочную продажу" data-testid="journal-cancel"><Undo2 className="w-3.5 h-3.5" /> Отменить</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-between text-xs text-[#6E5C51]">
          <span>Записей: {data.total}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(page - 1)} disabled={page <= 1 || loading} className={secondaryButton} aria-label="Назад"><ChevronLeft className="w-4 h-4" /></button>
            <span>{page} / {pages}</span>
            <button onClick={() => setPage(page + 1)} disabled={page >= pages || loading} className={secondaryButton} aria-label="Вперёд"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
};
