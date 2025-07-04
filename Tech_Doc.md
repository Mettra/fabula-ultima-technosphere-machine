# Technical Documentation Writing Style Guide

Create consistent, actionable documentation using this standardized writing style for operations run-books and instruction files.

## Document Structure Standards

### 1. Create the Document Header

Start every document with a single H1 heading and introductory paragraph:

```markdown
# Project Name or Goal

Short purpose paragraph that clearly states what this document accomplishes.
```

### 2. Build Section Framework

Structure all documents using H2 headings in logical order:

```markdown
## Tools
<list of required tools with examples>

## Progress Tracking
<commands to monitor progress>

## Workflow
### 1. Setup
<numbered steps>

### 2. Task Loop
<numbered steps>
```

### 3. Format Content Elements

Apply consistent formatting throughout:

- **Bold important words** and begin warnings with "CRITICAL" or "Important"
- Use bulleted lists for unordered information
- Use numbered lists for step-by-step procedures
- Write in imperative voice ("Open...", "Check...", "Ask...")
- Wrap inline code in `back-ticks`
- Place code samples in fenced blocks with language tags

## JSON File Structure Implementation

Every technical documentation MUST be accompanied by a JSON file structure to track progress.

### 1. Design Root Object Schema

Create every JSON file with this structure:

```json
{
  "metadata": {
    "project": "example-project",
    "version": "1.0.0",
    "created": "2025-07-04",
    "language": "javascript",
    "branches": ["main", "develop"],
    "basePath": "/path/to/project"
  },
  "tasks": [
    {
      "id": "task-001",
      "description": "First task to complete",
      "status": "pending",
      "priority": "high"
    }
  ],
  "deletedFiles": [],
  "portingOrder": []
}
```

### 2. Define Array Element Schemas

Document the schema for each array type:

**Task Object Schema:**
- `id` (string) - Unique identifier
- `description` (string) - Human-readable task description
- `status` (string) - One of: "pending", "in-progress", "done", "failed"
- `priority` (string) - One of: "low", "medium", "high"

### 3. Implement JSON Manipulation Commands

Add the following section to the technical document to instruct the usage of editing JSON files.
---BEGIN SECTION

Use `jq` for all JSON operations. Never hand-edit JSON files.

**Read metadata block:**
```bash
jq '.metadata' project-config.json
```

**Find next pending task:**
```bash
jq -r '
  .tasks[]
  | select(.status == "pending")
  | "\(.id)|\(.description)"' project-config.json | head -1
```

**Update task status:**
```bash
TASK_ID="task-001"
jq --arg id "$TASK_ID" \
   '(.tasks[] | select(.id == $id) | .status) = "in-progress"' \
   project-config.json > tmp.json && mv tmp.json project-config.json
```

**Add new task:**
```bash
jq --argjson newTask '{
  "id": "task-002",
  "description": "New task description",
  "status": "pending",
  "priority": "medium"
}' '.tasks += [$newTask]' project-config.json > tmp.json && mv tmp.json project-config.json
```
---END SECTION

## User Interaction Protocol

### 1. Handle Missing Information

When required information is missing for a section, pause, and ask the User questions about the section until missing information is found.

### 2. Workflow

Inside the workflow implement checkpoints with the User:

Example:
```markdown
6. **Get user confirmation:**
   - Open a diff of the files you modified, comparing HEAD to working.
   - Give the user a summary of what you ported
   - Ask: "Mark as done? (y/n)"
   - If yes, update status:
   ```bash
   jq --arg file "path/to/file.java" --arg type "TypeName" \
      '(.portingOrder[] | select(.javaSourcePath == $file) | .types[] | select(.name == $type) | .portingState) = "done"' \
      porting-plan.json > tmp.json && mv tmp.json porting-plan.json
   ```

7. **Update porting-notes.md:**
   - Add any new patterns or special cases discovered.

8. **STOP and confirm:**
   - Show what was ported. Ask: "Continue to next type? (y/n)"
   - Only proceed after confirmation.
```