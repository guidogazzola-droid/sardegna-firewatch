import { useColorScheme } from "react-native";

export interface AppTheme {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  accentSoft: string;
  success: string;
  warning: string;
  danger: string;
  tabBar: string;
}

const lightTheme: AppTheme = {
  background: "#f4f6f8",
  surface: "#ffffff",
  surfaceMuted: "#eef2f5",
  text: "#172026",
  textMuted: "#5f6b73",
  border: "#dce3e8",
  accent: "#0b6e4f",
  accentSoft: "#dff2ea",
  success: "#18794e",
  warning: "#a15c00",
  danger: "#b42318",
  tabBar: "#ffffff",
};

const darkTheme: AppTheme = {
  background: "#0e1418",
  surface: "#172026",
  surfaceMuted: "#202b32",
  text: "#f5f7f8",
  textMuted: "#aab5bc",
  border: "#334149",
  accent: "#63d4ad",
  accentSoft: "#143c31",
  success: "#63d4ad",
  warning: "#f2b45f",
  danger: "#ff8a80",
  tabBar: "#172026",
};

export function useAppTheme(): AppTheme {
  return useColorScheme() === "dark" ? darkTheme : lightTheme;
}

export const severityColors = {
  critical: "#8f1d14",
  high: "#d9481f",
  medium: "#e89a20",
  low: "#4d7c6b",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;
