const TYPES = ['filament', 'resin', 'part']

export function parseMaterialType(value, fallback = 'filament') {
  return TYPES.includes(value) ? value : fallback
}
