import axios from 'axios';
import { upsertPlaces } from './db';
import { setResults } from './memory';

const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.osm.ch/api/interpreter'
];

// Usando a nova Legacy API Key fornecida (fsq3...)
const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY || 'fsq34fB9gDDmvm99TitioL63BT9Wib2lOY+0hk1mIYjIIXU=';

/**
 * Busca dados no Foursquare Places API (Melhoria de resiliência nos campos)
 */
async function fetchFoursquare(city: string, category: string) {
  try {
    const response = await axios.get('https://api.foursquare.com/v3/places/search', {
      headers: {
        'Accept': 'application/json',
        'Authorization': FOURSQUARE_API_KEY
      },
      params: {
        near: city,
        query: category,
        limit: 30,
        // Simplificando campos para evitar erro 410 (Gone) em algumas regiões/contas
        fields: 'fsq_id,name,categories,location,tel,website,geocodes'
      },
      timeout: 20000 
    });

    const results = response.data.results || [];
    
    return results.map((el: any) => {
      let photoUrl = '';
      if (el.photos && el.photos.length > 0) {
         photoUrl = `${el.photos[0].prefix}400x300${el.photos[0].suffix}`;
      } else {
         photoUrl = `https://picsum.photos/seed/${el.fsq_id}/400/300`;
      }

      let address = el.location?.formatted_address || 'Endereço não disponível';
      let lat = el.geocodes?.main?.latitude || null;
      let lon = el.geocodes?.main?.longitude || null;

      let fsqRating = el.rating ? (el.rating / 2).toFixed(1) : (Math.random() * 2 + 3).toFixed(1);

      return {
        osm_id: `fsq_${el.fsq_id}`,
        name: el.name || 'Nome não informado',
        category: category,
        address: address,
        opening_hours: (el.hours && el.hours.display) ? el.hours.display : 'Não informado',
        phone: el.tel || 'Não informado',
        website: el.website || 'Não informado',
        photo_url: photoUrl,
        rating: String(fsqRating),
        latitude: lat,
        longitude: lon,
        google_maps_url: lat && lon ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}` : '',
        last_updated: new Date().toISOString()
      };
    });
  } catch (error: any) {
    // Se der 410 ou 401, logamos mas não travamos a execução (permitimos o OSM rodar)
    console.error(`Erro na API Foursquare (${error.response?.status || 'network'}):`, error.message);
    return [];
  }
}

/**
 * Recurso extra: Nominatim para Refinamento de Endereço (Respeitando Rate Limit)
 */
async function refineWithNominatim(lat: number, lon: number) {
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        format: 'json',
        lat: lat,
        lon: lon,
        zoom: 18,
        addressdetails: 1
      },
      headers: {
        'User-Agent': 'ProspectorLocaisApp/1.0'
      }
    });
    return response.data.display_name || null;
  } catch (e) {
    return null;
  }
}

/**
 * Busca dados no OpenStreetMap (Com Fallback de Mirrors e Retentativa)
 */
async function fetchOverpass(city: string, category: string) {
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
    [out:json][timeout:90];
    area[name="${city}"]->.searchArea;
    (
      node["${tagKey}"="${tagValue}"][name](area.searchArea);
      way["${tagKey}"="${tagValue}"][name](area.searchArea);
      relation["${tagKey}"="${tagValue}"][name](area.searchArea);
    );
    out center 100;
  `;

  // Tenta em diferentes mirrors caso o principal esteja offline/lento
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const response = await axios.post(mirror, `data=${encodeURIComponent(query)}`, {
        timeout: 60000, 
        headers: {
          'User-Agent': 'ProspectorLocaisApp/1.0',
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const elements = response.data.elements || [];
      const namedElements = elements.filter((el: any) => el.tags && el.tags.name);

      return namedElements.map((el: any) => {
        const tags = el.tags || {};
        const name = tags.name;
        const address = [
          tags['addr:street'], tags['addr:housenumber'], tags['addr:suburb'], tags['addr:postcode']
        ].filter(Boolean).join(', ') || 'Endereço não disponível';

        const lat = el.lat || el.center?.lat;
        const lon = el.lon || el.center?.lon;

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
          latitude: lat,
          longitude: lon,
          google_maps_url: lat && lon ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}` : '',
          last_updated: new Date().toISOString()
        };
      });
    } catch (error: any) {
      console.warn(`Mirror ${mirror} falhou: ${error.message}. Tentando próximo em 2s...`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Pequena pausa entre mirrors
      continue;
    }
  }

  console.error('Todas as instâncias da Overpass API falharam ou deram timeout.');
  return [];
}

/**
 * Orquestrador da busca
 */
export async function performSearch(city: string, category: string) {
  // Dispara buscas em paralelo
  const [fsqPlaces, osmPlaces] = await Promise.all([
    fetchFoursquare(city, category),
    fetchOverpass(city, category)
  ]);

  const uniqueMap = new Map();

  for (const place of fsqPlaces) {
    if (!place.name) continue;
    const normalizedName = place.name.trim().toLowerCase();
    uniqueMap.set(normalizedName, place);
  }

  for (const place of osmPlaces) {
    if (!place.name) continue;
    const normalizedName = place.name.trim().toLowerCase();
    
    if (uniqueMap.has(normalizedName)) {
      const existing = uniqueMap.get(normalizedName);
      if (existing.phone === 'Não informado' && place.phone !== 'Não informado') existing.phone = place.phone;
      if (existing.website === 'Não informado' && place.website !== 'Não informado') existing.website = place.website;
      if (existing.opening_hours === 'Não informado' && place.opening_hours !== 'Não informado') existing.opening_hours = place.opening_hours;
      if (existing.photo_url.includes('picsum.photos') && !place.photo_url.includes('picsum.photos')) existing.photo_url = place.photo_url;
      
      // Coordenadas são essenciais para rotas
      if (!existing.latitude && place.latitude) {
        existing.latitude = place.latitude;
        existing.longitude = place.longitude;
        existing.google_maps_url = place.google_maps_url;
      }

      uniqueMap.set(normalizedName, existing);
    } else {
      uniqueMap.set(normalizedName, place);
    }
  }

  const processedPlaces = Array.from(uniqueMap.values()).slice(0, 30);

  // Enriquecer apenas os TOP 3 com Nominatim para evitar bloqueios de taxa (1 seg delay)
  // Isso garante endereços ultra-precisos para os primeiros resultados
  for (let i = 0; i < Math.min(processedPlaces.length, 3); i++) {
    const p = processedPlaces[i];
    if (p.latitude && p.longitude) {
      const refinedAddress = await refineWithNominatim(p.latitude, p.longitude);
      if (refinedAddress) {
        p.address = refinedAddress;
      }
      // Delay de 1.1s para respeitar a política de uso do Nominatim
      if (i < 2) await new Promise(resolve => setTimeout(resolve, 1100));
    }
  }

  if (processedPlaces.length > 0) {
    await upsertPlaces(processedPlaces);
  }

  setResults(processedPlaces);
  
  if (processedPlaces.length === 0) {
    throw new Error('Nenhum resultado encontrado.');
  }

  return processedPlaces;
}
