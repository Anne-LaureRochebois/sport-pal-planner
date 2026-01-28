-- Enable pg_cron and pg_net extensions for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create cron job to call session-reminders function every 5 minutes
SELECT cron.schedule(
  'session-reminders',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://xdwhnjfkjaeiycqsbpeq.supabase.co/functions/v1/session-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhkd2huamZramFlaXljcXNicGVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1ODgwNDQsImV4cCI6MjA4NTE2NDA0NH0.9IByXZJHpbCLattm61I82qrxesdVq8p05MyKxNtVfyk"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);