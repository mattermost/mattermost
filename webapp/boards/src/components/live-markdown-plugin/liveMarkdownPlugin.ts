// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {
    CharacterMetadata,
    ContentBlock,
    ContentState,
    DraftStyleMap,
    EditorChangeType,
    EditorState,
} from 'draft-js'
import {EditorPlugin} from '@draft-js-plugins/editor'
import {List, Repeat} from 'immutable'

// Inline style handlers
import createBoldStyleStrategy from './inline-styles/boldStyleStrategy'
import createItalicStyleStrategy from './inline-styles/italicStyleStrategy'
import createStrikethroughStyleStrategy from './inline-styles/strikethroughStyleStrategy'
import createHeadingDelimiterStyleStrategy from './inline-styles/headingDelimiterStyleStrategy'
import createULDelimiterStyleStrategy from './inline-styles/ulDelimiterStyleStrategy'
import createOLDelimiterStyleStrategy from './inline-styles/olDelimiterStyleStrategy'
import createQuoteStyleStrategy from './inline-styles/quoteStyleStrategy'
import createInlineCodeStyleStrategy from './inline-styles/inlineCodeStyleStrategy'

// Block type handlers
import createCodeBlockStrategy from './block-types/codeBlockStrategy'
import createHeadingBlockStrategy from './block-types/headingBlockStrategy'
import {BlockStrategy, InlineStrategy} from './pluginStrategy'

export interface LiveMarkdownPluginConfig {
    inlineStyleStrategies?: InlineStrategy[]
    blockTypeStrategies?: BlockStrategy[]
}

function createLiveMarkdownPlugin(config: LiveMarkdownPluginConfig = {}): EditorPlugin {
    const {
        inlineStyleStrategies = [
            createBoldStyleStrategy(),
            createItalicStyleStrategy(),
            createStrikethroughStyleStrategy(),
            createHeadingDelimiterStyleStrategy(),
            createULDelimiterStyleStrategy(),
            createOLDelimiterStyleStrategy(),
            createQuoteStyleStrategy(),
            createInlineCodeStyleStrategy(),
        ],
        blockTypeStrategies = [
            createCodeBlockStrategy(),
            createHeadingBlockStrategy(),
        ],
    } = config

    // Construct the editor style map from our inline style strategies
    const customStyleMap: DraftStyleMap = {}
    inlineStyleStrategies.forEach((styleStrategy) => {
        if (styleStrategy.style && styleStrategy.styles) {
            customStyleMap[styleStrategy.style] = styleStrategy.styles
        }
        if (styleStrategy.delimiterStyle && styleStrategy.delimiterStyles) {
            customStyleMap[styleStrategy.delimiterStyle] =
                styleStrategy.delimiterStyles
        }
    })

    // Construct the block style fn
    const blockStyleMap = blockTypeStrategies.reduce((map: Record<string, string>, blockStrategy) => {
        map[blockStrategy.type] = blockStrategy.className

        return map
    }, {})
    const blockStyleFn = (block: ContentBlock) => {
        const blockType = block.getType()

        return blockStyleMap[blockType]
    }

    return {

        // We must handle the maintenance of block types and inline styles on changes.
        // To make sure the code is efficient we only perform maintenance on content
        // blocks that have been changed. We only perform maintenance for change types
        // that result in actual text changes (ignore cursing through text, etc).
        onChange: (editorState) => {
            // if (editorState.getLastChangeType() === 'insert-fragment')
            //   return maintainWholeEditorState();
            return maintainEditorState(
                editorState,
                blockTypeStrategies,
                inlineStyleStrategies,
            )
        },
        customStyleMap,
        blockStyleFn,
    }
}

// Takes an EditorState and returns a ContentState updated with block types and
// inline styles according to the provided strategies
// Takes a targeted approach that only updates the modified block/blocks
const maintainEditorState = (
    editorState: EditorState,
    blockTypeStrategies: BlockStrategy[],
    inlineStyleStrategies: InlineStrategy[],
) => {
    // Bypass maintenance if text was not changed
    const lastChangeType = editorState.getLastChangeType()
    const bypassOnChangeTypes = [
        'adjust-depth',
        'apply-entity',
        'change-block-data',
        'change-block-type',
        'change-inline-style',
        'maintain-markdown',
    ]
    if (bypassOnChangeTypes.includes(lastChangeType)) {
        return editorState
    }

    // Maintain block types then inline styles
    // Order is important bc we want the inline style strategies to be able to
    // look at block type to avoid unnecessary regex searching when possible
    const contentState = editorState.getCurrentContent()
    let newContentState = maintainBlockTypes(contentState, blockTypeStrategies)
    newContentState = maintainInlineStyles(
        newContentState,
        editorState,
        inlineStyleStrategies,
    )

    // Apply the updated content state
    let newEditorState = editorState
    if (contentState !== newContentState) {
        newEditorState = EditorState.push(
            editorState,
            newContentState,
            'maintain-markdown' as EditorChangeType,
        )
    }
    newEditorState = EditorState.forceSelection(
        newEditorState,
        editorState.getSelection(),
    )

    return newEditorState
}

