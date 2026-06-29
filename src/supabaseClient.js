import { createClient } from "@supabase/supabase-js";

// De sleutels worden veilig ingeladen via Vercel (zie het stappenplan).
// Bij lokaal testen komen ze uit een bestand .env.local
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_KEY;

// Zolang er nog geen Supabase-sleutels zijn ingesteld, werkt de app
// gewoon door op de browser-opslag (localStorage). Zodra je de sleutels
// invult, schakelt de app automatisch over naar Supabase + inloggen.
export const isSupabaseConfigured = Boolean(url && key);
export const supabase = isSupabaseConfigured ? createClient(url, key) : null;
