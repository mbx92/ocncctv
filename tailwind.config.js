/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './components/**/*.{js,vue}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './app.vue'
  ],
  theme: {
    extend: {
      colors: {
        // Charcoal brand (logo) + biru CCTV + teal untuk angka positif
        ink: {
          50: '#f6f7f8',
          100: '#e9ebee',
          200: '#d3d7dd',
          300: '#aab2bc',
          400: '#7a8592',
          500: '#5b6672',
          600: '#48515c',
          700: '#3b424b',
          800: '#2b3138',
          900: '#1f2429',
          950: '#15181c'
        },
        accent: {
          50: '#f1f6fa',
          100: '#e2eef6',
          200: '#c5dcea',
          300: '#9cc4d9',
          400: '#5a9fc4',
          500: '#1f7aab',
          600: '#18628c',
          700: '#164f71',
          800: '#16425d',
          900: '#16384e'
        },
        teal: {
          500: '#0d9488',
          600: '#0f766e'
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Inter', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'JetBrains Mono', 'Consolas', 'monospace']
      },
      borderRadius: {
        panel: '0.375rem'
      }
    }
  },
  plugins: []
}
