UPDATE public.app_config
SET value = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
    updated_at = NOW()
WHERE key = 'cron_secret'
RETURNING value AS new_cron_secret;
