// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createContext} from 'react';

import type {PostActionIntegrationFormat} from '@mattermost/types/integration_actions';
import type {PostImage} from '@mattermost/types/posts';

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
