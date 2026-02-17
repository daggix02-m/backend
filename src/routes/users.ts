import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';
import { AuthUtils } from '../lib/auth';

const router = Router();

/**
 * @route   GET /api/users
 * @desc    Get all users in the pharmacy
 * @access  Private (Admin/Manager only)
 */
router.get('/', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { pharmacyId: req.user!.pharmacyId },
      include: {
        userRoles: {
          include: { role: true }
        },
        userBranches: {
          include: { branch: true }
        }
      }
    });

    const formattedUsers = users.map((u: any) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      isActive: u.isActive,
      mustChangePassword: u.mustChangePassword,
      roles: u.userRoles.map((ur: any) => ur.role.name),
      branches: u.userBranches.map((ub: any) => ({
        id: ub.branch.id,
        name: ub.branch.name
      }))
    }));

    res.json(formattedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/users
 * @desc    Create a new user
 * @access  Private (Admin only)
 */
router.post('/', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, fullName, roles, branchIds } = req.body;

    if (!email || !password || !fullName || !roles || roles.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const passwordHash = await AuthUtils.hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        pharmacyId: req.user!.pharmacyId,
        isActive: true,
        mustChangePassword: true
      }
    });

    // Assign roles
    for (const roleName of roles) {
      const role = await prisma.role.findUnique({ where: { name: roleName } });
      if (role) {
        await prisma.userRole.create({
          data: { userId: user.id, roleId: role.id }
        });
      }
    }

    // Assign branches
    if (branchIds && branchIds.length > 0) {
      for (const branchId of branchIds) {
        // Verify branch belongs to this pharmacy
        const branch = await prisma.branch.findFirst({
          where: { id: branchId, pharmacyId: req.user!.pharmacyId }
        });
        if (branch) {
          await prisma.userBranch.create({
            data: { userId: user.id, branchId: branch.id }
          });
        }
      }
    }

    res.status(201).json({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   PUT /api/users/:id
 * @desc    Update a user
 * @access  Private (Admin only)
 */
router.put('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { fullName, isActive, roles, branchIds } = req.body;
    const userId = parseInt(id as string);

    // Verify user belongs to same pharmacy
    const existingUser = await prisma.user.findFirst({
      where: { id: userId, pharmacyId: req.user!.pharmacyId }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        fullName,
        isActive
      }
    });

    if (roles) {
      // Delete old roles and add new ones
      await prisma.userRole.deleteMany({ where: { userId } });
      for (const roleName of roles) {
        const role = await prisma.role.findUnique({ where: { name: roleName } });
        if (role) {
          await prisma.userRole.create({
            data: { userId, roleId: role.id }
          });
        }
      }
    }

    if (branchIds) {
      // Delete old branch assignments and add new ones
      await prisma.userBranch.deleteMany({ where: { userId } });
      for (const branchId of branchIds) {
        const branch = await prisma.branch.findFirst({
          where: { id: branchId, pharmacyId: req.user!.pharmacyId }
        });
        if (branch) {
          await prisma.userBranch.create({
            data: { userId, branchId: branch.id }
          });
        }
      }
    }

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
