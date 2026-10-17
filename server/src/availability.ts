// The one rule for what shoppers may buy: the manual in_stock flag is on AND the warehouse has at least one unit.
// It is applied when reading, so no stored flag or quantity is ever rewritten.
export const isAvailable = (row: { in_stock: boolean; stock_count: number }): boolean => row.in_stock && row.stock_count > 0;
