export const APP_THEMES = [
  {
    id: 'default',
    name: 'Default',
    description: 'Tampilan familiar dengan sidebar gelap dan tata letak ringkas.',
    detail: 'Ringkas · Kontras tegas'
  },
  {
    id: 'professional',
    name: 'OCN Networking',
    description: 'Ruang operasional networking dengan navigasi baru, dashboard proyek, dan alur kerja terintegrasi.',
    detail: 'Networking · CCTV · Operasional'
  }
]

export function useTheme() {
  // Cookie makes the preference available during SSR, avoiding a theme flash.
  const preference = useCookie('ocn-theme', {
    default: () => 'default',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/'
  })
  const isTheme = (value) => APP_THEMES.some((item) => item.id === value)
  const current = useState('app-theme', () => isTheme(preference.value) ? preference.value : 'default')
  // Share changes immediately within the app, even without BroadcastChannel.
  watch(preference, (value) => {
    current.value = isTheme(value) ? value : 'default'
  })
  const theme = computed({
    get: () => current.value,
    set: (value) => {
      if (!isTheme(value)) return
      current.value = value
      preference.value = value
    }
  })

  return { theme, themes: APP_THEMES }
}
