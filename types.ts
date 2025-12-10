
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

export interface AppSettings {
  apiKey: string;
  baseUrl: string;
  imageModel: string;
}

export interface AppState {
  city: string;
  weather: WeatherData | null;
  outfit: OutfitData | null;
  characterImageUrl: string | null;
  isLoading: boolean;
  isImageLoading: boolean; // 单独控制图片刷新的loading状态
  error: string | null;
  language: Language;
  theme: Theme;
  gender: Gender;
  showSettings: boolean; // 控制设置弹窗显示
  settings: AppSettings; // 用户自定义设置
}

export const THEMES: Record<Theme, string> = {
  blue: 'from-blue-100 to-indigo-200 text-blue-900',
  green: 'from-emerald-100 to-teal-200 text-emerald-900',
  pink: 'from-rose-100 to-pink-200 text-rose-900',
  purple: 'from-violet-100 to-purple-200 text-purple-900',
};
