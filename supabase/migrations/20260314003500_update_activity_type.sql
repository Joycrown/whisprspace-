-- Add payout_request to activity_type enum
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'payout_request';
