-- migration file: supabase/migrations/20260313234500_add_payout_requests.sql

-- ============================================
-- PAYOUT REQUESTS & OTPs SYSTEM
-- ============================================

-- Payout Requests Table
CREATE TABLE IF NOT EXISTS payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount_usd DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL,
  amount_local DECIMAL(10,2),
  bank_code TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  status TEXT DEFAULT 'pending_otp',
  admin_notes TEXT,
  processed_by UUID REFERENCES admin_users(user_id),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payout OTPs Table
CREATE TABLE IF NOT EXISTS payout_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_payout_requests_user ON payout_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_payout_otps_user ON payout_otps(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_otps_expires ON payout_otps(expires_at);

-- Trigger for updated_at
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    EXECUTE 'CREATE TRIGGER update_payout_requests_updated_at BEFORE UPDATE ON payout_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
  END IF;
END $$;

-- Row Level Security
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_otps ENABLE ROW LEVEL SECURITY;

-- Payout Requests Policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own payout requests') THEN
    CREATE POLICY "Users can view their own payout requests" ON payout_requests FOR SELECT USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create their own payout requests') THEN
    CREATE POLICY "Users can create their own payout requests" ON payout_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all payout requests') THEN
    CREATE POLICY "Admins can view all payout requests" ON payout_requests FOR SELECT USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can update payout requests') THEN
    CREATE POLICY "Admins can update payout requests" ON payout_requests FOR UPDATE USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid()));
  END IF;
END $$;

-- Payout OTPs Policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own OTPs') THEN
    CREATE POLICY "Users can view their own OTPs" ON payout_otps FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Link earnings to requests
ALTER TABLE creator_earnings ADD COLUMN IF NOT EXISTS payout_request_id UUID REFERENCES payout_requests(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_creator_earnings_request_id ON creator_earnings(payout_request_id);
