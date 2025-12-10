import React, { useState, useEffect, useCallback } from 'react';
import { 
  AppState, 
  THEMES, 
  Theme, 
  Language, 
  Gender, 
  WeatherData, 
  OutfitData 
} from './types';
import { fetchWeather } from './services/weatherService';
import { generateOutfitAdvice, generateCharacterImage } from './services/geminiService';
import { Toast } from './components/Toast';

// Icons
const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
);
const MaleIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
);
const FemaleIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
);

const App: React.FC = () => {
  // State
  const [state, setState] = useState<AppState>({
    city: 'Shanghai',
    weather: null,
    outfit: null,
    characterImageUrl: null,
    isLoading: false,
    error: null,
    language: 'zh',
    theme: 'blue',
    gender: 'female' // Default user identity
  });

  const [searchInput, setSearchInput] = useState('Shanghai');

  // Translations
  const t = {
    zh: {
      searchPlaceholder: '输入城市 (如: Shanghai)',
      loading: '正在分析天气与穿搭...',
      outfitTitle: '今日穿搭推荐',
      weatherTitle: '当地天气',
      temp: '温度',
      humidity: '湿度',
      top: '上装',
      bottom: '下装',
      shoes: '鞋履',
      acc: '配饰',
      male: '男生',
      female: '女生',
      copy: '一键复制',
      error: '出错了，请稍后再试'
    },
    en: {
      searchPlaceholder: 'Enter city (e.g., Shanghai)',
      loading: 'Analyzing weather & style...',
      outfitTitle: 'Outfit of the Day',
      weatherTitle: 'Local Weather',
      temp: 'Temp',
      humidity: 'Hum',
      top: 'Top',
      bottom: 'Bottom',
      shoes: 'Shoes',
      acc: 'Acc',
      male: 'Him',
      female: 'Her',
      copy: 'Copy',
      error: 'Something went wrong'
    }
  };

  const text = t[state.language];

  // Core Logic
  const handleSearch = useCallback(async () => {
    if (!searchInput.trim()) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // 1. Get Weather
      const weatherData = await fetchWeather(searchInput);
      
      // 2. Get Outfit Text
      const outfitData = await generateOutfitAdvice(weatherData, state.gender, state.language);
      
      // 3. Get Outfit Image
      const imageUrl = await generateCharacterImage(outfitData, state.gender, weatherData);

      setState(prev => ({
        ...prev,
        city: weatherData.city,
        weather: weatherData,
        outfit: outfitData,
        characterImageUrl: imageUrl,
        isLoading: false
      }));

    } catch (err: any) {
      console.error(err);
      let errorMessage = text.error;
      // Show specific error for "City not found"
      if (err.message && (err.message.includes('City not found') || err.message.includes('unavailable'))) {
        errorMessage = state.language === 'zh' ? '未找到该城市或网络错误' : 'City not found or network error';
      }
      
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage 
      }));
    }
  }, [searchInput, state.gender, state.language, text.error]);

  // Initial Load
  useEffect(() => {
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Handlers
  const toggleLanguage = () => setState(s => ({ ...s, language: s.language === 'zh' ? 'en' : 'zh' }));
  const toggleGender = () => setState(s => ({ ...s, gender: s.gender === 'male' ? 'female' : 'male' }));
  const changeTheme = (theme: Theme) => setState(s => ({ ...s, theme }));
  const clearError = () => setState(s => ({ ...s, error: null }));

  return (
    <div className={`min-h-screen w-full transition-colors duration-500 bg-gradient-to-br ${THEMES[state.theme]} p-4 sm:p-6 lg:p-8 flex flex-col`}>
      {/* Meta for Status Bar */}
      <div className="fixed top-0 left-0 right-0 h-safe-top bg-transparent z-50"></div>

      {state.error && <Toast message={state.error} onClose={clearError} type="error" />}

      {/* --- Header / Controls --- */}
      <header className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 z-10">
        
        {/* Search Bar */}
        <div className="relative w-full sm:w-80 group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <SearchIcon />
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={text.searchPlaceholder}
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/40 backdrop-blur-md border border-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 shadow-sm transition-all text-gray-800 placeholder-gray-500"
          />
          <button 
            onClick={handleSearch}
            className="absolute inset-y-1 right-1 px-4 rounded-xl bg-white/60 hover:bg-white text-gray-700 text-sm font-medium transition-colors shadow-sm"
          >
            Go
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 bg-white/30 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/40 shadow-sm overflow-x-auto max-w-full">
          {/* Gender */}
          <button onClick={toggleGender} className="p-2 rounded-full hover:bg-white/50 transition-colors text-gray-700 active:scale-95">
             <span className="font-bold text-sm">{state.gender === 'male' ? '♂' : '♀'}</span>
          </button>
          
          <div className="w-px h-4 bg-gray-400/30 mx-1"></div>

          {/* Lang */}
          <button onClick={toggleLanguage} className="p-2 rounded-full hover:bg-white/50 transition-colors text-xs font-bold text-gray-700 uppercase">
            {state.language}
          </button>

          <div className="w-px h-4 bg-gray-400/30 mx-1"></div>

          {/* Theme Dots */}
          <div className="flex gap-2">
            {(['blue', 'green', 'pink', 'purple'] as Theme[]).map(t => (
              <button
                key={t}
                onClick={() => changeTheme(t)}
                className={`w-5 h-5 rounded-full border-2 border-white shadow-sm transition-transform active:scale-90 ${
                  t === 'blue' ? 'bg-blue-400' :
                  t === 'green' ? 'bg-emerald-400' :
                  t === 'pink' ? 'bg-rose-400' : 'bg-purple-400'
                } ${state.theme === t ? 'ring-2 ring-gray-400 scale-110' : ''}`}
              />
            ))}
          </div>
        </div>
      </header>

      {/* --- Main Grid Layout --- */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 pb-safe-bottom">
        
        {/* Left Column (Weather & Outfit Details) */}
        <div className="lg:col-span-5 flex flex-col gap-6 order-2 lg:order-1">
          
          {/* Weather Card */}
          <div className="relative bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-lg animate-fade-in hover:shadow-xl transition-shadow">
             <div className="flex justify-between items-start">
               <div>
                 <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">{text.weatherTitle}</h2>
                 <h1 className="text-3xl font-bold text-gray-800">{state.weather?.city || '...'}</h1>
               </div>
               <div className="text-right">
                 <div className="text-4xl font-light text-gray-900">{state.weather?.temp ?? '--'}°</div>
                 <div className="text-sm text-gray-600">{state.weather?.condition}</div>
               </div>
             </div>
             
             <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-gray-700 bg-white/30 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <span>💧 {text.humidity}: {state.weather?.humidity ?? '--'}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🌬️ Wind: Low</span>
                </div>
             </div>
          </div>

          {/* Outfit Recommendations */}
          <div className="flex-1 bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-lg animate-slide-up hover:shadow-xl transition-shadow flex flex-col justify-center">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-200/50 pb-2">{text.outfitTitle}</h2>
            
            {state.isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-4 opacity-70 min-h-[200px]">
                <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm animate-pulse">{text.loading}</p>
              </div>
            ) : state.outfit ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-gray-500 uppercase">{text.top}</span>
                  <p className="text-lg font-medium text-gray-800 leading-snug">{state.outfit.top}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-gray-500 uppercase">{text.bottom}</span>
                  <p className="text-lg font-medium text-gray-800 leading-snug">{state.outfit.bottom}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-gray-500 uppercase">{text.shoes}</span>
                    <p className="text-base text-gray-800">{state.outfit.shoes}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-gray-500 uppercase">{text.acc}</span>
                    <p className="text-base text-gray-800">{state.outfit.accessories.join(', ')}</p>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-white/50 rounded-xl border border-white/40">
                  <p className="text-sm text-gray-600 italic">" {state.outfit.reasoning} "</p>
                </div>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-gray-400">Select city...</div>
            )}
          </div>
        </div>

        {/* Right Column (Character Visual) */}
        <div className="lg:col-span-7 h-[50vh] lg:h-auto min-h-[400px] order-1 lg:order-2">
          <div className="w-full h-full relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white/30 backdrop-blur-sm group">
            {/* Background Decor */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent z-10"></div>
            
            {/* Character Image */}
            <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
               {state.isLoading ? (
                 <div className="animate-pulse flex flex-col items-center">
                    <div className="w-20 h-20 bg-gray-300 rounded-full mb-4"></div>
                    <div className="h-4 w-32 bg-gray-300 rounded"></div>
                 </div>
               ) : (
                 <img 
                   src={state.characterImageUrl || `https://picsum.photos/800/1000?random=${state.city}`} 
                   alt="Outfit Preview" 
                   className="w-full h-full object-cover object-center transform transition-transform duration-700 group-hover:scale-105"
                   loading="lazy"
                 />
               )}
            </div>
            
            {/* Interactive Overlay / Badge */}
            <div className="absolute bottom-6 right-6 z-20">
               <div className="bg-white/80 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-white text-xs font-bold text-gray-800 flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                 AI GENERATED
               </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;