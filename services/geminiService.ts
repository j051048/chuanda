import { GoogleGenAI, Type } from "@google/genai";
import { OutfitData, Gender, WeatherData, Language } from "../types";

// Helper to check API Key
const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("Missing API Key");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateOutfitAdvice = async (
  weather: WeatherData,
  gender: Gender,
  language: Language
): Promise<OutfitData> => {
  const ai = getClient();
  
  const prompt = `
    You are a trendy fashion stylist for college students.
    Context:
    - Weather: ${weather.temp}°C, ${weather.condition} in ${weather.city}.
    - User: College Student, Gender: ${gender}.
    - Language: ${language === 'zh' ? 'Chinese (Simplified)' : 'English'}.
    
    Task: Suggest a stylish, comfortable, and practical outfit for classes and campus life.
    Return JSON only.
  `;

  try {
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
    // Fallback
    return {
      top: "Casual Hoodie",
      bottom: "Jeans",
      shoes: "Sneakers",
      accessories: ["Backpack"],
      reasoning: "Failed to connect to AI stylist."
    };
  }
};

export const generateCharacterImage = async (
  outfit: OutfitData,
  gender: Gender,
  weather: WeatherData
): Promise<string> => {
  const ai = getClient();
  
  const prompt = `
    A 3D rendered character design of a cute ${gender} college student.
    Style: Pixar-like, high quality, 3D illustration, soft lighting, vibrant colors.
    Outfit: Wearing ${outfit.top}, ${outfit.bottom}, and ${outfit.shoes}.
    Background: Soft blurred abstract gradient.
    Pose: Standing confidently, friendly expression.
    Weather context: ${weather.condition} (if rainy, maybe holding umbrella).
    Full body shot, centered.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image", // Using flash-image for speed
      contents: prompt,
    });

    // Extract image from response
    // Per documentation: "The output response may contain both image and text parts"
    // We need to find the inlineData part.
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
    // Fallback placeholder
    return `https://picsum.photos/seed/${outfit.top}/600/800`;
  }
};