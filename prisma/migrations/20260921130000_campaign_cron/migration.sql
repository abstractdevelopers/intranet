-- Campaign delivery scheduler.
--
-- Vercel Hobby rejects any cron more frequent than once a day, so scheduled
-- campaigns are driven from the database instead: pg_cron fires every five
-- minutes and pg_net posts to /api/cron/campaigns. That lands a scheduled send
-- within about a minute rather than up to 24 hours late, and keeps the existing
-- route (and its FOR UPDATE SKIP LOCKED claims) as the single send path.
--
-- The app URL and bearer token live in Supabase Vault, not in this file and not
-- in cron.job's command text, which is readable by anyone who can query the
-- cron schema. Set them once with:
--
--   select vault.create_secret('https://<host>',      'uca_app_url',     'Campaign cron base URL');
--   select vault.create_secret('<CRON_SECRET value>', 'uca_cron_secret', 'Bearer token for /api/cron/campaigns');
--
-- Until both secrets exist the function returns NULL and the job is a no-op.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.trigger_campaign_worker()
returns bigint
language plpgsql
security definer
set search_path = public, net, vault
as $$
declare
  base_url text;
  token    text;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'uca_app_url';
  select decrypted_secret into token    from vault.decrypted_secrets where name = 'uca_cron_secret';

  if base_url is null or token is null then
    raise notice 'campaign worker: vault secrets missing, skipping';
    return null;
  end if;

  -- The route caps itself well inside this timeout, so a slow batch returns
  -- partial progress and the next tick resumes it.
  return net.http_post(
    url     := base_url || '/api/cron/campaigns',
    headers := jsonb_build_object(
                 'Authorization', 'Bearer ' || token,
                 'Content-Type', 'application/json'
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
end;
$$;

-- Re-create the job cleanly so re-running this migration cannot stack duplicates.
do $$
begin
  perform cron.unschedule('uca-campaign-worker');
exception
  when others then null;
end;
$$;

select cron.schedule('uca-campaign-worker', '*/5 * * * *', $$select public.trigger_campaign_worker()$$);
