"use client";

import { createClient } from "@supabase/supabase-js";
import { supabaseAnon, supabaseUrl } from "@/lib/env";

export const supabase = createClient(supabaseUrl as string, supabaseAnon as string);
