import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Component tests share one jsdom document; unmount between cases so queries
// can't match a previous test's markup.
afterEach(() => {
  cleanup();
});
