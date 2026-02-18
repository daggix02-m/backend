import { Router, Response } from 'express';
import { supabase as supabaseClient } from '../lib/supabase';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';
import { uploadSpreadsheet } from '../middleware/upload';
import { parseExcelFile, parseCSVBuffer } from '../lib/import/parser';
import { importMedicines } from '../lib/import/medicines';
import { importStock } from '../lib/import/stock';
import { 
  generateMedicineTemplate, 
  generateStockTemplate, 
  generateCombinedTemplate,
  generateMedicineCSVTemplate,
  generateStockCSVTemplate,
  getTemplateColumns 
} from '../lib/import/templates';
import { getActiveSubscription } from '../middleware/subscription';

const router = Router();
const supabase = supabaseClient as any;

router.post('/medicines', authenticate, authorize('admin', 'manager', 'pharmacist'), uploadSpreadsheet.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { branchId, createCategories = 'true', skipDuplicates = 'true' } = req.query;
    const targetBranchId = branchId ? parseInt(branchId as string) : null;

    if (!targetBranchId) {
      const { data: branches } = await supabase
        .from('branches')
        .select('id')
        .eq('pharmacy_id', req.user!.pharmacyId)
        .eq('is_main_branch', true)
        .limit(1);

      if (!branches || branches.length === 0) {
        const { data: allBranches } = await supabase
          .from('branches')
          .select('id')
          .eq('pharmacy_id', req.user!.pharmacyId)
          .limit(1);

        if (!allBranches || allBranches.length === 0) {
          return res.status(400).json({ error: 'No branch found for this pharmacy' });
        }
        targetBranchId === allBranches[0].id;
      } else {
        targetBranchId === branches[0].id;
      }
    }

    const subscription = await getActiveSubscription(req.user!.pharmacyId);
    
    let parsed;
    const isCSV = req.file.originalname.toLowerCase().endsWith('.csv');
    
    if (isCSV) {
      parsed = parseCSVBuffer(req.file.buffer);
    } else {
      parsed = parseExcelFile(req.file.buffer);
    }

    if (parsed.totalRows === 0) {
      return res.status(400).json({ error: 'No data rows found in file' });
    }

    if (subscription && parsed.totalRows > subscription.maxImportRows) {
      return res.status(400).json({ 
        error: `Import limit exceeded. Your plan allows ${subscription.maxImportRows} rows, file has ${parsed.totalRows} rows.`,
        maxAllowed: subscription.maxImportRows,
        attempted: parsed.totalRows,
      });
    }

    const result = await importMedicines(parsed.rows, req.user!.pharmacyId, targetBranchId!, {
      createCategories: createCategories === 'true',
      skipDuplicates: skipDuplicates === 'true',
    });

    res.json({
      success: true,
      summary: {
        total: result.total,
        imported: result.imported,
        skipped: result.skipped,
        failed: result.failed,
      },
      imported: result.importedItems.slice(0, 50),
      skipped: result.skippedItems.slice(0, 50),
      failed: result.failedItems.slice(0, 50),
      warnings: result.warnings,
    });
  } catch (error) {
    console.error('Medicine import error:', error);
    res.status(500).json({ error: 'Failed to import medicines' });
  }
});

router.post('/stock', authenticate, authorize('admin', 'manager', 'pharmacist'), uploadSpreadsheet.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { branchId, skipDuplicates = 'true' } = req.query;
    
    let targetBranchId = branchId ? parseInt(branchId as string) : null;

    if (!targetBranchId) {
      const { data: branches } = await supabase
        .from('branches')
        .select('id')
        .eq('pharmacy_id', req.user!.pharmacyId)
        .eq('is_main_branch', true)
        .limit(1);

      if (!branches || branches.length === 0) {
        const { data: allBranches } = await supabase
          .from('branches')
          .select('id')
          .eq('pharmacy_id', req.user!.pharmacyId)
          .limit(1);

        if (!allBranches || allBranches.length === 0) {
          return res.status(400).json({ error: 'No branch found for this pharmacy' });
        }
        targetBranchId = allBranches[0].id;
      } else {
        targetBranchId = branches[0].id;
      }
    }

    const subscription = await getActiveSubscription(req.user!.pharmacyId);
    
    let parsed;
    const isCSV = req.file.originalname.toLowerCase().endsWith('.csv');
    
    if (isCSV) {
      parsed = parseCSVBuffer(req.file.buffer);
    } else {
      parsed = parseExcelFile(req.file.buffer);
    }

    if (parsed.totalRows === 0) {
      return res.status(400).json({ error: 'No data rows found in file' });
    }

    if (subscription && parsed.totalRows > subscription.maxImportRows) {
      return res.status(400).json({ 
        error: `Import limit exceeded. Your plan allows ${subscription.maxImportRows} rows, file has ${parsed.totalRows} rows.`,
        maxAllowed: subscription.maxImportRows,
        attempted: parsed.totalRows,
      });
    }

    const result = await importStock(parsed.rows, req.user!.pharmacyId, targetBranchId, {
      skipDuplicates: skipDuplicates === 'true',
    });

    res.json({
      success: true,
      summary: {
        total: result.total,
        imported: result.imported,
        skipped: result.skipped,
        failed: result.failed,
      },
      imported: result.importedItems.slice(0, 50),
      skipped: result.skippedItems.slice(0, 50),
      failed: result.failedItems.slice(0, 50),
      warnings: result.warnings,
    });
  } catch (error) {
    console.error('Stock import error:', error);
    res.status(500).json({ error: 'Failed to import stock' });
  }
});

router.get('/template/medicines', authenticate, authorize('admin', 'manager', 'pharmacist'), (req, res: Response) => {
  const { format } = req.query;

  if (format === 'csv') {
    const csv = generateMedicineCSVTemplate();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=medicines_template.csv');
    res.send(csv);
  } else {
    const buffer = generateMedicineTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=medicines_template.xlsx');
    res.send(buffer);
  }
});

router.get('/template/stock', authenticate, authorize('admin', 'manager', 'pharmacist'), (req, res: Response) => {
  const { format } = req.query;

  if (format === 'csv') {
    const csv = generateStockCSVTemplate();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=stock_template.csv');
    res.send(csv);
  } else {
    const buffer = generateStockTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=stock_template.xlsx');
    res.send(buffer);
  }
});

router.get('/template/combined', authenticate, authorize('admin', 'manager', 'pharmacist'), (req, res: Response) => {
  const buffer = generateCombinedTemplate();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=import_template.xlsx');
  res.send(buffer);
});

router.get('/columns/:type', authenticate, authorize('admin', 'manager', 'pharmacist'), (req, res: Response) => {
  const type = req.params.type as string;

  if (!['medicines', 'stock'].includes(type)) {
    return res.status(400).json({ error: 'Invalid type. Use "medicines" or "stock"' });
  }

  const columns = getTemplateColumns(type as 'medicines' | 'stock');
  res.json(columns);
});

export default router;
