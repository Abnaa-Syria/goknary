import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import ErrorBoundary from './ErrorBoundary';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const ThrowOnRender = () => {
  throw new Error('test render failure');
};

describe('ErrorBoundary', () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;
  let consoleError: ReturnType<typeof jest.spyOn> | null = null;

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container?.remove();
    consoleError?.mockRestore();
    container = null;
    root = null;
    consoleError = null;
  });

  it('renders a Router-independent fallback when a child crashes', () => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <ErrorBoundary>
          <ThrowOnRender />
        </ErrorBoundary>,
      );
    });

    expect(container.textContent).toContain('Oops! Something went wrong');
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/');
  });
});
