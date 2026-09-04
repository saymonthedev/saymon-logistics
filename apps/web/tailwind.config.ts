import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b6fe0',
          600: '#2f5bc7',
          700: '#26489e',
        },
      },
    },
  },
  plugins: [],
};

export default config;
