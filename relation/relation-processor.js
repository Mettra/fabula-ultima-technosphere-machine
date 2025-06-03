// Tokenizer, Parser, and Generator for relations.txt

function splitStringArrayByComma(arr) {
  const newArr = [];
  for (const str of arr) {
    if (str.includes(',')) {
      const splitStrings = str.split(',');
      newArr.push(...splitStrings);
    } else {
      newArr.push(str);
    }
  }
  return newArr;
}

/**
 * Tokenizes the input text into meaningful tokens.
 * @param {string} input - The content of the relations.txt file.
 * @returns {Array<{}>} - List of tokens.
 */
function tokenize(input) {
    const tokens = [];
    const lines = input.split(/\r?\n/);

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith("//") || trimmed === "") {
            continue; // Skip comments and empty lines
        }

        // Split the line into parts based on known patterns
        const parts = trimmed.split(/\s+/);
        const concept = parts[0];
        
        if (parts[1] === "::") {
            // Handle type definitions (e.g., Concept :: ID)
            const type = parts[2];
            tokens.push({ token: "definition" });
            tokens.push({ token: "concept", value: concept });
            tokens.push({ token: "type", value: type });

        } else if ((parts[1] === "->" || parts[1] === "->>")) {
            // Handle relationships (e.g., Memnosphere -> Class)
            const blocks = splitStringArrayByComma(parts.slice(2))
            const target = blocks[0]

            tokens.push({ token: "relation", value: parts[1] });
            tokens.push({ token: "concept", value: concept });
            tokens.push({ token: "target", value: target });

            let blockIdx = 1
            while (blockIdx < blocks.length) {
                if(blocks[blockIdx] == "limit") {
                    tokens.push({ token: "limit", value: blocks[blockIdx + 1] });
                    blockIdx += 2
                }
                else {
                    ++blockIdx
                }
            }
        } else {
            console.warn(`Unrecognized line format: ${trimmed}`);
        }
    }

    return tokens;
}

/**
 * Parses the tokens into an abstract syntax tree (AST).
 * @param {Array<{token: string, value?: string | string[]}>} tokens - List of tokens.
 *        - 'definition' token has no 'value'.
 *        - 'target' token's 'value' is string[].
 *        - Other tokens ('concept', 'type', 'relation', 'limit') have string 'value'.
 * @returns {Object} - The AST representation of the relations, with `concepts` and `externalTypes` properties.
 */
function parse(tokens) {
    const ast = { concepts: {}, externalTypes: {} };
    let i = 0;

    while (i < tokens.length) {
        const currentToken = tokens[i];

        if (!currentToken || !currentToken.token) {
            console.warn(`[Parser] Invalid or undefined token at index ${i}. Skipping.`);
            i++;
            continue;
        }

        if (currentToken.token === "definition") {
            const conceptToken = tokens[i + 1];
            const typeToken = tokens[i + 2];
            const conceptName = conceptToken.value;
            const typeValue = typeToken.value;

            if (typeof conceptName !== 'string' || typeof typeValue !== 'string') {
                console.warn(`[Parser] Invalid value type for concept or type in definition. Concept: '${conceptName}', Type: '${typeValue}'. Skipping definition.`);
                i += 3;
                continue;
            }

            if (typeValue.startsWith("`") && typeValue.endsWith("`")) {
                const externalType = typeValue.slice(1, -1); 
                ast.externalTypes[conceptName] = externalType;
            } else {
                if (!ast.concepts[conceptName]) {
                    ast.concepts[conceptName] = { type: typeValue, relations: [] };
                } else {
                    ast.concepts[conceptName].type = typeValue; // Update type if concept already exists (e.g., from a relation)
                }
            }
            i += 3; // Consumed: definition, concept, type
        } else if (currentToken.token === "relation") {
            // This indicates a relation definition: Concept -> Target or Concept ->> Target
            if (i + 2 >= tokens.length) {
                console.warn(`[Parser] Incomplete relation. Expected 'relation' and 'target' tokens after 'concept'. Tokens remaining: ${JSON.stringify(tokens.slice(i))}`);
                break;
            }

            const relationToken = currentToken;
            const conceptName = tokens[i + 1].value;
            const targetToken = tokens[i + 2];

            if (typeof conceptName !== 'string') {
                console.warn(`[Parser] Invalid value type for concept in relation: '${conceptName}'. Skipping relation.`);
                i += 1; // Advance past current concept token
                continue;
            }
            if (!relationToken || relationToken.token !== "relation" || !targetToken || targetToken.token !== "target") {
                console.warn(`[Parser] Invalid token sequence for relation for concept '${conceptName}'. Expected 'relation' then 'target'. Got: ${relationToken?.token}, ${targetToken?.token}.`);
                i += 1; // Advance past current concept token
                continue;
            }
            
            const relationValue = relationToken.value;
            // targetToken.value is an array, e.g., ["ClassName"] from tokenize step
            if (targetToken.value.length === 0 || typeof targetToken.value !== 'string') {
                 console.warn(`[Parser] Invalid target value for relation from concept '${conceptName}'. Expected string. Got: ${JSON.stringify(targetToken.value)}.`);
                 i += 3; // Skip concept, relation, target
                 continue;
            }
            const targetName = targetToken.value;

            // Ensure source concept exists
            if (!ast.concepts[conceptName]) {
                ast.concepts[conceptName] = { type: "ID", relations: [] }; // Default type if not defined yet
            }

            // Ensure target concept placeholder exists if it's not known as an external type alias.
            // Its type defaults to "ID" and can be updated if a definition for it is parsed later.
            if (!ast.concepts[targetName] && !ast.externalTypes[targetName]) {
                ast.concepts[targetName] = { type: "ID", relations: [] };
            }

            let limit = null;
            let consumedTokens = 3; // concept, relation, target

            if (i + 3 < tokens.length && tokens[i + 3]?.token === "limit") {
                const limitToken = tokens[i + 3];
                if (limitToken.value !== undefined && typeof limitToken.value === 'string') {
                    limit = parseInt(limitToken.value, 10);
                    if (isNaN(limit)) {
                        console.warn(`[Parser] Invalid limit value '${limitToken.value}' for ${conceptName} ${relationValue} ${targetName}. Limit ignored.`);
                        limit = null;
                    }
                } else {
                     console.warn(`[Parser] Limit token found but has invalid or missing value for ${conceptName} ${relationValue} ${targetName}. Limit ignored.`);
                }
                consumedTokens = 4;
            }

            ast.concepts[conceptName].relations.push({
                relation: relationValue,
                target: targetName,
                limit: limit
            });
            i += consumedTokens;
        } else {
            console.warn(`[Parser] Unexpected token encountered: ${JSON.stringify(currentToken)}. Skipping.`);
            i++; 
        }
    }
    return ast;
}


