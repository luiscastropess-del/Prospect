'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import { 
  Search, 
  Database, 
  MapPin, 
  Loader2, 
  Globe, 
  Phone, 
  Clock, 
  ChevronRight,
  RefreshCcw,
  Star,
  Info,
  X,
  Map as MapIcon,
  Calendar,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Place {
  osm_id: string;
  name: string;
  category: string;
  address: string;
  opening_hours: string;
  phone: string;
  website: string;
  photo_url: string;
  rating: string;
  last_updated: string;
}

export default function ProspectorPage() {
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' | null }>({ text: '', type: null });

  const { data: places, mutate: refreshPlaces, isLoading: isLoadingPlaces } = useSWR<Place[]>('/api/places', fetcher);

  const filteredPlaces = useMemo(() => {
    if (!places) return [];
    return places.filter(p => 
      p.name.toLowerCase().includes(searchFilter.toLowerCase()) || 
      p.category.toLowerCase().includes(searchFilter.toLowerCase()) ||
      p.address.toLowerCase().includes(searchFilter.toLowerCase())
    );
  }, [places, searchFilter]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!city || !category) return;

    setIsSearching(true);
    setMessage({ text: '', type: null });

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, category }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ text: `${data.count} locais adicionados ao resultado!`, type: 'success' });
        refreshPlaces();
        await fetch('/api/result'); 
      } else {
        setMessage({ text: data.error || 'Erro ao prospectar', type: 'error' });
      }
    } catch (error) {
      setMessage({ text: 'Erro de conexão com o servidor', type: 'error' });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#212529] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
              <MapPin className="text-blue-600" />
              Prospector de Locais
            </h1>
            <p className="text-gray-500 mt-1">Busca inteligente e banco de dados local do OpenStreetMap.</p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => refreshPlaces()}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <RefreshCcw className={`w-4 h-4 ${isLoadingPlaces ? 'animate-spin text-blue-600' : ''}`} />
              Atualizar Banco
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Card 1: Busca */}
          <div className="lg:col-span-4 space-y-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
            >
              <div className="flex items-center gap-2 mb-6 text-gray-800">
                <Search className="w-5 h-5 text-blue-600" />
                <h2 className="font-semibold text-lg">Nova Prospecção</h2>
              </div>

              <form onSubmit={handleSearch} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                    Cidade
                  </label>
                  <input 
                    type="text" 
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ex: São Paulo"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                    Categoria
                  </label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                    required
                  >
                    <option value="">Selecione...</option>
                    <option value="Restaurante">Restaurante</option>
                    <option value="Hotel">Hotel</option>
                    <option value="Café">Café</option>
                    <option value="Mecânico">Mecânico</option>
                    <option value="Farmácia">Farmácia</option>
                    <option value="Supermercado">Supermercado</option>
                    <option value="Hospital">Hospital</option>
                    <option value="Escola">Escola</option>
                    <option value="Banco">Banco</option>
                    <option value="Academia">Academia</option>
                  </select>
                </div>

                <button 
                  type="submit" 
                  disabled={isSearching}
                  className={`w-full py-3 rounded-xl font-bold text-white transition-all transform active:scale-95 flex items-center justify-center gap-2 ${
                    isSearching ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20'
                  }`}
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Prospectando...
                    </>
                  ) : (
                    <>
                      <ChevronRight className="w-5 h-5" />
                      Prospectar Agora
                    </>
                  )}
                </button>
              </form>

              <AnimatePresence>
                {message.text && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`mt-4 p-3 rounded-lg text-sm flex items-start gap-2 ${
                      message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}
                  >
                    <Info className="w-4 h-4 mt-0.5" />
                    {message.text}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-600/20">
              <div className="flex justify-between items-center mb-4">
                <Database className="w-6 h-6 opacity-80" />
                <span className="text-xs bg-white/20 px-2 py-1 rounded-full font-medium">SQLite Ativo</span>
              </div>
              <p className="text-2xl font-bold">{places?.length || 0}</p>
              <p className="text-blue-100 text-sm">Locais no banco de dados</p>
            </div>
          </div>

          {/* Card 2: Banco de Locais */}
          <div className="lg:col-span-8">
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-blue-600" />
                    <h2 className="font-semibold text-lg">Banco de Locais</h2>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Filtrar por nome ou categoria..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-full md:w-64"
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 text-gray-500 text-xs font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Local</th>
                      <th className="px-6 py-4">Categoria</th>
                      <th className="px-6 py-4">Contato</th>
                      <th className="px-6 py-4">Status/Horário</th>
                      <th className="px-6 py-4">Avaliação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredPlaces.length > 0 ? (
                      filteredPlaces.map((place) => (
                        <tr 
                          key={place.osm_id} 
                          onClick={() => setSelectedPlace(place)}
                          className="hover:bg-gray-50 transition-colors group cursor-pointer"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {place.photo_url ? (
                                <img src={place.photo_url} alt={place.name} className="w-10 h-10 rounded-lg object-cover bg-gray-100 flex-shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                  <MapPin className="w-5 h-5 text-gray-400" />
                                </div>
                              )}
                              <div className="max-w-[200px]">
                                <p className="font-semibold text-gray-900 truncate">{place.name}</p>
                                <p className="text-xs text-gray-500 truncate" title={place.address}>{place.address}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                              {place.category}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-gray-600 mb-1">
                              <Phone className="w-3.5 h-3.5" />
                              <span className="text-xs">{place.phone}</span>
                            </div>
                            {place.website !== 'Não informado' ? (
                              <a 
                                href={place.website.startsWith('http') ? place.website : `https://${place.website}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-blue-600 hover:underline text-xs"
                              >
                                <Globe className="w-3.5 h-3.5" />
                                Website
                              </a>
                            ) : (
                              <div className="flex items-center gap-2 text-gray-400 text-xs">
                                <Globe className="w-3.5 h-3.5" />
                                Não possui
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-gray-600">
                              <Clock className="w-3.5 h-3.5" />
                              <span className="text-xs truncate max-w-[120px]" title={place.opening_hours}>
                                {place.opening_hours}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">
                              Atualizado em: {format(new Date(place.last_updated), 'dd/MM/yy', { locale: ptBR })}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                              <span className="font-bold text-gray-900">{place.rating}</span>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                          {isLoadingPlaces ? (
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                              <p>Carregando banco...</p>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <Database className="w-8 h-8 opacity-20" />
                              <p>Nenhum local encontrado no banco.</p>
                              <p className="text-xs">Tente realizar uma prospecção acima.</p>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
      
      <footer className="max-w-7xl mx-auto mt-12 pt-8 border-t border-gray-200 text-center text-gray-400 text-sm">
        <p>&copy; 2024 Prospector de Locais • Dados via OpenStreetMap (Overpass API)</p>
        <p className="text-xs mt-1">Otimizado para execução leve em infraestrutura e2-micro.</p>
      </footer>

      {/* Modal de Detalhes */}
      <AnimatePresence>
        {selectedPlace && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPlace(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="relative h-64 sm:h-80 bg-gray-200">
                {selectedPlace.photo_url ? (
                  <img 
                    src={selectedPlace.photo_url} 
                    alt={selectedPlace.name} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <MapPin className="w-16 h-16 text-gray-300" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <button 
                  onClick={() => setSelectedPlace(null)}
                  className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full transition-all backdrop-blur-md"
                >
                  <X className="w-6 h-6" />
                </button>
                <div className="absolute bottom-6 left-6 right-6 text-white">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-600 text-white uppercase tracking-wider">
                      {selectedPlace.category}
                    </span>
                    <div className="flex items-center gap-1 bg-amber-500 px-2 py-1 rounded-full text-xs font-bold">
                      <Star className="w-3 h-3 fill-white" />
                      {selectedPlace.rating}
                    </div>
                  </div>
                  <h2 className="text-3xl font-bold leading-tight">{selectedPlace.name}</h2>
                </div>
              </div>

              <div className="p-6 sm:p-8 overflow-y-auto space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <MapIcon className="w-4 h-4" /> Localização
                      </h3>
                      <p className="text-gray-800 font-medium leading-relaxed">
                        {selectedPlace.address}
                      </p>
                    </div>

                    <div>
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Phone className="w-4 h-4" /> Contato
                      </h3>
                      <p className="text-gray-800 font-medium">
                        {selectedPlace.phone}
                      </p>
                      {selectedPlace.website !== 'Não informado' && (
                        <a 
                          href={selectedPlace.website.startsWith('http') ? selectedPlace.website : `https://${selectedPlace.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-blue-600 hover:underline mt-2 font-medium"
                        >
                          <Globe className="w-4 h-4" />
                          Visitar Website
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Clock className="w-4 h-4" /> Horário de Funcionamento
                      </h3>
                      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                        <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">
                          {selectedPlace.opening_hours}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Calendar className="w-4 h-4" /> Última Atualização
                      </h3>
                      <p className="text-gray-600 text-sm">
                        Dados sincronizados em {format(new Date(selectedPlace.last_updated), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100">
                  <div className="bg-blue-50 p-4 rounded-2xl flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                    <p className="text-sm text-blue-800 leading-relaxed">
                      ID do OpenStreetMap: <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono text-xs">{selectedPlace.osm_id}</code>. 
                      Estes dados são coletados publicamente e podem variar de acordo com a contribuição da comunidade.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
