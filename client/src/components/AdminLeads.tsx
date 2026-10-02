import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useShop } from '../context/ShopContext';
import { formatPrice } from '../utils/formatters';
import {
  AdminApiError,
  LEAD_ACTION_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  LEAD_TRANSITIONS,
  formatPhone,
  getLead,
  listLeads,
  telHref,
  telegramHref,
  updateLead,
  type AdminLead,
  type LeadStatus
} from '../utils/adminLeadsApi';
import { AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, ClipboardList, Phone, RefreshCw, Search, Send, X } from 'lucide-react';

const PAGE_SIZE = 20;
const NOTE_MAX = 2000;

const STATUS_STYLES: Record<LeadStatus, string> = {
  new: 'bg-amber-100 text-amber-800 border-amber-200',
  contacted: 'bg-sky-100 text-sky-800 border-sky-200',
  confirmed: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelled: 'bg-stone-200 text-stone-600 border-stone-300'
};

const formatDateTime = (iso: string | null): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const StatusBadge: React.FC<{ status: LeadStatus }> = ({ status }) => (
  <span
    data-testid="lead-status-badge"
    className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${STATUS_STYLES[status] ?? STATUS_STYLES.new}`}
  >
    {LEAD_STATUS_LABELS[status] ?? status}
  </span>
);

const totalQuantity = (lead: AdminLead) => (lead.items ?? []).reduce((sum, item) => sum + item.quantity, 0);

interface AdminLeadsProps {
  /** Reports how many leads are still "new", for the badge on the tab. */
  onNewCount?: (count: number) => void;
}

const ErrorBox: React.FC<{ error: AdminApiError; onRetry: () => void }> = ({ error, onRetry }) => (
  <div role="alert" data-testid="leads-error" className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 flex items-start gap-3">
    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
    <div className="flex-1 text-sm">
      <p className="font-semibold">{error.message}</p>
      <div className="mt-2 flex gap-2">
        {error.code === 'unauthorized' ? (
          <button onClick={() => window.location.reload()} className="text-xs font-semibold bg-red-700 text-white px-3 py-1.5 rounded-lg">
            Войти заново
          </button>
        ) : (
          <button onClick={onRetry} className="text-xs font-semibold bg-red-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Повторить
          </button>
        )}
      </div>
    </div>
  </div>
);

const toApiError = (error: unknown): AdminApiError =>
  error instanceof AdminApiError ? error : new AdminApiError(error instanceof Error ? error.message : 'Неизвестная ошибка', 'unknown');

export const AdminLeads: React.FC<AdminLeadsProps> = ({ onNewCount }) => {
  const { showToast } = useShop();

  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const [leads, setLeads] = useState<AdminLead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminApiError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listRequest = useRef(0);

  // Debounce the search box; a new search always starts from the first page.
  useEffect(() => {
    if (searchInput === query) return;
    const timer = setTimeout(() => {
      setQuery(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, query]);

  const refreshNewCount = useCallback(() => {
    if (!onNewCount) return;
    listLeads({ status: 'new', page: 1, pageSize: 1 })
      .then((result) => onNewCount(result.total))
      .catch(() => { /* the badge is a convenience; the list itself shows errors */ });
  }, [onNewCount]);

  useEffect(() => {
    const requestId = ++listRequest.current;
    setLoading(true);
    setError(null);
    listLeads({ status: statusFilter === 'all' ? undefined : statusFilter, q: query, page, pageSize: PAGE_SIZE })
      .then((result) => {
        if (requestId !== listRequest.current) return; // a newer request superseded this one
        const lastPage = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
        if (page > lastPage) { setPage(lastPage); return; }
        setLeads(result.items);
        setTotal(result.total);
        setLoading(false);
      })
      .catch((reason) => {
        if (requestId !== listRequest.current) return;
        setError(toApiError(reason));
        setLoading(false);
      });
  }, [statusFilter, query, page, reloadToken]);

  useEffect(() => { refreshNewCount(); }, [refreshNewCount, reloadToken]);

  const reload = () => setReloadToken((value) => value + 1);

  const handleLeadChanged = (updated: AdminLead) => {
    setLeads((current) => current.map((lead) => (lead.id === updated.id ? { ...lead, ...updated } : lead)));
    refreshNewCount();
    // The row may no longer match the active status filter.
    if (statusFilter !== 'all' && updated.status !== statusFilter) reload();
  };

  const filtersActive = statusFilter !== 'all' || query.trim() !== '';
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const resetFilters = () => {
    setStatusFilter('all');
    setSearchInput('');
    setQuery('');
    setPage(1);
  };

  return (
    <div className="space-y-4" data-testid="admin-leads">
      <div className="bg-white p-3.5 rounded-2xl border border-[#EAE3DC] shadow-xs space-y-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Фильтр по статусу">
          {(['all', ...LEAD_STATUSES] as const).map((status) => (
            <button
              key={status}
              data-testid={`leads-filter-${status}`}
              aria-pressed={statusFilter === status}
              onClick={() => { setStatusFilter(status); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                statusFilter === status ? 'bg-[#2A2421] text-white border-[#2A2421]' : 'bg-white text-[#6E5C51] border-[#E0D7CE] hover:bg-[#F5EFE9]'
              }`}
            >
              {status === 'all' ? 'Все' : LEAD_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-[#A89A90] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            data-testid="leads-search"
            type="search"
            value={searchInput}
            maxLength={80}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Поиск: имя, фамилия, телефон или номер FL-…"
            aria-label="Поиск по заявкам"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-[#E0D7CE] bg-[#FAF7F4] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40"
          />
        </div>
      </div>

      {error && <ErrorBox error={error} onRetry={reload} />}

      {!error && loading && leads.length === 0 && (
        <div data-testid="leads-loading" aria-busy="true" className="space-y-2">
          {[0, 1, 2, 3].map((index) => <div key={index} className="h-[68px] rounded-2xl bg-[#EAE1D7] animate-pulse" />)}
          <span className="sr-only">Загрузка заявок…</span>
        </div>
      )}

      {!error && !loading && leads.length === 0 && (
        <div data-testid="leads-empty" className="bg-white border border-dashed border-[#D9CEC3] rounded-2xl p-8 text-center">
          <ClipboardList className="w-9 h-9 text-[#B9A99B] mx-auto mb-3" />
          {filtersActive ? (
            <>
              <p className="font-semibold text-[#2A2421] text-sm">Ничего не найдено</p>
              <p className="text-xs text-[#8A7A6F] mt-1">Измените статус или поисковый запрос.</p>
              <button onClick={resetFilters} className="mt-3 text-xs font-semibold text-[#2A2421] underline">Сбросить фильтры</button>
            </>
          ) : (
            <>
              <p className="font-semibold text-[#2A2421] text-sm">Заявок пока нет</p>
              <p className="text-xs text-[#8A7A6F] mt-1">Когда клиент оставит заявку на сайте, она появится здесь.</p>
            </>
          )}
        </div>
      )}

      {leads.length > 0 && (
        <div className={`space-y-2 transition-opacity ${loading ? 'opacity-60' : ''}`} data-testid="leads-list" aria-busy={loading}>
          {leads.map((lead) => (
            <button
              key={lead.id}
              data-testid="lead-row"
              data-lead-number={lead.leadNumber}
              onClick={() => setSelectedId(lead.id)}
              className="w-full text-left bg-white border border-[#EAE3DC] hover:border-[#C9A227] rounded-2xl p-3.5 shadow-xs transition-colors flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
            >
              <div className="flex items-center gap-2 sm:w-40 shrink-0">
                <span className="font-mono text-xs font-bold text-[#2A2421]">{lead.leadNumber}</span>
                <StatusBadge status={lead.status} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#2A2421] truncate">{lead.firstName} {lead.lastName}</p>
                <p className="text-xs text-[#6E5C51]">{formatPhone(lead.phone)}</p>
              </div>
              <div className="text-xs text-[#6E5C51] sm:text-right">
                <p className="font-semibold text-[#2A2421]">{formatPrice(lead.itemsTotal, 'UZS')}</p>
                <p>{totalQuantity(lead)} шт · {formatDateTime(lead.createdAt)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && !error && (
        <div className="flex items-center justify-between text-xs text-[#6E5C51]" data-testid="leads-pagination">
          <span>Всего: {total}</span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              aria-label="Предыдущая страница"
              className="p-1.5 rounded-lg border border-[#E0D7CE] bg-white disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>Страница {page} из {lastPage}</span>
            <button
              disabled={page >= lastPage || loading}
              onClick={() => setPage((value) => Math.min(lastPage, value + 1))}
              aria-label="Следующая страница"
              className="p-1.5 rounded-lg border border-[#E0D7CE] bg-white disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {selectedId && (
        <LeadDetail
          leadId={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={handleLeadChanged}
          showToast={showToast}
        />
      )}
    </div>
  );
};

interface LeadDetailProps {
  leadId: string;
  onClose: () => void;
  onChanged: (lead: AdminLead) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const LeadDetail: React.FC<LeadDetailProps> = ({ leadId, onClose, onChanged, showToast }) => {
  const [lead, setLead] = useState<AdminLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminApiError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<{ message: string; code: string } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const detailRequest = useRef(0);

  useEffect(() => {
    const requestId = ++detailRequest.current;
    setLoading(true);
    setError(null);
    getLead(leadId)
      .then((result) => {
        if (requestId !== detailRequest.current) return;
        setLead(result);
        setNote(result.staffNote ?? '');
        setLoading(false);
      })
      .catch((reason) => {
        if (requestId !== detailRequest.current) return;
        setError(toApiError(reason));
        setLoading(false);
      });
  }, [leadId, reloadToken]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const apply = async (patch: { status?: LeadStatus; staffNote?: string | null }, successMessage: string) => {
    if (!lead || saving) return;
    setSaving(true);
    setActionError(null);
    try {
      const updated = await updateLead(lead.id, patch);
      setLead(updated);
      // Keep the textarea in sync with what the server stored, but never discard text typed meanwhile on a status change.
      if (patch.staffNote !== undefined) setNote(updated.staffNote ?? '');
      if (patch.status !== undefined) setConfirmCancel(false);
      onChanged(updated);
      showToast(successMessage, 'success');
    } catch (reason) {
      const apiError = toApiError(reason);
      setActionError({ message: apiError.message, code: apiError.code });
      // Somebody else may have changed the lead: show the real state.
      if (apiError.code !== 'unauthorized' && apiError.code !== 'network' && apiError.status >= 400 && apiError.status < 500) {
        setReloadToken((value) => value + 1);
      }
    } finally {
      setSaving(false);
    }
  };

  const noteChanged = lead ? note.trim() !== (lead.staffNote ?? '').trim() : false;
  const nextStatuses = lead ? LEAD_TRANSITIONS[lead.status] : [];
  const forwardStatuses = nextStatuses.filter((status) => status !== 'cancelled');
  const canCancel = nextStatuses.includes('cancelled');
  const phoneLink = lead ? telHref(lead.phone) : null;
  const tgLink = lead ? telegramHref(lead.telegramUsername) : null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/50" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Детали заявки"
        data-testid="lead-detail"
        className="w-full max-w-xl bg-[#FAF7F4] h-full overflow-y-auto shadow-2xl"
      >
        <div className="sticky top-0 z-10 bg-[#2A2421] text-white px-4 py-3 flex items-center gap-3">
          <button onClick={onClose} aria-label="Закрыть" data-testid="lead-detail-close" className="p-1.5 rounded-full bg-white/10 hover:bg-white/20">
            <ArrowLeft className="w-4 h-4 sm:hidden" />
            <X className="w-4 h-4 hidden sm:block" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold font-mono">{lead?.leadNumber ?? 'Заявка'}</p>
            {lead && <p className="text-[11px] text-[#A89A90]">Создана {formatDateTime(lead.createdAt)}</p>}
          </div>
          {lead && <StatusBadge status={lead.status} />}
        </div>

        <div className="p-4 space-y-5">
          {loading && !lead && (
            <div data-testid="lead-detail-loading" aria-busy="true" className="space-y-3">
              <div className="h-24 rounded-2xl bg-[#EAE1D7] animate-pulse" />
              <div className="h-40 rounded-2xl bg-[#EAE1D7] animate-pulse" />
              <span className="sr-only">Загрузка заявки…</span>
            </div>
          )}

          {error && !lead && <ErrorBox error={error} onRetry={() => setReloadToken((value) => value + 1)} />}

          {lead && (
            <>
              {actionError && (
                <div role="alert" data-testid="lead-action-error" className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm flex gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span>{actionError.message}</span>
                    {actionError.code === 'unauthorized' && (
                      <button onClick={() => window.location.reload()} className="block mt-2 text-xs font-semibold bg-red-700 text-white px-3 py-1.5 rounded-lg">Войти заново</button>
                    )}
                  </div>
                </div>
              )}

              <section className="bg-white rounded-2xl border border-[#EAE3DC] p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-bold text-[#2A2421]" data-testid="lead-detail-name">{lead.firstName} {lead.lastName}</p>
                    <p className="text-sm text-[#6E5C51]" data-testid="lead-detail-phone">{formatPhone(lead.phone)}</p>
                    {lead.telegramUsername && (
                      <p className="text-xs text-[#8A7A6F] mt-0.5">
                        Telegram:{' '}
                        {tgLink ? <a href={tgLink} target="_blank" rel="noopener noreferrer" className="underline">@{lead.telegramUsername}</a> : `@${lead.telegramUsername}`}
                      </p>
                    )}
                    <p className="text-[11px] text-[#A89A90] mt-0.5">Источник: {lead.source === 'telegram' ? 'Telegram Mini App' : 'Сайт'}</p>
                  </div>
                  {phoneLink ? (
                    <a
                      href={phoneLink}
                      data-testid="lead-call"
                      className="shrink-0 inline-flex items-center gap-1.5 bg-[#2A2421] text-white text-xs font-semibold px-3.5 py-2 rounded-xl hover:bg-black"
                    >
                      <Phone className="w-4 h-4" /> Позвонить
                    </a>
                  ) : (
                    <span className="text-[11px] text-red-700">Некорректный номер</span>
                  )}
                </div>
                {lead.comment && (
                  <div className="text-sm bg-[#FAF7F4] border border-[#EAE3DC] rounded-xl p-3">
                    <p className="text-[11px] font-semibold text-[#8A7A6F] mb-1">Комментарий клиента</p>
                    <p className="whitespace-pre-wrap break-words" data-testid="lead-detail-comment">{lead.comment}</p>
                  </div>
                )}
              </section>

              <section className="bg-white rounded-2xl border border-[#EAE3DC] p-4">
                <h3 className="text-xs font-bold text-[#2A2421] uppercase tracking-wide mb-2">Товары</h3>
                <ul className="divide-y divide-[#F0E9E2]" data-testid="lead-items">
                  {lead.items.map((item, index) => (
                    <li key={`${item.productId ?? 'x'}-${index}`} className="py-2 flex justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-semibold text-[#2A2421] break-words">{item.productName}</p>
                        <p className="text-xs text-[#8A7A6F]">
                          {[item.brand, item.volume].filter(Boolean).join(' · ')}
                          {item.productId === null && <span className="ml-1 text-amber-700">· товар удалён из каталога</span>}
                        </p>
                        <p className="text-xs text-[#6E5C51]">{item.quantity} шт × {formatPrice(item.unitPrice, 'UZS')}</p>
                      </div>
                      <p className="font-semibold text-[#2A2421] whitespace-nowrap">{formatPrice(item.unitPrice * item.quantity, 'UZS')}</p>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 pt-2 border-t border-[#E0D7CE] flex justify-between text-sm font-bold text-[#2A2421]">
                  <span>Итого ({totalQuantity(lead)} шт)</span>
                  <span data-testid="lead-detail-total">{formatPrice(lead.itemsTotal, 'UZS')}</span>
                </div>
                <p className="text-[11px] text-[#A89A90] mt-1">Цены зафиксированы на момент заявки. Оплаты на сайте нет — менеджер связывается с клиентом.</p>
              </section>

              <section className="bg-white rounded-2xl border border-[#EAE3DC] p-4 space-y-3">
                <h3 className="text-xs font-bold text-[#2A2421] uppercase tracking-wide">Статус</h3>
                {nextStatuses.length === 0 ? (
                  <p className="text-sm text-[#6E5C51]" data-testid="lead-final-note">
                    Заявка закрыта ({LEAD_STATUS_LABELS[lead.status].toLowerCase()}). Статус больше изменить нельзя, заметку — можно.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {forwardStatuses.map((status) => (
                      <button
                        key={status}
                        disabled={saving}
                        data-testid={`lead-action-${status}`}
                        onClick={() => apply({ status }, `Статус: ${LEAD_STATUS_LABELS[status]}`)}
                        className="text-xs font-semibold bg-[#2A2421] text-white px-3.5 py-2 rounded-xl hover:bg-black disabled:opacity-50"
                      >
                        {LEAD_ACTION_LABELS[status]}
                      </button>
                    ))}
                    {canCancel && !confirmCancel && (
                      <button
                        disabled={saving}
                        data-testid="lead-action-cancelled"
                        onClick={() => setConfirmCancel(true)}
                        className="text-xs font-semibold text-red-700 border border-red-200 bg-white px-3.5 py-2 rounded-xl hover:bg-red-50 disabled:opacity-50"
                      >
                        {LEAD_ACTION_LABELS.cancelled}
                      </button>
                    )}
                    {canCancel && confirmCancel && (
                      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-1.5" data-testid="lead-cancel-confirm">
                        <span className="text-xs text-red-800">Отменить без возможности вернуть?</span>
                        <button
                          disabled={saving}
                          data-testid="lead-cancel-yes"
                          onClick={() => apply({ status: 'cancelled' }, 'Заявка отменена')}
                          className="text-xs font-semibold bg-red-700 text-white px-2.5 py-1 rounded-lg disabled:opacity-50"
                        >
                          Да, отменить
                        </button>
                        <button disabled={saving} onClick={() => setConfirmCancel(false)} className="text-xs font-semibold text-[#6E5C51] px-2 py-1">
                          Нет
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section className="bg-white rounded-2xl border border-[#EAE3DC] p-4 space-y-2">
                <label htmlFor="lead-staff-note" className="text-xs font-bold text-[#2A2421] uppercase tracking-wide block">Заметка менеджера</label>
                <textarea
                  id="lead-staff-note"
                  data-testid="lead-note"
                  value={note}
                  maxLength={NOTE_MAX}
                  rows={4}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Например: перезвонить после 18:00, клиент просил подарочную упаковку"
                  className="w-full text-sm rounded-xl border border-[#E0D7CE] bg-[#FAF7F4] p-3 focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#A89A90]">{note.length}/{NOTE_MAX}</span>
                  <button
                    disabled={!noteChanged || saving}
                    data-testid="lead-note-save"
                    onClick={() => apply({ staffNote: note.trim() === '' ? null : note.trim() }, 'Заметка сохранена')}
                    className="text-xs font-semibold bg-[#C9A227] text-white px-3.5 py-2 rounded-xl hover:bg-[#B8921F] disabled:opacity-40 flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" /> Сохранить заметку
                  </button>
                </div>
              </section>

              <section className="bg-white rounded-2xl border border-[#EAE3DC] p-4">
                <h3 className="text-xs font-bold text-[#2A2421] uppercase tracking-wide mb-2">История статусов</h3>
                {(lead.history ?? []).length === 0 ? (
                  <p className="text-sm text-[#8A7A6F]">История пока пуста.</p>
                ) : (
                  <ol className="space-y-2" data-testid="lead-history">
                    {(lead.history ?? []).map((entry, index) => (
                      <li key={`${entry.createdAt}-${index}`} className="text-xs text-[#52443C] flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-[#8A7A6F]">{formatDateTime(entry.createdAt)}</span>
                        <span>
                          {entry.fromStatus ? `${LEAD_STATUS_LABELS[entry.fromStatus] ?? entry.fromStatus} → ` : 'Создана → '}
                          <strong>{LEAD_STATUS_LABELS[entry.toStatus] ?? entry.toStatus}</strong>
                        </span>
                        <span className="text-[#A89A90]">· {entry.actor === 'system' ? 'система' : entry.actor}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
};
