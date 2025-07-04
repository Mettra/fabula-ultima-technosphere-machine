Writing style  
• Markdown document that reads like an operations run-book.  
• Single H1 heading gives the project name or goal.  
• Short introductory paragraph that states purpose.  
• All other sections introduced with H2 (##) headings in logical order: overview → tools → workflow.  
• Inside a section use either:  
  – Bulleted lists for unordered information.  
  – Numbered lists for step-by-step procedures.  
• Imperative voice (“Open…”, “Check…”, “Ask…”) keeps instructions concise.  
• Important words are bolded; warnings often begin with “CRITICAL” or “Important”.  
• Code or command samples go in fenced blocks annotated with a language tag (`json`, `bash`, `javascript`, etc.).  
• Inline code is wrapped in back-ticks.  
• Comments inside code samples explain non-obvious parts.  
• Long commands are copy-pastable, never broken across lines unless using line-continuation characters.  
• Dialogue prompts to user are written in plain quotes and end with “(y/n)” to request confirmation.  
• When interaction is required the script explicitly says “STOP and wait for confirmation”.

Typical document skeleton
```
# <TITLE>

Short purpose paragraph.

## Tools
<list of tools with examples>

## Progress Tracking
<commands to monitor progress>

## Workflow
### 1. Setup
<numbered steps>

### 2. Task Loop
<numbered steps>
```

JSON file structure pattern  
1. Root object always contains a `"metadata"` object first.  
2. `metadata` stores global, mostly static values (branches, paths, language, timestamp).  
3. Arrays for entities to process come next (`deletedFiles`, `portingOrder`, …).  
4. Every array element is an object with a fixed, documented schema.  
  • If nested arrays are needed place them under a key that describes their role (types, `steps`, etc.).  
5. Enumeration-like fields use lowercase strings (`"pending"`, `"done"`).  
6. Line and column numbers are explicitly stated as 1-based in a comment above the JSON or in the prose.  
7. Objects meant to be edited later contain a `"status"` or `"state"` field so progress can be updated in-place.  
8. Comments about individual fields are provided in the Markdown, not inside the JSON (keeps files valid).  
9. Provide at least one fully expanded JSON example in the instruction file; this becomes the template for users.  

### JSON Interaction Rules  

1. Always use `jq`; never hand-edit a JSON file.  
2. All commands must be copy-pastable in a POSIX shell on the user’s host OS.  
3. Redirect writes through a temporary file, then move it back (avoids data loss).  
4. Treat paths, type names, and states as shell variables to keep commands generic.  

#### Common Operations  

```bash
# Read whole metadata block
jq '.metadata' <json-file>

# Read next pending task (example schema)
jq -r '
  .tasks[]
  | select(.state == "pending")
  | "\(.id)|\(.description)"' <json-file> | head -1

# Update a single field
jq --arg id "$TASK_ID" \
   '(.tasks[] | select(.id == $id) | .state) = "in-progress"' \
   <json-file> > tmp.json && mv tmp.json <json-file>

# Append a new array element
jq --argjson newItem '{"id":123,"state":"pending"}' \
   '.tasks += [$newItem]' \
   <json-file> > tmp.json && mv tmp.json <json-file>
```

Agent↔User clarification protocol  
• If any required metadata or schema element is missing when the script is used, the Agent must pause and ask the user for it.  
• Questions should be specific: “Please supply targetRuntimePath (absolute path).”  
• Resume only after the user answers.  

Generality guidelines  
• Keep domain-specific vocabulary out; refer generically to “source implementation” and “target implementation”.  
• Avoid hard-coding language names; use placeholders like `<sourceLanguage>` / `<targetLanguage>`.  
• All command examples should illustrate patterns but not depend on a particular toolchain—replace with symbolic names (`./compile-<targetLanguage>.sh`).  
• Whenever concrete file extensions appear, pair them with a placeholder explanation (e.g., “*.ts (TypeScript files)”).

By following the markdown skeleton, imperative tone, and the metadata-first JSON schema, users can author instruction files for very different automation scenarios while retaining a clear, repeatable structure.