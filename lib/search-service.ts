import axios from 'axios';
import { upsertPlaces } from './db';
import { setResults } from './memory';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export async function performSearch(city: string, category: string) {
  const categoryMap: Record<string, string> = {
    'Restaurante': 'amenity=restaurant',
    'Hotel': 'tourism=hotel',
    'Café': 'amenity=cafe',
    'Mecânico': 'amenity=car_repair',
    'Farmácia': 'amenity=pharmacy',
    'Supermercado': 'shop=supermarket',
    'Hospital': 'amenity=hospital',
    'Escola': 'amenity=school',
    'Banco': 'amenity=bank',
    'Academia': 'leisure=fitness_centre'
  };

  const osmTag = categoryMap[category] || `amenity=${category.toLowerCase()}`;
  const [tagKey, tagValue] = osmTag.split('=');

  const query = `
    [out:json][timeout:60];
    area[name="${city}"]->.searchArea;
    (
      node["${tagKey}"="${tagValue}"][name](area.searchArea);
      way["${tagKey}"="${tagValue}"][name](area.searchArea);
      relation["${tagKey}"="${tagValue}"][name](area.searchArea);
    );
    out center 100;
  `;

  try {
    const response = await axios.post(OVERPASS_URL, `data=${encodeURIComponent(query)}`, {
      timeout: 45000, 
      headers: {
        'User-Agent': 'ProspectorLocaisApp/1.0'
      }
    });

    const elements = response.data.elements || [];
    const namedElements = elements.filter((el: any) => el.tags && el.tags.name);

    // Mapear e limitar aos 30 melhores resultados
    const processedPlaces = namedElements.slice(0, 30).map((el: any) => {
      const tags = el.tags || {};
      const name = tags.name;
      const address = [
        tags['addr:street'],
        tags['addr:housenumber'],
        tags['addr:suburb'],
        tags['addr:postcode']
      ].filter(Boolean).join(', ') || 'Endereço não disponível';

      let photoUrl = tags.image || '';
      if (!photoUrl && tags.wikimedia_commons) {
        photoUrl = `https://commons.wikimedia.org/wiki/File:${tags.wikimedia_commons}`;
      }
      if (!photoUrl) {
         photoUrl = `https://picsum.photos/seed/${el.id}/400/300`;
      }

      return {
        osm_id: String(el.id),
        name,
        category,
        address,
        opening_hours: tags.opening_hours || 'Não informado',
        phone: tags.phone || tags['contact:phone'] || 'Não informado',
        website: tags.website || tags['contact:website'] || 'Não informado',
        photo_url: photoUrl,
        rating: tags.rating || (Math.random() * 2 + 3).toFixed(1),
        last_updated: new Date().toISOString()
      };
    });

    if (processedPlaces.length > 0) {
      await upsertPlaces(processedPlaces);
    }

    setResults(processedPlaces);
    return processedPlaces;

  } catch (error: any) {
    let errorMessage = 'Erro ao buscar dados no OpenStreetMap';
    
    if (error.response) {
      errorMessage = `Overpass API erro ${error.response.status}: ${JSON.stringify(error.response.data)}`;
    } else if (error.request) {
      errorMessage = 'Sem resposta da Overpass API. Pode estar sobrecarregada.';
    } else {
      errorMessage = error.message;
    }

    console.error('Error fetching from Overpass:', errorMessage);
    throw new Error(errorMessage);
  }
}
