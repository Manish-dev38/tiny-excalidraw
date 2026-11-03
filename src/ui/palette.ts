/** Excalidraw-inspired design tokens. */

export type Theme = 'light' | 'dark'

export const STROKE_COLORS = [
  '#1e1e1e',
  '#e03131',
  '#9c36b5',
  '#1971c2',
  '#1098ad',
  '#2f9e44',
  '#f08c00',
  '#f76707',
  '#6d6d6d',
  '#ffffff',
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
    '--toolbar-bg': '#ffffff',
    '--icon-color': '#1e1e1e',
    '--icon-bg-active': '#e9ecef',
    '--border': '#dee2e6',
    '--text': '#1e1e1e',
    '--text-secondary': '#6d6d6d',
    '--button-bg': '#f1f3f5',
    '--button-hover': '#e9ecef',
    '--danger': '#e03131',
    '--accent': '#1971c2',
  },
  dark: {
    '--canvas-bg': '#141414',
    '--toolbar-bg': '#1e1e1e',
    '--icon-color': '#e9ecef',
    '--icon-bg-active': '#343a40',
    '--border': '#343a40',
    '--text': '#e9ecef',
    '--text-secondary': '#adb5bd',
    '--button-bg': '#2b2b2b',
    '--button-hover': '#343a40',
    '--danger': '#ff6b6b',
    '--accent': '#4dabf7',
  },
}
