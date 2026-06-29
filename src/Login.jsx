import React, { useState } from "react";
import { supabase } from "./supabaseClient";
import { Lock, Loader2 } from "lucide-react";

const KLEUR = { kop1: "#6FA8A7", kop2: "#3E7589", donker: "#2b2b2b", rand: "#e4e9ea", bgZacht: "#f5f8f8" };

export default function Login() {
  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");

  const inloggen = async () => {
    setFout("");
    setBezig(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: wachtwoord });
    if (error) setFout("Inloggen mislukt. Controleer je e-mailadres en wachtwoord.");
    setBezig(false);
  };

  return (
    <div style={{ fontFamily: "Aptos, 'Segoe UI', system-ui, sans-serif", background: KLEUR.bgZacht, minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", padding: 16 }}>
      <div style={{ background: "#fff", border: `1px solid ${KLEUR.rand}`, borderRadius: 16, maxWidth: 380, width: "100%", padding: 30, boxShadow: "0 12px 40px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <Lock size={18} style={{ color: KLEUR.kop1 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: KLEUR.kop1, textTransform: "uppercase", letterSpacing: "0.04em" }}>Spires Uren</span>
        </div>
        <h1 style={{ margin: "0 0 22px", fontSize: 22, fontWeight: 700, color: KLEUR.kop1 }}>Inloggen</h1>

        <div style={{ display: "grid", gap: 13 }}>
          <div>
            <span style={labelStijl}>E-mailadres</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStijl} placeholder="naam@spires.nl" />
          </div>
          <div>
            <span style={labelStijl}>Wachtwoord</span>
            <input type="password" value={wachtwoord} onChange={(e) => setWachtwoord(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && inloggen()} style={inputStijl} placeholder="••••••••" />
          </div>

          {fout && <div style={{ background: "#f5e8e8", color: "#a04848", borderRadius: 8, padding: "10px 12px", fontSize: 13.5 }}>{fout}</div>}

          <button onClick={inloggen} disabled={bezig || !email || !wachtwoord}
            style={{ display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 8, background: KLEUR.kop1, color: "#fff", border: "none", borderRadius: 8, padding: "12px 16px", fontSize: 15, fontWeight: 600, cursor: bezig ? "not-allowed" : "pointer", opacity: bezig || !email || !wachtwoord ? 0.6 : 1, fontFamily: "inherit", marginTop: 4 }}>
            {bezig ? <><Loader2 size={18} className="spin" /> Bezig…</> : "Inloggen"}
          </button>
        </div>
      </div>
      <style>{`.spin{animation:s 1s linear infinite}@keyframes s{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const labelStijl = { fontSize: 12.5, fontWeight: 600, color: KLEUR.kop2, display: "block", marginBottom: 4 };
const inputStijl = { padding: "10px 12px", border: `1px solid ${KLEUR.rand}`, borderRadius: 8, fontSize: 14, color: KLEUR.donker, background: "#fff", outline: "none", fontFamily: "inherit", boxSizing: "border-box", width: "100%" };
