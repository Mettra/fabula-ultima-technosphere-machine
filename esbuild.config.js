import { build } from 'esbuild';

const isProduction = process.argv.includes('--production');
const isDebug = !isProduction && process.env.TS_DEBUG !== 'false';

const baseConfig = {
  bundle: true,
  format: 'esm',
  define: {
    TS_DEBUG: isDebug.toString()
  },
  external: [
    // Exclude Socket.IO related packages to prevent conflicts with Foundry's built-in Socket.IO
    'socket.io-client',
    '@socket.io/component-emitter',
    'socket.io-parser',
    // Exclude other Foundry-provided globals
    'foundry',
    'game',
    'ui',
    'canvas'
  ],
  ...(isProduction && { minify: true }),
  ...(process.argv.includes('--watch') && { 
    watch: {
      onRebuild(error) {
        if (error) console.error('Build failed:', error);
        else console.log('Build succeeded');
      }
    },
    sourcemap: 'inline'
  })
};

// Main module build
if (process.argv.includes('--main') || (!process.argv.includes('--animation') && !process.argv.includes('--watch-animation'))) {
  build({
    ...baseConfig,
    entryPoints: ['scripts/technosphere-machine.ts'],
    outdir: 'build'
  }).catch(() => process.exit(1));
}

// Animation standalone build
if (process.argv.includes('--animation') || process.argv.includes('--watch-animation')) {
  build({
    ...baseConfig,
    entryPoints: ['scripts/animations/animation-standalone.ts'],
    outfile: 'build/animations/animation-standalone.js'
  }).catch(() => process.exit(1));
}
