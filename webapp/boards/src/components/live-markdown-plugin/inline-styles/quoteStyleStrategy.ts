// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {InlineStrategy} from 'src/components/live-markdown-plugin/pluginStrategy'
import findRangesWithRegex from 'src/components/live-markdown-plugin/utils/findRangesWithRegex'

const createQuoteStyleStrategy = (): InlineStrategy => {
    const quoteRegex = /^> (.*)/g
    const quoteDelimiterRegex = /^> /g

    return {
        style: 'QUOTE',
        delimiterStyle: 'QUOTE-DELIMITER',
        findStyleRanges: (block) => {
            const text = block.getText()
            const quoteRanges = findRangesWithRegex(text, quoteRegex)
            return quoteRanges
        },
        findDelimiterRanges: (block, styleRanges) => {
            const text = block.getText()
            let quoteDelimiterRanges: number[][] = []
            styleRanges.forEach((styleRange) => {
                const delimiterRange = findRangesWithRegex(
                    text.substring(styleRange[0], styleRange[1] + 1),
                    quoteDelimiterRegex,
                ).map((indices) => indices.map((x) => x + styleRange[0]))
                quoteDelimiterRanges = quoteDelimiterRanges.concat(delimiterRange)
            })
            return quoteDelimiterRanges
        },
        styles: {
            opacity: 0.75,
        },
        delimiterStyles: {
            opacity: 0.4,
        },
    }
}

export default createQuoteStyleStrategy
