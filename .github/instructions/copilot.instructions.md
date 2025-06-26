# Fabula Ultima Technosphere Machine - Copilot Instructions

## Project Overview

You are working on the **Fabula Ultima Technosphere Machine**, a Foundry VTT module that extends the Fabula Ultima RPG system with a gacha-style equipment system called "Mnemospheres."

### Core Concept
- **Mnemospheres (MS)** are special treasure items containing class skills
- Players can equip multiple MS to combine their skills and modify actor abilities
- The system uses a **Relations database** to track connections between items, mnemospheres, skills, and classes
- Integration with Fabula Ultima's existing class and skill system

## Domain Knowledge

### Key Terms
- **MS/Mnemosphere**: Special treasure items containing class skills
- **TS/Technosphere**: The generation/management system for mnemospheres
- **Relations**: Internal database tracking MS↔Item↔Skill connections
- **Equipped MS**: Mnemospheres currently active on an actor
- **Combined Skills**: Merged skills from all equipped mnemospheres

### Target System
- **Foundry VTT**: Virtual tabletop platform
- **projectfu**: The Fabula Ultima system implementation
- **Module Integration**: Hooks into existing FU actor sheets and workflows

## Architecture Overview

```
Entry: technosphere-machine.ts
├── Core Systems
│   ├── Relations (relation.ts) - Data linking MS↔Items↔Skills  
│   ├── MS Detection (mnemosphere.ts) - Identify and process MS items
│   ├── Equipment (mnemosphere-core.ts) - Combine equipped MS skills
│   └── Config (core-config.ts) - Constants and utilities
├── UI Systems  
│   ├── Bindings (ui-bindings.ts) - Form handlers, drag/drop
│   ├── Templates (templates/) - Handlebars rendering
│   └── Styles (styles/) - CSS for MS interfaces
├── Generation
│   ├── Roll Tables (roll-table-utils.ts) - Custom rolling logic
│   └── Animations (animations/) - Visual effects
└── Integration
    ├── Actor/Party Sheets - MS equipment interface
    └── Recompute (technosphere-recompute.ts) - Stat recalculation
```

## File Organization

### Core Files (`scripts/`)
- `technosphere-machine.ts` - Main entry point, hooks, generation
- `mnemosphere.ts` - MS detection and data extraction
- `mnemosphere-core.ts` - Equipment system and skill combination
- `relation.ts` - Relational database for MS connections
- `core-config.ts` - Module constants and utilities

### UI Components
- `ui-bindings.ts` - Form handlers, drag/drop, popups
- `templates/inject/` - Actor/party sheet templates
- `templates/popups/` - Modal dialogs
- `styles/` - CSS for MS interfaces

### Integration
- `technosphere-recompute.ts` - Actor stat recalculation
- `parsing-utils.ts` - UUID extraction and text processing
- `uuid-utils.ts` - UUID link creation and validation

## Coding Conventions

### Foundry VTT Patterns
- Use `fromUuid()` for UUID resolution with null checks
- Wrap I/O operations in try/catch with `Log()` error handling
- Follow Foundry flag patterns: `actor.flags[ModuleName][key]`
- Use `renderTemplate()` for HTML generation

### Error Handling
- Never throw raw errors to UI unless unavoidable
- Include context (identifier, function) in log messages
- Graceful degradation when compendium items missing

### Functional Style
- Don't mutate input parameters
- Use `Map`/`Set` with helper functions
- Isolate async flows into small helpers
- Return new objects when practical

## Common Patterns

### UUID Resolution
```typescript
const doc = await fromUuid(uuid);
if (!doc) {
    Log(`Failed to resolve UUID: ${uuid}`, "functionName");
    return;
}
```

### Template Rendering
```typescript
const html = await renderTemplate("path.hbs", data);
element.append(html);
```

### Relations Usage
```typescript
Relations.Item.Mnemosphere.define(itemUuid, msId);
const msId = Relations.Item.Mnemosphere.get(itemUuid);
```

### Flag Management
```typescript
const equipped = actor.getFlag(ModuleName, "equipped-mnemospheres") || [];
await actor.setFlag(ModuleName, "equipped-mnemospheres", newEquipped);
```

## Integration Points

### With Fabula Ultima
- Extends `FUStandardActorSheet` and `FUPartySheet`
- Uses FU item types: treasure, skill, class, feature
- Respects FU data structures and flag patterns
- Integrates with FU's skill and class systems

### With Foundry VTT
- Hooks: `createItem`, `updateItem`, `renderActorSheet`
- Drag/drop using `TextEditor.getDragEventData`
- Template system with Handlebars
- Flag system for persistent data

## Development Guidelines

### Debugging
- Use `Log()` function for debug output (respects DEV_MODE)
- Animation debug overlay available in dev mode
- Relations system provides debugging utilities

### Performance
- Debounced updates prevent excessive recalculation
- Efficient O(1) lookups in Relations system
- Smart cleanup of generated items

### Data Integrity
- Relations ensure consistent MS↔Item mapping
- Generated items marked with module flags
- Validation of UUID links before processing
- Cleanup routines remove orphaned data

Remember: This is a specialized domain with complex data relationships. Always consider the impact on the Relations system when modifying MS-related data, and ensure proper cleanup of generated items.
