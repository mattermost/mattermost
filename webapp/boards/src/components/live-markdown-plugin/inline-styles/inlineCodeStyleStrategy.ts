// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {InlineStrategy} from 'src/components/live-markdown-plugin/pluginStrategy'
import findRangesWithRegex from 'src/components/live-markdown-plugin/utils/findRangesWithRegex'

const createInlineCodeStyleStrategy = (): InlineStrategy => {
    const codeRegex = /(`)([^\n\r`]+?)(`)/g

    return {
        style: 'INLINE-CODE',
        findStyleRanges: (block) => {
            // Don't allow inline code inside of code blocks
            if (block.getType() === 'code-block') {
                return []
            }

            const text = block.getText()
            const codeRanges = findRangesWithRegex(text, codeRegex)
            return codeRanges
        },
        styles: {
            fontFamily: 'monospace',
        },
    }
}

export default createInlineCodeStyleStrategy
