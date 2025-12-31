"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, usePathname } from "next/navigation";
import type { Session } from "@supabase/supabase-js";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const decide = (session: Session | null) => {
      if (!session) {
        if (!pathname.startsWith("/auth")) {
          router.replace("/auth");
        }
      } else {
        setReady(true);
      }
    };

    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      decide(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string, session: Session | null) => {
      decide(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, pathname]);

  if (!ready && !pathname.startsWith("/auth")) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Carregando sessão...
      </div>
    );
  }

  return <>{children}</>;
}
