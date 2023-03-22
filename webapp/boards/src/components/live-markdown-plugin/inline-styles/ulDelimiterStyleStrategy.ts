// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {InlineStrategy} from 'src/components/live-markdown-plugin/pluginStrategy'
import findRangesWithRegex from 'src/components/live-markdown-plugin/utils/findRangesWithRegex'

const createULDelimiterStyleStrategy = (): InlineStrategy => {
    const ulDelimiterRegex = /^\* /g

    return {
        style: 'UL-DELIMITER',
        findStyleRanges: (block) => {
            const text = block.getText()
            const ulDelimiterRanges = findRangesWithRegex(text, ulDelimiterRegex)
            return ulDelimiterRanges
        },
        styles: {
            fontWeight: 'bold',
        },
    }
}

export default createULDelimiterStyleStrategy
