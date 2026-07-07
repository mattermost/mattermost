// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Block Renderer for the Interactive Messages framework.
//
// Consumes normalized `MmBlock[]` and maps each block type to its
// corresponding React component. Built on top of existing product components
// (Markdown, Button) to keep the implementation consistent and avoid duplication.
//
// Unknown block types are silently skipped. Blocks with missing required fields
// are skipped individually; sibling blocks continue to render normally.

import React, {useMemo} from 'react';

import type {MmBlock} from '@mattermost/types/mm_blocks';
import type {PostImage} from '@mattermost/types/posts';

import {MmBlocksImagesMetadataContext, MmBlocksInlineMarkdownActionsContext, MmBlocksInteractionsDisabledContext} from './context';
import type {MmBlocksInlineMarkdownActions} from './context';
import {ContainerBlock} from './layout_blocks';
import type {ActionHandler} from './types';

import './block_renderer.scss';

type BlockRendererProps = {
    blocks: MmBlock[];
    postId: string;
    onAction: ActionHandler;

    /** Optional `post.metadata.images` for dimension hints / SVG handling. */
    imagesMetadata?: Record<string, PostImage>;

    /** For mmaction:// in text blocks (encrypted mm_blocks_actions + integration_format). */
    inlineMarkdownActions?: MmBlocksInlineMarkdownActions;

    /** Preview/read-only surfaces: show controls but block all action dispatch. */
    interactionsDisabled?: boolean;
};

export const BlockRenderer = ({blocks, postId, onAction, imagesMetadata, inlineMarkdownActions, interactionsDisabled = false}: BlockRendererProps) => {
    const metadataValue = useMemo(() => imagesMetadata, [imagesMetadata]);
    const inlineMarkdownActionsValue = useMemo(
        () => inlineMarkdownActions ?? {},
        [inlineMarkdownActions],
    );
    return (
        <MmBlocksImagesMetadataContext.Provider value={metadataValue}>
            <MmBlocksInlineMarkdownActionsContext.Provider value={inlineMarkdownActionsValue}>
                <MmBlocksInteractionsDisabledContext.Provider value={interactionsDisabled}>
                    <div
                        className='mm-blocks'
                        role='group'
                        data-testid='mmBlocks'
                    >
                        <ContainerBlock
                            block={{
                                type: 'container',
                                content: blocks,
                            }}
                            postId={postId}
                            onAction={onAction}
                        />
                    </div>
                </MmBlocksInteractionsDisabledContext.Provider>
            </MmBlocksInlineMarkdownActionsContext.Provider>
        </MmBlocksImagesMetadataContext.Provider>
    );
};
