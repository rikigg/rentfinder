/// <reference types="vite/client" />

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: { id: number; username?: string; first_name?: string };
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
  platform?: string;
  viewportHeight?: number;
  viewportStableHeight?: number;
  isExpanded?: boolean;
  themeParams: Record<string, string>;
  colorScheme: "light" | "dark";
  MainButton: {
    text: string;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
  };
  HapticFeedback: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
    selectionChanged: () => void;
  };
  onEvent?: (eventType: string, callback: (...args: unknown[]) => void) => void;
  offEvent?: (eventType: string, callback: (...args: unknown[]) => void) => void;
  disableVerticalSwipes?: () => void;
  openTelegramLink: (url: string) => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openInvoice?: (url: string, callback?: (status: string) => void) => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
}

interface Window {
  Telegram?: { WebApp: TelegramWebApp };
}
