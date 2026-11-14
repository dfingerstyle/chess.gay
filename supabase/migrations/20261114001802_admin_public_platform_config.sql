delete from public.admin_system_settings where setting_key='casino_enabled';

create or replace function public.get_public_platform_config()
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'maintenance_mode',coalesce((select (value#>>'{}')::boolean from public.admin_system_settings where setting_key='maintenance_mode'),false),
    'maintenance_message',coalesce((select value#>>'{}' from public.admin_system_settings where setting_key='maintenance_message'),'The game room is undergoing maintenance. Please check back soon.'),
    'feature_flags',coalesce((select jsonb_object_agg(flag_key,enabled) from public.admin_feature_flags),'{}'::jsonb)
  );
$$;
revoke all on function public.get_public_platform_config() from public;
grant execute on function public.get_public_platform_config() to anon,authenticated;
