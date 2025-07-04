# Release Management Scripts

This directory contains scripts for automating the release process of the Fabula Ultima Technosphere Machine module.

## Setup

### 1. GitHub Token (Required for automatic releases)

To enable automatic GitHub release creation, you need to set up a GitHub Personal Access Token:

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a descriptive name like "Foundry Module Releases"
4. Select the following scopes:
   - `repo` (Full control of private repositories)
   - `public_repo` (Access public repositories)
5. Copy the generated token

### 2. Set Environment Variable

#### Windows (PowerShell):
```powershell
$env:GITHUB_TOKEN = "your_token_here"
# To make it permanent:
[Environment]::SetEnvironmentVariable("GITHUB_TOKEN", "your_token_here", "User")
```

#### Windows (Command Prompt):
```cmd
set GITHUB_TOKEN=your_token_here
```

#### Bash (Git Bash/WSL):
```bash
export GITHUB_TOKEN="your_token_here"
# To make it permanent, add to ~/.bashrc or ~/.bash_profile:
echo 'export GITHUB_TOKEN="your_token_here"' >> ~/.bashrc
```

## Usage

### Release Commands

```bash
# Patch release (bug fixes: 1.0.0 → 1.0.1)
npm run release:patch

# Minor release (new features: 1.0.0 → 1.1.0)
npm run release:minor

# Major release (breaking changes: 1.0.0 → 2.0.0)
npm run release:major
```

### What the script does:

1. **Version Bump**: Updates version in both `package.json` and `module.json`
2. **Download URL Update**: Updates the download URL in `module.json` to point to the new release
3. **Build**: Runs the production build and packaging (`npm run publish`)
4. **Git Operations**: Creates a commit, tags the release, and pushes to GitHub
5. **GitHub Release**: Creates a GitHub release with the module.json and zip file attached

### Manual Release (without GitHub token)

If you don't set up a GitHub token, the script will still:
- Bump versions
- Build and package the module
- Create git commit and tag
- Push to GitHub

You'll need to manually create the GitHub release and upload the files.

## Troubleshooting

### Common Issues

1. **"GITHUB_TOKEN not found"**: Set up the environment variable as described above
2. **"git command failed"**: Make sure you have git installed and the repository is initialized
3. **"Release already exists"**: The version tag already exists on GitHub - use a different version bump
4. **"Zip file not found"**: The build process failed - check the build output for errors

### Build Requirements

Make sure these work before running a release:
```bash
npm run build        # Should complete without errors
npm run publish      # Should create the zip file
```

## File Structure

- `version-bump.js` - Main release automation script
- `README.md` - This documentation file

## Security

**Important**: Never commit your GitHub token to the repository. Always use environment variables or secure secret management.
