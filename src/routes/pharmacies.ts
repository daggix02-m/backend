import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();

/**
 * @route   GET /api/pharmacies
 * @desc    Get all pharmacies (Super Admin only or similar)
 * @access  Private
 */
router.get('/', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const pharmacies = await prisma.pharmacy.findMany();
    res.json(pharmacies);
  } catch (error) {
    console.error('Error fetching pharmacies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/pharmacies/my
 * @desc    Get current user's pharmacy details
 * @access  Private
 */
router.get('/my', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const pharmacy = await prisma.pharmacy.findUnique({
      where: { id: req.user!.pharmacyId },
      include: {
        branches: true,
      },
    });

    if (!pharmacy) {
      return res.status(404).json({ error: 'Pharmacy not found' });
    }

    res.json(pharmacy);
  } catch (error) {
    console.error('Error fetching pharmacy:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   PUT /api/pharmacies/my
 * @desc    Update current user's pharmacy details
 * @access  Private (Admin only)
 */
router.put('/my', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, licenseNumber, address, phone, email, tin, logoUrl, website } = req.body;

    const pharmacy = await prisma.pharmacy.update({
      where: { id: req.user!.pharmacyId },
      data: {
        name,
        licenseNumber,
        address,
        phone,
        email,
        tin,
        logoUrl,
        website,
      },
    });

    res.json(pharmacy);
  } catch (error) {
    console.error('Error updating pharmacy:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/pharmacies/branches
 * @desc    Get all branches of the current pharmacy
 * @access  Private
 */
router.get('/branches', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const branches = await prisma.branch.findMany({
      where: { pharmacyId: req.user!.pharmacyId },
    });
    res.json(branches);
  } catch (error) {
    console.error('Error fetching branches:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/pharmacies/branches
 * @desc    Create a new branch
 * @access  Private (Admin only)
 */
router.post('/branches', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, location, phone, email, isMainBranch } = req.body;

    if (!name || !location) {
      return res.status(400).json({ error: 'Name and location are required' });
    }

    // If setting as main branch, unset other main branches for this pharmacy
    if (isMainBranch) {
      await prisma.branch.updateMany({
        where: { pharmacyId: req.user!.pharmacyId },
        data: { isMainBranch: false },
      });
    }

    const branch = await prisma.branch.create({
      data: {
        name,
        location,
        phone,
        email,
        isMainBranch: isMainBranch || false,
        pharmacyId: req.user!.pharmacyId,
      },
    });

    res.status(201).json(branch);
  } catch (error) {
    console.error('Error creating branch:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   PUT /api/pharmacies/branches/:id
 * @desc    Update a branch
 * @access  Private (Admin only)
 */
router.put('/branches/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, location, phone, email, isMainBranch, isActive } = req.body;

    const branchId = parseInt(id as string);

    // Ensure branch belongs to this pharmacy
    const existingBranch = await prisma.branch.findFirst({
      where: { id: branchId, pharmacyId: req.user!.pharmacyId },
    });

    if (!existingBranch) {
      return res.status(404).json({ error: 'Branch not found or unauthorized' });
    }

    // If setting as main branch, unset other main branches for this pharmacy
    if (isMainBranch) {
      await prisma.branch.updateMany({
        where: { pharmacyId: req.user!.pharmacyId },
        data: { isMainBranch: false },
      });
    }

    const branch = await prisma.branch.update({
      where: { id: branchId },
      data: {
        name,
        location,
        phone,
        email,
        isMainBranch,
        isActive,
      },
    });

    res.json(branch);
  } catch (error) {
    console.error('Error updating branch:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
