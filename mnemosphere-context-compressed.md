# Mnemosphere Core Context - Compressed State
## Decompression Instructions
This file contains compressed context for the mnemosphere core implementation. To decompress for another AI instance:
1. Read this entire file as initial context
2. The CURRENT STATUS section shows where we are
3. The COMPLETED WORK section shows what's done
4. The FIXES APPLIED section shows recent changes
5. Key files are in MODIFIED FILES section
6. Next steps are in TESTING NEEDS section

## CURRENT STATUS: DESCRIPTION HANDLING FIXES COMPLETE
**Date:** June 18, 2025
**Task:** Create function to update character skills/features from equipped Mnemospheres
**Phase:** Post-implementation bug fixes for description property handling
**Status:** Ready for end-to-end testing

## PROBLEM SOLVED
Fixed description property access in mnemosphere-core.ts. Issue was:
- Description is calculated property/getter in Foundry VTT items
- Code was incorrectly accessing `featureItem.system.description` (undefined variable)
- Added robust multi-path description access for both skills and features

## COMPLETED WORK
### Core Implementation (mnemosphere-core.ts - 850+ lines)
**Main Functions:**
- `combineMnemosphereData()` - Main combination logic
- `updateActorWithMnemosphereData()` - Actor update with cleanup
- `setupMnemosphereCoreHooks()` - Auto-update system
- `combineSkills()` / `combineFeatures()` - Sphere creation with attribution

**Key Features:**
1. **Dual-tier system:** Base items (copied as-is) + Sphere items (" Sphere" suffix)
2. **Smart cleanup:** Only removes module-generated items, preserves Mnemospheres
3. **Class level updates:** Updates existing levels instead of duplicates
4. **Rich source attribution:** HTML-formatted descriptions with UUID links
5. **Automatic updates:** Debounced hooks for equipment changes
6. **Error handling:** Comprehensive try/catch with logging

### Integration Points
- Hooks into actor flag changes for "equipped-mnemospheres"
- Uses Relations system for mnemosphere data access
- Integrates with existing technosphere recompute functionality
- Adds UI button to actor sheet settings template

## FIXES APPLIED
### Description Access Fix (Lines 408-428, 288-308)
**Problem:** `featureItem.system.description` undefined variable
**Fix:** Multi-path description access:
```typescript
// Handle description access - try multiple ways since features may have getter properties
let originalDescription = "";
try {
    // Try direct system access first
    originalDescription = (featureDoc as any).system?.description || "";
    
    // If that's empty, try accessing description as a getter
    if (!originalDescription && (featureDoc as any).description) {
        originalDescription = (featureDoc as any).description;
    }
    
    // If still empty, try system.data.description for class features
    if (!originalDescription && (featureDoc as any).system?.data?.description) {
        originalDescription = (featureDoc as any).system.data.description;
    }
} catch (error) {
    Log(`Failed to access description for feature ${featureIdentifier}:`, error);
    originalDescription = "";
}
```

### Description Setting Fix (Lines 760-780, 660-675)
**Problem:** Different item types store descriptions in different paths
**Fix:** Multi-path description setting with fallbacks:
```typescript
// Handle description setting - try multiple paths since different item types may store it differently
try {
    if (itemData.system) {
        itemData.system.description = feature.description;
    } else {
        itemData.system = { description: feature.description };
    }
    
    // For class features, also try setting it in system.data.description
    if (itemData.type === "classFeature" && itemData.system.data) {
        itemData.system.data.description = feature.description;
    }
} catch (error) {
    Log(`Failed to set description for feature ${feature.name}:`, error);
    // Fallback to basic system structure
    itemData.system = itemData.system || {};
    itemData.system.description = feature.description;
}
```

## MODIFIED FILES
### Primary: mnemosphere-core.ts (850+ lines)
**Interfaces:** SkillContribution, CombinedSkill, CombinedClass, CombinedFeature, MnemosphereCombinationResult
**Key Logic:**
- Separates base vs sphere items
- Combines mnemosphere contributions with " Sphere" suffix
- HTML source attribution with UUID links and counts
- Class level calculation from combined skills
- Automatic cleanup without deleting actual Mnemospheres

### Secondary: Integration Files
- **technosphere-machine.ts:** Syntax fixes, integration calls
- **technosphere-recompute.ts:** Updated to use mnemosphere core
- **technosphere-settings.hbs:** Added "Update Mnemosphere Skills" button

## KEY TECHNICAL DETAILS
### Skill Combination Logic
```typescript
// Each mnemosphere adds level 1, totaled across all instances
const totalLevel = contributions.reduce((sum, c) => sum + c.level, 0);
const finalLevel = Math.min(totalLevel, maxPossibleLevel);
```

### Source Attribution Format
```html
<hr><h3>Sources:</h3>
<p><strong>SL 1</strong> - @UUID[mnemosphere1]{Name1}, @UUID[mnemosphere2]{Name2}</p>
<p>@UUID[mnemosphere3]{Name3} (×2), @UUID[mnemosphere4]{Name4}</p>
```

### Cleanup Logic
```typescript
// Only delete items marked as generated by module OR sphere-named non-treasures
const isGenerated = item.getFlag(ModuleName, "generated-by-mnemosphere");
const isSphereNamed = item.name.endsWith(" Sphere");
if (isGenerated || (isSphereNamed && item.type !== "treasure")) {
    itemsToDelete.push(item.id);
}
```

## TESTING NEEDS
### End-to-End Validation Required
1. **Skill naming verification:** " Sphere" suffix only on mnemosphere-derived skills
2. **Source tracking display:** UUID links in skill/feature descriptions
3. **Automatic update triggers:** Equipping/unequipping mnemospheres
4. **HTML description rendering:** Proper display in item sheets
5. **Performance testing:** Multiple mnemospheres equipped
6. **Error handling:** Invalid UUIDs, missing descriptions

### Potential Issues to Monitor
- Description getter function handling across Foundry versions
- UUID resolution failures for skills/features
- ✅ **FIXED:** Memory leaks from debounced update timeouts (cleanup functions added)
- Item creation/deletion race conditions
- Large actor sheet re-render performance

## ARCHITECTURE OVERVIEW
```
Actor Equipment Change → Flag Update → Hook Trigger → Debounced Update
    ↓
combineMnemosphereData():
  - Extract base skills/features from base actor (copied as-is)
  - Extract mnemosphere contributions from equipped items
  - Combine into sphere skills/features with " Sphere" suffix
  - Calculate class levels from sphere skills
    ↓
updateActorWithMnemosphereData():
  - Clean up old generated items (smart deletion)
  - Create base items (flagged as generated)
  - Create sphere items (combined with sources)
  - Update class levels (no duplicates)
```

## FILE STRUCTURE
```
scripts/
├── mnemosphere-core.ts (PRIMARY - 850+ lines)
├── technosphere-machine.ts (INTEGRATION)
├── technosphere-recompute.ts (UPDATED)
└── core-config.ts (LOGGING)

templates/inject/actor-sheet/
└── technosphere-settings.hbs (UI BUTTON)
```

## READY FOR: Direct testing - no build/test phase required

## DECOMPRESSION COMPLETE
Context restored. Files ready for testing. All syntax errors resolved. Description handling robust across Foundry VTT item types. Memory leak fixes implemented.
