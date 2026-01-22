'use client';

export default function SecurityBadges() {
  const badges = [
    {
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
        </svg>
      ),
      title: 'Bitcoin Secured',
      description: 'Anchored to BTC via PoX',
      color: 'text-bitcoin-orange',
    },
    {
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      ),
      title: 'Audited Contracts',
      description: 'Security reviewed code',
      color: 'text-green-400',
    },
    {
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
        </svg>
      ),
      title: 'Non-Custodial',
      description: 'You control your keys',
      color: 'text-stacks-purple',
    },
    {
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
          <circle cx="12" cy="12" r="5" fill="currentColor"/>
        </svg>
      ),
      title: 'Circle xReserve',
      description: '1:1 USDC backed',
      color: 'text-usdc-blue',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {badges.map((badge) => (
        <div
          key={badge.title}
          className="flex flex-col items-center text-center p-4 bg-gray-800/30 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors"
        >
          <div className={`${badge.color} mb-2`}>{badge.icon}</div>
          <h4 className="text-sm font-medium text-white">{badge.title}</h4>
          <p className="text-xs text-gray-500">{badge.description}</p>
        </div>
      ))}
    </div>
  );
}
