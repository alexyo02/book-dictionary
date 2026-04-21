import { useState, useEffect, type FormEvent, type MouseEvent } from 'react';
import { Search, Loader2, Trash2, Palette, GripVertical, X, Maximize2 } from 'lucide-react';
import { fetchDefinition, WordDefinition } from './dictionaryService';
import { motion, AnimatePresence, Reorder } from 'motion/react';

// Utility to generate a bright random HEX color for dark mode
const hslToHex = (h: number, s: number, l: number) => {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

const generateRandomHex = () => {
  const h = Math.floor(Math.random() * 360);
  const s = Math.floor(80 + Math.random() * 20); // 80-100%
  const l = Math.floor(65 + Math.random() * 15); // 65-80%
  return hslToHex(h, s, l);
};

const renderDefinition = (text: string, color: string, searchedWord: string) => {
  const lines = text.split('\n').filter(l => l.trim() !== '');
  let hasSeenPrimary = false;

  return lines.map((line, index) => {
    const isHeader = /^\[\s*[A-Z]+\s*\]$/.test(line.trim());
    if (isHeader) {
      hasSeenPrimary = false; // reset for new section
      return (
        <div key={index} className="flex items-center gap-4 mt-8 mb-4">
          <span className="block font-black text-xs md:text-sm tracking-[0.2em] uppercase opacity-80" style={{ color }}>
            {line.replace(/\[|\]/g, '').trim()}
          </span>
          <div className="h-px flex-grow" style={{ backgroundColor: `${color}30` }}></div>
        </div>
      );
    }

    const lowerLine = line.toLowerCase();
    const lowerSearched = searchedWord.toLowerCase();
    const isGrammar = !hasSeenPrimary && (lowerLine.startsWith(lowerSearched) || /^(m|f|m sing|f sing|m pl|f pl|invar)\b/.test(lowerLine)) && line.length < 80;

    if (isGrammar) {
      // Clean the grammar line
      let cleanedGrammar = line;
      const wordRegex = new RegExp(`^${searchedWord}\\b`, 'i');
      cleanedGrammar = cleanedGrammar.replace(wordRegex, '').trim();

      if (cleanedGrammar.length > 0) {
        return (
          <span key={index} className="block text-xs md:text-sm font-bold text-zinc-500 mb-3 uppercase tracking-widest">
            {cleanedGrammar}
          </span>
        );
      }
      return null;
    }

    if (!hasSeenPrimary) {
      hasSeenPrimary = true;
      return (
        <span key={index} className="block text-2xl lg:text-3xl font-medium text-white mb-6 leading-snug">
          {line}
        </span>
      );
    }

    // Secondary / Examples
    return (
      <span key={index} className="block text-base lg:text-lg text-zinc-400 mb-3 pl-4 py-1 border-l-2" style={{ borderLeftColor: `${color}40` }}>
        {line}
      </span>
    );
  });
};

interface Favorite extends WordDefinition {
  color: string;
  id: string;
}

export default function App() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [favSearch, setFavSearch] = useState('');

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [currentResult, setCurrentResult] = useState<WordDefinition | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');

  // Modal State for full reading
  const [viewingWord, setViewingWord] = useState<{word: string, definition: string, color: string} | null>(null);

  // Dynamic Theme Color
  const [selectedColor, setSelectedColor] = useState('#A78BFA'); // nice starting purple

  // Derived filtered favorites
  const filteredFavorites = favorites.filter(f => 
    f.word.toLowerCase().includes(favSearch.toLowerCase()) || 
    f.definition.toLowerCase().includes(favSearch.toLowerCase())
  );

  // Load favorites from local storage on startup
  useEffect(() => {
    const saved = localStorage.getItem('material-dictionary-favorites');
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse favorites", e);
      }
    }
  }, []);

  // Save favorites to local storage whenever it changes
  useEffect(() => {
    localStorage.setItem('material-dictionary-favorites', JSON.stringify(favorites));
  }, [favorites]);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError('');
    setCurrentResult(null);

    try {
      const result = await fetchDefinition(searchQuery.trim());
      if (result) {
        setCurrentResult(result);
        setSelectedColor(generateRandomHex());
      } else {
        setError(`Nessuna definizione trovata per "${searchQuery}".`);
      }
    } catch (err) {
      setError("Si è verificato un errore durante la ricerca. Riprova.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveFavorite = () => {
    if (!currentResult) return;

    if (favorites.some(f => f.word.toLowerCase() === currentResult.word.toLowerCase())) return;

    const newFavorite: Favorite = {
      ...currentResult,
      color: selectedColor,
      id: Date.now().toString(),
    };

    setFavorites((prev) => [newFavorite, ...prev]);
    setCurrentResult(null);
    setSearchQuery('');
  };

  const removeFavorite = (id: string, e?: MouseEvent) => {
    if (e) e.stopPropagation();
    setFavorites(favorites.filter((f) => f.id !== id));
  };
  
  const openWordModal = (word: string, definition: string, color: string) => {
    setViewingWord({ word, definition, color });
  };

  return (
    <div 
      className="bg-[#09090B] min-h-screen p-4 lg:p-10 font-sans text-white flex flex-col transition-colors duration-700 relative"
      style={{ '--theme': selectedColor } as any}
    >
      <style>{`
        ::selection { background-color: var(--theme); color: #000; }
        .theme-text { color: var(--theme); }
        .theme-bg { background-color: var(--theme); color: #09090b; }
      `}</style>
      
      {/* Modal - Expanded Reading View */}
      <AnimatePresence>
        {viewingWord && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-10 bg-black/80 backdrop-blur-md"
            onClick={() => setViewingWord(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#18181B] w-full max-w-2xl max-h-[85vh] rounded-[32px] border border-white/10 shadow-2xl flex flex-col overflow-hidden relative"
            >
              {/* Colored top border accent */}
              <div className="h-2 w-full" style={{ backgroundColor: viewingWord.color }} />
              
              <div className="flex items-center justify-between p-6 lg:p-8 pb-4 shrink-0">
                <h2 className="text-4xl lg:text-5xl font-black capitalize" style={{ color: viewingWord.color, fontFamily: "'Roboto', sans-serif" }}>
                  {viewingWord.word}
                </h2>
                <button 
                  onClick={() => setViewingWord(null)}
                  className="bg-white/5 hover:bg-white/10 p-3 rounded-full transition-colors focus:outline-none"
                  aria-label="Chiudi"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>

              <div className="flex-grow overflow-y-auto p-6 lg:p-8 pt-0 custom-scrollbar">
                <div className="text-xl leading-relaxed text-zinc-300">
                  {renderDefinition(viewingWord.definition, viewingWord.color, viewingWord.word)}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minimal Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-end mb-8 gap-4 safe-top relative z-10">
        <div className="space-y-1">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white" style={{fontFamily: "'Roboto', sans-serif"}}>
            BookDictionary<span className="theme-text transition-colors duration-700">.</span>
          </h1>
        </div>
      </div>

      {/* Main Minimal Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-grow pb-8 relative z-10">
        
        {/* Search & Active Word Section */}
        <div 
          className="xl:col-span-8 bg-[#18181B] rounded-[48px] p-6 lg:p-10 border border-white/5 flex flex-col justify-between min-h-[400px] xl:min-h-[calc(100vh-180px)] relative overflow-hidden transition-all duration-700"
          style={{boxShadow: `0 0 80px -40px ${selectedColor}40`}}
        >
          {/* Subtle Dynamic Glow */}
          <div className="absolute top-0 right-0 w-96 h-96 -mr-32 -mt-32 rounded-full blur-[100px] opacity-10 pointer-events-none transition-colors duration-700 theme-bg"></div>

          <div className="space-y-6 relative z-10 w-full max-w-4xl mx-auto flex-grow flex flex-col">
            <form onSubmit={handleSearch} className="relative w-full">
              <input 
                type="text" 
                placeholder="Cerca una parola..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-16 bg-[#27272A] rounded-2xl px-6 lg:px-8 text-xl font-medium focus:outline-none border-2 border-transparent transition-all shadow-sm text-white placeholder-zinc-500 focus:border-[var(--theme)]" 
              />
              <button 
                type="submit" 
                disabled={isSearching || !searchQuery.trim()} 
                className="absolute right-2 top-1/2 -translate-y-1/2 theme-bg px-4 lg:px-6 h-12 rounded-xl font-bold disabled:opacity-30 disabled:grayscale transition-all flex items-center justify-center hover:brightness-110 active:scale-95"
              >
                {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Cerca'}
              </button>
            </form>

            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-red-950/50 text-red-400 font-medium rounded-2xl border border-red-900/50">
                {error}
              </motion.div>
            )}
            
            {currentResult ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 flex flex-col flex-grow items-start"
              >
                <div className="w-full flex justify-between items-start gap-4">
                  <h2 
                    className="text-5xl lg:text-7xl font-black cnpm install -D @capacitor/assetstalize transition-colors duration-700 theme-text mb-4 break-words"
                    style={{fontFamily: "'Roboto', sans-serif"}}
                  >
                    {currentResult.word}
                  </h2>
                  <button 
                    onClick={() => openWordModal(currentResult.word, currentResult.definition, selectedColor)}
                    className="p-3 bg-[#27272A] hover:bg-[#3F3F46] rounded-full text-zinc-300 hover:text-white transition-colors shrink-0 mt-2 hidden sm:flex"
                    title="Modalità lettura a tutto schermo"
                  >
                    <Maximize2 className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="relative w-full">
                  <div className="text-xl lg:text-2xl leading-relaxed text-zinc-300 max-w-3xl line-clamp-[8] md:line-clamp-[12]">
                    {renderDefinition(currentResult.definition, selectedColor, currentResult.word)}
                  </div>
                  
                  {/* Read more button for long definitions immediately on screen */}
                  <button 
                    onClick={() => openWordModal(currentResult.word, currentResult.definition, selectedColor)}
                    className="mt-4 inline-flex items-center gap-2 theme-text font-bold hover:underline py-2 sm:hidden"
                  >
                    <Maximize2 className="w-4 h-4" /> Leggi a schermo intero
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="flex-grow flex flex-col items-center justify-center text-center opacity-40">
                 <Search className="w-16 h-16 mb-4 theme-text transition-colors duration-700" />
                 <p className="text-xl font-medium max-w-sm text-zinc-300">Esplora il dizionario universale.</p>
              </div>
            )}
          </div>

          {currentResult && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col lg:flex-row justify-between items-start lg:items-center mt-8 gap-6 relative z-10 w-full max-w-4xl mx-auto"
            >
              {/* Advanced UI Native Color Picker Wrapper */}
              <div className="flex bg-[#27272A] p-4 rounded-3xl items-center gap-4 w-full lg:w-auto shadow-sm">
                <Palette className="w-5 h-5 text-zinc-400 shrink-0 ml-1" />
                <p className="text-xs font-bold uppercase text-zinc-400 shrink-0">Colore Generato:</p>
                <div 
                  className="relative w-10 h-10 shrink-0 cursor-pointer rounded-full overflow-hidden border-2 border-white/20 hover:scale-105 transition-transform shadow-inner" 
                  style={{backgroundColor: selectedColor}}
                >
                   <input 
                      type="color" 
                      value={selectedColor}
                      onChange={(e) => setSelectedColor(e.target.value)}
                      className="absolute inset-[-10px] w-[60px] h-[60px] opacity-0 cursor-pointer" 
                      aria-label="Scegli colore personalizzato"
                   />
                </div>
                <span className="text-sm font-mono text-zinc-500 uppercase">{selectedColor}</span>
              </div>

              <button 
                onClick={handleSaveFavorite}
                disabled={favorites.some(f => f.word.toLowerCase() === currentResult.word.toLowerCase())}
                className="theme-bg w-full lg:w-auto px-8 lg:px-10 py-5 rounded-[32px] text-lg font-bold flex items-center justify-center gap-3 hover:brightness-110 hover:scale-105 transition-all disabled:opacity-30 disabled:hover:scale-100 disabled:hover:brightness-100 disabled:grayscale shrink-0"
              >
                {favorites.some(f => f.word.toLowerCase() === currentResult.word.toLowerCase()) ? 'Salvato' : 'Salva Preferito'}
              </button>
            </motion.div>
          )}
        </div>

        {/* Favorites Section */}
        <div className="xl:col-span-4 bg-[#18181B] rounded-[48px] p-6 lg:p-8 border border-white/5 flex flex-col min-h-[400px] xl:max-h-[calc(100vh-180px)] shadow-lg">
          <div className="flex flex-col gap-4 mb-6 shrink-0">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-bold text-white">Preferiti</h3>
              <span className="theme-text font-bold text-sm bg-white/5 px-3 py-1 rounded-full transition-colors duration-700">{favorites.length}</span>
            </div>
            {favorites.length > 0 && (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input 
                  type="text" 
                  placeholder="Cerca nei preferiti..." 
                  value={favSearch} 
                  onChange={e => setFavSearch(e.target.value)} 
                  className="w-full bg-[#27272A] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[var(--theme)] transition-all" 
                />
              </div>
            )}
          </div>
          
          <div className="flex-grow overflow-y-auto pr-2 pb-2 custom-scrollbar">
            {favorites.length === 0 ? (
              <motion.div initial={{opacity: 0}} animate={{opacity: 1}} className="text-center py-12 opacity-30">
                <p className="text-white font-medium text-lg">Nessuna parola salvata.</p>
              </motion.div>
            ) : favSearch ? (
              // Filtered List (No drag-and-drop to avoid state sync issues)
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {filteredFavorites.length === 0 ? (
                    <p className="text-center text-zinc-500 py-4">Nessun risultato trovato.</p>
                  ) : (
                    filteredFavorites.map(fav => (
                      <motion.div 
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={fav.id}
                        style={{ borderLeftColor: fav.color }}
                        className="p-5 bg-[#27272A] rounded-[24px] border-l-[6px] hover:bg-[#3F3F46] transition-colors relative group cursor-pointer"
                        onClick={() => openWordModal(fav.word, fav.definition, fav.color)}
                      >
                        <button 
                          onClick={(e) => removeFavorite(fav.id, e)}
                          className="absolute top-4 right-4 p-2 bg-[#18181B] hover:bg-black rounded-full opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 text-zinc-400 hover:text-white z-10"
                          aria-label="Rimuovi preferito"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <p className="font-black text-xl capitalize pr-8" style={{color: fav.color}}>
                          {fav.word}
                        </p>
                        <p className="text-sm text-zinc-300 line-clamp-2 mt-1 leading-snug">
                          {fav.definition.replace(/\[.*?\]/g, '').replace(/\n/g, ' ').trim()}
                        </p>
                        <button className="mt-2 text-xs font-bold opacity-60 hover:opacity-100" style={{color: fav.color}}>Leggi tutto &rarr;</button>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            ) : (
              // Reorderable Full List
              <Reorder.Group axis="y" values={favorites} onReorder={setFavorites} className="space-y-4">
                {favorites.map(fav => (
                  <Reorder.Item key={fav.id} value={fav} className="relative group">
                    <div 
                      style={{ borderLeftColor: fav.color }} 
                      className="p-5 bg-[#27272A] rounded-[24px] border-l-[6px] hover:bg-[#3F3F46] transition-colors flex gap-3 shadow-sm cursor-pointer"
                      onClick={() => openWordModal(fav.word, fav.definition, fav.color)}
                    >
                      <div 
                        className="cursor-grab active:cursor-grabbing opacity-20 hover:opacity-100 transition-opacity flex items-center justify-center shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <GripVertical className="w-5 h-5 text-zinc-400" />
                      </div>
                      <div className="flex-grow pr-8">
                        <p className="font-black text-xl capitalize" style={{color: fav.color}}>
                          {fav.word}
                        </p>
                        <p className="text-sm text-zinc-300 line-clamp-2 mt-1 leading-snug">
                          {fav.definition.replace(/\[.*?\]/g, '').replace(/\n/g, ' ').trim()}
                        </p>
                        <button className="mt-2 text-xs font-bold opacity-60 hover:opacity-100" style={{color: fav.color}}>Leggi tutto &rarr;</button>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => removeFavorite(fav.id, e)}
                      className="absolute top-4 right-4 p-2 bg-[#18181B] hover:bg-black rounded-full opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 text-zinc-400 hover:text-white z-10"
                      aria-label="Rimuovi preferito"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
