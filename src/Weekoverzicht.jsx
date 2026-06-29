import React, { useState, useMemo, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { haalAlleDagen, slaDagOp } from "./storage";
import { ChevronLeft, ChevronRight, Clock, CalendarDays, Sigma, Loader2, AlertCircle, LogOut, Check } from "lucide-react";

const KLEUR = { kop1: "#6FA8A7", kop2: "#3E7589", donker: "#2b2b2b", rand: "#e4e9ea", bgZacht: "#f5f8f8", wit: "#ffffff" };

const DAGEN = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];
const MAANDEN = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

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
const toonUren = (n) => {
  const v = Number(n) || 0;
  const s = (Math.round(v * 100) / 100).toString().replace(".", ",");
  return `${v > 0 ? "+" : ""}${s} u`;
};
// wat in het invoerveld staat: een opgeslagen getal tonen we met komma,
// terwijl je tikt laten we de ruwe tekst staan; 0 / leeg blijft leeg
const toonInvoer = (v) => {
  if (v === "" || v === 0 || v == null) return "";
  if (typeof v === "number") return String(v).replace(".", ",");
  return v;
};

export default function Weekoverzicht({ gebruiker }) {
  const [alles, setAlles] = useState({});        // datum -> { datum, uren, notitie }
  const [laden, setLaden] = useState(true);
  const [foutmelding, setFoutmelding] = useState("");
  const [ankerDatum, setAnkerDatum] = useState(() => new Date());
  const [zojuistOpgeslagen, setZojuistOpgeslagen] = useState(null); // datum die net is opgeslagen

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

  const maandag = useMemo(() => maandagVan(ankerDatum), [ankerDatum]);
  const weekDagen = useMemo(() => {
    return DAGEN.map((naam, i) => {
      const d = new Date(maandag);
      d.setDate(maandag.getDate() + i);
      return { naam, datum: ymd(d), dagNr: d.getDate(), maand: MAANDEN[d.getMonth()], weekend: i >= 5 };
    });
  }, [maandag]);

  const weekTotaal = useMemo(
    () => weekDagen.reduce((s, d) => s + naarGetal(alles[d.datum]?.uren), 0),
    [weekDagen, alles]
  );
  const saldoTotaal = useMemo(
    () => Object.values(alles).reduce((s, d) => s + naarGetal(d.uren), 0),
    [alles]
  );
  const dagenMetUren = useMemo(
    () => weekDagen.filter((d) => naarGetal(alles[d.datum]?.uren) !== 0).length,
    [weekDagen, alles]
  );

  const vandaag = ymd(new Date());
  const isDezeWeek = weekDagen.some((d) => d.datum === vandaag);

  const titelRange = () => {
    const eerste = weekDagen[0], laatste = weekDagen[6];
    const jaar = new Date(laatste.datum).getFullYear();
    return `${eerste.dagNr} ${eerste.maand} – ${laatste.dagNr} ${laatste.maand} ${jaar}`;
  };

  // optimistisch in beeld bijwerken; pas opslaan zodra het veld verlaten wordt
  const wijzigVeld = (datum, veld, waarde) => {
    setAlles((vorig) => {
      const huidig = vorig[datum] || { datum, uren: 0, notitie: "" };
      return { ...vorig, [datum]: { ...huidig, [veld]: veld === "uren" ? waarde : waarde } };
    });
  };

  const bewaar = async (datum) => {
    const rij = alles[datum] || { uren: 0, notitie: "" };
    const uren = naarGetal(rij.uren);
    try {
      await slaDagOp(datum, uren, rij.notitie);
      // genormaliseerd getal terugzetten zodat "1,5" netjes 1,5 blijft
      setAlles((vorig) => ({ ...vorig, [datum]: { datum, uren, notitie: rij.notitie || "" } }));
      setZojuistOpgeslagen(datum);
      setTimeout(() => setZojuistOpgeslagen((d) => (d === datum ? null : d)), 1500);
    } catch {
      setFoutmelding("Opslaan mislukt. Probeer het opnieuw.");
    }
  };

  const verzetWeek = (richting) => {
    const d = new Date(maandag);
    d.setDate(d.getDate() + richting * 7);
    setAnkerDatum(d);
  };
  const naarVandaag = () => setAnkerDatum(new Date());

  const uitloggen = () => isSupabaseConfigured && supabase.auth.signOut();

  return (
    <div style={{ fontFamily: "Aptos, 'Segoe UI', system-ui, sans-serif", color: KLEUR.donker, background: KLEUR.bgZacht, minHeight: "100vh" }}>
      <header style={{ background: KLEUR.wit, borderBottom: `1px solid ${KLEUR.rand}`, padding: "20px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, maxWidth: 920, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img
              src="/spires-logo.png"
              alt="Spires"
              style={{ height: 38, width: "auto", display: "block" }}
              onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "block"; }}
            />
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: KLEUR.kop1, letterSpacing: "-0.01em", display: "none" }}>Spires Uren</h1>
            <span style={{ fontSize: 13, fontWeight: 600, color: KLEUR.kop2, textTransform: "uppercase", letterSpacing: "0.05em" }}>Overuren</span>
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

      <main style={{ maxWidth: 920, margin: "0 auto", padding: "24px 28px 48px" }}>
        {foutmelding && (
          <div style={melding}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} /><span>{foutmelding}</span>
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

        {laden ? (
          <div style={{ textAlign: "center", padding: 60, color: "#8a9799" }}>
            <Loader2 size={28} className="spin" style={{ color: KLEUR.kop1 }} />
            <p style={{ marginTop: 12 }}>Gegevens worden ingeladen…</p>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
              <StatKaart icon={<Clock size={20} />} label="Overuren deze week" waarde={toonUren(weekTotaal)} />
              <StatKaart icon={<CalendarDays size={20} />} label="Dagen met overuren" waarde={`${dagenMetUren} / 7`} />
              <StatKaart icon={<Sigma size={20} />} label="Totaal saldo (alles)" waarde={toonUren(saldoTotaal)} />
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

              {/* weektotaal-balk */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderTop: `2px solid ${KLEUR.rand}`, background: "#f3f8f8" }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: KLEUR.kop2 }}>Totaal deze week</span>
                <span style={{ fontSize: 17, fontWeight: 700, color: weekTotaal < 0 ? "#a04848" : KLEUR.kop1 }}>{toonUren(weekTotaal)}</span>
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
const melding = { display: "flex", gap: 10, background: "#f5e8e8", color: "#a04848", border: "1px solid #e6cccc", borderRadius: 10, padding: "12px 14px", fontSize: 13.5, marginBottom: 20, lineHeight: 1.45 };
