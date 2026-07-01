import React, { useState, useMemo, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { haalAlleDagen, slaDagOp, haalAlleUren, voegUrenregelToe, werkUrenregelBij, verwijderUrenregel } from "./storage";
import { ChevronLeft, ChevronRight, Clock, CalendarDays, Sigma, Loader2, AlertCircle, LogOut, Check, Plus, Trash2, Briefcase } from "lucide-react";

const KLEUR = { kop1: "#6FA8A7", kop2: "#3E7589", donker: "#2b2b2b", rand: "#e4e9ea", bgZacht: "#f5f8f8", wit: "#ffffff" };

const DAGEN = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];
const MAANDEN = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const MAANDEN_VOL = ["Januari", "Februari", "Maart", "April", "Mei", "Juni", "Juli", "Augustus", "September", "Oktober", "November", "December"];
const PROJECTEN = ["Buitenwaard", "D'Coolenwaerd", "Voorbij de stolp", "Lemmer Noord", "Braken 2", "Avenhorn", "Overig", "Calculeren", "Vrij"];

// ---- datum-hulpjes (week begint op maandag) -------------------------------
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function maandagVan(datum) {
  const d = new Date(datum);
  d.setHours(0, 0, 0, 0);
  const dag = (d.getDay() + 6) % 7; // maandag = 0 ... zondag = 6
  d.setDate(d.getDate() - dag);
  return d;
}
function weeknummer(datum) {
  const d = new Date(Date.UTC(datum.getFullYear(), datum.getMonth(), datum.getDate()));
  const dagNr = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dagNr + 3);
  const eersteDonderdag = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d - eersteDonderdag) / 86400000 - 3 + ((eersteDonderdag.getUTCDay() + 6) % 7)) / 7);
}
// "1,5" of "1.5" -> 1.5 ; lege of foute invoer -> 0
const naarGetal = (tekst) => {
  if (tekst === "" || tekst == null) return 0;
  const n = parseFloat(String(tekst).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const komma = (n) => (Math.round((Number(n) || 0) * 100) / 100).toString().replace(".", ",");
// overuren: met +/- teken ; gewone uren: gewoon platte weergave
const toonSaldo = (n) => `${(Number(n) || 0) > 0 ? "+" : ""}${komma(n)} u`;
const toonUren = (n) => `${komma(n)} u`;
// wat in het invoerveld staat: een opgeslagen getal tonen we met komma,
// terwijl je tikt laten we de ruwe tekst staan; 0 / leeg blijft leeg
const toonInvoer = (v) => {
  if (v === "" || v === 0 || v == null) return "";
  if (typeof v === "number") return String(v).replace(".", ",");
  return v;
};

export default function Weekoverzicht({ gebruiker }) {
  const [modus, setModus] = useState("uren"); // "uren" | "overuren"

  // --- overuren-gegevens (één regel per dag) ---
  const [alles, setAlles] = useState({});
  const [laden, setLaden] = useState(true);
  const [foutmelding, setFoutmelding] = useState("");
  const [zojuistOpgeslagen, setZojuistOpgeslagen] = useState(null);

  // --- uren-gegevens (meerdere regels per dag) ---
  const [urenregels, setUrenregels] = useState([]);
  const [urenGeladen, setUrenGeladen] = useState(false);
  const [urenLaden, setUrenLaden] = useState(false);
  const [urenFout, setUrenFout] = useState("");

  const [ankerDatum, setAnkerDatum] = useState(() => new Date());

  useEffect(() => {
    haalAlleDagen()
      .then((rijen) => {
        const map = {};
        rijen.forEach((r) => { map[r.datum] = { datum: r.datum, uren: Number(r.uren) || 0, notitie: r.notitie || "" }; });
        setAlles(map);
      })
      .catch(() => setFoutmelding(isSupabaseConfigured
        ? 'Kon de overuren niet inladen. Controleer of de tabel "overuren" bestaat en de beveiligingsregels in Supabase goed staan.'
        : "Kon de opgeslagen overuren niet inladen."))
      .finally(() => setLaden(false));
  }, []);

  // uren pas inladen zodra je die modus voor het eerst opent
  useEffect(() => {
    if (modus !== "uren" || urenGeladen) return;
    setUrenLaden(true);
    haalAlleUren()
      .then((rijen) => { setUrenregels(rijen); setUrenGeladen(true); })
      .catch(() => setUrenFout(isSupabaseConfigured
        ? 'Kon de uren niet inladen. Controleer of de tabel "urenregels" in Supabase bestaat (voer supabase/urenregels.sql uit).'
        : "Kon de opgeslagen uren niet inladen."))
      .finally(() => setUrenLaden(false));
  }, [modus, urenGeladen]);

  const maandag = useMemo(() => maandagVan(ankerDatum), [ankerDatum]);
  const weekDagen = useMemo(() => {
    return DAGEN.map((naam, i) => {
      const d = new Date(maandag);
      d.setDate(maandag.getDate() + i);
      return { naam, datum: ymd(d), dagNr: d.getDate(), maand: MAANDEN[d.getMonth()], weekend: i >= 5 };
    });
  }, [maandag]);

  const actiefJaar = ankerDatum.getFullYear();
  const actieveMaandIndex = ankerDatum.getMonth();
  const maandPrefix = `${actiefJaar}-${String(actieveMaandIndex + 1).padStart(2, "0")}`;

  // overuren-totalen
  const weekTotaal = useMemo(() => weekDagen.reduce((s, d) => s + naarGetal(alles[d.datum]?.uren), 0), [weekDagen, alles]);
  const saldoTotaal = useMemo(() => Object.values(alles).reduce((s, d) => s + naarGetal(d.uren), 0), [alles]);
  const maandTotaal = useMemo(() => Object.values(alles).reduce((s, d) => (String(d.datum).startsWith(maandPrefix) ? s + naarGetal(d.uren) : s), 0), [alles, maandPrefix]);

  // uren-totalen + groepering per dag
  const urenPerDag = useMemo(() => {
    const m = {};
    urenregels.forEach((r) => { (m[r.datum] = m[r.datum] || []).push(r); });
    return m;
  }, [urenregels]);
  const werkdagen = useMemo(() => weekDagen.filter((d) => !d.weekend), [weekDagen]); // ma–vr, geen weekend
  const urenWeekTotaal = useMemo(() => werkdagen.reduce((s, d) => s + (urenPerDag[d.datum] || []).reduce((a, r) => a + naarGetal(r.uren), 0), 0), [werkdagen, urenPerDag]);
  const urenMaandTotaal = useMemo(() => urenregels.reduce((s, r) => (String(r.datum).startsWith(maandPrefix) ? s + naarGetal(r.uren) : s), 0), [urenregels, maandPrefix]);
  // uren per project voor de gekozen maand (voor de widgets rechts)
  const projectMaand = useMemo(() => {
    const m = {};
    PROJECTEN.forEach((p) => { m[p] = 0; });
    urenregels.forEach((r) => {
      if (String(r.datum).startsWith(maandPrefix)) m[r.project] = (m[r.project] || 0) + naarGetal(r.uren);
    });
    return PROJECTEN.map((p) => ({ project: p, uren: m[p] })).sort((a, b) => b.uren - a.uren);
  }, [urenregels, maandPrefix]);

  const vandaag = ymd(new Date());
  const isDezeWeek = weekDagen.some((d) => d.datum === vandaag);
  const titelRange = () => {
    const eerste = weekDagen[0], laatste = weekDagen[6];
    const jaar = new Date(laatste.datum).getFullYear();
    return `${eerste.dagNr} ${eerste.maand} – ${laatste.dagNr} ${laatste.maand} ${jaar}`;
  };

  // ---- overuren: bewerken ----
  const wijzigVeld = (datum, veld, waarde) => {
    setAlles((vorig) => {
      const huidig = vorig[datum] || { datum, uren: 0, notitie: "" };
      return { ...vorig, [datum]: { ...huidig, [veld]: waarde } };
    });
  };
  const bewaar = async (datum) => {
    const rij = alles[datum] || { uren: 0, notitie: "" };
    const uren = naarGetal(rij.uren);
    try {
      await slaDagOp(datum, uren, rij.notitie);
      setAlles((vorig) => ({ ...vorig, [datum]: { datum, uren, notitie: rij.notitie || "" } }));
      setZojuistOpgeslagen(datum);
      setTimeout(() => setZojuistOpgeslagen((d) => (d === datum ? null : d)), 1500);
    } catch {
      setFoutmelding("Opslaan mislukt. Probeer het opnieuw.");
    }
  };

  // ---- uren: bewerken ----
  const voegRegelToe = async (datum) => {
    try {
      const nieuw = await voegUrenregelToe({ datum, project: "", omschrijving: "", uren: 0 });
      setUrenregels((v) => [...v, nieuw]);
    } catch {
      setUrenFout("Regel toevoegen mislukt.");
    }
  };
  const wijzigRegel = (id, veld, waarde) => {
    setUrenregels((v) => v.map((r) => (r.id === id ? { ...r, [veld]: waarde } : r)));
  };
  const bewaarRegel = async (id, overrides = {}) => {
    const bestaand = urenregels.find((x) => x.id === id);
    if (!bestaand) return;
    const r = { ...bestaand, ...overrides };
    const uren = naarGetal(r.uren);
    try {
      await werkUrenregelBij(id, { project: r.project, omschrijving: r.omschrijving, uren });
      setUrenregels((v) => v.map((x) => (x.id === id ? { ...x, ...overrides, uren } : x)));
    } catch {
      setUrenFout("Opslaan mislukt. Probeer het opnieuw.");
    }
  };
  const verwijderRegel = async (id) => {
    const vorige = urenregels;
    setUrenregels((v) => v.filter((x) => x.id !== id));
    try {
      await verwijderUrenregel(id);
    } catch {
      setUrenregels(vorige);
      setUrenFout("Verwijderen mislukt.");
    }
  };

  // ---- navigatie ----
  const verzetWeek = (richting) => {
    const d = new Date(maandag);
    d.setDate(d.getDate() + richting * 7);
    setAnkerDatum(d);
  };
  const naarVandaag = () => setAnkerDatum(new Date());
  const kiesMaand = (maandIndex) => setAnkerDatum(new Date(actiefJaar, maandIndex, 1));
  const wijzigJaar = (delta) => setAnkerDatum(new Date(actiefJaar + delta, actieveMaandIndex, 1));

  const uitloggen = () => isSupabaseConfigured && supabase.auth.signOut();

  const isUren = modus === "uren";
  const bezig = isUren ? (urenLaden && !urenGeladen) : laden;

  return (
    <div style={{ fontFamily: "Aptos, 'Segoe UI', system-ui, sans-serif", color: KLEUR.donker, background: KLEUR.bgZacht, minHeight: "100vh" }}>
      <header style={{ background: KLEUR.wit, borderBottom: `1px solid ${KLEUR.rand}`, padding: "20px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, maxWidth: 1320, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img
              src="/spires-logo.png"
              alt="Spires"
              style={{ height: 38, width: "auto", display: "block" }}
              onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "block"; }}
            />
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: KLEUR.kop1, letterSpacing: "-0.01em", display: "none" }}>Spires Uren</h1>
            <span style={{ fontSize: 13, fontWeight: 600, color: KLEUR.kop2, textTransform: "uppercase", letterSpacing: "0.05em" }}>Urenregistratie</span>
          </div>
          {isSupabaseConfigured && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#7c8a8b" }}>
              <span>{gebruiker?.email}</span>
              <button onClick={uitloggen} title="Uitloggen" style={{ background: "none", border: `1px solid ${KLEUR.rand}`, borderRadius: 8, padding: "8px 10px", cursor: "pointer", color: KLEUR.kop2, display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "inherit", fontSize: 13 }}>
                <LogOut size={15} /> Uitloggen
              </button>
            </div>
          )}
        </div>
      </header>

      <div style={{ display: "flex", alignItems: "flex-start", maxWidth: 1320, margin: "0 auto", gap: 4 }}>
        <aside style={{ flex: "0 0 210px", padding: "26px 12px 24px 20px", position: "sticky", top: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#9aa7a8", textTransform: "uppercase", letterSpacing: "0.05em", padding: "0 6px 12px" }}>Periode</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, padding: "0 2px" }}>
            <button onClick={() => wijzigJaar(-1)} title="Vorig jaar" style={navBtnKlein}><ChevronLeft size={16} /></button>
            <span style={{ fontSize: 17, fontWeight: 700, color: KLEUR.kop2 }}>{actiefJaar}</span>
            <button onClick={() => wijzigJaar(1)} title="Volgend jaar" style={navBtnKlein}><ChevronRight size={16} /></button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {MAANDEN_VOL.map((m, i) => {
              const actief = i === actieveMaandIndex;
              return (
                <button key={m} onClick={() => kiesMaand(i)} style={{
                  border: `1px solid ${actief ? KLEUR.kop1 : "transparent"}`,
                  background: actief ? KLEUR.kop1 : "#fff",
                  color: actief ? "#fff" : "#4a5a5b",
                  borderRadius: 8, padding: "10px 14px", fontSize: 14, fontWeight: actief ? 600 : 500,
                  cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%",
                }}>{m}</button>
              );
            })}
          </div>
        </aside>

        <main style={{ flex: 1, minWidth: 0, padding: "24px 24px 48px 10px" }}>
          {/* keuze: uren of overuren schrijven */}
          <div style={{ display: "inline-flex", background: KLEUR.wit, border: `1px solid ${KLEUR.rand}`, borderRadius: 10, padding: 3, gap: 3, marginBottom: 20 }}>
            {[["uren", "Uren schrijven"], ["overuren", "Overuren schrijven"]].map(([key, label]) => (
              <button key={key} onClick={() => setModus(key)} style={{
                border: "none", borderRadius: 8, cursor: "pointer", padding: "9px 20px",
                fontSize: 14, fontWeight: 600, fontFamily: "inherit",
                background: modus === key ? KLEUR.kop1 : "transparent",
                color: modus === key ? "#fff" : "#5a6a6b",
              }}>{label}</button>
            ))}
          </div>

          {(isUren ? urenFout : foutmelding) && (
            <div style={melding}>
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} /><span>{isUren ? urenFout : foutmelding}</span>
            </div>
          )}

          {/* week-navigatie */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => verzetWeek(-1)} title="Vorige week" style={navBtn}><ChevronLeft size={18} /></button>
              <div style={{ textAlign: "center", minWidth: 230 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: KLEUR.kop2 }}>Week {weeknummer(maandag)}</div>
                <div style={{ fontSize: 13, color: "#8a9799" }}>{titelRange()}</div>
              </div>
              <button onClick={() => verzetWeek(1)} title="Volgende week" style={navBtn}><ChevronRight size={18} /></button>
            </div>
            <button onClick={naarVandaag} disabled={isDezeWeek}
              style={{ ...btnSecundair, opacity: isDezeWeek ? 0.5 : 1, cursor: isDezeWeek ? "default" : "pointer" }}>
              Deze week
            </button>
          </div>

          {bezig ? (
            <div style={{ textAlign: "center", padding: 60, color: "#8a9799" }}>
              <Loader2 size={28} className="spin" style={{ color: KLEUR.kop1 }} />
              <p style={{ marginTop: 12 }}>Gegevens worden ingeladen…</p>
            </div>
          ) : isUren ? (
            /* ================= UREN SCHRIJVEN ================= */
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
                <StatKaart icon={<Clock size={20} />} label="Uren deze week" waarde={toonUren(urenWeekTotaal)} />
                <StatKaart icon={<CalendarDays size={20} />} label="Uren deze maand" waarde={toonUren(urenMaandTotaal)} />
                <StatKaart icon={<Briefcase size={20} />} label={`Norm week (5 × 8 u)`} waarde={"40 u"} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {werkdagen.map((d) => {
                  const regels = urenPerDag[d.datum] || [];
                  const dagtotaal = regels.reduce((s, r) => s + naarGetal(r.uren), 0);
                  const isVandaag = d.datum === vandaag;
                  const totKleur = dagtotaal === 0 ? "#b3bdbe" : dagtotaal === 8 ? "#3f8f5a" : dagtotaal > 8 ? "#c08a2d" : KLEUR.kop2;
                  return (
                    <div key={d.datum} style={{ background: KLEUR.wit, border: `1px solid ${KLEUR.rand}`, borderRadius: 12, padding: "14px 16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: regels.length ? 10 : 4 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: isVandaag ? KLEUR.kop1 : KLEUR.kop2, display: "flex", alignItems: "center", gap: 8 }}>
                          {d.naam} <span style={{ fontSize: 12.5, color: "#9aa7a8", fontWeight: 500 }}>{d.dagNr} {d.maand}</span>
                          {isVandaag && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: KLEUR.kop1, borderRadius: 20, padding: "1px 7px", textTransform: "uppercase", letterSpacing: "0.04em" }}>vandaag</span>}
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: totKleur }}>{komma(dagtotaal)} / 8 u</span>
                      </div>

                      {regels.length > 0 && (
                        <div style={{ display: "flex", gap: 8, padding: "0 2px 5px", fontSize: 11, fontWeight: 600, color: "#9aa7a8", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                          <span style={{ flex: "0 0 190px" }}>Project</span>
                          <span style={{ flex: "1 1 0" }}>Omschrijving</span>
                          <span style={{ flex: "0 0 92px" }}>Uren</span>
                          <span style={{ flex: "0 0 34px" }} />
                        </div>
                      )}

                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {regels.map((r) => (
                          <div key={r.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <select value={r.project} onChange={(e) => { wijzigRegel(r.id, "project", e.target.value); bewaarRegel(r.id, { project: e.target.value }); }}
                              style={{ ...inputStijl, flex: "0 0 190px", cursor: "pointer", color: r.project ? KLEUR.donker : "#9aa7a8" }}>
                              <option value="">Kies…</option>
                              {PROJECTEN.map((p) => <option key={p} value={p} style={{ color: KLEUR.donker }}>{p}</option>)}
                            </select>
                            <input type="text" value={r.omschrijving} placeholder="Waar heb je aan gewerkt?"
                              onChange={(e) => wijzigRegel(r.id, "omschrijving", e.target.value)}
                              onBlur={() => bewaarRegel(r.id)}
                              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                              style={{ ...inputStijl, flex: "1 1 0", minWidth: 0 }} />
                            <div style={{ flex: "0 0 92px", position: "relative" }}>
                              <input type="text" inputMode="decimal" value={toonInvoer(r.uren)} placeholder="0"
                                onChange={(e) => wijzigRegel(r.id, "uren", e.target.value)}
                                onBlur={() => bewaarRegel(r.id)}
                                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                                style={{ ...inputStijl, width: "100%", textAlign: "center", paddingRight: 30, fontWeight: 600, color: KLEUR.kop2 }} />
                              <span style={{ position: "absolute", right: 10, top: 9, fontSize: 12.5, color: "#9aa7a8", pointerEvents: "none" }}>u</span>
                            </div>
                            <button onClick={() => verwijderRegel(r.id)} title="Regel verwijderen"
                              style={{ flex: "0 0 34px", height: 36, background: "#fff", border: `1px solid ${KLEUR.rand}`, borderRadius: 8, color: "#a04848", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                      </div>

                      <button onClick={() => voegRegelToe(d.datum)}
                        style={{ marginTop: regels.length ? 10 : 6, background: "none", border: "none", color: KLEUR.kop1, cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 2px" }}>
                        <Plus size={16} /> Regel toevoegen
                      </button>
                    </div>
                  );
                })}
              </div>

              <p style={{ fontSize: 12.5, color: "#9aa7a8", marginTop: 14, lineHeight: 1.5 }}>
                Schrijf per dag je uren weg over de projecten (standaard 8 uur per werkdag). Kies het project, geef een korte omschrijving en het aantal uren.
                Halve uren mag met een komma (bijv. <code>1,5</code>). Wijzigingen worden automatisch opgeslagen.
                {!isSupabaseConfigured && " Je gegevens staan nu lokaal in deze browser opgeslagen."}
              </p>
            </>
          ) : (
            /* ================= OVERUREN SCHRIJVEN ================= */
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
                <StatKaart icon={<Clock size={20} />} label="Overuren deze week" waarde={toonSaldo(weekTotaal)} />
                <StatKaart icon={<CalendarDays size={20} />} label="Overuren deze maand" waarde={toonSaldo(maandTotaal)} />
                <StatKaart icon={<Sigma size={20} />} label="Totaal saldo (alles)" waarde={toonSaldo(saldoTotaal)} />
              </div>

              <div style={{ background: KLEUR.wit, border: `1px solid ${KLEUR.rand}`, borderRadius: 14, overflow: "hidden" }}>
                {weekDagen.map((d, i) => {
                  const rij = alles[d.datum] || { uren: "", notitie: "" };
                  const isVandaag = d.datum === vandaag;
                  const opgeslagen = zojuistOpgeslagen === d.datum;
                  return (
                    <div key={d.datum} style={{
                      display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
                      borderTop: i === 0 ? "none" : `1px solid ${KLEUR.rand}`,
                      background: d.weekend ? "#fafcfc" : KLEUR.wit,
                    }}>
                      <div style={{ flex: "0 0 150px", minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: isVandaag ? KLEUR.kop1 : KLEUR.kop2, display: "flex", alignItems: "center", gap: 7 }}>
                          {d.naam}
                          {isVandaag && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: KLEUR.kop1, borderRadius: 20, padding: "1px 7px", textTransform: "uppercase", letterSpacing: "0.04em" }}>vandaag</span>}
                        </div>
                        <div style={{ fontSize: 12.5, color: "#9aa7a8", marginTop: 1 }}>{d.dagNr} {d.maand}</div>
                      </div>

                      <div style={{ flex: "0 0 130px", position: "relative" }}>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={toonInvoer(rij.uren)}
                          onChange={(e) => wijzigVeld(d.datum, "uren", e.target.value)}
                          onBlur={() => bewaar(d.datum)}
                          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                          placeholder="0"
                          style={{ ...inputStijl, width: "100%", textAlign: "center", paddingRight: 34, fontWeight: 600, color: KLEUR.kop2 }}
                        />
                        <span style={{ position: "absolute", right: 12, top: 9, fontSize: 13, color: "#9aa7a8", pointerEvents: "none" }}>uur</span>
                      </div>

                      <div style={{ flex: "1 1 0", minWidth: 0, position: "relative" }}>
                        <input
                          type="text"
                          value={rij.notitie || ""}
                          onChange={(e) => wijzigVeld(d.datum, "notitie", e.target.value)}
                          onBlur={() => bewaar(d.datum)}
                          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                          placeholder="Notitie (optioneel)…"
                          style={{ ...inputStijl, width: "100%", paddingRight: 34 }}
                        />
                        {opgeslagen && (
                          <span style={{ position: "absolute", right: 11, top: 10, color: "#3f8f5a", display: "inline-flex" }} title="Opgeslagen">
                            <Check size={16} />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderTop: `2px solid ${KLEUR.rand}`, background: "#f3f8f8" }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: KLEUR.kop2 }}>Totaal deze week</span>
                  <span style={{ fontSize: 17, fontWeight: 700, color: weekTotaal < 0 ? "#a04848" : KLEUR.kop1 }}>{toonSaldo(weekTotaal)}</span>
                </div>
              </div>

              <p style={{ fontSize: 12.5, color: "#9aa7a8", marginTop: 14, lineHeight: 1.5 }}>
                Vul per dag je <strong>extra</strong> uren in bovenop de normale 8 uur. Halve uren mag met een komma (bijv. <code>1,5</code>);
                minder gewerkt? Zet er een minteken voor (bijv. <code>-2</code>). Wijzigingen worden automatisch opgeslagen.
                {!isSupabaseConfigured && " Je gegevens staan nu lokaal in deze browser opgeslagen."}
              </p>
            </>
          )}
        </main>

        {isUren && !bezig && (
          <aside style={{ flex: "0 0 250px", padding: "24px 20px 24px 8px", position: "sticky", top: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "#9aa7a8", textTransform: "uppercase", letterSpacing: "0.05em", padding: "0 2px 12px" }}>
              Per project · {MAANDEN_VOL[actieveMaandIndex]} {actiefJaar}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(() => {
                const maxUren = Math.max(1, ...projectMaand.map((p) => p.uren));
                const totaal = projectMaand.reduce((s, p) => s + p.uren, 0);
                if (totaal === 0) {
                  return <div style={{ background: KLEUR.wit, border: `1px dashed ${KLEUR.rand}`, borderRadius: 12, padding: "18px 16px", fontSize: 13, color: "#9aa7a8", textAlign: "center" }}>Nog geen uren deze maand.</div>;
                }
                return (
                  <>
                    {projectMaand.filter((p) => p.uren > 0).map((p) => (
                      <div key={p.project} style={{ background: KLEUR.wit, border: `1px solid ${KLEUR.rand}`, borderRadius: 12, padding: "12px 14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: KLEUR.kop2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.project}</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: KLEUR.kop1, flexShrink: 0 }}>{komma(p.uren)} u</span>
                        </div>
                        <div style={{ height: 6, background: "#eef4f4", borderRadius: 20, overflow: "hidden" }}>
                          <div style={{ width: `${(p.uren / maxUren) * 100}%`, height: "100%", background: KLEUR.kop1, borderRadius: 20 }} />
                        </div>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#f3f8f8", border: `1px solid ${KLEUR.rand}`, borderRadius: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: KLEUR.kop2 }}>Totaal maand</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: KLEUR.kop1 }}>{komma(totaal)} u</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </aside>
        )}
      </div>
      <style>{`.spin{animation:s 1s linear infinite}@keyframes s{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function StatKaart({ icon, label, waarde }) {
  return (
    <div style={{ background: KLEUR.wit, border: `1px solid ${KLEUR.rand}`, borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ color: KLEUR.kop1, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: KLEUR.kop2 }}>{waarde}</div>
      <div style={{ fontSize: 12.5, color: "#8a9799", marginTop: 2 }}>{label}</div>
    </div>
  );
}

const inputStijl = { padding: "9px 12px", border: `1px solid ${KLEUR.rand}`, borderRadius: 8, fontSize: 14, color: KLEUR.donker, background: "#fff", outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
const btnSecundair = { background: "#fff", color: KLEUR.kop2, border: `1px solid ${KLEUR.rand}`, borderRadius: 8, padding: "9px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
const navBtn = { background: "#fff", color: KLEUR.kop2, border: `1px solid ${KLEUR.rand}`, borderRadius: 9, width: 38, height: 38, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const navBtnKlein = { background: "#fff", color: KLEUR.kop2, border: `1px solid ${KLEUR.rand}`, borderRadius: 8, width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const melding = { display: "flex", gap: 10, background: "#f5e8e8", color: "#a04848", border: "1px solid #e6cccc", borderRadius: 10, padding: "12px 14px", fontSize: 13.5, marginBottom: 20, lineHeight: 1.45 };
