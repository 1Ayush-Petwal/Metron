import { defineConfig } from 'tsup';

export default defineConfig({
    entry: {
        index: 'src/index.ts',
        types: 'src/types/index.ts',
        client: 'src/client/index.ts',
        server: 'src/server/index.ts',
    },
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    external: ['@metron/x402'],
    treeshake: true,
});
