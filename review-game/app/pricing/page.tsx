// reviewgame/reviewgame/app/pricing/page.tsx

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

// Assume these are defined elsewhere or will be defined
// import { Button } from '@/components/ui/Button';
// import { Card } from '@/components/ui/Card';
// import { FeatureList } from '@/components/ui/FeatureList'; // Hypothetical component

const PricingPage = () => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const router = useRouter();
  const [paymentSuccess, setPaymentSuccess] = React.useState(false);

  React.useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const success = searchParams.get('payment') === 'success';
    setPaymentSuccess(success);

    if (success) {
      console.log('Payment successful, user returned to pricing page.');
      // Optionally, clear the query param to avoid showing the message again on refresh
      // This might require a more complex state management or URL manipulation depending on the exact routing setup.
      // For example, using router.replace('/pricing', undefined, { shallow: true }); for pages router
      // For app router, you might need to use router.push or router.replace with a new URL without the param
      // For simplicity, we'll just display the message for now.
    }
  }, [router]);

  const basicFeatures = [
    'Feature A',
    'Feature B',
    'Feature C',
  ];

  const premiumFeatures = [
    'Feature A',
    'Feature B',
    'Feature C',
    'Premium Feature D',
    'Premium Feature E',
  ];

  const handleBasicPurchase = async () => {
    // Logic to handle basic purchase, redirect to Stripe
    console.log('Initiating Basic purchase...');
    setIsLoading(true);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId: 'price_basic_id' }), // Replace with actual Stripe Price ID
      });
      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }
      const session = await response.json();
      window.location.href = session.url;
    } catch (err) {
      setError('Failed to initiate purchase. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePremiumTrial = async () => {
    // Logic to handle premium trial, redirect to Stripe
    console.log('Starting Premium trial...');
    setIsLoading(true);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId: 'price_premium_id' }), // Replace with actual Stripe Price ID
      });
      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }
      const session = await response.json();
      window.location.href = session.url;
    } catch (err) {
      setError('Failed to start trial. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {paymentSuccess && !isLoading && (
        <div className="mt-8 text-center text-green-600">
          Payment successful! Thank you for your purchase.
        </div>
      )}
      <div className="container mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold text-center mb-12">Choose Your Plan</h1>

      <div className="flex flex-col md:flex-row justify-center items-center gap-8">
        {/* Basic Tier */}
        <div className="bg-white rounded-lg shadow-lg p-8 w-full md:w-1/3 flex flex-col">
          <h2 className="text-2xl font-bold mb-4">Basic</h2>
          <p className="text-4xl font-bold mb-6">$29.99<span className="text-lg font-normal"> one-time</span></p>
          <ul className="mb-8 space-y-2">
            {basicFeatures.map((feature, index) => (
              <li key={index} className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={handleBasicPurchase}
            disabled={isLoading}
            className="mt-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Processing...' : 'Purchase Now'}
          </button>
        </div>

        {/* Premium Tier */}
        <div className="bg-white rounded-lg shadow-lg p-8 w-full md:w-1/3 flex flex-col border-2 border-blue-600">
          <h2 className="text-2xl font-bold mb-4">Premium</h2>
          <p className="text-4xl font-bold mb-6">$9.99<span className="text-lg font-normal">/month</span></p>
          <p className="text-sm text-gray-600 mb-6">Includes a 14-day free trial</p>
          <ul className="mb-8 space-y-2">
            {premiumFeatures.map((feature, index) => (
              <li key={index} className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={handlePremiumTrial}
            disabled={isLoading}
            className="mt-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Starting Trial...' : 'Start Free Trial'}
          </button>
        </div>
      </div>

      {/* Feature Comparison Section (Placeholder) */}
      <div className="mt-16">
        <h2 className="text-3xl font-bold text-center mb-8">Feature Comparison</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg shadow-lg">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-3 px-4 text-left">Feature</th>
                <th className="py-3 px-4 text-center">Basic</th>
                <th className="py-3 px-4 text-center">Premium</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-3 px-4">Feature A</td>
                <td className="py-3 px-4 text-center text-green-500">✅</td>
                <td className="py-3 px-4 text-center text-green-500">✅</td>
              </tr>
              <tr>
                <td className="py-3 px-4">Feature B</td>
                <td className="py-3 px-4 text-center text-green-500">✅</td>
                <td className="py-3 px-4 text-center text-green-500">✅</td>
              </tr>
              <tr>
                <td className="py-3 px-4">Feature C</td>
                <td className="py-3 px-4 text-center text-green-500">✅</td>
                <td className="py-3 px-4 text-center text-green-500">✅</td>
              </tr>
              <tr>
                <td className="py-3 px-4">Premium Feature D</td>
                <td className="py-3 px-4 text-center text-red-500">❌</td>
                <td className="py-3 px-4 text-center text-green-500">✅</td>
              </tr>
              <tr>
                <td className="py-3 px-4">Premium Feature E</td>
                <td className="py-3 px-4 text-center text-red-500">❌</td>
                <td className="py-3 px-4 text-center text-green-500">✅</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Error Handling Display */}
      {error && (
        <div className="mt-8 text-center text-red-600">
          {error}
        </div>
      )}
      </div>
    </>
  );
};

export default PricingPage;