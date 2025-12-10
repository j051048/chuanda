
import { GoogleGenAI } from "@google/genai";
import { OutfitData, Gender, WeatherData, Language, AppSettings } from "../types";

// --- Helpers ---

// Map aliases to real model names
const resolveModelName = (inputModel: string): string => {
  const m = inputModel.toLowerCase().trim();
  if (m === 'nano banana' || m === 'nano-banana' || m === 'gemini flash image') return 'gemini-2.5-flash-image';
  if (m === 'nano banana pro' || m === 'nano-banana-pro' || m === 'nano banana 2' || m === 'gemini pro image') return 'gemini-3-pro-image-preview';
  if (m === 'gemini flash') return 'gemini-flash-latest';
  if (m === 'gemini pro') return 'gemini-3-pro-preview';
  if (!m) return 'gemini-2.5-flash-image';
  return inputModel;
};

// Clean JSON string
const extractJSON = (text: string): any => {
  try {
    return JSON.parse(text);
  } catch (e) {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      try { return JSON.parse(match[1]); } catch (e2) {}
    }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      try { return JSON.parse(text.substring(start, end + 1)); } catch (e3) {}
    }
    throw new Error("Failed to parse JSON response");
  }
};

// Extract image data from standard Google Response structure
const extractImageFromResponse = (response: any): string => {
  // Handle SDK response object or Raw JSON response
  const candidates = response.candidates || response.response?.candidates;
  
  if (candidates?.[0]?.content?.parts) {
    for (const part of candidates[0].content.parts) {
      if (part.inlineData && part.inlineData.data) {
         return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    const textPart = candidates[0].content.parts.find((p: any) => p.text);
    if (textPart?.text) {
      throw new Error(`Model Refused: ${textPart.text.substring(0, 100)}...`);
    }
  }
  throw new Error("Model returned no image data.");
};

// --- Core API Logic ---

// 1. Official Mode: Use Google SDK
const callOfficialSdk = async (model: string, contents: any, apiKey: string) => {
  const ai = new GoogleGenAI({ apiKey });
  return await ai.models.generateContent({ model, contents });
};

// 2. Custom Mode: Use Native Fetch (Fixes 400 errors on proxies)
const callCustomFetch = async (settings: AppSettings, model: string, contents: any) => {
  let baseUrl = settings.baseUrl.trim();
  let apiKey = settings.apiKey.trim();
  
  // Clean Key
  if (apiKey.toLowerCase().startsWith('bearer ')) {
    apiKey = apiKey.substring(7).trim();
  }

  // URL Normalization
  // If user inputs "https://api.proxy.com/v1", we usually need to strip "/v1" 
  // and append "/v1beta/models/..." for Google Native format
  if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
  if (baseUrl.endsWith('/v1')) baseUrl = baseUrl.slice(0, -3); // Strip OpenAI suffix
  if (baseUrl.endsWith('/v1beta')) baseUrl = baseUrl.slice(0, -7);

  // Construct Endpoint
  const endpoint = `${baseUrl}/v1beta/models/${model}:generateContent`;

  // Construct Body (Google Native Format)
  // contents can be string or object. Convert to array of parts if string.
  let formattedContents = contents;
  if (typeof contents === 'string') {
    formattedContents = { parts: [{ text: contents }] };
  } else if (contents.parts) {
      // Already formatted object
      formattedContents = contents;
  }

  const payload = {
    contents: [formattedContents]
  };

  // EXECUTE FETCH
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Critical: Proxies identify user via this header, NOT query param
      'Authorization': `Bearer ${apiKey}` 
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    let errMsg = `Error ${response.status}`;
    try {
        const errJson = JSON.parse(errText);
        if (errJson.error && errJson.error.message) errMsg += `: ${errJson.error.message}`;
    } catch (e) {
        errMsg += `: ${errText.substring(0, 100)}`;
    }
    throw new Error(errMsg);
  }

  return await response.json();
};

// --- Exported Services ---

export const testConnection = async (settings: AppSettings): Promise<{ success: boolean; message: string }> => {
  try {
    if (!settings.apiKey) return { success: false, message: "API Key missing" };

    const model = "gemini-2.5-flash";
    const prompt = "Hi";

    if (settings.mode === 'custom') {
      await callCustomFetch(settings, model, prompt);
    } else {
      await callOfficialSdk(model, prompt, settings.apiKey);
    }

    return { success: true, message: "Connection Successful!" };
  } catch (e: any) {
    console.error("Connection Test Error:", e);
    let msg = e.message || "Unknown error";
    
    if (msg.includes("404")) msg = "404 Not Found. Check Base URL.";
    if (msg.includes("401") || msg.includes("403")) msg = "Auth Failed. Check API Key.";
    if (msg.includes("Failed to fetch")) msg = "Network Error. Check CORS or URL.";

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
    if (!settings?.apiKey) return fallbackData;

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

    let response: any;
    if (settings.mode === 'custom') {
      response = await callCustomFetch(settings, "gemini-2.5-flash", prompt);
    } else {
      response = await callOfficialSdk("gemini-2.5-flash", prompt, settings.apiKey);
    }

    // Handle standard Google response text extraction
    let text = "";
    const candidates = response.candidates || response.response?.candidates; // Handle SDK vs Raw JSON diffs
    if (candidates && candidates[0]?.content?.parts?.[0]?.text) {
        text = candidates[0].content.parts[0].text;
    } else if (response.text && typeof response.text === 'string') {
        // SDK property shortcut
        text = response.text;
    } else if (typeof response.text === 'function') {
        // SDK method shortcut (rare in new versions but safe)
        text = response.text();
    }

    if (!text) throw new Error("Empty response from AI");
    
    return extractJSON(text) as OutfitData;
  } catch (error: any) {
    console.error("Outfit gen error details:", error);
    throw error;
  }
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
    if (!settings?.apiKey) return fallbackImage;
  
    const userModel = settings?.imageModel || '';
    const preferredModel = resolveModelName(userModel);

    const prompt = `
      High quality 3D cute character, ${gender} college student.
      Wearing ${outfit.top}, ${outfit.bottom}, ${outfit.shoes}.
      Style: Pixar 3D, soft lighting, 4k.
      Background: Blurred abstract.
      Full body shot.
    `;

    const makeCall = async (modelName: string) => {
        if (settings.mode === 'custom') {
            return await callCustomFetch(settings, modelName, prompt);
        } else {
            return await callOfficialSdk(modelName, prompt, settings.apiKey);
        }
    };

    try {
        const response = await makeCall(preferredModel);
        return extractImageFromResponse(response);
    } catch (firstError: any) {
        // Handle 404/Not Found - Retry with flash-image
        const msg = firstError.message || '';
        const is404 = msg.includes('404') || msg.includes('not found') || msg.includes('NOT_FOUND');
        
        if (is404) {
            console.warn(`Model '${preferredModel}' failed (404). Retrying with 'gemini-2.5-flash-image'.`);
            const retryResponse = await makeCall('gemini-2.5-flash-image');
            return extractImageFromResponse(retryResponse);
        }
        throw firstError;
    }
  } catch (error: any) {
    console.error("Image gen error details:", error);
    throw error;
  }
};
