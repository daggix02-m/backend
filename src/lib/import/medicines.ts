import { supabase as supabaseClient } from '../supabase';
import { ParsedRow, findColumnByVariants, parseNumber, parseBoolean } from './parser';

const supabase = supabaseClient as any;

export interface MedicineImportRow {
  name: string;
  genericName?: string;
  brandName?: string;
  category?: string;
  sku?: string;
  unitType: string;
  strength?: string;
  manufacturer?: string;
  description?: string;
  minStockLevel?: number;
  requiresPrescription?: boolean;
  unitPrice?: number;
}

export interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  failed: number;
  importedItems: Array<{ row: number; name: string; id: number }>;
  skippedItems: Array<{ row: number; name: string; reason: string }>;
  failedItems: Array<{ row: number; data: any; errors: string[] }>;
  warnings: string[];
}

const nameVariants = ['name', 'medicine_name', 'medicinename', 'drug_name', 'product_name'];
const genericVariants = ['generic_name', 'genericname', 'generic', 'generic_name'];
const brandVariants = ['brand_name', 'brandname', 'brand', 'brand_name'];
const categoryVariants = ['category', 'category_name', 'categoryname', 'drug_category'];
const skuVariants = ['sku', 'code', 'item_code', 'product_code', 'item_code'];
const unitTypeVariants = ['unit_type', 'unittype', 'unit', 'type', 'form', 'dosage_form'];
const strengthVariants = ['strength', 'dosage', 'concentration', 'potency'];
const manufacturerVariants = ['manufacturer', 'manufacturer_name', 'company', 'brand_company'];
const descriptionVariants = ['description', 'desc', 'details', 'notes'];
const minStockVariants = ['min_stock_level', 'minstocklevel', 'min_stock', 'reorder_level', 'minimum_stock'];
const prescriptionVariants = ['requires_prescription', 'prescription', 'rx_required', 'is_prescription'];
const priceVariants = ['unit_price', 'unitprice', 'price', 'selling_price', 'rate', 'mrp'];

export const mapRowToMedicine = (row: ParsedRow): { medicine: MedicineImportRow | null; errors: string[] } => {
  const errors: string[] = [];
  const data = row.data;
  
  const name = findColumnByVariants(data, nameVariants);
  const unitType = findColumnByVariants(data, unitTypeVariants);
  const unitPrice = parseNumber(findColumnByVariants(data, priceVariants));
  
  if (!name) {
    errors.push('Missing required field: name');
  }
  
  if (!unitType) {
    errors.push('Missing required field: unit_type');
  }
  
  if (unitPrice === null) {
    errors.push('Missing required field: unit_price');
  }
  
  if (errors.length > 0) {
    return { medicine: null, errors };
  }
  
  const medicine: MedicineImportRow = {
    name: String(name).trim(),
    genericName: findColumnByVariants(data, genericVariants) ? String(findColumnByVariants(data, genericVariants)).trim() : undefined,
    brandName: findColumnByVariants(data, brandVariants) ? String(findColumnByVariants(data, brandVariants)).trim() : undefined,
    category: findColumnByVariants(data, categoryVariants) ? String(findColumnByVariants(data, categoryVariants)).trim() : undefined,
    sku: findColumnByVariants(data, skuVariants) ? String(findColumnByVariants(data, skuVariants)).trim() : undefined,
    unitType: String(unitType).trim().toLowerCase(),
    strength: findColumnByVariants(data, strengthVariants) ? String(findColumnByVariants(data, strengthVariants)).trim() : undefined,
    manufacturer: findColumnByVariants(data, manufacturerVariants) ? String(findColumnByVariants(data, manufacturerVariants)).trim() : undefined,
    description: findColumnByVariants(data, descriptionVariants) ? String(findColumnByVariants(data, descriptionVariants)).trim() : undefined,
    minStockLevel: parseNumber(findColumnByVariants(data, minStockVariants)) || 10,
    requiresPrescription: parseBoolean(findColumnByVariants(data, prescriptionVariants)),
    unitPrice: unitPrice || 0,
  };
  
  return { medicine, errors };
};

export const importMedicines = async (
  rows: ParsedRow[],
  pharmacyId: number,
  branchId: number,
  options: { createCategories?: boolean; skipDuplicates?: boolean } = {}
): Promise<ImportResult> => {
  const result: ImportResult = {
    total: rows.length,
    imported: 0,
    skipped: 0,
    failed: 0,
    importedItems: [],
    skippedItems: [],
    failedItems: [],
    warnings: [],
  };
  
  const { createCategories = true, skipDuplicates = true } = options;
  const categoryCache: Record<string, number> = {};
  
  const { data: existingCategories } = await supabase
    .from('medicine_categories')
    .select('id, name');
  
  (existingCategories || []).forEach((cat: any) => {
    categoryCache[cat.name.toLowerCase()] = cat.id;
  });
  
  for (const row of rows) {
    const { medicine, errors } = mapRowToMedicine(row);
    
    if (errors.length > 0 || !medicine) {
      result.failed++;
      result.failedItems.push({
        row: row.rowNumber,
        data: row.data,
        errors,
      });
      continue;
    }
    
    let categoryId: number | null = null;
    
    if (medicine.category) {
      const categoryLower = medicine.category.toLowerCase();
      
      if (categoryCache[categoryLower]) {
        categoryId = categoryCache[categoryLower];
      } else if (createCategories) {
        const { data: newCategory, error: catError } = await supabase
          .from('medicine_categories')
          .insert({ name: medicine.category })
          .select('id')
          .single();
        
        if (!catError && newCategory) {
          categoryId = newCategory.id;
          categoryCache[categoryLower] = newCategory.id;
          result.warnings.push(`Created new category: ${medicine.category}`);
        }
      }
    }
    
    if (medicine.sku && skipDuplicates) {
      const { data: existing } = await supabase
        .from('medicines')
        .select('id')
        .eq('sku', medicine.sku)
        .eq('branch_id', branchId)
        .maybeSingle();
      
      if (existing) {
        result.skipped++;
        result.skippedItems.push({
          row: row.rowNumber,
          name: medicine.name,
          reason: `Duplicate SKU: ${medicine.sku}`,
        });
        continue;
      }
    }
    
    const { data: newMedicine, error: insertError } = await supabase
      .from('medicines')
      .insert({
        name: medicine.name,
        generic_name: medicine.genericName || null,
        brand_name: medicine.brandName || null,
        sku: medicine.sku || null,
        unit_type: medicine.unitType,
        strength: medicine.strength || null,
        manufacturer: medicine.manufacturer || null,
        description: medicine.description || null,
        min_stock_level: medicine.minStockLevel || 10,
        requires_prescription: medicine.requiresPrescription || false,
        unit_price: medicine.unitPrice || 0,
        category_id: categoryId,
        branch_id: branchId,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id, name')
      .single();
    
    if (insertError) {
      result.failed++;
      result.failedItems.push({
        row: row.rowNumber,
        data: row.data,
        errors: [`Database error: ${insertError.message}`],
      });
    } else {
      result.imported++;
      result.importedItems.push({
        row: row.rowNumber,
        name: medicine.name,
        id: newMedicine.id,
      });
    }
  }
  
  return result;
};
