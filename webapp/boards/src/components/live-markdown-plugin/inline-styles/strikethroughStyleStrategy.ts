// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {InlineStrategy} from 'src/components/live-markdown-plugin/pluginStrategy'
import findRangesWithRegex from 'src/components/live-markdown-plugin/utils/findRangesWithRegex'

const createStrikethroughStyleStrategy = (): InlineStrategy => {
    const strikethroughRegex = /(~~)(.+?)(~~)/g
    const strikethroughDelimiterRegex = /^(~~)|(~~)$/g

    return {
        style: 'STRIKETHROUGH',
        delimiterStyle: 'STRIKETHROUGH-DELIMITER',
        findStyleRanges: (block) => {
            // Return an array of arrays containing start and end indices for ranges of
            // text that should be crossed out
            // e.g. [[0,6], [10,20]]
            const text = block.getText()
            const strikethroughRanges = findRangesWithRegex(text, strikethroughRegex)

            return strikethroughRanges
        },
        findDelimiterRanges: (block, styleRanges) => {
            // Find ranges for delimiters at the beginning/end of styled text ranges
            // Returns an array of arrays containing start and end indices for delimiters
            const text = block.getText()
            let strikethroughDelimiterRanges: number[][] = []
            styleRanges.forEach((styleRange) => {
                const delimiterRange = findRangesWithRegex(
                    text.substring(styleRange[0], styleRange[1] + 1),
                    strikethroughDelimiterRegex,
                ).map((indices) => indices.map((x) => x + styleRange[0]))
                strikethroughDelimiterRanges = strikethroughDelimiterRanges.concat(
                    delimiterRange,
                )
            })

            return strikethroughDelimiterRanges
        },
        styles: {
            textDecoration: 'line-through',
        },
        delimiterStyles: {
            opacity: 0.4,
            textDecoration: 'none',
        },
    }
}

export default createStrikethroughStyleStrategy
