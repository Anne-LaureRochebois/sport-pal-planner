import React, { useEffect } from "react";

export default function TestEnv() {
  useEffect(() => {
    console.log("Supabase URL:", import.meta.env.VITE_SUPABASE_URL);
    console.log("Supabase ANON Key:", import.meta.env.VITE_SUPABASE_ANON_KEY);
  }, []);

  return <div>Test des variables d'environnement — regarde la console</div>;
}
