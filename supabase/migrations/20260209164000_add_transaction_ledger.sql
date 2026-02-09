-- Transaction ledger for all payments
CREATE TABLE IF NOT EXISTS transaction_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  creator_id UUID REFERENCES users(id),
  thread_id UUID REFERENCES threads(id),
  payment_id UUID REFERENCES payments(id),
  payment_provider TEXT NOT NULL,
  payment_type TEXT NOT NULL,
  tx_ref TEXT NOT NULL,
  provider_transaction_id TEXT,
  payment_method TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  amount_usd DECIMAL(10,2),
  status payment_status DEFAULT 'pending',
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  raw_payload JSONB,
  occurred_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transaction_ledger_provider_tx
  ON transaction_ledger(payment_provider, tx_ref);

CREATE INDEX IF NOT EXISTS idx_transaction_ledger_user
  ON transaction_ledger(user_id);

CREATE INDEX IF NOT EXISTS idx_transaction_ledger_creator
  ON transaction_ledger(creator_id);

CREATE INDEX IF NOT EXISTS idx_transaction_ledger_thread
  ON transaction_ledger(thread_id);

CREATE INDEX IF NOT EXISTS idx_transaction_ledger_payment
  ON transaction_ledger(payment_id);

CREATE INDEX IF NOT EXISTS idx_transaction_ledger_status
  ON transaction_ledger(status);

-- Keep updated_at fresh
DROP TRIGGER IF EXISTS set_transaction_ledger_updated_at ON transaction_ledger;
CREATE TRIGGER set_transaction_ledger_updated_at
BEFORE UPDATE ON transaction_ledger
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE transaction_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ledger"
ON transaction_ledger FOR SELECT
USING (auth.uid() = user_id OR auth.uid() = creator_id);

CREATE POLICY "System can create ledger"
ON transaction_ledger FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update ledger"
ON transaction_ledger FOR UPDATE
USING (true);

GRANT ALL ON TABLE transaction_ledger TO authenticated, anon;
