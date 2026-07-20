import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** true se le variabili d'ambiente sono configurate */
export const configOk = Boolean(url && key && !url.includes("TUO-PROGETTO"));

export const supabase = configOk ? createClient(url, key) : null;
