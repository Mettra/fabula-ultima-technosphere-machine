import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

async function checkSetup() {
    console.log("🔍 Checking release setup...\n");

    const checks = [];

    // Check if required files exist
    const requiredFiles = ["package.json", "module.json", "package-module.ps1"];

    for (const file of requiredFiles) {
        const filePath = path.join(rootDir, file);
        try {
            await fs.access(filePath);
            checks.push({ name: `${file} exists`, status: "✅" });
        } catch {
            checks.push({ name: `${file} exists`, status: "❌" });
        }
    }

    // Check GitHub token
    const hasGitHubToken = !!process.env.GITHUB_TOKEN;
    checks.push({
        name: "GitHub token configured",
        status: hasGitHubToken ? "✅" : "⚠️",
        note: hasGitHubToken ? "" : "Set GITHUB_TOKEN for automatic releases",
    });

    // Check git repository
    try {
        await fs.access(path.join(rootDir, ".git"));
        checks.push({ name: "Git repository initialized", status: "✅" });
    } catch {
        checks.push({ name: "Git repository initialized", status: "❌" });
    }

    // Check current versions
    try {
        const packageJson = JSON.parse(
            await fs.readFile(path.join(rootDir, "package.json"), "utf-8")
        );
        const moduleJson = JSON.parse(
            await fs.readFile(path.join(rootDir, "module.json"), "utf-8")
        );

        checks.push({
            name: `Current version (package.json)`,
            status: "📋",
            note: packageJson.version,
        });
        checks.push({
            name: `Current version (module.json)`,
            status: "📋",
            note: moduleJson.version,
        });

        const versionsMatch = packageJson.version === moduleJson.version;
        checks.push({
            name: "Versions match",
            status: versionsMatch ? "✅" : "⚠️",
            note: versionsMatch ? "" : "Versions should be synchronized",
        });
    } catch (error) {
        checks.push({
            name: "Version check",
            status: "❌",
            note: error.message,
        });
    }

    // Display results
    console.log("Setup Status:");
    console.log("=============");
    for (const check of checks) {
        const line = `${check.status} ${check.name}`;
        console.log(check.note ? `${line} (${check.note})` : line);
    }

    const hasErrors = checks.some((check) => check.status === "❌");
    const hasWarnings = checks.some((check) => check.status === "⚠️");

    console.log("\n" + "=".repeat(50));

    if (hasErrors) {
        console.log(
            "❌ Setup has errors that need to be fixed before releasing."
        );
    } else if (hasWarnings) {
        console.log(
            "⚠️  Setup is mostly ready, but some optional features are missing."
        );
    } else {
        console.log("✅ Setup is ready for releases!");
    }

    console.log("\nUsage:");
    console.log("  npm run release:patch   # Bug fixes (1.0.0 → 1.0.1)");
    console.log("  npm run release:minor   # New features (1.0.0 → 1.1.0)");
    console.log("  npm run release:major   # Breaking changes (1.0.0 → 2.0.0)");
}

checkSetup().catch(console.error);
