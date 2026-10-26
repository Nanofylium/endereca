import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  // O build vai para o navegador e para dentro do .exe: minificado e sem mapas de código-fonte.
  build: { sourcemap: false, minify: 'esbuild' },
  esbuild: { drop: ['debugger'] },
});
