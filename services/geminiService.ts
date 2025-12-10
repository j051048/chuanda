
import { GoogleGenAI, Type } from "@google/genai";
import { OutfitData, Gender, WeatherData, Language, AppSettings } from "../types";

// Helper to clean JSON string from markdown code blocks
const extractJSON = (text: string): any => {
  try {
    // 1. Try parse directly
    return JSON.parse(text);
  } catch (e) {
    // 2. Try extract from ```json ... ``` or ``` ... ```
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      try {
        return JSON.parse(match[1]);
      } catch (e2) {
        // continue
      }
    }
    // 3. Try finding first { and last }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      try {
        return JSON.parse(text.substring(start, end + 1));
      } catch (e3) {
        throw new Error("Failed to parse JSON response");
      }
    }
    throw new Error("No JSON found in response");
  }
};

// Helper to check API Key safely and initialize client with dynamic settings
const getClient = (settings?: AppSettings) => {
  try {
    // 1. Get raw key from settings or env
    let apiKey = settings?.apiKey;
    
    // Fallback to env if settings key is empty/whitespace
    if ((!apiKey || apiKey.trim() === '') && typeof process !== 'undefined') {
      apiKey = process.env?.API_KEY;
    }

    // 2. Sanitize Key (CRITICAL for 400 errors)
    if (apiKey) {
      // Remove invisible characters, newlines, and strict trim
      apiKey = apiKey.replace(/[\u200B-\u200D\uFEFF]/g, '').trim(); 
      // Remove common prefixes people copy-paste
      if (apiKey.toLowerCase().startsWith('bearer ')) {
        apiKey = apiKey.substring(7).trim();
      }
    }

    if (!apiKey) {
      console.warn("API Key missing.");
      return null;
    }

    // 构造配置对象
    const clientConfig: any = { apiKey };
    
    // 3. 处理 Base URL
    if (settings?.baseUrl && settings.baseUrl.trim() !== "") {
      let url = settings.baseUrl.trim();
      
      // CRITICAL FIX: If user pastes the OFFICIAL Google URL, ignore it.
      // The SDK handles official endpoints better by default. 
      // Manually setting it often causes double-pathing (e.g. /v1beta/v1beta).
      if (url.includes('generativelanguage.googleapis.com')) {
         // Do nothing, let SDK use default
      } else {
          // Remove trailing slash
          if (url.endsWith('/')) {
            url = url.slice(0, -1);
          }
          // Remove version suffix if user accidentally added it (SDK adds it)
          if (url.endsWith('/v1beta') || url.endsWith('/v1')) {
             url = url.replace(/\/v1(beta)?$/, '');
          }
          clientConfig.baseUrl = url;
      }
    }

    return new GoogleGenAI(clientConfig);
  } catch (e) {
    console.warn("Failed to initialize AI client:", e);
    return null;
  }
};

// NEW: Test connection function
export const testConnection = async (settings: AppSettings): Promise<{ success: boolean; message: string }> => {
  try {
    const ai = getClient(settings);
    if (!ai) return { success: false, message: "API Key missing" };
    
    // Simple test query
    await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: "Hi",
    });
    return { success: true, message: "Connection Successful!" };
  } catch (e: any) {
    let msg = e.message || "Unknown error";
    if (msg.includes("400")) msg = "400 Invalid Key. If using a 3rd party key, you MUST set the Base URL.";
    if (msg.includes("404")) msg = "404 Not Found. Check Base URL.";
    return { success: false, message: msg };
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

    // Use a simpler model for text logic if available, or default to flash
    const prompt = `
      You are a trendy fashion stylist.
      Context: Weather ${weather.temp}°C ${weather.condition}, City ${weather.city}, User ${gender}, Lang ${language}.
      Task: Suggest a stylish outfit.
      
      IMPORTANT: Return ONLY valid JSON with this structure, no markdown:
      {
        "top": "string",
        "bottom": "string",
        "shoes": "string",
        "accessories": ["string"],
        "reasoning": "string"
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: prompt,
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    
    return extractJSON(text) as OutfitData;
  } catch (error: any) {
    console.error("Outfit gen error details:", error);
    throw error;
  }
};

// Helper to extract image data from response
const extractImageFromResponse = (response: any): string => {
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData && part.inlineData.data) {
         return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    
    // Check for refusal text
    const textPart = response.candidates[0].content.parts.find((p: any) => p.text);
    if (textPart && textPart.text) {
      throw new Error(`Model Refused: ${textPart.text.substring(0, 100)}...`);
    }
  }
  throw new Error("Model returned no image data.");
};

export const generateCharacterImage = async (
  outfit: OutfitData,
  gender: Gender,
  weather: WeatherData,
  settings?: AppSettings
): Promise<string> => {
  const seed = Math.floor(Math.random() * 1000);
  const fallbackImage = `https://picsum.photos/seed/${seed}/800/1000`;

  try {
    const ai = getClient(settings);
    if (!ai) return fallbackImage;
  
    const preferredModel = settings?.imageModel && settings.imageModel.trim() !== "" 
      ? settings.imageModel 
      : "gemini-2.5-flash-image";

    const prompt = `
      High quality 3D cute character, ${gender} college student.
      Wearing ${outfit.top}, ${outfit.bottom}, ${outfit.shoes}.
      Style: Pixar 3D, soft lighting, 4k.
      Background: Blurred abstract.
      Full body shot.
    `;

    try {
        // Attempt 1: User selected model
        const response = await ai.models.generateContent({
          model: preferredModel,
          contents: prompt,
        });
        return extractImageFromResponse(response);

    } catch (firstError: any) {
        // Handle 404 (Not Found) - Try fallback to official ID
        // This handles cases where user selects "nano-banana" but host only supports "gemini-2.5-flash-image"
        const is404 = firstError.message?.includes('404') || firstError.status === 404 || firstError.message?.includes('not found') || firstError.message?.includes('NOT_FOUND');
        const isNotDefault = preferredModel !== 'gemini-2.5-flash-image';

        if (is404 && isNotDefault) {
            console.warn(`Model '${preferredModel}' failed (404). Retrying with 'gemini-2.5-flash-image'.`);
            const retryResponse = await ai.models.generateContent({
              model: 'gemini-2.5-flash-image',
              contents: prompt,
            });
            return extractImageFromResponse(retryResponse);
        }
        
        throw firstError;
    }

  } catch (error: any) {
    console.error("Image gen error details:", error);
    // Propagate error to let UI show it
    throw error;
  }
};
