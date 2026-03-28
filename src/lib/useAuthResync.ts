"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase-browser";

export function useAuthResync() {
  useEffect(() => {
    const sync = async () => {
      await supabase.auth.getSession();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void sync();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", sync);

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void supabase.auth.getSession();
    });

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", sync);
      sub.subscription.unsubscribe();
    };
  }, []);
}
