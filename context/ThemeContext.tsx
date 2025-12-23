import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  colors: ThemeColors;
}

interface ThemeColors {
  background: string;
  text: string;
  card: string;
  border: string;
  primary: string;
  secondary: string;
  accent: string;
  textSecondary: string;
}

const LightColors: ThemeColors = {
  background: '#F5F5F7', // Off-white/Light gray for modern feel
  text: '#1C1C1E',
  card: '#FFFFFF',
  border: '#E5E5EA',
  primary: '#007AFF',
  secondary: '#5856D6',
  accent: '#FF9500',
  textSecondary: '#8E8E93',
};

const DarkColors: ThemeColors = {
  background: '#000000', // Deep black for OLED
  text: '#FFFFFF',
  card: '#1C1C1E', // Dark gray for cards
  border: '#38383A',
  primary: '#0A84FF',
  secondary: '#5E5CE6',
  accent: '#FF9F0A',
  textSecondary: '#8E8E93',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [theme, setTheme] = useState<Theme>(systemScheme === 'dark' ? 'dark' : 'light');

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const colors = theme === 'light' ? LightColors : DarkColors;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
