import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'USDCx Vault | Earn Yield on Bitcoin',
  description: 'Earn yield on USDC secured by Bitcoin via Stacks',
  icons: {
    icon: '/logo.svg',
    apple: '/logo.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#0d0907] min-h-screen antialiased">{children}</body>
    </html>
  );
}
