# PowerShell script to package the Foundry VTT module for distribution.

# --- Configuration ---
# Attempt to read module information from module.json
$ManifestPath = "module.json"
if (-not (Test-Path $ManifestPath)) {
    Write-Error "module.json not found in the current directory. Please run this script from the module's root directory."
    Exit 1
}
$Manifest = Get-Content $ManifestPath | ConvertFrom-Json

$ModuleName = $Manifest.name
if ([string]::IsNullOrWhiteSpace($ModuleName)) {
    Write-Error "Module name could not be determined from module.json."
    Exit 1
}

# The zip file will be named based on the module's 'name' field in module.json
$ZipFileName = "$($ModuleName).zip"
$OutputZipPath = ".\$($ZipFileName)" # Output zip file in the module's root directory

# Define essential files and directories to include, based on typical Foundry VTT module structure
# and your module.json.
$EssentialItems = @(
    "module.json",
    "build",      # Contains compiled JavaScript (from your "scripts" and package.json build output)
    "styles",     # Contains CSS files (from your "styles")
    "languages"   # Contains language JSON files (from your "languages")
)

# Define common optional files and directories
$OptionalItems = @(
    "templates",  # If you have HTML templates
    "assets",     # For images, audio, etc.
    "icons",      # For any specific icons
    "images",     # Alternative or additional image assets
    "README.md",
    "LICENSE"
)

# Define files and directories to exclude (LevelDB files that may be locked by Foundry)
$ExcludePatterns = @(
    "*.ldb",
    "*.log", 
    "CURRENT",
    "LOCK",
    "LOG",
    "LOG.old",
    "MANIFEST-*"
)

# Combine essential items and any existing optional items
$ItemsToInclude = [System.Collections.Generic.List[string]]::new()
$EssentialItems | ForEach-Object { $ItemsToInclude.Add($_) }

foreach ($item in $OptionalItems) {
    if (Test-Path $item) {
        $ItemsToInclude.Add($item)
    }
}

# --- Packaging Process ---
$StagingDir = ".\_module_package_staging_$(Get-Random)" # Temporary directory for staging files

# Clean up previous staging directory if it somehow exists (e.g., from a failed run)
if (Test-Path $StagingDir) {
    Write-Host "Removing pre-existing staging directory: $StagingDir"
    Remove-Item -Recurse -Force $StagingDir
}

# Create staging directory
Write-Host "Creating staging directory: $StagingDir"
New-Item -ItemType Directory -Path $StagingDir -Force | Out-Null

Write-Host "Copying items to staging directory..."
foreach ($itemPath in $ItemsToInclude) {
    if (Test-Path $itemPath) {
        Write-Host "  Copying '$itemPath'..."
        # Copy item into the root of the staging directory
        Copy-Item -Path $itemPath -Destination $StagingDir -Recurse -Force
    } else {
        # This check is more for optional items if they were added without Test-Path,
        # or if an essential item is unexpectedly missing.
        Write-Warning "  Item '$itemPath' not found, skipping."
    }
}

# Handle packs directory separately to exclude locked LevelDB files
if (Test-Path "packs") {
    Write-Host "  Copying 'packs' (excluding locked database files)..."
    $PacksDestination = Join-Path $StagingDir "packs"
    New-Item -ItemType Directory -Path $PacksDestination -Force | Out-Null
    
    # Copy the packs directory structure but exclude problematic files
    Get-ChildItem -Path "packs" -Recurse | ForEach-Object {
        $relativePath = $_.FullName.Substring((Get-Item "packs").FullName.Length + 1)
        $destinationPath = Join-Path $PacksDestination $relativePath
        
        # Check if this file should be excluded
        $shouldExclude = $false
        foreach ($pattern in $ExcludePatterns) {
            if ($_.Name -like $pattern) {
                $shouldExclude = $true
                break
            }
        }
        
        if (-not $shouldExclude) {
            if ($_.PSIsContainer) {
                # Create directory
                New-Item -ItemType Directory -Path $destinationPath -Force | Out-Null
            } else {
                try {
                    # Copy file
                    $destinationDir = Split-Path $destinationPath -Parent
                    if (-not (Test-Path $destinationDir)) {
                        New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
                    }
                    Copy-Item -Path $_.FullName -Destination $destinationPath -Force
                } catch {
                    Write-Warning "    Skipping locked file: $($_.Name)"
                }
            }
        } else {
            Write-Host "    Excluding: $($_.Name)"
        }
    }
}

# Create the zip file
if (Test-Path $OutputZipPath) {
    Write-Host "Removing existing zip file: $OutputZipPath"
    Remove-Item -Force $OutputZipPath
}

Write-Host "Creating zip file: $OutputZipPath"
# Compress the *contents* of the staging directory
Compress-Archive -Path (Join-Path $StagingDir "*") -DestinationPath $OutputZipPath -Force

# Clean up staging directory
Write-Host "Cleaning up staging directory: $StagingDir"
Remove-Item -Recurse -Force $StagingDir

Write-Host ""
Write-Host "Module packaged successfully!"
Write-Host "Output: $OutputZipPath"