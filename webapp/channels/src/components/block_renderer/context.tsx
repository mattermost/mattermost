// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createContext, useContext} from 'react';

import type {PostActionIntegrationFormat} from '@mattermost/types/integration_actions';
import type {PostImage} from '@mattermost/types/posts';

import type {ActionHandler, LookupHandler} from './types';

/** Post-level cookie and format for mmaction:// links inside MM blocks text blocks. */
export type MmBlocksInlineMarkdownActions = {
    mmBlocksActionCookie?: string;
    integrationFormat?: PostActionIntegrationFormat;
};

export const MmBlocksInlineMarkdownActionsContext = createContext<MmBlocksInlineMarkdownActions>({});

/** When true, buttons/selects and mmaction:// links render but do not dispatch actions. */
export const MmBlocksInteractionsDisabledContext = createContext(false);

export const MmBlocksImagesMetadataContext = createContext<Record<string, PostImage> | undefined>(undefined);

/** How the *immediate* mm_blocks parent lays out direct children (`column` = vertical stack, `row` = horizontal flow). */
export const MmBlocksChildLayoutContext = createContext<'column' | 'row'>('column');

/** Action + optional dynamic-select lookup handlers for interactive mm_blocks. */
export type MmBlocksHandlers = {
    onAction: ActionHandler;
    onLookup?: LookupHandler;
};

export const MmBlocksHandlersContext = createContext<MmBlocksHandlers | null>(null);

export function useMmBlocksHandlers(): MmBlocksHandlers {
    const handlers = useContext(MmBlocksHandlersContext);
    if (!handlers) {
        throw new Error('useMmBlocksHandlers must be used within MmBlocksHandlersContext');
    }
    return handlers;
}

/**
 * When true, AutocompleteSelector uses ModalSuggestionList so the dropdown is fixed
 * above modal chrome (same approach as Apps Form / add_user_to_channel_modal).
 */
export const MmBlocksInModalContext = createContext(false);

/** Per-field upload-in-progress tracking so dialogs/posts can disable submit until IDs settle. */
export const MmBlocksFieldUploadingContext = createContext<
    ((fieldName: string, uploading: boolean) => void) | undefined
>(undefined);

/** True while any file_input field reports an in-flight upload. */
export const MmBlocksHasUploadingFieldsContext = createContext(false);
