-- Internal wallet mutation is only callable from trusted SECURITY DEFINER
-- business functions. Never expose it as a direct authenticated RPC.
revoke all on function public.internal_adjust(uuid,bigint,text) from public, anon, authenticated;
