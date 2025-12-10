
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

    // 2. Sanitize Key
    if (apiKey) {
      apiKey = apiKey.replace(/[\u200B-\u200D\uFEFF]/g, '').trim(); 
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
    
    // 3. 处理 Base URL (Strict Mode Logic)
    if (settings?.mode === 'custom' && settings?.baseUrl && settings.baseUrl.trim() !== "") {
      let url = settings.baseUrl.trim();
      
      // Ignore official Google URL to prevent conflicts
      if (!url.includes('generativelanguage.googleapis.com')) {
          
          // CRITICAL FIX for 3rd Party Proxies (OneAPI/NewAPI)
          // Scenario: User pastes "https://api.proxy.com/v1" (OpenAI endpoint)
          // Problem: Google SDK needs "https://api.proxy.com" and appends "/v1beta/..."
          // If we leave "/v1", SDK requests ".../v1/v1beta/..." -> 404
          // If we force "v1", requests ".../v1/..." -> Proxy treats as OpenAI -> 400 Bad Request (Invalid Key/Body)
          
          // Solution: 
          // 1. Strip trailing version suffixes (/v1, /v1beta)
          // 2. Default API version to 'v1beta' (standard for Google Native on proxies)
          
          // Remove trailing slash first
          if (url.endsWith('/')) url = url.slice(0, -1);

          if (url.endsWith('/v1')) {
             url = url.substring(0, url.length - 3); // Remove /v1
             clientConfig.apiVersion = 'v1beta'; // Force v1beta, as v1 on proxies is usually OpenAI
          } else if (url.endsWith('/v1beta')) {
             url = url.substring(0, url.length - 7); // Remove /v1beta
             clientConfig.apiVersion = 'v1beta';
          }
          
          // Remove trailing slash again if it existed before suffix
          if (url.endsWith('/')) url = url.slice(0, -1);
          
          clientConfig.baseUrl = url;
      }
    }

    return new GoogleGenAI(clientConfig);
  } catch (e) {
    console.warn("Failed to initialize AI client:", e);
    return null;
  }
};

// Test connection function
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
    console.error("Connection Test Error:", e);
    
    let msg = e.message || "Unknown error";
    
    // Try to parse more details if available
    if (e.response) {
       try {
         const errBody = await e.response.json();
         if (errBody.error && errBody.error.message) {
            msg = `${e.status} ${errBody.error.message}`;
         }
       } catch (jsonErr) {}
    }

    // Provide specific hints based on mode and error type
    if (msg.includes("400")) {
        if (settings.mode === 'official') {
            msg = "400 Error. If using a 3rd party key, switch to 'Custom' tab.";
        } else {
            msg = "400 Bad Request. Provider might not support Google Native Protocol at this URL. Try removing '/v1' or check Key.";
        }
    } else if (msg.includes("404")) {
        msg = "404 Not Found. Check Base URL (try removing /v1) or Model Name.";
    } else if (msg.includes("401") || msg.includes("403")) {
        msg = "Auth Error. Check your API Key.";
    }
    
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
        // Handle 404 - Try fallback only if in official mode
        // In custom mode, 404 means the provider doesn't support the model, fallback to flash-image usually works on proxies too
        const is404 = firstError.message?.includes('404') || firstError.status === 404 || firstError.message?.includes('not found') || firstError.message?.includes('NOT_FOUND');
        
        // If custom mode, try fallback too because 'nano-banana' might be invalid but 'gemini-2.5-flash-image' might work on the proxy
        if (is404) {
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
    throw error;
  }
};
