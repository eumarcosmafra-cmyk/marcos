export interface ProductData {
  name: string;
  category: string;
  categorySource: "ga4" | "inferred";
  revenue: number;
  unitsSold: number;
  views: number;
}

export interface ParseResult {
  products: ProductData[];
  format: "format_a" | "format_b";
  totalRevenue: number;
  warnings: string[];
}

function findHeaderRow(lines: string[]): number {
  return lines.findIndex(line => !line.startsWith('#') && line.trim() !== '');
}

function detectFormat(headers: string[]): "format_a" | "format_b" {
  return headers.some(h => h.toLowerCase().includes('categoria do item')) ? 'format_b' : 'format_a';
}

function inferCategory(productName: string): string {
  const name = productName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (name.includes('saia calca') || name.includes('saia calça')) return 'Saia Calça';
  if (name.includes('short saia')) return 'Short Saia';
  if (name.includes('t-shirt') || name.includes('t shirt') || name.includes('camiseta') || name.includes('camisetao')) return 'T-Shirt / Camiseta';
  if (name.includes('maio')) return 'Maiô';
  if (name.includes('body')) return 'Body';
  if (name.includes('macaquinho')) return 'Macaquinho';
  if (name.includes('legging') || (name.includes('calca') && !name.includes('saia'))) return 'Calça / Legging';
  if (name.includes('cropped')) return 'Cropped';
  if (name.includes('bermuda')) return 'Bermuda';
  if (name.includes('blusa') || name.includes('top ')) return 'Blusa / Top';
  if (name.includes('vestido')) return 'Vestido';
  if (name.includes('short') && !name.includes('saia')) return 'Short';
  if (name.includes('meia')) return 'Meia';
  if (name.includes('bone')) return 'Acessório';
  if (name.includes('biquini') || name.includes('bikini')) return 'Biquíni';
  if (name.includes('saida')) return 'Saída de Praia';
  if (name.includes('conjunto')) return 'Conjunto';
  return 'Outros';
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += char; }
  }
  result.push(current.trim());
  return result;
}

function parseNumber(val: string): number {
  if (!val) return 0;
  const cleaned = val.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function parseGA4CSV(csvContent: string): ParseResult {
  const lines = csvContent.split('\n');
  const headerIdx = findHeaderRow(lines);
  if (headerIdx === -1) throw new Error('Header row not found');

  const headers = parseCSVLine(lines[headerIdx]).map(h => h.replace(/"/g, '').trim());
  const format = detectFormat(headers);
  const warnings: string[] = [];
  const products: ProductData[] = [];

  // Map columns
  const colMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    const lower = h.toLowerCase();
    if (lower.includes('nome do item') || lower === 'item name') colMap.name = i;
    if (lower.includes('categoria do item') || lower === 'item category') colMap.category = i;
    if (lower.includes('receita') || lower.includes('revenue')) colMap.revenue = i;
    if (lower.includes('comprados') || lower.includes('purchased') || lower.includes('quantity')) colMap.units = i;
    if (lower.includes('vistos') || lower.includes('views')) colMap.views = i;
    if (lower.includes('adicionados') || lower.includes('add to cart')) colMap.cart = i;
  });

  if (colMap.name === undefined) throw new Error('Coluna "Nome do item" não encontrada');

  // Find revenue column - try multiple approaches
  if (colMap.revenue === undefined) {
    // Try last numeric column
    const testRow = headerIdx + 1 < lines.length ? parseCSVLine(lines[headerIdx + 1]) : [];
    for (let i = headers.length - 1; i >= 0; i--) {
      if (parseNumber(testRow[i]) > 0) { colMap.revenue = i; break; }
    }
  }

  if (format === 'format_a') {
    warnings.push('Categoria não disponível no export. Usando inferência por nome.');
  }

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) break;

    const cols = parseCSVLine(line);
    const name = (cols[colMap.name] || '').replace(/"/g, '').trim();
    if (!name) continue;

    const revenue = parseNumber(cols[colMap.revenue] || '0');
    if (isNaN(revenue)) break; // footer row

    const category = format === 'format_b' && colMap.category !== undefined
      ? (cols[colMap.category] || '').replace(/"/g, '').trim() || inferCategory(name)
      : inferCategory(name);

    products.push({
      name,
      category: category || 'Outros',
      categorySource: format === 'format_b' && colMap.category !== undefined ? 'ga4' : 'inferred',
      revenue,
      unitsSold: parseNumber(cols[colMap.units] || '0'),
      views: parseNumber(cols[colMap.views] || '0'),
    });
  }

  const totalRevenue = products.reduce((s, p) => s + p.revenue, 0);
  if (totalRevenue === 0) warnings.push('Receita total = 0. Verificar se o tracking de e-commerce está configurado.');

  const otherCount = products.filter(p => p.category === 'Outros').length;
  if (otherCount > products.length * 0.5) {
    warnings.push(`${otherCount} de ${products.length} produtos categorizados como "Outros". Use o export com categoria do GA4 para mais precisão.`);
  }

  return { products, format, totalRevenue, warnings };
}
