import { Router, Response } from 'express';
import { supabase as supabaseClient } from '../../lib/supabase';
import { AuthUtils } from '../../lib/auth';
import { AuthRequest, authenticate, authorize, requireOwner, checkIsOwner } from '../../middleware/auth';
import { uploadSpreadsheet } from '../../middleware/upload';
import { parseExcelFile, parseCSVBuffer } from '../../lib/import/parser';
import { importMedicines } from '../../lib/import/medicines';
import { importStock } from '../../lib/import/stock';
import { generateMedicineTemplate, generateStockTemplate } from '../../lib/import/templates';
import { getActiveSubscription } from '../../middleware/subscription';

const router = Router();
const supabase = supabaseClient as any;

router.get('/dashboard', authenticate, authorize('manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { branchId } = req.query;
    const pharmacyId = req.user!.pharmacyId;

    const { data: branches } = await supabase
      .from('branches')
      .select('id, name')
      .eq('pharmacy_id', pharmacyId);

    const { data: staff } = await supabase
      .from('users')
      .select('id, is_active')
      .eq('pharmacy_id', pharmacyId);

    let salesQuery = supabase
      .from('sales')
      .select('id, branch_id, total_amount, final_amount, status, created_at')
      .eq('pharmacy_id', pharmacyId)
      .order('created_at', { ascending: false });

    const { data: sales } = await salesQuery;

    const { data: stocks } = await supabase
      .from('stocks')
      .select('id, quantity, medicine_id, branch_id, medicines (name)')
      .eq('pharmacy_id', pharmacyId);

    let filteredSales = sales || [];
    if (branchId) {
      filteredSales = filteredSales.filter((s: any) => s.branch_id === parseInt(branchId as string));
    }

    const today = new Date().toISOString().split('T')[0];
    const todaySales = filteredSales.filter((s: any) => s.created_at?.startsWith(today));
    const totalTodayRevenue = todaySales.reduce((sum: number, s: any) => sum + (parseFloat(s.final_amount) || 0), 0);
    const totalRevenue = filteredSales.reduce((sum: number, s: any) => sum + (parseFloat(s.final_amount) || 0), 0);

    const lowStockItems = (stocks || [])
      .filter((s: any) => s.quantity <= 10)
      .map((s: any) => ({
        id: s.id,
        medicineName: s.medicines?.name,
        quantity: s.quantity
      }));

    res.json({
      totalBranches: branches?.length || 0,
      totalStaff: staff?.length || 0,
      activeStaff: staff?.filter((s: any) => s.is_active).length || 0,
      todaySales: todaySales.length,
      totalTodayRevenue,
      totalRevenue,
      lowStockItems,
      recentSales: filteredSales.slice(0, 5)
    });
  } catch (error) {
    console.error('Error fetching manager dashboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/staff', authenticate, authorize('manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { branchId, role } = req.query;
    const pharmacyId = req.user!.pharmacyId;

    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        is_active,
        must_change_password,
        created_at,
        user_roles (
          roles (id, name)
        ),
        user_branches (
          branches (id, name)
        )
      `)
      .eq('pharmacy_id', pharmacyId);

    if (error) {
      console.error('Error fetching staff:', error);
      return res.status(500).json({ error: 'Failed to fetch staff' });
    }

    let staff = users?.map((u: any) => ({
      id: u.id,
      email: u.email,
      fullName: u.full_name,
      isActive: u.is_active,
      mustChangePassword: u.must_change_password,
      createdAt: u.created_at,
      roles: u.user_roles?.map((ur: any) => ur.roles?.name) || [],
      branches: u.user_branches?.map((ub: any) => ({
        id: ub.branches?.id,
        name: ub.branches?.name
      })) || []
    })) || [];

    if (branchId) {
      staff = staff.filter((s: any) => 
        s.branches.some((b: any) => b.id === parseInt(branchId as string))
      );
    }

    if (role) {
      staff = staff.filter((s: any) => s.roles.includes(role as string));
    }

    res.json(staff);
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/staff', authenticate, authorize('manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, fullName, roles, branchIds } = req.body;
    const pharmacyId = req.user!.pharmacyId;

    if (!email || !password || !fullName || !roles || roles.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (roles.includes('manager')) {
      const isOwner = await checkIsOwner(req.user!.userId);
      if (!isOwner) {
        return res.status(403).json({ 
          error: 'Only the pharmacy owner can create manager accounts' 
        });
      }
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const passwordHash = await AuthUtils.hashPassword(password);

    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        full_name: fullName,
        pharmacy_id: pharmacyId,
        is_active: true,
        must_change_password: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (userError || !user) {
      console.error('Error creating user:', userError);
      return res.status(500).json({ error: 'Failed to create user' });
    }

    for (const roleName of roles) {
      const { data: role } = await supabase
        .from('roles')
        .select('id')
        .eq('name', roleName)
        .single();

      if (role) {
        await supabase.from('user_roles').insert({
          user_id: user.id,
          role_id: role.id
        });
      }
    }

    if (branchIds && branchIds.length > 0) {
      for (const branchId of branchIds) {
        await supabase.from('user_branches').insert({
          user_id: user.id,
          branch_id: branchId
        });
      }
    }

    res.status(201).json({
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      message: 'Staff member created successfully'
    });
  } catch (error) {
    console.error('Error creating staff:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/staff/:id', authenticate, authorize('manager'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { fullName, isActive, roles, branchIds } = req.body;
    const userId = parseInt(id);
    const pharmacyId = req.user!.pharmacyId;

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .eq('pharmacy_id', pharmacyId)
      .single();

    if (!existingUser) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    await supabase
      .from('users')
      .update({
        full_name: fullName,
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (roles) {
      await supabase.from('user_roles').delete().eq('user_id', userId);
      for (const roleName of roles) {
        const { data: role } = await supabase
          .from('roles')
          .select('id')
          .eq('name', roleName)
          .single();

        if (role) {
          await supabase.from('user_roles').insert({
            user_id: userId,
            role_id: role.id
          });
        }
      }
    }

    if (branchIds) {
      await supabase.from('user_branches').delete().eq('user_id', userId);
      for (const branchId of branchIds) {
        await supabase.from('user_branches').insert({
          user_id: userId,
          branch_id: branchId
        });
      }
    }

    res.json({ message: 'Staff member updated successfully' });
  } catch (error) {
    console.error('Error updating staff:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/staff/:id/activate', authenticate, authorize('manager'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = parseInt(id);
    const pharmacyId = req.user!.pharmacyId;

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .eq('pharmacy_id', pharmacyId)
      .single();

    if (!existingUser) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    await supabase
      .from('users')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', userId);

    res.json({ message: 'Staff member activated successfully' });
  } catch (error) {
    console.error('Error activating staff:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/staff/:id/deactivate', authenticate, authorize('manager'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = parseInt(id);
    const pharmacyId = req.user!.pharmacyId;

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .eq('pharmacy_id', pharmacyId)
      .single();

    if (!existingUser) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    await supabase
      .from('users')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', userId);

    res.json({ message: 'Staff member deactivated successfully' });
  } catch (error) {
    console.error('Error deactivating staff:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/medicines', authenticate, authorize('manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { branchId, category } = req.query;
    const pharmacyId = req.user!.pharmacyId;

    let query = supabase
      .from('medicines')
      .select(`
        id,
        name,
        generic_name,
        brand_name,
        sku,
        unit_type,
        strength,
        manufacturer,
        description,
        min_stock_level,
        requires_prescription,
        unit_price,
        is_deleted,
        branch_id,
        category_id,
        medicine_categories (id, name),
        branches!medicines_branch_id_fkey (id, name, pharmacy_id)
      `)
      .order('name');

    const { data: medicines, error } = await query;

    if (error) {
      console.error('Error fetching medicines:', error);
      return res.status(500).json({ error: 'Failed to fetch medicines' });
    }

    let result = (medicines || []).filter((m: any) => 
      m.branches && m.branches.pharmacy_id === pharmacyId
    );

    if (branchId) {
      result = result.filter((m: any) => m.branch_id === parseInt(branchId as string));
    }

    if (category) {
      result = result.filter((m: any) => m.category_id === parseInt(category as string));
    }

    const formatted = result.map((m: any) => ({
      id: m.id,
      name: m.name,
      genericName: m.generic_name,
      brandName: m.brand_name,
      sku: m.sku,
      unitType: m.unit_type,
      strength: m.strength,
      manufacturer: m.manufacturer,
      description: m.description,
      minStockLevel: m.min_stock_level,
      requiresPrescription: m.requires_prescription,
      unitPrice: m.unit_price,
      isDeleted: m.is_deleted,
      branchId: m.branch_id,
      categoryId: m.category_id,
      category: m.medicine_categories,
      branch: m.branches ? {
        id: m.branches.id,
        name: m.branches.name
      } : null
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching medicines:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/medicines', authenticate, authorize('manager'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      name, genericName, brandName, categoryId,
      sku, unitType, strength, manufacturer,
      description, minStockLevel, requiresPrescription, branchId, unitPrice
    } = req.body;

    if (!name || !categoryId || !unitType || !branchId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: branch } = await supabase
      .from('branches')
      .select('id, pharmacy_id')
      .eq('id', branchId)
      .single();

    if (!branch || branch.pharmacy_id !== req.user!.pharmacyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data: medicine, error } = await supabase
      .from('medicines')
      .insert({
        name,
        generic_name: genericName,
        brand_name: brandName,
        category_id: categoryId,
        sku,
        unit_type: unitType,
        strength,
        manufacturer,
        description,
        min_stock_level: minStockLevel || 10,
        requires_prescription: requiresPrescription || false,
        unit_price: unitPrice || 0,
        branch_id: branchId,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating medicine:', error);
      return res.status(500).json({ error: 'Failed to create medicine' });
    }

    res.status(201).json(medicine);
  } catch (error) {
    console.error('Error creating medicine:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/medicines/:id', authenticate, authorize('manager'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const medicineId = parseInt(id);
    const {
      name, genericName, brandName, categoryId,
      sku, unitType, strength, manufacturer,
      description, minStockLevel, requiresPrescription, unitPrice
    } = req.body;

    const { data: existingMedicine } = await supabase
      .from('medicines')
      .select('id, branches (pharmacy_id)')
      .eq('id', medicineId)
      .single();

    if (!existingMedicine) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    if (existingMedicine.branches?.pharmacy_id !== req.user!.pharmacyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data: medicine, error } = await supabase
      .from('medicines')
      .update({
        name,
        generic_name: genericName,
        brand_name: brandName,
        category_id: categoryId,
        sku,
        unit_type: unitType,
        strength,
        manufacturer,
        description,
        min_stock_level: minStockLevel,
        requires_prescription: requiresPrescription,
        unit_price: unitPrice,
        updated_at: new Date().toISOString()
      })
      .eq('id', medicineId)
      .select()
      .single();

    if (error) {
      console.error('Error updating medicine:', error);
      return res.status(500).json({ error: 'Failed to update medicine' });
    }

    res.json(medicine);
  } catch (error) {
    console.error('Error updating medicine:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/medicines/:id', authenticate, authorize('manager'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const medicineId = parseInt(id);

    const { data: existingMedicine } = await supabase
      .from('medicines')
      .select('id, branches (pharmacy_id)')
      .eq('id', medicineId)
      .single();

    if (!existingMedicine) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    if (existingMedicine.branches?.pharmacy_id !== req.user!.pharmacyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await supabase
      .from('medicines')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', medicineId);

    res.json({ message: 'Medicine deleted successfully' });
  } catch (error) {
    console.error('Error deleting medicine:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/sales', authenticate, authorize('manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { branchId, startDate, endDate, status } = req.query;
    const pharmacyId = req.user!.pharmacyId;

    const { data: sales, error } = await supabase
      .from('sales')
      .select(`
        id,
        branch_id,
        user_id,
        customer_name,
        customer_phone,
        total_amount,
        discount_amount,
        tax_amount,
        final_amount,
        status,
        created_at,
        branches (id, name)
      `)
      .eq('pharmacy_id', pharmacyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching sales:', error);
      return res.status(500).json({ error: 'Failed to fetch sales' });
    }

    let result = sales || [];

    if (branchId) {
      result = result.filter((s: any) => s.branch_id === parseInt(branchId as string));
    }

    if (status) {
      result = result.filter((s: any) => s.status === status);
    }

    if (startDate && endDate) {
      const start = new Date(startDate as string).toISOString();
      const end = new Date(endDate as string).toISOString();
      result = result.filter((s: any) => s.created_at >= start && s.created_at <= end);
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/branches', authenticate, authorize('manager'), async (req: AuthRequest, res: Response) => {
  try {
    const pharmacyId = req.user!.pharmacyId;

    const { data: branches, error } = await supabase
      .from('branches')
      .select('*')
      .eq('pharmacy_id', pharmacyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching branches:', error);
      return res.status(500).json({ error: 'Failed to fetch branches' });
    }

    res.json(branches || []);
  } catch (error) {
    console.error('Error fetching branches:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/medicines/import', authenticate, authorize('manager'), uploadSpreadsheet.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { branchId, createCategories = 'true', skipDuplicates = 'true' } = req.query;
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

router.post('/stock/import', authenticate, authorize('manager'), uploadSpreadsheet.single('file'), async (req: AuthRequest, res: Response) => {
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

    const result = await importStock(parsed.rows, req.user!.pharmacyId, targetBranchId!, {
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

router.get('/medicines/template', authenticate, authorize('manager'), (req, res: Response) => {
  const { format } = req.query;

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=medicines_template.csv');
    res.send('name,generic_name,brand_name,category,sku,unit_type,strength,manufacturer,description,min_stock_level,requires_prescription,unit_price');
  } else {
    const buffer = generateMedicineTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=medicines_template.xlsx');
    res.send(buffer);
  }
});

router.get('/stock/template', authenticate, authorize('manager'), (req, res: Response) => {
  const { format } = req.query;

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=stock_template.csv');
    res.send('medicine_name,sku,batch_number,quantity,expiry_date,cost_price,selling_price,branch_name');
  } else {
    const buffer = generateStockTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=stock_template.xlsx');
    res.send(buffer);
  }
});

export default router;
