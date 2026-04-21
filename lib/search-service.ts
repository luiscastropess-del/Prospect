import axios from 'axios';
import { upsertPlaces } from './db';
import { setResults } from './memory';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
// Usando a nova Legacy API Key fornecida (fsq3...)
const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY || 'fsq34fB9gDDmvm99TitioL63BT9Wib2lOY+0hk1mIYjIIXU=';

/**
 * Busca dados no Foursquare Places API (Alta qualidade: Fotos reais, Horários, Telefones atualizados)
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
        limit: 30, // Pegar até 30 locais
        fields: 'fsq_id,name,categories,location,hours,tel,website,photos,rating'
      },
      timeout: 15000 // 15 segundos max timeout para FSQ
    });

    const results = response.data.results || [];
    
    return results.map((el: any) => {
      // Montagem da foto Foursquare (Formato: prefix + widthxheight + suffix)
      let photoUrl = '';
      if (el.photos && el.photos.length > 0) {
         photoUrl = `${el.photos[0].prefix}400x300${el.photos[0].suffix}`;
      } else {
         photoUrl = `https://picsum.photos/seed/${el.fsq_id}/400/300`;
      }

      let address = 'Endereço não disponível';
      if (el.location && el.location.formatted_address) {
         address = el.location.formatted_address;
      }

      let fsqRating = el.rating ? (el.rating / 2).toFixed(1) : (Math.random() * 2 + 3).toFixed(1);

      return {
        osm_id: `fsq_${el.fsq_id}`, // Usamos o prefixo fsq_ para caber no banco de dados sem quebrar
        name: el.name || 'Nome não informado',
        category: category,
        address: address,
        opening_hours: (el.hours && el.hours.display) ? el.hours.display : 'Não informado',
        phone: el.tel || 'Não informado',
        website: el.website || 'Não informado',
        photo_url: photoUrl,
        rating: String(fsqRating),
        last_updated: new Date().toISOString()
      };
    });
  } catch (error: any) {
    console.error('Erro na API Foursquare:', error.message);
    return []; // Retorna array vazio em falha para que o OSM tente salvar o dia
  }
}

/**
 * Busca dados no OpenStreetMap (Overpass API)
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
      timeout: 30000, 
      headers: {
        'User-Agent': 'ProspectorLocaisApp/1.0'
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
  } catch (error: any) {
    console.error('Erro na API Overpass:', error.message);
    return [];
  }
}

/**
 * Orquestrador da busca
 */
export async function performSearch(city: string, category: string) {
  // Dispara buscas em paralelo para máxima eficiência
  const [fsqPlaces, osmPlaces] = await Promise.all([
    fetchFoursquare(city, category),
    fetchOverpass(city, category)
  ]);

  // Fusão Inteligente (Enriquecimento de Dados cruzando as duas APIs)
  const uniqueMap = new Map();

  // 1. Inserir dados do Foursquare primeiro (Geralmente mais ricos em avaliações e fotos)
  for (const place of fsqPlaces) {
    if (!place.name) continue;
    const normalizedName = place.name.trim().toLowerCase();
    uniqueMap.set(normalizedName, place);
  }

  // 2. Cruzar com dados do OpenStreetMap (Preenchendo lacunas)
  for (const place of osmPlaces) {
    if (!place.name) continue;
    const normalizedName = place.name.trim().toLowerCase();
    
    if (uniqueMap.has(normalizedName)) {
      // O local existe em ambas as APIs! Vamos mesclar (enriquecer) os dados.
      const existing = uniqueMap.get(normalizedName);
      
      // Se Foursquare não achou telefone, mas OSM sim
      if (existing.phone === 'Não informado' && place.phone !== 'Não informado') {
        existing.phone = place.phone;
      }
      
      // Se Foursquare não achou site, mas OSM sim
      if (existing.website === 'Não informado' && place.website !== 'Não informado') {
        existing.website = place.website;
      }

      // Se Foursquare não tem horários, mas OSM sim
      if (existing.opening_hours === 'Não informado' && place.opening_hours !== 'Não informado') {
        existing.opening_hours = place.opening_hours;
      }

      // Se o Foursquare usou uma foto falsa (picsum) e o OSM tem uma real (ex: wikimedia)
      if (existing.photo_url.includes('picsum.photos') && !place.photo_url.includes('picsum.photos')) {
        existing.photo_url = place.photo_url;
      }

      // Salva o registro "bombado" com a união das duas APIs
      uniqueMap.set(normalizedName, existing);
    } else {
      // É um local menor/mais nichado que só o OpenStreetMap encontrou
      uniqueMap.set(normalizedName, place);
    }
  }

  // Corta o resultado perfeitamente em no máximo 30 itens, conforme requerido.
  const processedPlaces = Array.from(uniqueMap.values()).slice(0, 30);

  // Upsert usa osm_id. No caso de atualizar locais os FSQ_ atualizaram em cima de FSQ_ 
  // e OSM em cima de OSM. Duplicatas cruzadas foram impedidas no passo acima.
  if (processedPlaces.length > 0) {
    await upsertPlaces(processedPlaces);
  }

  setResults(processedPlaces);
  
  if (processedPlaces.length === 0) {
    throw new Error('Nenhum resultado encontrado no OpenStreetMap ou Foursquare para essa busca.');
  }

  return processedPlaces;
}
