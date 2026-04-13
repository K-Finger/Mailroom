import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const AUTH_ENABLED = process.env.AUTH_ENABLED === "true";
export const DEV_USER_ID = "00000000-0000-0000-0000-000000000000";

export interface AppUser {
  userId: string;
  email: string | null;
  authEnabled: boolean;
}

export async function getAppUser(): Promise<AppUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (AUTH_ENABLED && !user) {
    return null;
  }

  return {
    userId: user?.id ?? DEV_USER_ID,
    email: user?.email ?? null,
    authEnabled: AUTH_ENABLED,
  };
}

export async function requireAppUser(): Promise<AppUser> {
  const appUser = await getAppUser();
  if (!appUser) {
    redirect("/login");
  }
  return appUser;
}
