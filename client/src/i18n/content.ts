// Uzbek versions of the catalog texts and default banners that ship with the app (pure data, no imports).
// Product and banner rows live in the database and are written in Russian; the shop shows these translations
// on top of them (matched by id, see products.ts) and falls back to the original text for anything that has no
// translation, for example a product an administrator added later. Nothing here is ever written back to the server.
import type { Lang } from './seo.ts';

export interface ProductTextUz {
  description: string;
  howToUse?: string;
  skinType?: string;
}

export const PRODUCT_TEXT_UZ: Record<string, ProductTextUz> = {
  'prod-1': {
    description:
      "Chronolux Power Signal texnologiyali yangi avlod afsonaviy tungi tiklovchi zardob. Terini 72 soat davomida chuqur namlaydi, mimika ajinlarini yumshatadi va birinchi qo'llashdanoq yuzga yorqinlik beradi.",
    howToUse: "Ertalab va kechqurun oldindan tozalangan yuz va bo'yin terisiga, namlovchi krem surtishdan oldin qo'llang.",
    skinType: "Barcha teri turlari, jumladan sezgir teri uchun"
  },
  'prod-2': {
    description:
      "Gialuron kislotasining molekulyar massasi turlicha uch shakli va B5 vitamini bilan suv asosidagi konsentrlangan zardob. Ko'p bosqichli namlik beradi va terining himoya to'sig'ini mustahkamlaydi.",
    howToUse: "Ertalab va kechqurun, kremlardan oldin, biroz nam teriga yuzga bir necha tomchi surting.",
    skinType: 'Quruq, suvsizlangan va normal teri'
  },
  'prod-3': {
    description:
      "Sleeping Micro Biome™ probiotik kompleksli intensiv namlovchi tungi gel niqob. Uyqu paytida terining tabiiy mikrobiomini tiklaydi, charchoq izlarini yo'qotadi va yuzga dam olgan ko'rinish beradi.",
    howToUse: "Haftasiga 2–3 marta kechqurun, parvarishning oxirgi bosqichida krem o'rniga ishlating. Ertalab iliq suv bilan yuving.",
    skinType: 'Xira, charchagan va suvsizlangan teri'
  },
  'prod-4': {
    description:
      "96% salyangoz shilliq filtratli essensiya terining gidrolipid balansini tiklaydi, tirnash xususiyatini tinchlantiradi, husnbuzar izlarini bitiradi va teri tuzilishini silliq hamda tarang qiladi.",
    howToUse: "Yuvinish va tonik surtishdan so'ng essensiyaning ozgina miqdorini butun yuzga yengil urib surting.",
    skinType: 'Muammoli, sezgir, aralash teri'
  },
  'prod-5': {
    description:
      "Color Reviver texnologiyali, labning tabiiy rangini ta'kidlaydigan afsonaviy lab balzami. Yovvoyi gilos va shi moyiga boy, 24 soatgacha chuqur namlik va nozik yaltiroqlik beradi.",
    howToUse: "Tabiiy yaltiroq effekt uchun alohida ishlating yoki lab bo'yog'i ostida praymer sifatida qo'llang.",
    skinType: "Barcha lab turlari uchun"
  },
  'prod-6': {
    description:
      "Juda qulay «ikkinchi teri» teksturali mat lab bo'yog'i. Sof pigmentlarning yuqori konsentratsiyasi quruqlik hissisiz intensiv, chidamli rang va baxmal yakun beradi.",
    howToUse: "To'g'ridan-to'g'ri lablarga o'rtadan burchaklarga qarab surting. Mukammal kontur uchun lab qalamidan foydalaning.",
    skinType: 'Har qanday tur'
  },
  'prod-7': {
    description:
      "Applikator-cho'tkali mashhur konsiler-xaylayter. Ko'z atrofidagi charchoq izlarini bir zumda yo'qotadi, qora doiralarni yoritadi, burun ustuni va lab uchburchagiga urg'u beradi.",
    howToUse: "Applikator tugmasini bosing, ko'z atrofi, yonoq suyaklari va burun ustuniga surting, barmoq uchlari bilan sidiring.",
    skinType: 'Barcha teri turlari'
  },
  'prod-8': {
    description:
      "Yuzni haykaltaroshlik qilish uchun ikki rangli kremsimon palitra. To'q rang yonoqlarni ifodali qilish uchun tabiiy soya yaratadi, shaffof marvarid xaylayter esa nurni yumshoq aks ettiradi.",
    howToUse: "Cho'tka yoki barmoqlar bilan yonoq chuqurchalari, chakka va jag' chizig'iga surting, doira harakatlari bilan yuqoriga qarab sidiring.",
    skinType: 'Barcha teri turlari'
  },
  'prod-9': {
    description:
      "Sezgir, to'yingan va dadil sharqona-gurme xushbo'ylik. Pishgan qora gilos, achchiq bodom, likyor akkordlari, turk atirguli, sambak yasmini va tonka loviyasi unutilmas jozibali iz qoldiradi.",
    howToUse: "Puls nuqtalariga: bilak, bo'yin, quloq orqasi va dekolte sohasiga 15–20 sm masofadan purkang.",
    skinType: 'Premium sinfdagi uniseks parfyum'
  },
  'prod-10': {
    description:
      "Shamolli Britaniya qirg'oqlaridan ilhom. Dengiz sachrashlarining yangiligi, tuzli shag'alning mineral akkordi va tuproqli iliq maryamgul. Yengil, nafis va erkinlik hididay tetiklantiruvchi xushbo'ylik.",
    howToUse: "Toza teri yoki sochga surting. Jo Malone'ning boshqa odekolonlari bilan Fragrance Combining usulida ajoyib uyg'unlashadi.",
    skinType: 'Uniseks odekolon'
  },
  'prod-11': {
    description:
      "Erkaklik va mutlaq ishonch xushbo'yligi. Limon va bergamotning sitrusli yangiligi yangi Kaledoniya sandal daraxti, kedr va iliq ambraning chuqur akkordlariga silliq o'tadi.",
    howToUse: "Bulut kabi yoki nuqtali tarzda yoqa sohasi va bilaklarga purkang.",
    skinType: 'Erkaklar uchun'
  },
  'prod-12': {
    description:
      "Sevgining nozik gulli e'tirofi. Kalabriya bergamoti, pion, Damashq atirguli va oq mushk notalari minglab gullar bilan bezatilgan bahor ko'ylagiga o'xshaydi.",
    howToUse: "Xushbo'ylikni atrofingizga purkang va hidli bulutga kiring.",
    skinType: 'Ayollar uchun'
  }
};

