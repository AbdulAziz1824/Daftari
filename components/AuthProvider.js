"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); return; }
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    setProfile(data || null);
  }, []);

  const loadAdmin = useCallback(async (userId) => {
    if (!userId) { setIsAdmin(false); return; }
    // الجدول يسمح للمستخدم برؤية صفه فقط، فإذا وُجد صف = أدمن
    const { data } = await supabase.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
    setIsAdmin(!!data);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user || null;
      setUser(u);
      if (u) { loadProfile(u.id); loadAdmin(u.id); }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user || null;
      setUser(u);
      if (u) { loadProfile(u.id); loadAdmin(u.id); }
      else { setProfile(null); setIsAdmin(false); }
    });

    return () => listener.subscription.unsubscribe();
  }, [loadProfile, loadAdmin]);

  const refreshProfile = useCallback(() => {
    if (user) loadProfile(user.id);
  }, [user, loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
