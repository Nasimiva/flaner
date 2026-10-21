// Read-only catalog audit: brand field vs brand in the name, category vs product type in the name.
// Reads the public catalog (GET only) or saved JSON files and writes CSV reports. Never writes to the database.
//
//   node scripts/audit-catalog.ts [--products <url|file>] [--categories <url|file>] [--out <dir>]
//
// Defaults: https://flaner.uz/api/products, https://flaner.uz/api/categories, current directory.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { checkProduct, type CheckCategory } from '../src/utils/productCheck.ts';

interface ApiProduct { id: string; name: string; brand: string; category: string; description?: string }

const args = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

async function load<T>(source: string): Promise<T> {
  if (/^https?:\/\//.test(source)) {
    const res = await fetch(source, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`${source}: HTTP ${res.status}`);
    return (await res.json()) as T;
  }
  return JSON.parse((await readFile(source, 'utf8')).replace(/^﻿/, '')) as T;
}

const csvCell = (value: string) => (/[;"\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
const csv = (rows: string[][]) => '﻿' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n') + '\r\n';

const products = await load<ApiProduct[]>(arg('products', 'https://flaner.uz/api/products'));
const categories = (await load<{ id: string; name: string }[]>(arg('categories', 'https://flaner.uz/api/categories')))
  .map(({ id, name }): CheckCategory => ({ id, name }));
const outDir = arg('out', '.');
const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? `${id} (нет такой категории)`;

const NO_CHANGE = '—';
const MANUAL = 'проверить вручную';

const report: { high: boolean; row: string[] }[] = [];
const spelling: string[][] = [];

for (const product of products) {
  const result = checkProduct(product, categories);
  const { brand, category } = result;
  if (brand.kind === 'spelling') spelling.push([product.id, product.name, product.brand, brand.suggested ?? '']);

  const brandIssue = brand.kind === 'mismatch' || brand.kind === 'unknown';
  const categoryIssue = category.kind === 'mismatch' || category.kind === 'unknown';
  if (!brandIssue && !categoryIssue) continue;

  const confidences = [brandIssue ? brand.confidence : undefined, categoryIssue ? category.confidence : undefined].filter(Boolean);
  const high = confidences.every((c) => c === 'high')
    && (!brandIssue || Boolean(brand.suggested)) && (!categoryIssue || Boolean(category.suggested));
  const reasons = [brandIssue ? `Бренд: ${brand.reason}` : '', categoryIssue ? `Категория: ${category.reason}` : ''].filter(Boolean);

  report.push({
    high,
    row: [
      product.id,
      product.name,
      product.brand.trim(),
      brandIssue ? brand.suggested ?? MANUAL : NO_CHANGE,
      catName(product.category),
      categoryIssue ? (category.suggested ? catName(category.suggested) : MANUAL) : NO_CHANGE,
      high ? 'высокая' : 'низкая',
      reasons.join(' | '),
      ''
    ]
  });
}

report.sort((a, b) => Number(b.high) - Number(a.high) || a.row[4].localeCompare(b.row[4]) || a.row[1].localeCompare(b.row[1]));

const header = ['ID', 'Название', 'Текущий бренд', 'Предлагаемый бренд', 'Текущая категория', 'Предлагаемая категория',
  'Уверенность', 'Почему', 'Одобрить (да/нет)'];
await writeFile(join(outDir, 'catalog_audit.csv'), csv([header, ...report.map((r) => r.row)]));
await writeFile(join(outDir, 'catalog_brand_spelling.csv'),
  csv([['ID', 'Название', 'Бренд сейчас', 'Как писать'], ...spelling]));

const highCount = report.filter((r) => r.high).length;
console.log(`Товаров: ${products.length}. В отчёте: ${report.length} (высокая уверенность: ${highCount}, низкая: ${report.length - highCount}).`);
console.log(`Только написание бренда (пробелы/регистр): ${spelling.length}.`);
console.log(`Файлы: ${join(outDir, 'catalog_audit.csv')}, ${join(outDir, 'catalog_brand_spelling.csv')}`);
