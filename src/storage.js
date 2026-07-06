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

// ============================================================
//  Kilometers: één regel per dag (km + notitie), net als overuren.
//  Cloud-tabel "kilometers", of lokaal onder de sleutel hieronder.
// ============================================================
const LS_KM = "spires-kilometers";

function kmLees() {
  try {
    const obj = JSON.parse(localStorage.getItem(LS_KM) || "{}");
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}
function kmSchrijf(obj) {
  localStorage.setItem(LS_KM, JSON.stringify(obj));
}

export async function haalAlleKm() {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from("kilometers")
      .select("*")
      .order("datum", { ascending: true });
    if (error) throw error;
    return data || [];
  }
  return Object.values(kmLees()).sort((a, b) => (a.datum < b.datum ? -1 : 1));
}

// Eén dag opslaan (overschrijft de bestaande regel). Leeg (0 km én geen notitie) = verwijderen.
export async function slaKmOp(datum, km, notitie) {
  const leeg = (!km || Number(km) === 0) && !(notitie && notitie.trim());

  if (isSupabaseConfigured) {
    if (leeg) {
      const { error } = await supabase.from("kilometers").delete().eq("datum", datum);
      if (error) throw error;
      return;
    }
    const { error } = await supabase
      .from("kilometers")
      .upsert({ datum, km: Number(km) || 0, notitie: notitie || null }, { onConflict: "datum" });
    if (error) throw error;
    return;
  }

  const obj = kmLees();
  if (leeg) delete obj[datum];
  else obj[datum] = { datum, km: Number(km) || 0, notitie: notitie || "" };
  kmSchrijf(obj);
}

// ============================================================
//  Uren schrijven: meerdere regels per dag (project / omschrijving / uren).
//  Cloud-tabel "urenregels", of lokaal onder de sleutel hieronder.
// ============================================================
const LS_UREN = "spires-urenregels";

function urenLees() {
  try {
    const arr = JSON.parse(localStorage.getItem(LS_UREN) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function urenSchrijf(arr) {
  localStorage.setItem(LS_UREN, JSON.stringify(arr));
}
const schoon = (r) => ({
  id: r.id,
  datum: r.datum,
  project: r.project || "",
  omschrijving: r.omschrijving || "",
  uren: Number(r.uren) || 0,
});

export async function haalAlleUren() {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from("urenregels")
      .select("*")
      .order("datum", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw error;
    return (data || []).map(schoon);
  }
  return urenLees().map(schoon);
}

export async function voegUrenregelToe({ datum, project, omschrijving, uren }) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from("urenregels")
      .insert({ datum, project, omschrijving, uren: Number(uren) || 0 })
      .select()
      .single();
    if (error) throw error;
    return schoon(data);
  }
  const regel = schoon({ id: `l-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, datum, project, omschrijving, uren });
  const arr = urenLees();
  arr.push(regel);
  urenSchrijf(arr);
  return regel;
}

export async function werkUrenregelBij(id, velden) {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from("urenregels")
      .update({ project: velden.project, omschrijving: velden.omschrijving, uren: Number(velden.uren) || 0 })
      .eq("id", id);
    if (error) throw error;
    return;
  }
  const arr = urenLees();
  const i = arr.findIndex((r) => r.id === id);
  if (i >= 0) {
    arr[i] = schoon({ ...arr[i], ...velden });
    urenSchrijf(arr);
  }
}

export async function verwijderUrenregel(id) {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from("urenregels").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  urenSchrijf(urenLees().filter((r) => r.id !== id));
}
