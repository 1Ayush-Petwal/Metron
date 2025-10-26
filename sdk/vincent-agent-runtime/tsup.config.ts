import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  target: 'es2022',
  outDir: 'dist',
  external: [
    '@metron/vincent-policy-engine',
    'x402',
    'x402-fetch',
    '@hashgraph/did-sdk-js',
    '@lit-protocol/vincent-ability-sdk',
    'zod',
    'viem',
    'dotenv'
  ]
});
