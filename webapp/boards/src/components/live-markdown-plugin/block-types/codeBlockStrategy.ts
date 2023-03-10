// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {
    ContentBlock,
    ContentState,
    Modifier,
    SelectionState
} from 'draft-js'

import {BlockStrategy} from 'src/components/live-markdown-plugin/pluginStrategy'

import findRangesWithRegex from 'src/components/live-markdown-plugin/utils/findRangesWithRegex'

const createCodeBlockStrategy = (): BlockStrategy => {
    const blockType = 'code-block'
    const CODE_BLOCK_REGEX = /^```/g

    return {
        type: blockType,
        className: 'code-block',
        mapBlockType: (contentState) => {
            // Takes a ContentState and returns a ContentState with code block content
            // block type applied
            const blockMap = contentState.getBlockMap()
            let newContentState = contentState
            let codeBlockKeys: string[] = []
            let notCodeBlockKeys: string[] = []
            let tempKeys: string[] = []
            let language: string

            // Find all code blocks
            blockMap.forEach((block, blockKey) => {
                if (!block || !blockKey) {
                    return
                }
                const text = block.getText()
                const codeBlockDelimiterRanges = findRangesWithRegex(
                    text,
                    CODE_BLOCK_REGEX,
                )
                const precededByDelimiter = tempKeys.length > 0

                // Parse out the language specified after the delimiter for use with the
                // draft-js-prism-plugin for syntax highlighting
                if (codeBlockDelimiterRanges.length > 0 && !precededByDelimiter) {
                    language = (text.match(/\w+/g) || [])[0] || 'javascript'
                }

                // If we find the opening code block delimiter we must maintain an array
                // of all keys for content blocks that might need to be code blocks if we
                // later find a closing code block delimiter
                if (codeBlockDelimiterRanges.length > 0 || precededByDelimiter) {
                    tempKeys.push(blockKey)
                } else {
                    notCodeBlockKeys.push(blockKey)
                }

                // If we find the closing code block delimiter ``` then store the keys for
                // the sandwiched content blocks
                if (codeBlockDelimiterRanges.length > 0 && precededByDelimiter) {
                    codeBlockKeys = codeBlockKeys.concat(tempKeys)
                    tempKeys = []
                }
            })

            // Loop through keys for blocks that should not have code block type and remove
            // code block type if necessary
            notCodeBlockKeys = notCodeBlockKeys.concat(tempKeys)
            notCodeBlockKeys.forEach((blockKey) => {
                if (newContentState.getBlockForKey(blockKey).getType() === blockType) {
                    newContentState = Modifier.setBlockType(
                        newContentState,
                        SelectionState.createEmpty(blockKey),
                        'unstyled',
                    )
                }
            })

            // Loop through found code block keys and apply the block style and language
            // metadata to the block
            codeBlockKeys.forEach((blockKey, i) => {
                // Apply language metadata to block (ignore delimiter blocks)
                const isDelimiterBlock = i === 0 || i === codeBlockKeys.length - 1
                const block = newContentState.getBlockForKey(blockKey)
                const newBlockMap = newContentState.getBlockMap()
                const data = block.
                    getData().
                    merge({language: isDelimiterBlock ? undefined : language})
                const newBlock = block.merge({data}) as ContentBlock
                newContentState = newContentState.merge({
                    blockMap: newBlockMap.set(blockKey, newBlock),
                }) as ContentState

                // Apply block type to block
                newContentState = Modifier.setBlockType(
                    newContentState,
                    SelectionState.createEmpty(blockKey),
                    blockType,
                )
            })

            return newContentState
        },
    }
}

export default createCodeBlockStrategy
