export type Language = 'zh' | 'en';
export type Gender = 'male' | 'female';
export type Theme = 'blue' | 'green' | 'pink' | 'purple';

export interface WeatherData {
  temp: number;
  condition: string;
  humidity: number;
  city: string;
}

export interface OutfitData {
  top: string;
  bottom: string;
  shoes: string;
  accessories: string[];
  reasoning: string;
}

export interface AppState {
  city: string;
  weather: WeatherData | null;
  outfit: OutfitData | null;
  characterImageUrl: string | null;
  isLoading: boolean;
  error: string | null;
  language: Language;
  theme: Theme;
  gender: Gender;
}

export const THEMES: Record<Theme, string> = {
  blue: 'from-blue-100 to-indigo-200 text-blue-900',
  green: 'from-emerald-100 to-teal-200 text-emerald-900',
  pink: 'from-rose-100 to-pink-200 text-rose-900',
  purple: 'from-violet-100 to-purple-200 text-purple-900',
};