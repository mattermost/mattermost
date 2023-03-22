// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
const findRangesWithRegex = (text: string, regex: RegExp): number[][] => {
    const ranges: number[][] = []
    let matches

    do {
        matches = regex.exec(text)
        if (matches) {
            ranges.push([matches.index, (matches.index + matches[0].length) - 1])
        }
    } while (matches)

    return ranges
}

export default findRangesWithRegex
