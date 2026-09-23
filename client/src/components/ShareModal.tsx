import React, { useState } from 'react';
import { useShop } from '../context/ShopContext';
import { Share2, Copy, Check, QrCode, Smartphone, ExternalLink, X, Send, Download, Code2, FolderArchive } from 'lucide-react';
import { triggerHaptic } from '../utils/telegram';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose }) => {
  const { showToast } = useShop();
  const [copied, setCopied] = useState(false);
  const [copiedTg, setCopiedTg] = useState(false);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://flaner-cosmetics.app';
  const tgBotUrl = 'https://t.me/flaneruz_bot';
  // Standard Telegram Web App direct launch link if configured, or bot link
  const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(currentUrl)}&text=${encodeURIComponent('✨ Откройте бутик селективной косметики и парфюмерии flaner_cosmetics!')}`;

  const handleCopyLink = () => {
    triggerHaptic('medium');
    navigator.clipboard.writeText(currentUrl).then(() => {
      setCopied(true);
      showToast('Ссылка на магазин скопирована!', 'success');
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      showToast('Не удалось скопировать', 'error');
    });
  };

  const handleCopyTgLink = () => {
    triggerHaptic('medium');
    navigator.clipboard.writeText(tgBotUrl).then(() => {
      setCopiedTg(true);
      showToast('Ссылка на Telegram-бота скопирована!', 'success');
      setTimeout(() => setCopiedTg(false), 2500);
    }).catch(() => {
      showToast('Не удалось скопировать', 'error');
    });
  };

  const handleNativeShare = async () => {
    triggerHaptic('light');
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'flaner_cosmetics — Бутик косметики и парфюмерии',
          text: 'Премиальная косметика и селективная парфюмерия flaner_cosmetics. Бесплатная доставка от 2 млн сум!',
          url: currentUrl,
        });
      } catch {
        // User canceled or share failed
      }
    } else {
      handleCopyLink();
    }
  };

  // Safe QR Code URL generator
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(currentUrl)}&color=2A2421&bgcolor=FAF8F5`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-[#EAE3DC] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#2A2421] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-[#FAF5E8]/10 flex items-center justify-center text-[#C9A227]">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wide">Открыть на любом телефоне</h3>
              <p className="text-[11px] text-[#C4B7AB]">Поделитесь ссылкой или отсканируйте QR</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-[#E8DDD4] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Quick Explanation */}
          <div className="bg-[#FAF5E8] border border-[#E8DCBF] rounded-2xl p-3.5 text-xs text-[#5C4515] flex items-start space-x-2.5">
            <Smartphone className="w-4 h-4 text-[#C9A227] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Сайт полностью оптимизирован для всех смартфонов (iPhone iOS, Android). Страница работает в любом браузере (Safari, Chrome) или внутри <strong>Telegram</strong> через бота <strong className="text-[#2A2421]">@flaneruz_bot</strong>.
            </p>
          </div>

          {/* QR Code Section */}
          <div className="bg-[#FAF8F5] border border-[#EAE3DC] rounded-2xl p-4 flex flex-col items-center text-center space-y-3">
            <span className="text-xs font-bold text-[#2A2421] flex items-center space-x-1.5">
              <QrCode className="w-4 h-4 text-[#C9A227]" />
              <span>Наведите камеру смартфона для входа:</span>
            </span>

            <div className="bg-white p-3 rounded-2xl border border-[#DFD6CD] shadow-xs">
              <img 
                src={qrCodeUrl} 
                alt="QR Code для открытия магазина на телефоне" 
                className="w-44 h-44 object-contain rounded-lg"
                referrerPolicy="no-referrer"
              />
            </div>
            <p className="text-[11px] text-[#8A796F]">
              Откройте камеру любого телефона и перейдите по появившейся ссылке.
            </p>
          </div>

          {/* Direct Link Copy */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#2A2421] block">
              Прямая ссылка на сайт:
            </label>
            <div className="flex items-center space-x-2">
              <input 
                type="text" 
                readOnly 
                value={currentUrl}
                className="flex-1 bg-[#FAF8F5] border border-[#DFD6CD] rounded-xl px-3 py-2 text-xs text-[#2A2421] font-mono select-all focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors shrink-0 ${
                  copied 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-[#2A2421] hover:bg-[#3D3531] text-white'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Скопировано!' : 'Копировать'}</span>
              </button>
            </div>
          </div>

          {/* Actions: Send to Telegram / Native Share */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <a
              href={tgShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#2AABEE] hover:bg-[#229ED9] text-white py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Отправить в Telegram</span>
            </a>

            <button
              onClick={handleNativeShare}
              className="bg-[#FAF8F5] hover:bg-[#F2ECE5] border border-[#DFD6CD] text-[#2A2421] py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5 text-[#C9A227]" />
              <span>Поделиться (Share)</span>
            </button>
          </div>

          {/* Telegram Bot Link */}
          <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EAE3DC] flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-[#52443C]">Бот в Telegram: <strong>@flaneruz_bot</strong></span>
            </div>
            <button
              onClick={handleCopyTgLink}
              className="text-[#2AABEE] hover:underline font-semibold text-[11px] flex items-center space-x-1"
            >
              <span>{copiedTg ? 'Скопировано' : 'Скопировать ссылку'}</span>
            </button>
          </div>

          {/* VS Code ZIP Download Section */}
          <div className="p-4 bg-linear-to-br from-[#2A2421] to-[#3D3531] text-white rounded-2xl space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-[#C9A227]">
                  <Code2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Исходный код для VS Code</h4>
                  <p className="text-[10px] text-[#C4B7AB]">Готовый .ZIP архив проекта</p>
                </div>
              </div>
              <span className="text-[9px] bg-[#C9A227]/20 text-[#E8DCBF] border border-[#C9A227]/40 px-2 py-0.5 rounded-full font-mono">
                flaner-cosmetics.zip
              </span>
            </div>

            <p className="text-[11px] text-[#D1C7BD] leading-relaxed">
              Скачайте архив проекта для открытия в редакторе VS Code (включает клиент, сервер и все компоненты).
            </p>

            <a
              href="/flaner-cosmetics.zip"
              download="flaner-cosmetics.zip"
              className="w-full bg-[#C9A227] hover:bg-[#D4B03B] text-[#2A2421] py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-transform active:scale-98 shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>Скачать ZIP-файл проекта</span>
            </a>

            <div className="bg-black/25 rounded-xl p-2.5 text-[10px] text-[#C4B7AB] space-y-1 font-mono">
              <div className="text-white/80 font-bold">Команды для запуска в терминале VS Code:</div>
              <div className="text-[#E8DCBF]">$ npm install</div>
              <div className="text-[#E8DCBF]">$ npm run dev</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
