import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/functions/mcp.ts',
    'src/functions/github-webhook.ts',
    'src/functions/todo-webhook.ts',
    'src/functions/subscription-renew.ts',
    'src/todo-index.ts',
    'src/token-manager.ts',
    'src/azure-http-adapter.ts',
  ],
  outDir: 'dist',
  format: ['esm'],
  target: 'node18',
  shims: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  dts: true,
  esbuildOptions(options) {
    options.platform = 'node'
  }
})