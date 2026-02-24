import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/azure/functions/mcp.ts',
    'src/azure/functions/github-webhook.ts',
    'src/azure/functions/todo-webhook.ts',
    'src/azure/functions/subscription-renew.ts',
    'src/azure/functions/health.ts',
    'src/mcp/server.ts',
    'src/todo/token-manager.ts',
    'src/azure/http-adapter.ts',
  ],
  outDir: 'dist',
  format: ['esm'],
  target: 'node20',
  shims: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  dts: true,
  esbuildOptions(options) {
    options.platform = 'node'
  }
})