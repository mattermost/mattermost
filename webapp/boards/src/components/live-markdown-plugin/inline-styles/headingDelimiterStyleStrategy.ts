// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {InlineStrategy} from 'src/components/live-markdown-plugin/pluginStrategy'
import findRangesWithRegex from 'src/components/live-markdown-plugin/utils/findRangesWithRegex'

const createHeadingDelimiterStyleStrategy = (): InlineStrategy => {
    const headingDelimiterRegex = /(^#{1,6})\s/g

    return {
        style: 'HEADING-DELIMITER',
        findStyleRanges: (block) => {
            // Skip the text search if the block isn't a header block
            if (block.getType().indexOf('header') < 0) {
                return []
            }

            const text = block.getText()
            const headingDelimiterRanges = findRangesWithRegex(
                text,
                headingDelimiterRegex,
            )

            return headingDelimiterRanges
        },
        styles: {
            opacity: 0.4,
        },
    }
}

export default createHeadingDelimiterStyleStrategy
