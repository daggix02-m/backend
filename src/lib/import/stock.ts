import { supabase as supabaseClient } from '../supabase';
import { ParsedRow, findColumnByVariants, parseNumber, parseDate } from './parser';

const supabase = supabaseClient as any;

export interface StockImportRow {
  medicineIdentifier: string;
  identifierType: 'name' | 'sku';
  batchNumber: string;
  quantity: number;
  expiryDate: string;
  costPrice?: number;
  sellingPrice?: number;
  branchName?: string;
}

export interface StockImportResult {
  total: number;
  imported: number;
  skipped: number;
  failed: number;
  importedItems: Array<{ row: number; medicine: string; batchId: number; stockId: number }>;
  skippedItems: Array<{ row: number; medicine: string; reason: string }>;
  failedItems: Array<{ row: number; data: any; errors: string[] }>;
  warnings: string[];
}

const medicineNameVariants = ['medicine_name', 'medicinename', 'name', 'drug_name', 'product_name'];
const skuVariants = ['sku', 'code', 'item_code', 'product_code', 'medicine_sku'];
const batchVariants = ['batch_number', 'batchnumber', 'batch', 'batch_no', 'lot_number'];
const quantityVariants = ['quantity', 'qty', 'stock', 'units', 'count', 'received_quantity'];
const expiryVariants = ['expiry_date', 'expirydate', 'expiry', 'exp_date', 'expires', 'exp'];
const costPriceVariants = ['cost_price', 'costprice', 'cost', 'purchase_price', 'buying_price'];
const sellingPriceVariants = ['selling_price', 'sellingprice', 'price', 'sale_price', 'mrp', 'unit_price'];
const branchVariants = ['branch_name', 'branchname', 'branch', 'location', 'store'];

export const mapRowToStock = (row: ParsedRow): { stock: StockImportRow | null; errors: string[] } => {
  const errors: string[] = [];
  const data = row.data;
  
  const medicineName = findColumnByVariants(data, medicineNameVariants);
  const sku = findColumnByVariants(data, skuVariants);
  const batchNumber = findColumnByVariants(data, batchVariants);
  const quantity = parseNumber(findColumnByVariants(data, quantityVariants));
  const expiryDate = parseDate(findColumnByVariants(data, expiryVariants));
  
  if (!medicineName && !sku) {
    errors.push('Missing medicine identifier (name or SKU)');
  }
  
  if (!batchNumber) {
    errors.push('Missing required field: batch_number');
  }
  
  if (quantity === null || quantity <= 0) {
    errors.push('Missing or invalid quantity');
  }
  
  if (!expiryDate) {
    errors.push('Missing or invalid expiry_date');
  }
  
  if (errors.length > 0) {
    return { stock: null, errors };
  }
  
  const identifierType = sku ? 'sku' : 'name';
  const medicineIdentifier = sku || medicineName;
  
  const stock: StockImportRow = {
    medicineIdentifier: String(medicineIdentifier).trim(),
    identifierType,
    batchNumber: String(batchNumber).trim(),
    quantity: quantity || 0,
    expiryDate: expiryDate || '',
    costPrice: parseNumber(findColumnByVariants(data, costPriceVariants)) || undefined,
    sellingPrice: parseNumber(findColumnByVariants(data, sellingPriceVariants)) || undefined,
    branchName: findColumnByVariants(data, branchVariants) ? String(findColumnByVariants(data, branchVariants)).trim() : undefined,
  };
  
  return { stock, errors };
};

