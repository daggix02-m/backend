import * as XLSX from 'xlsx';

export interface ParsedRow {
  rowNumber: number;
  data: Record<string, any>;
  errors: string[];
}

export interface ParseResult {
  totalRows: number;
  rows: ParsedRow[];
  headerRow: string[];
}

export const parseExcelFile = (buffer: Buffer): ParseResult => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  
  if (jsonData.length < 2) {
    return { totalRows: 0, rows: [], headerRow: [] };
  }
  
  const headerRow = jsonData[0].map(h => String(h || '').toLowerCase().trim().replace(/\s+/g, '_'));
  const rows: ParsedRow[] = [];
  
  for (let i = 1; i < jsonData.length; i++) {
    const rowData = jsonData[i];
    if (!rowData || rowData.every(cell => cell === null || cell === undefined || cell === '')) {
      continue;
    }
    
    const data: Record<string, any> = {};
    const errors: string[] = [];
    
    headerRow.forEach((header, index) => {
      const value = rowData[index];
      if (header) {
        data[header] = value;
      }
    });
    
    rows.push({
      rowNumber: i + 1,
      data,
      errors,
    });
  }
  
  return {
    totalRows: rows.length,
    rows,
    headerRow,
  };
};

export const parseCSVBuffer = (buffer: Buffer): ParseResult => {
  const content = buffer.toString('utf-8');
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  
  if (lines.length < 2) {
    return { totalRows: 0, rows: [], headerRow: [] };
  }
  
  const headerRow = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim().replace(/\s+/g, '_'));
  const rows: ParsedRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    const data: Record<string, any> = {};
    const errors: string[] = [];
    
    headerRow.forEach((header, index) => {
      data[header] = values[index] || '';
    });
    
    rows.push({
      rowNumber: i + 1,
      data,
      errors,
    });
  }
  
  return {
    totalRows: rows.length,
    rows,
    headerRow,
  };
};

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
};

export const normalizeHeaderValue = (value: string): string => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
};

export const findColumnByVariants = (data: Record<string, any>, variants: string[]): any => {
  for (const variant of variants) {
    const normalized = normalizeHeaderValue(variant);
    for (const key of Object.keys(data)) {
      if (normalizeHeaderValue(key) === normalized) {
        return data[key];
      }
    }
  }
  return undefined;
};

export const parseNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const num = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? null : num;
};

export const parseDate = (value: any): string | null => {
  if (!value) return null;
  
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return new Date(date.y, date.m - 1, date.d).toISOString().split('T')[0];
    }
  }
  
  const dateStr = String(value).trim();
  const datePatterns = [
    /^(\d{4})-(\d{2})-(\d{2})$/,
    /^(\d{2})\/(\d{2})\/(\d{4})$/,
    /^(\d{2})-(\d{2})-(\d{4})$/,
  ];
  
  for (const pattern of datePatterns) {
    const match = dateStr.match(pattern);
    if (match) {
      let year, month, day;
      if (pattern === datePatterns[0]) {
        [, year, month, day] = match;
      } else {
        [, day, month, year] = match;
      }
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  
  return null;
};

export const parseBoolean = (value: any): boolean => {
  if (typeof value === 'boolean') return value;
  const str = String(value).toLowerCase().trim();
  return str === 'true' || str === 'yes' || str === '1' || str === 'y';
};
