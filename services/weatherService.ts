import { WeatherData } from '../types';

export const fetchWeather = async (city: string): Promise<WeatherData> => {
  try {
    // 1. 使用 Geocoding API 将城市名转换为经纬度
    // API文档: https://open-meteo.com/en/docs/geocoding-api
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
    const geoResponse = await fetch(geoUrl);
    
    if (!geoResponse.ok) {
      throw new Error("地理位置服务暂不可用");
    }
    
    const geoData = await geoResponse.json();
    
    // 如果没有找到结果
    if (!geoData.results || geoData.results.length === 0) {
      throw new Error("City not found");
    }

    const { latitude, longitude, name, country } = geoData.results[0];

    // 2. 使用获得的经纬度查询实时天气
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code&wind_speed_unit=ms`;
    
    const weatherResponse = await fetch(weatherUrl);
    
    if (!weatherResponse.ok) {
      throw new Error("天气服务暂不可用");
    }
    
    const weatherData = await weatherResponse.json();
    const current = weatherData.current;
    
    // 将 WMO 天气代码转换为可读文本
    const weatherCode = current.weather_code;
    let condition = "Sunny";
    
    if (weatherCode === 0) condition = "Sunny";
    else if (weatherCode >= 1 && weatherCode <= 3) condition = "Cloudy";
    else if (weatherCode >= 45 && weatherCode <= 48) condition = "Foggy";
    else if (weatherCode >= 51 && weatherCode <= 67) condition = "Rainy";
    else if (weatherCode >= 71 && weatherCode <= 77) condition = "Snowy";
    else if (weatherCode >= 80 && weatherCode <= 82) condition = "Rainy";
    else if (weatherCode >= 85 && weatherCode <= 86) condition = "Snowy";
    else if (weatherCode >= 95) condition = "Stormy";

    return {
      // 返回 API 解析出的规范城市名和国家，提升展示效果
      city: `${name}${country ? ', ' + country : ''}`,
      temp: Math.round(current.temperature_2m),
      condition: condition,
      humidity: current.relative_humidity_2m,
    };
  } catch (error) {
    console.error("Weather fetch failed", error);
    // 抛出错误以便 UI 层展示给用户
    throw error;
  }
};