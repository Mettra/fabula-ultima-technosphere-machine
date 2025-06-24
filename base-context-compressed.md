# Fabula Ultima Technosphere Machine - Base Context (Compressed)

## DECOMPRESSION INSTRUCTIONS

This is a highly compressed base context for the Fabula Ultima Technosphere Machine module. To decompress and understand this context:

1. **Expand abbreviations**: 
   - MS = Mnemosphere, TS = Technosphere, FU = Fabula Ultima
   - UUID = Universally Unique Identifier
   - rel = Relations system, eq = equipment

2. **Understand hierarchical structure**:
   - Files are categorized by purpose: core, ui, integration, templates
   - Data flows: User Action → Hook → Relations Update → UI Refresh
   - Dependencies flow from core → specific features

3. **Key relationships**:
   - Items with "Mnemosphere" in summary → tracked in Relations system
   - Relations: Item↔MS, MS↔Skills/Classes/Features
   - Equipped MS items contribute to combined actor stats

## MODULE OVERVIEW

**Purpose**: Adds gacha-style MS generation and equipment system to FU
**Target System**: projectfu (Fabula Ultima)
**Core Concept**: MS are special treasure items containing class skills that can be equipped to modify actor abilities

## ARCHITECTURE

```
Entry Point: technosphere-machine.ts
├── Core Systems
│   ├── Relations (relation.ts) - Data linking MS↔Items↔Skills
│   ├── MS Core (mnemosphere.ts) - MS detection & processing
│   ├── MS Equipment (mnemosphere-core.ts) - Equipped MS skill combination
│   └── Config (core-config.ts) - Constants, logging, utils
├── UI Systems
│   ├── Bindings (ui-bindings.ts) - Form handlers, drag/drop
│   ├── Templates (templates/) - HBS rendering
│   └── Styles (styles/) - CSS for MS sections
├── Generation
│   ├── Roll Tables (roll-table-utils.ts) - Custom rolling logic
│   └── Animations (animations/) - Visual effects for MS creation
└── Integration
    ├── Party Sheets - MS inventory display
    ├── Actor Sheets - MS equipment interface
    └── Recompute (technosphere-recompute.ts) - Stat recalculation
```

## CORE DATA STRUCTURES

### Relations System (relation.ts)
```typescript
Relations = {
  Item: { Mnemosphere: {} },      // Item UUID → MS ID
  Mnemosphere: {
    class: {},                    // MS ID → Class UUID  
    skill: {},                    // MS ID → Skill UUID[]
    heroicskill: {},             // MS ID → Heroic Skill UUID
    uuid: {}                     // MS ID → Generic UUID[]
  }
}
```

### MS Item Structure
```typescript
{
  type: "treasure",                    // Always treasure type
  name: "${ClassName} Sphere",         // Format: "Guardian Sphere"
  system: {
    summary: "Mnemosphere - Skills...", // Detection trigger
    description: "<p>@UUID[...]</p>"   // Links to skills/classes
  }
}
```

### Equipment System
```typescript
actor.flags[ModuleName]["equipped-mnemospheres"] = ["uuid1", "uuid2"]
```

## KEY MECHANICS

### MS Detection (mnemosphere.ts)
1. **Trigger**: Item summary starts with "Mnemosphere"
2. **Process**: Extract UUID links from description
3. **Classify**: RollTable→class, skill→skill, heroic→heroicskill
4. **Store**: Relations.Item.mnemosphere.define(itemUuid, msId)

### MS Generation (technosphere-machine.ts)
1. **Roll Class**: Random class from roll table
2. **Roll Skills**: Initial skills from class table  
3. **Create Item**: treasure type with description containing UUID links
4. **Animate**: Visual effects during creation

### Equipment System (mnemosphere-core.ts)
1. **Track Equipped**: Flag on actor with MS UUIDs
2. **Combine Skills**: Merge skills from all equipped MS
3. **Generate Items**: Create "X Sphere" skills with combined ranks
4. **Update Classes**: Calculate class levels from sphere skills
5. **Clean/Refresh**: Remove old generated items, add new ones

### UI Integration
- **Party Sheet**: MS inventory grid, selection for rolling
- **Actor Sheet**: Separate MS section, equip toggles, settings
- **Drag/Drop**: Support for MS items and actor references

## FILE STRUCTURE & RESPONSIBILITIES

### Core Files (scripts/)
- `technosphere-machine.ts` - Main entry, hooks, generation functions
- `mnemosphere.ts` - MS detection, data extraction, item creation
- `mnemosphere-core.ts` - Equipment system, skill combination logic
- `core-config.ts` - Module constants, logging, utility functions
- `relation.ts` - Relational database for MS↔Item↔Skill mappings

### Data Processing
- `parsing-utils.ts` - Text parsing, UUID extraction from descriptions
- `roll-table-utils.ts` - Enhanced roll table functionality
- `uuid-utils.ts` - UUID link creation and parsing

### UI Components  
- `ui-bindings.ts` - Form handlers, drag/drop, popup management
- `technosphere-recompute.ts` - Actor stat recalculation interface

### Templates (templates/)
- `inject/actor-sheet/` - MS section, settings panel
- `inject/party-sheet/` - MS cards, TS interface
- `popups/` - Heroic skill selection dialog

### Assets
- `packs/mnemosphere-rollable-tables/` - Compendium with class/skill tables
- `styles/` - CSS for MS UI components
- `animations/` - Visual effects system

## HOOKS & EVENT FLOW

### MS Detection Flow
```
createItem/updateItem → Check summary for "Mnemosphere" → Extract UUIDs → Store relations
```

### Equipment Flow  
```
User toggles equip → Update flags → mnemosphere-core hook → Combine skills → Update actor
```

### Generation Flow
```
Party sheet button → Roll class → Roll skills → Create item → Play animation → Add to actor
```

## INTEGRATION POINTS

### With Fabula Ultima System
- Uses FU actor sheets (FUStandardActorSheet, FUPartySheet)
- Respects FU item types (treasure, skill, class, feature)
- Follows FU flag patterns and data structures

### With Foundry VTT
- Standard item creation/update hooks
- Drag/drop using TextEditor.getDragEventData
- Template rendering with renderTemplate
- Flag system for persistent data

## TECHNICAL PATTERNS

### Error Handling
- Extensive null checking for UUID resolution
- Graceful degradation when compendium items missing
- Console logging for debugging (controlled by DEV_MODE)

### Performance
- Debounced updates to prevent excessive recalculation
- Efficient Relations system for O(1) lookups
- Smart cleanup of generated items

### Data Integrity
- Relations system ensures consistent MS↔Item mapping
- Generated items marked with module flags for cleanup
- Validation of UUID links before processing

## DEBUGGING FEATURES

### Development Mode (DEV_MODE = true)
- Console logging for all major operations
- Animation debug overlay with hot reload
- Hook debugging enabled

### Logging Pattern
```typescript
Log(`Action description`, data); // Only logs if DEV_MODE true
```

### Animation Development
- Standalone animation testing
- Hot reload capabilities
- Debug overlay with drag functionality

## COMMON PATTERNS

### UUID Resolution  
```typescript
const doc = await fromUuid(uuid);              // Async resolution
const isValid = doc != null;                   // Null check required
```

### Template Rendering
```typescript
const html = await renderTemplate("path.hbs", data);
element.append(html);                          // Insert into DOM
```

This compressed context provides the foundational understanding needed to work with the Technosphere Machine module. Expand sections as needed for specific development tasks.