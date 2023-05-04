// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {InlineStrategy} from 'src/components/live-markdown-plugin/pluginStrategy'
import findRangesWithRegex from 'src/components/live-markdown-plugin/utils/findRangesWithRegex'

// Bold can be delimited by: **, __, ***, and ___
const createBoldStyleStrategy = (): InlineStrategy => {
    const asteriskDelimitedRegex =
		'(\\*\\*\\*)(.+?)(\\*\\*\\*)|(\\*\\*)(.+?)(\\*\\*)(?!\\*)'
    const underscoreDelimitedRegex = '(___)(.+?)(___)|(__)(.+?)(__)(?!_)'
    const boldRegex = new RegExp(
        `${asteriskDelimitedRegex}|${underscoreDelimitedRegex}`,
        'g',
    )
    const boldDelimiterRegex = /^(\*\*\*|\*\*|___|__)|(\*\*\*|\*\*|___|__)$/g

    return {
        style: 'BOLD',
        delimiterStyle: 'BOLD-DELIMITER',
        findStyleRanges: (block) => {
            // Return an array of arrays containing start and end indices for ranges of
            // text that should be bolded
            // e.g. [[0,6], [10,20]]
            const text = block.getText()
            const boldRanges = findRangesWithRegex(text, boldRegex)

            return boldRanges
        },
        findDelimiterRanges: (block, styleRanges) => {
            // Find ranges for delimiters at the beginning/end of styled text ranges
            // Returns an array of arrays containing start and end indices for delimiters
            const text = block.getText()
            let boldDelimiterRanges: number[][] = []
            styleRanges.forEach((styleRange) => {
                const delimiterRange = findRangesWithRegex(
                    text.substring(styleRange[0], styleRange[1] + 1),
                    boldDelimiterRegex,
                ).map((indices) => indices.map((x) => x + styleRange[0]))
                boldDelimiterRanges = boldDelimiterRanges.concat(delimiterRange)
            })

            return boldDelimiterRanges
        },
        delimiterStyles: {
            opacity: 0.4,
        },
    }
}

export default createBoldStyleStrategy
