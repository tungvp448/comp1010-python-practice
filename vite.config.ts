/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' makes asset URLs relative, so the same build works at a domain root
// or under a sub-path such as GitHub Pages /<repo-name>/. Override with VITE_BASE.
export default defineConfig({
  base: process.env.VITE_BASE ?? './',
  plugins: [react()],
  // The question bank (~950 kB JSON) is bundled on purpose: one static file, no fetch at runtime.
  build: { chunkSizeWarningLimit: 1500 },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});
