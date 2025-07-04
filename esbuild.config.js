import { build, context } from "esbuild";
import { copyFileSync, mkdirSync } from "fs";
import { dirname } from "path";

const isProduction = process.argv.includes("--production");
const isDebug = !isProduction && process.env.TS_DEBUG !== "false";

const baseConfig = {
    bundle: true,
    format: "esm",
    define: {
        TS_DEBUG: isDebug.toString(),
    },
    external: [
        // Exclude Socket.IO related packages to prevent conflicts with Foundry's built-in Socket.IO
        "socket.io",
        // Exclude other Foundry-provided globals
        "foundry",
        "game",
        "ui",
        "canvas",
    ],
    ...(isProduction && { minify: false }),
    ...(process.argv.includes("--watch") && {
        sourcemap: "inline",
    }),
};

const watchOptions = process.argv.includes("--watch")
    ? {
          onRebuild(error) {
              if (error) console.error("Build failed:", error);
              else console.log("Build succeeded");
          },
      }
    : undefined;

// Main module build
if (
    process.argv.includes("--main") ||
    (!process.argv.includes("--animation") && !process.argv.includes("--watch"))
) {
    if (watchOptions) {
        const ctx = await context({
            ...baseConfig,
            entryPoints: ["scripts/technosphere-machine.ts"],
            outdir: "build",
        });
        await ctx.watch();
    } else {
        await build({
            ...baseConfig,
            entryPoints: ["scripts/technosphere-machine.ts"],
            outdir: "build",
        });
    }
}

// Animation standalone build
if (process.argv.includes("--animation") || process.argv.includes("--watch")) {
    if (watchOptions) {
        const ctx = await context({
            ...baseConfig,
            entryPoints: ["scripts/animations/animation-standalone.ts"],
            outfile: "build/animations/animation-standalone.js",
        });
        await ctx.watch();
    } else {
        await build({
            ...baseConfig,
            entryPoints: ["scripts/animations/animation-standalone.ts"],
            outfile: "build/animations/animation-standalone.js",
        });
    }
}
