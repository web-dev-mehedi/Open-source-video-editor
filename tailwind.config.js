/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        workspace: {
          bg: '#0E1117',
          panel: '#181B22',
          elevated: '#222630',
          active: '#2C3240',
          border: '#2A2E3B',
          cyan: '#00E5FF',
          violet: '#7C3AED',
          yellow: '#FBBF24',
        },
        canvas: {
          dark: '#0E1117',
          surface: '#181B22',
          card: '#222630',
          border: '#2A2E3B',
          hover: '#2A2E3B',
          active: '#2C3240',
          input: '#151820',
          highlight: '#3F4254',
        },
        forge: {
          purple: '#7C3AED',
          cyan: '#00E5FF',
          pink: '#EC4899',
          amber: '#F59E0B',
          emerald: '#10B981',
          blue: '#3B82F6',
          yellow: '#FBBF24',
          crimson: '#EF4444',
          indigo: '#6366F1',
        }
      },
      fontFamily: {
        sans: ['Roboto', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Montserrat', 'Poppins', 'sans-serif'],
        impact: ['Impact', 'Anton', 'sans-serif'],
      },
      backgroundImage: {
        'purple-sky': 'linear-gradient(135deg, #A855F2 0%, #06B6D4 100%)',
        'purple-sky-glow': 'linear-gradient(135deg, rgba(168, 85, 242, 0.25) 0%, rgba(6, 182, 212, 0.25) 100%)',
        'purple-sky-radial': 'radial-gradient(circle at center, rgba(168, 85, 242, 0.15) 0%, transparent 70%)',
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-word': 'bounceWord 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '1', filter: 'drop-shadow(0 0 12px rgba(168, 85, 242, 0.6))' },
          '50%': { opacity: '0.7', filter: 'drop-shadow(0 0 4px rgba(6, 182, 212, 0.4))' },
        },
        bounceWord: {
          '0%': { transform: 'scale(0.85)' },
          '50%': { transform: 'scale(1.25)' },
          '100%': { transform: 'scale(1.05)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
