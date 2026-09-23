import { Product } from '../types';

export const INITIAL_PRODUCTS: Product[] = [
  // --- УХОД ЗА ЛИЦОМ (Face Care) ---
  {
    id: 'prod-1',
    name: 'Advanced Night Repair Serum',
    brand: 'Estée Lauder',
    category: 'face-care',
    price: 980000,
    oldPrice: 1150000,
    rating: 4.9,
    reviewsCount: 142,
    volume: '50 мл',
    images: [
      'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1608248597359-247f078a6ff6?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'Легендарная ночная восстанавливающая сыворотка нового поколения с технологией Chronolux Power Signal. Глубоко увлажняет на 72 часа, разглаживает мимические морщинки и придает сияние коже уже после первого применения.',
    composition: 'Water/Aqua/Eau, Bifida Ferment Lysate, PEG-8, Propanediol, Bis-PEG-18 Methyl Ether Dimethyl Silane, Methyl Gluceth-20, Sodium Hyaluronate, Hydrolyzed Algin, Lactobacillus Ferment, Tripeptide-32, Yeast Extract, Tocopheryl Acetate, Caffeine, Phenoxyethanol.',
    howToUse: 'Наносите утром и вечером на предварительно очищенную кожу лица и шеи перед нанесением увлажняющего крема.',
    skinType: 'Для всех типов кожи, включая чувствительную',
    inStock: true,
    stockCount: 18,
    isBestseller: true
  },
  {
    id: 'prod-2',
    name: 'Hyaluronic Acid 2% + B5',
    brand: 'The Ordinary',
    category: 'face-care',
    price: 180000,
    oldPrice: 210000,
    rating: 4.8,
    reviewsCount: 310,
    volume: '30 мл',
    images: [
      'https://images.unsplash.com/photo-1608248597359-247f078a6ff6?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'Концентрированная сыворотка на водной основе с тремя формами гиалуроновой кислоты разной молекулярной массы и витамином B5. Обеспечивает многоуровневое увлажнение и укрепляет защитный барьер.',
    composition: 'Aqua (Water), Sodium Hyaluronate, Sodium Hyaluronate Crosspolymer, Panthenol, Ahnfeltia Concinna Extract, Glycerin, Pentylene Glycol, Propanediol, Isoceteth-20, Ethoxydiglycol, Ethylhexylglycerin, Citric Acid, Phenoxyethanol.',
    howToUse: 'Несколько капель нанесите на лицо утром и вечером перед кремами на слегка влажную кожу.',
    skinType: 'Сухая, обезвоженная, нормальная кожа',
    inStock: true,
    stockCount: 35,
    isBestseller: true
  },
  {
    id: 'prod-3',
    name: 'Water Sleeping Mask EX',
    brand: 'Laneige',
    category: 'face-care',
    price: 420000,
    oldPrice: 470000,
    rating: 4.9,
    reviewsCount: 98,
    volume: '70 мл',
    images: [
      'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'Интенсивно увлажняющая ночная гелевая маска с пробиотическим комплексом Sleeping Micro Biome™. Восстанавливает естественный микробиом кожи во время сна, снимает следы усталости и придает лицу отдохнувший вид.',
    composition: 'Water, Butylene Glycol, Glycerin, Trehalose, Methyl Trimethicone, 1,2-Hexanediol, Squalane, Phenyl Trimethicone, PCA Dimethicone, Lactobacillus Ferment Lysate, Beta-Glucan, Malachite Extract, Carbomer, Tromethamine.',
    howToUse: 'Используйте 2-3 раза в неделю вечером на последнем этапе ухода вместо крема. Смойте теплой водой утром.',
    skinType: 'Тусклая, уставшая, обезвоженная кожа',
    inStock: true,
    stockCount: 22,
    isNew: true
  },
  {
    id: 'prod-4',
    name: 'Advanced Snail 96 Mucin Power Essence',
    brand: 'Cosrx',
    category: 'face-care',
    price: 290000,
    oldPrice: 340000,
    rating: 4.9,
    reviewsCount: 245,
    volume: '100 мл',
    images: [
      'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'Эссенция с 96% фильтратом муцина улитки восстанавливает гидролипидный баланс, успокаивает раздражения, заживляет постакне и делает текстуру кожи безупречно гладкой и упругой.',
    composition: 'Snail Secretion Filtrate, Betaine, Butylene Glycol, 1,2-Hexanediol, Sodium Polyacrylate, Phenoxyethanol, Sodium Hyaluronate, Allantoin, Carbomer, Panthenol, Arginine.',
    howToUse: 'После умывания и тонизирования нанесите небольшое количество эссенции на все лицо мягкими похлопывающими движениями.',
    skinType: 'Проблемная, чувствительная, комбинированная',
    inStock: true,
    stockCount: 14,
    isBestseller: true
  },

  // --- ДЕКОРАТИВНАЯ КОСМЕТИКА (Makeup) ---
  {
    id: 'prod-5',
    name: 'Dior Addict Lip Glow Balm',
    brand: 'Dior',
    category: 'makeup',
    price: 520000,
    oldPrice: 580000,
    rating: 5.0,
    reviewsCount: 184,
    volume: '3.2 г',
    images: [
      'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1631214524020-7e18db9a8f92?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'Культовый бальзам для губ, подчеркивающий естественный оттенок с технологией Color Reviver. Насыщен маслом дикой вишни и маслом ши, обеспечивает глубокое увлажнение до 24 часов и нежное сияние.',
    composition: 'Polyglyceryl-2 Triisostearate, Helianthus Annuus (Sunflower) Seed Oil, Hydrogenated Castor Oil Dimer Dilinoleate, Phytosteryl/Octyldodecyl Lauroyl Glutamate, Jojoba Esters, Butyrospermum Parkii (Shea) Butter, Prunus Avium (Sweet Cherry) Seed Oil, Tocopherol.',
    howToUse: 'Наносите самостоятельно для естественного сияющего эффекта или используйте в качестве праймера под помаду.',
    skinType: 'Для всех типов губ',
    inStock: true,
    stockCount: 12,
    isBestseller: true
  },
  {
    id: 'prod-6',
    name: 'Rouge Allure Velvet Luminous Matte',
    brand: 'Chanel',
    category: 'makeup',
    price: 610000,
    oldPrice: 690000,
    rating: 4.9,
    reviewsCount: 89,
    volume: '3.5 г',
    images: [
      'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'Матовая помада для губ с ультракомфортной текстурой "второй кожи". Высокая концентрация чистых пигментов дарит интенсивный стойкий цвет и бархатный финиш без ощущения сухости.',
    composition: 'Octyldodecanol, Caprylic/Capric Triglyceride, Candelilla Cera (Euphorbia Cerifera Cera), Kaolin, Cera Microcristallina, Silica, Jojoba Esters, Ricinus Communis Seed Oil, Butyrospermum Parkii Butter, CI 77891, CI 15850.',
    howToUse: 'Наносите непосредственно на губы от центра к уголкам. Для идеального контура используйте карандаш для губ.',
    skinType: 'Любой тип',
    inStock: true,
    stockCount: 9,
    isBestseller: true
  },
  {
    id: 'prod-7',
    name: 'Touche Éclat Radiant Touch Pen',
    brand: 'Yves Saint Laurent',
    category: 'makeup',
    price: 540000,
    oldPrice: 590000,
    rating: 4.8,
    reviewsCount: 112,
    volume: '2.5 мл',
    images: [
      'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1631214524020-7e18db9a8f92?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'Знаменитый консилер-хайлайтер с кисточкой-аппликатором. Мгновенно стирает следы усталости вокруг глаз, подсвечивает темные круги, расставляет акценты на спинке носа и галочке губ.',
    composition: 'Aqua (Water), Cyclopentasiloxane, Talc, Glycerin, Paraffinum Liquidum, Dimethicone, Polymethyl Methacrylate, Isododecane, Tocopherol, Ruscus Aculeatus Root Extract, Caffeine, Phenoxyethanol.',
    howToUse: 'Нажмите на кнопку аппликатора, нанесите на зону вокруг глаз, скулы и спинку носа, растушуйте подушечками пальцев.',
    skinType: 'Все типы кожи',
    inStock: true,
    stockCount: 16
  },
  {
    id: 'prod-8',
    name: 'Shade and Illuminate Contour Duo',
    brand: 'Tom Ford',
    category: 'makeup',
    price: 1150000,
    oldPrice: 1300000,
    rating: 4.9,
    reviewsCount: 67,
    volume: '14 г',
    images: [
      'https://images.unsplash.com/photo-1631214524020-7e18db9a8f92?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'Двухцветная кремовая палетка для скульптурирования лица. Темный оттенок создает естественную тень для выразительности скул, а прозрачный жемчужный хайлайтер мягко отражает свет.',
    composition: 'Polymethyl Methacrylate, Dimethicone, Isononyl Isononanoate, Hydrogenated Polyisobutene, Cera Microcristallina, Caprylic/Capric Triglyceride, Mica, Synthetic Wax, Silica, Titanium Dioxide (CI 77891), Iron Oxides.',
    howToUse: 'Наносите кистью или пальцами на впадины скул, виски и линию челюсти, растушевывая круговыми движениями вверх.',
    skinType: 'Все типы кожи',
    inStock: true,
    stockCount: 6,
    isNew: true
  },

  // --- ПАРФЮМЕРИЯ (Perfume) ---
  {
    id: 'prod-9',
    name: 'Lost Cherry Eau de Parfum',
    brand: 'Tom Ford',
    category: 'perfume',
    price: 3450000,
    oldPrice: 3800000,
    rating: 5.0,
    reviewsCount: 220,
    volume: '50 мл',
    images: [
      'https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1547887537-6158d64c35b3?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'Чувственный, насыщенный и дерзкий восточно-гурманский аромат. Спелая черная черешня, горький миндаль, ликерные аккорды, турецкая роза, жасмин самбак и бобы тонка создают незабываемый магнетический шлейф.',
    composition: 'Alcohol Denat., Fragrance (Parfum), Water/Aqua/Eau, Coumarin, Benzyl Benzoate, Benzyl Cinnamate, Anise Alcohol, Isoeugenol, Citronellol, Geraniol, Eugenol, Benzyl Alcohol.',
    howToUse: 'Распыляйте на точки пульса: запястья, шею, за ушами и в зону декольте на расстоянии 15-20 см.',
    skinType: 'Унисекс парфюм премиум класса',
    inStock: true,
    stockCount: 8,
    isBestseller: true
  },
  {
    id: 'prod-10',
    name: 'Wood Sage & Sea Salt Cologne',
    brand: 'Jo Malone',
    category: 'perfume',
    price: 1850000,
    oldPrice: 2050000,
    rating: 4.9,
    reviewsCount: 165,
    volume: '100 мл',
    images: [
      'https://images.unsplash.com/photo-1547887537-6158d64c35b3?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'Вдохновение ветреного британского побережья. Свежесть морских брызг, минеральный аккорд соленой гальки и землистый теплый шалфей. Невесомый, элегантный и освежающий аромат свободы.',
    composition: 'Alcohol Denat., Water\\Aqua\\Eau, Fragrance (Parfum), Limonene, Alpha-Isomethyl Ionone, Linalool, Geraniol, Citronellol, Coumarin, Citral.',
    howToUse: 'Наносите на чистую кожу или волосы. Прекрасно сочетается в технике Fragrance Combining с другими одеколонами Jo Malone.',
    skinType: 'Унисекс одеколон',
    inStock: true,
    stockCount: 15
  },
  {
    id: 'prod-11',
    name: 'Bleu de Chanel Parfum',
    brand: 'Chanel',
    category: 'perfume',
    price: 2400000,
    oldPrice: 2650000,
    rating: 5.0,
    reviewsCount: 195,
    volume: '100 мл',
    images: [
      'https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'Аромат мужественности и абсолютной уверенности. Цитрусовая свежесть лимона и бергамота плавно переходит в глубокие аккорды новокаледонского сандала, кедра и теплой амбры.',
    composition: 'Alcohol, Parfum (Fragrance), Aqua (Water), Limonene, Linalool, Citronellol, Coumarin, Citral, Geraniol, Farnesol, Evernia Prunastri (Oakmoss) Extract.',
    howToUse: 'Распыляйте облаком или точечно на воротниковую зону и запястья.',
    skinType: 'Для мужчин',
    inStock: true,
    stockCount: 11,
    isBestseller: true
  },
  {
    id: 'prod-12',
    name: 'Miss Dior Blooming Bouquet',
    brand: 'Dior',
    category: 'perfume',
    price: 1950000,
    oldPrice: 2200000,
    rating: 4.8,
    reviewsCount: 130,
    volume: '50 мл',
    images: [
      'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1547887537-6158d64c35b3?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'Нежное цветочное признание в любви. Ноты калабрийского бергамота, пиона, дамасской розы и белого мускуса словно весеннее платье, усыпанное тысячами цветов.',
    composition: 'Alcohol, Aqua (Water), Parfum (Fragrance), Butyl Methoxydibenzoylmethane, Limonene, Hydroxycitronellal, Linalool, Hexyl Cinnamal, Citronellol, Benzyl Salicylate, Alpha-Isomethyl Ionone, Geraniol.',
    howToUse: 'Распылите аромат вокруг себя и войдите в душистое облако.',
    skinType: 'Для женщин',
    inStock: true,
    stockCount: 19,
    isNew: true
  }
];

export const POPULAR_BRANDS = [
  'Chanel',
  'Dior',
  'The Ordinary',
  'Tom Ford',
  'Estée Lauder',
  'Laneige',
  'Cosrx',
  'Jo Malone',
  'Yves Saint Laurent'
];

export const CATEGORIES_CONFIG = [
  { id: 'all', name: 'Все товары', icon: 'Sparkles' },
  { id: 'face-care', name: 'Уход за лицом', icon: 'Smile' },
  { id: 'makeup', name: 'Декоративная косметика', icon: 'Palette' },
  { id: 'perfume', name: 'Парфюмерия', icon: 'Flame' },
  { id: 'brands', name: 'Бренды', icon: 'Award' }
] as const;
