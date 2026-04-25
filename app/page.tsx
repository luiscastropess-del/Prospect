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
  ExternalLink,
  Settings,
  Trash2,
  Filter,
  ListChecks,
  Zap,
  CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI, Type } from "@google/genai";

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Removendo inicialização global para evitar erro de detecção de chave no build/load inicial

interface Place {
  osm_id: string;
  name: string;
  category: string;
  address: string;
  zip_code?: string;
  opening_hours: string;
  phone: string;
  website: string;
  photo_url: string;
  logo_url?: string;
  rating: string;
  description?: string;
  gallery_urls?: string[];
  reviews?: {author: string, text: string}[];
  latitude?: number;
  longitude?: number;
  google_maps_url?: string;
  last_updated: string;
}

export default function ProspectorPage() {
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [enrichModel, setEnrichModel] = useState<'gemini-flash-latest' | 'gemini-3.1-pro-preview' | 'gemini-3.1-flash-lite-preview'>('gemini-flash-latest');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' | null }>({ text: '', type: null });
  const [isRestoring, setIsRestoring] = useState(false);
  const [isManagementOpen, setIsManagementOpen] = useState(false);
  const [selectedPlacesIds, setSelectedPlacesIds] = useState<string[]>([]);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, status: '' });
  const [isBulkRunning, setIsBulkRunning] = useState(false);

  const { data: placesData, mutate: refreshPlaces, isLoading: isLoadingPlaces } = useSWR<any>('/api/places', fetcher);

  const places = useMemo(() => {
    return Array.isArray(placesData) ? placesData as Place[] : [];
  }, [placesData]);

  const filteredPlaces = useMemo(() => {
    return places.filter(p => 
      p.name.toLowerCase().includes(searchFilter.toLowerCase()) || 
      p.category.toLowerCase().includes(searchFilter.toLowerCase()) ||
      p.address.toLowerCase().includes(searchFilter.toLowerCase())
    );
  }, [places, searchFilter]);

  const handleRestore = async () => {
    setIsRestoring(true);
    setMessage({ text: '', type: null });
    try {
      const res = await fetch('/api/result/restore', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setMessage({ text: data.message || 'Restaurado com sucesso!', type: 'success' });
      } else {
        setMessage({ text: data.error || 'Erro ao restaurar', type: 'error' });
      }
    } catch (error) {
      setMessage({ text: 'Erro de conexão com o servidor', type: 'error' });
    } finally {
      setIsRestoring(false);
    }
  };

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

  const handleEnrich = async (id: string) => {
    if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      setMessage({ text: 'Chave do Gemini não configurada. Verifique o seu .env.', type: 'error' });
      return;
    }

    setIsEnriching(true);
    setMessage({ text: '', type: null });

    try {
      // Inicializa aqui para garantir que a chave foi lida do ambiente
      const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!geminiApiKey) throw new Error('API Key do Gemini não encontrada no ambiente.');
      
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });

      // 1. Localizar o local no estado atual
      const placeToEnrich = filteredPlaces.find(p => p.osm_id === id);
      if (!placeToEnrich) throw new Error('Local não encontrado no estado local.');

      // 2. Chamada direta ao modelo selecionado (Client-side)
      const response = await ai.models.generateContent({
        model: enrichModel,
        contents: `
          Analise o estabelecimento localizado no BRASIL e encontre as informações completas no Google Places:
          Nome: ${placeToEnrich.name}
          Endereço: ${placeToEnrich.address}
          Categoria: ${placeToEnrich.category}
          
          Use a pesquisa do Google para encontrar obrigatoriamente no GOOGLE PLACES:
          - Endereço completo com Cidade, Estado e CEP (CEP/ZIP CODE).
          - Descrição detalhada (mínimo 200 caracteres).
          - Horário de funcionamento preciso.
          - Website e Telefone oficiais.
          - Logo/Imagem de Perfil oficial (logo_url).
          - 5 URLs de fotos reais da galeria do local (gallery_urls).
          - 5 comentários reais de clientes.
          - Avaliação média.
          
          Se o local não for no Brasil, ignore e retorne JSON vazio.
        `,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              full_address: { type: Type.STRING },
              city: { type: Type.STRING },
              state: { type: Type.STRING },
              zip_code: { type: Type.STRING },
              description: { type: Type.STRING },
              opening_hours: { type: Type.STRING },
              phone: { type: Type.STRING },
              website: { type: Type.STRING },
              logo_url: { type: Type.STRING },
              rating: { type: Type.STRING },
              gallery_urls: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING } 
              },
              reviews: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    author: { type: Type.STRING },
                    text: { type: Type.STRING }
                  },
                  required: ["author", "text"]
                }
              }
            },
            required: ["full_address", "city", "state", "zip_code", "description", "logo_url", "gallery_urls"]
          }
        }
      });

      const aiText = response.text;
      if (!aiText) throw new Error('A IA não retornou dados válidos.');
      const aiData = JSON.parse(aiText);

      if (!aiData.city || !aiData.state || !aiData.zip_code) {
        throw new Error('A IA não conseguiu encontrar o endereço completo (Cidade, Estado, CEP) no Brasil.');
      }

      // 3. Mesclar dados e salvar no banco via API segura
      const enrichedPlace = {
        ...placeToEnrich,
        address: aiData.full_address || placeToEnrich.address,
        zip_code: aiData.zip_code || placeToEnrich.zip_code,
        description: aiData.description || placeToEnrich.description,
        opening_hours: aiData.opening_hours || placeToEnrich.opening_hours,
        phone: aiData.phone || placeToEnrich.phone,
        website: aiData.website || placeToEnrich.website,
        logo_url: aiData.logo_url || placeToEnrich.logo_url,
        gallery_urls: aiData.gallery_urls || [],
        reviews: aiData.reviews || [],
        rating: aiData.rating || placeToEnrich.rating,
        last_updated: new Date().toISOString()
      };

      const saveRes = await fetch('/api/places/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ places: [enrichedPlace] }),
      });

      if (saveRes.ok) {
        // Encaminhar para a API Final
        try {
          await fetch('/api/final', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: 'manual-enrichment', places: [enrichedPlace] }),
          });
        } catch (e) {
          console.warn('Erro ao encaminhar para API Final:', e);
        }

        setMessage({ text: 'Local enriquecido com IA Pro e salvo com sucesso!', type: 'success' });
        refreshPlaces();
        setSelectedPlace(enrichedPlace);
      } else {
        const errorData = await saveRes.json();
        throw new Error(errorData.error || 'Erro ao salvar dados enriquecidos.');
      }
    } catch (error: any) {
      console.error('Erro no enriquecimento IA:', error);
      setMessage({ text: `Falha na IA: ${error.message}`, type: 'error' });
    } finally {
      setIsEnriching(false);
    }
  };

  const handleSpeechSummary = async (place: Place) => {
    const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!geminiApiKey) {
      setMessage({ text: 'API Key do Gemini não encontrada.', type: 'error' });
      return;
    }

    setIsSummarizing(true);
    try {
      const { GoogleGenAI, Modality } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });

      const prompt = `Crie um briefing curto e amigável para um vendedor que vai visitar este local:
      Nome: ${place.name}
      Categoria: ${place.category}
      Endereço: ${place.address}
      Destaque: ${place.description || 'Localizado em ' + place.address}
      Avaliação: ${place.rating} estrelas.
      Fale em Português do Brasil com entonação profissional.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          // @ts-ignore - Modality may not be in types but is supported
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      // @ts-ignore
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const binaryString = window.atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // As it's 16-bit PCM Mono, we need to convert to Float32 for AudioContext
        const pcmData = new Int16Array(bytes.buffer);
        const floatData = new Float32Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) {
          floatData[i] = pcmData[i] / 32768.0;
        }

        const audioBuffer = audioContext.createBuffer(1, floatData.length, 24000);
        audioBuffer.getChannelData(0).set(floatData);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start();
      }
    } catch (error: any) {
      console.error('Erro no Speech:', error);
      setMessage({ text: 'Falha ao gerar áudio: ' + error.message, type: 'error' });
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleBulkEnrich = async () => {
    const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!geminiApiKey) {
      setMessage({ text: 'API Key do Gemini não encontrada.', type: 'error' });
      return;
    }

    if (selectedPlacesIds.length === 0) return;

    // Limite de 5 se não for o modelo Lite para evitar erros de cota (conforme solicitado)
    let placesToProcess = selectedPlacesIds;
    if (enrichModel !== 'gemini-3.1-flash-lite-preview' && placesToProcess.length > 5) {
      placesToProcess = placesToProcess.slice(0, 5);
      setMessage({ text: 'Limite de 5 locais por vez aplicado para este modelo de IA.', type: 'error' });
    }

    setIsBulkRunning(true);
    setBulkProgress({ current: 0, total: placesToProcess.length, status: 'Iniciando fila...' });

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    try {
      for (let i = 0; i < placesToProcess.length; i++) {
        const id = placesToProcess[i];
        const place = places.find(p => p.osm_id === id);
        if (!place) continue;

        setBulkProgress(prev => ({ ...prev, current: i + 1, status: `Enriquecendo: ${place.name}` }));

        const response = await ai.models.generateContent({
          model: enrichModel,
          contents: `
            Analise o estabelecimento localizado no BRASIL e encontre as informações completas no GOOGLE PLACES:
            Nome: ${place.name}
            Endereço: ${place.address}
            Categoria: ${place.category}
            
            Retorne um JSON completo incluindo Cidade, Estado e CEP (CEP/ZIP CODE).
            Obtenha obrigatoriamente:
            - Logo/Imagem de perfil (logo_url)
            - 5 imagens reais da galeria (gallery_urls)
            - Descrição detalhada
            - Contatos e Horários
            
            Se o local não for no Brasil, ignore.
          `,
          config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                full_address: { type: Type.STRING },
                city: { type: Type.STRING },
                state: { type: Type.STRING },
                zip_code: { type: Type.STRING },
                description: { type: Type.STRING },
                opening_hours: { type: Type.STRING },
                phone: { type: Type.STRING },
                website: { type: Type.STRING },
                logo_url: { type: Type.STRING },
                rating: { type: Type.STRING },
                gallery_urls: { 
                  type: Type.ARRAY, 
                  items: { type: Type.STRING } 
                },
              },
              required: ["full_address", "city", "state", "zip_code", "description", "logo_url", "gallery_urls"]
            }
          }
        });

        const aiText = response.text || '{}';
        const aiData = JSON.parse(aiText);

        if (!aiData.city || !aiData.state || !aiData.zip_code) {
          continue; // Pular locais incompletos ou fora do Brasil
        }
        
        const enriched = {
          ...place,
          address: aiData.full_address || place.address,
          zip_code: aiData.zip_code || place.zip_code,
          description: aiData.description || place.description,
          opening_hours: aiData.opening_hours || place.opening_hours,
          phone: aiData.phone || place.phone,
          website: aiData.website || place.website,
          logo_url: aiData.logo_url || place.logo_url,
          gallery_urls: aiData.gallery_urls || [],
          rating: aiData.rating || place.rating,
          last_updated: new Date().toISOString()
        };

        await fetch('/api/places/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ places: [enriched] }),
        });

        // Encaminhar para a API Final
        try {
          await fetch('/api/final', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: 'bulk-enrichment', places: [enriched] }),
          });
        } catch (e) {
          console.warn('Erro ao encaminhar para API Final:', e);
        }

        // Pequeno delay para respirar entre chamadas
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      setMessage({ text: `Enriquecimento em massa concluído (${placesToProcess.length} locais)`, type: 'success' });
      refreshPlaces();
      setSelectedPlacesIds([]);
    } catch (error: any) {
      console.error('Erro no Bulk:', error);
      setMessage({ text: 'Erro no processamento em massa: ' + error.message, type: 'error' });
    } finally {
      setIsBulkRunning(false);
      setBulkProgress({ current: 0, total: 0, status: '' });
    }
  };

  const handleCleanup = async (type: 'no-address' | 'no-phone' | 'duplicates') => {
    setIsBulkRunning(true);
    setBulkProgress({ current: 0, total: 1, status: 'Analisando banco...' });

    try {
      let toDelete: string[] = [];
      
      if (type === 'no-address') {
        toDelete = places.filter(p => !p.address || p.address.includes('não disponível') || p.address.length < 5).map(p => p.osm_id);
      } else if (type === 'no-phone') {
        toDelete = places.filter(p => p.phone === 'Não informado').map(p => p.osm_id);
      }

      if (toDelete.length > 0) {
        setBulkProgress({ current: 0, total: toDelete.length, status: `Excluindo ${toDelete.length} registros...` });
        
        const res = await fetch('/api/places/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: toDelete }),
        });

        if (res.ok) {
          setMessage({ text: `Faxina concluída! ${toDelete.length} locais removidos.`, type: 'success' });
          refreshPlaces();
        }
      } else {
        setMessage({ text: 'Nenhum local encontrado para este critério de limpeza.', type: 'success' });
      }
    } catch (error: any) {
      setMessage({ text: 'Erro na limpeza: ' + error.message, type: 'error' });
    } finally {
      setIsBulkRunning(false);
      setBulkProgress({ current: 0, total: 0, status: '' });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedPlacesIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
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
              onClick={handleRestore}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm font-medium text-amber-700 border-amber-200 hover:bg-amber-50"
              disabled={isRestoring}
            >
              <RefreshCcw className={`w-4 h-4 ${isRestoring ? 'animate-spin' : ''}`} />
              Restaurar API Result (24h)
            </button>
            <button 
              onClick={() => refreshPlaces()}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <RefreshCcw className={`w-4 h-4 ${isLoadingPlaces ? 'animate-spin text-blue-600' : ''}`} />
              Atualizar Banco
            </button>
            <button 
              onClick={() => setIsManagementOpen(!isManagementOpen)}
              className={`px-4 py-2 border rounded-lg transition-colors flex items-center gap-2 text-sm font-medium ${
                isManagementOpen ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Settings className="w-4 h-4" />
              Painel IA
            </button>
          </div>
        </header>

        <AnimatePresence>
          {isManagementOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-gray-900 text-white rounded-2xl p-6 mb-8 shadow-xl border border-gray-800"
            >
              <div className="flex flex-col md:flex-row gap-8">
                <div className="flex-1 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500 rounded-lg">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="font-bold text-lg">IA Management Center</h2>
                      <p className="text-xs text-gray-400">Gerenciamento inteligente e automação de banco de dados.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                      <p className="text-xs font-bold text-gray-500 uppercase mb-3">Enriquecimento em Massa</p>
                      <p className="text-sm text-gray-300 mb-4">Atualiza dados detalhados via Google Search para os locais selecionados.</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-400 bg-blue-400/10 px-2 py-1 rounded">
                          Modelo: {enrichModel.includes('lite') ? 'Ilimitado (Lite)' : 'Cota Normal'}
                        </span>
                      </div>
                      <button 
                        onClick={handleBulkEnrich}
                        disabled={selectedPlacesIds.length === 0 || isBulkRunning}
                        className="w-full mt-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all"
                      >
                        <ListChecks className="w-4 h-4" />
                        Executar Fila ({selectedPlacesIds.length})
                      </button>
                    </div>

                    <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                      <p className="text-xs font-bold text-gray-500 uppercase mb-3">Limpeza & Faxina IA</p>
                      <div className="space-y-2">
                        <button 
                          onClick={() => handleCleanup('no-address')}
                          disabled={isBulkRunning}
                          className="w-full py-2 bg-gray-700 hover:bg-red-900/30 text-xs rounded-lg flex items-center justify-between px-3 transition-colors"
                        >
                          <span>Remover locais sem endereço</span>
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </button>
                        <button 
                          onClick={() => handleCleanup('no-phone')}
                          disabled={isBulkRunning}
                          className="w-full py-2 bg-gray-700 hover:bg-red-900/30 text-xs rounded-lg flex items-center justify-between px-3 transition-colors"
                        >
                          <span>Remover locais sem telefone</span>
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-64 space-y-4">
                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-3">Status da Fila</p>
                    {isBulkRunning ? (
                      <div className="space-y-3">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="animate-pulse text-blue-400">Processando...</span>
                          <span>{bulkProgress.current} / {bulkProgress.total}</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                            className="bg-blue-500 h-full"
                          />
                        </div>
                        <p className="text-[10px] text-gray-400 truncate">{bulkProgress.status}</p>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        <CheckCircle2 className="w-8 h-8 mx-auto opacity-20 mb-2" />
                        <p className="text-xs">Fila ociosa.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                <span className="text-xs bg-white/20 px-2 py-1 rounded-full font-medium">Supabase Ativo</span>
              </div>
              {placesData?.error ? (
                <div>
                  <p className="text-sm font-bold text-red-200">Erro na conexão</p>
                  <p className="text-[10px] opacity-70 truncate" title={placesData.error}>{placesData.error}</p>
                </div>
              ) : (
                <>
                  <p className="text-2xl font-bold">{places.length}</p>
                  <p className="text-blue-100 text-sm">Locais no banco de dados</p>
                </>
              )}
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
                      <th className="px-6 py-4">
                        <button 
                          onClick={() => setSelectedPlacesIds(selectedPlacesIds.length === filteredPlaces.length ? [] : filteredPlaces.map(p => p.osm_id))}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                        >
                          <ListChecks className={`w-4 h-4 ${selectedPlacesIds.length > 0 ? 'text-blue-600' : 'text-gray-400'}`} />
                        </button>
                      </th>
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
                          <td className="px-6 py-4" onClick={(e) => { e.stopPropagation(); toggleSelect(place.osm_id); }}>
                            <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-all ${
                              selectedPlacesIds.includes(place.osm_id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                            }`}>
                              {selectedPlacesIds.includes(place.osm_id) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                            </div>
                          </td>
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
                {isEnriching && (
                  <div className="absolute inset-0 bg-blue-600/40 backdrop-blur-md flex items-center justify-center z-20">
                    <div className="flex flex-col items-center gap-3 text-white">
                      <Loader2 className="w-10 h-10 animate-spin" />
                      <p className="font-bold">IA Enriquecendo Dados...</p>
                      <p className="text-xs opacity-80">Usando Google Search Grounding</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 sm:p-8 overflow-y-auto space-y-8">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    {selectedPlace.logo_url && (
                       <img src={selectedPlace.logo_url} alt="Logo" className="w-12 h-12 rounded-xl object-contain bg-gray-50 border border-gray-100 p-1" />
                    )}
                    <div>
                      <p className="text-xs text-gray-500 font-bold uppercase">ID OSM</p>
                      <code className="text-[10px] bg-gray-100 px-1 py-0.5 rounded">{selectedPlace.osm_id}</code>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <select 
                        value={enrichModel}
                        onChange={(e: any) => setEnrichModel(e.target.value)}
                        className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"
                        title="Selecione o modelo de IA"
                      >
                        <option value="gemini-3.1-flash-lite-preview">Flash Lite (Ilimitado/Rápido)</option>
                        <option value="gemini-flash-latest">Flash Latest (Ilimitado/Padrão)</option>
                        <option value="gemini-3.1-pro-preview">Pro (Ilimitado/Inteligente)</option>
                      </select>
                      <button 
                        onClick={() => handleEnrich(selectedPlace.osm_id)}
                        disabled={isEnriching}
                        className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 hover:scale-105 transition-transform flex items-center gap-2"
                      >
                        <RefreshCcw className={`w-4 h-4 ${isEnriching ? 'animate-spin' : ''}`} />
                        Enriquecer IA
                      </button>
                    </div>
                    
                    <button 
                      onClick={() => handleSpeechSummary(selectedPlace)}
                      disabled={isSummarizing}
                      className="px-6 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl font-bold text-xs hover:bg-amber-100 transition-colors flex items-center justify-center gap-2"
                    >
                      {isSummarizing ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Globe className="w-3 h-3" />
                      )}
                      {isSummarizing ? 'Gerando Áudio...' : 'Ouvir Briefing de Venda (TTS)'}
                    </button>
                  </div>
                </div>

                {selectedPlace.description && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <Info className="w-4 h-4" /> Sobre o Estabelecimento
                    </h3>
                    <p className="text-gray-700 leading-relaxed italic text-sm">
                      &quot;{selectedPlace.description}&quot;
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <MapIcon className="w-4 h-4" /> Localização
                      </h3>
                      <p className="text-gray-800 font-medium leading-relaxed mb-1">
                        {selectedPlace.address}
                      </p>
                      {selectedPlace.zip_code && (
                        <p className="text-sm text-blue-600 font-bold mb-3 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> CEP: {selectedPlace.zip_code}
                        </p>
                      )}
                      {selectedPlace.google_maps_url && (
                        <a 
                          href={selectedPlace.google_maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all text-sm font-bold shadow-md shadow-blue-500/10"
                        >
                          <MapIcon className="w-4 h-4" />
                          Traçar Rota no Google Maps
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {(selectedPlace.latitude && selectedPlace.longitude) && (
                        <p className="text-[10px] text-gray-400 font-mono mt-3">
                          Coords: {selectedPlace.latitude.toFixed(6)}, {selectedPlace.longitude.toFixed(6)}
                        </p>
                      )}
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

                {selectedPlace.gallery_urls && selectedPlace.gallery_urls.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <MapIcon className="w-4 h-4" /> Galeria de Imagens (IA)
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {selectedPlace.gallery_urls.map((url, idx) => (
                        <img key={idx} src={url} className="w-full h-24 object-cover rounded-xl bg-gray-100 hover:scale-105 transition-transform cursor-pointer" alt={`Galeria ${idx}`} />
                      ))}
                    </div>
                  </div>
                )}

                {selectedPlace.reviews && selectedPlace.reviews.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-500" /> Avaliações Inteligentes
                    </h3>
                    <div className="space-y-3">
                      {selectedPlace.reviews.map((rev, idx) => (
                        <div key={idx} className="bg-gray-50 border border-gray-100 p-4 rounded-2xl">
                          <p className="text-xs font-bold text-gray-900 mb-1">{rev.author}</p>
                          <p className="text-sm text-gray-600 italic">&quot;{rev.text}&quot;</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
