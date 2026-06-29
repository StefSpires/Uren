import React, { useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import Login from "./Login.jsx";
import Weekoverzicht from "./Weekoverzicht.jsx";
import { Loader2 } from "lucide-react";

export default function App() {
  const [sessie, setSessie] = useState(null);
  const [laden, setLaden] = useState(isSupabaseConfigured);

  useEffect(() => {
    // Zonder Supabase: geen inloggen nodig, meteen naar het overzicht.
    if (!isSupabaseConfigured) return;

    supabase.auth.getSession().then(({ data }) => {
      setSessie(data.session);
      setLaden(false);
    });
    const { data: luisteraar } = supabase.auth.onAuthStateChange((_event, sessie) => {
      setSessie(sessie);
    });
    return () => luisteraar.subscription.unsubscribe();
  }, []);

  if (laden) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#f5f8f8" }}>
        <Loader2 size={28} style={{ color: "#6FA8A7", animation: "s 1s linear infinite" }} />
        <style>{`@keyframes s{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // Met Supabase: eerst inloggen. Zonder Supabase: direct het overzicht.
  if (isSupabaseConfigured && !sessie) return <Login />;
  return <Weekoverzicht gebruiker={sessie?.user} />;
}
