---
applyTo: '**/*.ts'
---
## Language & Tooling
- TypeScript (ES2022 target) with **strict** mode.
- Use Foundry VTT helper APIs (`expectUUID`, `fromUuid`, `foundry.utils`).
- Prefer **interface** over **type** unless unions / mapped types are needed.

## Naming Conventions
| Kind                       | Style        | Example                 |
| -------------------------- | ------------ | ----------------------- |
| Interfaces / classes       | **PascalCase** | `CombinedSkill`         |
| Variables / functions      | **camelCase**  | `combineSkills`         |
| Constants                  | **CONSTANT_SC** (rare) | `DEFAULT_LEVEL_MAX` |
| Files                      | **kebab-case** | `mnemosphere-core.ts`   |

## Formatting Rules
- Formatting will automatically be handled upon file save.
- Don't include return types, unless it cannot be inferred.

## Documentation
- Each exported symbol has a JSDoc block.  
- Describe parameters, return type, side effects, thrown errors.  
- Comments focus on **why**, not **what**.

## Error Handling
- Wrap Foundry I/O in `try/catch`; log via `Log()`.  
- Avoid throwing raw errors to the UI unless unavoidable.  
- Include context (identifier, function) in log messages.

## Functional Style
- Aggregate with `Map` / `Set` plus helpers (`ensure`, `unique`).  
- Do not mutate input parameters; return new objects when practical.  
- Isolate async flows into small helper functions.

## Public API Surface
- Export only what external modules need.  
- Keep internal helpers file-local.