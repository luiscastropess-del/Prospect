import { NextResponse } from 'next/server';
import { performSearch } from '@/lib/search-service';

export const dynamic = 'force-dynamic';

const CITIES = [
  'São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Porto Alegre',
  'Salvador', 'Fortaleza', 'Brasília', 'Manaus', 'Recife',
  'Goiânia', 'Belém', 'São Luís', 'Maceió', 'Natal',
  'Teresina', 'João Pessoa', 'Campo Grande', 'Cuiabá', 'Aracaju'
];

const CATEGORIES = [
  'Restaurante', 'Hotel', 'Café', 'Mecânico', 'Farmácia',
  'Supermercado', 'Hospital', 'Escola', 'Banco', 'Academia'
];

export async function GET() {
  return handleCron();
}

export async function POST() {
  return handleCron();
}

async function handleCron() {
  try {
    const randomCity = CITIES[Math.floor(Math.random() * CITIES.length)];
    const randomCategory = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];

    console.log(`Cron logic running: ${randomCity} - ${randomCategory}`);
    const results = await performSearch(randomCity, randomCategory);
    
    return NextResponse.json({ 
      status: 'success', 
      city: randomCity, 
      category: randomCategory, 
      count: results.length 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
