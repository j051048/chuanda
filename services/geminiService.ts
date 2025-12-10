import { GoogleGenAI, Type } from "@google/genai";
import { OutfitData, Gender, WeatherData, Language } from "../types";

// Helper to check API Key safely
const getClient = () => {
  try {
    // Ensure process.env exists
    const apiKey = typeof process !== 'undefined' ? process.env?.API_KEY : undefined;
    if (!apiKey) {
      console.warn("API Key missing. Using fallback mode.");
      return null;
    }
    return new GoogleGenAI({ apiKey });
  } catch (e) {
    console.warn("Failed to initialize AI client:", e);
    return null;
  }
};

export const generateOutfitAdvice = async (
  weather: WeatherData,
  gender: Gender,
  language: Language
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
    const ai = getClient();
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
  weather: WeatherData
): Promise<string> => {
  // Always return a high quality random placeholder on error or missing key
  const seed = Math.floor(Math.random() * 1000);
  const fallbackImage = `https://picsum.photos/seed/${seed}/800/1000`;

  try {
    const ai = getClient();
    if (!ai) return fallbackImage;
  
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
      model: "gemini-2.5-flash-image",
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