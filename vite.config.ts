import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    laravel({
      input: ['resources/js/main.tsx', 'resources/css/timesheet.css', 'resources/css/review.css', 'resources/js/lesson-review.js'],
      refresh: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'resources/js'),
    },
  },
  build: {
    chunkSizeWarningLimit: 4000,
    sourcemap: false,
    rollupOptions: {
      output: {
        // کتابخانه‌های پایدار در فایل جدا؛ با هر انتشار تازه، مرورگر آن‌ها را دوباره دانلود نمی‌کند
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react';
          if (/node_modules\/(recharts|d3-[^/]+|victory-vendor|internmap)\//.test(id)) return 'vendor-charts';
          if (/node_modules\/xlsx\//.test(id)) return 'vendor-xlsx';
          return undefined;
        },
      },
    },
  },
});
