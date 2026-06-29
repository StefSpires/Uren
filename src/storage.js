// ============================================================
//  Opslag-laag voor de overuren.
//  - Is Supabase ingesteld?  -> alles staat in de cloud-tabel "overuren".
//  - Nog niet?               -> alles staat lokaal in je browser (localStorage).
//  Beide kanten praten met exact dezelfde functies, zodat de rest van de
//  app zich er niets van aantrekt waar de gegevens vandaan komen.
// ============================================================
import { supabase, isSupabaseConfigured } from "./supabaseClient";

const LS_KEY = "spires-uren";

function lokaalLees() {
  try {
    const obj = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}
function lokaalSchrijf(obj) {
  localStorage.setItem(LS_KEY, JSON.stringify(obj));
}

// Alle ingevoerde dagen ophalen (klein, het is een persoonlijke lijst).
export async function haalAlleDagen() {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from("overuren")
      .select("*")
      .order("datum", { ascending: true });
    if (error) throw error;
    return data || [];
  }
  return Object.values(lokaalLees()).sort((a, b) => (a.datum < b.datum ? -1 : 1));
}

// Eén dag opslaan (overschrijft de bestaande regel voor die datum).
// Lege invoer (0 uren én geen notitie) verwijdert de dag weer.
export async function slaDagOp(datum, uren, notitie) {
  const leeg = (!uren || Number(uren) === 0) && !(notitie && notitie.trim());

  if (isSupabaseConfigured) {
    if (leeg) {
      const { error } = await supabase.from("overuren").delete().eq("datum", datum);
      if (error) throw error;
      return;
    }
    const { error } = await supabase
      .from("overuren")
      .upsert({ datum, uren: Number(uren) || 0, notitie: notitie || null }, { onConflict: "datum" });
    if (error) throw error;
    return;
  }

  const obj = lokaalLees();
  if (leeg) delete obj[datum];
  else obj[datum] = { datum, uren: Number(uren) || 0, notitie: notitie || "" };
  lokaalSchrijf(obj);
}
