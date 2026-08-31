import type { Config } from 'tailwindcss';
export default {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}','./components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: { extend: {
    colors: {
      canvas:'var(--canvas)', 'surface-1':'var(--surface-1)', 'surface-2':'var(--surface-2)', 'surface-3':'var(--surface-3)',
      border:'var(--border)', 'border-strong':'var(--border-strong)',
      'text-primary':'var(--text-primary)', 'text-secondary':'var(--text-secondary)', 'text-tertiary':'var(--text-tertiary)',
      accent:'var(--accent)', 'accent-dim':'var(--accent-dim)', positive:'var(--positive)', caution:'var(--caution)', negative:'var(--negative)'
    },
    fontFamily: { sans:['Inter','ui-sans-serif','system-ui'], display:['Instrument Serif','Georgia','serif'], mono:['JetBrains Mono','ui-monospace','monospace'] },
    borderRadius: { card:'10px' },
    boxShadow: { elevated:'0 8px 24px rgba(0,0,0,0.4)' },
    fontSize: { '13':['13px',{lineHeight:'1.5'}], '14':['14px',{lineHeight:'1.5'}], '16':['16px',{lineHeight:'1.5'}], '20':['20px',{lineHeight:'1.3'}], '26':['26px',{lineHeight:'1.2'}], '34':['34px',{lineHeight:'1.15'}], '48':['48px',{lineHeight:'1.05'}] }
  }},
  plugins: []
} satisfies Config;