export interface BannerTextUz {
  title: string;
  text: string;
  ctaLabel: string;
}

/** Keyed by the id of the default banners in data/siteContentDefaults.ts. */
export const DEFAULT_BANNER_TEXT_UZ: Record<string, BannerTextUz> = {
  'default-face-care': {
    title: 'Samarali parvarish',
    text: "Har kungi marosim uchun yetakchi go'zallik uylarining zardoblari, kremlari va essensiyalari.",
    ctaLabel: "Parvarishni ko'rish"
  },
  'default-makeup': {
    title: 'Xarakterli makiyaj',
    text: "Sizni yashirmaydigan, aksincha ta'kidlaydigan palitralar, lab bo'yoqlari va cho'tkalar.",
    ctaLabel: "Makiyajga o'tish"
  },
  'default-perfume': {
    title: "Kun bo'yi xushbo'ylik",
    text: "Nish va klassik parfyumeriya: yangi sitruslardan iliq sharqona notalargacha.",
    ctaLabel: 'Xushbo\'ylik tanlash'
  },
  'default-original': {
    title: 'Faqat original',
    text: "Savatni to'ldiring va ariza qoldiring: biz qo'ng'iroq qilib, buyurtmani tasdiqlaymiz. Onlayn to'lov shart emas.",
    ctaLabel: 'Butun katalog'
  }
};

// Units that appear in the free-text "volume" field ("50 мл", "3.2 г").
const UNITS_UZ: Record<string, string> = { 'мл': 'ml', 'г': 'g', 'шт': 'dona', 'шт.': 'dona' };

export function localizeVolume(volume: string, lang: Lang): string {
  if (lang === 'ru' || !volume) return volume;
  return volume
    .split(/(\s+)/)
    .map((token) => UNITS_UZ[token.toLowerCase()] ?? token)
    .join('');
}

interface LocalizableBanner {
  id: string;
  title: string;
  text: string;
  ctaLabel: string;
}

export function localizeBanners<T extends LocalizableBanner>(banners: T[], lang: Lang): T[] {
  if (lang === 'ru') return banners;
  return banners.map((banner) => {
    const text = DEFAULT_BANNER_TEXT_UZ[banner.id];
    return text ? { ...banner, ...text } : banner;
  });
}
