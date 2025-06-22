import { execSync } from "child_process";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import configData from "../foundry-config.json" with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
    console.log("Starting Foundry VTT CLI setup...");

    // Get module name from package.json
    const packageJsonPath = resolve(__dirname, "..", "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    const moduleName = packageJson.name;

    if (!moduleName) {
        throw new Error("Module name not found in package.json");
    }
    console.log(`Module name: ${moduleName}`);

    if(!configData.foundryDataPath) {
        throw new Error("Update foundry-config.json to include foundryDataPath. (See foundry-config.example.json)");
    }

    // Determine FoundryVTT data path
    const dataPath = resolve(configData.foundryDataPath);
    console.log(`Foundry VTT data path: ${dataPath}`);

    console.log("Configuring fvtt-cli data path...");
    execSync(`fvtt configure set dataPath "${dataPath}"`, { stdio: "inherit" });

    console.log(`Setting package to work on...`);
    execSync(`fvtt package workon "${moduleName}" --type "Module"`, {
        stdio: "inherit",
    });

    console.log("Foundry VTT CLI configured successfully.");
} catch (error) {
    console.error("Failed to configure Foundry VTT CLI:", error);
    process.exit(1);
}
