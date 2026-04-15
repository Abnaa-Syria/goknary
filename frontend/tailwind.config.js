/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  // Enable RTL support
  // Tailwind 3.3+ has built-in RTL support with logical properties
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FFD700',
          50: '#FFFEF0',
          100: '#FFFCE0',
          200: '#FFF9C4',
          300: '#FFF59D',
          400: '#FFF176',
          500: '#FFD700',
          600: '#FFC400',
          700: '#FFB300',
          800: '#FFA000',
          900: '#FF8F00',
        },
        secondary: {
          DEFAULT: '#1a237e',
          50: '#E8EAF6',
          100: '#C5CAE9',
          200: '#9FA8DA',
          300: '#7986CB',
          400: '#5C6BC0',
          500: '#3F51B5',
          600: '#3949AB',
          700: '#303F9F',
          800: '#283593',
          900: '#1a237e',
        },
        accent: {
          DEFAULT: '#FF6B35',
          50: '#FFF4F1',
          100: '#FFE4DB',
          200: '#FFCDBE',
          300: '#FFB6A1',
          400: '#FF9F84',
          500: '#FF6B35',
          600: '#FF5722',
          700: '#E64A19',
          800: '#D84315',
          900: '#BF360C',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Cairo', 'system-ui', 'sans-serif'],
        arabic: ['Cairo', 'Tajawal', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'card': '8px',
        'modal': '12px',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'dropdown': '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        'mega-menu': '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
      },
      transitionDuration: {
        'fast': '150ms',
        'base': '200ms',
        'slow': '300ms',
      },
animation: {
  marquee: 'marquee 20s linear infinite',
  'marquee-rtl': 'marquee-rtl 20s linear infinite',
},

keyframes: {
  marquee: {
    '0%': { transform: 'translateX(0)' },
    '100%': { transform: 'translateX(-50%)' },
  },
  'marquee-rtl': {
    '0%': { transform: 'translateX(0)' },
    '100%': { transform: 'translateX(50%)' },
  }
}
    },
  },
  plugins: [],
}

