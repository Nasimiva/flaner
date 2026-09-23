import { TelegramWebAppUser } from '../types';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: {
          query_id?: string;
          user?: TelegramWebAppUser;
          receiver?: TelegramWebAppUser;
          chat?: unknown;
          start_param?: string;
          auth_date?: string;
          hash?: string;
        };
        version?: string;
        platform?: string;
        colorScheme?: 'light' | 'dark';
        themeParams?: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
          secondary_bg_color?: string;
        };
        isExpanded?: boolean;
        viewportHeight?: number;
        viewportStableHeight?: number;
        headerColor?: string;
        backgroundColor?: string;
        BackButton?: {
          isVisible: boolean;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
        MainButton?: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          isProgressVisible: boolean;
          setText: (text: string) => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive?: boolean) => void;
          hideProgress: () => void;
        };
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
        openTelegramLink?: (url: string) => void;
        openInvoice?: (url: string, callback?: (status: string) => void) => void;
        showPopup?: (params: { title?: string; message: string; buttons?: { id?: string; type?: string; text?: string }[] }, callback?: (buttonId: string) => void) => void;
        showAlert?: (message: string, callback?: () => void) => void;
        showConfirm?: (message: string, callback?: (confirmed: boolean) => void) => void;
        ready?: () => void;
        expand?: () => void;
        close?: () => void;
        sendData?: (data: string) => void;
        enableClosingConfirmation?: () => void;
      };
    };
  }
}

export function isInsideTelegram(): boolean {
  return typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData;
}

export function getTelegramUser(): TelegramWebAppUser | null {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initDataUnsafe?.user) {
    return window.Telegram.WebApp.initDataUnsafe.user;
  }
  return null;
}

export function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection' = 'light') {
  if (typeof window === 'undefined' || !window.Telegram?.WebApp?.HapticFeedback) return;
  try {
    const haptic = window.Telegram.WebApp.HapticFeedback;
    if (type === 'success' || type === 'warning' || type === 'error') {
      haptic.notificationOccurred(type);
    } else if (type === 'selection') {
      haptic.selectionChanged();
    } else {
      haptic.impactOccurred(type);
    }
  } catch {
    // Ignore error if not in supported Telegram client
  }
}

export function initTelegramApp() {
  if (typeof window === 'undefined' || !window.Telegram?.WebApp) return;
  try {
    window.Telegram.WebApp.ready?.();
    window.Telegram.WebApp.expand?.();
    window.Telegram.WebApp.enableClosingConfirmation?.();
  } catch {
    // Graceful fallback
  }
}
