import { useState, useEffect } from 'react';

export function useEurToUsdRate() {
  const [rate, setRate] = useState(1.14); // Fallback default

  useEffect(() => {
    async function fetchRate() {
      try {
        const res = await fetch('https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD');
        const data = await res.json();
        if (data?.rates?.USD) {
          setRate(data.rates.USD);
        }
      } catch (err) {
        console.warn('Could not fetch exchange rate, using fallback rate.', err);
      }
    }

    fetchRate();
  }, []);

  return rate;
}