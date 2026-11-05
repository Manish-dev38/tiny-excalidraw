/** Excalidraw-inspired design tokens. */

export type Theme = 'light' | 'dark'

export const STROKE_COLORS = [
  '#1e1e1e',
  '#e03131',
  '#2f9e44',
  '#1971c2',
  '#f08c00',
  '#ffffff',
  '#9c36b5',
  '#1098ad',
  '#f76707',
  '#6d6d6d',
]

/** Distinct colors used to label remote cursors/participants. */
export const USER_COLORS = [
  '#e03131',
  '#1971c2',
  '#2f9e44',
  '#f08c00',
  '#9c36b5',
  '#0c8599',
  '#f76707',
  '#5f3dc4',
]

export const BACKGROUND_COLORS = [
  'transparent',
  '#a5d8ff',
  '#ffc9c9',
  '#b2f2bb',
  '#ffec99',
  '#eebefa',
  '#ffd8a8',
]

export const THEME_VARS: Record<Theme, Record<string, string>> = {
  light: {
    '--canvas-bg': '#ffffff',
    '--chrome-bg': '#ffffff',
    '--chrome-border': '#dee2e6',
    '--chrome-hover': '#f1f3f5',
    '--icon-color': '#1e1e1e',
    '--icon-bg-active': '#e0e7ff',
    '--icon-active-fg': '#3b5bdb',
    '--text': '#1e1e1e',
    '--text-secondary': '#6d6d6d',
    '--button-bg': '#f1f3f5',
    '--button-hover': '#e9ecef',
    '--danger': '#e03131',
    '--accent': '#4263eb',
    '--accent-fg': '#ffffff',
    '--swatch-border': '#ced4da',
    '--focus': '#4263eb',
  },
  dark: {
    '--canvas-bg': '#121212',
    '--chrome-bg': '#232329',
    '--chrome-border': '#3a3a44',
    '--chrome-hover': '#2f2f38',
    '--icon-color': '#e9ecef',
    '--icon-bg-active': '#404068',
    '--icon-active-fg': '#e9ecef',
    '--text': '#e9ecef',
    '--text-secondary': '#a6a6b0',
    '--button-bg': '#2a2a32',
    '--button-hover': '#33333d',
    '--danger': '#ff6b6b',
    '--accent': '#6d8dff',
    '--accent-fg': '#101014',
    '--swatch-border': '#4a4a55',
    '--focus': '#8fa6ff',
  },
}
