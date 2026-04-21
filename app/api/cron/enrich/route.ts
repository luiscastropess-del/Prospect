import { NextResponse } from 'next/server';
import { getPlacesNeedsEnrichment, upsertPlaces } from '@/lib/db';
import { GoogleGenAI, Type } from "@google/genai";

export const dynamic = 'force-dynamic';

export async function GET() {
  return handleEnrichCron();
}

export async function POST() {
  return handleEnrichCron();
}

async function handleEnrichCron() {
  const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!geminiApiKey) {
    return NextResponse.json({ error: 'Chave do Gemini não configurada.' }, { status: 500 });
  }

  try {
    // 1. Buscar 5 locais que precisam de atualização
    const placesToEnrich = await getPlacesNeedsEnrichment(5);

    if (!placesToEnrich || placesToEnrich.length === 0) {
      return NextResponse.json({ message: 'Nenhum local precisando de enriquecimento no momento.' });
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const results = [];

    for (const place of placesToEnrich) {
      try {
        // Enriquecimento usando Gemini Flash Lite (mais estável para automação)
        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite-preview",
          contents: `
            Encontre informações detalhadas para o estabelecimento:
            Nome: ${place.name}
            Endereço: ${place.address}
            Categoria: ${place.category}
            
            Retorne JSON: zip_code, description (min 200 char), opening_hours, phone, website, logo_url, rating.
          `,
          config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                zip_code: { type: Type.STRING },
                description: { type: Type.STRING },
                opening_hours: { type: Type.STRING },
                phone: { type: Type.STRING },
                website: { type: Type.STRING },
                logo_url: { type: Type.STRING },
                rating: { type: Type.STRING },
              },
              required: ["description"]
            }
          }
        });

        const aiData = JSON.parse(response.text);
        
        const updatedPlace = {
          ...place,
          zip_code: aiData.zip_code || place.zip_code,
          description: aiData.description || place.description,
          opening_hours: aiData.opening_hours || place.opening_hours,
          phone: aiData.phone || place.phone,
          website: aiData.website || place.website,
          logo_url: aiData.logo_url || place.logo_url,
          rating: aiData.rating || place.rating,
          last_updated: new Date().toISOString()
        };

        // Salvar no banco
        await upsertPlaces([updatedPlace]);
        results.push(updatedPlace);

      } catch (e) {
        console.error(`Erro ao enriquecer ${place.name}:`, e);
        // Mesmo com erro, adicionamos o original para a API Final
        results.push(place);
      }
    }

    // Encaminhar para a API Final
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      await fetch(`${baseUrl}/api/final`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'cron-enrichment', places: results }),
      });
    } catch (finalError) {
      console.error('Erro ao encaminhar para API Final:', finalError);
    }

    return NextResponse.json({ 
      status: 'success', 
      processed: results.length,
      updated_ids: results.map(r => r.osm_id)
    });

  } catch (error: any) {
    console.error('Erro na Cron de Enriquecimento:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
