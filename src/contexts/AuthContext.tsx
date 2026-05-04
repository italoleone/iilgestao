import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export type AppRole = "admin_geral" | "admin" | "planejamento" | "coordenador" | "projetista";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  discipline: string | null;
  cost_per_hour: number;
  monthly_capacity_hours: number;
  avatar_url: string | null;
  role: AppRole;
}

interface AuthContextType {
  user: SupabaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  pendingApproval: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  canAccessFinanceiro: boolean;
  canAccessComercial: boolean;
  canAccessPlanejamento: boolean;
  canAccessAllProjects: boolean;
  canManageUsers: boolean;
  canCreateTasks: boolean;
  isProjetista: boolean;
  isCoordenador: boolean;
  isPlanejamento: boolean;
  isDiretorOrGerente: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingApproval, setPendingApproval] = useState(false);

  const fetchProfileOnce = async (userId: string) => {
    return await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    ]);
  };

  const fetchProfile = async (userId: string) => {
    let profileData: any = null;
    let roleData: any = null;

    // Retry up to 3 times with 1s interval before giving up. Never sign the user out on transient errors.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const [profileRes, roleRes] = await fetchProfileOnce(userId);
        if (profileRes.error) {
          console.warn(`[Auth] profile fetch attempt ${attempt + 1} error:`, profileRes.error.message);
        }
        if (roleRes?.error) {
          console.warn(`[Auth] role fetch attempt ${attempt + 1} error:`, roleRes.error.message);
        }
        profileData = profileRes.data;
        roleData = roleRes?.data;
        if (profileData) break;
      } catch (err) {
        console.warn(`[Auth] profile fetch attempt ${attempt + 1} threw:`, err);
      }
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1000));
    }

    if (!profileData) {
      // Could not load profile after retries — keep the session, just stop the loading state.
      // Do NOT sign the user out here; transient RLS / network failures should not log them off.
      console.error("[Auth] Profile could not be loaded after retries; keeping session alive.");
      setLoading(false);
      return;
    }

    const status = (profileData as any).status || "active";
    if (status !== "active") {
      // User not approved yet - sign them out (this is an explicit business rule, not an error path).
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setPendingApproval(status === "pending");
      setLoading(false);
      return;
    }

    setProfile({
      id: profileData.id,
      name: profileData.name,
      email: profileData.email,
      discipline: profileData.discipline,
      cost_per_hour: Number(profileData.cost_per_hour) || 0,
      monthly_capacity_hours: profileData.monthly_capacity_hours || 176,
      avatar_url: profileData.avatar_url,
      role: (roleData?.role as AppRole) || "projetista",
    });
    setPendingApproval(false);
    setLoading(false);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message || null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const role = profile?.role;
  const canAccessFinanceiro = role === "admin_geral" || role === "admin";
  const canAccessComercial = role === "admin_geral" || role === "admin";
  const canAccessPlanejamento = role !== "projetista";
  const canAccessAllProjects = role === "admin_geral" || role === "admin" || role === "planejamento";
  const canManageUsers = role === "admin_geral";
  const canCreateTasks = role !== "projetista";
  const isProjetista = role === "projetista";
  const isCoordenador = role === "coordenador";
  const isPlanejamento = role === "planejamento";
  const isDiretorOrGerente = role === "admin_geral" || role === "admin";

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        pendingApproval,
        signIn,
        signOut,
        refreshProfile,
        canAccessFinanceiro,
        canAccessComercial,
        canAccessPlanejamento,
        canAccessAllProjects,
        canManageUsers,
        canCreateTasks,
        isProjetista,
        isCoordenador,
        isPlanejamento,
        isDiretorOrGerente,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
