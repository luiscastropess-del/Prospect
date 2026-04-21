import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (supabaseInstance) return supabaseInstance;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Configuração do Supabase ausente. Certifique-se de que NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY estão configuradas no seu arquivo .env'
    );
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseInstance;
}

/**
 * Função utilitária para buscar todos os locais salvos.
 */
export async function getAllPlaces() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('places')
    .select('*')
    .order('last_updated', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Função para buscar locais inseridos/atualizados nas últimas 24 horas.
 */
export async function getPlacesLast24Hours() {
  const supabase = getSupabase();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('places')
    .select('*')
    .gte('last_updated', twentyFourHoursAgo)
    .order('last_updated', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Função para inserir ou atualizar locais (Upsert).
 */
export async function upsertPlaces(places: any[]) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('places')
    .upsert(places, { onConflict: 'osm_id' });

  if (error) throw error;
  return data;
}
