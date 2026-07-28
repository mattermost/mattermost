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

import {MmBlocksHandlersContext, MmBlocksImagesMetadataContext, MmBlocksInlineMarkdownActionsContext, MmBlocksInteractionsDisabledContext} from './context';
import type {MmBlocksInlineMarkdownActions} from './context';
import {MmBlocksForm} from './form';
import type {MmBlocksFormErrors} from './form';
import {ContainerBlock} from './layout_blocks';
import type {ActionHandler, LookupHandler} from './types';

import './block_renderer.scss';

type BlockRendererProps = {
    blocks: MmBlock[];
    postId: string;
    onAction: ActionHandler;
    onLookup?: LookupHandler;

    /** Optional `post.metadata.images` for dimension hints / SVG handling. */
    imagesMetadata?: Record<string, PostImage>;

    /** For mmaction:// in text blocks (encrypted mm_blocks_actions + integration_format). */
    inlineMarkdownActions?: MmBlocksInlineMarkdownActions;

    /** Preview/read-only surfaces: show controls but block all action dispatch. */
    interactionsDisabled?: boolean;

    /**
     * When false, do not wrap children in MmBlocksForm (parent already provides form context).
     * Defaults to true.
     */
    provideForm?: boolean;

    /** Field-level integration errors (keys match input `name`). Used when provideForm is true. */
    formErrors: MmBlocksFormErrors;
    onFormErrorsChange: (errors: MmBlocksFormErrors) => void;
};

export const BlockRenderer = ({
    blocks,
    postId,
    onAction,
    onLookup,
    imagesMetadata,
    inlineMarkdownActions,
    interactionsDisabled = false,
    provideForm = true,
    formErrors,
    onFormErrorsChange,
}: BlockRendererProps) => {
    const metadataValue = useMemo(() => imagesMetadata, [imagesMetadata]);
    const inlineMarkdownActionsValue = useMemo(
        () => inlineMarkdownActions ?? {},
        [inlineMarkdownActions],
    );
    const handlersValue = useMemo(
        () => ({onAction, onLookup}),
        [onAction, onLookup],
    );

    const content = (
        <div
            className='mm-blocks'
            role='group'
        >
            <ContainerBlock
                block={{
                    type: 'container',
                    content: blocks,
                }}
                postId={postId}
            />
        </div>
    );

    return (
        <MmBlocksImagesMetadataContext.Provider value={metadataValue}>
            <MmBlocksInlineMarkdownActionsContext.Provider value={inlineMarkdownActionsValue}>
                <MmBlocksInteractionsDisabledContext.Provider value={interactionsDisabled}>
                    <MmBlocksHandlersContext.Provider value={handlersValue}>
                        {provideForm ? (
                            <MmBlocksForm
                                errors={formErrors}
                                onErrorsChange={onFormErrorsChange}
                            >
                                {content}
                            </MmBlocksForm>
                        ) : content}
                    </MmBlocksHandlersContext.Provider>
                </MmBlocksInteractionsDisabledContext.Provider>
            </MmBlocksInlineMarkdownActionsContext.Provider>
        </MmBlocksImagesMetadataContext.Provider>
    );
};
