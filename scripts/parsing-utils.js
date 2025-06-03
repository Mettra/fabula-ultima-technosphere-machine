// HTML and string parsing utilities

/**
 * Splits an array into two halves based on a predicate function.
 * @param {Array<any>} array - The array to split.
 * @param {(element: any) => boolean} predicate - The function to test each element.
 * @returns {[Array<any>, Array<any>]} A tuple containing two arrays: the first half and the second half.
 */
export function splitArray(array, predicate) {
    let firstHalf = true
    return array.reduce((acc, element) => {
        if (firstHalf) {
            if(predicate(element)) {
                firstHalf = false
                return acc
            }
            acc[0].push(element);
        } else {
            acc[1].push(element);
        }
      return acc;
    }, [[], []]);
}

/**
 * Extracts paragraphs from an HTML string description and returns them as an array of plain text lines.
 * @param {string} description - The HTML string description.
 * @returns {string[]} An array of extracted plain text lines.
 */
export function extractParagraphsAsLines(description) {
    let extractedLines = []
    let lines = description.split("<p>")
    const pTagEnd = "</p>"
    for(let line of lines) {
        if(!line.endsWith(pTagEnd)) {
            continue;
        }
        let lineText = line.substring(0, line.length - pTagEnd.length)
        extractedLines.push(lineText)
    }
    return extractedLines
}

/**
 * Extracts key-value pairs from an array of lines.
 * Each line is expected to be in the format "key :: value".
 * @param {string[]} lines - An array of strings, where each string is a key-value pair.
 * @returns {{key: string, value: string}[]} An array of objects, each with 'key' and 'value' properties.
 */
export function extractKVPairsFromLines(lines) {
    let extractedKVPairs = []
    for(let lineText of lines) {
        let values = lineText.split(" :: ")
        if(values.length != 2) {
            continue;
        }
        extractedKVPairs.push({key: values[0], value: values[1]})
    }
    return extractedKVPairs
}
