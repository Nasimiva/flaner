import type { LeadView } from './leadService.js';

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Telegram message (parse_mode HTML) for the manager. Every shopper-supplied value is escaped. */
export function formatLeadMessage(lead: LeadView): string {
  const lines = lead.items.map(
    (item) =>
      `• <b>${escapeHtml(item.brand)}</b> — ${escapeHtml(item.productName)}${item.volume ? ` (${escapeHtml(item.volume)})` : ''}\n` +
      `  <i>${item.quantity} шт. × ${item.unitPrice.toLocaleString('ru-RU')} UZS</i>`
  );
  return (
    `📞 <b>НОВАЯ ЗАЯВКА</b> <code>${escapeHtml(lead.leadNumber)}</code>\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `👤 <b>${escapeHtml(lead.firstName)} ${escapeHtml(lead.lastName)}</b>\n` +
    `☎️ ${escapeHtml(lead.phone)}\n` +
    (lead.telegramUsername ? `💬 @${escapeHtml(lead.telegramUsername)}\n` : '') +
    (lead.comment ? `📝 ${escapeHtml(lead.comment)}\n` : '') +
    `\n🛍 <b>Товары:</b>\n${lines.join('\n')}\n\n` +
    `💰 <b>Ориентировочно:</b> ${lead.itemsTotal.toLocaleString('ru-RU')} UZS\n` +
    `Позвоните клиенту и подтвердите заявку в админ-панели.`
  );
}
