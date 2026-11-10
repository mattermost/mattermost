// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Translation Layer for the Interactive Messages framework.
//
// Detects which payload format is present in post props and normalises it
// into the canonical mm_blocks schema. Priority order (highest first):
//   mm_blocks → blocks (Block Kit) → cards (Adaptive Cards) → attachments (Attachments)
//
// The server stores all formats as opaque data; all translation is client-side.

import type {IntlShape} from 'react-intl';

import type {PostActionIntegrationFormat} from '@mattermost/types/integration_actions';
import type {MmBlock} from '@mattermost/types/mm_blocks';

import {translateAdaptiveCards} from './adaptive_cards';
import {translateAttachments} from './attachments';
import {translateBlockKit} from './block_kit';
import {applyBlockTranslationLimits} from './limits';
import {translateMMBlocks} from './mm_block';

function translationErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    if (typeof error === 'string' && error) {
        return error;
    }
    return 'Unknown error';
}

/** Fallback blocks when format translation throws (e.g. stack overflow on deep recursion). */
export function buildTranslationErrorBlocks(intl: IntlShape, error: unknown): MmBlock[] {
    const title = intl.formatMessage({
        id: 'interactive_messages.translation_error',
        defaultMessage: 'This interactive message could not be displayed.',
    });
    return [{
        type: 'container',
        accent_color: 'danger',
        border: true,
        content: [
            {type: 'text', text: `**${title}**`},
            {type: 'text', text: translationErrorMessage(error), is_subtle: true},
        ],
    }];
}

/** True when post props include a non-empty interactive payload (any supported format). */
export function hasInteractiveMessageProps(props: Record<string, unknown> | undefined): boolean {
    if (!props) {
        return false;
    }
    const mb = props.mm_blocks;
    if (Array.isArray(mb) && mb.length > 0) {
        return true;
    }
    if (Array.isArray(props.blocks) && props.blocks.length > 0) {
        return true;
    }
    if (Array.isArray(props.cards) && props.cards.length > 0) {
        return true;
    }
    return Array.isArray(props.attachments) && props.attachments.length > 0;
}

/**
 * Detects the format present in the post props and returns normalised `MmBlock[]`,
 * or null if no supported interactive content is found.
 */
export function translatePostProps(props: Record<string, unknown>, intl: IntlShape): MmBlock[] | null {
    try {
        let blocks: MmBlock[];
        if (Array.isArray(props.mm_blocks) && props.mm_blocks.length > 0) {
            blocks = translateMMBlocks(props.mm_blocks);
        } else if (Array.isArray(props.blocks) && props.blocks.length > 0) {
            blocks = translateBlockKit(props.blocks);
        } else if (Array.isArray(props.cards) && props.cards.length > 0) {
            blocks = translateAdaptiveCards(props.cards);
        } else if (Array.isArray(props.attachments) && props.attachments.length > 0) {
            blocks = translateAttachments(props.attachments, intl);
        } else {
            return null;
        }
        if (blocks.length === 0) {
            return [];
        }
        return applyBlockTranslationLimits(blocks);
    } catch (error) {
        console.log('error translating post props', error); // eslint-disable-line no-console
        return buildTranslationErrorBlocks(intl, error);
    }
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
