
import React, { useState, useEffect, useCallback } from 'react';
import { 
  AppState, 
  THEMES, 
  Theme, 
  Language, 
  Gender, 
  WeatherData, 
  OutfitData,
  AppSettings
} from './types';
import { fetchWeather } from './services/weatherService';
import { generateOutfitAdvice, generateCharacterImage } from './services/geminiService';
import { Toast } from './components/Toast';

// Icons
const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
);
const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
);
const RefreshIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
);
const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
);

// Models configuration
// Provide BOTH official Google IDs and common 3rd-party alias IDs so the user can choose what matches their API key.
const AVAILABLE_MODELS = [
  // Official Google
  { id: 'gemini-2.5-flash-image', name: 'Google: Flash Image (Official)' },
  { id: 'gemini-3-pro-image-preview', name: 'Google: Pro Image (Official)' },
  // 3rd Party
  { id: 'nano-banana', name: '3rd Party: Nano Banana' },
  { id: 'nano-banana-pro', name: '3rd Party: Nano Banana Pro' },
];

const App: React.FC = () => {
  // Load settings from local storage
  const loadSettings = (): AppSettings => {
    try {
      const saved = localStorage.getItem('uniStyleSettings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) { console.error(e); }
    return { apiKey: '', baseUrl: '', imageModel: 'gemini-2.5-flash-image' };
  };

  // State
  const [state, setState] = useState<AppState>({
    city: 'Shanghai',
    weather: null,
    outfit: null,
    characterImageUrl: null,
    isLoading: false,
    isImageLoading: false,
    error: null,
    language: 'zh',
    theme: 'blue',
    gender: 'female',
    showSettings: false,
    settings: loadSettings()
  });

  const [searchInput, setSearchInput] = useState('Shanghai');

  // Temp state for settings inputs
  const [tempSettings, setTempSettings] = useState<AppSettings>(state.settings);

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
      error: '出错了，请稍后再试',
      settings: '设置',
      apiKey: 'API Key',
      baseUrl: 'Base URL',
      model: '绘画模型',
      save: '保存并应用',
      refreshImage: '刷新形象',
      regenerating: '重绘中...',
      configNeeded: '请先配置 API Key 以使用 AI 功能',
      checkConfig: 'AI 调用失败，请检查设置',
      useOfficial: '恢复默认 (Google 官方)',
      customConfig: '自定义 / 第三方配置'
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
      error: 'Something went wrong',
      settings: 'Settings',
      apiKey: 'API Key',
      baseUrl: 'Base URL',
      model: 'Image Model',
      save: 'Save & Apply',
      refreshImage: 'Refresh Look',
      regenerating: 'Redrawing...',
      configNeeded: 'Please configure API Key to use AI features',
      checkConfig: 'AI call failed, please check settings',
      useOfficial: 'Reset to Default (Official)',
      customConfig: 'Custom / 3rd Party Config'
    }
  };

  const text = t[state.language];

  // Helper to preset official google settings
  const useOfficialPreset = () => {
    setTempSettings(prev => ({
      ...prev,
      baseUrl: '', // Empty means official endpoint
      imageModel: 'gemini-2.5-flash-image'
    }));
  };

  // Core Logic - Full Search
  const handleSearch = useCallback(async (customSettings?: AppSettings) => {
    if (!searchInput.trim()) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    const currentSettings = customSettings || state.settings;

    try {
      // 1. Get Weather
      const weatherData = await fetchWeather(searchInput);
      
      // 2. Get Outfit Text
      // This might throw if API key is invalid or quota exceeded
      const outfitData = await generateOutfitAdvice(weatherData, state.gender, state.language, currentSettings);
      
      // 3. Get Outfit Image
      let imageUrl = null;
      try {
        imageUrl = await generateCharacterImage(outfitData, state.gender, weatherData, currentSettings);
      } catch (imgError: any) {
         console.warn("Image generation specific error:", imgError);
         
         let msg = imgError.message || 'Unknown';
         // Handle 403 Permission Denied - common when key doesn't support model
         if (msg.includes('403') || msg.includes('PERMISSION_DENIED')) {
            msg = `No permission for '${currentSettings.imageModel}'. Try a different model in Settings.`;
         }
         // Handle 404 Not Found - common when 3rd party doesn't support official ID
         else if (msg.includes('404') || msg.includes('not found')) {
            msg = `Model '${currentSettings.imageModel}' not found (404). Check Settings.`;
         }
         
         setState(prev => ({ ...prev, error: `Image Gen Failed: ${msg}` }));
      }
      
      const isFallback = outfitData.reasoning.includes("由于网络原因") || outfitData.reasoning.includes("network issues");

      setState(prev => ({
        ...prev,
        city: weatherData.city,
        weather: weatherData,
        outfit: outfitData,
        characterImageUrl: imageUrl,
        isLoading: false,
        showSettings: isFallback ? true : prev.showSettings,
        // Only show config check error if it was a fallback situation
        error: isFallback ? text.checkConfig : prev.error
      }));

    } catch (err: any) {
      console.error("Search Flow Error:", err);
      // Construct a user-friendly error message that includes tech details
      let errorMessage = text.error;
      
      // API specific errors
      if (err.status || err.message?.includes('fetch')) {
         errorMessage = `API Error: ${err.status || 'Network'} - ${err.message}`;
      } else if (err.message && (err.message.includes('City not found') || err.message.includes('unavailable'))) {
        errorMessage = state.language === 'zh' ? '未找到该城市或网络错误' : 'City not found or network error';
      }
      
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage 
      }));
    }
  }, [searchInput, state.gender, state.language, state.settings, text.error, text.checkConfig]);

  // Image Refresh Logic
  const handleRefreshImage = async () => {
    if (!state.outfit || !state.weather) return;
    
    setState(prev => ({ ...prev, isImageLoading: true }));

    try {
      // Force refresh by calling service again
      const imageUrl = await generateCharacterImage(state.outfit, state.gender, state.weather, state.settings);
      
      setState(prev => ({
        ...prev,
        characterImageUrl: imageUrl,
        isImageLoading: false
      }));
    } catch (e: any) {
      console.error(e);
      let msg = e.message || 'Unknown';
       if (msg.includes('403') || msg.includes('PERMISSION_DENIED')) {
            msg = `No permission for model. Try a different model.`;
       } else if (msg.includes('404') || msg.includes('not found')) {
            msg = `Model not found (404). Check Settings.`;
       }
      setState(prev => ({ 
        ...prev, 
        isImageLoading: false, 
        error: `Refresh Failed: ${msg}`
      }));
    }
  };

  // Initial Load & Config Check
  useEffect(() => {
    // If no API Key configured, don't run search, just open settings
    if (!state.settings.apiKey) {
      setState(prev => ({ 
        ...prev, 
        showSettings: true,
        error: text.configNeeded
      }));
    } else {
      handleSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // Handlers
  const toggleLanguage = () => setState(s => ({ ...s, language: s.language === 'zh' ? 'en' : 'zh' }));
  const toggleGender = () => setState(s => ({ ...s, gender: s.gender === 'male' ? 'female' : 'male' }));
  const changeTheme = (theme: Theme) => setState(s => ({ ...s, theme }));
  const clearError = () => setState(s => ({ ...s, error: null }));
  const toggleSettings = () => {
    setTempSettings(state.settings); // Reset temp to current on open
    setState(s => ({ ...s, showSettings: !s.showSettings }));
  };
  
  const saveSettings = () => {
    localStorage.setItem('uniStyleSettings', JSON.stringify(tempSettings));
    setState(s => ({ ...s, settings: tempSettings, showSettings: false }));
    // Trigger search with new settings
    if (state.weather || searchInput) {
      handleSearch(tempSettings);
    }
  };

  return (
    <div className={`min-h-screen w-full transition-colors duration-500 bg-gradient-to-br ${THEMES[state.theme]} p-4 sm:p-6 lg:p-8 flex flex-col`}>
      {/* Meta for Status Bar */}
      <div className="fixed top-0 left-0 right-0 h-safe-top bg-transparent z-50"></div>

      {state.error && <Toast message={state.error} onClose={clearError} type={state.error.includes('API') || state.error.includes('Error') || state.error.includes('Failed') ? 'error' : 'info'} />}

      {/* --- Header / Controls --- */}
      <header className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 z-10">
        
        {/* Search Bar */}
        <div className="relative w-full sm:w-80 group order-2 sm:order-1">
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
            onClick={() => handleSearch()}
            className="absolute inset-y-1 right-1 px-4 rounded-xl bg-white/60 hover:bg-white text-gray-700 text-sm font-medium transition-colors shadow-sm"
          >
            Go
          </button>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-3 order-1 sm:order-2 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-3 bg-white/30 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/40 shadow-sm overflow-x-auto">
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

          {/* Settings Button */}
          <button 
            onClick={toggleSettings}
            className={`p-3 bg-white/30 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm hover:bg-white/50 transition-colors ${!state.settings.apiKey ? 'ring-2 ring-red-400 text-red-500 animate-pulse' : 'text-gray-700'}`}
          >
            <SettingsIcon />
          </button>
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
          <div className="flex-1 bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-lg animate-slide-up hover:shadow-xl transition-shadow flex flex-col justify-center min-h-[300px]">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-200/50 pb-2">{text.outfitTitle}</h2>
            
            {state.isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-4 opacity-70">
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
          <div className="w-full h-full relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white/30 backdrop-blur-sm group bg-gray-200/50">
            {/* Background Decor */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent z-10 pointer-events-none"></div>
            
            {/* Refresh Button - Only visible if we have data */}
            {!state.isLoading && state.outfit && (
              <button 
                onClick={handleRefreshImage}
                disabled={state.isImageLoading}
                className="absolute top-4 right-4 z-30 p-2 bg-white/20 backdrop-blur-md border border-white/40 rounded-full text-white hover:bg-white/40 transition-colors shadow-lg disabled:opacity-50"
                title={text.refreshImage}
              >
                <div className={`${state.isImageLoading ? 'animate-spin' : ''}`}>
                   <RefreshIcon />
                </div>
              </button>
            )}

            {/* Character Image */}
            <div className="absolute inset-0 flex items-center justify-center">
               {state.isLoading || state.isImageLoading ? (
                 <div className="flex flex-col items-center z-20">
                    <div className="w-16 h-16 border-4 border-white/80 border-t-transparent rounded-full animate-spin mb-4 shadow-lg"></div>
                    <div className="text-white font-medium text-lg text-shadow-sm animate-pulse">
                      {state.isImageLoading ? text.regenerating : text.loading}
                    </div>
                 </div>
               ) : null}
               
               {/* Show image underneath loader for smooth transition if refreshing, or hide if main loading */}
               {!state.isLoading && (
                 <img 
                   src={state.characterImageUrl || `https://picsum.photos/800/1000?random=${state.city}`} 
                   alt="Outfit Preview" 
                   className={`w-full h-full object-cover object-center transform transition-transform duration-700 ${state.isImageLoading ? 'scale-105 blur-sm' : 'group-hover:scale-105 blur-0'}`}
                   loading="lazy"
                 />
               )}
            </div>
            
            {/* Interactive Overlay / Badge */}
            {!state.isLoading && !state.isImageLoading && state.characterImageUrl && (
              <div className="absolute bottom-6 right-6 z-20 pointer-events-none">
                 <div className="bg-white/80 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-white text-xs font-bold text-gray-800 flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                   AI GENERATED
                 </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* --- Settings Modal --- */}
      {state.showSettings && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={toggleSettings}></div>
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-md p-6 relative animate-slide-up border border-white/50 max-h-[90vh] overflow-y-auto">
            <button onClick={toggleSettings} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <CloseIcon />
            </button>
            
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <SettingsIcon />
              {text.settings}
            </h2>

            <div className="space-y-4">
              
              {/* Quick Presets */}
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 mb-2">
                 <p className="text-xs text-blue-600 font-semibold uppercase mb-2">{text.useOfficial}</p>
                 <button 
                   onClick={useOfficialPreset}
                   className="w-full py-2 bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                 >
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                   Google Official Defaults
                 </button>
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{text.apiKey} <span className="text-xs font-normal text-gray-400">(Google / Third-party)</span></label>
                <input 
                  type="password" 
                  value={tempSettings.apiKey}
                  onChange={e => setTempSettings({...tempSettings, apiKey: e.target.value})}
                  className="w-full px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="sk-..."
                />
              </div>

              {/* Base URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{text.baseUrl} <span className="text-xs font-normal text-gray-400">(Optional for Official)</span></label>
                <input 
                  type="text" 
                  value={tempSettings.baseUrl}
                  onChange={e => setTempSettings({...tempSettings, baseUrl: e.target.value})}
                  className="w-full px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="https://generativelanguage.googleapis.com"
                />
                <p className="text-xs text-gray-400 mt-1">第三方请确保支持 Google 协议 (无需 /v1beta 后缀)</p>
              </div>

              {/* Model Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{text.model}</label>
                
                <div className="space-y-3">
                  {/* Preset Buttons */}
                  <div className="grid grid-cols-1 gap-2">
                    {AVAILABLE_MODELS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setTempSettings({ ...tempSettings, imageModel: m.id })}
                        className={`px-4 py-3 rounded-xl border text-left transition-all flex items-center justify-between group ${
                          tempSettings.imageModel === m.id 
                            ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500' 
                            : 'border-gray-200 bg-gray-50 hover:bg-white hover:border-gray-300'
                        }`}
                      >
                        <span className="font-medium text-sm">{m.name}</span>
                        {tempSettings.imageModel === m.id && (
                          <span className="text-blue-500">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Custom Input */}
                  <div className="relative">
                     <input 
                      type="text" 
                      value={tempSettings.imageModel}
                      onChange={e => setTempSettings({...tempSettings, imageModel: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                      placeholder="Custom model name..."
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <span className="text-xs text-gray-400">Custom</span>
                    </div>
                  </div>
                </div>
                
                <p className="text-xs text-gray-500 mt-2">
                  {state.language === 'zh' 
                    ? "提示：如果遇到 403 权限错误，请尝试切换其他模型。"
                    : "Tip: If you get 403 Permission Denied, try switching models."}
                </p>
              </div>

              <button 
                onClick={saveSettings}
                className="w-full mt-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-lg shadow-blue-500/30 transition-all active:scale-95"
              >
                {text.save}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
