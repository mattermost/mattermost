// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Translation Layer for the Interactive Messages framework.
//
// Detects which payload format is present in post props and normalises it
// into the canonical mm_blocks schema. Priority order (highest first):
//   mm_blocks → blocks (Block Kit) → cards (Adaptive Cards) → attachments (Attachments)
//
// The server stores all formats as opaque data; all translation is client-side.

import type {PostActionIntegrationFormat} from '@mattermost/types/integration_actions';
import type {MmBlock} from '@mattermost/types/mm_blocks';

import {translateAdaptiveCards} from './adaptive_cards';
import {translateAttachments} from './attachments';
import {translateBlockKit} from './block_kit';

/**
 * Detects the format present in the post props and returns normalised `MmBlock[]`,
 * or null if no supported interactive content is found.
 */
export function translatePostProps(props: Record<string, unknown>): MmBlock[] | null {
    if (Array.isArray(props.mm_blocks) && props.mm_blocks.length > 0) {
        return props.mm_blocks as MmBlock[];
    }
    if (Array.isArray(props.blocks) && props.blocks.length > 0) {
        return translateBlockKit(props.blocks);
    }
    if (Array.isArray(props.cards) && props.cards.length > 0) {
        return translateAdaptiveCards(props.cards);
    }
    if (Array.isArray(props.attachments) && props.attachments.length > 0) {
        return translateAttachments(props.attachments);
    }
    return null;
}

/**
 * Which `integration_format` the do-post-action API expects for this post's props,
 * matching {@link translatePostProps} source priority (native mm_blocks vs translated inputs).
 */
export function getPostInteractiveIntegrationFormat(props: Record<string, unknown>): PostActionIntegrationFormat {
    if (Array.isArray(props.mm_blocks) && props.mm_blocks.length > 0) {
        return 'mm_block';
    }
    if (Array.isArray(props.blocks) && props.blocks.length > 0) {
        return 'block';
    }
    if (Array.isArray(props.cards) && props.cards.length > 0) {
        return 'card';
    }
    if (Array.isArray(props.attachments) && props.attachments.length > 0) {
        return 'attachment';
    }
    return 'attachment';
}
