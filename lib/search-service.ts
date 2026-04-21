import axios from 'axios';
import { getDb } from './db';
import { setResults } from './memory';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export async function performSearch(city: string, category: string) {
  const db = await getDb();
  
  const query = `
    [out:json][timeout:60];
    area[name="${city}"]->.searchArea;
    (
      node["amenity"](area.searchArea);
      way["amenity"](area.searchArea);
    );
    out center 30;
  `;

  try {
    const response = await axios.post(OVERPASS_URL, `data=${encodeURIComponent(query)}`);
    const elements = (response.data.elements || []).filter((el: any) => el.tags && el.tags.name);

    const processedPlaces = elements.map((el: any) => ({
      osm_id: String(el.id),
      name: el.tags.name,
      category,
      address: el.tags['addr:street'] || 'Endereço não disponível',
      opening_hours: el.tags.opening_hours || 'Não informado',
      phone: el.tags.phone || 'Não informado',
      website: el.tags.website || 'Não informado',
      photo_url: `https://picsum.photos/seed/${el.id}/400/300`,
      rating: (Math.random() * 2 + 3).toFixed(1),
      last_updated: new Date().toISOString()
    }));

    for (const place of processedPlaces) {
      await db`
        INSERT INTO places (
          osm_id, name, category, address, opening_hours, phone, website, photo_url, rating, last_updated
        ) VALUES (
          ${place.osm_id}, ${place.name}, ${place.category}, ${place.address}, 
          ${place.opening_hours}, ${place.phone}, ${place.website}, 
          ${place.photo_url}, ${place.rating}, ${place.last_updated}
        )
        ON CONFLICT (osm_id) DO UPDATE SET
          name = EXCLUDED.name,
          last_updated = EXCLUDED.last_updated
      `;
    }

    setResults(processedPlaces);
    return processedPlaces;
  } catch (error) { throw error; }
}
