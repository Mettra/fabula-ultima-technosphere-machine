# Synchronize Function Technical Documentation

Technical documentation for implementing client-server data manipulation using the `synchronize` function in Foundry VTT modules. This system enables coordinated actions across all connected clients with GM-authorized server-side processing.

## Tools

- **TypeScript** with Foundry VTT API access
- **jq** for JSON manipulation and progress tracking
- **VS Code** with TypeScript extension
- **Git** for version control and diff tracking
- **Node.js** with npm for building and watching

## Progress Tracking

Monitor implementation progress using these commands:

```bash
# Check current sync action status
jq '.syncActions[] | select(.status == "in-progress")' sync-progress.json

# View all pending actions
jq '.syncActions[] | select(.status == "pending") | .name' sync-progress.json

# Check system status
jq '.metadata.systemStatus' sync-progress.json
```

## Workflow

### 1. System Setup

1. **Verify socket configuration:**
   - Confirm `module.json` contains `"socket": true`
   - Check `SetupSockets()` is called during module initialization

2. **Initialize progress tracking:**
   ```bash
   jq -n '{
     "metadata": {
       "project": "synchronize-actions",
       "version": "1.0.0",
       "created": "'$(date -I)'",
       "language": "typescript",
       "systemStatus": "ready"
     },
     "syncActions": []
   }' > sync-progress.json
   ```

### 2. Action Registration Loop

3. **Identify required synchronization action:**
   - Determine what server-side processing is needed
   - Define client-side response behavior
   - Document parameters and return types

4. **Create action registration:**
   ```typescript
   RegisterSynchronization(
     "action-name",
     
     // GM Function: Runs on server
     async (params: ActionParams) => {
       // Validate parameters
       // Perform server-side operations
       // Return success data or false
     },
     
     // Everyone Function: Runs on all clients
     async (result: ActionResult) => {
       // Update UI
       // Play animations
       // Show notifications
     }
   );
   ```

5. **Add action to progress tracking:**
   ```bash
   ACTION_NAME="new-action"
   jq --arg name "$ACTION_NAME" --arg desc "Description of action" \
      '.syncActions += [{
        "name": $name,
        "description": $desc,
        "status": "pending",
        "priority": "medium",
        "gmFunction": "defined",
        "everyoneFunction": "defined"
      }]' sync-progress.json > tmp.json && mv tmp.json sync-progress.json
   ```

### 3. Client Integration

6. **Implement client trigger:**
   ```typescript
   // In UI event handler
   await synchronize("action-name", {
     param1: value1,
     param2: value2
   }, (result) => {
     // Handle success response
     ui.notifications.info("Action completed successfully");
   });
   ```

7. **Update progress:**
   ```bash
   ACTION_NAME="current-action"
   jq --arg name "$ACTION_NAME" \
      '(.syncActions[] | select(.name == $name) | .status) = "in-progress"' \
      sync-progress.json > tmp.json && mv tmp.json sync-progress.json
   ```

### 4. Testing and Validation

8. **Test GM function isolation:**
   - Verify only GM processes server-side logic
   - Confirm proper error handling and validation
   - Test resource cost deduction and permission checks

9. **Test broadcast functionality:**
   - Verify all clients receive and process results
   - Test UI updates and animations trigger correctly
   - Confirm proper error messages display

10. **Update completion status:**
    ```bash
    ACTION_NAME="completed-action"
    jq --arg name "$ACTION_NAME" \
       '(.syncActions[] | select(.name == $name) | .status) = "done"' \
       sync-progress.json > tmp.json && mv tmp.json sync-progress.json
    ```

### 5. Documentation and Integration

11. **Document action parameters:**
    - Create TypeScript interfaces for parameters and results
    - Add JSDoc comments explaining purpose and usage
    - Document any side effects or requirements

12. **Integration checkpoint:**
    - Test in multi-client environment
    - Verify proper socket communication
    - Confirm error handling across all scenarios

## TypeScript Implementation Patterns

