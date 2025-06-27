---
applyTo: "**"
---

Notice that you have no prior memories other than what has been given.

Notice the `memory` tool. This tool memories stored from previous versions to pass on knowledge.

# How to use the `memory` tool
Use the memory-server in two stages:

1. search_nodes  
   • Provide a concise string of distinctive keywords (names, types, or words appearing in observations).  
   • Example:  
     ```json
     { "query": "Alan Turing Bletchley" }
     ```  
   • The server returns a filtered sub-graph containing every entity whose `name`, `entityType`, or any observation line contains those tokens (case-insensitive), plus all relations that link the matched entities.

2. open_nodes  
   • Pass an explicit array of entity names (exact, case-sensitive) that you want the full details for.  
   • Example, after inspecting the search result:  
     ```json
     { "names": ["Alan Turing", "Computing Machinery and Intelligence"] }
     ```  
   • The server returns those entities and all relations that connect any two of them.

Best practice workflow  
a. Call `search_nodes` first with 2-4 high-signal words to narrow the graph.  
b. From the reply, collect the precise `name` strings you need.  
c. Call `open_nodes` with that exact list to retrieve the complete, relation-rich sub-graph.


### Guidelines for Storing Knowledge in the Memory-Server

Use the rules below when calling the MCP tools so that future LLMs can reliably retrieve information with `search_nodes` (string query) and `open_nodes` (list of names).

Entities  
• name – single, unique, descriptive noun phrase (≤ 5 words). Use Title Case, no punctuation.  
  Good ➜ `"Higgs Boson"` Bad ➜ `"the elusive Higgs-boson particle"`  
• entityType – high-level class in lowercase singular (e.g. `person`, `company`, `concept`).  
• observations – array of short facts (≤ 120 chars). Start with a verb and avoid pronouns so search hits keywords.  
  `"Discovered in 2012 at CERN"`  
  `"Explains origin of particle mass"`  

Relations  
• from / to – must exactly match existing entity names (case-sensitive).  
• relationType – verb phrase in active voice, lowercase, singular (e.g. `employs`, `created`, `uses`).  
 Avoid passives like “is employed by”.  

Content conventions  
• Be consistent: always reuse the same entity name spelling.  
• Pack keywords likely to be searched into either `name`, `entityType`, or observation strings.  
• Do not embed JSON or markup inside observations.  
• If a concept belongs to multiple categories, choose the primary one and note others in observations.  

Example  
```json
{
  "entities": [
    {
      "name": "Alan Turing",
      "entityType": "person",
      "observations": [
        "Invented the Turing Machine concept",
        "Worked at Bletchley Park",
        "Proposed the Turing Test"
      ]
    },
    {
      "name": "Computing Machinery and Intelligence",
      "entityType": "paper",
      "observations": [
        "Published in 1950",
        "Introduced the Turing Test"
      ]
    }
  ],
  "relations": [
    { "from": "Alan Turing", "to": "Computing Machinery and Intelligence", "relationType": "authored" }
  ]
}
```

Follow these rules whenever you invoke the tools to ensure stored data remains discoverable.