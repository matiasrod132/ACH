import {
  BookOpen,
  Dumbbell,
  Palette,
  Music,
  Gamepad2,
  Camera,
  Code,
  ChefHat,
  Target,
  type LucideIcon,
} from 'lucide-react'
import type { HobbyColor } from '@/lib/game-context'

export const HOBBY_ICONS: Record<string, LucideIcon> = {
  BookOpen,
  Dumbbell,
  Palette,
  Music,
  Gamepad2,
  Camera,
  Code,
  ChefHat,
  Target,
}

export const ICON_KEYS = Object.keys(HOBBY_ICONS)

export function getHobbyIcon(key: string): LucideIcon {
  return HOBBY_ICONS[key] ?? Target
}

type ColorClasses = {
  text: string
  bg: string
  ring: string
  glow: string
  bar: string
  dot: string
}

export const COLOR_MAP: Record<HobbyColor, ColorClasses> = {
  indigo: {
    text: 'text-neon-indigo',
    bg: 'bg-neon-indigo/12',
    ring: 'ring-neon-indigo/40',
    glow: 'glow-indigo',
    bar: 'bg-neon-indigo',
    dot: 'bg-neon-indigo',
  },
  emerald: {
    text: 'text-neon-emerald',
    bg: 'bg-neon-emerald/12',
    ring: 'ring-neon-emerald/40',
    glow: 'glow-emerald',
    bar: 'bg-neon-emerald',
    dot: 'bg-neon-emerald',
  },
  blue: {
    text: 'text-neon-blue',
    bg: 'bg-neon-blue/12',
    ring: 'ring-neon-blue/40',
    glow: 'glow-blue',
    bar: 'bg-neon-blue',
    dot: 'bg-neon-blue',
  },
}

export const COLOR_OPTIONS: HobbyColor[] = ['indigo', 'emerald', 'blue']

export const COLOR_LABELS: Record<HobbyColor, string> = {
  indigo: 'Índigo',
  emerald: 'Esmeralda',
  blue: 'Azul',
}
