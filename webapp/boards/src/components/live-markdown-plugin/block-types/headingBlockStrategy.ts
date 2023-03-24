// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {Modifier, SelectionState} from 'draft-js'

import {BlockStrategy} from 'src/components/live-markdown-plugin/pluginStrategy'

import findRangesWithRegex from 'src/components/live-markdown-plugin/utils/findRangesWithRegex'

const createHeadingBlockStrategy = (): BlockStrategy => {
    const HEADING_REGEX = /(^#{1,6})\s(.*)/gm
    const HEADING_LEVELS = [
        'header-one',
        'header-two',
        'header-three',
        'header-four',
        'header-five',
        'header-six',
    ]

    return {
        type: 'heading',
        className: 'heading-block',
        mapBlockType: (contentState) => {
            // Takes a ContentState and returns a ContentState with heading content block
            // type applied
            const blockMap = contentState.getBlockMap()
            let newContentState = contentState

            // Find all heading blocks
            blockMap.forEach((block, blockKey) => {
                if (!block || !blockKey) {
                    return
                }

                const text = block.getText()
                const headingBlockDelimiterRanges = findRangesWithRegex(
                    text,
                    HEADING_REGEX,
                )
                let headingLevel = 1

                // Determine what heading level it should be
                if (headingBlockDelimiterRanges.length > 0) {
                    headingLevel = (text.match(/#/g) || []).length
                }

                // Apply the corresponding heading block type
                if (headingBlockDelimiterRanges.length > 0) {
                    newContentState = Modifier.setBlockType(
                        newContentState,
                        SelectionState.createEmpty(blockKey),
                        HEADING_LEVELS[headingLevel - 1],
                    )
                } else if (HEADING_LEVELS.includes(newContentState.getBlockForKey(blockKey).getType())) {
                    // Remove any existing heading block type if there shouldn't be one
                    newContentState = Modifier.setBlockType(
                        newContentState,
                        SelectionState.createEmpty(blockKey),
                        'unstyled',
                    )
                }
            })

            return newContentState
        },
    }
}

export default createHeadingBlockStrategy
