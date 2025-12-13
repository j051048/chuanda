
import { OutfitData, Gender, WeatherData, Language, AppSettings } from "../types";

// PROXY CONFIGURATION
const FLYDAO_PROXY_URL = 'https://proxy-12-13.vercel.app/v1';

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

// --- API Implementation ---

// 1. OpenAI Protocol (For FLYDAO Official Proxy)
// The proxy at h5-proxy.vercel.app is an OpenAI-compatible gateway (OneAPI/NewAPI).
// It requires "messages" for text and "prompt" for images, and a non-empty Auth header.

const fetchOpenAIChat = async (model: string, systemPrompt: string, userPrompt: string, apiKey?: string) => {
    const endpoint = `${FLYDAO_PROXY_URL}/chat/completions`;
    const token = apiKey?.trim() || 'sk-flydao';
    
    const payload = {
        model: model,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        temperature: 0.7
    };

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`FLYDAO Chat Error ${response.status}: ${errText.substring(0, 100)}`);
    }

    const json = await response.json();
    return json.choices?.[0]?.message?.content || "";
};

const fetchOpenAIImage = async (model: string, prompt: string, apiKey?: string) => {
    const endpoint = `${FLYDAO_PROXY_URL}/images/generations`;
    const token = apiKey?.trim() || 'sk-flydao';

    const payload = {
        model: model, 
        prompt: prompt,
        n: 1,
        size: "1024x1024", // Standard OpenAI param, might be ignored by Gemini backend but required by schema
        response_format: "b64_json"
    };

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        // Fallback: If image endpoint fails (404/400), sometimes these proxies allow image gen via Chat
        // But for now, throw to let the UI handle it.
        const errText = await response.text();
        throw new Error(`FLYDAO Image Error ${response.status}: ${errText.substring(0, 100)}`);
    }

    const json = await response.json();
    // Support both b64_json (preferred) and url
    const dataObj = json.data?.[0];
    if (dataObj?.b64_json) {
        return `data:image/png;base64,${dataObj.b64_json}`;
    } else if (dataObj?.url) {
        return dataObj.url;
    }
    throw new Error("No image data in OpenAI response");
};


// 2. Google Native Protocol (For Custom Mode)
// Users might paste a direct Google API base URL or a Google-compatible proxy.
const callCustomGoogleFetch = async (settings: AppSettings, model: string, contents: any) => {
  let baseUrl = settings.baseUrl.trim();
  let apiKey = settings.apiKey.trim();
  
  if (apiKey.toLowerCase().startsWith('bearer ')) {
    apiKey = apiKey.substring(7).trim();
  }

  // URL Normalization for Google Native
  if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
  if (baseUrl.endsWith('/v1')) baseUrl = baseUrl.slice(0, -3); 
  if (baseUrl.endsWith('/v1beta')) baseUrl = baseUrl.slice(0, -7);

  const endpoint = `${baseUrl}/v1beta/models/${model}:generateContent`;

  let formattedContents = contents;
  if (typeof contents === 'string') {
    formattedContents = { parts: [{ text: contents }] };
  } else if (contents.parts) {
      formattedContents = contents;
  }

  const payload = {
    contents: [formattedContents]
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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

  const json = await response.json();
  
  // Extract text or image from Google response
  return json;
};

// --- Exported Services ---

export const testConnection = async (settings: AppSettings): Promise<{ success: boolean; message: string }> => {
  try {
    if (settings.mode === 'custom' && !settings.apiKey) {
        return { success: false, message: "API Key missing" };
    }

    const model = "gemini-2.5-flash";
    const prompt = "Hi";

    if (settings.mode === 'custom') {
      await callCustomGoogleFetch(settings, model, prompt);
    } else {
      // Official / FLYDAO mode -> OpenAI Protocol
      await fetchOpenAIChat(model, "You are a helper.", prompt, settings.apiKey);
    }

    return { success: true, message: "Connection Successful!" };
  } catch (e: any) {
    console.error("Connection Test Error:", e);
    let msg = e.message || "Unknown error";
    
    if (msg.includes("404")) msg = "404 Not Found. Check URL.";
    if (msg.includes("401") || msg.includes("403")) msg = "Auth Failed.";
    if (msg.includes("Failed to fetch")) msg = "Network Error.";

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
      ? "由于网络原因，为您推荐这套经典百搭的舒适校园穿搭。" 
      : "Due to network issues, here is a classic, comfortable campus outfit."
  };

  try {
    if (settings?.mode === 'custom' && !settings.apiKey) return fallbackData;
    if (!settings) return fallbackData;

    const systemPrompt = "You are a trendy fashion stylist. Return ONLY valid JSON.";
    const userPrompt = `
      Context: Weather ${weather.temp}°C ${weather.condition}, City ${weather.city}, User ${gender}, Lang ${language}.
      Task: Suggest a stylish outfit.
      Format:
      {
        "top": "string",
        "bottom": "string",
        "shoes": "string",
        "accessories": ["string"],
        "reasoning": "string"
      }
    `;

    let responseText = "";

    if (settings.mode === 'custom') {
      const json = await callCustomGoogleFetch(settings, "gemini-2.5-flash", userPrompt);
      const candidates = json.candidates || json.response?.candidates;
      if (candidates && candidates[0]?.content?.parts?.[0]?.text) {
        responseText = candidates[0].content.parts[0].text;
      }
    } else {
      // Official - OpenAI Chat
      responseText = await fetchOpenAIChat("gemini-2.5-flash", systemPrompt, userPrompt, settings.apiKey);
    }

    if (!responseText) throw new Error("Empty response from AI");
    return extractJSON(responseText) as OutfitData;

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
    if (settings?.mode === 'custom' && !settings.apiKey) return fallbackImage;
    if (!settings) return fallbackImage;
  
    const userModel = settings?.imageModel || '';
    const preferredModel = resolveModelName(userModel);

    const prompt = `
      High quality 3D cute character, ${gender} college student.
      Wearing ${outfit.top}, ${outfit.bottom}, ${outfit.shoes}.
      Style: Pixar 3D, soft lighting, 4k.
      Background: Blurred abstract.
      Full body shot.
    `;

    if (settings.mode === 'custom') {
        // Google Native Protocol
        const response = await callCustomGoogleFetch(settings, preferredModel, prompt);
        // Extract Image Logic for Google
        const candidates = response.candidates || response.response?.candidates;
        if (candidates?.[0]?.content?.parts) {
            for (const part of candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
        throw new Error("Model returned no image data (Google Protocol).");
    } else {
        // Official - OpenAI Image Protocol
        // Note: For OpenAI proxies mapping to Gemini, we often use dall-e-3 endpoint or chat endpoint.
        // Based on "Provide prompt for images" error, we use /images/generations.
        return await fetchOpenAIImage(preferredModel, prompt, settings.apiKey);
    }

  } catch (error: any) {
    console.error("Image gen error details:", error);
    
    // Fallback logic for Official Mode if specific model fails on Image endpoint
    if (settings?.mode === 'official' && error.message.includes("404")) {
         console.warn("Retrying with fallback model via OpenAI protocol...");
         try {
             return await fetchOpenAIImage("dall-e-3", `Character: ${gender}, ${outfit.top}`, settings.apiKey);
         } catch(e) {}
    }
    
    throw error;
  }
};
