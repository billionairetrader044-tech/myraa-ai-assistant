import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function suppressViteClientWsPlugin(): Plugin {
  return {
    name: 'suppress-vite-client-ws',
    enforce: 'post',
    transform(code, id) {
      if (id.includes('vite/dist/client/client.mjs')) {
        return code
          .replace('console.debug("[vite] connecting...");', '')
          .replace(
            'transport.connect(createHMRHandler(handleMessage));',
            '/* HMR WebSocket disabled in middleware mode */'
          )
          .replace(
            'setupForwardConsoleHandler(transport, forwardConsole);',
            '/* Forward console disabled */'
          )
          .replace(
            'this.transport.send(payload).catch((err) => {',
            'Promise.resolve().catch((err) => {'
          );
      }
      return null;
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), suppressViteClientWsPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: false as const,
      ws: false as const,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
