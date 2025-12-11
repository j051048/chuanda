
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
import { generateOutfitAdvice, generateCharacterImage, testConnection } from './services/geminiService';
import { Toast } from './components/Toast';

// Icons
const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
);
const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
);
const RefreshIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
);
const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
);
const CheckIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
);

const OFFICIAL_MODELS = [
  { id: 'gemini-2.5-flash-image', name: 'Google Flash Image (Fast)' },
  { id: 'gemini-3-pro-image-preview', name: 'Google Pro Image (HD)' },
];

const CUSTOM_MODEL_PRESETS = [
  { id: 'nano-banana', name: 'Nano Banana' },
  { id: 'nano-banana-pro', name: 'Nano Banana Pro' },
];

const App: React.FC = () => {
  // Load settings from local storage
  const loadSettings = (): AppSettings => {
    try {
      const saved = localStorage.getItem('uniStyleSettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.mode) parsed.mode = 'official';
        return parsed;
      }
    } catch (e) { console.error(e); }

    let defaultKey = '';
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      defaultKey = process.env.API_KEY;
    }
    
    return { 
      mode: 'official', 
      apiKey: defaultKey, 
      baseUrl: 'https://vip.apiyi.com/', 
      imageModel: 'gemini-2.5-flash-image' 
    };
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
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'fail'>('idle');
  const [testMsg, setTestMsg] = useState('');

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
      testConn: '测试连接',
      testSuccess: '连接成功',
      testFail: '连接失败',
      tabOfficial: 'Google 官方',
      tabCustom: '第三方 / 自定义',
      officialDesc: '直接连接 Google Gemini 官方服务器。稳定性最高。',
      customDesc: '连接第三方中转服务 (OneAPI, GoAmz 等)。需要填写 Base URL。',
      customUrlHint: '必填 (例如: https://api.openai-proxy.com)',
      customModelHint: '手动输入模型名 (如: nano-banana)',
      officialModel: '官方模型选择',
      customModelSelect: '选择或输入模型'
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
      testConn: 'Test Connection',
      testSuccess: 'Connected',
      testFail: 'Failed',
      tabOfficial: 'Google Official',
      tabCustom: 'Custom / 3rd Party',
      officialDesc: 'Connect directly to Google Gemini servers. Best stability.',
      customDesc: 'Connect to 3rd party proxies. Base URL is required.',
      customUrlHint: 'Required (e.g. https://api.openai-proxy.com)',
      customModelHint: 'Enter model ID (e.g. nano-banana)',
      officialModel: 'Official Model',
      customModelSelect: 'Select or Enter Model'
    }
  };

  const text = t[state.language];

  const runConnectionTest = async () => {
    setTestStatus('testing');
    const res = await testConnection(tempSettings);
    setTestStatus(res.success ? 'success' : 'fail');
    setTestMsg(res.message);
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
      const outfitData = await generateOutfitAdvice(weatherData, state.gender, state.language, currentSettings);
      
      // 3. Get Outfit Image
      let imageUrl = null;
      try {
        imageUrl = await generateCharacterImage(outfitData, state.gender, weatherData, currentSettings);
      } catch (imgError: any) {
         console.warn("Image generation specific error:", imgError);
         let msg = imgError.message || 'Unknown';
         if (msg.includes('403') || msg.includes('PERMISSION_DENIED')) {
            msg = `Permission Denied. Check API Key or Model access.`;
         } else if (msg.includes('404')) {
            msg = `Model not found (404). Check Settings.`;
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
        error: isFallback ? text.checkConfig : prev.error
      }));

    } catch (err: any) {
      console.error("Search Flow Error:", err);
      let errorMessage = text.error;
      
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

  const handleRefreshImage = async () => {
    if (!state.outfit || !state.weather) return;
    setState(prev => ({ ...prev, isImageLoading: true }));
    try {
      const imageUrl = await generateCharacterImage(state.outfit, state.gender, state.weather, state.settings);
      setState(prev => ({ ...prev, characterImageUrl: imageUrl, isImageLoading: false }));
    } catch (e: any) {
      console.error(e);
      let msg = e.message || 'Unknown';
      if (msg.includes('403')) msg = `Permission Denied.`;
      if (msg.includes('404')) msg = `Model not found.`;
      setState(prev => ({ ...prev, isImageLoading: false, error: `Refresh Failed: ${msg}` }));
    }
  };

  useEffect(() => {
    if (!state.settings.apiKey) {
      setState(prev => ({ ...prev, showSettings: true, error: text.configNeeded }));
    } else {
      handleSearch();
    }
  }, []); 

  const toggleLanguage = () => setState(s => ({ ...s, language: s.language === 'zh' ? 'en' : 'zh' }));
  const toggleGender = () => setState(s => ({ ...s, gender: s.gender === 'male' ? 'female' : 'male' }));
  const changeTheme = (theme: Theme) => setState(s => ({ ...s, theme }));
  const clearError = () => setState(s => ({ ...s, error: null }));
  const toggleSettings = () => {
    setTempSettings(state.settings); 
    setTestStatus('idle'); 
    setState(s => ({ ...s, showSettings: !s.showSettings }));
  };
  
  const saveSettings = () => {
    let sanitizedKey = tempSettings.apiKey;
    if (sanitizedKey) {
        sanitizedKey = sanitizedKey.replace(/[\u200B-\u200D\uFEFF]/g, '').trim().replace(/^Bearer\s+/i, '');
    }
    const sanitizedSettings = {
      ...tempSettings,
      apiKey: sanitizedKey,
      baseUrl: tempSettings.mode === 'official' ? '' : tempSettings.baseUrl
    };

    localStorage.setItem('uniStyleSettings', JSON.stringify(sanitizedSettings));
    setState(s => ({ ...s, settings: sanitizedSettings, showSettings: false }));
    
    if (state.weather || searchInput) {
      handleSearch(sanitizedSettings);
    }
  };

  return (
    <div className={`h-full w-full transition-colors duration-500 bg-gradient-to-br ${THEMES[state.theme]} flex flex-col overflow-hidden relative`}>
      {/* Top safe area spacing */}
      <div className="w-full h-safe-top shrink-0"></div>

      {state.error && <Toast message={state.error} onClose={clearError} type={state.error.includes('API') || state.error.includes('Error') || state.error.includes('Failed') ? 'error' : 'info'} />}

      {/* --- Header (Fixed at top) --- */}
      <header className="flex-none p-4 sm:p-6 lg:p-8 pb-2 flex flex-col sm:flex-row justify-between items-center gap-4 z-10">
        <div className="relative w-full sm:w-80 group order-2 sm:order-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><SearchIcon /></div>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={text.searchPlaceholder}
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/40 backdrop-blur-md border border-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 shadow-sm text-gray-800 placeholder-gray-500"
          />
          <button onClick={() => handleSearch()} className="absolute inset-y-1 right-1 px-4 rounded-xl bg-white/60 hover:bg-white text-gray-700 text-sm font-medium transition-colors shadow-sm">Go</button>
        </div>

        <div className="flex items-center gap-3 order-1 sm:order-2 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-3 bg-white/30 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/40 shadow-sm overflow-x-auto no-scrollbar">
            <button onClick={toggleGender} className="p-2 rounded-full hover:bg-white/50 transition-colors text-gray-700 active:scale-95 flex-shrink-0"><span className="font-bold text-sm">{state.gender === 'male' ? '♂' : '♀'}</span></button>
            <div className="w-px h-4 bg-gray-400/30 mx-1 flex-shrink-0"></div>
            <button onClick={toggleLanguage} className="p-2 rounded-full hover:bg-white/50 transition-colors text-xs font-bold text-gray-700 uppercase flex-shrink-0">{state.language}</button>
            <div className="w-px h-4 bg-gray-400/30 mx-1 flex-shrink-0"></div>
            <div className="flex gap-2 flex-shrink-0">
              {(['blue', 'green', 'pink', 'purple'] as Theme[]).map(t => (
                <button key={t} onClick={() => changeTheme(t)} className={`w-5 h-5 rounded-full border-2 border-white shadow-sm transition-transform active:scale-90 ${t === 'blue' ? 'bg-blue-400' : t === 'green' ? 'bg-emerald-400' : t === 'pink' ? 'bg-rose-400' : 'bg-purple-400'} ${state.theme === t ? 'ring-2 ring-gray-400 scale-110' : ''}`}/>
              ))}
            </div>
          </div>
          <button onClick={toggleSettings} className={`p-3 bg-white/30 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm hover:bg-white/50 transition-colors flex-shrink-0 ${!state.settings.apiKey ? 'ring-2 ring-red-400 text-red-500 animate-pulse' : 'text-gray-700'}`}>
            <SettingsIcon />
          </button>
        </div>
      </header>

      {/* --- Main Content (Scrollable) --- */}
      {/* flex-1 overflow-y-auto enables internal scrolling */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden w-full p-4 sm:p-6 lg:p-8 pt-2 scroll-smooth">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 pb-24 lg:pb-8">
          
          {/* Right Column (Image) - Mobile Order 1 */}
          {/* On Mobile: Flexible height approx 40vh, but keep aspects reasonable */}
          <div className="lg:col-span-7 h-[45vh] lg:h-[calc(100vh-140px)] min-h-[300px] order-1 lg:order-2">
            <div className="w-full h-full relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white/30 backdrop-blur-sm group bg-gray-200/50">
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent z-10 pointer-events-none"></div>
              {!state.isLoading && state.outfit && (
                <button onClick={handleRefreshImage} disabled={state.isImageLoading} className="absolute top-4 right-4 z-30 p-2 bg-white/20 backdrop-blur-md border border-white/40 rounded-full text-white hover:bg-white/40 transition-colors shadow-lg disabled:opacity-50">
                  <div className={`${state.isImageLoading ? 'animate-spin' : ''}`}><RefreshIcon /></div>
                </button>
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                 {(state.isLoading || state.isImageLoading) && (
                   <div className="flex flex-col items-center z-20">
                      <div className="w-16 h-16 border-4 border-white/80 border-t-transparent rounded-full animate-spin mb-4 shadow-lg"></div>
                      <div className="text-white font-medium text-lg text-shadow-sm animate-pulse">{state.isImageLoading ? text.regenerating : text.loading}</div>
                   </div>
                 )}
                 {!state.isLoading && (
                   <img src={state.characterImageUrl || `https://picsum.photos/800/1000?random=${state.city}`} alt="Outfit Preview" className={`w-full h-full object-cover object-center transform transition-transform duration-700 ${state.isImageLoading ? 'scale-105 blur-sm' : 'group-hover:scale-105 blur-0'}`} loading="lazy"/>
                 )}
              </div>
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

          {/* Left Column (Text Content) - Mobile Order 2 */}
          <div className="lg:col-span-5 flex flex-col gap-6 order-2 lg:order-1">
            {/* Weather Card */}
            <div className="relative bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-lg animate-fade-in hover:shadow-xl transition-shadow">
               <div className="flex justify-between items-start">
                 <div>
                   <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">{text.weatherTitle}</h2>
                   <h1 className="text-3xl font-bold text-gray-800 break-words">{state.weather?.city || '...'}</h1>
                 </div>
                 <div className="text-right flex-shrink-0 ml-2">
                   <div className="text-4xl font-light text-gray-900">{state.weather?.temp ?? '--'}°</div>
                   <div className="text-sm text-gray-600">{state.weather?.condition}</div>
                 </div>
               </div>
               <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-gray-700 bg-white/30 rounded-xl p-3">
                  <div className="flex items-center gap-2"><span>💧 {text.humidity}: {state.weather?.humidity ?? '--'}%</span></div>
                  <div className="flex items-center gap-2"><span>🌬️ Wind: Low</span></div>
               </div>
            </div>

            {/* Outfit Card */}
            <div className="w-full bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-lg animate-slide-up hover:shadow-xl transition-shadow flex flex-col justify-center min-h-[250px] lg:flex-1">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-200/50 pb-2">{text.outfitTitle}</h2>
              {state.isLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-4 opacity-70 py-4">
                  <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm animate-pulse">{text.loading}</p>
                </div>
              ) : state.outfit ? (
                <div className="space-y-4">
                  <div className="space-y-1"><span className="text-xs font-bold text-gray-500 uppercase">{text.top}</span><p className="text-lg font-medium text-gray-800 leading-snug">{state.outfit.top}</p></div>
                  <div className="space-y-1"><span className="text-xs font-bold text-gray-500 uppercase">{text.bottom}</span><p className="text-lg font-medium text-gray-800 leading-snug">{state.outfit.bottom}</p></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><span className="text-xs font-bold text-gray-500 uppercase">{text.shoes}</span><p className="text-base text-gray-800">{state.outfit.shoes}</p></div>
                    <div className="space-y-1"><span className="text-xs font-bold text-gray-500 uppercase">{text.acc}</span><p className="text-base text-gray-800">{state.outfit.accessories.join(', ')}</p></div>
                  </div>
                  <div className="mt-4 p-3 bg-white/50 rounded-xl border border-white/40"><p className="text-sm text-gray-600 italic">" {state.outfit.reasoning} "</p></div>
                </div>
              ) : (<div className="h-40 flex items-center justify-center text-gray-400">Select city...</div>)}
            </div>
          </div>

        </div>
      </main>

      {/* --- Settings Modal --- */}
      {state.showSettings && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={toggleSettings}></div>
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-xl p-0 relative animate-slide-up border border-white/50 max-h-[90vh] overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="p-6 pb-2 flex justify-between items-center border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <SettingsIcon /> {text.settings}
                </h2>
                <button onClick={toggleSettings} className="text-gray-400 hover:text-gray-600 p-2"><CloseIcon /></button>
            </div>

            {/* Tabs */}
            <div className="flex p-2 bg-gray-50 mx-4 mt-4 rounded-xl">
                <button 
                    onClick={() => setTempSettings({ ...tempSettings, mode: 'official' })}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${tempSettings.mode === 'official' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    {text.tabOfficial}
                </button>
                <button 
                    onClick={() => setTempSettings({ 
                        ...tempSettings, 
                        mode: 'custom',
                        baseUrl: tempSettings.baseUrl || 'https://vip.apiyi.com/'
                    })}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${tempSettings.mode === 'custom' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    {text.tabCustom}
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto flex-1">
                {tempSettings.mode === 'official' ? (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                            <div className="p-2 bg-white rounded-full text-blue-500 shadow-sm">
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.545,10.539h-4.09v2.922h4.09c-0.158,1.474-1.393,2.623-2.909,2.623c-1.614,0-2.922-1.309-2.922-2.922 c0-1.614,1.309-2.922,2.922-2.922c0.74,0,1.416,0.278,1.944,0.732l2.094-2.094C12.59,7.925,11.37,7.239,10,7.239 c-3.228,0-5.845,2.617-5.845,5.845s2.617,5.845,5.845,5.845c2.932,0,5.437-2.126,5.845,5.845,5.808-4.99H12.545L12.545,10.539z"/></svg>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-blue-900">Google Official</h3>
                                <p className="text-xs text-blue-700 mt-1 leading-relaxed">{text.officialDesc}</p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{text.apiKey}</label>
                            <input 
                                type="password" 
                                value={tempSettings.apiKey}
                                onChange={e => setTempSettings({...tempSettings, apiKey: e.target.value})}
                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                placeholder={process.env.API_KEY ? "Loaded from system environment" : "Paste your Google AI Studio Key"}
                            />
                            {process.env.API_KEY && !tempSettings.apiKey && (
                                <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                                    <CheckIcon /> System Key Loaded
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{text.officialModel}</label>
                            <div className="grid grid-cols-1 gap-2">
                                {OFFICIAL_MODELS.map((m) => (
                                    <button
                                        key={m.id}
                                        onClick={() => setTempSettings({ ...tempSettings, imageModel: m.id })}
                                        className={`px-4 py-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                                        tempSettings.imageModel === m.id 
                                            ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500' 
                                            : 'border-gray-200 bg-gray-50 hover:bg-white hover:border-gray-300'
                                        }`}
                                    >
                                        <span className="font-medium text-sm">{m.name}</span>
                                        {tempSettings.imageModel === m.id && <span className="text-blue-500"><CheckIcon /></span>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 flex items-start gap-3">
                             <div className="p-2 bg-white rounded-full text-purple-500 shadow-sm">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                             </div>
                             <div>
                                <h3 className="text-sm font-bold text-purple-900">Custom / 3rd Party</h3>
                                <p className="text-xs text-purple-700 mt-1 leading-relaxed">{text.customDesc}</p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{text.baseUrl}</label>
                            <input 
                                type="text" 
                                value={tempSettings.baseUrl}
                                onChange={e => setTempSettings({...tempSettings, baseUrl: e.target.value})}
                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                placeholder={text.customUrlHint}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{text.apiKey}</label>
                            <input 
                                type="password" 
                                value={tempSettings.apiKey}
                                onChange={e => setTempSettings({...tempSettings, apiKey: e.target.value})}
                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                placeholder="sk-..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{text.model}</label>
                            <div className="relative">
                                <select 
                                    value={CUSTOM_MODEL_PRESETS.some(m => m.id === tempSettings.imageModel) ? tempSettings.imageModel : 'custom'}
                                    onChange={(e) => {
                                        if (e.target.value === 'custom') {
                                            setTempSettings({...tempSettings, imageModel: ''});
                                        } else {
                                            setTempSettings({...tempSettings, imageModel: e.target.value});
                                        }
                                    }}
                                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 appearance-none"
                                >
                                    {CUSTOM_MODEL_PRESETS.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                    <option value="custom">Custom / Manually Enter...</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                            
                            {(!CUSTOM_MODEL_PRESETS.some(m => m.id === tempSettings.imageModel)) && (
                                <input 
                                    type="text" 
                                    value={tempSettings.imageModel}
                                    onChange={e => setTempSettings({...tempSettings, imageModel: e.target.value})}
                                    className="w-full mt-2 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 animate-fade-in"
                                    placeholder={text.customModelHint}
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-6 pt-2 bg-white border-t border-gray-100 z-10">
                 {/* Test Connection Button */}
                 <div className="mb-3">
                    <button
                        onClick={runConnectionTest}
                        disabled={testStatus === 'testing' || !tempSettings.apiKey || (tempSettings.mode === 'custom' && !tempSettings.baseUrl)}
                        className={`w-full py-2 rounded-lg text-sm font-medium border flex items-center justify-center gap-2 transition-colors ${
                            testStatus === 'success' ? 'bg-green-50 text-green-700 border-green-200' :
                            testStatus === 'fail' ? 'bg-red-50 text-red-700 border-red-200' :
                            'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                        }`}
                    >
                        {testStatus === 'testing' ? (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        ) : testStatus === 'success' ? (
                            <CheckIcon />
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        )}
                        
                        {testStatus === 'idle' ? text.testConn : 
                        testStatus === 'testing' ? 'Testing...' :
                        testStatus === 'success' ? text.testSuccess : text.testFail}
                    </button>
                    {testStatus === 'fail' && (
                        <p className="text-xs text-red-500 mt-2 text-center animate-pulse">{testMsg}</p>
                    )}
                </div>

                <button 
                    onClick={saveSettings}
                    disabled={tempSettings.mode === 'custom' && !tempSettings.baseUrl}
                    className={`w-full py-3 text-white rounded-xl font-medium shadow-lg transition-all active:scale-95 ${
                        tempSettings.mode === 'official' 
                        ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30' 
                        : 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
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
