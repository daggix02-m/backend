import { Router, Request, Response } from 'express';
import { supabase as supabaseClient } from '../lib/prisma';
import { AuthUtils } from '../lib/auth';
import { AuthRequest, authenticate } from '../middleware/auth';

const router = Router();
const supabase = supabaseClient as any;

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, fullName, pharmacyId, roles = ['pharmacist'] } = req.body;

    // Validate input
    if (!email || !password || !fullName || !pharmacyId) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    // Check if pharmacy exists
    const { data: pharmacy } = await supabase
      .from('pharmacies')
      .select('id')
      .eq('id', pharmacyId)
      .single();

    if (!pharmacy) {
      res.status(404).json({ error: 'Pharmacy not found' });
      return;
    }

    // Hash password
    const passwordHash = await AuthUtils.hashPassword(password);

    // Create user
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        full_name: fullName,
        pharmacy_id: pharmacyId,
        is_active: true,
        must_change_password: false,
        created_at: new Date().toISOString(),
      })
      .select('id, email, full_name, pharmacy_id')
      .single();

    if (userError) {
      console.error('User creation error:', userError);
      res.status(500).json({ error: 'Failed to create user' });
      return;
    }

    // Assign roles
    for (const roleName of roles) {
      const { data: role } = await supabase
        .from('roles')
        .select('id')
        .eq('name', roleName)
        .single();

      if (role) {
        await supabase.from('user_roles').insert({
          user_id: user.id,
          role_id: role.id,
        });
      }
    }

    // Generate token
    const tokenPayload = {
      userId: user.id,
      pharmacyId: user.pharmacy_id,
      email: user.email,
      roles,
    };

    const token = AuthUtils.generateToken(tokenPayload);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        pharmacyId: user.pharmacy_id,
        roles,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Find user
    const { data: user } = await supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        password_hash,
        pharmacy_id,
        is_active,
        must_change_password,
        user_roles (
          role:roles (
            name
          )
        )
      `)
      .eq('email', email)
      .single();

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Check if user is active
    if (!user.is_active) {
      res.status(401).json({ error: 'Account is inactive' });
      return;
    }

    // Verify password
    const isValidPassword = await AuthUtils.comparePassword(password, user.password_hash);

    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Get roles
    const roles = user.user_roles?.map((ur: any) => ur.role?.name) || [];

    // Generate token
    const tokenPayload = {
      userId: user.id,
      pharmacyId: user.pharmacy_id,
      email: user.email,
      roles,
    };

    const token = AuthUtils.generateToken(tokenPayload);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        pharmacyId: user.pharmacy_id,
        roles,
        mustChangePassword: user.must_change_password,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post('/change-password', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current and new passwords are required' });
      return;
    }

    // Find user
    const { data: user } = await supabase
      .from('users')
      .select('id, password_hash')
      .eq('id', req.user.userId)
      .single();

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Verify current password
    const isValidPassword = await AuthUtils.comparePassword(currentPassword, user.password_hash);

    if (!isValidPassword) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    // Hash new password
    const newPasswordHash = await AuthUtils.hashPassword(newPassword);

    // Update password
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: newPasswordHash,
        must_change_password: false,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Password update error:', updateError);
      res.status(500).json({ error: 'Failed to update password' });
      return;
    }

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { data: user } = await supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        pharmacy_id,
        is_active,
        must_change_password,
        user_roles (
          role:roles (
            name
          )
        ),
        user_branches (
          branch:branches (
            id,
            name,
            location
          )
        )
      `)
      .eq('id', req.user.userId)
      .single();

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const roles = user.user_roles?.map((ur: any) => ur.role?.name) || [];
    const branches = user.user_branches?.map((ub: any) => ({
      id: ub.branch?.id,
      name: ub.branch?.name,
      location: ub.branch?.location,
    })) || [];

    res.json({
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      pharmacyId: user.pharmacy_id,
      roles,
      branches,
      isActive: user.is_active,
      mustChangePassword: user.must_change_password,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
