import type { LocalizedField } from "@/lib/types";

export const APP_LOCALES = ["uz", "ru", "en"] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "ru";
export const LOCALE_COOKIE_NAME = "fooddd_locale";

type PaymentMethod = "cash" | "click" | "payme";

interface TranslationShape {
  metadata: {
    layoutTitle: string;
    layoutDescription: string;
    pageTitle: string;
    pageDescription: string;
  };
  localeLabel: string;
  localeNames: Record<AppLocale, string>;
  splashSubtitle: string;
  tabs: {
    catalog: string;
    cart: string;
    orders: string;
    profile: string;
  };
  common: {
    add: string;
    total: string;
    address: string;
    time: string;
    payment: string;
    name: string;
    phone: string;
    comment: string;
    cancel: string;
    saveAddress: string;
    delivery: string;
    browser: string;
    telegram: string;
    authenticated: string;
    support: string;
    bot: string;
    app: string;
    mapTitle: string;
    loadingMenu: string;
    deliveryAddress: string;
    chooseAddress: string;
    change: string;
    choose: string;
    manually: string;
    weight: string;
    toYou: string;
    updatesEvery20Seconds: string;
    routeLoading: string;
    backToCatalog: string;
  };
  cart: {
    title: string;
    emptyTitle: string;
    emptyDescription: string;
    checkoutTitle: string;
    clear: string;
    orderButton: string;
    ordering: string;
    customerNamePlaceholder: string;
    phonePlaceholder: string;
    addressPlaceholder: string;
    commentPlaceholder: string;
    paymentTitle: string;
  };
  orders: {
    title: string;
    success: string;
    emptyTitle: string;
    emptyDescription: string;
    makeOrder: string;
    accepted: string;
    orderContents: string;
    moreItems: (count: number) => string;
  };
  profile: {
    title: string;
    authTitle: string;
    authBody: (botUsername: string) => string;
    noUserData: string;
    ordersStat: string;
    cartStat: string;
    about: string;
    deliveryFrom: (minutes: number) => string;
    loginTitle: string;
    loginBody: string;
    loginButton: string;
    contactUs: string;
    ourBranches: string;
    aboutCompany: string;
    publicOffer: string;
    privacyPolicy: string;
    appLanguage: string;
    followUs: string;
    poweredBy: string;
  };
  search: {
    placeholder: string;
    emptyPrompt: string;
    noResults: (query: string) => string;
    addButton: string;
  };
  location: {
    title: string;
    detectLocation: string;
    locating: string;
    gpsHint: string;
    geolocationUnsupported: string;
    geolocationDenied: string;
    reverseGeocodeFailed: string;
    addressPlaceholder: string;
  };
  product: {
    addToCart: string;
    goToCart: string;
  };
  delivery: {
    steps: Array<{ icon: string; label: string; desc: string }>;
    delivered: string;
    arriving: string;
    etaMinutes: (minutes: number) => string;
    asap: string;
  };
  validation: {
    requiredFields: (fields: string[]) => string;
    createOrderFailed: string;
    accepted: string;
    error: string;
    missingFieldLabels: {
      customerName: string;
      phone: string;
    };
    unavailableProduct: string;
    addAtLeastOneProduct: string;
    missingCustomerName: string;
    invalidPhone: string;
    missingAddress: string;
    deliveryOnly: string;
    choosePayment: string;
    invalidTelegramSession: string;
    backendOrderFailed: string;
  };
  payments: Record<PaymentMethod, string>;
  bot: {
    openMiniApp: string;
    startMessage: (brandName: string) => string;
    helpMessage: string;
    webAppDataReceived: string;
    adminOrderMessage: {
      title: (brandName: string, orderId: string) => string;
      customer: string;
      phone: string;
      address: string;
      payment: string;
      deliveryTime: string;
      telegram: string;
      startParam: string;
      created: string;
      items: string;
      total: string;
      comment: string;
      unverifiedUser: string;
    };
    customerOrderMessage: {
      title: (brandName: string) => string;
      order: string;
      total: string;
      address: string;
      deliveryTime: string;
      footer: string;
    };
  };
}

