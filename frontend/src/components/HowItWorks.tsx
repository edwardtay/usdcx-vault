'use client';

export default function HowItWorks() {
  const steps = [
    {
      number: '01',
      title: 'Connect Wallet',
      description: 'Connect your Hiro or Xverse wallet to get started',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
        </svg>
      ),
    },
    {
      number: '02',
      title: 'Deposit USDCx',
      description: 'Deposit your USDCx stablecoins and receive vault shares (vUSDCx)',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15m0 0l6.75-6.75M12 19.5l-6.75-6.75" />
        </svg>
      ),
    },
    {
      number: '03',
      title: 'Earn Yield',
      description: 'Your share value grows as the vault generates yield through DeFi strategies',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
        </svg>
      ),
    },
    {
      number: '04',
      title: 'Withdraw Anytime',
      description: 'Redeem your vUSDCx for USDCx plus your earned yield',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19.5v-15m0 0l-6.75 6.75M12 4.5l6.75 6.75" />
        </svg>
      ),
    },
  ];

  return (
    <div className="py-12">
      <h2 className="text-2xl font-bold text-white text-center mb-12">How It Works</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {steps.map((step, index) => (
          <div
            key={step.number}
            className="relative bg-gray-800/50 rounded-xl p-6 border border-gray-700 hover:border-stacks-purple/50 transition-all group"
          >
            {/* Connector line */}
            {index < steps.length - 1 && (
              <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-0.5 bg-gradient-to-r from-stacks-purple to-transparent" />
            )}

            {/* Step number */}
            <div className="absolute -top-3 -left-3 w-8 h-8 bg-stacks-purple rounded-full flex items-center justify-center text-sm font-bold text-white">
              {step.number}
            </div>

            {/* Icon */}
            <div className="text-stacks-purple mb-4 group-hover:scale-110 transition-transform">
              {step.icon}
            </div>

            {/* Content */}
            <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
            <p className="text-sm text-gray-400">{step.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
