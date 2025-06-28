import { Octokit } from "@octokit/rest";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import semver from "semver";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Configuration
const PACKAGE_JSON_PATH = path.join(rootDir, "package.json");
const MODULE_JSON_PATH = path.join(rootDir, "module.json");
const GITHUB_REPO_OWNER = "Mettra";
const GITHUB_REPO_NAME = "fabula-ultima-technosphere-machine";

class VersionManager {
    constructor() {
        this.octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN,
        });
    }

    async readJsonFile(filePath) {
        const content = await fs.readFile(filePath, "utf-8");
        return JSON.parse(content);
    }

    async writeJsonFile(filePath, data) {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n");
    }

    async getCurrentVersion() {
        const moduleJson = await this.readJsonFile(MODULE_JSON_PATH);
        return moduleJson.version;
    }

    async bumpVersion(releaseType) {
        console.log(`🔄 Bumping ${releaseType} version...`);

        const currentVersion = await this.getCurrentVersion();
        const newVersion = semver.inc(currentVersion, releaseType);

        if (!newVersion) {
            throw new Error(
                `Invalid version bump from ${currentVersion} with type ${releaseType}`
            );
        }

        console.log(`📈 Version: ${currentVersion} → ${newVersion}`);

        // Update package.json
        const packageJson = await this.readJsonFile(PACKAGE_JSON_PATH);
        packageJson.version = newVersion;
        await this.writeJsonFile(PACKAGE_JSON_PATH, packageJson);

        // Update module.json
        const moduleJson = await this.readJsonFile(MODULE_JSON_PATH);
        moduleJson.version = newVersion;

        // Update download URL in module.json
        const downloadUrl = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/download/${newVersion}/${GITHUB_REPO_NAME}.zip`;
        moduleJson.download = downloadUrl;

        await this.writeJsonFile(MODULE_JSON_PATH, moduleJson);

        return newVersion;
    }

    async runCommand(command, args = [], options = {}) {
        return new Promise((resolve, reject) => {
            console.log(`🔧 Running: ${command} ${args.join(" ")}`);

            const child = spawn(command, args, {
                stdio: "inherit",
                shell: true,
                cwd: rootDir,
                ...options,
            });

            child.on("close", (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Command failed with exit code ${code}`));
                }
            });

            child.on("error", reject);
        });
    }

    async buildAndPackage() {
        console.log("🔨 Building project...");
        await this.runCommand("npm", ["run", "publish"]);
    }

    async createGitCommitAndTag(version) {
        console.log("📝 Creating git commit and tag...");

        await this.runCommand("git", ["add", "package.json", "module.json"]);
        await this.runCommand("git", ["commit", "-m", `"${version}"`]);
        await this.runCommand("git", ["tag", `v${version}`]);
        await this.runCommand("git", ["push"]);
        await this.runCommand("git", ["push", "--tags"]);
    }

    async createGitHubRelease(version) {
        console.log("🚀 Creating GitHub release...");

        if (!process.env.GITHUB_TOKEN) {
            console.warn(
                "⚠️  GITHUB_TOKEN not found. Skipping GitHub release creation."
            );
            console.log(
                "To create releases automatically, set GITHUB_TOKEN environment variable."
            );
            return;
        }

        const zipFileName = `${GITHUB_REPO_NAME}.zip`;
        const zipPath = path.join(rootDir, zipFileName);

        // Check if zip file exists
        try {
            await fs.access(zipPath);
        } catch (error) {
            throw new Error(
                `Zip file not found at ${zipPath}. Make sure the build process completed successfully.`
            );
        }

        try {
            // Create the release
            const release = await this.octokit.rest.repos.createRelease({
                owner: GITHUB_REPO_OWNER,
                repo: GITHUB_REPO_NAME,
                tag_name: `${version}`,
                name: `Release ${version}`,
                body: this.generateReleaseNotes(version),
                draft: false,
                prerelease: false,
            });

            console.log(`✅ Created GitHub release: ${release.data.html_url}`);

            // Upload module.json
            await this.uploadAssetToRelease(
                release.data.id,
                MODULE_JSON_PATH,
                "module.json"
            );

            // Upload zip file
            await this.uploadAssetToRelease(
                release.data.id,
                zipPath,
                zipFileName
            );

            console.log("📦 Assets uploaded to release");
        } catch (error) {
            if (error.status === 422) {
                console.error(`❌ Release v${version} already exists`);
            } else {
                throw error;
            }
        }
    }

    async uploadAssetToRelease(releaseId, filePath, fileName) {
        const fileContent = await fs.readFile(filePath);

        await this.octokit.rest.repos.uploadReleaseAsset({
            owner: GITHUB_REPO_OWNER,
            repo: GITHUB_REPO_NAME,
            release_id: releaseId,
            name: fileName,
            data: fileContent,
        });
    }

    generateReleaseNotes(version) {
        return ``;
    }

    async run(releaseType) {
        try {
            console.log("🎯 Starting release process...\n");

            // Validate release type
            if (!["patch", "minor", "major"].includes(releaseType)) {
                throw new Error(
                    "Release type must be one of: patch, minor, major"
                );
            }

            // Bump version
            const newVersion = await this.bumpVersion(releaseType);

            // Build and package
            await this.buildAndPackage();

            // Git operations
            await this.createGitCommitAndTag(newVersion);

            // GitHub release
            await this.createGitHubRelease(newVersion);

            console.log(`\n🎉 Successfully released version ${newVersion}!`);
            console.log(
                `🔗 GitHub: https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/tag/${newVersion}`
            );
        } catch (error) {
            console.error("❌ Release process failed:", error.message);
            process.exit(1);
        }
    }
}

// CLI handling
const releaseType = process.argv[2];

if (!releaseType) {
    console.log(`
Usage: node version-bump.js <release-type>

Release types:
  patch    - Bug fixes (1.0.0 → 1.0.1)
  minor    - New features (1.0.0 → 1.1.0)
  major    - Breaking changes (1.0.0 → 2.0.0)

Environment variables:
  GITHUB_TOKEN - GitHub personal access token (required for automatic releases)
`);
    process.exit(1);
}

const versionManager = new VersionManager();
versionManager.run(releaseType);
