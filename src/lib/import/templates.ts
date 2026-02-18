import * as XLSX from 'xlsx';

const medicineColumns = [
  { header: 'name', description: 'Medicine name (required)', example: 'Paracetamol' },
  { header: 'generic_name', description: 'Generic name', example: 'Acetaminophen' },
  { header: 'brand_name', description: 'Brand name', example: 'Tylenol' },
  { header: 'category', description: 'Category name (auto-created if not exists)', example: 'Pain Relief' },
  { header: 'sku', description: 'Stock keeping unit', example: 'PARA-500-001' },
  { header: 'unit_type', description: 'Unit type (required): tablet, capsule, syrup, injection, etc.', example: 'tablet' },
  { header: 'strength', description: 'Dosage strength', example: '500mg' },
  { header: 'manufacturer', description: 'Manufacturer name', example: 'ABC Pharmaceuticals' },
  { header: 'description', description: 'Medicine description', example: 'For pain and fever relief' },
  { header: 'min_stock_level', description: 'Minimum stock alert level', example: '10' },
  { header: 'requires_prescription', description: 'Requires prescription? (true/false)', example: 'false' },
  { header: 'unit_price', description: 'Selling price per unit (required)', example: '5.00' },
];

const stockColumns = [
  { header: 'medicine_name', description: 'Medicine name or use sku column', example: 'Paracetamol' },
  { header: 'sku', description: 'Medicine SKU (alternative to name)', example: 'PARA-500-001' },
  { header: 'batch_number', description: 'Batch number (required)', example: 'BATCH-2024-001' },
  { header: 'quantity', description: 'Quantity received (required)', example: '100' },
  { header: 'expiry_date', description: 'Expiry date YYYY-MM-DD (required)', example: '2025-12-31' },
  { header: 'cost_price', description: 'Purchase cost per unit', example: '3.00' },
  { header: 'selling_price', description: 'Selling price per unit', example: '5.00' },
  { header: 'branch_name', description: 'Branch name (optional, uses default if empty)', example: 'Main Branch' },
];

export const generateMedicineTemplate = (): Buffer => {
  const workbook = XLSX.utils.book_new();
  
  const headers = medicineColumns.map(col => col.header);
  const descriptions = medicineColumns.map(col => col.description);
  const examples = medicineColumns.map(col => col.example);
  
  const data = [
    headers,
    descriptions,
    examples,
    ['Amoxicillin', 'Amoxicillin', 'Amoxil', 'Antibiotics', 'AMOX-250-001', 'capsule', '250mg', 'XYZ Pharma', 'Antibiotic for infections', '20', 'true', '15.00'],
    ['Ibuprofen', 'Ibuprofen', 'Advil', 'Pain Relief', 'IBU-400-001', 'tablet', '400mg', 'ABC Pharma', 'Anti-inflammatory', '15', 'false', '8.00'],
  ];
  
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  
  worksheet['!cols'] = medicineColumns.map(() => ({ wch: 20 }));
  
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Medicines');
  
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

export const generateStockTemplate = (): Buffer => {
  const workbook = XLSX.utils.book_new();
  
  const headers = stockColumns.map(col => col.header);
  const descriptions = stockColumns.map(col => col.description);
  const examples = stockColumns.map(col => col.example);
  
  const data = [
    headers,
    descriptions,
    examples,
    ['Paracetamol', 'PARA-500-001', 'BATCH-2024-001', '100', '2025-12-31', '3.00', '5.00', 'Main Branch'],
    ['Amoxicillin', 'AMOX-250-001', 'BATCH-2024-002', '50', '2025-06-30', '10.00', '15.00', ''],
  ];
  
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  
  worksheet['!cols'] = stockColumns.map(() => ({ wch: 20 }));
  
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock');
  
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

export const generateCombinedTemplate = (): Buffer => {
  const workbook = XLSX.utils.book_new();
  
  const medicineHeaders = medicineColumns.map(col => col.header);
  const medicineDescriptions = medicineColumns.map(col => col.description);
  const medicineExamples = medicineColumns.map(col => col.example);
  
  const medicineData = [
    medicineHeaders,
    medicineDescriptions,
    medicineExamples,
  ];
  
  const medicineSheet = XLSX.utils.aoa_to_sheet(medicineData);
  medicineSheet['!cols'] = medicineColumns.map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(workbook, medicineSheet, 'Medicines');
  
  const stockHeaders = stockColumns.map(col => col.header);
  const stockDescriptions = stockColumns.map(col => col.description);
  const stockExamples = stockColumns.map(col => col.example);
  
  const stockData = [
    stockHeaders,
    stockDescriptions,
    stockExamples,
  ];
  
  const stockSheet = XLSX.utils.aoa_to_sheet(stockData);
  stockSheet['!cols'] = stockColumns.map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(workbook, stockSheet, 'Stock');
  
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

export const generateMedicineCSVTemplate = (): string => {
  const headers = medicineColumns.map(col => col.header);
  return headers.join(',') + '\n';
};

export const generateStockCSVTemplate = (): string => {
  const headers = stockColumns.map(col => col.header);
  return headers.join(',') + '\n';
};

export const getTemplateColumns = (type: 'medicines' | 'stock'): typeof medicineColumns | typeof stockColumns => {
  return type === 'medicines' ? medicineColumns : stockColumns;
};
