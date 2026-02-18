import { Router, Response } from 'express';
import { supabase as supabaseClient } from '../lib/supabase';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';
import { AuthUtils } from '../lib/auth';

const router = Router();
const supabase = supabaseClient as any;

router.get('/', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        is_active,
        must_change_password,
        pharmacy_id,
        user_roles (
          role:roles (
            id,
            name
          )
        ),
        user_branches (
          branch:branches (
            id,
            name
          )
        )
      `)
      .eq('pharmacy_id', req.user!.pharmacyId);

    if (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }

    const formattedUsers = (users || []).map((u: any) => ({
      id: u.id,
      email: u.email,
      fullName: u.full_name,
      isActive: u.is_active,
      mustChangePassword: u.must_change_password,
      roles: u.user_roles?.map((ur: any) => ur.role?.name) || [],
      branches: u.user_branches?.map((ub: any) => ({
        id: ub.branch?.id,
        name: ub.branch?.name
      })) || []
    }));

    res.json(formattedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, fullName, roles, branchIds } = req.body;

    if (!email || !password || !fullName || !roles || roles.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

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
        pharmacy_id: req.user!.pharmacyId,
        is_active: true,
        must_change_password: true,
        created_at: new Date().toISOString(),
      })
      .select('id, email, full_name')
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
          role_id: role.id,
        });
      }
    }

    if (branchIds && branchIds.length > 0) {
      for (const branchId of branchIds) {
        const { data: branch } = await supabase
          .from('branches')
          .select('id')
          .eq('id', branchId)
          .eq('pharmacy_id', req.user!.pharmacyId)
          .single();

        if (branch) {
          await supabase.from('user_branches').insert({
            user_id: user.id,
            branch_id: branch.id,
          });
        }
      }
    }

    res.status(201).json({
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { fullName, isActive, roles, branchIds } = req.body;
    const userId = parseInt(id as string);

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .eq('pharmacy_id', req.user!.pharmacyId)
      .single();

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    await supabase
      .from('users')
      .update({
        full_name: fullName,
        is_active: isActive,
        updated_at: new Date().toISOString(),
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
            role_id: role.id,
          });
        }
      }
    }

    if (branchIds) {
      await supabase.from('user_branches').delete().eq('user_id', userId);

      for (const branchId of branchIds) {
        const { data: branch } = await supabase
          .from('branches')
          .select('id')
          .eq('id', branchId)
          .eq('pharmacy_id', req.user!.pharmacyId)
          .single();

        if (branch) {
          await supabase.from('user_branches').insert({
            user_id: userId,
            branch_id: branch.id,
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