/**
 * Generates JavaScript code from the AST.
 * @param {Object} ast - The AST representation of the relations.
 * @returns {string} - The generated JavaScript code.
 */
function generate(ast) {
    let output = `/**
 * A unique identifier for a concept.
 * @typedef {number} ID
 */

const Relations = {
`;

    for (const [concept, data] of Object.entries(ast.concepts)) {
        const type = data.type === "ID" ? "ID" : ast.externalTypes[data.type] || data.type;

        output += `
        /**
         * A unique identifier for a ${concept}.
         * @typedef {${type}} ${concept}_ID
         */

        /**
         * Defines relationships for ${concept}.
         */
        ${concept}: {
            NextId: 0,

            GetNextId() {
                return this.NextId++; 
            },

`;

        for (const relation of data.relations) {
            const { relation: relType, target, limit } = relation;
            const targetType = ast.concepts[target]?.type || ast.externalTypes[target] || "ID";

            if (relType === "->") {
                output += `
                ${target.toLowerCase()}: {
                    /**
                     * Stores the one-to-one relationships.
                     * @type {Object<${concept}_ID, ${targetType}>}
                     */
                    tbl: {},

                    /**
                     * Defines a one-to-one relationship from ${concept} to ${target}.
                     * @param {${concept}_ID} id - The unique ID of the ${concept}.
                     * @param {${targetType}} value - The value to associate with the ${target}.
                     */
                    define: function(id, value) { this.tbl[id] = value; }
                },
`;
            } else if (relType === "->>") {
                output += `
                ${target.toLowerCase()}: {
                    /**
                     * Stores the one-to-many relationships.
                     * @type {Object<${concept}_ID, Array<${targetType}>>}
                     */
                    tbl: {},

                    /**
                     * Defines a one-to-many relationship from ${concept} to ${target}.
                     * ${limit ? `Enforces a maximum of ${limit} relations.` : "No limit on relations."}
                     * @param {${concept}_ID} id - The unique ID of the ${concept}.
                     * @param {${targetType}} value - The value to associate with the ${target}.
                     */
                    define: function(id, value) {
                        if (!this.tbl[id]) this.tbl[id] = [];
                        ${limit ? `if (this.tbl[id].length >= ${limit}) RelationErrorHandler.notifyError('Limit exceeded');` : ""}
                        this.tbl[id].push(value);
                    },

                    /**
                     * Clears the relationship from ${concept} to ${target}.
                     * @param {${concept}_ID} id - The unique ID of the ${concept}.
                     * @param {${targetType}} value - The value to associate with the ${target}.
                     */
                    clear: function(id, value) {
                        this.tbl[id] = null;
                    }
                },
`;
            }
        }

        output += `
            /**
             * Clear all relations for a specific instance.
             * @param {${concept}_ID} id - The unique ID of the ${concept}.
             */
            ClearRelations(id) {
`
        for (const relation of data.relations) {
            const { relation: relType, target, limit } = relation;
            output += `                this.${target.toLowerCase()}[id] = null;
`
        }
        output += `
            }
`
        

        output += `         },
`;
    }

    // Generate LogAll function
    let logAllFunctionBody = `
    LogAll: function() {
        console.log("--- Logging All Relation Tables ---");
`;
    for (const [concept, data] of Object.entries(ast.concepts)) {
        for (const relation of data.relations) {
            const { target } = relation;
            const targetKey = target.toLowerCase();
            // Note: Accessing nested properties like this.Concept.target.tbl
            // assumes 'this' refers to the 'Relations' object itself when LogAll is called.
            logAllFunctionBody += `        console.log("Relations.${concept}.${targetKey}.tbl:", this.${concept}.${targetKey}.tbl);\n`;
        }
    }
    logAllFunctionBody += `        console.log("--- End of Relation Tables ---");
    },
`;
    
    output += logAllFunctionBody;


    output += `}
`;

    output += `/**
 * Centralized error-handling interface.
 */
const RelationErrorHandler = {
    /**
     * Logs an error message and optionally uses Foundry VTT's notification system.
     * @param {string} message - The error message to log.
     */
    notifyError: function(message) {
        console.error(message); // Log to console
        if (typeof ui !== 'undefined' && ui.notifications) {
            ui.notifications.error(message);
        }
    }
};

export { Relations };
`;

    return output;
}

// Example usage
const fs = require("fs");
const inputPath = "./relation/relations.txt";
const outputPath = "./relation/output2.js";

const input = fs.readFileSync(inputPath, "utf-8");
const tokens = tokenize(input);
const ast = parse(tokens);
const generatedCode = generate(ast);

fs.writeFileSync(outputPath, generatedCode, "utf-8");
console.log("Relations processed and output.js generated.");
