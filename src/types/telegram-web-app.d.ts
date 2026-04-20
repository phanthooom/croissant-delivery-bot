type TelegramThemeParams = Record<string, string>;

interface TelegramButtonLike {
  show(): void;
  hide(): void;
  setText?(text: string): void;
  setParams?(params: Record<string, unknown>): void;
  onClick?(callback: () => void): void;
  offClick?(callback: () => void): void;
}

interface TelegramHapticFeedback {
  impactOccurred?(style: "light" | "medium" | "heavy"): void;
  notificationOccurred?(type: "error" | "success" | "warning"): void;
}

interface TelegramUnsafeUser {
  id?: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
  allows_write_to_pm?: boolean;
}

interface TelegramWebAppObject {
  initData?: string;
  initDataUnsafe?: {
    user?: TelegramUnsafeUser;
    start_param?: string;
    query_id?: string;
  };
  platform?: string;
  version?: string;
  colorScheme?: "light" | "dark";
  themeParams?: TelegramThemeParams;
  ready?(): void;
  expand?(): void;
  enableClosingConfirmation?(): void;
  disableClosingConfirmation?(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  onEvent?(event: string, callback: () => void): void;
  offEvent?(event: string, callback: () => void): void;
  showAlert?(message: string): void;
  BottomButton?: TelegramButtonLike;
  MainButton?: TelegramButtonLike;
  BackButton?: TelegramButtonLike;
  HapticFeedback?: TelegramHapticFeedback;
}

interface Window {
  Telegram?: {
    WebApp?: TelegramWebAppObject;
  };
}
