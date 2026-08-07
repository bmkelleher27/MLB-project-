/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Pure logic runs in plain Node; component tests opt into a DOM with a
    // `@vitest-environment jsdom` docblock, so the fast lib tests don't pay
    // for jsdom startup.
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
  },
})