function pluralRu(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function trimText(value: string | undefined | null) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

const translations: Record<AppLocale, TranslationShape> = {
  uz: {
    metadata: {
      layoutTitle: "Croissant Telegram Mini App",
      layoutDescription:
        "Croissant uchun Telegram mini-ilovasi: katalog, savat va buyurtma berish.",
      pageTitle: "Croissant yetkazib berish mini-ilovasi",
      pageDescription:
        "Croissant uchun Telegram mini-ilovasi: menyu, savat, buyurtmalar va Telegram integratsiyasi.",
    },
    localeLabel: "Til",
    localeNames: { uz: "O'zbekcha", ru: "Русский", en: "English" },
    splashSubtitle: "Yetkazib berish",
    tabs: { catalog: "Asosiy", cart: "Savat", orders: "Buyurtmalar", profile: "Profil" },
    common: {
      add: "Qo'shish",
      total: "Jami",
      address: "Manzil",
      time: "Vaqt",
      payment: "To'lov",
      name: "Ism",
      phone: "Telefon",
      comment: "Izoh",
      cancel: "Bekor qilish",
      saveAddress: "Manzilni saqlash",
      delivery: "Yetkazib berish",
      browser: "Brauzer",
      telegram: "Telegram",
      authenticated: "✓ Tizimga kirilgan",
      support: "Yordam",
      bot: "Bot",
      app: "Ilova haqida",
      mapTitle: "Xarita",
      loadingMenu: "Menyu yuklanmoqda...",
      deliveryAddress: "Yetkazib berish manzili",
      chooseAddress: "Manzilni kiriting",
      change: "O'zgartirish",
      choose: "Tanlash",
      manually: "Yoki qo'lda kiriting",
      weight: "Og'irligi",
      toYou: "sizgacha",
      updatesEvery20Seconds: "har 20 soniyada yangilanadi",
      routeLoading: "Marshrut aniqlanmoqda…",
      backToCatalog: "Katalogga o'tish",
    },
    cart: {
      title: "Savat",
      emptyTitle: "Savat bo'sh",
      emptyDescription: "Katalogdan mahsulot qo'shing",
      checkoutTitle: "Buyurtmani rasmiylashtirish",
      clear: "Savatni tozalash",
      orderButton: "Buyurtma berish",
      ordering: "Rasmiylashtirilmoqda...",
      customerNamePlaceholder: "Ismingiz",
      phonePlaceholder: "Telefon raqami +998 ...",
      addressPlaceholder: "Yetkazib berish manzilini kiriting",
      commentPlaceholder: "Izoh (ixtiyoriy)",
      paymentTitle: "To'lov",
    },
    orders: {
      title: "Buyurtmalarim",
      success: "Buyurtma qabul qilindi!",
      emptyTitle: "Hozircha buyurtmalar yo'q",
      emptyDescription: "Buyurtmalaringiz shu yerda ko'rinadi",
      makeOrder: "Buyurtma berish",
      accepted: "Qabul qilindi",
      orderContents: "Buyurtma tarkibi",
      moreItems: (count) => `yana ${count} ta pozitsiya`,
    },
    profile: {
      title: "Profil",
      authTitle: "Kirish qanday ishlaydi?",
      authBody: (botUsername) =>
        `Telegram'da @${botUsername} botini oching va menyu tugmasini bosing. Telegram ma'lumotlaringizni avtomatik uzatadi, parol kerak emas.`,
      noUserData: "Foydalanuvchi ma'lumotlari yo'q",
      ordersStat: "Buyurtmalar",
      cartStat: "Savatda",
      about: "Ilova haqida",
      deliveryFrom: (minutes) => `${minutes} daqiqadan`,
      loginTitle: "Profilga kirish",
      loginBody: "Buyurtma berish va kuzatib borish uchun bu zarur.",
      loginButton: "Kirish",
      contactUs: "Biz bilan bog'lanish",
      ourBranches: "Bizning filiallar",
      aboutCompany: "Kompaniya haqida",
      publicOffer: "Ommaviy taklif",
      privacyPolicy: "Maxfiylik siyosati",
      appLanguage: "Ilova tili",
      followUs: "Ijtimoiy tarmoqlarda obuna bo'ling",
      poweredBy: "Qo'llab-quvvatlaydi",
    },
    search: {
      placeholder: "Taomlarni qidirish...",
      emptyPrompt: "Taom nomini kiriting",
      noResults: (query) => `“${query}” bo'yicha hech narsa topilmadi`,
      addButton: "+ Qo'shish",
    },
    location: {
      title: "Yetkazib berish manzili",
      detectLocation: "Mening joylashuvimni aniqlash",
      locating: "Aniqlanmoqda...",
      gpsHint: "Telefoningiz GPS'idan foydalanamiz",
      geolocationUnsupported: "Geolokatsiya qo'llab-quvvatlanmaydi",
      geolocationDenied: "Geolokatsiyaga ruxsat yo'q, manzilni qo'lda kiriting",
      reverseGeocodeFailed: "Koordinatalar bo'yicha manzilni aniqlab bo'lmadi",
      addressPlaceholder: "Ko'cha, uy, xonadon, mo'ljal...",
    },
    product: {
      addToCart: "Savatga",
      goToCart: "Savatga o'tish",
    },
    delivery: {
      steps: [
        { icon: "📦", label: "Tayyorlanmoqda", desc: "Buyurtmangiz tayyorlanmoqda" },
        { icon: "🚴", label: "Kuryer oldi", desc: "Buyurtma kuryerda" },
        { icon: "🚗", label: "Yo'lda", desc: "Siz tomon yo'l oldik" },
        { icon: "✅", label: "Yetkazildi", desc: "Buyurtma yetkazildi" },
      ],
      delivered: "Yetkazildi",
      arriving: "Yetib boryapmiz!",
      etaMinutes: (minutes) => `~${minutes} daqiqa`,
      asap: "Imkon qadar tezroq",
    },
    validation: {
      requiredFields: (fields) => `To'ldiring: ${fields.join(", ")}`,
      createOrderFailed: "Buyurtmani yaratib bo'lmadi",
      accepted: "Buyurtma qabul qilindi!",
      error: "Xatolik",
      missingFieldLabels: { customerName: "ism", phone: "telefon" },
      unavailableProduct:
        "Mahsulotlardan biri endi mavjud emas. Katalogni yangilang va yana urinib ko'ring.",
      addAtLeastOneProduct: "Savatga hech bo'lmasa bitta mahsulot qo'shing.",
      missingCustomerName: "Mijoz ismini kiriting.",
      invalidPhone: "To'g'ri telefon raqamini kiriting.",
      missingAddress: "Yetkazib berish manzilini kiriting.",
      deliveryOnly: "Hozircha faqat yetkazib berish qo'llab-quvvatlanadi.",
      choosePayment: "To'lov usulini tanlang.",
      invalidTelegramSession:
        "Telegram sessiyasi tasdiqlanmadi. Mini App'ni bot orqali qayta oching.",
      backendOrderFailed: "Serverda buyurtmani qayta ishlab bo'lmadi.",
    },
    payments: { cash: "Naqd", click: "Click", payme: "Payme" },
    bot: {
      openMiniApp: "Mini App'ni ochish",
      startMessage: (brandName) =>
        [
          `${brandName}: Mini App tayyor`,
          "",
          "Pastdagi tugma orqali katalogni oching, menyuni ko'ring, savat tuzing va buyurtmani bevosita Telegram ichida rasmiylashtiring.",
        ].join("\n"),
      helpMessage: [
        "Qisqa yo'riqnoma:",
        "1. Mini App'ni oching.",
        "2. Mahsulotlarni savatga qo'shing.",
        "3. Rasmiylashtirish formasi orqali buyurtma yuboring.",
      ].join("\n"),
      webAppDataReceived:
        "Mini App ma'lumotlari olindi. Agar foydalanuvchi buyurtma qilgan bo'lsa, jamoa uni buyurtmalar chatida ko'radi.",
      adminOrderMessage: {
        title: (brandName, orderId) => `${brandName}: yangi buyurtma ${orderId}`,
        customer: "Mijoz",
        phone: "Telefon",
        address: "Manzil",
        payment: "To'lov",
        deliveryTime: "Yetkazib berish vaqti",
        telegram: "Telegram",
        startParam: "Start param",
        created: "Yaratildi",
        items: "Mahsulotlar",
        total: "Jami",
        comment: "Izoh",
        unverifiedUser: "Tasdiqlanmagan Telegram foydalanuvchisi",
      },
      customerOrderMessage: {
        title: (brandName) => `${brandName}: buyurtma qabul qilindi`,
        order: "Buyurtma",
        total: "Jami",
        address: "Manzil",
        deliveryTime: "Yetkazib berish vaqti",
        footer:
          "Jamoa buyurtmangizni oldi. Aniqlik kiritish kerak bo'lsa, shu chatga yozing.",
      },
    },
  },
  ru: {
    metadata: {
      layoutTitle: "Croissant Telegram Mini App",
      layoutDescription:
        "Telegram Mini App для Croissant: каталог, корзина и оформление доставки.",
      pageTitle: "Croissant Delivery Mini App",
      pageDescription:
        "Telegram Mini App для Croissant с меню, корзиной, заказами и интеграцией с Telegram.",
    },
    localeLabel: "Язык",
    localeNames: { uz: "O'zbekcha", ru: "Русский", en: "English" },
    splashSubtitle: "Доставка",
    tabs: { catalog: "Главная", cart: "Корзина", orders: "Заказы", profile: "Профиль" },
    common: {
      add: "Добавить",
      total: "Итого",
      address: "Адрес",
      time: "Время",
      payment: "Оплата",
      name: "Имя",
      phone: "Телефон",
      comment: "Комментарий",
      cancel: "Отмена",
      saveAddress: "Сохранить адрес",
      delivery: "Доставка",
      browser: "Браузер",
      telegram: "Telegram",
      authenticated: "✓ Авторизован",
      support: "Поддержка",
      bot: "Бот",
      app: "О приложении",
      mapTitle: "Карта",
      loadingMenu: "Загружаем меню...",
      deliveryAddress: "Адрес доставки",
      chooseAddress: "Укажите адрес доставки",
      change: "Изменить",
      choose: "Выбрать",
      manually: "Или введите вручную",
      weight: "Вес",
      toYou: "до вас",
      updatesEvery20Seconds: "обновляется каждые 20 сек",
      routeLoading: "Определяем маршрут…",
      backToCatalog: "Перейти в каталог",
    },
    cart: {
      title: "Корзина",
      emptyTitle: "Корзина пуста",
      emptyDescription: "Добавьте товары из каталога",
      checkoutTitle: "Оформление заказа",
      clear: "Очистить корзину",
      orderButton: "Заказать",
      ordering: "Оформляем...",
      customerNamePlaceholder: "Ваше имя",
      phonePlaceholder: "Номер телефона +998 ...",
      addressPlaceholder: "Укажите адрес доставки",
      commentPlaceholder: "Комментарий (необязательно)",
      paymentTitle: "Оплата",
    },
    orders: {
      title: "Мои заказы",
      success: "Заказ принят!",
      emptyTitle: "Заказов пока нет",
      emptyDescription: "Ваши заказы появятся здесь",
      makeOrder: "Сделать заказ",
      accepted: "Принят",
      orderContents: "Состав заказа",
      moreItems: (count) => `+${count} позиции ещё`,
    },
    profile: {
      title: "Профиль",
      authTitle: "Как работает вход?",
      authBody: (botUsername) =>
        `Откройте бота @${botUsername} в Telegram и нажмите кнопку меню. Telegram автоматически передаёт ваши данные — никаких паролей не нужно.`,
      noUserData: "Нет данных пользователя",
      ordersStat: "Заказов",
      cartStat: "В корзине",
      about: "О приложении",
      deliveryFrom: (minutes) => `от ${minutes} мин`,
      loginTitle: "Войти в профиль",
      loginBody: "Это необходимо, чтобы начать заказывать продукцию и отслеживать её.",
      loginButton: "Войти",
      contactUs: "Связаться с нами",
      ourBranches: "Наши филиалы",
      aboutCompany: "О компании",
      publicOffer: "Публичная оферта",
      privacyPolicy: "Политика конфиденциальности",
      appLanguage: "Язык приложения",
      followUs: "Подпишитесь на нас в социальных сетях",
      poweredBy: "При поддержке",
    },
    search: {
      placeholder: "Поиск блюд...",
      emptyPrompt: "Начните вводить название блюда",
      noResults: (query) => `Ничего не найдено по «${query}»`,
      addButton: "+ Добавить",
    },
    location: {
      title: "Адрес доставки",
      detectLocation: "Определить моё местоположение",
      locating: "Определяем...",
      gpsHint: "Используем GPS вашего телефона",
      geolocationUnsupported: "Геолокация не поддерживается",
      geolocationDenied: "Нет доступа к геолокации — введите адрес вручную",
      reverseGeocodeFailed: "Не удалось определить адрес по координатам",
      addressPlaceholder: "Улица, дом, квартира, ориентир...",
    },
    product: { addToCart: "В корзину", goToCart: "В корзину" },
    delivery: {
      steps: [
        { icon: "📦", label: "Упаковывается", desc: "Готовим ваш заказ" },
        { icon: "🚴", label: "Курьер забрал", desc: "Заказ у курьера" },
        { icon: "🚗", label: "В пути", desc: "Едем к вам" },
        { icon: "✅", label: "Доставлено", desc: "Заказ доставлен" },
      ],
      delivered: "Доставлено",
      arriving: "Прибываем!",
      etaMinutes: (minutes) => `~${minutes} мин`,
      asap: "Как можно скорее",
    },
    validation: {
      requiredFields: (fields) => `Заполните: ${fields.join(", ")}`,
      createOrderFailed: "Не удалось создать заказ",
      accepted: "Заказ принят!",
      error: "Ошибка",
      missingFieldLabels: { customerName: "имя", phone: "телефон" },
      unavailableProduct:
        "Один из товаров больше недоступен. Обновите каталог и попробуйте снова.",
      addAtLeastOneProduct: "Добавьте хотя бы один товар в корзину.",
      missingCustomerName: "Укажите имя клиента.",
      invalidPhone: "Укажите корректный номер телефона.",
      missingAddress: "Укажите адрес доставки.",
      deliveryOnly: "Сейчас поддерживается только доставка.",
      choosePayment: "Выберите способ оплаты.",
      invalidTelegramSession:
        "Telegram-сессия не прошла проверку. Перезапустите Mini App из бота.",
      backendOrderFailed: "Не удалось обработать заказ на сервере.",
    },
    payments: { cash: "Наличные", click: "Click", payme: "Payme" },
    bot: {
      openMiniApp: "Открыть Mini App",
      startMessage: (brandName) =>
        [
          `${brandName}: Mini App готов`,
          "",
          "Откройте каталог из кнопки ниже, чтобы посмотреть меню, собрать корзину и оформить заказ прямо внутри Telegram.",
        ].join("\n"),
      helpMessage: [
        "Быстрая инструкция:",
        "1. Откройте Mini App.",
        "2. Добавьте товары в корзину.",
        "3. Отправьте заказ через форму оформления.",
      ].join("\n"),
      webAppDataReceived:
        "Данные из Mini App получены. Если пользователь оформил заказ, команда уже увидит его в чате заказов.",
      adminOrderMessage: {
        title: (brandName, orderId) => `${brandName}: новый заказ ${orderId}`,
        customer: "Клиент",
        phone: "Телефон",
        address: "Адрес",
        payment: "Оплата",
        deliveryTime: "Время доставки",
        telegram: "Telegram",
        startParam: "Start param",
        created: "Создан",
        items: "Состав заказа",
        total: "Итого",
        comment: "Комментарий",
        unverifiedUser: "Пользователь не подтвержден",
      },
      customerOrderMessage: {
        title: (brandName) => `${brandName}: заказ принят`,
        order: "Номер",
        total: "Итого",
        address: "Адрес",
        deliveryTime: "Время",
        footer:
          "Команда уже получила ваш заказ. Если нужно что-то уточнить, просто ответьте в этом чате.",
      },
    },
  },
  en: {
    metadata: {
      layoutTitle: "Croissant Telegram Mini App",
      layoutDescription:
        "Telegram Mini App for Croissant with catalog, cart, and delivery checkout.",
      pageTitle: "Croissant Delivery Mini App",
      pageDescription:
        "Telegram Mini App for Croissant with menu browsing, cart, orders, and Telegram integration.",
    },
    localeLabel: "Language",
    localeNames: { uz: "O'zbekcha", ru: "Русский", en: "English" },
    splashSubtitle: "Delivery",
    tabs: { catalog: "Home", cart: "Cart", orders: "Orders", profile: "Profile" },
    common: {
      add: "Add",
      total: "Total",
      address: "Address",
      time: "Time",
      payment: "Payment",
      name: "Name",
      phone: "Phone",
      comment: "Comment",
      cancel: "Cancel",
      saveAddress: "Save address",
      delivery: "Delivery",
      browser: "Browser",
      telegram: "Telegram",
      authenticated: "✓ Authorized",
      support: "Support",
      bot: "Bot",
      app: "About the app",
      mapTitle: "Map",
      loadingMenu: "Loading menu...",
      deliveryAddress: "Delivery address",
      chooseAddress: "Enter delivery address",
      change: "Change",
      choose: "Choose",
      manually: "Or enter manually",
      weight: "Weight",
      toYou: "to you",
      updatesEvery20Seconds: "updates every 20 sec",
      routeLoading: "Finding the route…",
      backToCatalog: "Go to catalog",
    },
    cart: {
      title: "Cart",
      emptyTitle: "Your cart is empty",
      emptyDescription: "Add products from the catalog",
      checkoutTitle: "Checkout",
      clear: "Clear cart",
      orderButton: "Place order",
      ordering: "Placing order...",
      customerNamePlaceholder: "Your name",
      phonePlaceholder: "Phone number +998 ...",
      addressPlaceholder: "Enter delivery address",
      commentPlaceholder: "Comment (optional)",
      paymentTitle: "Payment",
    },
    orders: {
      title: "My orders",
      success: "Order accepted!",
      emptyTitle: "No orders yet",
      emptyDescription: "Your orders will appear here",
      makeOrder: "Place order",
      accepted: "Accepted",
      orderContents: "Order items",
      moreItems: (count) => `+${count} more items`,
    },
    profile: {
      title: "Profile",
      authTitle: "How does sign-in work?",
      authBody: (botUsername) =>
        `Open @${botUsername} in Telegram and tap the menu button. Telegram shares your data automatically, so no passwords are needed.`,
      noUserData: "No user data",
      ordersStat: "Orders",
      cartStat: "In cart",
      about: "About the app",
      deliveryFrom: (minutes) => `from ${minutes} min`,
      loginTitle: "Sign in to profile",
      loginBody: "Required to place orders and track them.",
      loginButton: "Sign in",
      contactUs: "Contact us",
      ourBranches: "Our branches",
      aboutCompany: "About company",
      publicOffer: "Public offer",
      privacyPolicy: "Privacy policy",
      appLanguage: "App language",
      followUs: "Follow us on social media",
      poweredBy: "Powered by",
    },
    search: {
      placeholder: "Search dishes...",
      emptyPrompt: "Start typing a dish name",
      noResults: (query) => `Nothing found for “${query}”`,
      addButton: "+ Add",
    },
    location: {
      title: "Delivery address",
      detectLocation: "Detect my location",
      locating: "Detecting...",
      gpsHint: "We use your phone's GPS",
      geolocationUnsupported: "Geolocation is not supported",
      geolocationDenied: "No access to geolocation, please enter the address manually",
      reverseGeocodeFailed: "Unable to detect the address from coordinates",
      addressPlaceholder: "Street, house, apartment, landmark...",
    },
    product: { addToCart: "Add to cart", goToCart: "Go to cart" },
    delivery: {
      steps: [
        { icon: "📦", label: "Packing", desc: "Preparing your order" },
        { icon: "🚴", label: "Picked up", desc: "The courier has your order" },
        { icon: "🚗", label: "On the way", desc: "Heading to you" },
        { icon: "✅", label: "Delivered", desc: "Order delivered" },
      ],
      delivered: "Delivered",
      arriving: "Almost there!",
      etaMinutes: (minutes) => `~${minutes} min`,
      asap: "As soon as possible",
    },
    validation: {
      requiredFields: (fields) => `Please fill in: ${fields.join(", ")}`,
      createOrderFailed: "Failed to create the order",
      accepted: "Order accepted!",
      error: "Error",
      missingFieldLabels: { customerName: "name", phone: "phone" },
      unavailableProduct:
        "One of the products is no longer available. Refresh the catalog and try again.",
      addAtLeastOneProduct: "Add at least one product to the cart.",
      missingCustomerName: "Enter the customer's name.",
      invalidPhone: "Enter a valid phone number.",
      missingAddress: "Enter the delivery address.",
      deliveryOnly: "Only delivery is supported right now.",
      choosePayment: "Choose a payment method.",
      invalidTelegramSession:
        "Telegram session validation failed. Reopen the Mini App from the bot.",
      backendOrderFailed: "Failed to process the order on the server.",
    },
    payments: { cash: "Cash", click: "Click", payme: "Payme" },
    bot: {
      openMiniApp: "Open Mini App",
      startMessage: (brandName) =>
        [
          `${brandName}: Mini App is ready`,
          "",
          "Open the catalog with the button below to browse the menu, build your cart, and place an order right inside Telegram.",
        ].join("\n"),
      helpMessage: [
        "Quick guide:",
        "1. Open the Mini App.",
        "2. Add products to the cart.",
        "3. Submit your order through the checkout form.",
      ].join("\n"),
      webAppDataReceived:
        "Mini App data received. If the user placed an order, the team can already see it in the orders chat.",
      adminOrderMessage: {
        title: (brandName, orderId) => `${brandName}: new order ${orderId}`,
        customer: "Customer",
        phone: "Phone",
        address: "Address",
        payment: "Payment",
        deliveryTime: "Delivery time",
        telegram: "Telegram",
        startParam: "Start param",
        created: "Created",
        items: "Items",
        total: "Total",
        comment: "Comment",
        unverifiedUser: "Unverified Telegram user",
      },
      customerOrderMessage: {
        title: (brandName) => `${brandName}: order accepted`,
        order: "Order",
        total: "Total",
        address: "Address",
        deliveryTime: "Delivery time",
        footer:
          "Our team has already received your order. If you need to clarify anything, just reply in this chat.",
      },
    },
  },
};

export function isAppLocale(value: string): value is AppLocale {
  return APP_LOCALES.includes(value as AppLocale);
}

export function normalizeLocale(value?: string | null): AppLocale {
  const normalized = value?.toLowerCase().trim();
  if (!normalized) return DEFAULT_LOCALE;
  if (normalized.startsWith("uz")) return "uz";
  if (normalized.startsWith("ru")) return "ru";
  if (normalized.startsWith("en")) return "en";
  return DEFAULT_LOCALE;
}

export function getIntlLocale(locale: AppLocale) {
  switch (locale) {
    case "uz":
      return "uz-UZ";
    case "en":
      return "en-US";
    default:
      return "ru-RU";
  }
}

export function getTranslations(locale: AppLocale) {
  return translations[locale];
}

export function getPreferredLocale(acceptLanguage?: string | null) {
  const candidates = (acceptLanguage ?? "")
    .split(",")
    .map((part) => part.split(";")[0]?.trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    if (candidate.startsWith("uz") || candidate.startsWith("ru") || candidate.startsWith("en")) {
      return normalizeLocale(candidate);
    }
  }

  return DEFAULT_LOCALE;
}

export function stripLocaleFromPath(pathname: string) {
  const segments = pathname.split("/");
  const [, maybeLocale, ...rest] = segments;
  if (maybeLocale && isAppLocale(maybeLocale)) {
    const nextPath = `/${rest.join("/")}`.replace(/\/+/g, "/");
    return nextPath === "/" ? nextPath : nextPath.replace(/\/$/, "");
  }
  return pathname || "/";
}

export function buildLocalePath(locale: AppLocale, pathname: string) {
  const cleanPath = stripLocaleFromPath(pathname);
  if (cleanPath === "/") return `/${locale}`;
  return `/${locale}${cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`}`;
}

export function pickLocalizedFieldValue(
  field: LocalizedField | undefined,
  locale: AppLocale,
) {
  if (!field) return "";

  const localeOrder: Record<AppLocale, Array<string | undefined>> = {
    uz: [field.uz, field.ru, field.en, field.kk],
    ru: [field.ru, field.uz, field.en, field.kk],
    en: [field.en, field.ru, field.uz, field.kk],
  };

  return (
    localeOrder[locale].map((value) => trimText(value)).find(Boolean) ||
    Object.values(field).map((value) => trimText(value)).find(Boolean) ||
    ""
  );
}

export function pickLocalizedText(
  locale: AppLocale,
  localizedValues: Partial<Record<AppLocale, string | null | undefined>>,
  fallbackValues: Array<string | null | undefined> = [],
) {
  const localeOrder: Record<AppLocale, Array<string | null | undefined>> = {
    uz: [localizedValues.uz, localizedValues.ru, localizedValues.en, ...fallbackValues],
    ru: [localizedValues.ru, localizedValues.uz, localizedValues.en, ...fallbackValues],
    en: [localizedValues.en, localizedValues.ru, localizedValues.uz, ...fallbackValues],
  };

  return localeOrder[locale].map((value) => trimText(value)).find(Boolean) || "";
}

export function translatePaymentMethod(
  locale: AppLocale,
  paymentMethod: PaymentMethod,
) {
  return getTranslations(locale).payments[paymentMethod];
}

export function formatCartCount(locale: AppLocale, count: number) {
  switch (locale) {
    case "uz":
      return `${count} ta mahsulot`;
    case "en":
      return `${count} ${count === 1 ? "item" : "items"}`;
    default:
      return `${count} ${pluralRu(count, "товар", "товара", "товаров")}`;
  }
}

export function formatEtaText(
  locale: AppLocale,
  createdAt: string,
  step: number,
) {
  const t = getTranslations(locale);
  if (step === 3) return t.delivery.delivered;

  const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  const left = Math.max(1, 35 - elapsed);

  if (step === 0) return t.delivery.etaMinutes(Math.min(left + 10, 40));
  if (step === 1) return t.delivery.etaMinutes(Math.min(left + 4, 30));
  return left <= 2 ? t.delivery.arriving : t.delivery.etaMinutes(left);
}
