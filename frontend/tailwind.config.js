/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ['class'],
    content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
  	extend: {
  		colors: {
  			'stacks-purple': '#5546FF',
  			'stacks-dark': '#141416',
  			'bitcoin-orange': '#F7931A',
  			'usdc-blue': '#2775CA',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		fontFamily: {
  			mono: ['Space Mono', 'monospace'],
  		},
  		keyframes: {
  			"pulse-orange": {
  				"0%, 100%": { boxShadow: "0 0 0 0 rgba(247, 147, 26, 0.4)" },
  				"50%": { boxShadow: "0 0 0 12px rgba(247, 147, 26, 0)" },
  			},
  			"slide-up": {
  				"from": { opacity: "0", transform: "translateY(30px)" },
  				"to": { opacity: "1", transform: "translateY(0)" },
  			},
  			"ticker": {
  				"0%": { transform: "translateX(0)" },
  				"100%": { transform: "translateX(-50%)" },
  			},
  		},
  		animation: {
  			"pulse-orange": "pulse-orange 2s ease-in-out infinite",
  			"slide-up": "slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
  			"ticker": "ticker 30s linear infinite",
  		},
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