### GM Function Pattern
```typescript
interface ActionParams {
  actorUUID: string;
  targetUUID: string;
  cost?: number;
}

interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
}

// GM-only processing function
async function processAction(params: ActionParams): Promise<ActionResult | false> {
  try {
    // Validate actor exists and has permissions
    const actor = await fromUuid(params.actorUUID);
    if (!actor) {
      return { success: false, error: "Invalid actor UUID" };
    }

    // Perform server-side operations
    // Update documents, deduct costs, etc.
    
    return {
      success: true,
      data: { /* result data */ }
    };
  } catch (error) {
    Log("Action failed:", error);
    return { success: false, error: error.message };
  }
}
```

### Everyone Function Pattern
```typescript
// Client-side response function
async function handleActionResult(result: ActionResult): Promise<void> {
  if (result.success) {
    // Update UI elements
    // Play animations
    // Show notifications
    ui.notifications.info("Action completed successfully");
  } else {
    ui.notifications.error(result.error || "Action failed");
  }
}
```

### Registration Pattern
```typescript
RegisterSynchronization(
  "action-name",
  processAction,
  handleActionResult
);
```

## JSON Schema Implementation

### Progress Tracking Schema
```json
{
  "metadata": {
    "project": "string",
    "version": "string", 
    "created": "YYYY-MM-DD",
    "language": "typescript",
    "systemStatus": "ready|in-progress|error"
  },
  "syncActions": [
    {
      "name": "string",
      "description": "string",
      "status": "pending|in-progress|done|failed",
      "priority": "low|medium|high",
      "gmFunction": "defined|missing|error",
      "everyoneFunction": "defined|missing|error",
      "lastTested": "YYYY-MM-DD",
      "notes": "string"
    }
  ]
}
```

### JSON Manipulation Commands

**Find next pending action:**
```bash
jq -r '.syncActions[] | select(.status == "pending") | "\(.name)|\(.description)"' sync-progress.json | head -1
```

**Update action status:**
```bash
ACTION_NAME="target-action"
STATUS="in-progress"
jq --arg name "$ACTION_NAME" --arg status "$STATUS" \
   '(.syncActions[] | select(.name == $name) | .status) = $status' \
   sync-progress.json > tmp.json && mv tmp.json sync-progress.json
```

**Add testing notes:**
```bash
ACTION_NAME="tested-action"
NOTES="Multi-client test successful"
jq --arg name "$ACTION_NAME" --arg notes "$NOTES" \
   '(.syncActions[] | select(.name == $name) | .notes) = $notes' \
   sync-progress.json > tmp.json && mv tmp.json sync-progress.json
```

**Mark action as complete:**
```bash
ACTION_NAME="finished-action"
jq --arg name "$ACTION_NAME" --arg date "$(date -I)" \
   '(.syncActions[] | select(.name == $name) | .status) = "done" |
   (.syncActions[] | select(.name == $name) | .lastTested) = $date' \
   sync-progress.json > tmp.json && mv tmp.json sync-progress.json
```

## Error Handling and Validation

### Parameter Validation
```typescript
function validateParams(params: any): params is ActionParams {
  return (
    typeof params.actorUUID === 'string' &&
    typeof params.targetUUID === 'string' &&
    (params.cost === undefined || typeof params.cost === 'number')
  );
}
```

### Error Recovery
```typescript
// In GM function
if (!validateParams(params)) {
  return { 
    success: false, 
    error: "Invalid parameters provided" 
  };
}

// Handle Foundry API errors
try {
  const result = await foundryOperation();
  return { success: true, data: result };
} catch (error) {
  Log("Foundry operation failed:", error);
  return { 
    success: false, 
    error: "Server operation failed" 
  };
}
```

## Integration Checklist

- [ ] Socket enabled in `module.json`
- [ ] `SetupSockets()` called during initialization
- [ ] Action registered with `RegisterSynchronization`
- [ ] GM function validates parameters
- [ ] GM function handles errors gracefully
- [ ] Everyone function updates UI appropriately
- [ ] Client trigger uses `synchronize` function
- [ ] Multi-client testing completed
- [ ] Progress tracking JSON updated
- [ ] Documentation complete
