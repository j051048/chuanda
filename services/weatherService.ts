import { WeatherData } from '../types';

// 常用城市兜底数据，防止 Geocoding API 偶尔失效或网络问题
// Expanded to include Chinese keys for robust fallback
const FALLBACK_CITIES: Record<string, { lat: number; lng: number; name: string; country: string }> = {
  // English Keys
  'shanghai': { lat: 31.2222, lng: 121.4581, name: 'Shanghai', country: 'China' },
  'beijing': { lat: 39.9042, lng: 116.4074, name: 'Beijing', country: 'China' },
  'guangzhou': { lat: 23.1291, lng: 113.2644, name: 'Guangzhou', country: 'China' },
  'shenzhen': { lat: 22.5431, lng: 114.0579, name: 'Shenzhen', country: 'China' },
  'hong kong': { lat: 22.3193, lng: 114.1694, name: 'Hong Kong', country: 'China' },
  'hangzhou': { lat: 30.2741, lng: 120.1551, name: 'Hangzhou', country: 'China' },
  'chengdu': { lat: 30.5728, lng: 104.0668, name: 'Chengdu', country: 'China' },
  'wuhan': { lat: 30.5928, lng: 114.3055, name: 'Wuhan', country: 'China' },
  'new york': { lat: 40.7128, lng: -74.0060, name: 'New York', country: 'USA' },
  'london': { lat: 51.5074, lng: -0.1278, name: 'London', country: 'UK' },
  'tokyo': { lat: 35.6762, lng: 139.6503, name: 'Tokyo', country: 'Japan' },
  'paris': { lat: 48.8566, lng: 2.3522, name: 'Paris', country: 'France' },
  'sydney': { lat: -33.8688, lng: 151.2093, name: 'Sydney', country: 'Australia' },
  
  // Chinese Keys (Mapping common inputs to same coordinates)
  '上海': { lat: 31.2222, lng: 121.4581, name: 'Shanghai', country: 'China' },
  '北京': { lat: 39.9042, lng: 116.4074, name: 'Beijing', country: 'China' },
  '广州': { lat: 23.1291, lng: 113.2644, name: 'Guangzhou', country: 'China' },
  '深圳': { lat: 22.5431, lng: 114.0579, name: 'Shenzhen', country: 'China' },
  '香港': { lat: 22.3193, lng: 114.1694, name: 'Hong Kong', country: 'China' },
  '杭州': { lat: 30.2741, lng: 120.1551, name: 'Hangzhou', country: 'China' },
  '成都': { lat: 30.5728, lng: 104.0668, name: 'Chengdu', country: 'China' },
  '武汉': { lat: 30.5928, lng: 114.3055, name: 'Wuhan', country: 'China' },
  '纽约': { lat: 40.7128, lng: -74.0060, name: 'New York', country: 'USA' },
  '伦敦': { lat: 51.5074, lng: -0.1278, name: 'London', country: 'UK' },
  '东京': { lat: 35.6762, lng: 139.6503, name: 'Tokyo', country: 'Japan' },
  '巴黎': { lat: 48.8566, lng: 2.3522, name: 'Paris', country: 'France' },
  '悉尼': { lat: -33.8688, lng: 151.2093, name: 'Sydney', country: 'Australia' },
};

export const fetchWeather = async (city: string): Promise<WeatherData> => {
  let latitude: number;
  let longitude: number;
  let cityName: string;
  let countryName: string = '';

  try {
    // 1. 尝试使用 Geocoding API
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
    const geoResponse = await fetch(geoUrl);
    
    // 如果响应不OK，直接抛出，进入 catch 尝试兜底
    if (!geoResponse.ok) throw new Error("Geocoding API unavailable");
    
    const geoData = await geoResponse.json();
    
    if (geoData.results && geoData.results.length > 0) {
      const result = geoData.results[0];
      latitude = result.latitude;
      longitude = result.longitude;
      cityName = result.name;
      countryName = result.country || '';
    } else {
      throw new Error("City not found in API");
    }
  } catch (error) {
    console.warn("Geocoding API failed, checking fallback:", error);
    // 2. API 失败时，检查兜底列表
    const normalizedCity = city.trim().toLowerCase();
    const fallback = FALLBACK_CITIES[normalizedCity];
    
    if (fallback) {
      latitude = fallback.lat;
      longitude = fallback.lng;
      cityName = fallback.name;
      countryName = fallback.country;
    } else {
      // 确实找不到，抛出错误
      throw new Error(`City not found: ${city}`);
    }
  }

  try {
    // 3. 使用获得的经纬度查询实时天气
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code&wind_speed_unit=ms`;
    
    const weatherResponse = await fetch(weatherUrl);
    if (!weatherResponse.ok) throw new Error("Weather API unavailable");
    
    const weatherData = await weatherResponse.json();
    const current = weatherData.current;
    
    const weatherCode = current.weather_code;
    let condition = "Sunny";
    
    // 简化天气代码映射
    if (weatherCode <= 3) condition = "Sunny/Cloudy";
    else if (weatherCode <= 48) condition = "Foggy";
    else if (weatherCode <= 67) condition = "Rainy";
    else if (weatherCode <= 77) condition = "Snowy";
    else if (weatherCode <= 82) condition = "Rainy";
    else if (weatherCode <= 86) condition = "Snowy";
    else condition = "Stormy";

    return {
      city: `${cityName}${countryName ? ', ' + countryName : ''}`,
      temp: Math.round(current.temperature_2m),
      condition: condition,
      humidity: current.relative_humidity_2m,
    };
  } catch (error) {
    console.error("Weather data fetch failed:", error);
    // 最后的防线：如果所有尝试都失败，返回一个默认天气数据，避免页面报错
    return {
       city: `${cityName}${countryName ? ', ' + countryName : ''}`,
       temp: 22,
       condition: "Sunny",
       humidity: 50
    };
  }
};