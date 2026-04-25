-- Comandos SQL para configurar o banco de dados no Supabase

-- 1. Tabela de Locais (caso não exista ou precise atualizar)
CREATE TABLE IF NOT EXISTS public.places (
    osm_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    address TEXT,
    zip_code TEXT,
    opening_hours TEXT,
    phone TEXT,
    website TEXT,
    photo_url TEXT,
    logo_url TEXT,
    rating TEXT,
    description TEXT,
    gallery_urls TEXT[], -- Array de URLs para a galeria
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    google_maps_url TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabela de Endpoints Customizados
CREATE TABLE IF NOT EXISTS public.endpoints (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    city TEXT,
    state TEXT,
    category TEXT,
    results_limit INTEGER DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Habilitar RLS (Row Level Security) se desejar, ou deixar público para anon key (padrão do app)
-- ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.endpoints ENABLE ROW LEVEL SECURITY;

-- Exemplo de política de acesso total para anon key (simplificado para o applet)
-- CREATE POLICY "Allow all for anon" ON public.places FOR ALL USING (true);
-- CREATE POLICY "Allow all for anon" ON public.endpoints FOR ALL USING (true);
