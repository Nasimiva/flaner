import React from 'react';
import { useShop } from '../context/ShopContext';
import { MoreVertical, X, CheckCircle, ShieldCheck } from 'lucide-react';

export const TelegramFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isTelegramFrame, setIsTelegramFrame } = useShop();

  if (!isTelegramFrame) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#1F2732] py-4 sm:py-8 px-2 sm:px-4 flex flex-col items-center justify-center">
      {/* Device wrapper */}
      <div className="w-full max-w-[430px] bg-[#FAF8F5] rounded-[36px] shadow-2xl overflow-hidden border-[8px] border-[#2C3848] flex flex-col h-[890px] relative">
        {/* Telegram Top App Header */}
        <div className="bg-[#242D39] text-white px-4 py-3 flex items-center justify-between select-none z-30">
          <button
            onClick={() => setIsTelegramFrame(false)}
            className="text-xs text-[#6DB4F7] hover:text-white font-medium flex items-center space-x-1"
          >
            <span>Закрыть</span>
          </button>

          <div className="text-center">
            <div className="flex items-center justify-center space-x-1">
              <span className="text-xs font-semibold tracking-wide">
                Flaner Cosmetics
              </span>
              <CheckCircle className="w-3 h-3 text-[#2AABEE] fill-[#2AABEE]/20" />
            </div>
            <span className="text-[10px] text-[#8E9CAE] block">
              бот @flaneruz_bot
            </span>
          </div>

          <div className="flex items-center space-x-2 text-[#6DB4F7]">
            <button
              onClick={() => setIsTelegramFrame(false)}
              className="p-1 hover:text-white"
              title="Выйти из режима Telegram"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable mini app content */}
        <div className="flex-1 overflow-y-auto no-scrollbar relative flex flex-col">
          {children}
        </div>

        {/* Telegram Bottom Home Bar */}
        <div className="bg-[#242D39] py-1.5 flex justify-center items-center">
          <div className="w-32 h-1 bg-white/30 rounded-full"></div>
        </div>
      </div>

      <div className="text-center mt-3 text-xs text-[#8E9CAE]">
        Режим симуляции Telegram Mini App (Нажмите «Закрыть» или в шапке для перехода в широкий экран)
      </div>
    </div>
  );
};