// Takes a ContentState and returns a ContentState with block types and inline styles
// applied or removed as necessary
const maintainBlockTypes = (contentState: ContentState, blockTypeStrategies: BlockStrategy[]) => {
    return blockTypeStrategies.reduce((cs, blockTypeStrategy) => {
        return blockTypeStrategy.mapBlockType(cs)
    }, contentState)
}

// Takes a ContentState (and EditorState for getting the selection and change type)
// and returns a ContentState with inline styles applied or removed as necessary
const maintainInlineStyles = (
    contentState: ContentState,
    editorState: EditorState,
    inlineStyleStrategies: InlineStrategy[],
): ContentState => {
    const lastChangeType = editorState.getLastChangeType()
    const selection = editorState.getSelection()
    const blockKey = selection.getStartKey()
    const block = contentState.getBlockForKey(blockKey)
    const blockMap = contentState.getBlockMap()
    let newBlockMap = blockMap

    // If text has been pasted (potentially modifying/creating multiple blocks) or
    // the editor is new we must maintain the styles for all content blocks
    if (lastChangeType === 'insert-fragment' || !lastChangeType) {
        blockMap.forEach((b, k) => {
            if (!b || !k) {
                return
            }
            const newBlock = mapInlineStyles(b, inlineStyleStrategies) as ContentBlock
            newBlockMap = newBlockMap.set(k, newBlock)
        })
    } else {
        const newBlock = mapInlineStyles(block, inlineStyleStrategies) as ContentBlock
        newBlockMap = newBlockMap.set(blockKey, newBlock)
    }

    // If enter was pressed (or the block was otherwise split) we must maintain
    // styles in the previous block as well
    if (lastChangeType === 'split-block') {
        const newPrevBlock = mapInlineStyles(
            contentState.getBlockBefore(blockKey)!,
            inlineStyleStrategies,
        ) as ContentBlock
        newBlockMap = newBlockMap.set(
            contentState.getKeyBefore(blockKey),
            newPrevBlock,
        )
    }

    const newContentState = contentState.merge({
        blockMap: newBlockMap,
    }) as ContentState

    return newContentState
}

// Maps inline styles to the provided ContentBlock's CharacterMetadata list based
// on the plugin's inline style strategies
const mapInlineStyles = (block: ContentBlock, strategies: InlineStrategy[]) => {
    // This will be called upon any change that has the potential to effect the styles
    // of a content block.
    // Find all of the ranges that should have styles applied to them (i.e. all bold,
    // italic, or strikethrough delimited ranges of the block).
    const blockText = block.getText()

    // Create a list of empty CharacterMetadata to map styles to
    // eslint-disable-next-line new-cap
    let characterMetadataList = List(
        // eslint-disable-next-line new-cap
        Repeat(CharacterMetadata.create(), blockText.length),
    )

    // Evaluate block text with each style strategy and apply styles to matching
    // ranges of text and delimiters
    strategies.forEach((strategy) => {
        const styleRanges = strategy.findStyleRanges(block)
        const delimiterRanges = strategy.findDelimiterRanges ? strategy.findDelimiterRanges(block, styleRanges) : []

        characterMetadataList = applyStyleRangesToCharacterMetadata(
            strategy.style,
            styleRanges,
            characterMetadataList,
        )

        characterMetadataList = applyStyleRangesToCharacterMetadata(
            strategy.delimiterStyle,
            delimiterRanges,
            characterMetadataList,
        )
    })

    // Apply the list of CharacterMetadata to the content block
    return block.set('characterList', characterMetadataList)
}

// Applies the provided style to the corresponding ranges of the character metadata
const applyStyleRangesToCharacterMetadata = (
    style: string | undefined,
    ranges: number[][],
    characterMetadataList: List<CharacterMetadata>,
) => {
    let styledCharacterMetadataList = characterMetadataList
    if (!style) {
        return styledCharacterMetadataList
    }

    ranges.forEach((range) => {
        for (let i = range[0]; i <= range[1]; i++) {
            const styled = CharacterMetadata.applyStyle(
                characterMetadataList.get(i),
                style,
            )
            styledCharacterMetadataList = styledCharacterMetadataList.set(i, styled)
        }
    })

    return styledCharacterMetadataList
}

export default createLiveMarkdownPlugin
