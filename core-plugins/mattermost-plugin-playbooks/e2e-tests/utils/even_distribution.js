// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

function* distributeItems(total, divider) {
    if (divider === 0) {
        yield 0;
    } else {
        let rest = total % divider;
        const result = total / divider;

        for (let i = 0; i < divider; i++) {
            if (rest-- > 0) {
                yield Math.ceil(result);
            } else {
                yield Math.floor(result);
            }
        }
    }
}

function getTestFilesIdentifier(numberOfTestFiles, part, of) {
    const PART = parseInt(part, 10) || 1;
    const OF = parseInt(of, 10) || 1;
    if (PART > OF) {
        throw new Error(`"--part=${PART}" should not be greater than "--of=${OF}"`);
    }

    const distributions = [];
    for (const member of distributeItems(numberOfTestFiles, OF)) {
        distributions.push(member);
    }

    const indexedPart = (PART - 1);

    let start = 0;
    for (let i = 0; i < indexedPart; i++) {
        start += distributions[i];
    }

    const end = distributions[indexedPart] + start;
    const count = distributions[indexedPart];

    return {start, end, count};
}

module.exports = {
    getTestFilesIdentifier,
};
