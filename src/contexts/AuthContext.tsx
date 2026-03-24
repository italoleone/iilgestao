import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export type AppRole = "admin_geral" | "admin" | "planejamento" | "projetista";

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
  canAccessAllProjects: boolean;
  canManageUsers: boolean;
  isProjetista: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingApproval, setPendingApproval] = useState(false);

  const fetchProfile = async (userId: string) => {
    try {
      const [{ data: profileData }, { data: roleData }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("user_roles").select("role").eq("user_id", userId).single(),
      ]);

      if (profileData) {
        const status = (profileData as any).status || "active";
        if (status !== "active") {
          // User not approved yet - sign them out
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
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
    }
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
  const canAccessAllProjects = role !== "projetista";
  const canManageUsers = role === "admin_geral";
  const isProjetista = role === "projetista";

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
        canAccessAllProjects,
        canManageUsers,
        isProjetista,
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
