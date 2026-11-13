export type Mood = 'rain' | 'night' | 'autumn' | 'sakura';

export interface Theme {
  id: Mood;
  icon: string;
  label: string;
  color: string;
}

export const THEMES: Theme[] = [
  { id: 'rain', icon: '☔', label: 'Дождик', color: '#5d6b8f' },
  { id: 'night', icon: '🌙', label: 'Ночь', color: '#2b2350' },
  { id: 'autumn', icon: '🍂', label: 'Осень', color: '#8a5a6a' },
  { id: 'sakura', icon: '🌸', label: 'Сакура', color: '#c98aa8' },
];
