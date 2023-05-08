// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {InlineStrategy} from 'src/components/live-markdown-plugin/pluginStrategy'
import findRangesWithRegex from 'src/components/live-markdown-plugin/utils/findRangesWithRegex'

const createItalicStyleStrategy = (): InlineStrategy => {
    const asteriskDelimitedRegex = '(?<!\\*)(\\*)(?!\\*)(.+?)(?<!\\*)\\*(?!\\*)' // *italic*
    const underscoreDelimitedRegex = '(?<!_)(_)(?!_)(.+?)(?<!_)_(?!_)' // _italic_
    const strongEmphasisRegex = '(\\*\\*\\*|___)(.+?)(\\*\\*\\*|___)' // ***bolditalic*** ___bolditalic___
    const boldWrappedAsteriskRegex =
		'(?<=\\*\\*)(\\*)(?!\\*)(.*?[^\\*]+)(?<!\\*)\\*(?![^\\*]\\*)|(?<!\\*)(\\*)(?!\\*)(.*?[^\\*]+)(?<!\\*)\\*(?=\\*\\*)' // ***italic* and bold** **bold and *italic***
    const boldWrappedUnderscoreRegex =
		'(?<=__)(_)(?!_)(.*?[^_]+)(?<!_)_(?![^_]_)|(?<!_)(_)(?!_)(.*?[^_]+)(?<!_)_(?=__)' // ___italic_ and bold__ __bold and _italic___
    let italicRegex: RegExp
    try {
        italicRegex = new RegExp(
            `${asteriskDelimitedRegex}|${underscoreDelimitedRegex}|${strongEmphasisRegex}|${boldWrappedAsteriskRegex}|${boldWrappedUnderscoreRegex}`,
            'g',
        )
    } catch {
        // Safari (as of 15.2) doesn't support RegEx lookbacks (https://caniuse.com/js-regexp-lookbehind)
        const altAsteriskDelimitedRegex = '([^\\*]|^)(\\*)([^\\*]+)(\\*)(?!\\*)' // *italic*
        const altUnderscoreDelimitedRegex = '([^_]|^)(_)([^_]+)(_)(?!_)' // _italic_
        // TODO: Add support for boldWrappedAsteriskRegex and boldWrappedUnderscoreRegex
        italicRegex = new RegExp(
            `${altAsteriskDelimitedRegex}|${altUnderscoreDelimitedRegex}|${strongEmphasisRegex}`,
            'g',
        )
    }

    const italicDelimiterRegex = /^(\*\*\*|\*|___|_)|(\*\*\*|\*|___|_)$/g

    return {
        style: 'ITALIC',
        delimiterStyle: 'ITALIC-DELIMITER',
        findStyleRanges: (block) => {
            // Return an array of arrays containing start and end indices for ranges of
            // text that should be italicized
            // e.g. [[0,6], [10,20]]
            const text = block.getText()
            const italicRanges = findRangesWithRegex(text, italicRegex)

            return italicRanges
        },
        findDelimiterRanges: (block, styleRanges) => {
            // Find ranges for delimiters at the beginning/end of styled text ranges
            // Returns an array of arrays containing start and end indices for delimiters
            const text = block.getText()
            let italicDelimiterRanges: number[][] = []
            styleRanges.forEach((styleRange) => {
                const delimiterRange = findRangesWithRegex(
                    text.substring(styleRange[0], styleRange[1] + 1),
                    italicDelimiterRegex,
                ).map((indices) => indices.map((x) => x + styleRange[0]))
                italicDelimiterRanges = italicDelimiterRanges.concat(delimiterRange)
            })

            return italicDelimiterRanges
        },
        delimiterStyles: {
            opacity: 0.4,
        },
    }
}

export default createItalicStyleStrategy
