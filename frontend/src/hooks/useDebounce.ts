import { useState, useEffect } from 'react';

/**
 * Custom hook to debounce a value.
 * Useful for delaying search input updates to prevent excessive API calls.
 * 
 * @param value The value to debounce
 * @param delay The delay in milliseconds
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set a timer to update the debounced value after the specified delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up the timer if the value changes before the delay is over
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
