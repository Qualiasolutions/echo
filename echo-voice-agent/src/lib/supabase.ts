import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://bvwcxyjpxkaxirxuiqzp.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2d2N4eWpweGtheGlyeHVpcXpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NTEyODMsImV4cCI6MjA3NzMyNzI4M30.ORBwsSLWWlfTmMPVs-ndPqBPLCK91XyTRHWVJgGplzM";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
