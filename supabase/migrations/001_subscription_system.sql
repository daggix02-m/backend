-- PharmaCare Backend - Database Migration
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. ALTER EXISTING TABLES
-- ============================================

-- Add is_owner flag to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_owner BOOLEAN DEFAULT false;

-- Add owner_id and other fields to pharmacies table
ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id);
ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS license_number VARCHAR(100);
ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS tin_number VARCHAR(100);
ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'trial';

-- Add max_import_rows to subscription_plans (if table exists)
-- ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_import_rows INTEGER DEFAULT 100;

-- ============================================
-- 2. SUBSCRIPTION PLANS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS subscription_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'ETB',
  billing_cycle VARCHAR(20) DEFAULT 'monthly',
  max_branches INTEGER DEFAULT 1,
  max_staff_per_branch INTEGER DEFAULT 5,
  max_medicines INTEGER DEFAULT 500,
  max_import_rows INTEGER DEFAULT 100,
  features JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  is_popular BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 3. PHARMACY SUBSCRIPTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS pharmacy_subscriptions (
  id SERIAL PRIMARY KEY,
  pharmacy_id INTEGER REFERENCES pharmacies(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES subscription_plans(id),
  status VARCHAR(20) DEFAULT 'trial',
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  trial_ends_at TIMESTAMP,
  grace_ends_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 4. PHARMACY DOCUMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS pharmacy_documents (
  id SERIAL PRIMARY KEY,
  pharmacy_id INTEGER REFERENCES pharmacies(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255),
  file_size INTEGER,
  mime_type VARCHAR(100),
  verification_status VARCHAR(20) DEFAULT 'pending',
  verified_at TIMESTAMP,
  verified_by INTEGER REFERENCES users(id),
  rejection_reason TEXT,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 5. REGISTRATION APPLICATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS registration_applications (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  full_name VARCHAR(255),
  phone VARCHAR(50),
  
  -- Pharmacy details (step 2)
  pharmacy_name VARCHAR(255),
  pharmacy_address TEXT,
  pharmacy_phone VARCHAR(50),
  pharmacy_email VARCHAR(255),
  license_number VARCHAR(100),
  tin_number VARCHAR(100),
  
  -- Document URLs
  license_document_url TEXT,
  fyda_document_url TEXT,
  
  -- Plan selection (step 3)
  selected_plan_id INTEGER REFERENCES subscription_plans(id),
  
  -- Status tracking
  current_step INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'draft',
  
  -- Admin review
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP,
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  submitted_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- ============================================
-- 6. PASSWORD RESET TOKENS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 7. RESTOCK REQUESTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS restock_requests (
  id SERIAL PRIMARY KEY,
  medicine_id INTEGER REFERENCES medicines(id) ON DELETE CASCADE,
  branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  pharmacy_id INTEGER REFERENCES pharmacies(id) ON DELETE CASCADE,
  requested_by INTEGER REFERENCES users(id),
  quantity INTEGER NOT NULL,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 8. DEFAULT SUBSCRIPTION PLANS
-- ============================================

INSERT INTO subscription_plans (name, description, price, billing_cycle, max_branches, max_staff_per_branch, max_medicines, max_import_rows, is_popular, display_order) VALUES
  ('Starter', 'Perfect for small pharmacies starting out', 0, 'monthly', 1, 3, 100, 100, false, 1),
  ('Professional', 'For growing pharmacy businesses', 2999, 'monthly', 3, 10, 500, 1000, true, 2),
  ('Enterprise', 'For large pharmacy chains', 9999, 'monthly', 10, 50, 5000, 10000, false, 3)
ON CONFLICT DO NOTHING;

-- ============================================
-- 9. INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_pharmacy_subscriptions_pharmacy_id ON pharmacy_subscriptions(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_documents_pharmacy_id ON pharmacy_documents(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_registration_applications_email ON registration_applications(email);
CREATE INDEX IF NOT EXISTS idx_registration_applications_status ON registration_applications(status);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_restock_requests_pharmacy_id ON restock_requests(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_restock_requests_status ON restock_requests(status);

-- ============================================
-- 10. SUPABASE STORAGE BUCKET
-- ============================================

-- Run this in Supabase Dashboard > Storage > New Bucket
-- Name: pharmacy-documents
-- Public: false (private bucket)

-- Or via SQL (if you have the necessary permissions):
-- INSERT INTO storage.buckets (id, name, public) VALUES ('pharmacy-documents', 'pharmacy-documents', false);

-- ============================================
-- 11. ROW LEVEL SECURITY POLICIES (Optional)
-- ============================================

-- Enable RLS on new tables
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE restock_requests ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust as needed for your auth setup)
-- These are basic examples - customize based on your security requirements

-- Allow public read access to active subscription plans
CREATE POLICY "subscription_plans_public_read" ON subscription_plans
  FOR SELECT USING (is_active = true);

-- Users can view their own pharmacy's subscription
CREATE POLICY "pharmacy_subscriptions_view" ON pharmacy_subscriptions
  FOR SELECT USING (
    pharmacy_id IN (
      SELECT pharmacy_id FROM users WHERE id = auth.uid()::text::integer
    )
  );

-- Users can view their own pharmacy's documents
CREATE POLICY "pharmacy_documents_view" ON pharmacy_documents
  FOR SELECT USING (
    pharmacy_id IN (
      SELECT pharmacy_id FROM users WHERE id = auth.uid()::text::integer
    )
  );

-- Admins can view all registration applications
-- Managers can view their own applications
CREATE POLICY "registration_applications_view" ON registration_applications
  FOR SELECT USING (true); -- Adjust based on your admin detection logic

-- Users can view their own password reset tokens
CREATE POLICY "password_reset_tokens_view" ON password_reset_tokens
  FOR SELECT USING (
    user_id = auth.uid()::text::integer
  );

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
