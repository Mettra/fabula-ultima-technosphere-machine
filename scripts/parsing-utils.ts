// HTML and string parsing utilities

export function splitArray<T>(array: T[], predicate: (element: T) => boolean): [T[], T[]] {
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

export function extractParagraphsAsLines(description: string): string[] {
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

export function extractKVPairsFromLines(lines: string[]): Array<{key: string, value: string}> {
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
