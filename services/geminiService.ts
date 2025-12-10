
import { GoogleGenAI, Type } from "@google/genai";
import { OutfitData, Gender, WeatherData, Language, AppSettings } from "../types";

// Helper to check API Key safely and initialize client with dynamic settings
const getClient = (settings?: AppSettings) => {
  try {
    // 1. 优先使用用户设置的 Key
    let apiKey = settings?.apiKey;
    
    // 2. 如果没有用户设置，尝试使用环境变量
    if (!apiKey && typeof process !== 'undefined') {
      apiKey = process.env?.API_KEY;
    }

    if (!apiKey) {
      console.warn("API Key missing. Using fallback mode.");
      return null;
    }

    // 构造配置对象
    const clientConfig: any = { apiKey };
    
    // 3. 处理 Base URL (关键修复：去除末尾斜杠，防止双重斜杠导致 404)
    if (settings?.baseUrl && settings.baseUrl.trim() !== "") {
      let url = settings.baseUrl.trim();
      if (url.endsWith('/')) {
        url = url.slice(0, -1);
      }
      clientConfig.baseUrl = url;
    }

    return new GoogleGenAI(clientConfig);
  } catch (e) {
    console.warn("Failed to initialize AI client:", e);
    return null;
  }
};

export const generateOutfitAdvice = async (
  weather: WeatherData,
  gender: Gender,
  language: Language,
  settings?: AppSettings
): Promise<OutfitData> => {
  const fallbackData: OutfitData = {
    top: gender === 'male' ? "Classic White T-Shirt" : "Floral Blouse",
    bottom: gender === 'male' ? "Dark Denim Jeans" : "Pleated Midi Skirt",
    shoes: "White Canvas Sneakers",
    accessories: ["Canvas Tote Bag", "Simple Watch"],
    reasoning: language === 'zh' 
      ? "由于网络原因或未配置API，为您推荐这套经典百搭的舒适校园穿搭。" 
      : "Due to network issues or missing API key, here is a classic, comfortable campus outfit."
  };

  try {
    const ai = getClient(settings);
    if (!ai) return fallbackData;

    const prompt = `
      You are a trendy fashion stylist for college students.
      Context:
      - Weather: ${weather.temp}°C, ${weather.condition} in ${weather.city}.
      - User: College Student, Gender: ${gender}.
      - Language: ${language === 'zh' ? 'Chinese (Simplified)' : 'English'}.
      
      Task: Suggest a stylish, comfortable, and practical outfit for classes and campus life.
      Return JSON only.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            top: { type: Type.STRING, description: "Description of the top (shirt/jacket)" },
            bottom: { type: Type.STRING, description: "Description of trousers/skirt" },
            shoes: { type: Type.STRING, description: "Description of shoes" },
            accessories: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "List of 1-2 accessories" 
            },
            reasoning: { type: Type.STRING, description: "Short stylistic reason (max 1 sentence)" }
          },
          required: ["top", "bottom", "shoes", "accessories", "reasoning"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as OutfitData;
  } catch (error) {
    console.error("Outfit gen error:", error);
    return fallbackData;
  }
};

export const generateCharacterImage = async (
  outfit: OutfitData,
  gender: Gender,
  weather: WeatherData,
  settings?: AppSettings
): Promise<string> => {
  // Always return a high quality random placeholder on error or missing key
  const seed = Math.floor(Math.random() * 1000);
  const fallbackImage = `https://picsum.photos/seed/${seed}/800/1000`;

  try {
    const ai = getClient(settings);
    if (!ai) return fallbackImage;
  
    // 使用用户配置的模型，或者默认使用 flash-image
    const modelName = settings?.imageModel && settings.imageModel.trim() !== "" 
      ? settings.imageModel 
      : "gemini-2.5-flash-image";

    const prompt = `
      A 3D rendered character design of a cute ${gender} college student.
      Style: Pixar-like, high quality, 3D illustration, soft lighting, vibrant colors.
      Outfit: Wearing ${outfit.top}, ${outfit.bottom}, and ${outfit.shoes}.
      Background: Soft blurred abstract gradient.
      Pose: Standing confidently, friendly expression.
      Weather context: ${weather.condition} (if rainy, maybe holding umbrella).
      Full body shot, centered.
    `;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
           return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("No image generated");
  } catch (error) {
    console.error("Image gen error:", error);
    return fallbackImage;
  }
};
