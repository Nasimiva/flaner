import type { Banner, BrandItem } from '../utils/siteContentApi';
import { POPULAR_BRANDS } from './initialProducts';

// Shown until an administrator saves their own content (admin panel, tab "Контент").
const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1400&q=80`;

export const DEFAULT_BANNERS: Banner[] = [
  {
    id: 'default-face-care',
    title: 'Уход, который работает',
    text: 'Сыворотки, кремы и эссенции ведущих домов красоты для ежедневного ритуала.',
    ctaLabel: 'Смотреть уход',
    ctaCategory: 'face-care',
    ctaLink: '',
    imageUrl: unsplash('1608571423902-eed4a5ad8108'),
    active: true
  },
  {
    id: 'default-makeup',
    title: 'Макияж с характером',
    text: 'Палетки, помады и кисти, которые подчёркивают вас, а не маскируют.',
    ctaLabel: 'К макияжу',
    ctaCategory: 'makeup',
    ctaLink: '',
    imageUrl: unsplash('1596462502278-27bfdc403348'),
    active: true
  },
  {
    id: 'default-perfume',
    title: 'Ароматы на весь день',
    text: 'Нишевая и классическая парфюмерия: от свежих цитрусов до тёплых восточных нот.',
    ctaLabel: 'Выбрать аромат',
    ctaCategory: 'perfume',
    ctaLink: '',
    imageUrl: unsplash('1592945403244-b3fbafd7f539'),
    active: true
  },
  {
    id: 'default-original',
    title: 'Только оригинал',
    text: 'Соберите корзину и оставьте заявку: мы позвоним и подтвердим заказ. Оплата онлайн не нужна.',
    ctaLabel: 'Весь каталог',
    ctaCategory: 'all',
    ctaLink: '',
    imageUrl: unsplash('1598440947619-2c35fc9aa908'),
    active: true
  }
];

export const DEFAULT_BRANDS: BrandItem[] = POPULAR_BRANDS.map((name) => ({
  id: `default-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  name,
  logoUrl: ''
}));
