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
 * Função para buscar locais que precisam de enriquecimento (campos faltantes).
 */
export async function getPlacesNeedsEnrichment(limit = 5) {
  const supabase = getSupabase();
  
  // Buscar locais onde a descrição está vazia ou o telefone é padrão
  const { data, error } = await supabase
    .from('places')
    .select('*')
    .or('description.is.null,description.eq."",phone.eq."Não informado"')
    .limit(limit)
    .order('last_updated', { ascending: true });

  if (error) throw error;
  return data;
}

export async function upsertPlaces(places: any[]) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('places')
    .upsert(places, { onConflict: 'osm_id' });

  if (error) throw error;
  return data;
}

/**
 * Funções para Endpoints Customizados
 */
export async function getAllEndpoints() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('endpoints')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function createEndpoint(endpoint: any) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('endpoints')
    .insert([endpoint])
    .select();

  if (error) throw error;
  return data;
}

export async function deleteEndpoint(id: string) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('endpoints')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getPlacesByFilter(city?: string, state?: string, category?: string, limit = 50) {
  const supabase = getSupabase();
  let query = supabase.from('places').select('*');

  if (city) query = query.ilike('address', `%${city}%`);
  // Note: state is often in address as well
  if (state) query = query.ilike('address', `%${state}%`);
  if (category) query = query.ilike('category', `%${category}%`);

  const { data, error } = await query
    .limit(limit)
    .order('last_updated', { ascending: false });

  if (error) throw error;
  return data;
}