export const importStock = async (
  rows: ParsedRow[],
  pharmacyId: number,
  defaultBranchId: number,
  options: { skipDuplicates?: boolean } = {}
): Promise<StockImportResult> => {
  const result: StockImportResult = {
    total: rows.length,
    imported: 0,
    skipped: 0,
    failed: 0,
    importedItems: [],
    skippedItems: [],
    failedItems: [],
    warnings: [],
  };
  
  const { skipDuplicates = true } = options;
  
  const medicineCache: Record<string, { id: number; branchId: number }> = {};
  
  const branchCache: Record<string, number> = {};
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .eq('pharmacy_id', pharmacyId);
  
  (branches || []).forEach((branch: any) => {
    branchCache[branch.name.toLowerCase()] = branch.id;
  });
  branchCache['default'] = defaultBranchId;
  
  for (const row of rows) {
    const { stock, errors } = mapRowToStock(row);
    
    if (errors.length > 0 || !stock) {
      result.failed++;
      result.failedItems.push({
        row: row.rowNumber,
        data: row.data,
        errors,
      });
      continue;
    }
    
    const cacheKey = `${stock.identifierType}:${stock.medicineIdentifier.toLowerCase()}`;
    let medicineInfo = medicineCache[cacheKey];
    
    if (!medicineInfo) {
      let query = supabase
        .from('medicines')
        .select('id, branch_id')
        .eq('is_deleted', false);
      
      if (stock.identifierType === 'sku') {
        query = query.eq('sku', stock.medicineIdentifier);
      } else {
        query = query.ilike('name', stock.medicineIdentifier);
      }
      
      const { data: medicines } = await query.limit(1);
      
      if (!medicines || medicines.length === 0) {
        result.failed++;
        result.failedItems.push({
          row: row.rowNumber,
          data: row.data,
          errors: [`Medicine not found: ${stock.medicineIdentifier}`],
        });
        continue;
      }
      
      medicineInfo = {
        id: medicines[0].id,
        branchId: medicines[0].branch_id,
      };
      medicineCache[cacheKey] = medicineInfo;
    }
    
    let targetBranchId = defaultBranchId;
    if (stock.branchName) {
      const branchLower = stock.branchName.toLowerCase();
      if (branchCache[branchLower]) {
        targetBranchId = branchCache[branchLower];
      } else {
        result.warnings.push(`Branch not found: ${stock.branchName}, using default branch`);
      }
    }
    
    if (skipDuplicates) {
      const { data: existingBatch } = await supabase
        .from('medicine_batches')
        .select('id')
        .eq('medicine_id', medicineInfo.id)
        .eq('batch_number', stock.batchNumber)
        .maybeSingle();
      
      if (existingBatch) {
        result.skipped++;
        result.skippedItems.push({
          row: row.rowNumber,
          medicine: stock.medicineIdentifier,
          reason: `Duplicate batch: ${stock.batchNumber}`,
        });
        continue;
      }
    }
    
    const { data: newBatch, error: batchError } = await supabase
      .from('medicine_batches')
      .insert({
        medicine_id: medicineInfo.id,
        batch_number: stock.batchNumber,
        expiry_date: stock.expiryDate,
        quantity: stock.quantity,
        cost_price: stock.costPrice || null,
        selling_price: stock.sellingPrice || null,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    
    if (batchError || !newBatch) {
      result.failed++;
      result.failedItems.push({
        row: row.rowNumber,
        data: row.data,
        errors: [`Failed to create batch: ${batchError?.message || 'Unknown error'}`],
      });
      continue;
    }
    
    const { data: existingStock } = await supabase
      .from('stocks')
      .select('id, quantity')
      .eq('medicine_id', medicineInfo.id)
      .eq('branch_id', targetBranchId)
      .maybeSingle();
    
    let stockId: number;
    
    if (existingStock) {
      const { data: updatedStock, error: updateError } = await supabase
        .from('stocks')
        .update({
          quantity: existingStock.quantity + stock.quantity,
          last_restocked: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingStock.id)
        .select('id')
        .single();
      
      if (updateError || !updatedStock) {
        result.warnings.push(`Failed to update stock for ${stock.medicineIdentifier}`);
        stockId = existingStock.id;
      } else {
        stockId = updatedStock.id;
      }
    } else {
      const { data: newStock, error: stockError } = await supabase
        .from('stocks')
        .insert({
          medicine_id: medicineInfo.id,
          branch_id: targetBranchId,
          pharmacy_id: pharmacyId,
          quantity: stock.quantity,
          last_restocked: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      
      if (stockError || !newStock) {
        result.failed++;
        result.failedItems.push({
          row: row.rowNumber,
          data: row.data,
          errors: [`Failed to create stock: ${stockError?.message || 'Unknown error'}`],
        });
        continue;
      }
      
      stockId = newStock.id;
    }
    
    result.imported++;
    result.importedItems.push({
      row: row.rowNumber,
      medicine: stock.medicineIdentifier,
      batchId: newBatch.id,
      stockId,
    });
  }
  
  return result;
};
