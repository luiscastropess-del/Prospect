import axios from 'axios';
import { getDb } from './db';
import { setResults } from './memory';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export async function performSearch(city: string, category: string) {
  const db = await getDb();

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
    );
    out center 30;
  `;

  try {
    const response = await axios.post(OVERPASS_URL, `data=${encodeURIComponent(query)}`);
    const elements = response.data.elements || [];

    // Filter to only include elements that have a name tag
    const namedElements = elements.filter((el: any) => el.tags && el.tags.name);

    const processedPlaces = namedElements.map((el: any) => {
      const tags = el.tags || {};
      const name = tags.name;
      // Try to construct address
      const address = [
        tags['addr:street'],
        tags['addr:housenumber'],
        tags['addr:suburb'],
        tags['addr:postcode']
      ].filter(Boolean).join(', ') || 'Endereço não disponível';

      // Photourl attempt
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

    // Save to DB
    for (const place of processedPlaces) {
      await db.run(`
        INSERT INTO places (osm_id, name, category, address, opening_hours, phone, website, photo_url, rating, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(osm_id) DO UPDATE SET
          name=excluded.name,
          category=excluded.category,
          address=excluded.address,
          opening_hours=excluded.opening_hours,
          phone=excluded.phone,
          website=excluded.website,
          photo_url=excluded.photo_url,
          rating=excluded.rating,
          last_updated=excluded.last_updated
      `, [
        place.osm_id,
        place.name,
        place.category,
        place.address,
        place.opening_hours,
        place.phone,
        place.website,
        place.photo_url,
        place.rating,
        place.last_updated
      ]);
    }

    setResults(processedPlaces);
    return processedPlaces;

  } catch (error) {
    console.error('Error fetching from Overpass:', error);
    throw error;
  }
}
